import React, { useState } from 'react';
import { 
  BookOpen, 
  CheckCircle2, 
  FileUp, 
  Clock, 
  BarChart3, 
  ShieldCheck, 
  Users, 
  Award, 
  Sparkles, 
  ArrowRight,
  GraduationCap,
  Play,
  Lock,
  Search,
  KeyRound,
  Calendar,
  AlertCircle,
  Shuffle,
  Plus,
  Edit3,
  Trash2,
  Pin
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { Exam, Question, SchoolClass, Subject } from '../../types';
import { getExamQuestions, togglePinExam } from '../../services/db';
import { ConfirmModal } from '../common/ConfirmModal';

interface HomeLandingProps {
  exams: Exam[];
  classes: SchoolClass[];
  subjects: Subject[];
  onNavigateTab: (tab: string) => void;
  onOpenWordUpload: () => void;
  onSelectExamToTake?: (exam: Exam, questions: Question[]) => void;
  onEditExam?: (exam: Exam) => void;
  onDeleteExam?: (exam: Exam) => void;
}

export const HomeLanding: React.FC<HomeLandingProps> = ({
  exams,
  classes,
  subjects,
  onNavigateTab,
  onOpenWordUpload,
  onSelectExamToTake,
  onEditExam,
  onDeleteExam
}) => {

  const { user, profile, activeRole, isTeacher, isAdmin, loginWithGoogle, loginAsDemoRole } = useAuth();

  // Free trial code search state
  const [trialCodeInput, setTrialCodeInput] = useState<string>('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [loadingExamId, setLoadingExamId] = useState<string | null>(null);
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);

  // Statistics
  const totalExams = exams.length;
  const activeExams = exams.filter(e => e.isPublished).length;
  const totalClasses = classes.length;
  const estimatedStudents = classes.reduce((sum, c) => sum + (c.studentCount || 35), 0);

  // Filter public trial exams vs secure confidential exams:
  // - Public trial exams: isTrial === true OR (!isSecure && isPublished)
  // - Confidential exams: isSecure === true (only visible when user is logged in)
  const trialExams = exams.filter(e => {
    if (!e.isPublished) return false;
    // If not logged in, exclude confidential/secure exams
    if (!user && e.isSecure) return false;
    if (selectedGradeFilter !== 'all' && e.grade !== selectedGradeFilter) return false;
    return true;
  });

  // Upcoming exams (Scheduled start time in the future or currently active)
  const upcomingExams = exams.filter(e => {
    if (!e.isPublished) return false;
    if (!user && e.isSecure) return false;
    return true;
  }).slice(0, 4);

  // Pinned required exams for students:
  const pinnedExams = exams.filter(e => {
    if (!e.isPublished || !e.isPinned) return false;
    if (!user && e.isSecure) return false;
    return true;
  });

  const [pinActionSuccess, setPinActionSuccess] = useState<string | null>(null);

  const handleTogglePin = async (exam: Exam, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const nextPin = !exam.isPinned;
      await togglePinExam(exam.id, nextPin);
      exam.isPinned = nextPin;
      setPinActionSuccess(`Đã ${nextPin ? 'ghim đề thi lên đầu' : 'bỏ ghim đề thi'}: "${exam.title}"`);
      setTimeout(() => setPinActionSuccess(null), 3000);
    } catch (err) {
      console.error('Lỗi khi ghim đề thi:', err);
    }
  };

  // Handle entering trial code
  const handleEnterTrialCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError(null);
    const code = trialCodeInput.trim().toUpperCase();
    if (!code) {
      setCodeError('Vui lòng nhập mã đề thi thử.');
      return;
    }

    // Match by trialCode or title or ID or subject code
    const matched = exams.find(ex => {
      const exCode = (ex.trialCode || '').toUpperCase();
      const exId = ex.id.toUpperCase();
      const exTitle = ex.title.toUpperCase();
      return exCode === code || exId.includes(code) || exTitle.includes(code);
    });

    if (!matched) {
      setCodeError(`Không tìm thấy đề thi với mã "${code}". Vui lòng thử các mã mẫu như TOAN6, THITHU-01, MATH12 hoặc chọn đề bên dưới.`);
      return;
    }

    if (matched.isSecure && !user) {
      setCodeError(`Đề thi "${matched.title}" là đề thi bảo mật chính thức. Vui lòng đăng nhập để vào thi.`);
      return;
    }

    if (onSelectExamToTake) {
      setLoadingExamId(matched.id);
      try {
        const qList = await getExamQuestions(matched.id);
        onSelectExamToTake(matched, qList);
      } catch (err) {
        console.error('Lỗi tải câu hỏi thi thử:', err);
        setCodeError('Không thể tải dữ liệu đề thi thử. Vui lòng thử lại.');
      } finally {
        setLoadingExamId(null);
      }
    }
  };

  // Launch trial exam directly
  const handleTakeTrialExam = async (exam: Exam) => {
    if (exam.isSecure && !user) {
      setCodeError(`Đề thi "${exam.title}" là đề thi bảo mật chính thức. Vui lòng đăng nhập tài khoản học sinh để vào thi.`);
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

  return (
    <div className="space-y-10 pb-12 animate-in fade-in duration-300">
      
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-white p-8 sm:p-12 shadow-xl border border-slate-800">
        <div className="relative z-10 max-w-3xl space-y-5">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>EduTest v2.5 • Nền tảng quản lý & khảo thí trực tuyến thông minh</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            EDUTEST – NỀN TẢNG THI TRỰC TUYẾN THÔNG MINH
          </h1>

          <p className="text-base sm:text-lg text-slate-300 font-medium leading-relaxed">
            Tạo đề thi dễ dàng – Thi thử tự do không cần tài khoản – Tổ chức thi bảo mật an toàn – Báo cáo phổ điểm tức thì.
          </p>

          {/* Quick Trial Code Box on Hero */}
          <div className="pt-2">
            <form onSubmit={handleEnterTrialCode} className="max-w-xl">
              <div className="flex flex-col sm:flex-row items-stretch gap-2 bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20">
                <div className="relative flex-1 flex items-center">
                  <KeyRound className="w-4 h-4 text-emerald-400 absolute left-3" />
                  <input
                    type="text"
                    value={trialCodeInput}
                    onChange={(e) => {
                      setTrialCodeInput(e.target.value);
                      if (codeError) setCodeError(null);
                    }}
                    placeholder="Nhập mã đề thi thử (VD: TOAN6, THITHU-01, MATH12...)"
                    className="w-full pl-9 pr-3 py-2.5 bg-transparent text-white placeholder-slate-400 text-xs sm:text-sm font-semibold focus:outline-hidden"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loadingExamId !== null}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>{loadingExamId ? 'Đang mở đề...' : 'Vào thi thử ngay'}</span>
                </button>
              </div>

              {codeError && (
                <div className="mt-2.5 px-3 py-2 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{codeError}</span>
                </div>
              )}
            </form>
          </div>

          {/* Call to action buttons */}
          <div className="pt-2 flex flex-wrap items-center gap-3.5">
            <button
              onClick={() => {
                if (onOpenWordUpload) onOpenWordUpload();
              }}
              className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <FileUp className="w-4 h-4" />
              <span>Tải đề Word .docx tự động</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => {
                  onNavigateTab('teacher-live');
                }}
                className="px-5 py-3 rounded-xl bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 font-bold text-xs sm:text-sm border border-rose-500/40 transition-all flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-rose-300" />
                <span>Phòng Giám sát LIVE (Admin)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => {
                onNavigateTab('student-exams');
              }}
              className="px-5 py-3 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 font-bold text-xs sm:text-sm border border-teal-400/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <GraduationCap className="w-4 h-4 text-emerald-400" />
              <span>Kỳ thi & Luyện tập</span>
            </button>
          </div>
        </div>

        {/* Decorative background grid elements */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none hidden lg:flex items-center justify-center">
          <BookOpen className="w-96 h-96 text-white" />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
            <Users className="w-5 h-5" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{estimatedStudents}+</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Học sinh theo dõi</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
            <GraduationCap className="w-5 h-5" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{totalClasses}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Lớp học trực thuộc</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
            <BookOpen className="w-5 h-5" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{totalExams}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Đề thi trong ngân hàng</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
            <Clock className="w-5 h-5" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{activeExams}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Kỳ thi đang diễn ra</p>
        </div>
      </div>

      {/* Pin Success Notification */}
      {pinActionSuccess && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <Pin className="w-4 h-4 text-amber-600 shrink-0 fill-amber-500" />
          <span className="font-semibold">{pinActionSuccess}</span>
        </div>
      )}

      {/* SECTION 0: ĐỀ THI ĐƯỢC GHIM (CẦN THI - BẮT BUỘC) */}
      {pinnedExams.length > 0 && (
        <div className="space-y-4 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 p-5 sm:p-6 rounded-3xl border-2 border-amber-300 shadow-md animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs">
                <Pin className="w-5 h-5 fill-slate-950" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <span>Đề thi được ghim (Cần thi)</span>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 shadow-2xs animate-pulse">
                    Ưu tiên • Bắt buộc
                  </span>
                </h2>
                <p className="text-xs text-slate-600 font-medium">
                  Học sinh ưu tiên hoàn thành các bài thi được ghim này trước khi thời gian kết thúc.
                </p>
              </div>
            </div>

            <span className="text-xs font-bold text-amber-800 bg-amber-100/80 px-3 py-1.5 rounded-xl border border-amber-300 self-start sm:self-center">
              {pinnedExams.length} đề thi cần thi
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
            {pinnedExams.map((exam) => {
              const isLoadingThis = loadingExamId === exam.id;
              return (
                <div 
                  key={`pinned-${exam.id}`}
                  className="bg-white rounded-2xl border-2 border-amber-300 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">
                          <Pin className="w-3 h-3 fill-slate-950" />
                          ĐÃ GHIM
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Khối {exam.grade} • {exam.subjectName}
                        </span>
                      </div>

                      {(isAdmin || isTeacher) && (
                        <button
                          type="button"
                          onClick={(e) => handleTogglePin(exam, e)}
                          className="p-1 rounded-lg text-amber-600 hover:bg-amber-100 transition-colors cursor-pointer text-[11px] font-semibold flex items-center gap-1"
                          title="Bỏ ghim đề thi này"
                        >
                          <Pin className="w-3.5 h-3.5 fill-amber-500" />
                          <span>Bỏ ghim</span>
                        </button>
                      )}
                    </div>

                    <h3 className="font-black text-sm text-slate-900 line-clamp-2 leading-snug">
                      {exam.title}
                    </h3>

                    <div className="grid grid-cols-2 gap-2 py-2 text-xs text-slate-700 bg-amber-50/60 rounded-xl p-2.5 border border-amber-200/60">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>{exam.durationMinutes} phút</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-bold">
                        <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                        <span>{exam.questionCount || 4} câu hỏi</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-amber-100 mt-4 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-amber-900 font-bold">
                      {exam.classIds && exam.classIds.length > 0 ? `Lớp: ${exam.classIds.join(', ')}` : 'Tất cả các lớp'}
                    </span>

                    <button
                      onClick={() => handleTakeTrialExam(exam)}
                      disabled={isLoadingThis}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 fill-slate-950" />
                      <span>{isLoadingThis ? 'Đang mở...' : 'Vào thi ngay'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 1: CÁC KỲ THI SẮP DIỄN RA */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Các kỳ thi sắp diễn ra & Đang mở phòng
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-semibold hidden sm:inline">
            Cập nhật theo thời gian thực
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {upcomingExams.map((exam) => {
            const isLoadingThis = loadingExamId === exam.id;
            return (
              <div 
                key={exam.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Khối {exam.grade} • {exam.subjectName}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      Đang mở thi
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 line-clamp-2 leading-snug">
                    {exam.title}
                  </h3>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {exam.durationMinutes} phút
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                      {exam.questionCount || 4} câu
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 italic">
                    {exam.classIds && exam.classIds.length > 0 ? `Lớp ${exam.classIds.join(', ')}` : 'Tất cả các lớp'}
                  </span>
                  <button
                    onClick={() => handleTakeTrialExam(exam)}
                    disabled={isLoadingThis}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3 h-3 fill-white" />
                    <span>{isLoadingThis ? 'Đang mở...' : 'Vào thi'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: THI THỬ TỰ DO (KHÔNG CẦN ĐĂNG NHẬP) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              Thi thử tự do miễn phí (Không cần đăng nhập)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Học sinh và phụ huynh có thể luyện tập đề kiểm tra tự do từ Lớp 1 đến Lớp 12 với hệ thống chấm điểm tự động.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Grade filter buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-slate-400 font-semibold mr-1">Khối:</span>
              {['all', '6', '7', '8', '9', '10', '11', '12'].map((g) => (
                <button
                  key={g}
                  onClick={() => setSelectedGradeFilter(g)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    selectedGradeFilter === g
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {g === 'all' ? 'Tất cả' : `K${g}`}
                </button>
              ))}
            </div>

            {/* Quick teacher/admin actions for free practice exams */}
            {(isTeacher || isAdmin) && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenWordUpload}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Tạo thêm đề thi thử tự do mới cho học sinh"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm đề thi thử</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateTab('teacher-exams')}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Chuyển đến trang Ngân hàng đề thi để sửa, xóa, hoặc xuất mã đề"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Quản lý / Xóa / Sửa đề</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Trial Exams Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {trialExams.map((exam) => {
            const isLoadingThis = loadingExamId === exam.id;
            return (
              <div 
                key={exam.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Khối {exam.grade} • {exam.subjectName}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                      Mã: {exam.trialCode || `EDUTEST-${exam.grade}`}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 line-clamp-2 leading-relaxed">
                    {exam.title}
                  </h3>

                  <div className="grid grid-cols-2 gap-2 py-2 text-xs text-slate-600 bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{exam.durationMinutes} phút</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                      <span>{exam.questionCount || 4} câu hỏi</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-slate-400" />
                      <span>Thang {exam.maxScore || 10}đ</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                      <Shuffle className="w-3.5 h-3.5" />
                      <span>Đảo câu từng phần</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 mt-4 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Miễn phí / Tự do
                    </span>

                    <button
                      onClick={() => handleTakeTrialExam(exam)}
                      disabled={isLoadingThis}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>{isLoadingThis ? 'Đang mở đề...' : 'Vào thi ngay'}</span>
                    </button>
                  </div>

                  {/* Edit, Delete, Pin action buttons for free practice exams */}
                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-dashed border-slate-100">
                    {(isAdmin || isTeacher) && (
                      <button
                        type="button"
                        onClick={(e) => handleTogglePin(exam, e)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                          exam.isPinned 
                            ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                            : 'bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-700'
                        }`}
                        title={exam.isPinned ? "Bỏ ghim đề thi (không còn ưu tiên lên đầu)" : "Ghim đề thi lên đầu để học sinh thấy ngay"}
                      >
                        <Pin className={`w-3.5 h-3.5 ${exam.isPinned ? 'fill-amber-600 text-amber-600' : ''}`} />
                        <span>{exam.isPinned ? 'Đã ghim' : 'Ghim đề'}</span>
                      </button>
                    )}
                    {onEditExam && (
                      <button
                        type="button"
                        onClick={() => onEditExam(exam)}
                        className="px-2.5 py-1.5 rounded-lg text-slate-700 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        title="Chỉnh sửa câu hỏi, đáp án, thời gian làm bài của đề thi này"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-500 hover:text-indigo-600" />
                        <span>Sửa đề</span>
                      </button>
                    )}
                    {onDeleteExam && (
                      <button
                        type="button"
                        onClick={() => setExamToDelete(exam)}
                        className="px-2.5 py-1.5 rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        title="Xóa vĩnh viễn đề thi này khỏi hệ thống"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Xoá đề</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

            );
          })}

          {trialExams.length === 0 && (
            <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">Chưa có đề thi thử phù hợp khối lớp đã chọn</p>
              <button
                onClick={() => setSelectedGradeFilter('all')}
                className="mt-3 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Hiển thị tất cả khối lớp
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Core Feature Pillars */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            Hệ sinh thái tính năng chính của EduTest
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Module 1: Quản lý đề thi */}
          <div 
            onClick={() => {
              if (!user && loginAsDemoRole) loginAsDemoRole('teacher');
              onNavigateTab('teacher-exams');
            }}
            className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileUp className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
                1. Nhập đề Word thông minh
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tự động bóc tách câu hỏi, trích xuất hình vẽ và công thức LaTeX. Hỗ trợ 3 phần chuẩn thi mới và AI rà soát đề thi.
              </p>
            </div>
            <div className="pt-4 flex items-center text-xs font-bold text-emerald-700 gap-1">
              <span>Xem ngân hàng đề</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Module 2: Tổ chức thi an toàn */}
          <div 
            onClick={() => {
              if (!user && loginAsDemoRole) loginAsDemoRole('student');
              onNavigateTab('student-exams');
            }}
            className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-indigo-700 transition-colors">
                2. Phòng thi trực tuyến
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Đồng hồ đếm ngược nổi bật, chia 3 phần rõ ràng, chỉ đảo câu trong từng phần, tự lưu bài và chống gian lận tab.
              </p>
            </div>
            <div className="pt-4 flex items-center text-xs font-bold text-indigo-700 gap-1">
              <span>Vào thi trực tuyến</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Module 3: Chấm điểm & Báo cáo */}
          <div 
            onClick={() => {
              if (!user && loginAsDemoRole) loginAsDemoRole('teacher');
              onNavigateTab('teacher-results');
            }}
            className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-teal-300 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-teal-700 transition-colors">
                3. AI Chấm tự luận & Phổ điểm
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tự động chấm trắc nghiệm, AI hỗ trợ chấm tự luận có đánh dấu minh bạch, xuất báo cáo phổ điểm Excel/CSV tức thì.
              </p>
            </div>
            <div className="pt-4 flex items-center text-xs font-bold text-teal-700 gap-1">
              <span>Xem phân tích phổ điểm</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Module 4: Quản trị & Phân quyền */}
          <div 
            onClick={() => {
              if (!user && loginAsDemoRole) loginAsDemoRole('admin');
              onNavigateTab('admin-users');
            }}
            className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-rose-300 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-rose-700 transition-colors">
                4. Phân quyền & Đề bảo mật
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Đề thi bảo mật chỉ hiện khi đăng nhập, quản lý quyền Admin, Giáo viên và Học sinh, nhật ký kiểm toán an ninh.
              </p>
            </div>
            <div className="pt-4 flex items-center text-xs font-bold text-rose-700 gap-1">
              <span>Bảo mật hệ thống</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Free / Trial Exam Deletion */}
      <ConfirmModal
        isOpen={examToDelete !== null}
        title={`Xác nhận xóa đề thi "${examToDelete?.title}"?`}
        message={`Đề thi tự do "${examToDelete?.title}" và toàn bộ câu hỏi liên quan sẽ bị xóa khỏi hệ thống. Thao tác này không thể hoàn tác.`}
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
    </div>
  );
};
