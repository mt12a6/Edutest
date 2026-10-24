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
  evaluateTrueFalseQuestion 
} from '../utils/grading';

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

function saveLocalResult(result: ExamResult) {
  try {
    const current = getLocalResults();
    const updated = [result, ...current.filter(r => r.id !== result.id)];
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
      id: 'u_mt12a6',
      username: 'mt12a6',
      email: 'mt12a6@gmail.com',
      password: '123456',
      displayName: 'Admin Trương (mt12a6)',
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
      id: 'u_hs006',
      username: 'hs006',
      email: 'hs006@edutest.edu.vn',
      password: '123456',
      displayName: 'Học sinh HS006',
      role: 'student',
      status: 'active',
      className: '10A1',
      classIds: ['10A1'],
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
    getDefaultUsers().forEach(u => {
      if (!deletedIds.includes(u.id)) mergedMap.set(u.id, u);
    });
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

export async function batchDeleteUserProfiles(userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const userSet = new Set(userIds);
  userIds.forEach(id => addDeletedUserId(id));
  
  const currentLocal = getLocalUsers().filter(u => !userSet.has(u.id));
  saveLocalUsers(currentLocal);

  try {
    const batch = writeBatch(db);
    for (const id of userIds) {
      batch.delete(doc(db, 'users', id));
    }
    await batch.commit();
  } catch (err) {
    console.warn('batchDeleteUserProfiles Firestore note:', err);
  }
}

export async function batchAssignClass(userIds: string[], newClass: string): Promise<void> {
  if (userIds.length === 0) return;
  const userSet = new Set(userIds);
  const currentLocal = getLocalUsers().map(u => {
    if (userSet.has(u.id)) {
      return { ...u, className: newClass, classIds: [newClass], updatedAt: new Date().toISOString() };
    }
    return u;
  });
  saveLocalUsers(currentLocal);

  try {
    const batch = writeBatch(db);
    for (const id of userIds) {
      const userRef = doc(db, 'users', id);
      batch.set(userRef, { className: newClass, classIds: [newClass], updatedAt: new Date().toISOString() }, { merge: true });
    }
    await batch.commit();
  } catch (err) {
    console.warn('batchAssignClass Firestore note:', err);
  }
}

export async function syncAllUsersToFirestore(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const localUsers = getLocalUsers();
    if (localUsers.length === 0) return { success: true, count: 0 };
    
    // Firestore batch limit is 500 operations per commit
    const chunkSize = 400;
    let totalPushed = 0;
    for (let i = 0; i < localUsers.length; i += chunkSize) {
      const chunk = localUsers.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const u of chunk) {
        const ref = doc(db, 'users', u.id);
        batch.set(ref, sanitizeForFirestore(u), { merge: true });
      }
      await batch.commit();
      totalPushed += chunk.length;
    }
    return { success: true, count: totalPushed };
  } catch (err: any) {
    console.error('Lỗi đồng bộ tài khoản lên Firestore:', err);
    return { success: false, count: 0, error: err?.message || 'Không thể kết nối Firestore' };
  }
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

export async function loginWithUsernamePassword(identifier: string, password: string): Promise<UserProfile | null> {
  const clean = identifier.trim().toLowerCase();
  const inputPass = password.trim();
  
  // 1. Check local users first (which includes seeded default accounts)
  let localList = getLocalUsers();
  if (localList.length === 0) {
    localList = getDefaultUsers();
    saveLocalUsers(localList);
  }

  for (const u of localList) {
    const matchId = (u.username && u.username.trim().toLowerCase() === clean) ||
                    (u.email && u.email.trim().toLowerCase() === clean) ||
                    (u.email && u.email.trim().toLowerCase().split('@')[0] === clean);
    if (matchId) {
      const uPass = (u.password ? u.password.trim() : '123456');
      if (uPass === inputPass || (!u.password && inputPass === '123456')) {
        return u;
      }
    }
  }

  // 2. Also check default hardcoded accounts as safe fallback
  for (const def of getDefaultUsers()) {
    const matchDef = (def.username && def.username.trim().toLowerCase() === clean) || 
                     (def.email && def.email.trim().toLowerCase() === clean) ||
                     (def.email && def.email.trim().toLowerCase().split('@')[0] === clean);
    if (matchDef && (def.password === inputPass || (!def.password && inputPass === '123456'))) {
      return def;
    }
  }

  // 3. Query Firestore for real-time created accounts (incognito / remote student devices)
  try {
    const snap = await getDocs(collection(db, 'users'));
    for (const d of snap.docs) {
      const data = d.data() as UserProfile;
      const matchIdentifier = (data.username && data.username.trim().toLowerCase() === clean) ||
                              (data.email && data.email.trim().toLowerCase() === clean) ||
                              (data.email && data.email.trim().toLowerCase().split('@')[0] === clean);
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
    return null;
  } catch (err) {
    console.error('Lỗi kiểm tra đăng nhập tài khoản:', err);
    return null;
  }
}


// ==================== CLASSES ====================

export async function getClasses(): Promise<SchoolClass[]> {
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

    const result = Array.from(map.values()).filter(c => !deletedIds.includes(c.id));
    saveLocalClasses(result);
    return result;
  } catch (err) {
    console.warn('Lấy danh sách lớp note:', err);
    if (localList.length > 0) {
      return localList.filter(c => !deletedIds.includes(c.id));
    }
    return getDefaultClasses().filter(c => !deletedIds.includes(c.id));
  }
}

export async function addClass(classData: Omit<SchoolClass, 'id'>): Promise<string> {
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

export async function getSubjects(): Promise<Subject[]> {
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

    const result = Array.from(map.values()).filter(s => !deletedIds.includes(s.id) && !deletedIds.includes(s.code));
    saveLocalSubjects(result);
    return result;
  } catch (err) {
    console.warn('Lấy môn học note:', err);
    if (localList.length > 0) {
      return localList.filter(s => !deletedIds.includes(s.id) && !deletedIds.includes(s.code));
    }
    return getDefaultSubjects().filter(s => !deletedIds.includes(s.id) && !deletedIds.includes(s.code));
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

export const TARGET_TINHOC_EXAM_TITLES = [
  'THI THỬ GIỮA KỲ 1 - TIN HỌC 9',
  'THI THỬ GIỮA KỲ 1 - TIN HỌC 8',
  'THI THỬ GIỮA KỲ 1 - TIN HỌC 7',
  'THI THỬ GIỮA KỲ 1 - TIN HỌC 6'
];

export async function getExams(): Promise<Exam[]> {
  const collectionPath = 'exams';
  const localExams = getLocalExams();
  const deletedIds = getDeletedExamIds();
  try {
    const snap = await getDocs(collection(db, collectionPath));
    const firestoreExams = snap.docs.map(d => ({ ...d.data(), id: d.id } as Exam));
    
    // Merge local and firestore exams
    const mergedMap = new Map<string, Exam>();
    localExams.forEach(e => mergedMap.set(e.id, e));
    firestoreExams.forEach(e => mergedMap.set(e.id, e));
    const dummyClasses = ['6A1', '7A1', '8A1', 'c_6a', 'c_7a', 'c_8a'];
    const list = Array.from(mergedMap.values())
      .filter(e => !deletedIds.includes(e.id))
      .filter(e => {
        const t = (e.title || '').trim().toUpperCase();
        if (TARGET_TINHOC_EXAM_TITLES.some(title => t === title || t.includes(title))) {
          return true;
        }
        if (e.createdBy && e.createdBy !== 'system_admin' && !e.title.includes('Môn Toán') && !e.title.includes('Khảo sát') && !e.title.includes('Tốt Nghiệp')) {
          return true;
        }
        return false;
      })
      .map(e => {
        if (!e.classIds || e.classIds.length === 0) return { ...e, classIds: [] };
        const filteredClasses = e.classIds.filter(c => !dummyClasses.includes(c));
        return {
          ...e,
          classIds: filteredClasses
        };
      });

    saveLocalExams(list);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.warn('Lấy danh sách đề thi từ Firestore thất bại, dùng bộ nhớ cục bộ:', err);
    const dummyClasses = ['6A1', '7A1', '8A1', 'c_6a', 'c_7a', 'c_8a'];
    return localExams
      .filter(e => !deletedIds.includes(e.id))
      .filter(e => {
        const t = (e.title || '').trim().toUpperCase();
        if (TARGET_TINHOC_EXAM_TITLES.some(title => t === title || t.includes(title))) {
          return true;
        }
        if (e.createdBy && e.createdBy !== 'system_admin' && !e.title.includes('Môn Toán') && !e.title.includes('Khảo sát') && !e.title.includes('Tốt Nghiệp')) {
          return true;
        }
        return false;
      })
      .map(e => ({
        ...e,
        classIds: (e.classIds || []).filter(c => !dummyClasses.includes(c))
      }));
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
        batch.set(qRef, sanitizeForFirestore(fq), { merge: true });
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn('updateExamWithQuestions Firestore warning (preserved in local storage):', err);
  }
}

export async function getExamQuestions(examId: string): Promise<Question[]> {
  // Check local questions cache first
  const localMap = getLocalQuestionsMap();
  if (localMap[examId] && localMap[examId].length > 0) {
    return localMap[examId];
  }

  const path = `exams/${examId}/questions`;
  try {
    const snap = await getDocs(collection(db, path));
    const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Question));
    const sorted = list.sort((a, b) => a.questionNumber - b.questionNumber);
    if (sorted.length > 0) {
      saveLocalQuestions(examId, sorted);
    }
    return sorted;
  } catch (err) {
    console.warn('Lấy câu hỏi từ Firestore thất bại:', err);
    return localMap[examId] || [];
  }
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
  let correctCount = 0;
  let wrongCount = 0;
  let unattemptedCount = 0;
  let earnedPoints = 0;
  let totalPoints = 0;

  questions.forEach(q => {
    const qWeight = q.points || 1;
    totalPoints += qWeight;
    const studentAns = answers[q.id];

    if (studentAns === undefined || studentAns === null || studentAns === '') {
      unattemptedCount++;
      return;
    }

    const qType = q.type || 'multiple_choice';

    if (qType === 'multiple_choice') {
      const isCorrect = isMultipleChoiceCorrect(studentAns, q.correctOption, q.options);
      if (isCorrect) {
        correctCount++;
        earnedPoints += qWeight;
      } else {
        wrongCount++;
      }
    } else if (qType === 'true_false') {
      const { subMatches, totalSubs, ratio, earnedPoints: tfEarned } = evaluateTrueFalseQuestion(studentAns, q.subQuestions, qWeight);
      earnedPoints += tfEarned;

      if (subMatches === totalSubs && totalSubs > 0) {
        correctCount++;
      } else if (subMatches > 0) {
        correctCount += ratio;
        wrongCount += (1 - ratio);
      } else {
        wrongCount++;
      }
    } else if (qType === 'fill_blank') {
      const isCorrect = isFillBlankCorrect(studentAns, q.acceptableAnswers, q.correctOption, q.sampleAnswer);
      if (isCorrect) {
        correctCount++;
        earnedPoints += qWeight;
      } else {
        wrongCount++;
      }
    } else if (qType === 'essay') {
      if (String(studentAns).trim().length > 0) {
        // Essay is submitted, pending grading by teacher or AI
      } else {
        unattemptedCount++;
      }
    }
  });

  const hasEssayQuestions = questions.some(q => q.type === 'essay');
  const maxScale = exam.maxScore || 10;
  const finalScore = totalPoints > 0 
    ? Number(((earnedPoints / totalPoints) * maxScale).toFixed(2)) 
    : 0;
  const percentage = totalPoints > 0 
    ? Math.min(100, Math.round((earnedPoints / totalPoints) * 100)) 
    : 0;

  const nowStr = new Date().toISOString();

  const result: ExamResult = {
    id: attemptId,
    attemptId,
    examId: exam.id,
    studentId: student.id,
    studentName: student.displayName,
    studentEmail: student.email,
    classId: student.classIds?.[0] || '10A1',
    score: finalScore,
    maxScore: maxScale,
    correctCount: Math.round(correctCount),
    wrongCount: Math.round(wrongCount),
    unattemptedCount,
    percentage,
    submittedAt: nowStr,
    feedback: hasEssayQuestions 
      ? 'Bài thi có câu tự luận, đang chờ giáo viên hoặc AI chấm điểm.'
      : (finalScore >= (exam.passScore || 5) ? 'Đạt yêu cầu' : 'Chưa đạt yêu cầu'),
    tabViolations,
    status: hasEssayQuestions ? 'pending_essay_grading' : 'completed',
    hasEssay: hasEssayQuestions,
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
            score: finalScore,
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
      score: finalScore,
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
  graderName: string = 'Giáo viên'
): Promise<ExamResult | null> {
  const allResults = getLocalResults();
  const targetResult = allResults.find(r => r.attemptId === attemptId || r.id === attemptId);
  if (!targetResult) return null;

  const exam = await getExamById(targetResult.examId);
  const questions = await getExamQuestions(targetResult.examId);

  const maxScale = targetResult.maxScore || 10;
  let totalPoints = 0;
  questions.forEach(q => {
    totalPoints += (q.points || 1);
  });

  const essayScaledPoints = totalPoints > 0 ? (essayScore / totalPoints) * maxScale : essayScore;
  const updatedScore = Math.min(maxScale, Number((targetResult.score + essayScaledPoints).toFixed(2)));
  const percentage = Math.min(100, Math.round((updatedScore / maxScale) * 100));

  const updated: ExamResult = {
    ...targetResult,
    score: updatedScore,
    percentage,
    status: 'completed',
    hasEssay: true,
    essayScore,
    essayFeedback,
    isAiGraded,
    essayGradedBy: graderName,
    essayGradedAt: new Date().toISOString(),
    feedback: updatedScore >= (exam?.passScore || 5) ? 'Đạt yêu cầu' : 'Chưa đạt yêu cầu'
  };

  saveLocalResult(updated);

  try {
    await updateDoc(doc(db, 'results', attemptId), sanitizeForFirestore(updated));
    await updateDoc(doc(db, 'attempts', attemptId), sanitizeForFirestore({
      score: updatedScore,
      essayScore,
      essayFeedback,
      isAiGraded
    }));
  } catch (err) {
    console.warn('gradeEssaySubmission Firestore warning:', err);
  }

  return updated;
}

export async function getAllResults(): Promise<ExamResult[]> {
  const local = getLocalResults();
  try {
    const snap = await getDocs(collection(db, 'results'));
    const firestoreResults = snap.docs.map(d => ({ ...d.data(), id: d.id } as ExamResult));
    const mergedMap = new Map<string, ExamResult>();
    local.forEach(r => mergedMap.set(r.id, r));
    firestoreResults.forEach(r => mergedMap.set(r.id, r));
    return Array.from(mergedMap.values());
  } catch {
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
  try {
    // Explicitly delete class 6A1 data per user request
    addDeletedClassId('c_6a');
    addDeletedClassId('6A1');
    const existingClasses = getLocalClasses().filter(c => c.name !== '6A1' && c.id !== 'c_6a' && c.id !== '6A1');
    saveLocalClasses(existingClasses);

    // Auto-sync all local users to Firestore in the background
    try {
      syncAllUsersToFirestore();
    } catch {
      // non-blocking
    }

    // Always ensure demo accounts exist in Firestore if not deleted
    const deletedUserIds = getDeletedUserIds();
    for (const defUser of getDefaultUsers()) {
      if (!deletedUserIds.includes(defUser.id)) {
        try {
          await setDoc(doc(db, 'users', defUser.id), sanitizeForFirestore(defUser), { merge: true });
        } catch (e) {
          // non-blocking
        }
      }
    }

    // Purge old mock exams and re-seed ONLY the 4 requested Tin Học exams
    const PURGE_EXAMS_KEY = 'edutest_tinhoc_only_v6';
    if (localStorage.getItem(PURGE_EXAMS_KEY) !== 'true') {
      saveLocalExams([]);
      localStorage.removeItem('edutest_initial_seeded_done');
      localStorage.setItem(PURGE_EXAMS_KEY, 'true');
    }

    const hasSeeded = localStorage.getItem('edutest_initial_seeded_done');
    if (hasSeeded === 'true') {
      return;
    }

    // Seed ONLY the 4 requested Tin Học exams: 6, 7, 8, 9
    const seededExamsData: Array<{
      exam: Omit<Exam, 'id' | 'createdAt' | 'updatedAt' | 'questionCount'>;
      questions: Array<Omit<Question, 'id' | 'examId'>>;
    }> = [
      // ================= KHỐI 6 =================
      {
        exam: {
          title: 'THI THỬ GIỮA KỲ 1 - TIN HỌC 6',
          subjectId: 'IT',
          subjectName: 'Tin học',
          grade: '6',
          durationMinutes: 45,
          passScore: 5,
          maxScore: 10,
          classIds: ['6A1', '6A2'],
          isPublished: true,
          shuffleQuestions: true,
          shuffleOptions: true,
          showAnswersAfterExam: true,
          allowReview: true,
          createdBy: 'system_admin',
          createdByName: 'Thầy Trương - GV Tin Học'
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

      // ================= KHỐI 7 =================
      {
        exam: {
          title: 'THI THỬ GIỮA KỲ 1 - TIN HỌC 7',
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
          createdByName: 'Thầy Trương - GV Tin Học'
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

      // ================= KHỐI 8 =================
      {
        exam: {
          title: 'THI THỬ GIỮA KỲ 1 - TIN HỌC 8',
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
          createdByName: 'Thầy Trương - GV Tin Học'
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

      // ================= KHỐI 9 =================
      {
        exam: {
          title: 'THI THỬ GIỮA KỲ 1 - TIN HỌC 9',
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
          createdByName: 'Thầy Trương - GV Tin Học'
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
      }
    ];

    // Seed into system
    for (const item of seededExamsData) {
      await createExamWithQuestions(item.exam, item.questions);
    }

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
