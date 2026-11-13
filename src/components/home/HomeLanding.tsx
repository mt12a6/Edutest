import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, 
  Clock, 
  Users, 
  GraduationCap, 
  Search, 
  KeyRound, 
  Play, 
  Pin, 
  Settings2, 
  List, 
  Table as TableIcon, 
  LayoutGrid, 
  ArrowUpDown, 
  Filter, 
  Sparkles, 
  ShieldCheck, 
  AlertCircle,
  ChevronRight,
  Layers,
  CheckCircle2,
  Lock
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { 
  Exam, 
  Question, 
  SchoolClass, 
  Subject, 
  HomepageSettings, 
  DEFAULT_HOMEPAGE_SETTINGS,
  ExamDisplayMode 
} from '../../types';
import { 
  getExamQuestions, 
  togglePinExam, 
  startOrCreateAttempt,
  getHomepageSettings,
  saveHomepageSettings
} from '../../services/db';
import { ConfirmModal } from '../common/ConfirmModal';
import { ShareExamModal } from '../common/ShareExamModal';
import { SecureExamStudentSelectModal } from '../common/SecureExamStudentSelectModal';
import { ExamCard } from './ExamCard';
import { PinnedExamsConfigModal } from './PinnedExamsConfigModal';

interface HomeLandingProps {
  exams: Exam[];
  classes: SchoolClass[];
  subjects: Subject[];
  onNavigateTab: (tab: string) => void;
  onOpenWordUpload: () => void;
  onSelectExamToTake?: (exam: Exam, questions: Question[]) => void;
  onEditExam?: (exam: Exam) => void;
  onDeleteExam?: (exam: Exam) => void;
  onRefreshExams?: () => void;
  onDirectStartExam?: (exam: Exam, questions: Question[], attempt: any) => void;
}

// Helper to extract numeric grade for ascending sorting (6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12)
export const parseGradeNumber = (gradeStr?: string | number): number => {
  if (gradeStr === undefined || gradeStr === null) return 999;
  const num = parseInt(String(gradeStr).replace(/\D/g, ''), 10);
  return isNaN(num) ? 999 : num;
};

