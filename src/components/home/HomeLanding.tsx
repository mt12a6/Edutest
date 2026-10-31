import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  CheckCircle2, 
  Clock, 
  BarChart3, 
  ShieldCheck, 
  Users, 
  Sparkles, 
  GraduationCap, 
  Play, 
  Lock, 
  Search, 
  KeyRound, 
  Pin, 
  QrCode, 
  Share2, 
  Edit3, 
  Trash2,
  School,
  AlertCircle,
  Filter,
  Layers
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { Exam, Question, SchoolClass, Subject } from '../../types';
import { getExamQuestions, togglePinExam, startOrCreateAttempt } from '../../services/db';
import { ConfirmModal } from '../common/ConfirmModal';
import { ShareExamModal } from '../common/ShareExamModal';
import { SecureExamStudentSelectModal } from '../common/SecureExamStudentSelectModal';

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

// Helper to extract numerical grade for ascending sorting (6 -> 7 -> 8 -> 9 -> 10 -> 11 -> 12)
export const parseGradeNumber = (gradeStr?: string | number): number => {
  if (gradeStr === undefined || gradeStr === null) return 999;
  const num = parseInt(String(gradeStr).replace(/\D/g, ''), 10);
  return isNaN(num) ? 999 : num;
};

// Helper for education level badge (THCS vs THPT)
export const getEducationLevelBadge = (gradeNum: number) => {
  if (gradeNum >= 6 && gradeNum <= 9) {
    return {
      level: 'THCS',
      badgeClass: 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800'
    };
  }
  if (gradeNum >= 10 && gradeNum <= 12) {
    return {
      level: 'THPT',
      badgeClass: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
    };
  }
  if (gradeNum >= 1 && gradeNum <= 5) {
    return {
      level: 'Tiểu học',
      badgeClass: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
    };
  }
  return {
    level: 'Phổ thông',
    badgeClass: 'bg-slate-50 dark:bg-slate-850 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
  };
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
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [pinnedSubjectFilter, setPinnedSubjectFilter] = useState<string>('all');
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);
  const [shareExamTarget, setShareExamTarget] = useState<Exam | null>(null);
  const [pinActionSuccess, setPinActionSuccess] = useState<string | null>(null);

  // Secure Semester Exam Student Roster Selector Modal
  const [secureExamForRoster, setSecureExamForRoster] = useState<Exam | null>(null);

  // Check if current user is an authorized teacher or admin
  const isPrivilegedStaff = Boolean(
    isAdmin || 
    isTeacher || 
    profile?.role === 'admin' || 
    profile?.role === 'teacher'
  );

  // Determine if user can edit or delete a specific exam (Strictly prohibited for guests)
  const canManageExam = (exam: Exam) => {
    if (!user) return false; // Guest NEVER has permission to delete or edit
    if (isPrivilegedStaff) return true;
    if (exam.createdBy === user.uid || (profile && exam.createdByName === profile.displayName)) return true;
    return false;
  };

  // Determine if user can pin an exam
  const canPin = (exam: Exam) => {
    return isPrivilegedStaff || (user && exam.createdBy === user.uid);
  };

  // Quick Stats
  const totalExams = exams.length;
  const activeExams = exams.filter(e => e.isPublished).length;
  const totalClasses = classes.length;
  const estimatedStudents = classes.reduce((sum, c) => sum + (c.studentCount || 35), 0);

  // Filter exams for general display:
  // - Published exams are visible to all
  // - Draft exams are visible only to teachers, admins, or authors
  const visibleExams = exams.filter(e => {
    if (!e.isPublished && !canManageExam(e)) return false;
    if (selectedGradeFilter !== 'all' && e.grade !== selectedGradeFilter) return false;
    return true;
  });

  // All pinned exams (published or user has permission)
  const allPinnedExams = useMemo(() => {
    return exams.filter(e => {
      if (!e.isPinned) return false;
      if (!e.isPublished && !canManageExam(e)) return false;
      return true;
    });
  }, [exams, user, isPrivilegedStaff]);

  // Unique subjects available within pinned exams
  const pinnedAvailableSubjects = useMemo(() => {
    const map = new Map<string, number>();
    allPinnedExams.forEach(e => {
      const s = e.subjectName?.trim() || 'Chung';
      map.set(s, (map.get(s) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [allPinnedExams]);

  // Pinned exams sorted ascending by Grade: THCS (6 -> 9) to THPT (10 -> 12), then by Subject, then Title
  const sortedPinnedExams = useMemo(() => {
    let list = allPinnedExams;
    if (pinnedSubjectFilter !== 'all') {
      list = list.filter(e => (e.subjectName?.trim() || 'Chung') === pinnedSubjectFilter);
    }
    return [...list].sort((a, b) => {
      const gA = parseGradeNumber(a.grade);
      const gB = parseGradeNumber(b.grade);
      if (gA !== gB) return gA - gB; // Strictly ascending 6, 7, 8, 9, 10, 11, 12
      const subjA = a.subjectName || '';
      const subjB = b.subjectName || '';
      if (subjA !== subjB) return subjA.localeCompare(subjB, 'vi');
      return a.title.localeCompare(b.title, 'vi');
    });
  }, [allPinnedExams, pinnedSubjectFilter]);

  // Regular practice/trial exams (not pinned)
  const unpinnedExams = visibleExams.filter(e => !e.isPinned);

  // Handle pin toggle
  const handleTogglePin = async (exam: Exam, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const nextPin = !exam.isPinned;
      await togglePinExam(exam.id, nextPin);
      exam.isPinned = nextPin;
      setPinActionSuccess(`Đã ${nextPin ? 'ghim đề thi lên đầu' : 'bỏ ghim đề thi'}: "${exam.title}"`);
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
      const exId = ex.id.toUpperCase();
      const exTitle = ex.title.toUpperCase();
      return exCode === code || exId.includes(code) || exTitle.includes(code);
    });

    if (!matched) {
      setCodeError(`Không tìm thấy đề thi với mã "${code}". Vui lòng thử các mã như TOAN6, THITHU-01, MATH12 hoặc chọn từ danh sách bên dưới.`);
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
    // If it's a secure exam and student is not logged in:
    // Open student selector modal allowing student to pick their name & class without needing login/password!
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
    <div className="space-y-4 sm:space-y-5 pb-8 animate-in fade-in duration-200">
      
      {/* 1. Sleek Compact Hero Banner (Optimized vertical space) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-teal-950 text-white p-3.5 sm:p-4.5 shadow-md border border-slate-800">
        {/* Subtle background glow */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          
          {/* Left: Brand + Title + Concise Value Prop */}
          <div className="space-y-1 max-w-xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>EduTest PRO</span>
              </span>
              <span className="text-[10px] font-medium text-slate-400 hidden sm:inline">
                Khảo thí Trực tuyến THCS &amp; THPT
              </span>
              {isPrivilegedStaff && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  <ShieldCheck className="w-3 h-3 shrink-0" />
                  <span>Giáo viên / Admin</span>
                </span>
              )}
            </div>

            <h1 className="text-base sm:text-lg lg:text-xl font-black tracking-tight leading-tight text-white">
              HỆ THỐNG THI TRỰC TUYẾN THÔNG MINH
            </h1>
            
            <p className="text-[11px] sm:text-xs text-slate-300 leading-snug">
              Thi tự do không cần tài khoản • Thi học kỳ bảo mật chọn tên theo lớp • Chấm điểm &amp; xếp hạng tức thì.
            </p>
          </div>

          {/* Right: Quick Exam Code Entry & Staff Shortcuts */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2 shrink-0">
            <form onSubmit={handleEnterExamCode} className="w-full sm:w-72 lg:w-80">
              <div className="flex items-center bg-white/10 dark:bg-slate-800/70 backdrop-blur-md p-1 rounded-xl border border-white/20 shadow-inner">
                <div className="relative flex-1 flex items-center min-w-0">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-400 absolute left-2.5 shrink-0" />
                  <input
                    type="text"
                    value={examCodeInput}
                    onChange={(e) => {
                      setExamCodeInput(e.target.value);
                      if (codeError) setCodeError(null);
                    }}
                    placeholder="Nhập mã đề (ví dụ: TOAN6)..."
                    className="w-full pl-8 pr-2 py-1.5 text-xs font-semibold text-white placeholder-slate-400 bg-transparent border-none focus:outline-hidden uppercase"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 min-h-[34px] bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs rounded-lg shadow-sm transition-all flex items-center gap-1 cursor-pointer shrink-0 active:scale-95"
                >
                  <Play className="w-3 h-3 fill-slate-950 shrink-0" />
                  <span>Vào thi</span>
                </button>
              </div>
              {codeError && (
                <div className="mt-1.5 p-1.5 bg-rose-500/20 border border-rose-400/40 rounded-lg text-[11px] text-rose-200 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="truncate">{codeError}</span>
                </div>
              )}
            </form>

            {isPrivilegedStaff && (
              <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onOpenWordUpload}
                  className="px-2.5 py-1 min-h-[30px] bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <span>+ Soạn đề</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('teacher-exams')}
                  className="px-2.5 py-1 min-h-[30px] bg-white/10 hover:bg-white/20 text-slate-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                >
                  <span>Quản lý đề</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* 2. Compact Overview Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
        <div className="bg-white dark:bg-slate-900 px-3 py-2 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Đề thi</span>
            <p className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">{totalExams}</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 px-3 py-2 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Lớp học</span>
            <p className="text-base sm:text-lg font-black text-emerald-600">{totalClasses}</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center shrink-0">
            <GraduationCap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 px-3 py-2 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Kỳ thi</span>
            <p className="text-base sm:text-lg font-black text-amber-600">{activeExams}</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 px-3 py-2 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Thí sinh</span>
            <p className="text-base sm:text-lg font-black text-teal-600">~{estimatedStudents}</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
        </div>
      </div>

      {/* Pin Action Toast Notification */}
      {pinActionSuccess && (
        <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <Pin className="w-3.5 h-3.5 text-amber-600 shrink-0 fill-amber-500" />
          <span className="font-bold">{pinActionSuccess}</span>
        </div>
      )}

      {/* 3. SECTION 1: PINNED EXAMS (ĐỀ THI ĐƯỢC GHIM - CHIA THEO MÔN & SẮP XẾP THCS -> THPT) */}
      {allPinnedExams.length > 0 && (
        <div className="space-y-3 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 dark:from-slate-900 dark:via-slate-850 dark:to-slate-900 p-3.5 sm:p-4.5 rounded-2xl border-2 border-amber-300 dark:border-amber-700/60 shadow-xs">
          
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs shrink-0">
                <Pin className="w-4 h-4 fill-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100">
                    Đề thi được ghim (Cần thi)
                  </h2>
                  <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                    Ưu tiên làm bài
                  </span>
                  <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-950/60 px-2 py-0.5 rounded-full border border-teal-300 dark:border-teal-800">
                    THCS → THPT
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Sắp xếp theo khối tăng dần (Khối 6–9 THCS → Khối 10–12 THPT). Học sinh ưu tiên hoàn thành trước hạn.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-lg border border-amber-300 dark:border-amber-800">
                {sortedPinnedExams.length} / {allPinnedExams.length} đề
              </span>
            </div>
          </div>

          {/* Subject Filter Pills (Chia theo môn học - Mobile-optimized horizontal scroll) */}
          <div className="pt-1 border-t border-amber-200/60 dark:border-slate-800">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none touch-pan-x">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
                <Filter className="w-3 h-3 text-amber-600" />
                Môn:
              </span>
              <button
                type="button"
                onClick={() => setPinnedSubjectFilter('all')}
                className={`px-2.5 py-1 min-h-[30px] rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                  pinnedSubjectFilter === 'all'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-amber-100/50'
                }`}
              >
                <span>Tất cả môn</span>
                <span className="text-[10px] opacity-80">({allPinnedExams.length})</span>
              </button>

              {pinnedAvailableSubjects.map(s => {
                const isActive = pinnedSubjectFilter === s.name;
                return (
                  <button
                    key={`pinned-subj-${s.name}`}
                    type="button"
                    onClick={() => setPinnedSubjectFilter(s.name)}
                    className={`px-2.5 py-1 min-h-[30px] rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1 ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-amber-100/50'
                    }`}
                  >
                    <span>{s.name}</span>
                    <span className="text-[10px] opacity-80">({s.count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pinned Exams Grid: Mobile 1 column, Tablet 2 columns, Desktop 3 columns */}
          {sortedPinnedExams.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {sortedPinnedExams.map((exam) => {
                const isLoadingThis = loadingExamId === exam.id;
                const hasManagePerm = canManageExam(exam);
                const gradeNum = parseGradeNumber(exam.grade);
                const levelInfo = getEducationLevelBadge(gradeNum);

                return (
                  <div 
                    key={`pinned-${exam.id}`}
                    className="bg-white dark:bg-slate-900 rounded-xl border-2 border-amber-300 dark:border-amber-700 p-3 sm:p-3.5 shadow-xs flex flex-col justify-between space-y-2.5 hover:border-amber-400 transition-colors"
                  >
                    <div className="space-y-2">
                      {/* Top Badges Row: Level (THCS/THPT) + Grade + Subject + Secure */}
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          {/* Education Level & Grade Badge */}
                          <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md border ${levelInfo.badgeClass}`}>
                            <span>{levelInfo.level}</span>
                            <span>•</span>
                            <span>Khối {exam.grade || '?'}</span>
                          </span>

                          {/* Subject Badge */}
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {exam.subjectName || 'Chung'}
                          </span>

                          {exam.isSecure && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              🔒 Bảo mật
                            </span>
                          )}
                        </div>

                        {canPin(exam) && (
                          <button
                            type="button"
                            onClick={(e) => handleTogglePin(exam, e)}
                            className="text-[10px] font-bold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer shrink-0"
                            title="Bỏ ghim đề này"
                          >
                            Bỏ ghim
                          </button>
                        )}
                      </div>

                      {/* Exam Title */}
                      <h3 className="font-black text-xs sm:text-sm text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                        {exam.title}
                      </h3>

                      {/* Duration & Questions Count */}
                      <div className="flex items-center gap-3 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{exam.durationMinutes} phút</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{exam.questionCount || 4} câu</span>
                        </span>
                      </div>
                    </div>

                    {/* Card Footer: Class info + QR Share + Take Exam Button */}
                    <div className="pt-2 border-t border-amber-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-amber-900 dark:text-amber-300 font-bold truncate max-w-[120px] sm:max-w-[140px]">
                        {exam.classIds?.length ? `Lớp: ${exam.classIds.join(', ')}` : 'Tất cả lớp'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShareExamTarget(exam)}
                          className="p-1.5 min-h-[34px] min-w-[34px] rounded-lg text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 cursor-pointer flex items-center justify-center transition-colors"
                          title="Chia sẻ & Quét mã QR"
                        >
                          <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleTakeExam(exam)}
                          disabled={isLoadingThis}
                          className="px-3 py-1.5 min-h-[34px] rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 active:scale-95 shadow-2xs"
                        >
                          <Play className="w-3 h-3 fill-slate-950 shrink-0" />
                          <span>{isLoadingThis ? 'Đang mở...' : 'Vào thi'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Staff Only Actions (Sửa đề / Xóa đề) */}
                    {hasManagePerm && (
                      <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-dashed border-amber-100 dark:border-slate-800">
                        {onEditExam && (
                          <button
                            type="button"
                            onClick={() => onEditExam(exam)}
                            className="px-2 py-0.5 rounded text-[11px] font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-1"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Sửa</span>
                          </button>
                        )}
                        {onDeleteExam && (
                          <button
                            type="button"
                            onClick={() => setExamToDelete(exam)}
                            className="px-2 py-0.5 rounded text-[11px] font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Xóa</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-center bg-white dark:bg-slate-900 rounded-xl border border-dashed border-amber-200 dark:border-slate-800 text-slate-500">
              <p className="text-xs font-semibold">
                Không có đề thi ghim cho môn &quot;{pinnedSubjectFilter}&quot;.
              </p>
              <button
                type="button"
                onClick={() => setPinnedSubjectFilter('all')}
                className="mt-1.5 text-xs text-amber-700 dark:text-amber-400 font-bold hover:underline cursor-pointer"
              >
                Xem tất cả môn ghim
              </button>
            </div>
          )}

        </div>
      )}

      {/* SECTION 2: DANH SÁCH ĐỀ THI TỰ DO & KỲ THI CHÍNH THỨC */}
      <div className="space-y-4">
        
        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Danh mục Đề thi & Khảo thí</span>
              <span className="text-xs font-bold text-slate-400">({visibleExams.length} đề)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Khách vãng lai và học sinh có thể bấm &quot;Vào thi ngay&quot; để thi thử tự do hoặc chọn tên trong danh sách lớp đối với đề thi học kỳ.
            </p>
          </div>

          {/* Grade Filter Pill Selectors */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setSelectedGradeFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                selectedGradeFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Tất cả
            </button>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map(g => (
              <button
                key={`grade-${g}`}
                type="button"
                onClick={() => setSelectedGradeFilter(g)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  selectedGradeFilter === g
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Khối {g}
              </button>
            ))}
          </div>
        </div>

        {/* Exam Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {unpinnedExams.map((exam) => {
            const isLoadingThis = loadingExamId === exam.id;
            const hasManagePerm = canManageExam(exam);

            return (
              <div 
                key={exam.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-2xs hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        Khối {exam.grade} • {exam.subjectName}
                      </span>
                      {exam.isSecure ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          🔒 Đề bảo mật (DS lớp)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          ✨ Thi tự do
                        </span>
                      )}
                      {!exam.isPublished && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          Bản nháp
                        </span>
                      )}
                    </div>

                    {canPin(exam) && (
                      <button
                        type="button"
                        onClick={(e) => handleTogglePin(exam, e)}
                        className="p-1 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 cursor-pointer"
                        title="Ghim đề thi này lên đầu trang"
                      >
                        <Pin className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug">
                    {exam.title}
                  </h3>

                  <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      {exam.durationMinutes} phút
                    </span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                      {exam.questionCount || 4} câu
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                    {exam.classIds?.length ? `Lớp: ${exam.classIds.join(', ')}` : 'Công khai'}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShareExamTarget(exam)}
                      className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 cursor-pointer"
                      title="Chia sẻ & Mã QR"
                    >
                      <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTakeExam(exam)}
                      disabled={isLoadingThis}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                        exam.isSecure && !user
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                      }`}
                    >
                      <Play className="w-3 h-3 fill-white" />
                      <span>{isLoadingThis ? 'Đang mở...' : (exam.isSecure && !user ? 'Chọn tên thi' : 'Vào thi ngay')}</span>
                    </button>
                  </div>
                </div>

                {/* Staff Only Actions (Sửa đề / Xóa đề - KHÁCH KHÔNG CÓ CÁC NÚT NÀY) */}
                {hasManagePerm && (
                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-dashed border-slate-100 dark:border-slate-800">
                    {onEditExam && (
                      <button
                        type="button"
                        onClick={() => onEditExam(exam)}
                        className="px-2 py-1 rounded text-[11px] font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-100 cursor-pointer flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Sửa đề</span>
                      </button>
                    )}
                    {onDeleteExam && (
                      <button
                        type="button"
                        onClick={() => setExamToDelete(exam)}
                        className="px-2 py-1 rounded text-[11px] font-semibold text-rose-600 hover:bg-rose-50 cursor-pointer flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Xóa đề</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {unpinnedExams.length === 0 && (
            <div className="col-span-full py-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
              <BookOpen className="w-9 h-9 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Không tìm thấy đề thi cho khối lớp đã chọn
              </p>
              <button
                type="button"
                onClick={() => setSelectedGradeFilter('all')}
                className="mt-2 text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
              >
                Xem tất cả khối lớp
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Confirmation Modal for Exam Deletion (Teacher / Admin Only) */}
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
