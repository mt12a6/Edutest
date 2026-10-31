import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  UserProfile, 
  SchoolClass, 
  Subject, 
  Exam, 
  Question, 
  ExamAttempt, 
  ExamResult, 
  SystemLog,
  UserRole
} from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { 
  isMultipleChoiceCorrect, 
  isFillBlankCorrect, 
  evaluateTrueFalseQuestion,
  calculateExamSubmissionBreakdown
} from '../utils/grading';
import { performanceTracker } from '../utils/performanceMetrics';

// Utility to recursively strip undefined keys so Firebase never throws Unsupported field value: undefined
export function sanitizeForFirestore<T extends Record<string, any>>(obj: T): T {
  const clean: any = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined && val !== null) {
      if (typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        clean[key] = sanitizeForFirestore(val);
      } else {
        clean[key] = val;
      }
    }
  }
  return clean as T;
}

// Local Storage helpers for immediate instant updates and resilient fallback
const STORAGE_USERS_KEY = 'edutest_custom_users';
const STORAGE_EXAMS_KEY = 'edutest_custom_exams';
const STORAGE_QUESTIONS_KEY = 'edutest_custom_questions_map';
const STORAGE_RESULTS_KEY = 'edutest_custom_results';
const STORAGE_CLASSES_KEY = 'edutest_classes';
const STORAGE_SUBJECTS_KEY = 'edutest_subjects';
const STORAGE_DELETED_CLASSES_KEY = 'edutest_deleted_class_ids';
const STORAGE_DELETED_SUBJECTS_KEY = 'edutest_deleted_subject_ids';
const STORAGE_DELETED_EXAMS_KEY = 'edutest_deleted_exam_ids';
export const STORAGE_TEACHER_SCOPE_KEY = 'edutest_teacher_scope';

// ==================== HIGH PERFORMANCE CACHING SYSTEM ====================
// In-memory & session storage caches provide sub-15ms data access for students and teachers
let inMemoryExamsCache: { data: Exam[]; expiresAt: number } | null = null;
let inMemoryResultsCache: { data: ExamResult[]; expiresAt: number } | null = null;
const inMemoryQuestionsCache = new Map<string, { data: Question[]; expiresAt: number }>();
let inMemoryClassesCache: { data: SchoolClass[]; expiresAt: number } | null = null;
let inMemorySubjectsCache: { data: Subject[]; expiresAt: number } | null = null;

const CACHE_TTL_MS = 45 * 1000; // 45 seconds TTL for background freshness

export function invalidateExamsCache() {
  inMemoryExamsCache = null;
}

export function invalidateResultsCache() {
  inMemoryResultsCache = null;
}

export function invalidateQuestionsCache(examId?: string) {
  if (examId) {
    inMemoryQuestionsCache.delete(examId);
    try {
      sessionStorage.removeItem(`edutest_q_${examId}`);
    } catch (e) {
      console.warn('SessionStorage remove error:', e);
    }
  } else {
    inMemoryQuestionsCache.clear();
  }
}

export function invalidateMetadataCache() {
  inMemoryClassesCache = null;
  inMemorySubjectsCache = null;
}

export interface TeacherScopeConfig {
  enabled: boolean;
  rules: Array<{
    subjectKeyword: string;
    grades: string[];
  }>;
}

export const DEFAULT_TEACHER_SCOPE: TeacherScopeConfig = {
  enabled: true, // Default to true as teacher specifically requested
  rules: [
    { subjectKeyword: 'Toán', grades: ['6'] },
    { subjectKeyword: 'Tin', grades: ['6', '7', '8', '9'] }
  ]
};

export function getTeacherScope(): TeacherScopeConfig {
  try {
    const raw = localStorage.getItem(STORAGE_TEACHER_SCOPE_KEY);
    if (!raw) return DEFAULT_TEACHER_SCOPE;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_TEACHER_SCOPE;
  }
}

export function saveTeacherScope(scope: TeacherScopeConfig): void {
  try {
    localStorage.setItem(STORAGE_TEACHER_SCOPE_KEY, JSON.stringify(scope));
  } catch (e) {
    console.warn('saveTeacherScope note:', e);
  }
}

export function isExamInTeacherScope(exam: Exam, scope: TeacherScopeConfig): boolean {
  if (!scope.enabled) return true;
  const sName = (exam.subjectName || '').toLowerCase();
  const sCode = (exam.subjectId || '').toLowerCase();
  const grade = String(exam.grade || '');

  for (const rule of scope.rules) {
    const kw = rule.subjectKeyword.toLowerCase();
    const matchSubject = sName.includes(kw) || sCode.includes(kw);
    if (matchSubject && rule.grades.includes(grade)) {
      return true;
    }
  }
  return false;
}

export function isClassInTeacherScope(cls: SchoolClass, scope: TeacherScopeConfig): boolean {
  if (!scope.enabled) return true;
  const relevantGrades = Array.from(new Set(scope.rules.flatMap(r => r.grades)));
  return relevantGrades.includes(String(cls.grade));
}

function getDeletedClassIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_DELETED_CLASSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addDeletedClassId(id: string) {
  try {
    const list = getDeletedClassIds();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(STORAGE_DELETED_CLASSES_KEY, JSON.stringify(list));
    }
  } catch (e) {
    console.warn(e);
  }
}

function getDeletedSubjectIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_DELETED_SUBJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addDeletedSubjectId(id: string) {
  try {
    const list = getDeletedSubjectIds();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(STORAGE_DELETED_SUBJECTS_KEY, JSON.stringify(list));
    }
  } catch (e) {
    console.warn(e);
  }
}

function getDeletedExamIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_DELETED_EXAMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addDeletedExamId(id: string) {
  try {
    const list = getDeletedExamIds();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(STORAGE_DELETED_EXAMS_KEY, JSON.stringify(list));
    }
  } catch (e) {
    console.warn(e);
  }
}