export const HomeLanding: React.FC<HomeLandingProps> = ({
  exams,
  classes,
  subjects,
  onNavigateTab,
  onOpenWordUpload,
  onSelectExamToTake,
  onEditExam,
  onDeleteExam,
  onRefreshExams,
  onDirectStartExam
}) => {
  const { user, profile, isTeacher, isAdmin } = useAuth();

  // Free trial / exam code input state
  const [examCodeInput, setExamCodeInput] = useState<string>('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [loadingExamId, setLoadingExamId] = useState<string | null>(null);

  // Modals & Action Targets
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);
  const [shareExamTarget, setShareExamTarget] = useState<Exam | null>(null);
  const [secureExamForRoster, setSecureExamForRoster] = useState<Exam | null>(null);
  const [pinActionSuccess, setPinActionSuccess] = useState<string | null>(null);
  const [showPinConfigModal, setShowPinConfigModal] = useState(false);

  // Homepage Settings from Firestore (siteSettings/homepage)
  const [homepageSettings, setHomepageSettings] = useState<HomepageSettings>(DEFAULT_HOMEPAGE_SETTINGS);

  // Display Mode ('list' | 'table' | 'grid') with localStorage persistence
  const [displayMode, setDisplayMode] = useState<ExamDisplayMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('edutest_display_mode');
      if (saved === 'table' || saved === 'grid' || saved === 'list') {
        return saved;
      }
    }
    return 'list'; // Default is single-line list
  });

  const handleSetDisplayMode = (mode: ExamDisplayMode) => {
    setDisplayMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('edutest_display_mode', mode);
    }
  };

  // Search & Filters for unpinned exams
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name_asc' | 'grade_asc' | 'subject_asc'>('newest');

  // Load Homepage Settings from DB
  useEffect(() => {
    getHomepageSettings().then(st => {
      setHomepageSettings(st);
    }).catch(err => {
      console.warn('Load homepage settings note:', err);
    });

    const handleSettingsUpdated = (e: any) => {
      if (e.detail) {
        setHomepageSettings(e.detail);
      }
    };
    window.addEventListener('edutest:homepage_settings_updated', handleSettingsUpdated);
    return () => window.removeEventListener('edutest:homepage_settings_updated', handleSettingsUpdated);
  }, []);

  // Check if current user is an authorized teacher or admin
  const isPrivilegedStaff = Boolean(
    isAdmin || 
    isTeacher || 
    profile?.role === 'admin' || 
    profile?.role === 'teacher'
  );

  // Determine if user can edit or delete a specific exam
  const canManageExam = (exam: Exam) => {
    if (!user) return false;
    if (isPrivilegedStaff) return true;
    if (exam.createdBy === user.uid || (profile && exam.createdByName === profile.displayName)) return true;
    return false;
  };

  // Determine if user can pin an exam
  const canPin = (exam: Exam): boolean => {
    return Boolean(isPrivilegedStaff || (user && exam.createdBy === user.uid));
  };

  // Quick Stats
  const totalExams = exams.length;
  const activeExams = exams.filter(e => e.isPublished).length;
  const totalClasses = classes.length;
  const estimatedStudents = classes.reduce((sum, c) => sum + (c.studentCount || 35), 0);

  // Available unique subjects across exams for filters
  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    subjects.forEach(s => set.add(s.name));
    exams.forEach(e => {
      if (e.subjectName) set.add(e.subjectName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [subjects, exams]);

  // =========================================================================
  // PINNED EXAMS CALCULATION (Strict adherence to Firestore HomepageSettings)
  // =========================================================================
  const { pinnedExams, pinnedExamIdSet } = useMemo(() => {
    if (!homepageSettings.pinnedEnabled) {
      return { pinnedExams: [], pinnedExamIdSet: new Set<string>() };
    }

    // 1. Candidate pool: exams explicitly selected in pinnedExamIds OR marked isPinned === true
    const explicitIds = new Set(homepageSettings.pinnedExamIds || []);
    let candidates = exams.filter(e => {
      // Must be pinned explicitly or via isPinned flag
      const isMarked = explicitIds.has(e.id) || Boolean(e.isPinned);
      if (!isMarked) return false;

      // Published check
      if (homepageSettings.publishedOnly && !e.isPublished && !canManageExam(e)) {
        return false;
      }

      // Hide expired check
      if (homepageSettings.hideExpired && e.closeTime) {
        const isExpired = new Date(e.closeTime).getTime() < Date.now();
        if (isExpired) return false;
      }

      // Subject filter check if pinnedSubjectIds is set
      if (homepageSettings.pinnedSubjectIds && homepageSettings.pinnedSubjectIds.length > 0) {
        if (!homepageSettings.pinnedSubjectIds.includes(e.subjectName || '')) {
          return false;
        }
      }

      return true;
    });

    // 2. Limit number of unique subjects to maxPinnedSubjects
    if (homepageSettings.maxPinnedSubjects > 0) {
      const allowedSubjectSet = new Set<string>();
      candidates = candidates.filter(e => {
        const sName = e.subjectName || 'Chung';
        if (allowedSubjectSet.has(sName)) return true;
        if (allowedSubjectSet.size < homepageSettings.maxPinnedSubjects) {
          allowedSubjectSet.add(sName);
          return true;
        }
        return false;
      });
    }

    // 3. Sort candidates according to pinnedOrder, or ascending grade (THCS 6-9 -> THPT 10-12)
    const orderMap = new Map<string, number>();
    (homepageSettings.pinnedOrder || []).forEach((id, idx) => orderMap.set(id, idx));

    candidates.sort((a, b) => {
      const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 9999;
      const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 9999;
      if (idxA !== idxB) return idxA - idxB;

      // Fallback: Grade ascending 6, 7, 8, 9, 10, 11, 12
      const gA = parseGradeNumber(a.grade);
      const gB = parseGradeNumber(b.grade);
      if (gA !== gB) return gA - gB;

      return (a.subjectName || '').localeCompare(b.subjectName || '', 'vi');
    });

    // 4. Cap to maxPinnedExams
    const capped = candidates.slice(0, homepageSettings.maxPinnedExams || 4);
    const idSet = new Set<string>(capped.map(e => e.id));

    return { pinnedExams: capped, pinnedExamIdSet: idSet };
  }, [exams, homepageSettings, canManageExam]);

  // Group pinned exams by Subject to display parallel 2 columns when 2 subjects are pinned (e.g. Toán and Tin học)
  const pinnedBySubject = useMemo(() => {
    const map = new Map<string, Exam[]>();
    pinnedExams.forEach(e => {
      const subj = e.subjectName || 'Khác';
      if (!map.has(subj)) map.set(subj, []);
      map.get(subj)!.push(e);
    });
    return Array.from(map.entries()).map(([subjectName, examList]) => ({
      subjectName,
      exams: examList
    }));
  }, [pinnedExams]);

  // =========================================================================
  // UNPINNED CATALOG EXAMS (Excluded pinned exams to avoid duplication)
  // =========================================================================
  const unpinnedExams = useMemo(() => {
    return exams.filter(e => {
      // Exclude pinned exams if excludePinnedFromList is true
      if (homepageSettings.excludePinnedFromList && pinnedExamIdSet.has(e.id)) {
        return false;
      }

      // Guest / Student: only show published exams
      if (!e.isPublished && !canManageExam(e)) return false;

      // Grade filter
      if (selectedGradeFilter !== 'all' && e.grade !== selectedGradeFilter) return false;

      // Subject filter
      if (selectedSubjectFilter !== 'all' && (e.subjectName || '') !== selectedSubjectFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = e.title.toLowerCase().includes(q);
        const matchCode = (e.trialCode || e.examCode || '').toLowerCase().includes(q);
        const matchSubj = (e.subjectName || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCode && !matchSubj) return false;
      }

      return true;
    });
  }, [
    exams, 
    pinnedExamIdSet, 
    homepageSettings.excludePinnedFromList, 
    canManageExam, 
    selectedGradeFilter, 
    selectedSubjectFilter, 
    searchQuery
  ]);

  // Sort unpinned exams according to user selection
  const sortedUnpinnedExams = useMemo(() => {
    const list = [...unpinnedExams];
    switch (sortBy) {
      case 'newest':
        return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      case 'oldest':
        return list.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      case 'name_asc':
        return list.sort((a, b) => a.title.localeCompare(b.title, 'vi'));
      case 'grade_asc':
        return list.sort((a, b) => {
          const gA = parseGradeNumber(a.grade);
          const gB = parseGradeNumber(b.grade);
          return gA - gB;
        });
      case 'subject_asc':
        return list.sort((a, b) => (a.subjectName || '').localeCompare(b.subjectName || '', 'vi'));
      default:
        return list;
    }
  }, [unpinnedExams, sortBy]);

  // Group unpinned exams by Grade (KHỐI 6, 7, 8, 9, 10, 11, 12) and Subject
  // Rule: Do NOT create empty groups! Only groups with actual exams are rendered.
  const groupedCatalog = useMemo(() => {
    // If a specific grade is selected or searching, return single flat group or grade groups
    const gradeMap = new Map<string, Exam[]>();

    sortedUnpinnedExams.forEach(exam => {
      const g = exam.grade ? `Khối ${exam.grade}` : 'Khác';
      if (!gradeMap.has(g)) {
        gradeMap.set(g, []);
      }
      gradeMap.get(g)!.push(exam);
    });

    // Sort grade groups numerically (Khối 6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12)
    const sortedGroups = Array.from(gradeMap.entries()).sort(([gA], [gB]) => {
      const nA = parseGradeNumber(gA);
      const nB = parseGradeNumber(gB);
      return nA - nB;
    });

    return sortedGroups.map(([groupName, groupExams]) => {
      // Further group by Subject within this grade
      const subjectMap = new Map<string, Exam[]>();
      groupExams.forEach(ex => {
        const s = ex.subjectName || 'Chung';
        if (!subjectMap.has(s)) subjectMap.set(s, []);
        subjectMap.get(s)!.push(ex);
      });

      return {
        groupName,
        totalExams: groupExams.length,
        exams: groupExams,
        subjects: Array.from(subjectMap.entries()).map(([subjName, sExams]) => ({
          subjectName: subjName,
          exams: sExams
        }))
      };
    });
  }, [sortedUnpinnedExams]);

  // Handle pin toggle
  const handleTogglePin = async (exam: Exam, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const nextPin = !exam.isPinned;
      await togglePinExam(exam.id, nextPin);
      exam.isPinned = nextPin;

      // Also update homepageSettings pinnedExamIds to maintain sync
      const currentPinnedIds = homepageSettings.pinnedExamIds || [];
      const updatedIds = nextPin
        ? Array.from(new Set([...currentPinnedIds, exam.id]))
        : currentPinnedIds.filter(id => id !== exam.id);

      await saveHomepageSettings({
        pinnedExamIds: updatedIds,
        pinnedOrder: updatedIds
      });

      setPinActionSuccess(`Đã ${nextPin ? 'ghim đề thi lên khu vực nổi bật' : 'bỏ ghim đề thi'}: "${exam.title}"`);
      if (onRefreshExams) onRefreshExams();
      setTimeout(() => setPinActionSuccess(null), 3000);
    } catch (err) {
      console.error('Lỗi khi ghim đề thi:', err);
    }
  };

  // Handle entering exam code or trial code
  const handleEnterExamCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError(null);
    const code = examCodeInput.trim().toUpperCase();
    if (!code) {
      setCodeError('Vui lòng nhập mã đề thi.');
      return;
    }

    const matched = exams.find(ex => {
      const exCode = (ex.trialCode || '').toUpperCase();
      const examCode = (ex.examCode || '').toUpperCase();
      const exId = ex.id.toUpperCase();
      const exTitle = ex.title.toUpperCase();
      return exCode === code || examCode === code || exId === code || exTitle.includes(code);
    });

    if (!matched) {
      setCodeError(`Không tìm thấy đề thi với mã "${code}". Vui lòng thử các mã như TOAN6, THITHU-01 hoặc chọn từ danh sách.`);
      return;
    }

    // If it's a secure semester exam and user is guest -> Open Student Roster Picker
    if (matched.isSecure && !user) {
      setSecureExamForRoster(matched);
      return;
    }

    handleTakeExam(matched);
  };

  // Launch exam taking
  const handleTakeExam = async (exam: Exam) => {
    if (exam.isSecure && !user) {
      setSecureExamForRoster(exam);
      return;
    }

    if (onSelectExamToTake) {
      setLoadingExamId(exam.id);
      try {
        const qList = await getExamQuestions(exam.id);
        onSelectExamToTake(exam, qList);
      } catch (err) {
        console.error('Lỗi tải câu hỏi đề thi:', err);
      } finally {
        setLoadingExamId(null);
      }
    }
  };

  // Handle student selected from secure roster modal
  const handleStudentSelectedFromRoster = async (studentInfo: {
    id: string;
    displayName: string;
    email: string;
    classId: string;
    className: string;
  }) => {
    if (!secureExamForRoster) return;
    const targetExam = secureExamForRoster;
    setSecureExamForRoster(null);
    setLoadingExamId(targetExam.id);

    try {
      const qList = await getExamQuestions(targetExam.id);
      const studentProfile = {
        id: studentInfo.id,
        displayName: studentInfo.displayName,
        email: studentInfo.email,
        role: 'student' as const,
        status: 'active' as const,
        className: studentInfo.className,
        classIds: [studentInfo.classId],
        createdAt: new Date().toISOString()
      };

      const attempt = await startOrCreateAttempt(targetExam, studentProfile, qList.length);
      if (onDirectStartExam) {
        onDirectStartExam(targetExam, qList, attempt);
      } else if (onSelectExamToTake) {
        onSelectExamToTake(targetExam, qList);
      }
    } catch (err) {
      console.error('Lỗi khi vào phòng thi bảo mật:', err);
    } finally {
      setLoadingExamId(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 pb-12 animate-in fade-in duration-200 overflow-x-hidden">

      {/* ================================================================= */}
      {/* 2. BANNER CHÍNH (Nền xanh than #14243B & Teal #009F91, Tối giản, Chuyên nghiệp) */}
      {/* ================================================================= */}
      <div className="relative overflow-hidden rounded-2xl bg-[#14243B] text-white p-4 sm:p-5 lg:p-5.5 shadow-md border border-slate-800">
        {/* Subtle geometric light accent */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-5">
          {/* Left: Branding & Core Message */}
          <div className="space-y-1.5 max-w-xl min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[#009F91]/20 text-teal-300 border border-[#009F91]/30">
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                <span>EduTest PRO</span>
              </span>
              <span className="text-xs text-slate-400 hidden sm:inline">
                Khảo thí Trực tuyến THCS &amp; THPT
              </span>
            </div>

            <h1 className="text-lg sm:text-xl lg:text-2xl font-black tracking-tight text-white leading-tight break-words [overflow-wrap:anywhere]">
              HỆ THỐNG THI TRỰC TUYẾN THÔNG MINH
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed break-words [overflow-wrap:anywhere]">
              Nền tảng kiểm tra, đánh giá và luyện tập dành cho giáo viên và học sinh.
            </p>
          </div>

          {/* Right: Quick Exam Code Entry & Action */}
          <div className="flex flex-col items-stretch lg:items-end gap-2 shrink-0">
            <form onSubmit={handleEnterExamCode} className="w-full sm:w-80">
              <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-700 shadow-inner">
                <div className="relative flex-1 flex items-center min-w-0">
                  <KeyRound className="w-4 h-4 text-teal-400 absolute left-3 shrink-0" />
                  <input
                    type="text"
                    value={examCodeInput}
                    onChange={(e) => {
                      setExamCodeInput(e.target.value);
                      if (codeError) setCodeError(null);
                    }}
                    placeholder="Nhập mã đề (ví dụ: TOAN6)..."
                    className="w-full pl-9 pr-2 py-1.5 text-xs font-semibold text-white placeholder-slate-400 bg-transparent border-none focus:outline-none uppercase"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 min-h-[32px] bg-[#009F91] hover:bg-teal-600 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
                >
                  <Play className="w-3 h-3 fill-white shrink-0" />
                  <span>Vào thi</span>
                </button>
              </div>

              {codeError && (
                <div className="mt-1.5 p-2 bg-rose-500/20 border border-rose-400/40 rounded-lg text-xs text-rose-200 flex items-center gap-1.5 animate-in fade-in">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="break-words [overflow-wrap:anywhere] flex-1">{codeError}</span>
                </div>
              )}
            </form>

            {isPrivilegedStaff && (
              <div className="flex items-center gap-2 justify-end w-full">
                <button
                  type="button"
                  onClick={onOpenWordUpload}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>+ Soạn đề Word</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPinConfigModal(true)}
                  className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Settings2 className="w-3.5 h-3.5 text-teal-300" />
                  <span>Cấu hình ghim</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 4 Stats Cards integrated directly inside Banner with compact elegant layout */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 mt-3.5 border-t border-slate-800/80">
          <div className="bg-white/5 rounded-xl p-2.5 sm:p-3 border border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Đề thi</span>
              <p className="text-base sm:text-lg font-black text-white">{totalExams}</p>
            </div>
            <div className="w-7 h-7 rounded-lg bg-teal-500/10 flex items-center justify-center">
              <BookOpen className="w-3.5 h-3.5 text-teal-400" />
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-2.5 sm:p-3 border border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Lớp học</span>
              <p className="text-base sm:text-lg font-black text-emerald-400">{totalClasses}</p>
            </div>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-2.5 sm:p-3 border border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Kỳ thi</span>
              <p className="text-base sm:text-lg font-black text-amber-400">{activeExams}</p>
            </div>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-2.5 sm:p-3 border border-white/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Thí sinh</span>
              <p className="text-base sm:text-lg font-black text-cyan-400">~{estimatedStudents}</p>
            </div>
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Pin Action Toast Notification */}
      {pinActionSuccess && (
        <div className="p-3 bg-teal-50 border border-teal-200 text-teal-900 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <Pin className="w-4 h-4 text-teal-600 shrink-0 fill-teal-600" />
          <span className="font-bold">{pinActionSuccess}</span>
        </div>
      )}

      {/* ================================================================= */}
      {/* 3. KHU VỰC ĐỀ THI ĐƯỢC GHIM: "ĐỀ THI NỔI BẬT" */}
      {/* ================================================================= */}
      {homepageSettings.pinnedEnabled && (
        <section className="space-y-3">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center">
                <Pin className="w-3.5 h-3.5 fill-teal-600" />
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900">
                ĐỀ THI NỔI BẬT
              </h2>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                Ưu tiên
              </span>
              <span className="text-xs text-slate-400 hidden sm:inline">
                ({pinnedExams.length}/{homepageSettings.maxPinnedExams} đề)
              </span>
            </div>

            {/* Teacher / Admin: Quick config trigger */}
            {isPrivilegedStaff && (
              <button
                type="button"
                onClick={() => setShowPinConfigModal(true)}
                className="self-start sm:self-auto px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-teal-700 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-200"
              >
                <Settings2 className="w-3.5 h-3.5 text-teal-600" />
                <span>Cấu hình đề ghim</span>
              </button>
            )}
          </div>

          {/* Pinned Exams List */}
          {pinnedExams.length > 0 ? (
            pinnedBySubject.length === 2 ? (
              /* Two Distinct Parallel Columns on Desktop (1 Column on Mobile) */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pinnedBySubject.map((group) => (
                  <div 
                    key={group.subjectName} 
                    className="bg-slate-50/80 p-4 rounded-3xl border border-slate-200/90 space-y-3 shadow-2xs"
                  >
                    <div className="flex items-center justify-between px-1 border-b border-slate-200/70 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-teal-600 text-white font-black flex items-center justify-center text-xs shadow-xs">
                          {group.subjectName[0]?.toUpperCase()}
                        </div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                          Môn {group.subjectName}
                        </h3>
                      </div>
                      <span className="text-[11px] font-bold text-teal-800 bg-teal-100/80 px-2.5 py-0.5 rounded-full">
                        {group.exams.length} đề thi nổi bật
                      </span>
                    </div>

                    <div className="space-y-3">
                      {group.exams.map(exam => (
                        <ExamCard
                          key={`pinned-${exam.id}`}
                          exam={exam}
                          displayMode="grid"
                          isPinned={true}
                          canManage={canManageExam(exam)}
                          canPin={canPin(exam)}
                          isLoadingThis={loadingExamId === exam.id}
                          onTakeExam={handleTakeExam}
                          onShareExam={setShareExamTarget}
                          onTogglePin={handleTogglePin}
                          onEditExam={onEditExam}
                          onDeleteExam={setExamToDelete}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {pinnedExams.map(exam => (
                  <ExamCard
                    key={`pinned-${exam.id}`}
                    exam={exam}
                    displayMode="grid"
                    isPinned={true}
                    canManage={canManageExam(exam)}
                    canPin={canPin(exam)}
                    isLoadingThis={loadingExamId === exam.id}
                    onTakeExam={handleTakeExam}
                    onShareExam={setShareExamTarget}
                    onTogglePin={handleTogglePin}
                    onEditExam={onEditExam}
                    onDeleteExam={setExamToDelete}
                  />
                ))}
              </div>
            )
          ) : (
            isPrivilegedStaff ? (
              <div className="p-6 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-500 space-y-2">
                <Pin className="w-6 h-6 mx-auto text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">
                  Chưa có đề thi nổi bật nào được chọn.
                </p>
                <button
                  type="button"
                  onClick={() => setShowPinConfigModal(true)}
                  className="px-3.5 py-1.5 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>Chọn đề ghim ngay</span>
                </button>
              </div>
            ) : null
          )}
        </section>
      )}

      {/* ================================================================= */}
      {/* 4. KHU VỰC DANH MỤC ĐỀ THI VÀ KHẢO THÍ (PHÂN NHÓM KHỐI & MÔN) */}
      {/* ================================================================= */}
      <section className="space-y-4 pt-2">
        
        {/* Catalog Control Toolbar: Search, Filters, Sorters, Display Modes */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          
          {/* Top row: Title + Display Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <span>DANH MỤC ĐỀ THI VÀ KHẢO THÍ</span>
                <span className="text-xs font-bold text-slate-400">
                  ({unpinnedExams.length} đề)
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Luyện tập tự do hoặc tham gia kỳ thi học kỳ theo khối lớp được phân công
              </p>
            </div>

            {/* 3 Display Mode Buttons */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start sm:self-auto border border-slate-200/60">
              <button
                type="button"
                onClick={() => handleSetDisplayMode('list')}
                className={`p-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  displayMode === 'list'
                    ? 'bg-white text-teal-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Chế độ 1: Danh sách một dòng (Mặc định)"
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">Danh sách</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetDisplayMode('table')}
                className={`p-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  displayMode === 'table'
                    ? 'bg-white text-teal-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Chế độ 2: Dạng bảng"
              >
                <TableIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Bảng</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetDisplayMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  displayMode === 'grid'
                    ? 'bg-white text-teal-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Chế độ 3: Dạng thẻ lưới"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Lưới</span>
              </button>
            </div>
          </div>

          {/* Second row: Grade Pills Filter (Scrollable on mobile) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-400" />
              Khối:
            </span>
            <button
              type="button"
              onClick={() => setSelectedGradeFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedGradeFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả
            </button>
            {['6', '7', '8', '9', '10', '11', '12'].map(g => (
              <button
                key={`btn-grade-${g}`}
                type="button"
                onClick={() => setSelectedGradeFilter(g)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  selectedGradeFilter === g
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Khối {g}
              </button>
            ))}
          </div>

          {/* Third row: Search, Subject Dropdown, Sort Dropdown */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1 border-t border-slate-100">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm đề thi theo tên hoặc mã đề..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-500 focus:outline-none"
              />
            </div>

            {/* Subject Selector */}
            <select
              value={selectedSubjectFilter}
              onChange={(e) => setSelectedSubjectFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            >
              <option value="all">Tất cả môn học</option>
              {availableSubjects.map(s => (
                <option key={`opt-sub-${s}`} value={s}>{s}</option>
              ))}
            </select>

            {/* Sort Selector */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="py-1.5 pr-2 text-xs font-medium bg-transparent border-none focus:outline-none text-slate-700"
              >
                <option value="newest">Mới nhất</option>
                <option value="oldest">Cũ nhất</option>
                <option value="name_asc">Tên A–Z</option>
                <option value="grade_asc">Theo khối</option>
                <option value="subject_asc">Theo môn</option>
              </select>
            </div>
          </div>

        </div>

        {/* =============================================================== */}
        {/* CATALOG EXAMS RENDERING BY SELECTED DISPLAY MODE & GROUPS */}
        {/* =============================================================== */}

        {/* 1. TABLE MODE */}
        {displayMode === 'table' ? (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-3.5">Tên đề thi</th>
                    <th className="py-3 px-3">Môn học</th>
                    <th className="py-3 px-3">Khối</th>
                    <th className="py-3 px-3">Thời gian</th>
                    <th className="py-3 px-3">Số câu</th>
                    <th className="py-3 px-3">Trạng thái</th>
                    <th className="py-3 px-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedUnpinnedExams.map(exam => (
                    <ExamCard
                      key={`table-${exam.id}`}
                      exam={exam}
                      displayMode="table"
                      isPinned={false}
                      canManage={canManageExam(exam)}
                      canPin={canPin(exam)}
                      isLoadingThis={loadingExamId === exam.id}
                      onTakeExam={handleTakeExam}
                      onShareExam={setShareExamTarget}
                      onTogglePin={handleTogglePin}
                      onEditExam={onEditExam}
                      onDeleteExam={setExamToDelete}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {sortedUnpinnedExams.length === 0 && (
              <div className="p-10 text-center text-slate-400 text-xs">
                Không tìm thấy đề thi phù hợp.
              </div>
            )}
          </div>

        ) : (
          /* 2. LIST OR GRID MODE: Grouped by Grade & Subject (Clean, non-empty groups) */
          <div className="space-y-6">
            {groupedCatalog.map(group => (
              <div key={`group-${group.groupName}`} className="space-y-3">
                
                {/* Group Heading Header */}
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 px-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                      {group.groupName.toUpperCase()}
                    </h3>
                    <span className="text-xs font-semibold text-slate-500">
                      ({group.totalExams} đề thi)
                    </span>
                  </div>

                  {/* Subject quick breakdown */}
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {group.subjects.map(s => (
                      <span key={`group-sub-${s.subjectName}`} className="hidden md:inline">
                        {s.subjectName}: <strong className="text-slate-700">{s.exams.length}</strong>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Items in this group */}
                {displayMode === 'list' ? (
                  <div className="space-y-2.5">
                    {group.exams.map(exam => (
                      <ExamCard
                        key={`list-${exam.id}`}
                        exam={exam}
                        displayMode="list"
                        isPinned={false}
                        canManage={canManageExam(exam)}
                        canPin={canPin(exam)}
                        isLoadingThis={loadingExamId === exam.id}
                        onTakeExam={handleTakeExam}
                        onShareExam={setShareExamTarget}
                        onTogglePin={handleTogglePin}
                        onEditExam={onEditExam}
                        onDeleteExam={setExamToDelete}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {group.exams.map(exam => (
                      <ExamCard
                        key={`grid-${exam.id}`}
                        exam={exam}
                        displayMode="grid"
                        isPinned={false}
                        canManage={canManageExam(exam)}
                        canPin={canPin(exam)}
                        isLoadingThis={loadingExamId === exam.id}
                        onTakeExam={handleTakeExam}
                        onShareExam={setShareExamTarget}
                        onTogglePin={handleTogglePin}
                        onEditExam={onEditExam}
                        onDeleteExam={setExamToDelete}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {groupedCatalog.length === 0 && (
              <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 space-y-2">
                <BookOpen className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">
                  Không tìm thấy đề thi nào phù hợp với bộ lọc hiện tại.
                </p>
                {(selectedGradeFilter !== 'all' || selectedSubjectFilter !== 'all' || searchQuery.trim()) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGradeFilter('all');
                      setSelectedSubjectFilter('all');
                      setSearchQuery('');
                    }}
                    className="text-xs text-teal-600 font-bold hover:underline cursor-pointer"
                  >
                    Xóa tất cả bộ lọc
                  </button>
                )}
              </div>
            )}
          </div>
        )}

      </section>

      {/* ================================================================= */}
      {/* MODALS */}
      {/* ================================================================= */}

      {/* Pinned Exams Config Modal (Teacher / Admin Only) */}
      <PinnedExamsConfigModal
        isOpen={showPinConfigModal}
        onClose={() => setShowPinConfigModal(false)}
        exams={exams}
        subjects={subjects}
        currentSettings={homepageSettings}
        onSaved={(newSettings) => {
          setHomepageSettings(newSettings);
          setPinActionSuccess('Đã cập nhật cấu hình đề ghim trang chủ thành công!');
          setTimeout(() => setPinActionSuccess(null), 3000);
          if (onRefreshExams) onRefreshExams();
        }}
      />

      {/* Confirmation Modal for Exam Deletion */}
      <ConfirmModal
        isOpen={examToDelete !== null}
        title={`Xác nhận xóa đề thi "${examToDelete?.title}"?`}
        message={`Đề thi "${examToDelete?.title}" và toàn bộ câu hỏi liên quan sẽ bị xóa khỏi hệ thống. Thao tác này không thể hoàn tác.`}
        confirmText="Xóa đề thi này"
        onConfirm={async () => {
          if (examToDelete && onDeleteExam) {
            const target = examToDelete;
            setExamToDelete(null);
            await onDeleteExam(target);
          }
        }}
        onCancel={() => setExamToDelete(null)}
      />

      {/* QR Code & Share Exam Modal */}
      {shareExamTarget && (
        <ShareExamModal
          isOpen={Boolean(shareExamTarget)}
          exam={shareExamTarget}
          onClose={() => setShareExamTarget(null)}
        />
      )}

      {/* Secure Exam Student Roster Selector Modal */}
      {secureExamForRoster && (
        <SecureExamStudentSelectModal
          isOpen={Boolean(secureExamForRoster)}
          onClose={() => setSecureExamForRoster(null)}
          exam={secureExamForRoster}
          onSelectStudent={handleStudentSelectedFromRoster}
        />
      )}

    </div>
  );
};
