import React, { useState } from 'react';
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
  Play
} from 'lucide-react';
import { Exam, Question } from '../../types';
import { exportExamToPptx, PptxPresentationMode } from '../../utils/pptxExportUtils';
import { getExamQuestions } from '../../services/db';

interface PowerPointExportModalProps {
  isOpen: boolean;
  exam: Exam;
  onClose: () => void;
}

export const PowerPointExportModal: React.FC<PowerPointExportModalProps> = ({
  isOpen,
  exam,
  onClose
}) => {
  const [selectedMode, setSelectedMode] = useState<PptxPresentationMode>('click_reveal');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '4:3'>('16:9');
  const [fontFamily, setFontFamily] = useState<string>('Arial');
  const [theme, setTheme] = useState<'light-clean' | 'slate-dark' | 'navy-blue'>('light-clean');
  const [slideTransition, setSlideTransition] = useState<'morph' | 'fade' | 'none'>('morph');
  const [includeCoverSlide, setIncludeCoverSlide] = useState<boolean>(true);
  const [includeEndingSlide, setIncludeEndingSlide] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setErrorMessage(null);
    try {
      const questions = await getExamQuestions(exam.id);
      if (!questions || questions.length === 0) {
        setErrorMessage('Đề thi chưa có câu hỏi nào để xuất PowerPoint.');
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
        includeEndingSlide
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
      mode: 'click_reveal',
      title: 'Hiệu ứng nhấp chuột hiện đáp án đúng',
      desc: 'Lúc đầu chỉ xuất hiện câu hỏi và 4 phương án neutral. Giáo viên nhấp chuột thì đáp án đúng mới đổi nền xanh và hiện dấu tích ✓.',
      badge: 'KHUYÊN DÙNG',
      isRecommended: true
    },
    {
      mode: 'questions_only',
      title: 'Chỉ xuất đề thi (Không có đáp án)',
      desc: 'Dành cho tổ chức thi hoặc kiểm tra trên lớp. Không có slide đáp án nào bị lộ.',
      badge: 'KIỂM TRA'
    },
    {
      mode: 'answers_always',
      title: 'Hiện sẵn đáp án đúng',
      desc: 'Mỗi slide câu hỏi đã được đánh dấu sẵn đáp án đúng màu xanh. Thích hợp chữa bài trực tiếp hoặc gửi cho học sinh tham khảo.',
      badge: 'CHỮA BÀI'
    },
    {
      mode: 'with_explanations',
      title: 'Kèm slide lời giải chi tiết',
      desc: 'Bao gồm slide câu hỏi + đáp án và bổ sung thêm slide lời giải chi tiết từng bước cho mỗi câu.',
      badge: 'CHI TIẾT'
    },
    {
      mode: 'answers_only',
      title: 'Chỉ xuất bảng đáp án tổng hợp',
      desc: 'Slide ma trận tổng hợp nhanh đáp án của toàn bộ đề thi.',
      badge: 'BẢNG ĐÁP ÁN'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:px-6 sm:py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Presentation className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Tùy chọn Xuất PowerPoint Trình Chiếu (.pptx)
                <span className="text-[10px] bg-amber-500 text-slate-900 px-2 py-0.5 rounded-full font-black">
                  ANIMATION &amp; MORPH
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                1 slide/câu hỏi, công thức toán học sắc nét, tương thích Microsoft PowerPoint
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

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/50">
          
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
              {errorMessage}
            </div>
          )}

          {/* Mode Selection */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Chế độ trình chiếu &amp; Hiệu ứng đáp án:
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

          {/* Slide Layout & Design Config */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3.5 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Cấu hình bố cục &amp; Giao diện trình chiếu:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Aspect Ratio */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-600 flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-slate-400" />
                  <span>Tỷ lệ khung hình Slide:</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAspectRatio('16:9')}
                    className={`py-2 px-3 rounded-xl font-bold transition-all ${
                      aspectRatio === '16:9' ? 'bg-amber-500 text-slate-950 shadow-2xs' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    16:9 (Màn rộng)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAspectRatio('4:3')}
                    className={`py-2 px-3 rounded-xl font-bold transition-all ${
                      aspectRatio === '4:3' ? 'bg-amber-500 text-slate-950 shadow-2xs' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    4:3 (Tiêu chuẩn)
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  <option value="Arial">Arial (Chuẩn, nét chữ đậm rõ từ xa)</option>
                  <option value="Plus Jakarta Sans">Plus Jakarta Sans (Giao diện EduTest)</option>
                  <option value="Calibri">Calibri (Microsoft Office mặc định)</option>
                  <option value="Times New Roman">Times New Roman (Truyền thống)</option>
                </select>
              </div>

              {/* Slide Transitions */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-600">Hiệu ứng chuyển cảnh (Transition): </label>
                <select
                  value={slideTransition}
                  onChange={(e) => setSlideTransition(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  <option value="morph">Morph / Mượt mà (Khuyên dùng)</option>
                  <option value="fade">Fade (Mờ dần)</option>
                  <option value="none">Không hiệu ứng chuyển cảnh</option>
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
                <span>Kèm Slide mở đầu (Cover Slide)</span>
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

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl"
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Đang tạo Slide PowerPoint...' : 'Tải file PowerPoint (.pptx)'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
