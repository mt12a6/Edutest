import React, { useState, useEffect, useRef } from 'react';
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
  FileDown,
  List,
  Table as TableIcon,
  LayoutGrid,
  MoreVertical,
  Calculator,
  Laptop,
  Atom,
  FlaskConical,
  Languages,
  ShieldCheck,
  ShieldAlert,
  ArrowUpDown
} from 'lucide-react';
import { Exam, Question, SchoolClass, Subject, ExamDisplayMode, HomepageSettings, DEFAULT_HOMEPAGE_SETTINGS } from '../../types';
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
  recalculateExamResults,
  getHomepageSettings,
  saveHomepageSettings
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
import { PinnedExamsConfigModal } from '../home/PinnedExamsConfigModal';

interface ExamManagerProps {
  exams: Exam[];
  classes: SchoolClass[];
  subjects: Subject[];
  onOpenWordUpload: () => void;
  onEditExam?: (exam: Exam) => void;
  onViewResults: (exam: Exam) => void;
  onRefreshExams: () => void;
}

// Helper to choose appropriate subject icon
export const getSubjectIcon = (subjectName?: string) => {
  const s = (subjectName || '').toLowerCase();
  if (s.includes('toán')) return <Calculator className="w-4 h-4 text-teal-600" />;
  if (s.includes('tin')) return <Laptop className="w-4 h-4 text-blue-600" />;
  if (s.includes('lí') || s.includes('vật lý') || s.includes('vật lí')) return <Atom className="w-4 h-4 text-indigo-600" />;
  if (s.includes('hóa')) return <FlaskConical className="w-4 h-4 text-purple-600" />;
  if (s.includes('anh') || s.includes('ngoại ngữ')) return <Languages className="w-4 h-4 text-emerald-600" />;
  return <BookOpen className="w-4 h-4 text-slate-600" />;
};

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

  // Display Mode ('list' | 'table' | 'grid') with localStorage persistence (Default: single line list)
  const [displayMode, setDisplayMode] = useState<ExamDisplayMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('edutest_exam_manager_mode');
      if (saved === 'table' || saved === 'grid' || saved === 'list') {
        return saved;
      }
    }
    return 'list'; // Default: mỗi đề 1 dòng
  });

  const handleSetDisplayMode = (mode: ExamDisplayMode) => {
    setDisplayMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('edutest_exam_manager_mode', mode);
    }
  };

  // Teacher teaching scope
  const [teacherScope, setTeacherScope] = useState<TeacherScopeConfig>(getTeacherScope());
  const [showScopeModal, setShowScopeModal] = useState<boolean>(false);
  const [onlyTeachingScope, setOnlyTeachingScope] = useState<boolean>(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'trial' | 'hidden'>('all');
  const [showHiddenExams, setShowHiddenExams] = useState(false);

  // Modals & Action Targets
  const [shuffledModalExam, setShuffledModalExam] = useState<Exam | null>(null);
  const [shuffledModalQuestions, setShuffledModalQuestions] = useState<Question[]>([]);
  const [previewExam, setPreviewExam] = useState<Exam | null>(null);
  const [shareExamTarget, setShareExamTarget] = useState<Exam | null>(null);
  const [printTarget, setPrintTarget] = useState<{ exam: Exam; mode: 'exam' | 'answer_key' } | null>(null);
  const [omrScannerExam, setOmrScannerExam] = useState<Exam | null>(null);
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Security Code Modal State
  const [securityModalExam, setSecurityModalExam] = useState<Exam | null>(null);
  const [securityExamCode, setSecurityExamCode] = useState<string>('');
  const [isSecurityEnabled, setIsSecurityEnabled] = useState<boolean>(false);
  const [isSavingSecurity, setIsSavingSecurity] = useState<boolean>(false);

  // Google Form Modal State
  const [googleFormModalExam, setGoogleFormModalExam] = useState<Exam | null>(null);

  // Homepage Pinned Exams Configuration Modal State
  const [showPinConfigModal, setShowPinConfigModal] = useState<boolean>(false);
  const [homepageSettings, setHomepageSettings] = useState<HomepageSettings>(DEFAULT_HOMEPAGE_SETTINGS);

  // Menu Dropdown ID state (to ensure only 1 menu is open at a time)
  const [activeMenuExamId, setActiveMenuExamId] = useState<string | null>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getHomepageSettings().then(setHomepageSettings).catch(() => {});
  }, []);

  // Close active dropdown menu when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setActiveMenuExamId(null);
      }
    };
    if (activeMenuExamId) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [activeMenuExamId]);

  const handleOpenSecurityModal = (exam: Exam) => {
    setActiveMenuExamId(null);
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
    setActiveMenuExamId(null);
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
    setActiveMenuExamId(null);
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
    setActiveMenuExamId(null);
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

  const allGrades = ['6', '7', '8', '9', '10', '11', '12'];

  const filteredExams = exams.filter(e => {
    // Hidden filter
    if (statusFilter === 'hidden') {
      if (!e.isHidden) return false;
    } else if (!showHiddenExams && e.isHidden) {
      return false;
    }

    // Scope filter (Toán 6, Tin 6-9)
    if (onlyTeachingScope && !isExamInTeacherScope(e, teacherScope)) {
      return false;
    }

    // Status filter
    if (statusFilter === 'published' && !e.isPublished) return false;
    if (statusFilter === 'draft' && e.isPublished) return false;
    if (statusFilter === 'trial' && !e.isTrial) return false;

    const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (e.trialCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (e.examCode || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSub = selectedSubject === 'all' || e.subjectId === selectedSubject || e.subjectName === selectedSubject;
    const matchesGrade = selectedGrade === 'all' || e.grade === selectedGrade;
    return matchesSearch && matchesSub && matchesGrade;
  });

  const handleOpenShuffledModal = async (targetExam: Exam) => {
    setActiveMenuExamId(null);
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
    setActiveMenuExamId(null);
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
    const nextStatus = !exam.isPublished;
    try {
      await toggleExamPublish(exam.id, nextStatus);
      await logSystemAction(
        nextStatus ? 'PUBLISH_EXAM' : 'UNPUBLISH_EXAM',
        user?.uid || 'unknown',
        user?.email || 'unknown',
        exam.id,
        'exam',
        nextStatus ? `Mở kỳ thi "${exam.title}"` : `Đóng kỳ thi "${exam.title}"`
      );
      showSuccess(nextStatus ? `Đã mở kỳ thi "${exam.title}" cho học sinh.` : `Đã tạm đóng kỳ thi "${exam.title}".`);
      onRefreshExams();
    } catch (err) {
      console.error('Không thể cập nhật trạng thái đề thi:', err);
      showError('Lỗi cập nhật trạng thái đề thi.');
    }
  };

  const handleToggleHide = async (exam: Exam) => {
    setActiveMenuExamId(null);
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
    setActiveMenuExamId(null);
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
    setActiveMenuExamId(null);
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
    setActiveMenuExamId(null);
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

  // Render 3-dot dropdown menu for a specific exam
  const renderRowDropdownMenu = (exam: Exam) => {
    const isMenuOpen = activeMenuExamId === exam.id;
    const isShuffled = exam.shuffleQuestions || exam.shuffleOptions;

    return (
      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActiveMenuExamId(isMenuOpen ? null : exam.id);
          }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Tùy chọn khác (In đề, Xuất Word, OMR, Google Form, Bảo mật...)"
          aria-label="Tùy chọn khác"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {isMenuOpen && (
          <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-40 animate-in fade-in zoom-in-95 duration-100 text-xs divide-y divide-slate-100">
            {/* Nhóm 1: Xem & Chia sẻ */}
            <div className="py-1">
              <button
                type="button"
                onClick={() => { setActiveMenuExamId(null); setPreviewExam(exam); }}
                className="w-full px-3.5 py-1.5 text-left font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Xem trước đề thi</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveMenuExamId(null); setShareExamTarget(exam); }}
                className="w-full px-3.5 py-1.5 text-left font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5 text-teal-600" />
                <span>Chia sẻ link &amp; Mã QR</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenShuffledModal(exam)}
                className="w-full px-3.5 py-1.5 text-left font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5 text-indigo-600" />
                <span>Mã đề đảo &amp; Hoán vị</span>
              </button>
            </div>

            {/* Nhóm 2: In ấn & Xuất Word & Chấm OMR */}
            <div className="py-1">
              <button
                type="button"
                onClick={() => handleExportWordDirect(exam, 'exam')}
                disabled={exportingWordExamId === exam.id}
                className="w-full px-3.5 py-1.5 text-left font-medium text-blue-700 hover:bg-blue-50 flex items-center gap-2 cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-blue-600" />
                <span>Xuất Đề thi (Word .docx)</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportWordDirect(exam, 'answers')}
                disabled={exportingWordExamId === exam.id}
                className="w-full px-3.5 py-1.5 text-left font-medium text-blue-700 hover:bg-blue-50 flex items-center gap-2 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Xuất Đáp án (Word .docx)</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveMenuExamId(null); setPrintTarget({ exam, mode: 'exam' }); }}
                className="w-full px-3.5 py-1.5 text-left font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>In đề thi chuẩn A4</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveMenuExamId(null); setPrintTarget({ exam, mode: 'answer_key' }); }}
                className="w-full px-3.5 py-1.5 text-left font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>In đáp án chuẩn A4</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveMenuExamId(null); setOmrScannerExam(exam); }}
                className="w-full px-3.5 py-1.5 text-left font-medium text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-600" />
                <span>Chấm phiếu OMR offline</span>
              </button>

              <button
                type="button"
                onClick={() => handleRecalculateExam(exam)}
                disabled={recalculatingExamId === exam.id}
                className="w-full px-3.5 py-1.5 text-left font-medium text-indigo-700 hover:bg-indigo-50 flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${recalculatingExamId === exam.id ? 'animate-spin' : ''}`} />
                <span>Cập nhật lại điểm thi</span>
              </button>
            </div>

            {/* Nhóm 3: Cài đặt đề thi & Trạng thái */}
            <div className="py-1">
              <button
                type="button"
                onClick={() => handleOpenSecurityModal(exam)}
                className="w-full px-3.5 py-1.5 text-left font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
              >
                <Key className="w-3.5 h-3.5 text-amber-600" />
                <span>{exam.examCode ? `Đổi mã bảo mật (${exam.examCode})` : 'Đặt mã bảo mật đề thi'}</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveMenuExamId(null); setGoogleFormModalExam(exam); }}
                className="w-full px-3.5 py-1.5 text-left font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                <span>{exam.googleFormUrl ? 'Cài đặt Google Form' : '+ Tạo Google Form dự phòng'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleShuffle(exam)}
                className="w-full px-3.5 py-1.5 text-left font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
              >
                <Shuffle className={`w-3.5 h-3.5 ${isShuffled ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{isShuffled ? 'Tắt chế độ trộn đề' : 'Bật chế độ trộn đề'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleTabWarning(exam)}
                className="w-full px-3.5 py-1.5 text-left font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                <span>{exam.enableTabWarning ? 'Tắt cảnh báo rời tab' : 'Bật cảnh báo rời tab'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleTrial(exam)}
                className="w-full px-3.5 py-1.5 text-left font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
              >
                <Star className="w-3.5 h-3.5 text-amber-500" />
                <span>{exam.isTrial ? 'Tắt chế độ thi thử tự do' : 'Bật thi thử tự do'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleTogglePin(exam)}
                className="w-full px-3.5 py-1.5 text-left font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
              >
                <Pin className={`w-3.5 h-3.5 ${exam.isPinned ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
                <span>{exam.isPinned ? 'Bỏ ghim khỏi trang chủ' : 'Ghim đề lên trang chủ'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleHide(exam)}
                className="w-full px-3.5 py-1.5 text-left font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
              >
                {exam.isHidden ? <Eye className="w-3.5 h-3.5 text-slate-500" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
                <span>{exam.isHidden ? 'Hiện lại đề thi' : 'Tạm ẩn đề thi'}</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveMenuExamId(null); setExamToDelete(exam); }}
                className="w-full px-3.5 py-1.5 text-left font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Xóa đề thi vĩnh viễn</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200" ref={menuContainerRef}>
      
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

      {/* 1. Header Toolbar (Gọn gàng, chuẩn SaaS) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
            Quản lý Ngân hàng Đề thi &amp; Kỳ thi
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Soạn đề, phân công lớp thi, theo dõi kết quả và xuất đề thi chuẩn Bộ GD&amp;ĐT
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowPinConfigModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:border-teal-500 hover:text-teal-700 bg-white text-slate-700 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            title="Cấu hình số lượng đề ghim, môn ghim và thứ tự ưu tiên trên trang chủ"
          >
            <Pin className="w-3.5 h-3.5 text-teal-600 fill-teal-600" />
            <span>Cấu hình ghim</span>
          </button>

          <button
            type="button"
            onClick={() => setShowScopeModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-slate-700 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            title="Tùy chỉnh môn & khối đang giảng dạy"
          >
            <Settings2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>Môn phụ trách</span>
          </button>

          <button
            type="button"
            onClick={onOpenWordUpload}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer active:scale-95"
          >
            <FileUp className="w-4 h-4" />
            <span>+ Soạn đề Word / PDF</span>
          </button>
        </div>
      </div>

      {/* 2. Sleek Filter Bar (Tối giản, hỗ trợ lọc theo khối, môn kèm icon, tìm kiếm và chọn chế độ xem) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        
        {/* Top filter row: Grade pills + Display Mode switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Grade filter pills with horizontal scroll */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-400" />
              Khối:
            </span>
            <button
              type="button"
              onClick={() => setSelectedGrade('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedGrade === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả
            </button>
            {allGrades.map(g => (
              <button
                key={`mgr-grade-${g}`}
                type="button"
                onClick={() => setSelectedGrade(g)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  selectedGrade === g
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Khối {g}
              </button>
            ))}
          </div>

          {/* 3 Display Mode Buttons */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start sm:self-auto border border-slate-200/60 shrink-0">
            <button
              type="button"
              onClick={() => handleSetDisplayMode('list')}
              className={`p-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                displayMode === 'list'
                  ? 'bg-white text-teal-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Chế độ 1: Danh sách mỗi đề một dòng (Mặc định)"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">1 dòng</span>
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

        {/* Second filter row: Search, Subject selector with icon, Status selector, Hidden toggle */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1 border-t border-slate-100">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm kiếm đề thi theo tên hoặc mã đề..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-500 focus:outline-none"
            />
          </div>

          {/* Subject selector with clear icon */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-0.5">
            {getSubjectIcon(selectedSubject === 'all' ? undefined : selectedSubject)}
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="py-1 text-xs font-medium bg-transparent border-none focus:outline-none text-slate-700 cursor-pointer"
            >
              <option value="all">Tất cả môn học</option>
              {subjects.map(s => (
                <option key={s.id || s.code} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Status selector */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-700 cursor-pointer"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="published">Đang mở thi</option>
            <option value="draft">Bản nháp / Đang đóng</option>
            <option value="trial">⭐ Đề thi thử tự do</option>
            <option value="hidden">Đề đã bị ẩn</option>
          </select>

          {/* Count tag */}
          <span className="text-xs font-bold text-slate-400 shrink-0 self-center hidden md:inline">
            {filteredExams.length} đề thi
          </span>
        </div>

      </div>

      {/* 3. EXAMS LISTING (Tùy chọn chế độ xem: 1 dòng, Bảng, Lưới) */}

      {/* =================================================================== */}
      {/* CHẾ ĐỘ 1: MỖI ĐỀ 1 DÒNG (List mode - Mặc định)                     */}
      {/* =================================================================== */}
      {displayMode === 'list' && (
        <div className="space-y-2.5">
          {filteredExams.map((exam) => {
            const isShuffled = exam.shuffleQuestions || exam.shuffleOptions;

            return (
              <div 
                key={exam.id}
                className={`group bg-white hover:bg-slate-50/80 rounded-xl border transition-all p-3 sm:px-4 sm:py-3 shadow-2xs hover:shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  exam.isHidden ? 'opacity-60 border-dashed border-slate-300' : 'border-slate-200/90 hover:border-teal-300'
                }`}
              >
                {/* Left: Subject Icon + Title + Quiet Metadata */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {/* Subject Icon Box */}
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 group-hover:border-teal-200 group-hover:bg-teal-50/50 transition-colors">
                    {getSubjectIcon(exam.subjectName)}
                  </div>

                  {/* Exam Title & Quiet Metadata */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 
                        onClick={() => setPreviewExam(exam)}
                        className="text-sm font-bold text-slate-900 truncate hover:text-teal-700 cursor-pointer transition-colors"
                        title="Bấm để xem chi tiết đề thi"
                      >
                        {exam.title}
                      </h3>

                      {/* Status Badges */}
                      <button
                        type="button"
                        onClick={() => handleTogglePublish(exam)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition-colors ${
                          exam.isPublished
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                        }`}
                        title={exam.isPublished ? "Đang mở thi. Bấm để đóng." : "Đang đóng/nháp. Bấm để mở."}
                      >
                        {exam.isPublished ? '● Đang mở' : '○ Bản nháp'}
                      </button>

                      {exam.examCode && (
                        <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded">
                          🔒 {exam.examCode}
                        </span>
                      )}

                      {isShuffled && (
                        <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded flex items-center gap-1">
                          <Shuffle className="w-3 h-3 text-indigo-600" />
                          Trộn đề
                        </span>
                      )}

                      {exam.isPinned && (
                        <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded flex items-center gap-1">
                          <Pin className="w-3 h-3 text-amber-500 fill-amber-500" />
                          Ghim
                        </span>
                      )}
                    </div>

                    {/* Metadata line with subtle dot separators */}
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                      <span className="font-semibold text-slate-700">{exam.subjectName || 'Chung'}</span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span>Khối {exam.grade || '?'}</span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{exam.durationMinutes} phút</span>
                      </span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-slate-400" />
                        <span>{exam.questionCount || 0} câu</span>
                      </span>
                      {exam.classIds && exam.classIds.length > 0 && (
                        <>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="text-slate-400 truncate max-w-[130px]">
                            Lớp: {exam.classIds.join(', ')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Actions: Important actions stand out, rest in 3-dot menu */}
                <div className="flex items-center gap-2 justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  {/* Sửa đề button (Icon) */}
                  {onEditExam && (
                    <button
                      type="button"
                      onClick={() => onEditExam(exam)}
                      className="p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition-colors cursor-pointer flex items-center justify-center"
                      title="Chỉnh sửa nội dung đề thi & câu hỏi"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}

                  {/* Nút quan trọng: XEM KẾT QUẢ / BẢNG ĐIỂM (Màu Teal nổi bật) */}
                  <button
                    type="button"
                    onClick={() => onViewResults(exam)}
                    className="px-3.5 py-2 min-h-[36px] rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
                    title="Xem chi tiết điểm số, xếp hạng và chấm bài học sinh"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Kết quả &amp; Chấm thi</span>
                  </button>

                  {/* 3-dot dropdown menu containing secondary actions */}
                  {renderRowDropdownMenu(exam)}
                </div>
              </div>
            );
          })}

          {filteredExams.length === 0 && (
            <div className="p-10 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 space-y-2">
              <BookOpen className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-semibold text-slate-600">
                Không tìm thấy đề thi nào phù hợp với bộ lọc hiện tại.
              </p>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* CHẾ ĐỘ 2: DẠNG BẢNG (Table mode)                                   */}
      {/* =================================================================== */}
      {displayMode === 'table' && (
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
                {filteredExams.map(exam => (
                  <tr key={`mgr-table-${exam.id}`} className="hover:bg-slate-50/70 border-b border-slate-200/80 transition-colors">
                    <td className="py-3 px-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                          {getSubjectIcon(exam.subjectName)}
                        </div>
                        <div className="min-w-0 max-w-sm sm:max-w-md">
                          <span 
                            onClick={() => setPreviewExam(exam)}
                            className="font-bold text-xs sm:text-sm text-slate-900 hover:text-teal-700 cursor-pointer line-clamp-1"
                            title={exam.title}
                          >
                            {exam.title}
                          </span>
                          {exam.classIds && exam.classIds.length > 0 && (
                            <span className="text-[11px] text-slate-400 block truncate">
                              Lớp: {exam.classIds.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-xs font-semibold text-slate-700 whitespace-nowrap">
                      {exam.subjectName || 'Chung'}
                    </td>

                    <td className="py-3 px-3 text-xs font-medium text-slate-600 whitespace-nowrap">
                      Khối {exam.grade || '?'}
                    </td>

                    <td className="py-3 px-3 text-xs text-slate-600 whitespace-nowrap">
                      {exam.durationMinutes} phút
                    </td>

                    <td className="py-3 px-3 text-xs text-slate-600 whitespace-nowrap">
                      {exam.questionCount || 0} câu
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleTogglePublish(exam)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer ${
                          exam.isPublished
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {exam.isPublished ? 'Đang mở' : 'Bản nháp'}
                      </button>
                    </td>

                    <td className="py-3 px-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onViewResults(exam)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-all flex items-center gap-1 shadow-2xs"
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                          <span>Kết quả</span>
                        </button>
                        {onEditExam && (
                          <button
                            type="button"
                            onClick={() => onEditExam(exam)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition-colors"
                            title="Sửa đề"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {renderRowDropdownMenu(exam)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredExams.length === 0 && (
            <div className="p-10 text-center text-slate-400 text-xs">
              Không tìm thấy đề thi phù hợp.
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* CHẾ ĐỘ 3: DẠNG THẺ LƯỚI GỌN (Grid card mode)                       */}
      {/* =================================================================== */}
      {displayMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredExams.map((exam) => (
            <div 
              key={`mgr-grid-${exam.id}`}
              className="group bg-white hover:bg-slate-50/50 rounded-2xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between space-y-3"
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                    {getSubjectIcon(exam.subjectName)}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block leading-tight">
                      {exam.subjectName || 'Chung'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Khối {exam.grade || '?'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleTogglePublish(exam)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer ${
                      exam.isPublished
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {exam.isPublished ? 'Mở thi' : 'Nháp'}
                  </button>
                  {renderRowDropdownMenu(exam)}
                </div>
              </div>

              {/* Title */}
              <h3 
                onClick={() => setPreviewExam(exam)}
                className="font-bold text-sm text-slate-900 group-hover:text-teal-700 cursor-pointer line-clamp-2 leading-snug transition-colors"
                title={exam.title}
              >
                {exam.title}
              </h3>

              {/* Metadata */}
              <div className="flex items-center gap-3 text-xs text-slate-500 pt-1">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{exam.durationMinutes} phút</span>
                </span>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                  <span>{exam.questionCount || 0} câu</span>
                </span>
              </div>

              {/* Footer */}
              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                {onEditExam && (
                  <button
                    type="button"
                    onClick={() => onEditExam(exam)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 text-xs font-semibold flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Sửa</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onViewResults(exam)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white transition-all flex items-center gap-1.5 shadow-2xs"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Kết quả &amp; Chấm thi</span>
                </button>
              </div>
            </div>
          ))}

          {filteredExams.length === 0 && (
            <div className="col-span-full p-10 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400">
              Không tìm thấy đề thi phù hợp.
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. MODALS & SUB-COMPONENTS                                         */}
      {/* =================================================================== */}

      {/* Teacher Teaching Scope Modal */}
      <TeacherScopeModal
        isOpen={showScopeModal}
        onClose={() => setShowScopeModal(false)}
        currentScope={teacherScope}
        onSaveScope={(newScope: TeacherScopeConfig) => {
          setTeacherScope(newScope);
          showSuccess('Đã cập nhật phạm vi môn & khối giảng dạy thành công!');
        }}
      />

      {/* Shuffled Exam Export Modal */}
      {shuffledModalExam && (
        <ShuffledExamExportModal
          isOpen={shuffledModalExam !== null}
          exam={shuffledModalExam}
          questions={shuffledModalQuestions}
          onClose={() => {
            setShuffledModalExam(null);
            setShuffledModalQuestions([]);
          }}
        />
      )}

      {/* Exam Preview Modal */}
      {previewExam && (
        <ExamPreviewModal
          isOpen={previewExam !== null}
          exam={previewExam}
          onClose={() => setPreviewExam(null)}
          onEditExam={(exam) => {
            setPreviewExam(null);
            if (onEditExam) onEditExam(exam);
          }}
        />
      )}

      {/* Share Exam Modal */}
      {shareExamTarget && (
        <ShareExamModal
          isOpen={shareExamTarget !== null}
          exam={shareExamTarget}
          onClose={() => setShareExamTarget(null)}
        />
      )}

      {/* Exam Print (A4) Modal */}
      {printTarget && (
        <ExamPrintModal
          isOpen={printTarget !== null}
          exam={printTarget.exam}
          mode={printTarget.mode}
          onClose={() => setPrintTarget(null)}
        />
      )}

      {/* OMR Scanner Modal */}
      {omrScannerExam && (
        <OMRScannerModal
          isOpen={Boolean(omrScannerExam)}
          exam={omrScannerExam}
          classes={classes}
          onClose={() => setOmrScannerExam(null)}
          onGradedSuccess={() => {
            onRefreshExams();
            showSuccess('Đã cập nhật kết quả chấm bài OMR vào cơ sở dữ liệu!');
          }}
        />
      )}

      {/* Exam Security Code Modal */}
      {securityModalExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Thiết lập mã bảo mật đề thi</h3>
                    <p className="text-[11px] text-slate-500 truncate max-w-[240px]">{securityModalExam.title}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSecurityModalExam(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSecurityEnabled}
                    onChange={(e) => setIsSecurityEnabled(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <div className="text-xs">
                    <p className="font-bold text-slate-800">Yêu cầu mã bảo mật khi vào thi</p>
                    <p className="text-[11px] text-slate-500">
                      Học sinh phải nhập đúng mã bảo mật này để được phép mở đề thi.
                    </p>
                  </div>
                </label>

                {isSecurityEnabled && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      Mã bảo mật (Security Code):
                    </label>
                    <input
                      type="text"
                      value={securityExamCode}
                      onChange={(e) => setSecurityExamCode(e.target.value.toUpperCase())}
                      placeholder="Ví dụ: TOAN6-GK1, MATH-2025"
                      className="w-full px-3.5 py-2 text-xs font-mono font-bold uppercase tracking-wider bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSecurityModalExam(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isSavingSecurity || (isSecurityEnabled && !securityExamCode.trim())}
                  onClick={handleSaveSecurityCode}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingSecurity ? 'Đang lưu...' : 'Lưu thiết lập bảo mật'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Exam Confirmation Modal */}
      <ConfirmModal
        isOpen={examToDelete !== null}
        title={`Xóa đề thi "${examToDelete?.title}"?`}
        message="Hành động này sẽ xóa vĩnh viễn đề thi, toàn bộ câu hỏi và các kết quả liên quan. Thao tác không thể hoàn tác."
        confirmText="Xóa đề thi"
        onConfirm={confirmDelete}
        onCancel={() => setExamToDelete(null)}
      />

      {/* Google Form Integration Modal */}
      {googleFormModalExam && (
        <GoogleFormModal
          isOpen={Boolean(googleFormModalExam)}
          onClose={() => setGoogleFormModalExam(null)}
          exam={googleFormModalExam}
          onExamUpdated={onRefreshExams}
        />
      )}

      {/* Pinned Exams Homepage Configuration Modal */}
      <PinnedExamsConfigModal
        isOpen={showPinConfigModal}
        onClose={() => setShowPinConfigModal(false)}
        exams={exams}
        subjects={subjects}
        currentSettings={homepageSettings}
        onSaved={(newSettings) => {
          setHomepageSettings(newSettings);
          showSuccess('Đã cập nhật cấu hình đề ghim trang chủ thành công!');
          onRefreshExams();
        }}
      />
    </div>
  );
};
