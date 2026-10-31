import React, { useState } from 'react';
import { 
  FileText, 
  Plus, 
  FileUp, 
  Clock, 
  BookOpen, 
  Users, 
  BarChart3, 
  Trash2, 
  Eye, 
  EyeOff,
  CheckCircle, 
  XCircle, 
  Search,
  Filter,
  Share2,
  Sparkles,
  Shuffle,
  Settings2,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Star,
  Printer,
  Pin,
  QrCode,
  Camera,
  Key,
  ExternalLink,
  Copy,
  X,
  Save,
  RefreshCw,
  FileDown
} from 'lucide-react';
import { Exam, Question, SchoolClass, Subject } from '../../types';
import { 
  toggleExamPublish, 
  toggleExamHide,
  toggleExamShuffle,
  toggleExamTrial,
  toggleExamTabWarning,
  deleteExam, 
  getExamQuestions,
  updateExamWithQuestions,
  logSystemAction,
  getTeacherScope,
  isExamInTeacherScope,
  TeacherScopeConfig,
  togglePinExam,
  recalculateExamResults
} from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { createBackupGoogleForm } from '../../services/googleFormsService';
import { exportExamToWord } from '../../utils/docxExportUtils';
import { ConfirmModal } from '../common/ConfirmModal';
import { TeacherScopeModal } from '../common/TeacherScopeModal';
import { ExamPreviewModal } from './ExamPreviewModal';
import { ShuffledExamExportModal } from './ShuffledExamExportModal';
import { ShareExamModal } from '../common/ShareExamModal';
import { ExamPrintModal } from '../common/ExamPrintModal';
import { OMRScannerModal } from './OMRScannerModal';
import { GoogleFormModal } from './GoogleFormModal';

interface ExamManagerProps {
  exams: Exam[];
  classes: SchoolClass[];
  subjects: Subject[];
  onOpenWordUpload: () => void;
  onEditExam?: (exam: Exam) => void;
  onViewResults: (exam: Exam) => void;
  onRefreshExams: () => void;
}

