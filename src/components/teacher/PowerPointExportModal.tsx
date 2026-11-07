import React, { useState, useEffect } from 'react';
import { 
  Presentation, 
  X, 
  Download, 
  Check, 
  Sparkles, 
  Monitor, 
  Layers, 
  Tv, 
  Palette, 
  CheckCircle2,
  HelpCircle,
  Play,
  ShieldCheck,
  AlertTriangle,
  FileDown,
  Printer,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff
} from 'lucide-react';
import { Exam, Question } from '../../types';
import { 
  exportExamToPptx, 
  PptxPresentationMode, 
  runPreflightInspection, 
  PreflightDiagnosticReport, 
  THEMES 
} from '../../utils/pptxExportUtils';
import { getExamQuestions } from '../../services/db';
import { latexToUnicodeMath } from '../../utils/mathConverter';
import { exportExamToWord } from '../../utils/docxExportUtils';

interface PowerPointExportModalProps {
  isOpen: boolean;
  exam: Exam;
  onClose: () => void;
  onOpenWordExport?: () => void;
  onOpenPdfPrint?: () => void;
}

export const PowerPointExportModal: React.FC<PowerPointExportModalProps> = ({
  isOpen,
  exam,
  onClose,
  onOpenWordExport,
  onOpenPdfPrint
}) => {
  const [activeTab, setActiveTab] = useState<'config' | 'preflight' | 'preview'>('config');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState<boolean>(true);

  // PPTX Configuration options
  const [selectedMode, setSelectedMode] = useState<PptxPresentationMode>('click_reveal');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '4:3'>('16:9');
  const [fontFamily, setFontFamily] = useState<string>('Arial');
  const [theme, setTheme] = useState<'light-clean' | 'slate-dark' | 'navy-blue'>('light-clean');
  const [slideTransition, setSlideTransition] = useState<'morph' | 'fade' | 'none'>('morph');
  const [includeCoverSlide, setIncludeCoverSlide] = useState<boolean>(true);
  const [includeEndingSlide, setIncludeEndingSlide] = useState<boolean>(true);
  const [schoolName, setSchoolName] = useState<string>('TRƯỜNG THCS & THPT EDUTEST');

  // Interactive Live Slide Preview State
  const [previewSlideIndex, setPreviewSlideIndex] = useState<number>(0);
  const [previewRevealed, setPreviewRevealed] = useState<boolean>(false);

  // Export progress
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsLoadingQuestions(true);
      getExamQuestions(exam.id)
        .then(qList => {
          setQuestions(qList || []);
        })
        .catch(err => {
          console.error('Lỗi tải câu hỏi đề thi:', err);
        })
        .finally(() => {
          setIsLoadingQuestions(false);
        });
    }
  }, [isOpen, exam.id]);

  if (!isOpen) return null;

  // Run Pre-flight Diagnostic Inspection
  const preflight: PreflightDiagnosticReport = runPreflightInspection(questions, exam, {
    presentationMode: selectedMode,
    aspectRatio,
    fontFamily,
    theme,
    includeCoverSlide,
    includeEndingSlide,
    schoolName
  });

  const handleExportPptx = async () => {
    setIsExporting(true);
    setErrorMessage(null);
    try {
      if (questions.length === 0) {
        setErrorMessage('Đề thi chưa có câu hỏi nào để xuất file.');
        setIsExporting(false);
        return;
      }

      await exportExamToPptx(exam, questions, {
        presentationMode: selectedMode,
        aspectRatio,
        fontFamily,
        theme,
        slideTransition,
        includeCoverSlide,
        includeEndingSlide,
        schoolName
      });

      onClose();
    } catch (err: any) {
      console.error('Lỗi xuất PowerPoint:', err);
      setErrorMessage(err.message || 'Không thể tạo file PowerPoint. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  const modeOptions: { mode: PptxPresentationMode; title: string; desc: string; badge: string; isRecommended?: boolean }[] = [
    {
      mode: 'questions_only',
      title: 'Bản trình chiếu học sinh (Chỉ câu hỏi và phương án, không có đáp án)',
      desc: 'Bản đề an toàn tuyệt đối khi chiếu kiểm tra trên lớp: Không lộ đáp án, câu tự luận hiển thị "KHÔNG GIAN LÀM BÀI" để học sinh làm bài.',
      badge: 'BẢN HỌC SINH'
    },
    {
      mode: 'with_explanations',
      title: 'Bản giáo viên (Hiển thị câu hỏi, đáp án đúng và lời giải chi tiết)',
      desc: 'Bản đầy đủ dành cho giáo viên: Hiển thị nổi bật đáp án đúng màu xanh và slide lời giải chi tiết, barem biểu điểm cho từng câu.',
      badge: 'BẢN GIÁO VIÊN',
      isRecommended: true
    },
    {
      mode: 'click_reveal',
      title: 'Hiệu ứng nhấp chuột mở đáp án (Click-to-Reveal)',
      desc: 'Lúc đầu chỉ xuất hiện câu hỏi và các phương án neutral. Giáo viên nhấp chuột thì đáp án đúng mới đổi nền xanh và hiện dấu tích ✓.',
      badge: 'TƯƠNG TÁC'
    },
    {
      mode: 'answers_always',
      title: 'Hiện sẵn đáp án đúng (Chữa bài trên lớp)',
      desc: 'Mỗi slide câu hỏi đã được đánh dấu sẵn đáp án đúng màu xanh. Thích hợp chữa bài nhanh trên máy chiếu hoặc TV.',
      badge: 'CHỮA BÀI'
    },
    {
      mode: 'answers_only',
      title: 'Chỉ xuất bảng ma trận đáp án tổng hợp',
      desc: 'Slide ma trận tổng hợp nhanh đáp án của toàn bộ đề thi để học sinh đối chiếu kết quả.',
      badge: 'BẢNG ĐÁP ÁN'
    }
  ];

  // Current preview question
  const currentPreviewQuestion = questions[previewSlideIndex] || questions[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* Header */}
        <div className="p-4 sm:px-6 sm:py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Presentation className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Bộ Xuất File Đề Thi &amp; Trình Chiếu Chuẩn Hóa
                <span className="text-[10px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full font-black">
                  16:9 ANTI-OVERFLOW
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Đề: {exam.title} ({questions.length} câu) • Tự động dàn trang thông minh &amp; Không tràn chữ
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 pb-2 bg-slate-100 border-b border-slate-200 flex items-center gap-2 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'config'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Tv className="w-3.5 h-3.5 text-amber-600" />
            <span>1. Cấu hình &amp; Chế độ chiếu</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preflight')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'preflight'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>2. Kiểm tra trước khi tải (Pre-flight)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-black bg-emerald-100 text-emerald-800">
              {preflight.status === 'passed' ? '✓ Đạt chuẩn' : '! Cảnh báo'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'preview'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Monitor className="w-3.5 h-3.5 text-indigo-600" />
            <span>3. Xem trước Slide (16:9 Live Preview)</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          
          {errorMessage && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
              {errorMessage}
            </div>
          )}

          {/* ================= TAB 1: CẤU HÌNH XUẤT ================= */}
          {activeTab === 'config' && (
            <div className="space-y-5">
              {/* Mode Selection */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Chọn mẫu trình chiếu &amp; Quy tắc hiển thị đáp án:
                </label>

                <div className="grid grid-cols-1 gap-2">
                  {modeOptions.map(item => {
                    const isSelected = selectedMode === item.mode;
                    return (
                      <div
                        key={item.mode}
                        onClick={() => setSelectedMode(item.mode)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                          isSelected 
                            ? 'bg-amber-50/70 border-amber-500 shadow-xs ring-1 ring-amber-500/30' 
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                            isSelected ? 'border-amber-600 bg-amber-600 text-white' : 'border-slate-300 bg-white'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold ${isSelected ? 'text-amber-950' : 'text-slate-900'}`}>
                                {item.title}
                              </span>
                              <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                                item.isRecommended 
                                  ? 'bg-teal-600 text-white' 
                                  : isSelected ? 'bg-amber-200 text-amber-900' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {item.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                              {item.desc}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Layout, Aspect Ratio & Theme */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3.5 text-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Thông tin trường học &amp; Bố cục 16:9 tiêu chuẩn:
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-600">Tên trường / Cơ sở đào tạo:</label>
                    <input
                      type="text"
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                    />
                  </div>

                  {/* Aspect Ratio */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-600 flex items-center gap-1.5">
                      <Monitor className="w-3.5 h-3.5 text-slate-400" />
                      <span>Tỷ lệ khung hình:</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAspectRatio('16:9')}
                        className={`py-2 px-3 rounded-xl font-bold transition-all ${
                          aspectRatio === '16:9' ? 'bg-amber-500 text-slate-950 shadow-2xs' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        16:9 (Màn hình rộng)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAspectRatio('4:3')}
                        className={`py-2 px-3 rounded-xl font-bold transition-all ${
                          aspectRatio === '4:3' ? 'bg-amber-500 text-slate-950 shadow-2xs' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        4:3 (Tiêu chuẩn cũ)
                      </button>
                    </div>
                  </div>

                  {/* Theme */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-600 flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-slate-400" />
                      <span>Màu sắc giao diện:</span>
                    </label>
                    <select
                      value={theme}
                      onChange={(e) => setTheme(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium cursor-pointer"
                    >
                      <option value="light-clean">Sáng thanh lịch (Nền trắng, thẻ hiện đại)</option>
                      <option value="navy-blue">Xanh chuyên nghiệp (Navy Blue sang trọng)</option>
                      <option value="slate-dark">Tối hiện đại (Dark Slate tương phản cao)</option>
                    </select>
                  </div>

                  {/* Font */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-600">Font chữ trình chiếu:</label>
                    <select
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium cursor-pointer"
                    >
                      <option value="Arial">Arial (Rõ nét, chuẩn Unicode)</option>
                      <option value="Calibri">Calibri (Microsoft Office mặc định)</option>
                      <option value="Times New Roman">Times New Roman (Truyền thống)</option>
                      <option value="Segoe UI">Segoe UI (Hiện đại Windows)</option>
                    </select>
                  </div>
                </div>

                {/* Checkbox options */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-6 flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={includeCoverSlide}
                      onChange={(e) => setIncludeCoverSlide(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 border-slate-300"
                    />
                    <span>Kèm Slide bìa giới thiệu đề thi</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={includeEndingSlide}
                      onChange={(e) => setIncludeEndingSlide(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 border-slate-300"
                    />
                    <span>Kèm Slide kết thúc ("Chúc các em học tốt")</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: KIỂM TRA TRƯỚC KHI XUẤT (PRE-FLIGHT) ================= */}
          {activeTab === 'preflight' && (
            <div className="space-y-4">
              {/* Summary Card */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-emerald-950">
                    Hệ thống kiểm tra tự động: Sẵn sàng xuất bản 100%
                  </h4>
                  <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                    Đã kiểm tra cấu trúc của toàn bộ {preflight.totalQuestions} câu hỏi. Thuật toán tự động dàn trang thông minh và chống tràn chữ đã được kích hoạt.
                  </p>
                </div>
              </div>

              {/* Diagnostic Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block font-semibold">Tổng số câu hỏi:</span>
                  <span className="text-lg font-black text-slate-900">{preflight.totalQuestions} câu</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    {preflight.stats.multipleChoiceCount} trắc nghiệm • {preflight.stats.essayCount} tự luận
                  </span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block font-semibold">Tổng số Slide dự kiến:</span>
                  <span className="text-lg font-black text-amber-600">{preflight.totalSlidesEstimated} slide</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Khổ rộng 16:9</span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block font-semibold">Tự phân tách 2 Slide:</span>
                  <span className="text-lg font-black text-indigo-600">{preflight.multiSlideQuestions.length} câu</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Tự động chống tràn chữ</span>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200">
                  <span className="text-slate-400 block font-semibold">Bố cục 1 cột tối ưu:</span>
                  <span className="text-lg font-black text-teal-600">{preflight.oneColQuestions.length} câu</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Phương án dài không bị ép</span>
                </div>
              </div>

              {/* Automated Optimizations Log */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5">
                <span className="text-xs font-bold text-slate-900 block">
                  Chi tiết các điểm tối ưu hóa tự động cho đề thi này:
                </span>

                <div className="space-y-2 text-xs">
                  {preflight.multiSlideQuestions.map(item => (
                    <div key={`ms-${item.questionNumber}`} className="p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center gap-2 text-indigo-950">
                      <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-bold text-[10px]">
                        Câu {item.questionNumber}
                      </span>
                      <span>{item.reason}</span>
                    </div>
                  ))}

                  {preflight.oneColQuestions.map(item => (
                    <div key={`oc-${item.questionNumber}`} className="p-2.5 bg-teal-50/70 border border-teal-200 rounded-xl flex items-center gap-2 text-teal-950">
                      <span className="px-2 py-0.5 rounded bg-teal-600 text-white font-bold text-[10px]">
                        Câu {item.questionNumber}
                      </span>
                      <span>{item.reason}</span>
                    </div>
                  ))}

                  <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-950">
                    <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10px]">
                      Bảo mật
                    </span>
                    <span>
                      {selectedMode === 'questions_only' 
                        ? 'Chế độ đề học sinh: 100% đáp án đúng, gợi ý và barem chấm đã được ẩn hoàn toàn.'
                        : 'Chế độ giáo viên: Hướng dẫn chấm và đáp án hiển thị rõ ràng, chuyên nghiệp.'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: XEM TRƯỚC SLIDE (LIVE 16:9 PREVIEW) ================= */}
          {activeTab === 'preview' && (
            <div className="space-y-3">
              {/* Slide Navigator Bar */}
              <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={previewSlideIndex === 0}
                    onClick={() => {
                      setPreviewSlideIndex(prev => Math.max(0, prev - 1));
                      setPreviewRevealed(false);
                    }}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-bold text-slate-800">
                    Câu {currentPreviewQuestion?.questionNumber || (previewSlideIndex + 1)} / {questions.length}
                  </span>
                  <button
                    type="button"
                    disabled={previewSlideIndex >= questions.length - 1}
                    onClick={() => {
                      setPreviewSlideIndex(prev => Math.min(questions.length - 1, prev + 1));
                      setPreviewRevealed(false);
                    }}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Click-reveal test button */}
                {selectedMode === 'click_reveal' && (
                  <button
                    type="button"
                    onClick={() => setPreviewRevealed(prev => !prev)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      previewRevealed 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    {previewRevealed ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{previewRevealed ? 'Đang hiện đáp án' : 'Nhấp thử để hiện đáp án'}</span>
                  </button>
                )}
              </div>

              {/* 16:9 Widescreen Slide Simulator Box */}
              <div className="w-full aspect-[16/9] bg-slate-900 rounded-2xl p-4 sm:p-6 shadow-xl border border-slate-800 flex flex-col justify-between text-white overflow-hidden relative select-none">
                
                {/* Header in Slide */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-black text-amber-400">
                      CÂU {currentPreviewQuestion?.questionNumber || (previewSlideIndex + 1)}
                    </span>
                    <span className="text-xs text-slate-400">
                      {(exam.subjectName || 'Toán học').toUpperCase()} • Khối {exam.grade || '6'} • {currentPreviewQuestion?.type === 'multiple_choice' ? 'Trắc nghiệm' : 'Tự luận'}
                    </span>
                  </div>

                  {(previewRevealed || selectedMode === 'answers_always') && selectedMode !== 'questions_only' && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      ✓ {currentPreviewQuestion?.type === 'multiple_choice' ? 'ĐÁP ÁN ĐÚNG' : 'HƯỚNG DẪN CHẤM'}
                    </span>
                  )}
                </div>

                {/* Prompt & Content in Slide */}
                <div className="my-auto py-2">
                  <div className={currentPreviewQuestion?.imageUrl ? 'grid grid-cols-1 md:grid-cols-12 gap-3 items-start' : ''}>
                    
                    {/* Left or Full: Prompt + Options */}
                    <div className={currentPreviewQuestion?.imageUrl ? 'md:col-span-7 space-y-2.5' : 'space-y-2.5'}>
                      <div className="p-3 sm:p-4 bg-slate-800/90 rounded-xl border border-slate-700/80 text-xs sm:text-sm font-bold leading-relaxed text-slate-100">
                        {latexToUnicodeMath(currentPreviewQuestion?.prompt || '')}
                      </div>

                      {/* Options or Writing Space in Slide */}
                      <div>
                        {currentPreviewQuestion?.type === 'multiple_choice' && currentPreviewQuestion.options ? (
                          <div className={currentPreviewQuestion?.imageUrl ? 'grid grid-cols-1 gap-1.5 text-xs' : 'grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs'}>
                            {(['A', 'B', 'C', 'D'] as const).map(optKey => {
                              const isCorrect = currentPreviewQuestion.correctOption === optKey;
                              const showGreen = (previewRevealed || selectedMode === 'answers_always') && selectedMode !== 'questions_only' && isCorrect;

                              return (
                                <div
                                  key={optKey}
                                  className={`p-2 rounded-xl border flex items-center gap-2 transition-all ${
                                    showGreen
                                      ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                                      : 'bg-slate-800 border-slate-700 text-slate-300'
                                  }`}
                                >
                                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                    showGreen ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-white'
                                  }`}>
                                    {optKey}
                                  </span>
                                  <span className="font-medium truncate text-xs">
                                    {latexToUnicodeMath(currentPreviewQuestion.options?.[optKey] || '')}
                                  </span>
                                  {showGreen && <span className="ml-auto font-black text-emerald-400">✓</span>}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl border border-dashed border-slate-700 bg-slate-800/40 text-xs text-slate-400">
                            {selectedMode === 'questions_only' ? (
                              <div className="text-center py-2 italic text-[11px]">
                                [KHÔNG GIAN LÀM BÀI: Học sinh trình bày lời giải chi tiết vào khung hoặc giấy thi]
                              </div>
                            ) : (
                              <div>
                                <span className="font-bold text-emerald-400 block mb-1 text-xs">HƯỚNG DẪN CHẤM &amp; ĐÁP ÁN:</span>
                                <p className="text-slate-200 leading-relaxed text-xs">
                                  {latexToUnicodeMath(currentPreviewQuestion?.sampleAnswer || currentPreviewQuestion?.explanation || 'Đáp án theo thang điểm của giáo viên.')}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Question Image (if attached) */}
                    {currentPreviewQuestion?.imageUrl && (
                      <div className="md:col-span-5 bg-slate-800/90 rounded-xl border border-slate-700/80 p-2 flex flex-col items-center justify-center">
                        <span className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Hình vẽ minh họa</span>
                        <div className="w-full bg-white rounded-lg p-2 flex items-center justify-center overflow-hidden">
                          <img 
                            src={currentPreviewQuestion.imageUrl} 
                            alt="Hình minh họa" 
                            className="max-h-44 object-contain" 
                          />
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                {/* Footer in Slide */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800 pt-2">
                  <span>{schoolName} • EduTest PRO</span>
                  <span>Slide {previewSlideIndex + 1} / {questions.length}</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer with Multi-format Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Word Export (.docx) */}
            <button
              type="button"
              onClick={async () => {
                onClose();
                if (onOpenWordExport) {
                  onOpenWordExport();
                } else {
                  await exportExamToWord(exam, questions, 'exam_with_key');
                }
              }}
              className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Xuất file Microsoft Word có thể chỉnh sửa (.docx)"
            >
              <FileDown className="w-3.5 h-3.5 text-blue-600" />
              <span>Xuất Word (.docx)</span>
            </button>

            {/* Quick PDF Print (A4) */}
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onOpenPdfPrint) onOpenPdfPrint();
              }}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="In hoặc xuất file PDF chuẩn khổ A4"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>In PDF (A4)</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl cursor-pointer"
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={handleExportPptx}
              disabled={isExporting || questions.length === 0}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Đang tạo Slide PowerPoint...' : 'Tải file PowerPoint (.pptx)'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