function getLocalClasses(): SchoolClass[] {
  try {
    const raw = localStorage.getItem(STORAGE_CLASSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalClasses(classes: SchoolClass[]) {
  try {
    localStorage.setItem(STORAGE_CLASSES_KEY, JSON.stringify(classes));
  } catch (e) {
    console.warn(e);
  }
}

function getLocalSubjects(): Subject[] {
  try {
    const raw = localStorage.getItem(STORAGE_SUBJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalSubjects(subjects: Subject[]) {
  try {
    localStorage.setItem(STORAGE_SUBJECTS_KEY, JSON.stringify(subjects));
  } catch (e) {
    console.warn(e);
  }
}

function getLocalUsers(): UserProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalUsers(users: UserProfile[]) {
  try {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.warn('Could not save users to localStorage', e);
  }
}

function getLocalExams(): Exam[] {
  try {
    const raw = localStorage.getItem(STORAGE_EXAMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalExams(exams: Exam[]) {
  try {
    localStorage.setItem(STORAGE_EXAMS_KEY, JSON.stringify(exams));
  } catch (e) {
    console.warn('Could not save exams to localStorage', e);
  }
}

function getLocalQuestionsMap(): Record<string, Question[]> {
  try {
    const raw = localStorage.getItem(STORAGE_QUESTIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalQuestions(examId: string, questions: Question[]) {
  try {
    const current = getLocalQuestionsMap();
    current[examId] = questions;
    localStorage.setItem(STORAGE_QUESTIONS_KEY, JSON.stringify(current));
  } catch (e) {
    console.warn('Could not save questions to localStorage', e);
  }
}

function getLocalResults(): ExamResult[] {
  try {
    const raw = localStorage.getItem(STORAGE_RESULTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalResult(result: ExamResult) {
  try {
    const current = getLocalResults();
    const updated = [
      result, 
      ...current.filter(r => r.id !== result.id && r.attemptId !== result.attemptId && r.id !== result.attemptId)
    ];
    localStorage.setItem(STORAGE_RESULTS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Could not save result to localStorage', e);
  }
}

// ==================== USERS ====================

export function getDefaultUsers(): UserProfile[] {
  return [
    {
      id: 'u_admin',
      username: 'admin',
      email: 'admin@edutest.edu.vn',
      password: '123456',
      displayName: 'Quản trị viên Hệ thống',
      role: 'admin',
      status: 'active',
      createdAt: '2024-09-01T08:00:00.000Z'
    },
    {
      id: 'u_daiso2014',
      username: 'daiso2014',
      email: 'daiso2014@gmail.com',
      password: '123456',
      displayName: 'Admin daiso2014',
      role: 'admin',
      status: 'active',
      createdAt: '2024-09-01T08:00:00.000Z'
    },
    {
      id: 'u_giaovien',
      username: 'giaovien',
      email: 'giaovien@edutest.edu.vn',
      password: '123456',
      displayName: 'Thầy Trương - GV Toán',
      role: 'teacher',
      status: 'active',
      createdAt: '2024-09-01T08:00:00.000Z'
    },
    {
      id: 'u_hocsinh',
      username: 'hocsinh',
      email: 'hocsinh@edutest.edu.vn',
      password: '123456',
      displayName: 'Nguyễn Văn An',
      role: 'student',
      status: 'active',
      className: '10A1',
      classIds: ['10A1'],
      createdAt: '2024-09-01T08:00:00.000Z'
    }
  ];
}

const STORAGE_DELETED_USERS_KEY = 'edutest_deleted_user_ids';

export function getDeletedUserIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_DELETED_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addDeletedUserId(id: string) {
  try {
    const list = getDeletedUserIds();
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(STORAGE_DELETED_USERS_KEY, JSON.stringify(list));
    }
  } catch (e) {
    console.warn(e);
  }
}

export function removeDeletedUserId(id: string) {
  try {
    const list = getDeletedUserIds().filter(x => x !== id);
    localStorage.setItem(STORAGE_DELETED_USERS_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn(e);
  }
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const collectionPath = 'users';
  const deletedIds = getDeletedUserIds();
  let localList = getLocalUsers().filter(u => !deletedIds.includes(u.id));
  
  // Seed default users ONLY once if local list is genuinely empty
  if (localList.length === 0 && !localStorage.getItem('edutest_users_initialized')) {
    localList = getDefaultUsers().filter(u => !deletedIds.includes(u.id));
    saveLocalUsers(localList);
    localStorage.setItem('edutest_users_initialized', 'true');
  }

  try {
    const q = query(collection(db, collectionPath));
    const snap = await getDocs(q);
    const firestoreUsers = snap.docs
      .map(d => ({ ...d.data(), id: d.id } as UserProfile))
      .filter(u => !deletedIds.includes(u.id));
    
    // Merge firestore and local users by ID without resurrecting deleted users
    const mergedMap = new Map<string, UserProfile>();
    localList.forEach(u => {
      if (!deletedIds.includes(u.id)) mergedMap.set(u.id, u);
    });
    firestoreUsers.forEach(u => {
      if (!deletedIds.includes(u.id)) mergedMap.set(u.id, u);
    });

    const combined = Array.from(mergedMap.values());
    saveLocalUsers(combined);
    return combined;
  } catch (err) {
    console.warn('Firestore fetch users note, returning local cache:', err);
    return localList;
  }
}



export async function createUserProfile(userData: Partial<UserProfile> & { username: string; displayName: string; role: UserRole }): Promise<UserProfile> {
  const safeId = userData.id || ('u_' + userData.username.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() + '_' + Date.now().toString(36));
  removeDeletedUserId(safeId);

  const newProfile: UserProfile = {
    id: safeId,
    username: userData.username.trim(),
    displayName: userData.displayName.trim(),
    email: userData.email?.trim() || `${userData.username.trim().toLowerCase()}@edutest.edu.vn`,
    password: userData.password || '123456',
    role: userData.role || 'student',
    status: userData.status || 'active',
    className: userData.className || '10A1',
    classIds: userData.classIds || (userData.className ? [userData.className] : ['10A1']),
    photoURL: userData.photoURL,
    createdAt: new Date().toISOString()
  };

  const newUsernameLower = (newProfile.username || '').toLowerCase();
  const currentLocal = getLocalUsers().filter(u => u.id !== safeId && (!u.username || !newUsernameLower || u.username.toLowerCase() !== newUsernameLower));
  const updatedLocal = [newProfile, ...currentLocal];
  saveLocalUsers(updatedLocal);

  try {
    await setDoc(doc(db, 'users', safeId), sanitizeForFirestore(newProfile), { merge: true });
  } catch (err) {
    console.warn('createUserProfile Firestore note:', err);
  }

  return newProfile;
}

export async function updateUserProfile(userId: string, data: Partial<UserProfile>): Promise<void> {
  const currentLocal = getLocalUsers();
  const idx = currentLocal.findIndex(u => u.id === userId);
  if (idx !== -1) {
    currentLocal[idx] = { ...currentLocal[idx], ...data, updatedAt: new Date().toISOString() };
    saveLocalUsers(currentLocal);
  }

  try {
    await setDoc(doc(db, 'users', userId), sanitizeForFirestore({
      ...data,
      updatedAt: new Date().toISOString()
    }), { merge: true });
  } catch (err) {
    console.warn('updateUserProfile Firestore note:', err);
  }
}

export async function deleteUserProfile(userId: string): Promise<void> {
  addDeletedUserId(userId);
  const currentLocal = getLocalUsers().filter(u => u.id !== userId);
  saveLocalUsers(currentLocal);

  try {
    await deleteDoc(doc(db, 'users', userId));
  } catch (err) {
    console.warn('deleteUserProfile Firestore note:', err);
  }
}

export async function resetUserPassword(userId: string, newPassword?: string): Promise<string> {
  const targetPassword = newPassword && newPassword.trim() ? newPassword.trim() : '123456';
  await updateUserProfile(userId, { password: targetPassword });
  return targetPassword;
}

export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
  await updateUserProfile(userId, { role });
}

export async function toggleUserStatus(userId: string, status: 'active' | 'disabled'): Promise<void> {
  await updateUserProfile(userId, { status });
}

export async function batchCreateUsers(importedRecords: import('../types').ImportedUserRecord[]): Promise<number> {
  const validRecords = importedRecords.filter(r => r.isValid);
  if (validRecords.length === 0) return 0;

  const newProfiles: UserProfile[] = [];
  const currentLocal = getLocalUsers();

  for (const record of validRecords) {
    const safeId = 'u_' + record.username.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const userProfile: UserProfile = {
      id: safeId,
      username: record.username,
      email: record.email,
      password: record.password || '123456',
      displayName: record.displayName || record.username,
      role: record.role,
      status: 'active',
      className: record.classId || '10A1',
      classIds: record.classId ? [record.classId] : ['10A1'],
      createdAt: new Date().toISOString()
    };
    newProfiles.push(userProfile);
  }

  // Update local cache immediately so users appear instantly in UI
  const mergedMap = new Map<string, UserProfile>();
  currentLocal.forEach(u => mergedMap.set(u.id, u));
  newProfiles.forEach(u => mergedMap.set(u.id, u));
  saveLocalUsers(Array.from(mergedMap.values()));

  // Commit batch to Firestore with sanitized data
  try {
    const batch = writeBatch(db);
    for (const profile of newProfiles) {
      const userRef = doc(db, 'users', profile.id);
      batch.set(userRef, sanitizeForFirestore(profile), { merge: true });
    }
    await batch.commit();
  } catch (err) {
    console.warn('Batch create users Firestore warning (data preserved in local cache):', err);
  }

  return newProfiles.length;
}

export async function bulkDeleteUsers(userIds: string[]): Promise<void> {
  for (const id of userIds) {
    addDeletedUserId(id);
  }
  const currentLocal = getLocalUsers().filter(u => !userIds.includes(u.id));
  saveLocalUsers(currentLocal);

  try {
    const batch = writeBatch(db);
    for (const id of userIds) {
      batch.delete(doc(db, 'users', id));
    }
    await batch.commit();
  } catch (err) {
    console.warn('bulkDeleteUsers Firestore note:', err);
  }
}

export async function bulkUpdateUserClass(userIds: string[], className: string): Promise<void> {
  const currentLocal = getLocalUsers();
  const updatedLocal = currentLocal.map(u => {
    if (userIds.includes(u.id)) {
      return {
        ...u,
        className,
        classIds: [className],
        updatedAt: new Date().toISOString()
      };
    }
    return u;
  });
  saveLocalUsers(updatedLocal);

  try {
    const batch = writeBatch(db);
    for (const id of userIds) {
      batch.set(doc(db, 'users', id), {
        className,
        classIds: [className],
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
    await batch.commit();
  } catch (err) {
    console.warn('bulkUpdateUserClass Firestore note:', err);
  }
}

export async function bulkToggleUserStatus(userIds: string[], status: 'active' | 'disabled'): Promise<void> {
  const currentLocal = getLocalUsers();
  const updatedLocal = currentLocal.map(u => {
    if (userIds.includes(u.id)) {
      return {
        ...u,
        status,
        updatedAt: new Date().toISOString()
      };
    }
    return u;
  });
  saveLocalUsers(updatedLocal);

  try {
    const batch = writeBatch(db);
    for (const id of userIds) {
      batch.set(doc(db, 'users', id), {
        status,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
    await batch.commit();
  } catch (err) {
    console.warn('bulkToggleUserStatus Firestore note:', err);
  }
}

export async function loginWithUsernamePassword(identifier: string, password: string): Promise<UserProfile | null> {
  const clean = identifier.trim().toLowerCase();
  const inputPass = password.trim();

  // 1. Query Firestore first for real-time cross-device sync (machine A to machine B)
  try {
    const snap = await getDocs(collection(db, 'users'));
    for (const d of snap.docs) {
      const data = d.data() as UserProfile;
      const matchIdentifier = (data.username && data.username.trim().toLowerCase() === clean) ||
                              (data.email && data.email.trim().toLowerCase() === clean) ||
                              (d.id.toLowerCase() === clean);
      if (matchIdentifier) {
        const uPass = data.password ? data.password.trim() : '123456';
        if (uPass === inputPass || (!data.password && inputPass === '123456')) {
          const matchedUser = { ...data, id: d.id, password: uPass };
          // Cache to local list so future lookups are instantaneous
          const currentLocal = getLocalUsers();
          saveLocalUsers([...currentLocal.filter(x => x.id !== d.id), matchedUser]);
          return matchedUser;
        }
      }
    }
  } catch (err) {
    console.warn('Firestore live user check note, checking local cache:', err);
  }
  
  // 2. Check local users fallback (in case offline or local cache)
  let localList = getLocalUsers();
  if (localList.length === 0) {
    localList = getDefaultUsers();
    saveLocalUsers(localList);
  }

  for (const u of localList) {
    const matchId = (u.username && u.username.trim().toLowerCase() === clean) ||
                    (u.email && u.email.trim().toLowerCase() === clean) ||
                    (u.id.toLowerCase() === clean);
    if (matchId) {
      const uPass = (u.password ? u.password.trim() : '123456');
      if (uPass === inputPass || (!u.password && inputPass === '123456')) {
        return u;
      }
    }
  }

  // 3. Check default hardcoded accounts as safe fallback
  for (const def of getDefaultUsers()) {
    const matchDef = (def.username && def.username.trim().toLowerCase() === clean) || 
                     (def.email && def.email.trim().toLowerCase() === clean) ||
                     (def.id.toLowerCase() === clean);
    if (matchDef && (def.password === inputPass || (!def.password && inputPass === '123456'))) {
      return def;
    }
  }

  return null;
}


// ==================== CLASSES ====================

export async function getClasses(forceRefresh: boolean = false): Promise<SchoolClass[]> {
  const startTime = performance.now();
  const now = Date.now();
  if (!forceRefresh && inMemoryClassesCache && inMemoryClassesCache.expiresAt > now) {
    performanceTracker.recordSample('api', 'getClasses (cached)', performance.now() - startTime, true);
    return inMemoryClassesCache.data;
  }

  const collectionPath = 'classes';
  const deletedIds = getDeletedClassIds();
  const localList = getLocalClasses();

  try {
    const snap = await getDocs(collection(db, collectionPath));
    let classes: SchoolClass[] = [];
    if (!snap.empty) {
      classes = snap.docs.map(d => ({ ...d.data(), id: d.id } as SchoolClass));
    }

    // Merge with local list
    const map = new Map<string, SchoolClass>();
    if (classes.length === 0 && localList.length === 0) {
      getDefaultClasses().forEach(c => map.set(c.id, c));
    } else {
      localList.forEach(c => map.set(c.id, c));
      classes.forEach(c => map.set(c.id, c));
    }

    let result = Array.from(map.values()).filter(c => !deletedIds.includes(c.id));
    if (result.length === 0) {
      result = getDefaultClasses().filter(c => !deletedIds.includes(c.id));
    }
    saveLocalClasses(result);
    inMemoryClassesCache = { data: result, expiresAt: now + CACHE_TTL_MS };
    performanceTracker.recordSample('api', 'getClasses (network)', performance.now() - startTime, false);
    return result;
  } catch (err) {
    console.warn('Lấy danh sách lớp note:', err);
    const fallback = (localList.length > 0 ? localList : getDefaultClasses()).filter(c => !deletedIds.includes(c.id));
    const finalRes = fallback.length > 0 ? fallback : getDefaultClasses().filter(c => !deletedIds.includes(c.id));
    inMemoryClassesCache = { data: finalRes, expiresAt: now + 15000 };
    return finalRes;
  }
}

export async function addClass(classData: Omit<SchoolClass, 'id'>): Promise<string> {
  invalidateMetadataCache();
  const collectionPath = 'classes';
  const newId = 'cls_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const newClass: SchoolClass = {
    ...classData,
    id: newId,
    createdAt: new Date().toISOString()
  };

  const current = getLocalClasses();
  saveLocalClasses([...current.filter(c => c.id !== newId), newClass]);

  try {
    await setDoc(doc(db, collectionPath, newId), sanitizeForFirestore(newClass));
  } catch (err) {
    console.warn('Lưu lớp Firestore note:', err);
  }
  return newId;
}

export async function deleteClass(classId: string): Promise<void> {
  invalidateMetadataCache();
  addDeletedClassId(classId);
  const current = getLocalClasses();
  saveLocalClasses(current.filter(c => c.id !== classId));

  try {
    await deleteDoc(doc(db, 'classes', classId));
  } catch (err) {
    console.warn('Delete class Firestore note:', err);
  }
}

export async function toggleHideClass(classId: string, isHidden: boolean): Promise<void> {
  invalidateMetadataCache();
  const current = getLocalClasses();
  const found = current.find(c => c.id === classId);
  if (found) {
    found.isHidden = isHidden;
    saveLocalClasses(current);
  }

  try {
    await updateDoc(doc(db, 'classes', classId), { isHidden });
  } catch (err) {
    console.warn('Toggle hide class note:', err);
  }
}

// ==================== SUBJECTS ====================

export async function getSubjects(forceRefresh: boolean = false): Promise<Subject[]> {
  const startTime = performance.now();
  const now = Date.now();
  if (!forceRefresh && inMemorySubjectsCache && inMemorySubjectsCache.expiresAt > now) {
    performanceTracker.recordSample('api', 'getSubjects (cached)', performance.now() - startTime, true);
    return inMemorySubjectsCache.data;
  }

  const collectionPath = 'subjects';
  const deletedIds = getDeletedSubjectIds();
  const localList = getLocalSubjects();

  try {
    const snap = await getDocs(collection(db, collectionPath));
    let subjects: Subject[] = [];
    if (!snap.empty) {
      subjects = snap.docs.map(d => ({ ...d.data(), id: d.id } as Subject));
    }

    const map = new Map<string, Subject>();
    if (subjects.length === 0 && localList.length === 0) {
      getDefaultSubjects().forEach(s => map.set(s.id, s));
    } else {
      localList.forEach(s => map.set(s.id, s));
      subjects.forEach(s => map.set(s.id, s));
    }

    let result = Array.from(map.values()).filter(s => !deletedIds.includes(s.id) && !deletedIds.includes(s.code));
    if (result.length === 0) {
      result = getDefaultSubjects();
    }
    saveLocalSubjects(result);
    inMemorySubjectsCache = { data: result, expiresAt: now + CACHE_TTL_MS };
    performanceTracker.recordSample('api', 'getSubjects (network)', performance.now() - startTime, false);
    return result;
  } catch (err) {
    console.warn('Lấy môn học note:', err);
    const fallback = (localList.length > 0 ? localList : getDefaultSubjects()).filter(s => !deletedIds.includes(s.id) && !deletedIds.includes(s.code));
    const finalRes = fallback.length > 0 ? fallback : getDefaultSubjects();
    inMemorySubjectsCache = { data: finalRes, expiresAt: now + 15000 };
    return finalRes;
  }
}

export async function addSubject(subjectData: Omit<Subject, 'id'>): Promise<string> {
  const collectionPath = 'subjects';
  const newId = 'sub_' + (subjectData.code ? subjectData.code.toLowerCase() : Date.now());
  const newSubject: Subject = {
    ...subjectData,
    id: newId
  };

  const current = getLocalSubjects();
  saveLocalSubjects([...current.filter(s => s.id !== newId), newSubject]);

  try {
    await setDoc(doc(db, collectionPath, newId), sanitizeForFirestore(newSubject));
  } catch (err) {
    console.warn('Lưu môn học Firestore note:', err);
  }
  return newId;
}

export async function deleteSubject(subjectId: string): Promise<void> {
  addDeletedSubjectId(subjectId);
  const current = getLocalSubjects();
  saveLocalSubjects(current.filter(s => s.id !== subjectId && s.code !== subjectId));

  try {
    await deleteDoc(doc(db, 'subjects', subjectId));
  } catch (err) {
    console.warn('Delete subject note:', err);
  }
}

// ==================== EXAMS & QUESTIONS ====================

export async function getExams(forceRefresh: boolean = false): Promise<Exam[]> {
  const startTime = performance.now();
  const now = Date.now();

  // Return in-memory cache immediately if fresh (< 15ms)
  if (!forceRefresh && inMemoryExamsCache && inMemoryExamsCache.expiresAt > now) {
    performanceTracker.recordSample('exam_load', 'getExams (cached)', performance.now() - startTime, true);
    return inMemoryExamsCache.data;
  }

  const collectionPath = 'exams';
  const localExams = getLocalExams();
  const deletedIds = getDeletedExamIds();
  const excludedClasses = ['6A1', 'c_6a'];

  try {
    const snap = await getDocs(collection(db, collectionPath));
    const firestoreExams = snap.docs.map(d => ({ ...d.data(), id: d.id } as Exam));
    
    // Server authoritative map
    const mergedMap = new Map<string, Exam>();
    
    // 1. Put Firestore exams into map (Server Authority)
    firestoreExams.forEach(e => {
      if (!deletedIds.includes(e.id)) {
        mergedMap.set(e.id, e);
      }
    });

    // 2. If Firestore is empty (e.g. offline or brand new), fallback to local
    if (firestoreExams.length === 0) {
      localExams.forEach(e => {
        if (!deletedIds.includes(e.id)) {
          mergedMap.set(e.id, e);
        }
      });
    } else {
      // Keep any local exam created very recently (within 15 mins) that is waiting to sync
      const recentThreshold = Date.now() - 15 * 60 * 1000;
      localExams.forEach(e => {
        const createdMs = new Date(e.createdAt || 0).getTime();
        if (!mergedMap.has(e.id) && !deletedIds.includes(e.id) && createdMs > recentThreshold) {
          mergedMap.set(e.id, e);
        }
      });
    }

    const list = Array.from(mergedMap.values())
      .filter(e => !deletedIds.includes(e.id))
      .map(e => {
        if (!e.classIds || e.classIds.length === 0) return { ...e, classIds: [] };
        const filteredClasses = e.classIds.filter(c => !excludedClasses.includes(c));
        return {
          ...e,
          classIds: filteredClasses
        };
      });

    saveLocalExams(list);
    const sorted = list.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Save to high-performance memory cache
    inMemoryExamsCache = {
      data: sorted,
      expiresAt: Date.now() + CACHE_TTL_MS
    };

    performanceTracker.recordSample('exam_load', 'getExams (network)', performance.now() - startTime, false);
    return sorted;
  } catch (err) {
    console.warn('Lấy danh sách đề thi từ Firestore thất bại, dùng bộ nhớ cục bộ:', err);
    const fallback = localExams
      .filter(e => !deletedIds.includes(e.id))
      .map(e => ({
        ...e,
        classIds: (e.classIds || []).filter(c => !excludedClasses.includes(c))
      }))
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    inMemoryExamsCache = {
      data: fallback,
      expiresAt: Date.now() + 15000
    };

    performanceTracker.recordSample('exam_load', 'getExams (fallback)', performance.now() - startTime, false);
    return fallback;
  }
}

export async function togglePinExam(examId: string, isPinned: boolean): Promise<void> {
  const localExams = getLocalExams();
  const idx = localExams.findIndex(e => e.id === examId);
  if (idx !== -1) {
    localExams[idx] = { ...localExams[idx], isPinned };
    saveLocalExams(localExams);
  }

  try {
    await updateDoc(doc(db, 'exams', examId), { isPinned });
  } catch (err) {
    console.warn('togglePinExam Firestore note:', err);
  }
}


export async function getExamById(examId: string): Promise<Exam | null> {
  const local = getLocalExams().find(e => e.id === examId);
  if (local) return local;

  const path = `exams/${examId}`;
  try {
    const snap = await getDoc(doc(db, 'exams', examId));
    if (!snap.exists()) return null;
    return { ...snap.data(), id: snap.id } as Exam;
  } catch (err) {
    console.warn('getExamById note:', err);
    return null;
  }
}

export async function createExamWithQuestions(
  examData: Omit<Exam, 'id' | 'createdAt' | 'updatedAt' | 'questionCount'> & { questionCount?: number },
  questions: Array<Omit<Question, 'id' | 'examId'>>
): Promise<string> {
  const examId = 'exam_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

  const fullExam: Exam = {
    ...examData,
    id: examId,
    questionCount: questions.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const fullQuestions: Question[] = questions.map((q, idx) => ({
    ...q,
    id: `q_${examId}_${idx + 1}`,
    examId,
    questionNumber: idx + 1,
    points: q.points || 1
  }));

  // 1. Immediately store in local cache so it appears without delay
  const currentExams = getLocalExams();
  saveLocalExams([fullExam, ...currentExams.filter(e => e.id !== examId)]);
  saveLocalQuestions(examId, fullQuestions);

  // 2. Commit to Firestore
  try {
    const examRef = doc(db, 'exams', examId);
    const batch = writeBatch(db);
    batch.set(examRef, sanitizeForFirestore(fullExam));

    fullQuestions.forEach(fq => {
      const qRef = doc(db, `exams/${examId}/questions`, fq.id);
      batch.set(qRef, sanitizeForFirestore(fq));
    });

    await batch.commit();
  } catch (err) {
    console.warn('createExamWithQuestions Firestore warning (preserved in local storage):', err);
  }

  invalidateExamsCache();
  invalidateQuestionsCache(examId);

  return examId;
}

export async function updateExamWithQuestions(
  examId: string,
  examData: Partial<Exam>,
  questions?: Array<Omit<Question, 'id' | 'examId'> | Question>
): Promise<void> {
  const currentExams = getLocalExams();
  const existingExam = currentExams.find(e => e.id === examId);

  const updatedExam: Exam = {
    ...(existingExam || ({} as Exam)),
    ...examData,
    id: examId,
    questionCount: questions ? questions.length : (existingExam?.questionCount || 0),
    updatedAt: new Date().toISOString()
  };

  saveLocalExams([updatedExam, ...currentExams.filter(e => e.id !== examId)]);

  let fullQuestions: Question[] = [];
  if (questions) {
    fullQuestions = questions.map((q, idx) => ({
      ...q,
      id: (q as Question).id || `q_${examId}_${idx + 1}`,
      examId,
      questionNumber: idx + 1,
      points: q.points || 1
    }));
    saveLocalQuestions(examId, fullQuestions);
  }

  try {
    const examRef = doc(db, 'exams', examId);
    await updateDoc(examRef, sanitizeForFirestore(updatedExam));

    if (questions) {
      const batch = writeBatch(db);
      fullQuestions.forEach(fq => {
        const qRef = doc(db, `exams/${examId}/questions`, fq.id);
        batch.set(qRef, sanitizeForFirestore(fq));
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn('updateExamWithQuestions Firestore warning (preserved in local storage):', err);
  }

  invalidateExamsCache();
  invalidateQuestionsCache(examId);
}

export async function getExamQuestions(examId: string, forceRefresh: boolean = false): Promise<Question[]> {
  const startTime = performance.now();
  const now = Date.now();

  // 1. In-memory cache check (<5ms)
  if (!forceRefresh) {
    const memoryHit = inMemoryQuestionsCache.get(examId);
    if (memoryHit && memoryHit.expiresAt > now && memoryHit.data.length > 0) {
      performanceTracker.recordSample('exam_load', `getExamQuestions:${examId} (mem-cached)`, performance.now() - startTime, true);
      return memoryHit.data;
    }

    // 2. SessionStorage cache check (<10ms)
    try {
      const sessionRaw = sessionStorage.getItem(`edutest_q_${examId}`);
      if (sessionRaw) {
        const parsed = JSON.parse(sessionRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          inMemoryQuestionsCache.set(examId, { data: parsed, expiresAt: now + CACHE_TTL_MS });
          performanceTracker.recordSample('exam_load', `getExamQuestions:${examId} (session-cached)`, performance.now() - startTime, true);
          return parsed;
        }
      }
    } catch (e) {
      console.warn('SessionStorage read note:', e);
    }
  }

  const localMap = getLocalQuestionsMap();
  const path = `exams/${examId}/questions`;
  try {
    const snap = await getDocs(collection(db, path));
    const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Question));
    const sorted = list.sort((a, b) => a.questionNumber - b.questionNumber);
    if (sorted.length > 0) {
      saveLocalQuestions(examId, sorted);
      inMemoryQuestionsCache.set(examId, { data: sorted, expiresAt: now + CACHE_TTL_MS });
      try {
        sessionStorage.setItem(`edutest_q_${examId}`, JSON.stringify(sorted));
      } catch (e) {
        console.warn('SessionStorage write note:', e);
      }
      performanceTracker.recordSample('exam_load', `getExamQuestions:${examId} (network)`, performance.now() - startTime, false);
      return sorted;
    }
  } catch (err) {
    console.warn('Lấy câu hỏi từ Firestore thất bại, dùng bộ nhớ cục bộ:', err);
  }

  const fallback = localMap[examId] || [];
  if (fallback.length > 0) {
    inMemoryQuestionsCache.set(examId, { data: fallback, expiresAt: now + 30000 });
  }
  performanceTracker.recordSample('exam_load', `getExamQuestions:${examId} (fallback)`, performance.now() - startTime, false);
  return fallback;
}

export async function toggleExamPublish(examId: string, isPublished: boolean): Promise<void> {
  // Update local
  const current = getLocalExams();
  const found = current.find(e => e.id === examId);
  if (found) {
    found.isPublished = isPublished;
    saveLocalExams(current);
  }

  try {
    await updateDoc(doc(db, 'exams', examId), {
      isPublished,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Toggle exam publish note:', err);
  }
}

export async function deleteExam(examId: string): Promise<void> {
  addDeletedExamId(examId);

  // Update local exams
  const current = getLocalExams();
  saveLocalExams(current.filter(e => e.id !== examId));

  // Remove local questions map
  try {
    const qMap = getLocalQuestionsMap();
    delete qMap[examId];
    localStorage.setItem(STORAGE_QUESTIONS_KEY, JSON.stringify(qMap));
  } catch (e) {
    console.warn('Clear local questions note:', e);
  }

  // Delete from Firestore
  try {
    await deleteDoc(doc(db, 'exams', examId));
  } catch (err) {
    console.warn('Delete exam note:', err);
  }

  invalidateExamsCache();
  invalidateQuestionsCache(examId);
}

export async function toggleExamHide(examId: string, isHidden: boolean): Promise<void> {
  const current = getLocalExams();
  const found = current.find(e => e.id === examId);
  if (found) {
    found.isHidden = isHidden;
    saveLocalExams(current);
  }

  try {
    await updateDoc(doc(db, 'exams', examId), {
      isHidden,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Toggle exam hide note:', err);
  }
}

export async function toggleExamShuffle(
  examId: string,
  shuffleQuestions?: boolean,
  shuffleOptions?: boolean
): Promise<void> {
  const current = getLocalExams();
  const found = current.find(e => e.id === examId);
  if (found) {
    if (shuffleQuestions !== undefined) found.shuffleQuestions = shuffleQuestions;
    if (shuffleOptions !== undefined) found.shuffleOptions = shuffleOptions;
    saveLocalExams(current);
  }

  try {
    const updateData: any = { updatedAt: new Date().toISOString() };
    if (shuffleQuestions !== undefined) updateData.shuffleQuestions = shuffleQuestions;
    if (shuffleOptions !== undefined) updateData.shuffleOptions = shuffleOptions;
    await updateDoc(doc(db, 'exams', examId), updateData);
  } catch (err) {
    console.warn('Toggle exam shuffle note:', err);
  }
}

export async function toggleExamTrial(
  examId: string,
  isTrial: boolean,
  trialCode?: string
): Promise<void> {
  const current = getLocalExams();
  const found = current.find(e => e.id === examId);
  if (found) {
    found.isTrial = isTrial;
    if (trialCode) found.trialCode = trialCode;
    saveLocalExams(current);
  }

  try {
    const updateData: any = {
      isTrial,
      updatedAt: new Date().toISOString()
    };
    if (trialCode) updateData.trialCode = trialCode;
    await updateDoc(doc(db, 'exams', examId), updateData);
  } catch (err) {
    console.warn('Toggle exam trial note:', err);
  }
}

export async function toggleExamTabWarning(
  examId: string,
  enableTabWarning: boolean
): Promise<void> {
  const current = getLocalExams();
  const found = current.find(e => e.id === examId);
  if (found) {
    found.enableTabWarning = enableTabWarning;
    found.warnOnTabSwitch = enableTabWarning;
    saveLocalExams(current);
  }

  try {
    await updateDoc(doc(db, 'exams', examId), {
      enableTabWarning,
      warnOnTabSwitch: enableTabWarning,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Toggle exam tab warning note:', err);
  }
}

// ==================== ATTEMPTS & RESULTS ====================

export async function startExamAttempt(
  exam: Exam,
  student: UserProfile,
  questionsCount: number
): Promise<ExamAttempt> {
  const startedAt = new Date().toISOString();
  const deadlineMs = Date.now() + (exam.durationMinutes || 45) * 60 * 1000;
  const deadline = new Date(deadlineMs).toISOString();

  const attemptId = `att_${Date.now()}_${student.id}`;
  const attempt: ExamAttempt = {
    id: attemptId,
    examId: exam.id,
    examTitle: exam.title,
    subjectName: exam.subjectName,
    studentId: student.id,
    studentEmail: student.email,
    studentName: student.displayName,
    classId: student.classIds?.[0] || student.className || '10A1',
    startedAt,
    deadline,
    durationMinutes: exam.durationMinutes,
    status: 'in_progress',
    totalQuestions: questionsCount,
    answeredCount: 0,
    answers: {},
    flaggedQuestions: {},
    lastSavedAt: startedAt,
    tabViolations: 0,
    tabViolationLogs: []
  };

  try {
    const localSaved = localStorage.getItem('edutest_custom_attempts');
    const list: ExamAttempt[] = localSaved ? JSON.parse(localSaved) : [];
    localStorage.setItem('edutest_custom_attempts', JSON.stringify([attempt, ...list.filter(x => x.id !== attemptId)]));
  } catch (e) {
    // ignore
  }

  try {
    await setDoc(doc(db, 'attempts', attemptId), sanitizeForFirestore(attempt), { merge: true });
  } catch (err) {
    console.warn('Save attempt start note:', err);
  }

  return attempt;
}

export async function startOrCreateAttempt(
  exam: Exam,
  student: UserProfile,
  questionsCount?: number
): Promise<ExamAttempt> {
  try {
    const q = query(
      collection(db, 'attempts'),
      where('examId', '==', exam.id),
      where('studentId', '==', student.id),
      where('status', '==', 'in_progress'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docData = snap.docs[0];
      const attemptData = { ...docData.data(), id: docData.id } as ExamAttempt;
      if (!attemptData.deadline || new Date(attemptData.deadline).getTime() > Date.now()) {
        return attemptData;
      }
    }
  } catch (err) {
    console.warn('Check active attempt note:', err);
  }

  return startExamAttempt(exam, student, questionsCount || exam.questionCount || 20);
}

export async function saveAttemptProgress(
  attemptId: string,
  answers: Record<string, any>,
  flaggedQuestions: Record<string, boolean>,
  tabViolations?: number,
  tabViolationLogs?: string[]
): Promise<void> {
  const answeredCount = Object.keys(answers).filter(k => {
    const val = answers[k];
    if (val === undefined || val === null || val === '') return false;
    if (typeof val === 'object') return Object.values(val).some(v => v !== undefined);
    return true;
  }).length;

  const updateData: any = {
    answers,
    flaggedQuestions,
    answeredCount,
    lastSavedAt: new Date().toISOString()
  };

  if (tabViolations !== undefined) updateData.tabViolations = tabViolations;
  if (tabViolationLogs !== undefined) updateData.tabViolationLogs = tabViolationLogs;

  try {
    const localSaved = localStorage.getItem('edutest_custom_attempts');
    if (localSaved) {
      const list: ExamAttempt[] = JSON.parse(localSaved);
      const idx = list.findIndex(x => x.id === attemptId);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updateData };
        localStorage.setItem('edutest_custom_attempts', JSON.stringify(list));
      }
    }
  } catch (e) {
    // ignore
  }

  try {
    await setDoc(doc(db, 'attempts', attemptId), sanitizeForFirestore(updateData), { merge: true });
  } catch (err) {
    console.warn('Lưu tiến độ làm bài note:', err);
  }
}

export async function submitExamAttempt(
  attemptId: string,
  exam: Exam,
  student: UserProfile,
  answers: Record<string, any>,
  questions: Question[],
  tabViolations: number = 0
): Promise<ExamResult> {
  const breakdown = calculateExamSubmissionBreakdown(exam, questions, answers);
  const nowStr = new Date().toISOString();

  const result: ExamResult = {
    id: attemptId,
    attemptId,
    examId: exam.id,
    studentId: student.id,
    studentName: student.displayName,
    studentEmail: student.email,
    classId: student.classIds?.[0] || '10A1',
    score: breakdown.scaledScore,
    maxScore: exam.maxScore || 10,
    correctCount: breakdown.correctCount,
    wrongCount: breakdown.wrongCount,
    unattemptedCount: breakdown.unattemptedCount,
    percentage: breakdown.percentage,
    submittedAt: nowStr,
    feedback: breakdown.hasEssay && breakdown.hasPendingEssay 
      ? 'Bài thi có câu tự luận, đang chờ giáo viên hoặc AI chấm điểm.'
      : (breakdown.scaledScore >= (exam.passScore || 5) ? 'Đạt yêu cầu' : 'Chưa đạt yêu cầu'),
    tabViolations,
    status: (breakdown.hasEssay && breakdown.hasPendingEssay) ? 'pending_essay_grading' : 'completed',
    hasEssay: breakdown.hasEssay,
    objectiveScore: Number((breakdown.part1.earnedPoints + breakdown.part2.earnedPoints + breakdown.part3.earnedPoints).toFixed(2)),
    essayScore: breakdown.part4.earnedPoints,
    partScores: {
      part1: { earned: breakdown.part1.earnedPoints, max: breakdown.part1.maxPoints, count: breakdown.part1.questionCount, correctCount: breakdown.part1.correctCount },
      part2: { earned: breakdown.part2.earnedPoints, max: breakdown.part2.maxPoints, count: breakdown.part2.questionCount, correctCount: breakdown.part2.correctCount },
      part3: { earned: breakdown.part3.earnedPoints, max: breakdown.part3.maxPoints, count: breakdown.part3.questionCount, correctCount: breakdown.part3.correctCount },
      part4: { earned: breakdown.part4.earnedPoints, max: breakdown.part4.maxPoints, count: breakdown.part4.questionCount, correctCount: breakdown.part4.correctCount },
    },
    answers // Attach answers directly for persistent review
  };

  // Save to local
  saveLocalResult(result);

  // Also update local cached attempt if stored
  try {
    const rawAttempts = localStorage.getItem('edutest_custom_attempts');
    if (rawAttempts) {
      const list = JSON.parse(rawAttempts);
      if (Array.isArray(list)) {
        const idx = list.findIndex(a => a.id === attemptId);
        if (idx !== -1) {
          list[idx] = {
            ...list[idx],
            status: 'submitted',
            submittedAt: nowStr,
            answers,
            score: breakdown.scaledScore,
            answeredCount: Object.keys(answers).length,
            tabViolations
          };
          localStorage.setItem('edutest_custom_attempts', JSON.stringify(list));
        }
      }
    }
  } catch (e) {
    console.warn('Update local custom attempts note:', e);
  }

  // Save to Firestore
  try {
    await updateDoc(doc(db, 'attempts', attemptId), sanitizeForFirestore({
      status: 'submitted',
      submittedAt: nowStr,
      answers,
      score: breakdown.scaledScore,
      answeredCount: Object.keys(answers).length,
      lastSavedAt: nowStr,
      tabViolations
    }));

    await setDoc(doc(db, 'results', attemptId), sanitizeForFirestore(result));
  } catch (err) {
    console.warn('Submit exam attempt Firestore note:', err);
  }

  return result;
}

export async function gradeEssaySubmission(
  attemptId: string,
  essayScore: number,
  essayFeedback: string,
  isAiGraded: boolean = false,
  graderName: string = 'Giáo viên',
  essayGrades?: Record<string, {
    score: number;
    feedback: string;
    questionNumber?: number;
    maxPoints?: number;
    gradedBy?: string;
    gradedAt?: string;
  }>,
  graderId?: string
): Promise<ExamResult | null> {
  const startTime = performance.now();
  const allResults = getLocalResults();
  let targetResult = allResults.find(r => r.attemptId === attemptId || r.id === attemptId);

  // Firestore Fallback: If not found in local cache, pull directly from Firestore
  if (!targetResult) {
    try {
      const snap = await getDoc(doc(db, 'results', attemptId));
      if (snap.exists()) {
        targetResult = { ...snap.data(), id: snap.id } as ExamResult;
      } else {
        const qSnap = await getDocs(query(collection(db, 'results'), where('attemptId', '==', attemptId)));
        if (!qSnap.empty) {
          targetResult = { ...qSnap.docs[0].data(), id: qSnap.docs[0].id } as ExamResult;
        }
      }
    } catch (e) {
      console.warn('Firestore fallback fetch in gradeEssaySubmission note:', e);
    }
  }

  if (!targetResult) return null;

  const exam = await getExamById(targetResult.examId);
  const maxScale = targetResult.maxScore || 10;

  // Base objective score preservation
  const baseObjectiveScore = targetResult.objectiveScore !== undefined 
    ? targetResult.objectiveScore 
    : (targetResult.hasEssayGraded 
        ? Math.max(0, Number(((targetResult.score || 0) - (targetResult.essayScore || 0)).toFixed(2)))
        : (targetResult.score || 0));

  // Cumulative score: objective score + teacher's essay points
  const updatedScore = Math.min(maxScale, Number((baseObjectiveScore + essayScore).toFixed(2)));
  const percentage = Math.min(100, Math.round((updatedScore / maxScale) * 100));

  const now = new Date().toISOString();
  const currentHistory = targetResult.graderHistory || [];
  const newHistoryEntry = {
    graderId: graderId || 'teacher',
    graderName: graderName.trim() || 'Giáo viên phụ trách',
    score: updatedScore,
    timestamp: now,
    action: targetResult.hasEssayGraded ? 'Cập nhật điểm tự luận' : 'Chấm điểm tự luận lần đầu'
  };
  const updatedHistory = [...currentHistory, newHistoryEntry];

  const updated: ExamResult = {
    ...targetResult,
    score: updatedScore,
    objectiveScore: baseObjectiveScore,
    hasEssayGraded: true,
    percentage,
    status: 'completed',
    hasEssay: true,
    essayScore,
    essayFeedback,
    isAiGraded,
    graderId: targetResult.graderId || graderId || 'teacher',
    essayGradedBy: targetResult.essayGradedBy || graderName,
    essayGradedAt: targetResult.essayGradedAt || now,
    lastUpdatedById: graderId || targetResult.lastUpdatedById,
    lastUpdatedBy: graderName,
    lastUpdatedAt: now,
    graderHistory: updatedHistory,
    essayGrades: essayGrades || targetResult.essayGrades,
    feedback: updatedScore >= (exam?.passScore || 5) ? 'Đạt yêu cầu' : 'Chưa đạt yêu cầu'
  };

  saveLocalResult(updated);
  invalidateResultsCache();

  try {
    const cleanUpdated = sanitizeForFirestore(updated);
    await setDoc(doc(db, 'results', targetResult.id), cleanUpdated, { merge: true });
    if (targetResult.attemptId && targetResult.attemptId !== targetResult.id) {
      await setDoc(doc(db, 'results', targetResult.attemptId), cleanUpdated, { merge: true });
    }
    await setDoc(doc(db, 'attempts', attemptId), sanitizeForFirestore({
      score: updatedScore,
      essayScore,
      essayFeedback,
      isAiGraded,
      graderId: updated.graderId,
      essayGradedBy: updated.essayGradedBy,
      essayGradedAt: updated.essayGradedAt,
      lastUpdatedById: updated.lastUpdatedById,
      lastUpdatedBy: updated.lastUpdatedBy,
      lastUpdatedAt: updated.lastUpdatedAt,
      graderHistory: updatedHistory,
      essayGrades: essayGrades || targetResult.essayGrades
    }), { merge: true });
  } catch (err) {
    console.warn('gradeEssaySubmission Firestore warning:', err);
  }

  // Cross-component immediate real-time synchronization
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('edutest:score_updated', {
      detail: { result: updated, examId: updated.examId }
    }));
  }

  performanceTracker.recordSample('grading', `gradeEssaySubmission:${attemptId}`, performance.now() - startTime, false);
  return updated;
}

/**
 * Teacher Score Override & Modification Utility
 * Allows adjusting overall score or manual score corrections with full audit logging
 */
export async function updateExamResultScore(
  attemptId: string,
  newScore: number,
  reason: string,
  graderName: string = 'Giáo viên',
  graderId?: string
): Promise<ExamResult | null> {
  const startTime = performance.now();
  const allResults = getLocalResults();
  let targetResult = allResults.find(r => r.attemptId === attemptId || r.id === attemptId);

  if (!targetResult) {
    try {
      const snap = await getDoc(doc(db, 'results', attemptId));
      if (snap.exists()) {
        targetResult = { ...snap.data(), id: snap.id } as ExamResult;
      }
    } catch (e) {
      console.warn('updateExamResultScore Firestore fallback error:', e);
    }
  }

  if (!targetResult) return null;

  const exam = await getExamById(targetResult.examId);
  const maxScale = targetResult.maxScore || 10;
  const clampedScore = Math.max(0, Math.min(maxScale, Number(newScore.toFixed(2))));
  const percentage = Math.min(100, Math.round((clampedScore / maxScale) * 100));

  const now = new Date().toISOString();
  const currentHistory = targetResult.graderHistory || [];
  const newHistoryEntry = {
    graderId: graderId || 'teacher',
    graderName: graderName.trim() || 'Giáo viên phụ trách',
    score: clampedScore,
    timestamp: now,
    action: `Điều chỉnh điểm thủ công: ${reason || 'Giáo viên điều chỉnh'}`
  };
  const updatedHistory = [...currentHistory, newHistoryEntry];

  const updated: ExamResult = {
    ...targetResult,
    score: clampedScore,
    percentage,
    status: 'completed',
    lastUpdatedById: graderId || targetResult.lastUpdatedById,
    lastUpdatedBy: graderName,
    lastUpdatedAt: now,
    graderHistory: updatedHistory,
    feedback: clampedScore >= (exam?.passScore || 5) ? 'Đạt yêu cầu' : 'Chưa đạt yêu cầu'
  };

  saveLocalResult(updated);
  invalidateResultsCache();

  try {
    const cleanUpdated = sanitizeForFirestore(updated);
    await setDoc(doc(db, 'results', targetResult.id), cleanUpdated, { merge: true });
    if (targetResult.attemptId && targetResult.attemptId !== targetResult.id) {
      await setDoc(doc(db, 'results', targetResult.attemptId), cleanUpdated, { merge: true });
    }
    await setDoc(doc(db, 'attempts', attemptId), sanitizeForFirestore({
      score: clampedScore,
      lastUpdatedById: updated.lastUpdatedById,
      lastUpdatedBy: updated.lastUpdatedBy,
      lastUpdatedAt: updated.lastUpdatedAt,
      graderHistory: updatedHistory
    }), { merge: true });
  } catch (err) {
    console.warn('updateExamResultScore Firestore warning:', err);
  }

  // Cross-component immediate real-time synchronization
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('edutest:score_updated', {
      detail: { result: updated, examId: updated.examId }
    }));
  }

  performanceTracker.recordSample('grading', `updateExamResultScore:${attemptId}`, performance.now() - startTime, false);
  return updated;
}

/**
 * Re-grades / Recalculates all submitted student results for an exam.
 * Crucial when a teacher edits questions, changes correct answer keys, modifies
 * point values per question, or updates answer choices for finished exams.
 */
export async function recalculateExamResults(
  examId: string,
  graderName: string = 'Hệ thống cập nhật đề thi',
  graderId?: string
): Promise<{ count: number; results: ExamResult[] }> {
  const startTime = performance.now();
  const exam = await getExamById(examId);
  if (!exam) return { count: 0, results: [] };

  const [questions, allResults, allAttempts] = await Promise.all([
    getExamQuestions(examId),
    getExamResults(examId),
    getAttemptsForExam(examId)
  ]);

  if (allResults.length === 0) {
    return { count: 0, results: [] };
  }

  const updatedResults: ExamResult[] = [];
  const now = new Date().toISOString();

  for (const res of allResults) {
    const matchedAttempt = allAttempts.find(a => a.id === res.attemptId || a.id === res.id);
    const answers = (res.answers && Object.keys(res.answers).length > 0)
      ? res.answers 
      : (matchedAttempt?.answers || {});

    const breakdown = calculateExamSubmissionBreakdown(
      exam,
      questions,
      answers,
      res.essayGrades,
      res.essayScore
    );

    const historyEntry = {
      graderId: graderId || 'system',
      graderName: graderName || 'Giáo viên phụ trách',
      score: breakdown.scaledScore,
      timestamp: now,
      action: 'Cập nhật lại điểm theo đáp án & thang điểm mới của đề thi'
    };

    const updatedRes: ExamResult = {
      ...res,
      score: breakdown.scaledScore,
      maxScore: exam.maxScore || 10,
      correctCount: breakdown.correctCount,
      wrongCount: breakdown.wrongCount,
      unattemptedCount: breakdown.unattemptedCount,
      percentage: breakdown.percentage,
      objectiveScore: Number((breakdown.part1.earnedPoints + breakdown.part2.earnedPoints + breakdown.part3.earnedPoints).toFixed(2)),
      essayScore: breakdown.part4.earnedPoints,
      hasEssay: breakdown.hasEssay,
      status: breakdown.hasPendingEssay ? 'pending_essay_grading' : 'completed',
      partScores: {
        part1: { earned: breakdown.part1.earnedPoints, max: breakdown.part1.maxPoints, count: breakdown.part1.questionCount, correctCount: breakdown.part1.correctCount },
        part2: { earned: breakdown.part2.earnedPoints, max: breakdown.part2.maxPoints, count: breakdown.part2.questionCount, correctCount: breakdown.part2.correctCount },
        part3: { earned: breakdown.part3.earnedPoints, max: breakdown.part3.maxPoints, count: breakdown.part3.questionCount, correctCount: breakdown.part3.correctCount },
        part4: { earned: breakdown.part4.earnedPoints, max: breakdown.part4.maxPoints, count: breakdown.part4.questionCount, correctCount: breakdown.part4.correctCount },
      },
      answers,
      lastUpdatedAt: now,
      lastUpdatedBy: graderName,
      lastUpdatedById: graderId,
      graderHistory: [...(res.graderHistory || []), historyEntry],
      feedback: breakdown.scaledScore >= (exam.passScore || 5) ? 'Đạt yêu cầu' : 'Chưa đạt yêu cầu'
    };

    updatedResults.push(updatedRes);
    saveLocalResult(updatedRes);
  }

  invalidateResultsCache();

  // Commit updates to Firestore in batches
  try {
    const batch = writeBatch(db);
    updatedResults.forEach(r => {
      const cleanR = sanitizeForFirestore(r);
      batch.set(doc(db, 'results', r.id), cleanR, { merge: true });
      if (r.attemptId && r.attemptId !== r.id) {
        batch.set(doc(db, 'results', r.attemptId), cleanR, { merge: true });
      }
      batch.set(doc(db, 'attempts', r.attemptId || r.id), sanitizeForFirestore({
        score: r.score,
        lastUpdatedAt: now,
        lastUpdatedBy: graderName
      }), { merge: true });
    });
    await batch.commit();
  } catch (err) {
    console.warn('recalculateExamResults batch commit warning:', err);
  }

  // Cross-component immediate real-time synchronization
  if (typeof window !== 'undefined') {
    updatedResults.forEach(r => {
      window.dispatchEvent(new CustomEvent('edutest:score_updated', {
        detail: { result: r, examId }
      }));
    });
  }

  performanceTracker.recordSample('grading', `recalculateExamResults:${examId}`, performance.now() - startTime, false);
  return { count: updatedResults.length, results: updatedResults };
}

export async function getAllResults(forceRefresh: boolean = false): Promise<ExamResult[]> {
  const startTime = performance.now();
  const now = Date.now();

  // In-memory cache hit (< 10ms)
  if (!forceRefresh && inMemoryResultsCache && inMemoryResultsCache.expiresAt > now) {
    performanceTracker.recordSample('results_sync', 'getAllResults (cached)', performance.now() - startTime, true);
    return inMemoryResultsCache.data;
  }

  const local = getLocalResults();
  try {
    const snap = await getDocs(collection(db, 'results'));
    const firestoreResults = snap.docs.map(d => ({ ...d.data(), id: d.id } as ExamResult));
    const mergedMap = new Map<string, ExamResult>();
    
    // Seed with local results
    local.forEach(r => mergedMap.set(r.id, r));

    // Merge firestore results carefully: keep local version if it has fresher grading info
    firestoreResults.forEach(r => {
      const existing = mergedMap.get(r.id);
      if (!existing) {
        mergedMap.set(r.id, r);
      } else {
        const localGradeTime = new Date(existing.lastUpdatedAt || existing.essayGradedAt || existing.submittedAt || 0).getTime();
        const firestoreGradeTime = new Date(r.lastUpdatedAt || r.essayGradedAt || r.submittedAt || 0).getTime();
        if (firestoreGradeTime >= localGradeTime) {
          mergedMap.set(r.id, r);
        }
      }
    });

    const resultList = Array.from(mergedMap.values());
    inMemoryResultsCache = {
      data: resultList,
      expiresAt: Date.now() + CACHE_TTL_MS
    };

    performanceTracker.recordSample('results_sync', 'getAllResults (network)', performance.now() - startTime, false);
    return resultList;
  } catch (err) {
    performanceTracker.recordSample('results_sync', 'getAllResults (fallback)', performance.now() - startTime, false);
    return local;
  }
}

export async function getExamResults(examId: string): Promise<ExamResult[]> {
  const all = await getAllResults();
  return all.filter(r => r.examId === examId);
}

export async function getStudentResults(studentId: string): Promise<ExamResult[]> {
  const all = await getAllResults();
  return all.filter(r => r.studentId === studentId);
}

export async function getStudentAttempts(studentId: string): Promise<ExamAttempt[]> {
  const collectionPath = 'attempts';
  try {
    const q = query(collection(db, collectionPath), where('studentId', '==', studentId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as ExamAttempt));
  } catch {
    return [];
  }
}

export async function getAttemptsForExam(examId: string): Promise<ExamAttempt[]> {
  const collectionPath = 'attempts';
  try {
    const q = query(collection(db, collectionPath), where('examId', '==', examId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as ExamAttempt));
  } catch {
    return [];
  }
}

// ==================== SYSTEM LOGS ====================

export async function logSystemAction(
  action: string,
  actorId: string,
  actorEmail: string,
  targetId?: string,
  targetType?: string,
  details?: string
): Promise<void> {
  const path = 'systemLogs';
  try {
    await addDoc(collection(db, path), sanitizeForFirestore({
      action,
      actorId,
      actorEmail,
      targetId: targetId || '',
      targetType: targetType || '',
      details: details || '',
      timestamp: new Date().toISOString()
    }));
  } catch (err) {
    console.warn('Logging skipped:', err);
  }
}

export async function getSystemLogs(maxCount = 50): Promise<SystemLog[]> {
  const path = 'systemLogs';
  try {
    const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(maxCount));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ ...d.data(), id: d.id } as SystemLog));
  } catch {
    try {
      const snap = await getDocs(collection(db, path));
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as SystemLog));
    } catch {
      return [];
    }
  }
}

// ==================== DEFAULT INITIAL SEEDING ====================

export function getDefaultClasses(): SchoolClass[] {
  return [
    // Tiểu học
    { id: 'c_1a', name: '1A1', grade: '1', schoolYear: '2024 - 2025', studentCount: 32, description: 'Khối 1 - Tiểu học', createdAt: new Date().toISOString() },
    { id: 'c_2a', name: '2A1', grade: '2', schoolYear: '2024 - 2025', studentCount: 33, description: 'Khối 2 - Tiểu học', createdAt: new Date().toISOString() },
    { id: 'c_3a', name: '3A1', grade: '3', schoolYear: '2024 - 2025', studentCount: 30, description: 'Khối 3 - Tiểu học', createdAt: new Date().toISOString() },
    { id: 'c_4a', name: '4A1', grade: '4', schoolYear: '2024 - 2025', studentCount: 35, description: 'Khối 4 - Tiểu học', createdAt: new Date().toISOString() },
    { id: 'c_5a', name: '5A1', grade: '5', schoolYear: '2024 - 2025', studentCount: 34, description: 'Khối 5 - Tiểu học', createdAt: new Date().toISOString() },
    // THCS
    { id: 'c_6a2', name: '6A2', grade: '6', schoolYear: '2024 - 2025', studentCount: 38, description: 'Khối 6 - THCS', createdAt: new Date().toISOString() },
    { id: 'c_7a', name: '7A1', grade: '7', schoolYear: '2024 - 2025', studentCount: 36, description: 'Khối 7 - THCS', createdAt: new Date().toISOString() },
    { id: 'c_8a', name: '8A1', grade: '8', schoolYear: '2024 - 2025', studentCount: 35, description: 'Khối 8 - THCS', createdAt: new Date().toISOString() },
    { id: 'c_9a', name: '9A1', grade: '9', schoolYear: '2024 - 2025', studentCount: 40, description: 'Khối 9 - Ôn thi vào 10', createdAt: new Date().toISOString() },
    // THPT
    { id: 'c_10a1', name: '10A1', grade: '10', schoolYear: '2024 - 2025', studentCount: 35, description: 'Lớp chuyên Tự nhiên', createdAt: new Date().toISOString() },
    { id: 'c_10a2', name: '10A2', grade: '10', schoolYear: '2024 - 2025', studentCount: 36, description: 'Lớp cơ bản', createdAt: new Date().toISOString() },
    { id: 'c_11b1', name: '11B1', grade: '11', schoolYear: '2024 - 2025', studentCount: 34, description: 'Lớp chuyên Toán - Tin', createdAt: new Date().toISOString() },
    { id: 'c_12a3', name: '12A3', grade: '12', schoolYear: '2024 - 2025', studentCount: 38, description: 'Lớp luyện thi Tốt nghiệp THPT', createdAt: new Date().toISOString() }
  ];
}

export function getDefaultSubjects(): Subject[] {
  return [
    { id: 'sub_math', name: 'Toán học', code: 'MATH', description: 'Đại số, Hình học & Thống kê xác suất' },
    { id: 'sub_phys', name: 'Vật lí', code: 'PHYS', description: 'Cơ học, Nhiệt học, Quang học & Điện từ' },
    { id: 'sub_chem', name: 'Hóa học', code: 'CHEM', description: 'Hóa vô cơ & Hóa hữu cơ' },
    { id: 'sub_eng', name: 'Tiếng Anh', code: 'ENG', description: 'Ngữ pháp, từ vựng và đọc hiểu' },
    { id: 'sub_lit', name: 'Ngữ văn', code: 'LIT', description: 'Đọc hiểu tác phẩm, làm văn & tiếng Việt' },
    { id: 'sub_bio', name: 'Sinh học', code: 'BIO', description: 'Di truyền học, Tiến hóa và Sinh thái học' },
    { id: 'sub_hist', name: 'Lịch sử', code: 'HIST', description: 'Lịch sử Việt Nam và Thế giới' },
    { id: 'sub_geo', name: 'Địa lí', code: 'GEO', description: 'Địa lí tự nhiên, dân cư & kinh tế' },
    { id: 'sub_khtn', name: 'Khoa học tự nhiên', code: 'KHTN', description: 'Vật lí, Hóa học, Sinh học tích hợp' },
    { id: 'sub_it', name: 'Tin học', code: 'IT', description: 'Thuật toán, lập trình & ứng dụng số' },
    { id: 'sub_tiengviet', name: 'Tiếng Việt', code: 'VIE', description: 'Tiếng Việt bậc Tiểu học' }
  ];
}

// Geometric illustration SVG data URL for math geometry
export const GEOMETRY_TRIANGLE_IMAGE = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="360" height="200" viewBox="0 0 360 200"><rect width="100%" height="100%" fill="%23f8fafc" rx="12"/><path d="M 60 160 L 300 160 L 60 40 Z" fill="%23ecfdf5" stroke="%23059669" stroke-width="2.5"/><path d="M 60 140 L 80 140 L 80 160" fill="none" stroke="%23059669" stroke-width="2"/><text x="40" y="35" font-family="sans-serif" font-weight="bold" font-size="14" fill="%231e293b">A</text><text x="40" y="175" font-family="sans-serif" font-weight="bold" font-size="14" fill="%231e293b">B (Góc vuông)</text><text x="310" y="170" font-family="sans-serif" font-weight="bold" font-size="14" fill="%231e293b">C</text><text x="25" y="105" font-family="sans-serif" font-size="13" font-weight="bold" fill="%230f766e">a = 6 cm</text><text x="165" y="180" font-family="sans-serif" font-size="13" font-weight="bold" fill="%230f766e">b = 8 cm</text><text x="195" y="90" font-family="sans-serif" font-size="13" font-weight="bold" fill="%23b45309">c = ? cm</text></svg>`;

export const PARABOLA_GRAPH_IMAGE = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="360" height="200" viewBox="0 0 360 200"><rect width="100%" height="100%" fill="%23f8fafc" rx="12"/><line x1="30" y1="140" x2="330" y2="140" stroke="%2364748b" stroke-width="1.5"/><line x1="120" y1="180" x2="120" y2="20" stroke="%2364748b" stroke-width="1.5"/><path d="M 50 20 Q 180 260 310 20" fill="none" stroke="%232563eb" stroke-width="3"/><circle cx="180" cy="165" r="4" fill="%23dc2626"/><text x="190" y="175" font-family="sans-serif" font-size="11" font-weight="bold" fill="%23dc2626">Đỉnh I(2; -1)</text><text x="335" y="145" font-family="sans-serif" font-size="12" fill="%23334155">x</text><text x="110" y="20" font-family="sans-serif" font-size="12" fill="%23334155">y</text><text x="210" y="50" font-family="sans-serif" font-size="12" font-weight="bold" fill="%231e40af">y = x² - 4x + 3</text></svg>`;

export async function checkAndSeedInitialData(): Promise<void> {
  // FAST-PATH: If initial seeding was already completed on this browser session, return immediately in 0ms!
  // This eliminates 40+ sequential network writes to Firestore on page refresh.
  if (typeof window !== 'undefined' && localStorage.getItem('edutest_initial_seeded_done') === 'true') {
    return;
  }

  try {
    // Explicitly delete class 6A1 data per user request
    addDeletedClassId('c_6a');
    addDeletedClassId('6A1');
    const existingClasses = getLocalClasses().filter(c => c.name !== '6A1' && c.id !== 'c_6a' && c.id !== '6A1');
    saveLocalClasses(existingClasses);

    // Parallel background sync for initial seed (does not block data retrieval)
    const promises: Promise<any>[] = [];

    const deletedUserIds = getDeletedUserIds();
    const localUsers = getLocalUsers();
    const allUsersToSync = [...getDefaultUsers(), ...localUsers];
    for (const defUser of allUsersToSync) {
      if (!deletedUserIds.includes(defUser.id)) {
        promises.push(setDoc(doc(db, 'users', defUser.id), sanitizeForFirestore(defUser), { merge: true }).catch(() => {}));
      }
    }

    const deletedSubIds = getDeletedSubjectIds();
    const defaultSubs = getDefaultSubjects();
    for (const sub of defaultSubs) {
      if (!deletedSubIds.includes(sub.id) && !deletedSubIds.includes(sub.code)) {
        promises.push(setDoc(doc(db, 'subjects', sub.id), sanitizeForFirestore(sub), { merge: true }).catch(() => {}));
      }
    }

    const defaultClasses = getDefaultClasses().filter(c => c.name !== '6A1' && c.id !== 'c_6a' && c.id !== '6A1');
    for (const cls of defaultClasses) {
      promises.push(setDoc(doc(db, 'classes', cls.id), sanitizeForFirestore(cls), { merge: true }).catch(() => {}));
    }

    // Execute in parallel
    await Promise.allSettled(promises);

    if (typeof window !== 'undefined') {
      localStorage.setItem('edutest_initial_seeded_done', 'true');
    }
    return;

    const seededExamsData: any[] = [
      // ================= KHỐI 1 =================
      {
        exam: {
          title: 'Khảo sát Năng lực Môn Toán Lớp 1 - Đầu năm học',
          subjectId: 'MATH',
          subjectName: 'Toán học',
          grade: '1',
          durationMinutes: 30,
          passScore: 5,
          maxScore: 10,
          classIds: ['1A1'],
          isPublished: true,
          showAnswersAfterExam: true,
          allowReview: true,
          createdBy: 'system_admin',
          createdByName: 'Cô Mai Lan'
        },
        questions: [
          {
            questionNumber: 1,
            type: 'multiple_choice',
            prompt: 'Hình nào dưới đây có 3 quả táo? Em hãy chọn đáp án đúng nhất:',
            options: {
              A: 'Hình có 2 quả táo',
              B: 'Hình có 3 quả táo',
              C: 'Hình có 5 quả táo',
              D: 'Hình không có quả nào'
            },
            correctOption: 'B',
            explanation: 'Đếm các quả táo: 1, 2, 3 quả táo tương ứng số 3.',
            points: 2.5
          },
          {
            questionNumber: 2,
            type: 'fill_blank',
            prompt: 'Điền số thích hợp vào chỗ chấm: Số đứng liền sau của số 4 là số mấy?',
            acceptableAnswers: ['5', 'số 5', 'năm'],
            explanation: 'Dãy số tự nhiên liên tiếp: 1, 2, 3, 4, 5. Liền sau số 4 là 5.',
            points: 2.5
          },
          {
            questionNumber: 3,
            type: 'true_false',
            prompt: 'Đúng ghi Đ, Sai ghi S vào các nhận định sau về phép tính cộng trong phạm vi 10:',
            subQuestions: [
              { key: 'a', text: '3 + 2 = 5', correct: true },
              { key: 'b', text: '4 + 1 = 6', correct: false },
              { key: 'c', text: '5 + 0 = 5', correct: true },
              { key: 'd', text: '2 + 6 = 8', correct: true }
            ],
            explanation: '3+2=5 (Đúng); 4+1=5 không phải 6 (Sai); 5+0=5 (Đúng); 2+6=8 (Đúng).',
            points: 2.5
          },
          {
            questionNumber: 4,
            type: 'essay',
            prompt: 'Tự luận: Bạn Nam có 3 chiếc bút chì, mẹ mua thêm cho Nam 2 chiếc bút chì nữa. Hỏi Nam có tất cả bao nhiêu chiếc bút chì?',
            sampleAnswer: 'Phép tính: 3 + 2 = 5 chiếc bút chì. Trả lời: Nam có tất cả 5 chiếc bút chì.',
            explanation: 'Lấy số bút ban đầu cộng thêm số bút được mẹ cho: 3 + 2 = 5.',
            points: 2.5
          }
        ]
      },

      // ================= KHỐI 2 =================
      {
        exam: {
          title: 'Kiểm tra Định kỳ Môn Tiếng Anh Lớp 2 - Unit 1 & 2',
          subjectId: 'ENG',
          subjectName: 'Tiếng Anh',
          grade: '2',
          durationMinutes: 35,
          passScore: 5,
          maxScore: 10,
          classIds: ['2A1'],
          isPublished: true,
          showAnswersAfterExam: true,
          allowReview: true,
          createdBy: 'system_admin',
          createdByName: 'Cô Jennifer Nguyen'
        },
        questions: [
          {
            questionNumber: 1,
            type: 'multiple_choice',
            prompt: 'Choose the correct greeting in the morning: "Good _______, teacher!"',
            options: {
              A: 'morning',
              B: 'evening',
              C: 'night',
              D: 'bye'
            },
            correctOption: 'A',
            explanation: 'Buổi sáng chào: "Good morning".',
            points: 2.5
          },
          {
            questionNumber: 2,
            type: 'fill_blank',
            prompt: 'Fill in the missing letter: "B _ O K" (Quyển sách)',
            acceptableAnswers: ['O', 'o', 'book', 'BOOK'],
            explanation: 'Từ vựng quyển sách trong tiếng Anh là "BOOK".',
            points: 2.5
          },
          {
            questionNumber: 3,
            type: 'true_false',
            prompt: 'Read and decide True (Đúng) or False (Sai):',
            subQuestions: [
              { key: 'a', text: '"Cat" means con mèo.', correct: true },
              { key: 'b', text: '"Dog" means con chim.', correct: false },
              { key: 'c', text: '"Red" is the color đỏ.', correct: true },
              { key: 'd', text: '"Two" means số ba.', correct: false }
            ],
            explanation: 'Cat = con mèo; Dog = con chó (không phải con chim); Red = màu đỏ; Two = số 2.',
            points: 2.5
          },
          {
            questionNumber: 4,
            type: 'essay',
            prompt: 'Writing: Write a short sentence to introduce your name. (Example: "My name is Lan.")',
            sampleAnswer: 'My name is [Học sinh]. / I am [Học sinh].',
            explanation: 'Cấu trúc giới thiệu tên: My name is + Tên.',
            points: 2.5
          }
        ]
      },

      // ================= KHỐI 3 =================
      {
        exam: {
          title: 'Đề Kiểm tra Môn Tiếng Việt Lớp 3 - Luyện từ và Câu',
          subjectId: 'VIE',
          subjectName: 'Tiếng Việt',
          grade: '3',
          durationMinutes: 40,
          passScore: 5,
          maxScore: 10,
          classIds: ['3A1'],
          isPublished: true,
          showAnswersAfterExam: true,
          allowReview: true,
          createdBy: 'system_admin',
          createdByName: 'Thầy Trần Đình Trọng'
        },
        questions: [
          {
            questionNumber: 1,
            type: 'multiple_choice',
            prompt: 'Trong câu thơ: "Trẻ em như búp trên cành / Biết ăn ngủ, biết học hành là ngoan", hình ảnh so sánh là gì?',
            options: {
              A: 'Trẻ em so sánh với búp trên cành',
              B: 'Búp trên cành so sánh với hoa quả',
              C: 'Ăn ngủ so sánh với học hành',
              D: 'Không có hình ảnh so sánh'
            },
            correctOption: 'A',
            explanation: 'Từ so sánh "như": so sánh "Trẻ em" với "búp trên cành".',
            points: 2.5
          },
          {
            questionNumber: 2,
            type: 'true_false',
            prompt: 'Xác định từ chỉ sự vật hay từ chỉ hoạt động, trạng thái trong các từ sau:',
            subQuestions: [
              { key: 'a', text: '"Bút chì" là từ chỉ sự vật.', correct: true },
              { key: 'b', text: '"Chạy nhảy" là từ chỉ sự vật.', correct: false },
              { key: 'c', text: '"Bác sĩ" là từ chỉ người (sự vật).', correct: true },
              { key: 'd', text: '"Vui vẻ" là từ chỉ đặc điểm, cảm xúc.', correct: true }
            ],
            explanation: 'Chạy nhảy là từ chỉ hoạt động, không phải sự vật.',
            points: 2.5
          },
          {
            questionNumber: 3,
            type: 'fill_blank',
            prompt: 'Điền từ còn thiếu vào câu thành ngữ: "Học thầy không tày học ......"',
            acceptableAnswers: ['bạn', 'Bạn'],
            explanation: 'Thành ngữ dân gian: "Học thầy không tày học bạn".',
            points: 2.5
          },
          {
            questionNumber: 4,
            type: 'essay',
            prompt: 'Tự luận: Đặt một câu theo mẫu "Ai là gì?" để giới thiệu về trường hoặc thầy cô giáo của em.',
            sampleAnswer: 'Ví dụ: Trường Tiểu học Thăng Long là ngôi nhà thứ hai của em. / Cô giáo em là người mẹ hiền thứ hai.',
            explanation: 'Câu theo mẫu Ai là gì gồm bộ phận CN (Ai/Cái gì) và VN bắt đầu bằng từ "là".',
            points: 2.5
          }
        ]
      },

      // ================= KHỐI 4 =================
      {
        exam: {
          title: 'Kiểm tra Giữa kỳ Môn Khoa Học Lớp 4 - Nước và Không Khí',
          subjectId: 'KHTN',
          subjectName: 'Khoa học tự nhiên',
          grade: '4',
          durationMinutes: 35,
          passScore: 5,
          maxScore: 10,
          classIds: ['4A1'],
          isPublished: true,
          showAnswersAfterExam: true,
          allowReview: true,
          createdBy: 'system_admin',
          createdByName: 'Cô Đỗ Thu Hà'
        },
        questions: [
          {
            questionNumber: 1,
            type: 'multiple_choice',
            prompt: 'Nước nguyên chất có những tính chất vật lí nào sau đây?',
            options: {
              A: 'Có màu trắng đục, vị ngọt, mùi thơm',
              B: 'Không màu, không mùi, không vị, chảy từ cao xuống thấp',
              C: 'Có hình dạng cố định như hình vuông',
              D: 'Chỉ chảy từ thấp lên cao'
            },
            correctOption: 'B',
            explanation: 'Nước là chất lỏng không màu, không mùi, không vị, không có hình dạng nhất định.',
            points: 2.5
          },
          {
            questionNumber: 2,
            type: 'true_false',
            prompt: 'Xét tính Đúng / Sai của các nhận định sau về vòng tuần hoàn của nước trong tự nhiên:',
            subQuestions: [
              { key: 'a', text: 'Nước ở ao, hồ, biển bay hơi tạo thành hơi nước bay lên cao.', correct: true },
              { key: 'b', text: 'Lên cao gặp lạnh, hơi nước ngưng tụ thành các hạt nước nhỏ tạo thành mây.', correct: true },
              { key: 'c', text: 'Mưa là do các đám mây ngưng tụ rơi xuống đất.', correct: true },
              { key: 'd', text: 'Vòng tuần hoàn của nước dừng lại vĩnh viễn sau một trận mưa.', correct: false }
            ],
            explanation: 'Vòng tuần hoàn nước diễn ra liên tục, không dừng lại.',
            points: 2.5
          },
          {
            questionNumber: 3,
            type: 'fill_blank',
            prompt: 'Điền kết quả: Khí nào trong không khí duy trì sự cháy và cần thiết cho sự sống của con người và động vật?',
            acceptableAnswers: ['oxi', 'oxy', 'khí oxi', 'oxygen', 'O2'],
            explanation: 'Khí oxy (O2) chiếm khoảng 21% thể tích không khí và duy trì sự sống, sự cháy.',
            points: 2.5
          },
          {
            questionNumber: 4,
            type: 'essay',
            prompt: 'Tự luận: Em hãy nêu ít nhất 2 hành động cụ thể để tiết kiệm nước sạch và bảo vệ nguồn nước tại gia đình và trường học.',
            sampleAnswer: '1. Khóa vòi nước khi không sử dụng. 2. Không vứt rác, dầu mỡ thải vào nguồn nước sạch.',
            explanation: 'Nêu đúng 2 hành động thiết thực tiết kiệm và bảo vệ nguồn nước.',
            points: 2.5
          }
        ]
      },

      // ================= KHỐI 5 =================
      {
        exam: {
          title: 'Đề Ôn tập Môn Toán Lớp 5 - Số thập phân & Tỉ số phần trăm',
          subjectId: 'MATH',
          subjectName: 'Toán học',
          grade: '5',
          durationMinutes: 45,
          passScore: 5,
          maxScore: 10,
          classIds: ['5A1'],
          isPublished: true,
          showAnswersAfterExam: true,
          allowReview: true,
          createdBy: 'system_admin',
          createdByName: 'Thầy Nguyễn Hữu Dũng'
        },
        questions: [
          {
            questionNumber: 1,
            type: 'multiple_choice',
            prompt: 'Viết phân số thập phân $\\frac{75}{100}$ dưới dạng số thập phân là:',
            options: {
              A: '$7.5$',
              B: '$0.75$',
              C: '$0.075$',
              D: '$75.0$'
            },
            correctOption: 'B',
            explanation: '$\\frac{75}{100} = 0.75$.',
            points: 2.5
          },
          {
            questionNumber: 2,
            type: 'fill_blank',
            prompt: 'Điền kết quả: Một lớp học có 40 học sinh, trong đó có 24 học sinh nữ. Hỏi số học sinh nữ chiếm bao nhiêu phần trăm số học sinh cả lớp? (Chỉ điền số, ví dụ: 60)',
            acceptableAnswers: ['60', '60%', '60 %'],
            explanation: 'Tỉ số phần trăm học sinh nữ: $(24 / 40) \\times 100\\% = 60\\%$.',
            points: 2.5
          },
          {
            questionNumber: 3,
            type: 'true_false',
            prompt: 'Xét tính Đúng / Sai của các khẳng định sau về hình học lớp 5:',
            subQuestions: [
              { key: 'a', text: 'Diện tích hình tam giác bằng (Đáy × Chiều cao) chia cho 2.', correct: true },
              { key: 'b', text: 'Chu vi hình tròn đường kính d bằng d × 3.14.', correct: true },
              { key: 'c', text: '1 m³ = 100 lít nước.', correct: false },
              { key: 'd', text: '1 ha (héc-ta) = 10000 m².', correct: true }
            ],
            explanation: '1 m³ = 1000 dm³ = 1000 lít, không phải 100 lít.',
            points: 2.5
          },
          {
            questionNumber: 4,
            type: 'essay',
            prompt: 'Tự luận: Một thửa ruộng hình thang có đáy lớn 120m, đáy bé bằng 2/3 đáy lớn, chiều cao bằng 40m. Người ta cấy lúa trên thửa ruộng đó, cứ 100 m² thu hoạch được 65kg thóc. Hỏi cả thửa ruộng thu hoạch được bao nhiêu tạ thóc?',
            sampleAnswer: 'Đáy bé: 120 × 2/3 = 80m. Diện tích: (120 + 80) × 40 / 2 = 4000 m². Số thóc: 4000 / 100 × 65 = 2600 kg = 26 tạ.',
            explanation: 'Tính đáy bé -> Diện tích thửa ruộng -> Sản lượng kg thóc -> Đổi ra tạ (26 tạ).',
            points: 2.5
          }
        ]
      },

      // ================= KHỐI 6 (TOÁN 6 & TIN 6) =================
      {
        exam: {
          title: 'Kiểm tra Giữa kỳ I Môn Toán Lớp 6 - Số tự nhiên & Tính chia hết',
          subjectId: 'MATH',
          subjectName: 'Toán học',
          grade: '6',
          durationMinutes: 45,
          passScore: 5,
          maxScore: 10,
          classIds: ['6A2'],
          isPublished: true,
          shuffleQuestions: true,
          shuffleOptions: true,
          showAnswersAfterExam: true,
          allowReview: true,
          createdBy: 'system_admin',
          createdByName: 'Thầy Giáo Toán'
        },
        questions: [
          {
            questionNumber: 1,
            type: 'multiple_choice',
            prompt: 'Tập hợp $A = \\{ x \\in \\mathbb{N} \\mid 5 < x \\le 9 \\}$ gồm các phần tử nào sau đây?',
            options: {
              A: '$\\{ 5; 6; 7; 8; 9 \\}$',
              B: '$\\{ 6; 7; 8; 9 \\}$',
              C: '$\\{ 6; 7; 8 \\}$',
              D: '$\\{ 5; 6; 7; 8 \\}$'
            },
            correctOption: 'B',
            explanation: '$x > 5$ nên không lấy số 5; $x \\le 9$ nên lấy đến 9. Các phần tử: 6, 7, 8, 9.',
            points: 2.5
          },
          {
            questionNumber: 2,
            type: 'true_false',
            prompt: 'Xét tính Đúng hay Sai của các khẳng định về dấu hiệu chia hết sau:',
            subQuestions: [
              { key: 'a', text: 'Số có chữ số tận cùng là 0 hoặc 5 thì chia hết cho 5.', correct: true },
              { key: 'b', text: 'Số chia hết cho 3 thì luôn chia hết cho 9.', correct: false },
              { key: 'c', text: 'Số $135$ vừa chia hết cho 3 vừa chia hết cho 5.', correct: true },
              { key: 'd', text: 'Mọi số nguyên tố đều là số lẻ.', correct: false }
            ],
            explanation: 'Số 2 là số nguyên tố chẵn duy nhất (ý d sai). Số 12 chia hết cho 3 nhưng không chia hết cho 9 (ý b sai).',
            points: 2.5
          },
          {
            questionNumber: 3,
            type: 'fill_blank',
            prompt: 'Điền kết quả: Tính giá trị của biểu thức $B = 2^3 \\cdot 5 - 3^2$.',
            acceptableAnswers: ['31', '=31'],
            explanation: '$2^3 = 8$, $8 \\times 5 = 40$; $3^2 = 9$. Kết quả: $40 - 9 = 31$.',
            points: 2.5
          },
          {
            questionNumber: 4,
            type: 'essay',
            prompt: 'Tự luận: Tìm số tự nhiên $x$ biết: $3 \\cdot (x - 4) + 12 = 36$. Trình bày chi tiết từng bước biến đổi.',
            sampleAnswer: '3(x - 4) = 36 - 12 => 3(x - 4) = 24 => x - 4 = 8 => x = 12. Vậy x = 12.',
            explanation: 'Chuyển vế đổi dấu và tìm thừa số chưa biết.',
            points: 2.5
          }
        ]
      },

      {
        exam: {
          title: 'Kiểm tra Định kỳ Môn Tin học Lớp 6 - Thông tin & Soạn thảo văn bản',
          subjectId: 'IT',
          subjectName: 'Tin học',
          grade: '6',
          durationMinutes: 45,
          passScore: 5,
          maxScore: 10,
          classIds: ['6A2'],
          isPublished: true,
          shuffleQuestions: true,
          shuffleOptions: true,
          showAnswersAfterExam: true,
          allowReview: true,
          createdBy: 'system_admin',
          createdByName: 'Cô Giáo Tin Học'
        },
        questions: [
          {
            questionNumber: 1,
            type: 'multiple_choice',
            prompt: 'Thiết bị nào sau đây là thiết bị vào (Input) của máy tính?',
            options: {
              A: 'Bàn phím và chuột',
              B: 'Màn hình và máy in',
              C: 'Loa và tai nghe',
              D: 'Máy chiếu'
            },
            correctOption: 'A',
            explanation: 'Bàn phím và chuột dùng để đưa dữ liệu vào máy tính nên là thiết bị vào.',
            points: 2.5
          },
          {
            questionNumber: 2,
            type: 'true_false',
            prompt: 'Xét tính Đúng / Sai của các phát biểu về mạng Internet và an toàn thông tin:',
            subQuestions: [
              { key: 'a', text: 'Internet là mạng kết nối hàng triệu máy tính trên toàn thế giới.', correct: true },
              { key: 'b', text: 'Có thể chia sẻ mật khẩu tài khoản cá nhân cho người lạ trên mạng.', correct: false },
              { key: 'c', text: 'Trang web (Website) được mở bằng phần mềm trình duyệt web.', correct: true },
              { key: 'd', text: 'Tập tin hình ảnh thường có phần đuôi mở rộng là .docx.', correct: false }
            ],
            explanation: 'Mật khẩu cần giữ bí mật (ý b sai). Đuôi .docx là tệp Word văn bản, hình ảnh là .jpg, .png (ý d sai).',
            points: 2.5
          },
          {
            questionNumber: 3,
            type: 'fill_blank',
            prompt: 'Điền phím tắt: Để lưu văn bản trong Microsoft Word, em sử dụng tổ hợp phím nào? (Ví dụ: Ctrl+S)',
            acceptableAnswers: ['Ctrl+S', 'Ctrl + S', 'ctrl+s', 'ctrl + s'],
            explanation: 'Tổ hợp phím tắt lưu văn bản là Ctrl + S (Save).',
            points: 2.5
          },
          {
            questionNumber: 4,
            type: 'essay',
            prompt: 'Tự luận: Nêu 3 quy tắc quan trọng em cần tuân thủ khi tham gia mạng xã hội và sử dụng Internet an toàn.',
            sampleAnswer: '1. Không tiết lộ thông tin cá nhân (địa chỉ, số điện thoại, mật khẩu). 2. Không truy cập vào các liên kết lạ hoặc tải tệp không rõ nguồn gốc. 3. Ứng xử văn minh, lịch sự và báo cho cha mẹ/thầy cô khi gặp rắc rối.',
            explanation: 'Nêu các quy tắc bảo mật và văn hóa mạng cơ bản.',
            points: 2.5
          }
        ]
      },

      // ================= KHỐI 7 (TIN 7) =================
      {
        exam: {
          title: 'Kiểm tra Giữa kỳ Môn Tin học Lớp 7 - Bảng tính điện tử Excel',
          subjectId: 'IT',
          subjectName: 'Tin học',
          grade: '7',
          durationMinutes: 45,
          passScore: 5,
          maxScore: 10,
          classIds: ['7A1'],
          isPublished: true,
          shuffleQuestions: true,
          shuffleOptions: true,
          showAnswersAfterExam: true,
          allowReview: true,
          createdBy: 'system_admin',
          createdByName: 'Cô Giáo Tin Học'
        },
        questions: [
          {
            questionNumber: 1,
            type: 'multiple_choice',
            prompt: 'Trong bảng tính Excel, địa chỉ của một ô tính được xác định bởi:',
            options: {
              A: 'Tên cột trước, tên hàng sau (ví dụ: B5)',
              B: 'Tên hàng trước, tên cột sau (ví dụ: 5B)',
              C: 'Chỉ gồm số thứ tự',
              D: 'Tên của trang tính'
            },
            correctOption: 'A',
            explanation: 'Địa chỉ ô luôn gồm tên cột (chữ cái) ghép với tên hàng (chữ số), ví dụ: B5.',
            points: 2.5
          },
          {
            questionNumber: 2,
            type: 'true_false',
            prompt: 'Xét tính Đúng / Sai của các khẳng định về hàm tính toán trong bảng tính:',
            subQuestions: [
              { key: 'a', text: 'Hàm SUM dùng để tính tổng các giá trị số.', correct: true },
              { key: 'b', text: 'Hàm AVERAGE dùng để tìm giá trị lớn nhất.', correct: false },
              { key: 'c', text: 'Công thức trong bảng tính luôn bắt đầu bằng dấu "=".', correct: true },
              { key: 'd', text: 'Hàm MAX trả về giá trị lớn nhất trong danh sách.', correct: true }
            ],
            explanation: 'Hàm AVERAGE dùng để tính trung bình cộng, không phải tìm giá trị lớn nhất (ý b sai).',
            points: 2.5
          },
          {
            questionNumber: 3,
            type: 'fill_blank',
            prompt: 'Điền tên hàm: Hàm nào trong bảng tính Excel dùng để đếm số ô chứa dữ liệu số? (Gợi ý: hàm 5 chữ cái)',
            acceptableAnswers: ['COUNT', 'count', '=COUNT'],
            explanation: 'Hàm COUNT đếm số lượng các ô chứa giá trị số.',
            points: 2.5
          },
          {
            questionNumber: 4,
            type: 'essay',
            prompt: 'Tự luận: Giả sử tại ô C1 có công thức "=A1+B1". Khi sao chép công thức từ ô C1 sang ô C2 thì công thức tại ô C2 sẽ thay đổi như thế nào? Giải thích lý do.',
            sampleAnswer: 'Công thức tại ô C2 sẽ tự động chuyển thành "=A2+B2" vì đây là địa chỉ tương đối, khi sao chép xuống 1 hàng thì chỉ số hàng sẽ tăng thêm 1 đơn vị.',
            explanation: 'Khái niệm địa chỉ tương đối trong Excel khi sao chép công thức.',
            points: 2.5
          }
        ]
      },

      // ================= KHỐI 8 (TIN 8) =================
      {
        exam: {
          title: 'Kiểm tra Học kỳ Môn Tin học Lớp 8 - Thuật toán & Lập trình',
          subjectId: 'IT',
          subjectName: 'Tin học',
          grade: '8',
          durationMinutes: 45,
          passScore: 5,
          maxScore: 10,
          classIds: ['8A1'],
          isPublished: true,
          shuffleQuestions: true,
          shuffleOptions: true,
          showAnswersAfterExam: true,
          allowReview: true,
          createdBy: 'system_admin',
          createdByName: 'Thầy Giáo Tin Học'
        },
        questions: [
          {
            questionNumber: 1,
            type: 'multiple_choice',
            prompt: 'Thuật toán là gì trong khoa học máy tính?',
            options: {
              A: 'Dãy hữu hạn các thao tác được sắp xếp theo một trình tự xác định để giải quyết một bài toán',
              B: 'Một chương trình máy tính viết sẵn',
              C: 'Một thiết bị phần cứng xử lý dữ liệu',
              D: 'Dữ liệu lưu trữ trong ổ đĩa'
            },
            correctOption: 'A',
            explanation: 'Định nghĩa thuật toán: dãy hữu hạn các chỉ dẫn rõ ràng để từ Input đạt được Output.',
            points: 2.5
          },
          {
            questionNumber: 2,
            type: 'true_false',
            prompt: 'Xét tính Đúng / Sai của các câu lệnh và cấu trúc điều khiển trong lập trình:',
            subQuestions: [
              { key: 'a', text: 'Cấu trúc rẽ nhánh thường dùng câu lệnh if - then - else.', correct: true },
              { key: 'b', text: 'Vòng lặp vô tận là điều mong muốn trong mọi chương trình.', correct: false },
              { key: 'c', text: 'Biến là đại lượng có giá trị có thể thay đổi trong quá trình thực hiện chương trình.', correct: true },
              { key: 'd', text: 'Hằng số có thể gán lại giá trị mới bất kỳ lúc nào.', correct: false }
            ],
            explanation: 'Hằng số không thể gán lại giá trị (ý d sai). Vòng lặp vô tận gây treo chương trình (ý b sai).',
            points: 2.5
          },
          {
            questionNumber: 3,
            type: 'fill_blank',
            prompt: 'Điền kết quả: Cho đoạn mã: a = 5; b = 7; if (a < b) then a = a + 3; Hỏi sau khi thực thi giá trị của a là bao nhiêu?',
            acceptableAnswers: ['8', '=8'],
            explanation: 'Vì $5 < 7$ là Đúng, câu lệnh $a = a + 3 = 5 + 3 = 8$ được thực hiện.',
            points: 2.5
          },
          {
            questionNumber: 4,
            type: 'essay',
            prompt: 'Tự luận: Hãy mô tả thuật toán tìm số lớn nhất trong hai số $a$ và $b$ bằng cách liệt kê các bước.',
            sampleAnswer: 'Bước 1: Nhập hai số a và b. Bước 2: So sánh nếu a > b thì Max = a; ngược lại Max = b. Bước 3: Xuất giá trị Max và kết thúc.',
            explanation: 'Liệt kê các bước tuần tự rõ ràng theo cấu trúc rẽ nhánh.',
            points: 2.5
          }
        ]
      },

      // ================= KHỐI 9 (TIN 9) =================
      {
        exam: {
          title: 'Kiểm tra Môn Tin học Lớp 9 - Mạng máy tính & An toàn Internet',
          subjectId: 'IT',
          subjectName: 'Tin học',
          grade: '9',
          durationMinutes: 45,
          passScore: 5,
          maxScore: 10,
          classIds: ['9A1'],
          isPublished: true,
          shuffleQuestions: true,
          shuffleOptions: true,
          showAnswersAfterExam: true,
          allowReview: true,
          createdBy: 'system_admin',
          createdByName: 'Thầy Giáo Tin Học'
        },
        questions: [
          {
            questionNumber: 1,
            type: 'multiple_choice',
            prompt: 'Mạng LAN (Local Area Network) là mạng kết nối máy tính ở phạm vi nào?',
            options: {
              A: 'Phạm vi hẹp như một phòng, một trường học hoặc tòa nhà',
              B: 'Phạm vi toàn cầu',
              C: 'Phạm vi giữa các quốc gia',
              D: 'Không dây vệ tinh'
            },
            correctOption: 'A',
            explanation: 'LAN là mạng cục bộ (Local Area Network) kết nối trong phạm vi địa lý nhỏ.',
            points: 2.5
          },
          {
            questionNumber: 2,
            type: 'true_false',
            prompt: 'Xét tính Đúng / Sai của các nhận định về virus máy tính và phần mềm độc hại (Malware):',
            subQuestions: [
              { key: 'a', text: 'Virus máy tính là chương trình có khả năng tự nhân bản và lây lan.', correct: true },
              { key: 'b', text: 'Cài đặt phần mềm diệt virus và cập nhật thường xuyên giúp bảo vệ máy tính.', correct: true },
              { key: 'c', text: 'Mở tệp đính kèm trong thư rác từ người lạ là an toàn tuyệt đối.', correct: false },
              { key: 'd', text: 'Tường lửa (Firewall) giúp ngăn chặn các truy cập trái phép từ bên ngoài mạng.', correct: true }
            ],
            explanation: 'Thư rác từ người lạ thường chứa mã độc và lừa đảo, không được mở tệp đính kèm (ý c sai).',
            points: 2.5
          },
          {
            questionNumber: 3,
            type: 'fill_blank',
            prompt: 'Điền thuật ngữ: Giao thức truyền tải siêu văn bản an toàn có mã hóa được hiển thị ở đầu địa chỉ trang web là gì? (Ví dụ: https)',
            acceptableAnswers: ['https', 'HTTPS', 'https://'],
            explanation: 'HTTPS (Hypertext Transfer Protocol Secure) là giao thức truyền tải siêu văn bản an toàn.',
            points: 2.5
          },
          {
            questionNumber: 4,
            type: 'essay',
            prompt: 'Tự luận: Trình bày vai trò của Internet trong đời sống hiện nay và nêu ít nhất 2 tác động tiêu cực nếu lạm dụng Internet quá mức.',
            sampleAnswer: 'Vai trò: Tra cứu thông tin, học tập trực tuyến, kết nối liên lạc, giải trí và làm việc số. Tác hại khi lạm dụng: Suy giảm thị lực và sức khỏe, nguy cơ nghiện game/mạng xã hội, sao nhãng học tập và nguy cơ lộ lọt thông tin cá nhân.',
            explanation: 'Nêu đầy đủ vai trò tích cực và các tác hại tiêu cực.',
            points: 2.5
          }
        ]
      },

      // ================= KHỐI 6 (KHTN) =================
      {
        exam: {
          title: 'Kiểm tra Giữa kỳ I Môn KHTN Lớp 6 - Vật chất & Năng lượng',
          subjectId: 'KHTN',
          subjectName: 'Khoa học tự nhiên',
          grade: '6',
          durationMinutes: 45,
          passScore: 5,
          maxScore: 10,
          classIds: ['6A1'],
          isPublished: true,
          showAnswersAfterExam: true,
          allowReview: true,
          createdBy: 'system_admin',
          createdByName: 'Cô Hoàng Minh Thư'
        },
        questions: [
          {
            questionNumber: 1,
            type: 'multiple_choice',
            prompt: 'Đơn vị đo khối lượng chính thức trong hệ đo lường quốc tế SI là:',
            options: {
              A: 'Gam (g)',
              B: 'Kilôgam (kg)',
              C: 'Tấn (t)',
              D: 'Miligam (mg)'
            },
            correctOption: 'B',
            explanation: 'Trong hệ SI, đơn vị chuẩn của khối lượng là kilôgam (kg).',
            points: 2.5
          },
          {
            questionNumber: 2,
            type: 'true_false',
            prompt: 'Xét tính Đúng / Sai của các phát biểu về tế bào sinh học:',
            subQuestions: [
              { key: 'a', text: 'Tế bào là đơn vị cơ bản cấu tạo nên mọi cơ thể sống.', correct: true },
              { key: 'b', text: 'Mọi tế bào đều có thành tế bào bằng xenlulôzơ.', correct: false },
              { key: 'c', text: 'Tế bào nhân thực có nhân hoàn chỉnh chứa màng nhân.', correct: true },
              { key: 'd', text: 'Lục lạp có ở tế bào động vật.', correct: false }
            ],
            explanation: 'Thành xenlulôzơ và lục lạp chỉ có ở tế bào thực vật, tế bào động vật không có lục lạp.',
            points: 2.5
          },
          {
            questionNumber: 3,
            type: 'fill_blank',
            prompt: 'Điền kết quả: Một vật có khối lượng $m = 250\\text{ g}$ và thể tích $V = 50\\text{ cm}^3$. Khối lượng riêng $D = \\frac{m}{V}$ của vật bằng bao nhiêu $\\text{g/cm}^3$?',
            acceptableAnswers: ['5', '5 g/cm3', '5g/cm3'],
            explanation: 'Áp dụng công thức $D = m / V = 250 / 50 = 5\\text{ g/cm}^3$.',
            points: 2.5
          },
          {
            questionNumber: 4,
            type: 'essay',
            prompt: 'Tự luận: Phân biệt sự bay hơi và sự sôi. Nêu ví dụ thực tế cho mỗi hiện tượng.',
            sampleAnswer: 'Bay hơi xảy ra ở mọi nhiệt độ trên bề mặt chất lỏng (vd: phơi quần áo). Sôi xảy ra ở nhiệt độ sôi xác định cả trong lòng và trên bề mặt (vd: nước sôi ở 100 độ C).',
            explanation: 'Nêu rõ vị trí xảy ra (bề mặt vs toàn khối) và điều kiện nhiệt độ.',
            points: 2.5
          }
        ]
      },

      // ================= KHỐI 7 =================
      {
        exam: {
          title: 'Khảo sát Chất lượng Môn Toán Lớp 7 - Số hữu tỉ & Góc đối đỉnh',
          subjectId: 'MATH',
          subjectName: 'Toán học',
          grade: '7',
          durationMinutes: 45,
          passScore: 5,
          maxScore: 10,
          classIds: ['7A1'],
          isPublished: true,
          showAnswersAfterExam: true,
          allowReview: true,
          createdBy: 'system_admin',
          createdByName: 'Thầy Vũ Đình Toàn'
        },
        questions: [
          {
            questionNumber: 1,
            type: 'multiple_choice',
            prompt: 'Số hữu tỉ là số có thể viết được dưới dạng phân số nào?',
            options: {
              A: '$\\frac{a}{b}$ với $a, b \\in \\mathbb{Z}, b \\ne 0$',
              B: '$\\frac{a}{b}$ với $a, b \\in \\mathbb{N}, b = 0$',
              C: 'Số thập phân vô hạn không tuần hoàn',
              D: 'Chỉ gồm các số nguyên dương'
            },
            correctOption: 'A',
            explanation: 'Tập hợp số hữu tỉ $\\mathbb{Q} = \\{ \\frac{a}{b} \\mid a, b \\in \\mathbb{Z}, b \\ne 0 \\}$.',
            points: 2.5
          },
          {
            questionNumber: 2,
            type: 'fill_blank',
            prompt: 'Điền kết quả: Tính giá trị của biểu thức $A = (-2)^3 + 3^2$.',
            acceptableAnswers: ['1', '+1'],
            explanation: '$(-2)^3 = -8$, $3^2 = 9$. Do đó $A = -8 + 9 = 1$.',
            points: 2.5
          },
          {
            questionNumber: 3,
            type: 'true_false',
            prompt: 'Xét tính Đúng / Sai của các khẳng định hình học về hai góc và đường thẳng:',
            subQuestions: [
              { key: 'a', text: 'Hai góc đối đỉnh thì luôn bằng nhau.', correct: true },
              { key: 'b', text: 'Hai góc bằng nhau thì chắc chắn đối đỉnh.', correct: false },
              { key: 'c', text: 'Qua một điểm ở ngoài đường thẳng, có duy nhất một đường thẳng song song với đường thẳng đó.', correct: true },
              { key: 'd', text: 'Hai đường thẳng cùng vuông góc với đường thẳng thứ ba thì song song với nhau.', correct: true }
            ],
            explanation: 'Hai góc bằng nhau chưa chắc đối đỉnh (ví dụ hai góc so le trong bằng nhau).',
            points: 2.5
          },
          {
            questionNumber: 4,
            type: 'essay',
            prompt: 'Tự luận: Tìm x biết: $|x - 1.5| = 2.5$. Nêu chi tiết 2 trường hợp giải.',
            sampleAnswer: 'TH1: x - 1.5 = 2.5 => x = 4. TH2: x - 1.5 = -2.5 => x = -1. Kết luận: x ∈ {4; -1}.',
            explanation: 'Phá dấu giá trị tuyệt đối thành 2 phương trình bậc nhất.',
            points: 2.5
          }
        ]
      },

      // ================= KHỐI 8 =================
      {
        exam: {
          title: 'Kiểm tra Giữa kỳ Môn Hóa Học Lớp 8 - Phản ứng Hóa học & Mol',
          subjectId: 'CHEM',
          subjectName: 'Hóa học',
          grade: '8',
          durationMinutes: 45,
          passScore: 5,
          maxScore: 10,
          classIds: ['8A1'],
          isPublished: true,
          showAnswersAfterExam: true,
          allowReview: true,
          createdBy: 'system_admin',
          createdByName: 'Cô Lê Bích Nga'
        },
        questions: [
          {
            questionNumber: 1,
            type: 'multiple_choice',
            prompt: 'Hiện tượng nào sau đây là hiện tượng hóa học?',
            options: {
              A: 'Nước đá tan thành nước lỏng',
              B: 'Dây sắt bị gỉ sét trong không khí ẩm tạo thành oxit sắt',
              C: 'Cồn bay hơi khi mở nắp lọ',
              D: 'Hòa tan muối ăn vào nước'
            },
            correctOption: 'B',
            explanation: 'Gỉ sắt có sinh ra chất mới là oxit sắt nâu đỏ, nên là hiện tượng hóa học.',
            points: 2.5
          },
          {
            questionNumber: 2,
            type: 'fill_blank',
            prompt: 'Điền kết quả: Khối lượng mol của khí cacbonic ($CO_2$) bằng bao nhiêu g/mol? (Biết C=12, O=16).',
            acceptableAnswers: ['44', '44 g/mol', '44g/mol'],
            explanation: '$M_{CO_2} = 12 + 16 \\times 2 = 44\\text{ g/mol}$.',
            points: 2.5
          },
          {
            questionNumber: 3,
            type: 'true_false',
            prompt: 'Xét tính Đúng / Sai của các mệnh đề định luật bảo toàn khối lượng:',
            subQuestions: [
              { key: 'a', text: 'Trong phản ứng hóa học, tổng khối lượng các chất tham gia bằng tổng khối lượng các chất sản phẩm.', correct: true },
              { key: 'b', text: 'Số lượng nguyên tử của mỗi nguyên tố được bảo toàn trong phản ứng.', correct: true },
              { key: 'c', text: 'Liên kết giữa các nguyên tử không đổi trong phản ứng hóa học.', correct: false },
              { key: 'd', text: '1 mol bất kỳ chất khí nào ở đktc đều chiếm thể tích 22.4 lít.', correct: true }
            ],
            explanation: 'Trong phản ứng hóa học, liên kết giữa các nguyên tử thay đổi khiến phân tử này biến thành phân tử khác.',
            points: 2.5
          },
          {
            questionNumber: 4,
            type: 'essay',
            prompt: 'Tự luận: Đốt cháy hoàn toàn 6.2g photpho (P) trong bình chứa khí oxi tạo ra điphotpho pentaoxit ($P_2O_5$). Viết PTHH và tính khối lượng $P_2O_5$ thu được. (Biết P=31, O=16).',
            sampleAnswer: 'PTHH: 4P + 5O2 -> 2P2O5. n_P = 6.2/31 = 0.2 mol. Theo pt: n_P2O5 = 0.2/2 = 0.1 mol. m_P2O5 = 0.1 × 142 = 14.2g.',
            explanation: 'Tính số mol P -> Dựa vào phương trình tìm nP2O5 -> Tính khối lượng m = n.M.',
            points: 2.5
          }
        ]
      },

      // ================= KHỐI 9 =================
      {
        exam: {
          title: 'Đề Thi Thử Vào Lớp 10 Môn Toán - Đề số 1 Chuyên đề Hình & Đại số',
          subjectId: 'MATH',
          subjectName: 'Toán học',
          grade: '9',
          durationMinutes: 90,
          passScore: 5,
          maxScore: 10,
          classIds: ['9A1'],
          isPublished: true,
          showAnswersAfterExam: true,
          allowReview: true,
          createdBy: 'system_admin',
          createdByName: 'Thầy Phan Thanh Hải'
        },
        questions: [
          {
            questionNumber: 1,
            type: 'multiple_choice',
            prompt: 'Điều kiện xác định của biểu thức $P = \\sqrt{2x - 6}$ là:',
            options: {
              A: '$x \\ge 3$',
              B: '$x > 3$',
              C: '$x \\le 3$',
              D: '$x \\ne 3$'
            },
            correctOption: 'A',
            explanation: 'Biểu thức dưới căn không âm: $2x - 6 \\ge 0 \\Leftrightarrow x \\ge 3$.',
            points: 2.5
          },
          {
            questionNumber: 2,
            type: 'fill_blank',
            prompt: 'Điền kết quả: Cho phương trình bậc hai $x^2 - 5x + 6 = 0$. Gọi $x_1, x_2$ là hai nghiệm của phương trình. Theo định lý Vi-ét, tích $x_1 \\cdot x_2$ bằng bao nhiêu?',
            acceptableAnswers: ['6', '+6'],
            explanation: 'Theo định lý Vi-ét, với $ax^2 + bx + c = 0$, tích hai nghiệm là $P = c/a = 6/1 = 6$.',
            points: 2.5
          },
          {
            questionNumber: 3,
            type: 'true_false',
            prompt: 'Xét tính Đúng / Sai của các khẳng định về tứ giác nội tiếp đường tròn:',
            subQuestions: [
              { key: 'a', text: 'Tứ giác có tổng hai góc đối diện bằng 180° là tứ giác nội tiếp.', correct: true },
              { key: 'b', text: 'Hình thang cân luôn nội tiếp được trong một đường tròn.', correct: true },
              { key: 'c', text: 'Mọi hình bình hành đều là tứ giác nội tiếp đường tròn.', correct: false },
              { key: 'd', text: 'Góc nội tiếp chắn nửa đường tròn là góc vuông (90°).', correct: true }
            ],
            explanation: 'Hình bình hành thông thường không có tổng 2 góc đối bằng 180°, chỉ có hình chữ nhật hoặc hình vuông mới nội tiếp.',
            points: 2.5
          },
          {
            questionNumber: 4,
            type: 'essay',
            imageUrl: GEOMETRY_TRIANGLE_IMAGE,
            prompt: 'Tự luận: Cho tam giác ABC vuông tại A có đường cao AH. Biết AB = 6cm, AC = 8cm. Hãy tính độ dài cạnh huyền BC, đường cao AH và diện tích tam giác ABC.',
            sampleAnswer: 'BC = √(AB² + AC²) = √(36+64) = 10cm. AH = (AB.AC)/BC = (6.8)/10 = 4.8cm. S_ABC = 1/2.AB.AC = 24 cm².',
            explanation: 'Áp dụng hệ thức lượng trong tam giác vuông: $BC = \\sqrt{AB^2 + AC^2} = 10\\text{ cm}$. $AH = \\frac{AB \\cdot AC}{BC} = 4.8\\text{ cm}$.',
            points: 2.5
          }
        ]
      },

      // ================= KHỐI 10 =================
      {
        exam: {
          title: 'Kiểm tra Giữa kỳ I - Môn Toán Lớp 10 (Chuẩn CT GDPT mới)',
          subjectId: 'MATH',
          subjectName: 'Toán học',
          grade: '10',
          durationMinutes: 45,
          passScore: 5,
          maxScore: 10,
          classIds: ['10A1', '10A2'],
          isPublished: true,
          showAnswersAfterExam: true,
          allowReview: true,
          createdBy: 'system_admin',
          createdByName: 'Thầy Nguyễn Văn An'
        },
        questions: [
          {
            questionNumber: 1,
            type: 'multiple_choice',
            prompt: 'Trong các mệnh đề sau về tập hợp số thực $\\mathbb{R}$, mệnh đề nào là chân lý đúng?',
            options: {
              A: 'Mọi số thực $x$ đều thỏa mãn $x^2 > 0$.',
              B: '$\\exists x \\in \\mathbb{R}: x^2 + 1 = 0$.',
              C: '$\\forall x \\in \\mathbb{R}: x^2 \\ge 0$.',
              D: 'Phương trình $\\sqrt{x} = -2$ có nghiệm thực.'
            },
            correctOption: 'C',
            explanation: 'Bình phương của mọi số thực luôn không âm: $\\forall x \\in \\mathbb{R}, x^2 \\ge 0$.',
            points: 2
          },
          {
            questionNumber: 2,
            type: 'true_false',
            imageUrl: PARABOLA_GRAPH_IMAGE,
            prompt: 'Cho hàm số bậc hai $y = f(x) = x^2 - 4x + 3$ có đồ thị parabol như hình vẽ. Xét tính Đúng / Sai của các nhận định:',
            subQuestions: [
              { key: 'a', text: 'Đồ thị hàm số có tọa độ đỉnh là $I(2; -1)$.', correct: true },
              { key: 'b', text: 'Hàm số đồng biến trên khoảng $(-\\infty; 2)$.', correct: false },
              { key: 'c', text: 'Phương trình $f(x) = 0$ có hai nghiệm phân biệt $x_1 = 1, x_2 = 3$.', correct: true },
              { key: 'd', text: 'Giá trị nhỏ nhất của hàm số trên $\\mathbb{R}$ bằng $-1$.', correct: true }
            ],
            explanation: 'Tọa độ đỉnh $x_I = -b/(2a) = 2, y_I = -1$. Vì $a > 0$ nên bề lõm quay lên, nghịch biến trên $(-\\infty; 2)$.',
            points: 3
          },
          {
            questionNumber: 3,
            type: 'fill_blank',
            imageUrl: GEOMETRY_TRIANGLE_IMAGE,
            prompt: 'Điền kết quả: Cho tam giác vuông có hai cạnh góc vuông $a = 6\\text{ cm}$ và $b = 8\\text{ cm}$ (xem hình vẽ minh họa). Độ dài cạnh huyền $c$ bằng bao nhiêu cm?',
            acceptableAnswers: ['10', '10 cm', '10cm'],
            explanation: 'Áp dụng định lý Pytago: $c = \\sqrt{6^2 + 8^2} = \\sqrt{100} = 10\\text{ cm}$.',
            points: 2.5
          },
          {
            questionNumber: 4,
            type: 'essay',
            prompt: 'Tự luận: Cho hai tập hợp $A = [1; 5]$ và $B = (2; 7)$. Hãy biểu diễn trên trục số và tìm giao $A \\cap B$ và hợp $A \\cup B$. Nêu rõ các bước suy luận.',
            sampleAnswer: 'Giao: A ∩ B = (2; 5]. Hợp: A ∪ B = [1; 7). Các phần tử thuộc cả A và B thỏa mãn 2 < x ≤ 5.',
            explanation: 'Biểu diễn khoảng giao và hợp trên trục số thực.',
            points: 2.5
          }
        ]
      },

      // ================= KHỐI 11 =================
      {
        exam: {
          title: 'Khảo sát Năng lực Môn Vật Lí Lớp 11 - Dao động Điều hòa & Sóng cơ',
          subjectId: 'PHYS',
          subjectName: 'Vật lí',
          grade: '11',
          durationMinutes: 45,
          passScore: 5,
          maxScore: 10,
          classIds: ['11B1'],
          isPublished: true,
          showAnswersAfterExam: true,
          allowReview: true,
          createdBy: 'system_admin',
          createdByName: 'Thầy Lâm Quang Trí'
        },
        questions: [
          {
            questionNumber: 1,
            type: 'multiple_choice',
            prompt: 'Một chất điểm dao động điều hòa theo phương trình $x = 5\\cos(4\\pi t + \\frac{\\pi}{3})\\text{ cm}$. Biên độ và chu kỳ dao động của chất điểm là:',
            options: {
              A: '$A = 5\\text{ cm}, T = 0.5\\text{ s}$',
              B: '$A = 5\\text{ cm}, T = 2\\text{ s}$',
              C: '$A = 4\\text{ cm}, T = 0.5\\text{ s}$',
              D: '$A = 10\\text{ cm}, T = 1\\text{ s}$'
            },
            correctOption: 'A',
            explanation: 'Biên độ $A = 5\\text{ cm}$. Tần số góc $\\omega = 4\\pi \\Rightarrow T = \\frac{2\\pi}{\\omega} = \\frac{2\\pi}{4\\pi} = 0.5\\text{ s}$.',
            points: 2.5
          },
          {
            questionNumber: 2,
            type: 'true_false',
            prompt: 'Xét tính Đúng / Sai của các phát biểu về dao động điều hòa của con lắc lò xo:',
            subQuestions: [
              { key: 'a', text: 'Vận tốc biến thiên điều hòa sớm pha $\\pi/2$ so với li độ.', correct: true },
              { key: 'b', text: 'Gia tốc ngược pha với li độ ($a = -\\omega^2 x$).', correct: true },
              { key: 'c', text: 'Ở vị trí cân bằng, cơ năng của vật bằng 0.', correct: false },
              { key: 'd', text: 'Ở vị trí biên, vận tốc của vật đạt giá trị cực đại.', correct: false }
            ],
            explanation: 'Cơ năng bảo toàn và không bằng 0; ở vị trí biên vận tốc bằng 0.',
            points: 2.5
          },
          {
            questionNumber: 3,
            type: 'fill_blank',
            prompt: 'Điền kết quả: Một sóng cơ truyền trên mặt nước với bước sóng $\\lambda = 20\\text{ cm}$ và chu kỳ $T = 0.1\\text{ s}$. Tốc độ truyền sóng $v = \\frac{\\lambda}{T}$ bằng bao nhiêu m/s?',
            acceptableAnswers: ['2', '2 m/s', '2m/s'],
            explanation: '$v = \\frac{20\\text{ cm}}{0.1\\text{ s}} = 200\\text{ cm/s} = 2\\text{ m/s}$.',
            points: 2.5
          },
          {
            questionNumber: 4,
            type: 'essay',
            prompt: 'Tự luận: Nêu hiện tượng cộng hưởng cơ học và đưa ra ít nhất một ứng dụng có lợi cùng một tác hại cần phòng tránh trong đời sống hoặc kỹ thuật.',
            sampleAnswer: 'Hiện tượng: Biên độ dao động cưỡng bức tăng cực đại khi tần số lực cưỡng bức bằng tần số riêng. Có lợi: Hộp đàn ghita, cộng hưởng âm. Có hại: Sập cầu, nứt vỡ công trình do rung chấn.',
            explanation: 'Trình bày định nghĩa hiện tượng cộng hưởng và ví dụ thực tế.',
            points: 2.5
          }
        ]
      },

      // ================= KHỐI 12 =================
      {
        exam: {
          title: 'Đề Thi Thử Tốt Nghiệp THPT 2025 Môn Toán (Cấu trúc mới 4 Phần của Bộ GD&ĐT)',
          subjectId: 'MATH',
          subjectName: 'Toán học',
          grade: '12',
          durationMinutes: 90,
          passScore: 5,
          maxScore: 10,
          classIds: ['12A3'],
          isPublished: true,
          showAnswersAfterExam: true,
          allowReview: true,
          createdBy: 'system_admin',
          createdByName: 'TS. Nguyễn Hoàng Nam'
        },
        questions: [
          // PHẦN I: Trắc nghiệm 4 lựa chọn
          {
            questionNumber: 1,
            type: 'multiple_choice',
            prompt: 'PHẦN I - Trắc nghiệm 4 lựa chọn: Cho hàm số $y = f(x)$ có bảng biến thiên với đạo hàm $f\'(x) = (x - 1)^2(x + 2)(x - 3)$. Số điểm cực trị của hàm số đã cho là:',
            options: {
              A: '1 điểm',
              B: '2 điểm',
              C: '3 điểm',
              D: '4 điểm'
            },
            correctOption: 'B',
            explanation: '$f\'(x) = 0$ tại $x=1$ (bội 2 chẵn - không đổi dấu), $x=-2$ (bội 1 lẻ - đổi dấu), $x=3$ (bội 1 lẻ - đổi dấu). Vậy hàm số có đúng 2 điểm cực trị.',
            points: 1.5
          },
          {
            questionNumber: 2,
            type: 'multiple_choice',
            prompt: 'Họ nguyên hàm của hàm số $f(x) = 3x^2 + e^x$ trên tập số thực $\\mathbb{R}$ là:',
            options: {
              A: '$\\int f(x)dx = x^3 + e^x + C$',
              B: '$\\int f(x)dx = 6x + e^x + C$',
              C: '$\\int f(x)dx = x^3 - e^x + C$',
              D: '$\\int f(x)dx = 3x^3 + e^x + C$'
            },
            correctOption: 'A',
            explanation: '$\\int 3x^2 dx = x^3 + C_1$ và $\\int e^x dx = e^x + C_2$. Tổng lại ta được $x^3 + e^x + C$.',
            points: 1.5
          },
          // PHẦN II: Trắc nghiệm Đúng / Sai (Chùm 4 ý chuẩn cấu trúc mới)
          {
            questionNumber: 3,
            type: 'true_false',
            prompt: 'PHẦN II - Trắc nghiệm Đúng / Sai: Trong không gian với hệ tọa độ Oxyz, cho mặt cầu $(S): (x - 1)^2 + (y + 2)^2 + (z - 3)^2 = 25$ và mặt phẳng $(P): 2x - 2y + z + 1 = 0$. Xét tính Đúng / Sai của các mệnh đề sau:',
            subQuestions: [
              { key: 'a', text: 'Tâm của mặt cầu $(S)$ có tọa độ là $I(1; -2; 3)$.', correct: true },
              { key: 'b', text: 'Bán kính của mặt cầu $(S)$ bằng $R = 25$.', correct: false },
              { key: 'c', text: 'Khoảng cách từ tâm I đến mặt phẳng $(P)$ bằng $d(I, (P)) = \\frac{|2(1) - 2(-2) + 3 + 1|}{\\sqrt{2^2 + (-2)^2 + 1^2}} = \\frac{10}{3} < 5$.', correct: true },
              { key: 'd', text: 'Mặt phẳng $(P)$ cắt mặt cầu $(S)$ theo một đường tròn có bán kính $r = \\frac{\\sqrt{125}}{3}$.', correct: true }
            ],
            explanation: 'Bán kính $R = \\sqrt{25} = 5$ (ý b sai). Bán kính đường tròn giao tuyến $r = \\sqrt{R^2 - d^2} = \\sqrt{25 - (100/9)} = \\sqrt{125}/3$ (ý d đúng).',
            points: 3.0
          },
          // PHẦN III: Trả lời ngắn / Điền kết quả
          {
            questionNumber: 4,
            type: 'fill_blank',
            prompt: 'PHẦN III - Điền kết quả: Một người gửi 100 triệu đồng vào ngân hàng với lãi suất 6% mỗi năm theo hình thức lãi kép. Hỏi sau 3 năm, số tiền lãi người đó nhận được là bao nhiêu triệu đồng? (Làm tròn đến 2 chữ số thập phân, ví dụ: 19.10)',
            acceptableAnswers: ['19.1', '19.10', '19,1', '19,10'],
            explanation: 'Tổng tiền nhận được: $A = 100 \\times (1 + 0.06)^3 = 100 \\times 1.191016 = 119.1016$ triệu đồng. Tiền lãi: $119.1016 - 100 \\approx 19.10$ triệu đồng.',
            points: 2.0
          },
          // PHẦN IV: Tự luận chuyên sâu
          {
            questionNumber: 5,
            type: 'essay',
            prompt: 'PHẦN IV - Tự luận: Cho hình chóp $S.ABCD$ có đáy $ABCD$ là hình vuông cạnh $a$, cạnh bên $SA$ vuông góc với mặt phẳng đáy và $SA = a\\sqrt{3}$. Hãy tính góc giữa đường thẳng $SC$ và mặt phẳng đáy $(ABCD)$. Nêu rõ các bước xác định hình chiếu vuông góc.',
            sampleAnswer: 'Hình chiếu vuông góc của SC lên (ABCD) là AC. Góc cần tìm là góc SCA. Trong tam giác vuông SAC vuông tại A: AC = a√2, SA = a√3. tan(SCA) = SA / AC = a√3 / a√2 = √6 / 2. Góc SCA ≈ 50°46\'.',
            explanation: 'Xác định hình chiếu: $A$ là hình chiếu của $S$ lên $(ABCD)$, $C$ tự chiếu lên chính nó => $AC$ là hình chiếu của $SC$. Góc giữa $SC$ và đáy là $\\widehat{SCA}$.',
            points: 2.0
          }
        ]
      }
    ];

    // Seed into system
    for (const item of seededExamsData) {
      await createExamWithQuestions(item.exam, item.questions);
    }

    // Seed sample results for rich statistics
    seedSampleResults();
    localStorage.setItem('edutest_initial_seeded_done', 'true');
  } catch (err) {
    console.warn('Initial seeding note:', err);
  }
}

// Generate realistic mock results for classrooms and grades for instant rich stats
function seedSampleResults() {
  const existingResults = getLocalResults();
  if (existingResults.length >= 20) return;

  const mockStudents = [
    { name: 'Nguyễn Văn Minh', email: 'minh.nv@edutest.local', classId: '10A1', score: 9.5, correct: 4, wrong: 0 },
    { name: 'Trần Thị Thu Hà', email: 'ha.ttt@edutest.local', classId: '10A1', score: 8.5, correct: 3, wrong: 1 },
    { name: 'Lê Hoàng Long', email: 'long.lh@edutest.local', classId: '10A1', score: 7.0, correct: 3, wrong: 1 },
    { name: 'Phạm Quỳnh Anh', email: 'anh.pq@edutest.local', classId: '10A2', score: 6.5, correct: 2, wrong: 2 },
    { name: 'Đỗ Tuấn Kiệt', email: 'kiet.dt@edutest.local', classId: '10A2', score: 4.5, correct: 1, wrong: 3 },
    { name: 'Vũ Thảo Nguyên', email: 'nguyen.vt@edutest.local', classId: '11B1', score: 9.0, correct: 4, wrong: 0 },
    { name: 'Bùi Đức Anh', email: 'anh.bd@edutest.local', classId: '11B1', score: 8.0, correct: 3, wrong: 1 },
    { name: 'Hoàng Minh Châu', email: 'chau.hm@edutest.local', classId: '11B1', score: 7.5, correct: 3, wrong: 1 },
    { name: 'Ngô Gia Huy', email: 'huy.ng@edutest.local', classId: '12A3', score: 9.2, correct: 4, wrong: 1, tabViolations: 0 },
    { name: 'Đinh Phương Linh', email: 'linh.dp@edutest.local', classId: '12A3', score: 8.8, correct: 4, wrong: 1, tabViolations: 1 },
    { name: 'Tạ Quốc Bảo', email: 'bao.tq@edutest.local', classId: '12A3', score: 5.5, correct: 2, wrong: 2, tabViolations: 3 },
    { name: 'Phan Bảo Ngọc', email: 'ngoc.pb@edutest.local', classId: '9A1', score: 9.0, correct: 4, wrong: 0 },
    { name: 'Vương Đình Khang', email: 'khang.vd@edutest.local', classId: '9A1', score: 7.5, correct: 3, wrong: 1 },
    { name: 'Dương Hải Đăng', email: 'dang.dh@edutest.local', classId: '6A2', score: 8.5, correct: 3, wrong: 1 },
    { name: 'Trịnh Mai Phương', email: 'phuong.tm@edutest.local', classId: '5A1', score: 10.0, correct: 4, wrong: 0 }
  ];

  const resultsToSeed: ExamResult[] = mockStudents.map((s, idx) => ({
    id: `res_seed_${idx + 1}`,
    attemptId: `att_seed_${idx + 1}`,
    examId: 'exam_sample',
    studentId: `std_${idx + 1}`,
    studentName: s.name,
    studentEmail: s.email,
    classId: s.classId,
    score: s.score,
    maxScore: 10,
    correctCount: s.correct,
    wrongCount: s.wrong,
    unattemptedCount: 0,
    percentage: Math.round(s.score * 10),
    submittedAt: new Date(Date.now() - (idx * 3600 * 1000)).toISOString(),
    feedback: s.score >= 5 ? 'Đạt yêu cầu' : 'Cần cố gắng thêm',
    tabViolations: s.tabViolations || 0
  }));

  try {
    localStorage.setItem(STORAGE_RESULTS_KEY, JSON.stringify(resultsToSeed));
  } catch (e) {
    console.warn('Seed results local note:', e);
  }
}

// ==================== BACKUP & RESTORE DATA ====================

export interface EduTestBackupPayload {
  version: string;
  exportedAt: string;
  source: string;
  data: {
    exams: Exam[];
    questions: Record<string, Question[]>;
    results: ExamResult[];
    classes: SchoolClass[];
    subjects: Subject[];
    users: UserProfile[];
  };
}

export async function exportBackupData(): Promise<EduTestBackupPayload> {
  const exams = await getExams();
  const classes = await getClasses();
  const subjects = await getSubjects();
  const results = await getAllResults();
  const users = await getAllUsers();

  const questionsMap: Record<string, Question[]> = {};
  for (const ex of exams) {
    try {
      const qList = await getExamQuestions(ex.id);
      if (qList && qList.length > 0) {
        questionsMap[ex.id] = qList;
      }
    } catch {
      // skip individual error
    }
  }

  return {
    version: '2.0.0',
    exportedAt: new Date().toISOString(),
    source: 'EduTest Online Examination System',
    data: {
      exams,
      questions: questionsMap,
      results,
      classes,
      subjects,
      users
    }
  };
}

export async function restoreBackupData(payload: EduTestBackupPayload): Promise<{
  success: boolean;
  message: string;
  stats: {
    examsCount: number;
    questionsCount: number;
    resultsCount: number;
    classesCount: number;
    subjectsCount: number;
    usersCount: number;
  };
}> {
  if (!payload || !payload.data) {
    throw new Error('Định dạng tệp sao lưu không hợp lệ. Thiếu trường "data".');
  }

  const { exams = [], questions = {}, results = [], classes = [], subjects = [], users = [] } = payload.data;

  // 1. Restore Classes
  if (classes.length > 0) {
    const currentClasses = getLocalClasses();
    const classMap = new Map<string, SchoolClass>();
    currentClasses.forEach(c => classMap.set(c.id, c));
    classes.forEach(c => classMap.set(c.id, c));
    saveLocalClasses(Array.from(classMap.values()));

    for (const c of classes) {
      try {
        await setDoc(doc(db, 'classes', c.id), sanitizeForFirestore(c), { merge: true });
      } catch (e) {
        // ignore individual
      }
    }
  }

  // 2. Restore Subjects
  if (subjects.length > 0) {
    const currentSubs = getLocalSubjects();
    const subMap = new Map<string, Subject>();
    currentSubs.forEach(s => subMap.set(s.id, s));
    subjects.forEach(s => subMap.set(s.id, s));
    saveLocalSubjects(Array.from(subMap.values()));

    for (const s of subjects) {
      try {
        await setDoc(doc(db, 'subjects', s.id), sanitizeForFirestore(s), { merge: true });
      } catch (e) {
        // ignore
      }
    }
  }

  // 3. Restore Users
  if (users.length > 0) {
    const currentUsers = getLocalUsers();
    const uMap = new Map<string, UserProfile>();
    currentUsers.forEach(u => uMap.set(u.id, u));
    users.forEach(u => uMap.set(u.id, u));
    saveLocalUsers(Array.from(uMap.values()));

    for (const u of users) {
      try {
        await setDoc(doc(db, 'users', u.id), sanitizeForFirestore(u), { merge: true });
      } catch (e) {
        // ignore
      }
    }
  }

  // 4. Restore Exams & Questions
  let totalQuestionsCount = 0;
  if (exams.length > 0) {
    const currentExams = getLocalExams();
    const examMap = new Map<string, Exam>();
    currentExams.forEach(e => examMap.set(e.id, e));
    exams.forEach(e => examMap.set(e.id, e));
    saveLocalExams(Array.from(examMap.values()));

    for (const ex of exams) {
      try {
        await setDoc(doc(db, 'exams', ex.id), sanitizeForFirestore(ex), { merge: true });
      } catch (e) {
        // ignore
      }
    }

    // Questions
    const questionsObj = questions || {};
    const localQMap = getLocalQuestionsMap();
    for (const [examId, qList] of Object.entries(questionsObj)) {
      if (Array.isArray(qList) && qList.length > 0) {
        localQMap[examId] = qList;
        totalQuestionsCount += qList.length;

        try {
          const batch = writeBatch(db);
          qList.forEach(q => {
            const qRef = doc(db, `exams/${examId}/questions`, q.id);
            batch.set(qRef, sanitizeForFirestore(q));
          });
          await batch.commit();
        } catch (e) {
          // ignore
        }
      }
    }
    try {
      localStorage.setItem(STORAGE_QUESTIONS_KEY, JSON.stringify(localQMap));
    } catch {
      // ignore
    }
  }

  // 5. Restore Results
  if (results.length > 0) {
    const currentResults = getLocalResults();
    const resMap = new Map<string, ExamResult>();
    currentResults.forEach(r => resMap.set(r.id, r));
    results.forEach(r => resMap.set(r.id, r));
    const mergedResults = Array.from(resMap.values());
    try {
      localStorage.setItem(STORAGE_RESULTS_KEY, JSON.stringify(mergedResults));
    } catch {
      // ignore
    }

    for (const r of results) {
      try {
        await setDoc(doc(db, 'results', r.id), sanitizeForFirestore(r), { merge: true });
      } catch (e) {
        // ignore
      }
    }
  }

  return {
    success: true,
    message: 'Khôi phục toàn bộ cơ sở dữ liệu thành công!',
    stats: {
      examsCount: exams.length,
      questionsCount: totalQuestionsCount,
      resultsCount: results.length,
      classesCount: classes.length,
      subjectsCount: subjects.length,
      usersCount: users.length
    }
  };
}