export const ExamManager: React.FC<ExamManagerProps> = ({
  exams,
  classes,
  subjects,
  onOpenWordUpload,
  onEditExam,
  onViewResults,
  onRefreshExams
}) => {
  const { user, getGoogleAccessToken, requestGoogleScopes } = useAuth();
  const [generatingGfExamId, setGeneratingGfExamId] = useState<string | null>(null);

  // Teacher teaching scope (defaults to false so all teacher exams are visible by default)
  const [teacherScope, setTeacherScope] = useState<TeacherScopeConfig>(getTeacherScope());
  const [showScopeModal, setShowScopeModal] = useState<boolean>(false);
  const [onlyTeachingScope, setOnlyTeachingScope] = useState<boolean>(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'trial'>('all');
  const [showHiddenExams, setShowHiddenExams] = useState(false);

  // Shuffled exam export modal
  const [shuffledModalExam, setShuffledModalExam] = useState<Exam | null>(null);
  const [shuffledModalQuestions, setShuffledModalQuestions] = useState<Question[]>([]);

  // Exam preview modal
  const [previewExam, setPreviewExam] = useState<Exam | null>(null);
  const [shareExamTarget, setShareExamTarget] = useState<Exam | null>(null);
  const [printTarget, setPrintTarget] = useState<{ exam: Exam; mode: 'exam' | 'answer_key' } | null>(null);
  const [omrScannerExam, setOmrScannerExam] = useState<Exam | null>(null);

  // Confirmation & Feedback State
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Exam Security Code Management Modal State
  const [securityModalExam, setSecurityModalExam] = useState<Exam | null>(null);
  const [securityExamCode, setSecurityExamCode] = useState<string>('');
  const [isSecurityEnabled, setIsSecurityEnabled] = useState<boolean>(false);
  const [isSavingSecurity, setIsSavingSecurity] = useState<boolean>(false);

  // Google Form Management Modal State
  const [googleFormModalExam, setGoogleFormModalExam] = useState<Exam | null>(null);

  const handleOpenSecurityModal = (exam: Exam) => {
    setSecurityModalExam(exam);
    setSecurityExamCode(exam.examCode?.trim() || '');
    setIsSecurityEnabled(Boolean(exam.examCode && exam.examCode.trim().length > 0));
  };

  const handleSaveSecurityCode = async () => {
    if (!securityModalExam) return;
    setIsSavingSecurity(true);
    try {
      const codeToSave = isSecurityEnabled ? securityExamCode.trim().toUpperCase() : '';
      await updateExamWithQuestions(securityModalExam.id, {
        examCode: codeToSave || '',
        isSecure: Boolean(codeToSave)
      });
      showSuccess(codeToSave 
        ? `Đã lưu mã bảo mật "${codeToSave}" cho đề thi "${securityModalExam.title}"!`
        : `Đã xóa mã bảo mật. Đề thi "${securityModalExam.title}" vào thi tự do không cần kiểm tra mã!`
      );
      setSecurityModalExam(null);
      onRefreshExams();
    } catch (e: any) {
      showError('Lỗi cập nhật mã bảo mật: ' + (e?.message || 'Thất bại'));
    } finally {
      setIsSavingSecurity(false);
    }
  };

  const [recalculatingExamId, setRecalculatingExamId] = useState<string | null>(null);
  const [exportingWordExamId, setExportingWordExamId] = useState<string | null>(null);

  const handleRecalculateExam = async (exam: Exam) => {
    const confirmed = window.confirm(
      `Bạn có muốn chấm lại và cập nhật điểm cho tất cả học sinh đã nộp bài thi "${exam.title}" theo đúng đáp án và thang điểm mới của đề thi không?`
    );
    if (!confirmed) return;

    setRecalculatingExamId(exam.id);
    try {
      const res = await recalculateExamResults(
        exam.id,
        user?.displayName || 'Giáo viên phụ trách',
        user?.uid || 'teacher'
      );
      showSuccess(`Đã cập nhật lại điểm thành công cho ${res.count} bài thi của đề "${exam.title}"!`);
      onRefreshExams();
    } catch (e) {
      console.error('Lỗi cập nhật lại điểm:', e);
      showError('Không thể cập nhật lại điểm thi. Vui lòng thử lại.');
    } finally {
      setRecalculatingExamId(null);
    }
  };

  const handleExportWordDirect = async (exam: Exam, mode: 'exam' | 'answers') => {
    setExportingWordExamId(exam.id);
    try {
      const questions = await getExamQuestions(exam.id);
      await exportExamToWord(exam, questions, mode);
      showSuccess(`Đã tải file Word (${mode === 'exam' ? 'Đề thi' : 'Đáp án'}) thành công!`);
    } catch (e) {
      console.error('Lỗi xuất file Word:', e);
      showError('Không thể xuất file Word. Vui lòng thử lại.');
    } finally {
      setExportingWordExamId(null);
    }
  };

  const handleGenerateGoogleForm = async (exam: Exam) => {
    setGeneratingGfExamId(exam.id);
    try {
      showSuccess(`Đang kết nối Google Forms API để tạo bản dự phòng cho "${exam.title}"...`);
      let token = await getGoogleAccessToken();
      if (!token) {
        token = await requestGoogleScopes([
          'https://www.googleapis.com/auth/forms.body',
          'https://www.googleapis.com/auth/drive.file'
        ]);
      }
      if (!token) {
        showError('Chưa được cấp quyền Google Forms. Vui lòng thử lại và cấp quyền truy cập.');
        setGeneratingGfExamId(null);
        return;
      }

      const qList = await getExamQuestions(exam.id);
      const res = await createBackupGoogleForm(exam, qList, token);
      if (res.success && res.formId) {
        await updateExamWithQuestions(exam.id, {
          googleFormId: res.formId,
          googleFormUrl: res.formUrl,
          googleFormStatus: 'created'
        }, qList);
        exam.googleFormId = res.formId;
        exam.googleFormUrl = res.formUrl;
        exam.googleFormStatus = 'created';
        showSuccess(`Đã tạo thành công Google Form dự phòng cho "${exam.title}"!`);
        onRefreshExams();
      } else {
        showError(res.error || 'Không thể tạo Google Form.');
      }
    } catch (err: any) {
      showError(`Lỗi khi tạo Google Form: ${err?.message || 'Lỗi không xác định'}`);
    } finally {
      setGeneratingGfExamId(null);
    }
  };

  const showSuccess = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3500);
  };

  const showError = (msg: string) => {
    setActionError(msg);
    setTimeout(() => setActionError(null), 5000);
  };

  const allGrades = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

  const filteredExams = exams.filter(e => {
    // Hidden filter
    if (!showHiddenExams && e.isHidden) return false;

    // Scope filter (Toán 6, Tin 6-9)
    if (onlyTeachingScope && !isExamInTeacherScope(e, teacherScope)) {
      return false;
    }

    // Status filter
    if (statusFilter === 'published' && !e.isPublished) return false;
    if (statusFilter === 'draft' && e.isPublished) return false;
    if (statusFilter === 'trial' && !e.isTrial) return false;

    const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.subjectName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSub = selectedSubject === 'all' || e.subjectId === selectedSubject;
    const matchesGrade = selectedGrade === 'all' || e.grade === selectedGrade;
    return matchesSearch && matchesSub && matchesGrade;
  });

  const handleOpenShuffledModal = async (targetExam: Exam) => {
    try {
      const qList = await getExamQuestions(targetExam.id);
      setShuffledModalQuestions(qList);
      setShuffledModalExam(targetExam);
    } catch (err) {
      console.error('Lỗi tải câu hỏi để xuất mã đề:', err);
      showError('Không thể tải danh sách câu hỏi của đề thi.');
    }
  };

  const handleToggleTrial = async (targetExam: Exam) => {
    const nextTrial = !targetExam.isTrial;
    const defaultCode = targetExam.trialCode || `EDUTEST-${targetExam.grade}`;
    try {
      await toggleExamTrial(targetExam.id, nextTrial, defaultCode);
      showSuccess(nextTrial ? `Đã chuyển "${targetExam.title}" thành Đề thi thử tự do (Mã: ${defaultCode}).` : `Đã tắt chế độ thi thử của "${targetExam.title}".`);
      onRefreshExams();
    } catch (err) {
      console.error('Lỗi khi bật/tắt thi thử:', err);
      showError('Lỗi cập nhật trạng thái thi thử tự do.');
    }
  };

  const handleTogglePublish = async (exam: Exam) => {
    try {
      const nextStatus = !exam.isPublished;
      await toggleExamPublish(exam.id, nextStatus);
      await logSystemAction(
        'TOGGLE_EXAM_PUBLISH',
        user?.uid || 'unknown',
        user?.email || 'unknown',
        exam.id,
        'exam',
        `${nextStatus ? 'Mở' : 'Đóng'} kỳ thi "${exam.title}"`
      );
      showSuccess(nextStatus ? `Đã mở kỳ thi "${exam.title}" cho học sinh.` : `Đã tạm đóng kỳ thi "${exam.title}".`);
      onRefreshExams();
    } catch (err) {
      console.error('Không thể cập nhật trạng thái đề thi:', err);
      showError('Lỗi cập nhật trạng thái đề thi.');
    }
  };

  const handleToggleHide = async (exam: Exam) => {
    const nextHidden = !exam.isHidden;
    try {
      await toggleExamHide(exam.id, nextHidden);
      showSuccess(nextHidden ? `Đã ẩn kỳ thi "${exam.title}".` : `Đã bỏ ẩn kỳ thi "${exam.title}".`);
      onRefreshExams();
    } catch (err) {
      console.error('Lỗi khi ẩn/hiện đề thi:', err);
      showError('Lỗi khi thay đổi trạng thái ẩn/hiện.');
    }
  };

  const handleTogglePin = async (exam: Exam) => {
    const nextPin = !exam.isPinned;
    try {
      await togglePinExam(exam.id, nextPin);
      showSuccess(nextPin ? `Đã ghim đề thi lên đầu: "${exam.title}".` : `Đã bỏ ghim đề thi: "${exam.title}".`);
      onRefreshExams();
    } catch (err: any) {
      showError('Lỗi khi thay đổi trạng thái ghim đề: ' + (err?.message || 'Thất bại'));
    }
  };

  const handleToggleShuffle = async (exam: Exam) => {
    // Toggle both shuffleQuestions and shuffleOptions
    const nextShuffle = !(exam.shuffleQuestions || exam.shuffleOptions);
    try {
      await toggleExamShuffle(exam.id, nextShuffle, nextShuffle);
      showSuccess(nextShuffle ? `Đã bật tính năng trộn đề & hoán vị đáp án cho "${exam.title}"!` : `Đã tắt trộn đề cho "${exam.title}".`);
      onRefreshExams();
    } catch (err) {
      console.error('Lỗi cập nhật trộn đề:', err);
    }
  };

  const handleToggleTabWarning = async (exam: Exam) => {
    const nextWarning = !(exam.enableTabWarning || exam.warnOnTabSwitch);
    try {
      await toggleExamTabWarning(exam.id, nextWarning);
      showSuccess(nextWarning ? `Đã bật cảnh báo chuyển tab cho "${exam.title}".` : `Đã tắt cảnh báo chuyển tab cho "${exam.title}".`);
      onRefreshExams();
    } catch (err) {
      console.error('Lỗi cập nhật cảnh báo chuyển tab:', err);
      showError('Không thể cập nhật cấu hình cảnh báo tab.');
    }
  };

  const confirmDelete = async () => {
    if (!examToDelete) return;
    const target = examToDelete;
    setExamToDelete(null);

    try {
      await deleteExam(target.id);
      await logSystemAction(
        'DELETE_EXAM',
        user?.uid || 'unknown',
        user?.email || 'unknown',
        target.id,
        'exam',
        `Xóa đề thi "${target.title}"`
      );
      showSuccess(`Đã xóa vĩnh viễn đề thi "${target.title}".`);
      onRefreshExams();
    } catch (err) {
      console.error('Lỗi khi xóa đề thi:', err);
      showError('Không thể xóa đề thi. Vui lòng thử lại.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Toast Alert */}
      {actionSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 shadow-xs animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 shadow-xs animate-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-medium">{actionError}</span>
        </div>
      )}

      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 leading-tight">
            Quản lý Ngân hàng Đề thi & Kỳ thi
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Tạo đề trắc nghiệm thông minh, trộn đề chống gian lận, phân công lớp và giám sát kỳ thi trực tuyến
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowScopeModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:text-emerald-700 bg-white text-slate-700 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
          >
            <Settings2 className="w-4 h-4 text-emerald-600" />
            <span>Môn phụ trách (Toán 6, Tin 6-9)</span>
          </button>

          <button
            onClick={onOpenWordUpload}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <FileUp className="w-4 h-4" />
            <span>Nhập đề từ Word / PDF / JSON</span>
          </button>
        </div>
      </div>

      {/* Teacher Scope Banner */}
      <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-900">
                Phân công giảng dạy của bạn:
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                Toán 6 • Tin học 6, 7, 8, 9
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Hệ thống hỗ trợ ẩn/hiện các kỳ thi ngoài phạm vi giảng dạy để giao diện luôn gọn gàng, tập trung.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <button
            type="button"
            onClick={() => setOnlyTeachingScope(!onlyTeachingScope)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
              onlyTeachingScope
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{onlyTeachingScope ? 'Đang bật lọc môn đang dạy' : 'Đang hiện tất cả môn & khối'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowScopeModal(true)}
            className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-emerald-700 rounded-xl transition-colors cursor-pointer"
            title="Tùy chỉnh môn & khối đang dạy"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm kiếm đề thi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white font-medium text-slate-700 cursor-pointer"
          >
            <option value="all">Tất cả khối lớp</option>
            {allGrades.map(g => (
              <option key={g} value={g}>Khối {g}</option>
            ))}
          </select>

          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white font-medium text-slate-700 cursor-pointer"
          >
            <option value="all">Tất cả môn học</option>
            {subjects.map(s => (
              <option key={s.id || s.code} value={s.id || s.code}>{s.name}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white font-medium text-slate-700 cursor-pointer"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="trial">⭐ Đề thi thử tự do</option>
            <option value="published">Đang mở thi</option>
            <option value="draft">Bản nháp / Đang đóng</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <button
            type="button"
            onClick={() => setShowHiddenExams(!showHiddenExams)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              showHiddenExams 
                ? 'bg-amber-100 border-amber-300 text-amber-800' 
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {showHiddenExams ? 'Đang hiện đề đã ẩn' : 'Hiện đề đã ẩn'}
          </button>

          <span className="text-xs font-bold text-slate-400">
            {filteredExams.length} đề thi
          </span>
        </div>
      </div>

      {/* Exam Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredExams.map((exam) => {
          const isShuffled = exam.shuffleQuestions || exam.shuffleOptions;
          return (
            <div 
              key={exam.id} 
              className={`rounded-2xl border shadow-xs overflow-hidden transition-all flex flex-col justify-between ${
                exam.isHidden 
                  ? 'bg-slate-50 border-slate-200 opacity-60' 
                  : 'bg-white border-slate-200 hover:shadow-md hover:border-slate-300'
              }`}
            >
              <div className="p-5 space-y-3">
                {/* Header tags */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-100">
                      {exam.subjectName}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                      Khối {exam.grade}
                    </span>
                    {exam.isTrial ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-800 rounded-md border border-amber-200 flex items-center gap-1" title="Đề thi thử tự do - Học sinh có thể làm không cần đăng nhập">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        Thi thử: {exam.trialCode || 'Tự do'}
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                        Chính khóa
                      </span>
                    )}
                    {isShuffled && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200 flex items-center gap-1" title="Đã kích hoạt tự động đảo vị trí câu hỏi & đáp án khi học sinh làm bài">
                        <Shuffle className="w-3 h-3 text-indigo-600" />
                        Trộn đề
                      </span>
                    )}
                    {exam.isPinned && (
                      <span className="text-[10px] font-black px-2 py-0.5 bg-amber-500 text-slate-950 rounded-md flex items-center gap-1 shadow-2xs" title="Đề thi đã được ghim ưu tiên lên đầu cho học sinh">
                        <Pin className="w-3 h-3 fill-slate-950" />
                        Đã ghim
                      </span>
                    )}
                    {exam.isHidden && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded">
                        Đang ẩn
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Pin/Unpin Toggle */}
                    <button
                      onClick={() => handleTogglePin(exam)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        exam.isPinned 
                          ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' 
                          : 'text-slate-400 hover:text-amber-600 hover:bg-slate-100'
                      }`}
                      title={exam.isPinned ? "Bỏ ghim đề thi (không còn ưu tiên lên đầu)" : "Ghim đề thi lên đầu để học sinh thấy ngay"}
                    >
                      <Pin className={`w-4 h-4 ${exam.isPinned ? 'fill-amber-500 text-amber-500' : ''}`} />
                    </button>

                    {/* Hide/Show Toggle */}
                    <button
                      onClick={() => handleToggleHide(exam)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        exam.isHidden ? 'text-amber-600 hover:bg-amber-100' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                      }`}
                      title={exam.isHidden ? "Hiện lại đề thi" : "Tạm ẩn đề thi"}
                    >
                      {exam.isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>

                    {/* Delete Exam Button */}
                    <button
                      onClick={() => setExamToDelete(exam)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Xóa đề thi vĩnh viễn"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="font-bold text-sm text-slate-900 leading-snug line-clamp-2">
                  {exam.title}
                </h3>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{exam.durationMinutes} phút</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                    <span>{exam.questionCount} câu hỏi</span>
                  </div>
                </div>

                {/* Shuffle quick toggle bar */}
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Shuffle className={`w-3.5 h-3.5 ${isShuffled ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className="font-semibold text-slate-700 text-[11px]">
                      {isShuffled ? 'Chế độ Trộn đề: Bật' : 'Chế độ Trộn đề: Tắt'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleShuffle(exam)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                      isShuffled 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {isShuffled ? 'Đã bật' : 'Bật ngay'}
                  </button>
                </div>

                {/* Assigned classes & Proctoring mode */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold text-slate-400">Lớp phân công:</span>
                    {exam.classIds && exam.classIds.length > 0 ? (
                      exam.classIds.map(cid => (
                        <span key={cid} className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-700 font-bold rounded">
                          {cid}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.2 bg-emerald-50 text-emerald-700 font-bold rounded border border-emerald-200">
                        🌐 Mở cho tất cả các lớp (Đề tự do)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold text-slate-400">Cảnh báo tab:</span>
                    {exam.enableTabWarning || exam.warnOnTabSwitch ? (
                      <span className="text-[10px] px-1.5 py-0.2 bg-amber-50 text-amber-700 font-bold rounded border border-amber-200">
                        ⚠️ Đang bật cảnh báo rời màn hình
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 font-semibold rounded">
                        🛡️ Đang tắt (Thí sinh làm bài tự do)
                      </span>
                    )}
                  </div>

                  {/* Schedule time display */}
                  {(exam.openTime || exam.closeTime) && (
                    <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-medium text-slate-600 bg-indigo-50/50 p-1.5 rounded-lg border border-indigo-100">
                      <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>Lịch thi:</span>
                      {exam.openTime && (
                        <span>Mở: <strong>{new Date(exam.openTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</strong></span>
                      )}
                      {exam.closeTime && (
                        <span>— Đóng: <strong>{new Date(exam.closeTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</strong></span>
                      )}
                    </div>
                  )}

                  {/* Security Code & Proctoring Management Row */}
                  <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-amber-50/80 border border-amber-200 text-[10px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <Key className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      {exam.examCode ? (
                        <span className="font-bold text-amber-900">Mã bảo mật: <span className="font-mono bg-amber-100 px-1 rounded">{exam.examCode}</span></span>
                      ) : (
                        <span className="text-slate-500 font-medium">Không dùng mã bảo mật (Để trống • Vào thi tự do)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {exam.secretToken && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/?secretToken=${encodeURIComponent(exam.secretToken!)}`);
                            showSuccess(`Đã sao chép đường link bí mật của đề thi "${exam.title}"!`);
                          }}
                          className="px-2 py-0.5 rounded bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold shrink-0 transition-colors cursor-pointer"
                          title="Sao chép link bí mật"
                        >
                          Chép link
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenSecurityModal(exam)}
                        className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold shrink-0 transition-colors cursor-pointer shadow-2xs"
                        title="Quản lý mã bảo mật đề thi"
                      >
                        {exam.examCode ? 'Đổi mã' : 'Đặt mã'}
                      </button>
                    </div>
                  </div>

                  {/* Google Forms backup badge & action */}
                  <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-[10px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-bold text-emerald-950">📑 Google Form:</span>
                      {exam.googleFormUrl ? (
                        <span className="text-emerald-700 font-semibold truncate">Đã liên kết</span>
                      ) : (
                        <span className="text-slate-500">Chưa tạo Form</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {exam.googleFormUrl && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(exam.googleFormUrl!);
                              showSuccess('Đã sao chép link Google Form vào bộ nhớ tạm!');
                            }}
                            className="px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-semibold cursor-pointer"
                          >
                            Chép link
                          </button>
                          <a
                            href={exam.googleFormUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1"
                          >
                            <span>Mở</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setGoogleFormModalExam(exam)}
                        className={`px-2 py-0.5 rounded font-bold shrink-0 transition-colors cursor-pointer ${
                          exam.googleFormUrl
                            ? 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                        }`}
                        title="Tạo hoặc quản lý Google Form cho đề thi này"
                      >
                        {exam.googleFormUrl ? 'Cài đặt' : '+ Tạo Google Form'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>



              {/* Footer Actions */}
              <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => handleTogglePublish(exam)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                      exam.isPublished
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                    title={exam.isPublished ? "Đề đang mở cho học sinh thi. Bấm để đóng." : "Đề đang ở dạng nháp/đóng. Bấm để mở thi."}
                  >
                    {exam.isPublished ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-500" />}
                    <span>{exam.isPublished ? 'Mở thi' : 'Bản nháp'}</span>
                  </button>

                  <button
                    onClick={() => setPreviewExam(exam)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1"
                    title="Xem chi tiết các câu hỏi, hình vẽ minh họa và công thức toán của đề thi"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                    <span>Xem đề</span>
                  </button>

                  <button
                    onClick={() => handleOpenShuffledModal(exam)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer flex items-center gap-1"
                    title="Tạo các mã đề đảo (101, 102, 103...), xuất đề thi, link đề thi và đáp án chấm tương ứng"
                  >
                    <Shuffle className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Mã đề đảo & Xuất đề</span>
                  </button>

                  <button
                    onClick={() => setPrintTarget({ exam, mode: 'exam' })}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1"
                    title="In đề thi chuẩn khổ A4 cho học sinh làm bài"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                    <span>In đề (A4)</span>
                  </button>

                  <button
                    onClick={() => setPrintTarget({ exam, mode: 'answer_key' })}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-indigo-700 hover:bg-indigo-50 transition-colors cursor-pointer flex items-center gap-1"
                    title="In đáp án và hướng dẫn chấm chi tiết khổ A4"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    <span>In đáp án (A4)</span>
                  </button>

                  <button
                    onClick={() => setOmrScannerExam(exam)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer flex items-center gap-1"
                    title="Chấm bài offline bằng ảnh chụp phiếu trắc nghiệm A4 hoặc in mẫu phiếu"
                  >
                    <Camera className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Chấm phiếu OMR</span>
                  </button>

                  <button
                    onClick={() => setShareExamTarget(exam)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer flex items-center gap-1"
                    title="Mã QR và liên kết chia sẻ đề thi cho học sinh"
                  >
                    <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Mã QR & Link</span>
                  </button>

                  <button
                    onClick={() => handleToggleTrial(exam)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                      exam.isTrial
                        ? 'bg-amber-100 border border-amber-300 text-amber-800 hover:bg-amber-200 font-bold'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                    title={exam.isTrial ? `Đề thi thử tự do (Mã: ${exam.trialCode || 'Tự do'}). Nhấn để tắt.` : 'Bật tính năng thi thử tự do cho học sinh trên Trang chủ'}
                  >
                    <Star className={`w-3.5 h-3.5 ${exam.isTrial ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
                    <span>{exam.isTrial ? 'Thi thử: Bật' : 'Thi thử'}</span>
                  </button>

                  <button
                    onClick={() => handleToggleTabWarning(exam)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                      exam.enableTabWarning || exam.warnOnTabSwitch
                        ? 'bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 font-bold'
                        : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                    title="Bật hoặc tắt chức năng cảnh báo khi học sinh chuyển tab màn hình"
                  >
                    <AlertCircle className={`w-3.5 h-3.5 ${exam.enableTabWarning || exam.warnOnTabSwitch ? 'text-amber-600' : 'text-slate-400'}`} />
                    <span>{exam.enableTabWarning || exam.warnOnTabSwitch ? 'Cảnh báo tab: Bật' : 'Cảnh báo tab: Tắt'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={recalculatingExamId === exam.id}
                    onClick={() => handleRecalculateExam(exam)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                    title="Cập nhật lại điểm thi cho các thí sinh theo đáp án và thang điểm mới của đề thi"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-amber-700 ${recalculatingExamId === exam.id ? 'animate-spin' : ''}`} />
                    <span>{recalculatingExamId === exam.id ? 'Đang tính...' : 'Cập nhật điểm'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={exportingWordExamId === exam.id}
                    onClick={() => handleExportWordDirect(exam, 'exam')}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                    title="Xuất file Word (.docx) đề thi"
                  >
                    <FileDown className="w-3.5 h-3.5 text-blue-600" />
                    <span>Xuất Đề (Word)</span>
                  </button>

                  <button
                    type="button"
                    disabled={exportingWordExamId === exam.id}
                    onClick={() => handleExportWordDirect(exam, 'answers')}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-50"
                    title="Xuất file Word (.docx) bảng đáp án và hướng dẫn chấm"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>Xuất Đáp án (Word)</span>
                  </button>

                  {onEditExam && (
                    <button
                      onClick={() => onEditExam(exam)}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1"
                      title="Chỉnh sửa câu hỏi, đáp án và thông số đề thi"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                      <span>Sửa đề</span>
                    </button>
                  )}

                  <button
                    onClick={() => setExamToDelete(exam)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer flex items-center gap-1"
                    title="Xóa vĩnh viễn đề thi này"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Xoá đề</span>
                  </button>
                </div>


                <button
                  onClick={() => onViewResults(exam)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 ml-auto"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Kết quả & Lớp</span>
                </button>
              </div>
            </div>
          );
        })}

        {filteredExams.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="font-bold text-sm text-slate-800">Không tìm thấy đề thi phù hợp</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Bạn có thể tắt chế độ lọc môn phụ trách hoặc nhấn "Nhập đề từ Word / PDF" để đưa đề thi mới lên.
            </p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                type="button"
                onClick={() => { setOnlyTeachingScope(false); setSelectedGrade('all'); setSelectedSubject('all'); setStatusFilter('all'); }}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Hiển thị tất cả đề thi
              </button>
              <button
                type="button"
                onClick={onOpenWordUpload}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                Tạo đề thi mới
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Exam Deletion */}
      <ConfirmModal
        isOpen={examToDelete !== null}
        title={`Xác nhận xóa đề thi "${examToDelete?.title}"?`}
        message={`Đề thi "${examToDelete?.title}" và toàn bộ câu hỏi liên quan sẽ bị xóa khỏi ngân hàng đề thi. Thao tác này không thể hoàn tác.`}
        confirmText="Xóa đề thi"
        onConfirm={confirmDelete}
        onCancel={() => setExamToDelete(null)}
      />

      {/* Teaching Scope Modal */}
      <TeacherScopeModal
        isOpen={showScopeModal}
        onClose={() => setShowScopeModal(false)}
        currentScope={teacherScope}
        onSaveScope={(newScope) => {
          setTeacherScope(newScope);
          setOnlyTeachingScope(newScope.enabled);
        }}
      />

      {/* Exam Preview Modal */}
      {previewExam && (
        <ExamPreviewModal
          isOpen={previewExam !== null}
          onClose={() => setPreviewExam(null)}
          exam={previewExam}
          classes={classes}
          onEditExam={(ex, qList) => {
            setPreviewExam(null);
            if (onEditExam) onEditExam(ex);
          }}
          onRefreshExams={onRefreshExams}
        />
      )}

      {/* Shuffled Exam Codes & Export Modal */}
      {shuffledModalExam && (
        <ShuffledExamExportModal
          isOpen={shuffledModalExam !== null}
          onClose={() => setShuffledModalExam(null)}
          exam={shuffledModalExam}
          questions={shuffledModalQuestions}
        />
      )}

      {/* Share & QR Code Modal */}
      {shareExamTarget && (
        <ShareExamModal
          isOpen={Boolean(shareExamTarget)}
          exam={shareExamTarget}
          onClose={() => setShareExamTarget(null)}
        />
      )}

      {/* Exam Print Modal (A4 standard) */}
      {printTarget && (
        <ExamPrintModal
          isOpen={Boolean(printTarget)}
          onClose={() => setPrintTarget(null)}
          exam={printTarget.exam}
          mode={printTarget.mode}
        />
      )}

      {/* Security Code & Proctoring Management Modal */}
      {securityModalExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full overflow-hidden animate-in zoom-in-95">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Key className="w-4 h-4 fill-slate-950" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base">Quản lý mã bảo mật đề thi</h3>
                  <p className="text-[11px] text-slate-300 line-clamp-1">{securityModalExam.title}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setSecurityModalExam(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Enable Security Switch */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">Mã bảo mật phòng thi</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Chỉ dùng đối với trường hợp có mã bảo mật. Còn lại để trống thì không cần kiểm tra mã bảo mật khi vào thi.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isSecurityEnabled}
                  onChange={(e) => setIsSecurityEnabled(e.target.checked)}
                  className="w-5 h-5 text-indigo-600 rounded cursor-pointer accent-indigo-600"
                />
              </div>

              {/* Code Input */}
              {isSecurityEnabled && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Mã bảo mật phòng thi:
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const randomCode = `THI${securityModalExam.grade || '10'}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
                        setSecurityExamCode(randomCode);
                      }}
                      className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer"
                    >
                      + Tạo mã ngẫu nhiên
                    </button>
                  </div>
                  <input
                    type="text"
                    value={securityExamCode}
                    onChange={(e) => setSecurityExamCode(e.target.value.toUpperCase())}
                    placeholder="Ví dụ: HK2-TOAN6A hoặc KTHK-2025"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 rounded-xl text-xs font-mono font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-200 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  <p className="text-[10px] text-slate-500">
                    Mã này được bảo mật và không hiển thị công khai ở trang chủ khách.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSecurityModalExam(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isSavingSecurity || (isSecurityEnabled && !securityExamCode.trim())}
                  onClick={handleSaveSecurityCode}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingSecurity ? 'Đang lưu...' : 'Lưu thiết lập bảo mật'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Google Form Integration Modal */}
      {googleFormModalExam && (
        <GoogleFormModal
          isOpen={Boolean(googleFormModalExam)}
          onClose={() => setGoogleFormModalExam(null)}
          exam={googleFormModalExam}
          onExamUpdated={onRefreshExams}
        />
      )}
    </div>
  );
};
