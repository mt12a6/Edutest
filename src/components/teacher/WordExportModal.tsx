import React, { useState } from 'react';
import { 
  FileText, 
  X, 
  Download, 
  CheckCircle2, 
  Settings2, 
  FileDown, 
  Check, 
  BookOpen, 
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { Exam, Question } from '../../types';
import { exportExamToWord, WordExportMode } from '../../utils/docxExportUtils';
import { getExamQuestions } from '../../services/db';

interface WordExportModalProps {
  isOpen: boolean;
  exam: Exam;
  onClose: () => void;
}

export const WordExportModal: React.FC<WordExportModalProps> = ({
  isOpen,
  exam,
  onClose
}) => {
  const [selectedMode, setSelectedMode] = useState<WordExportMode>('exam_only');
  const [schoolName, setSchoolName] = useState<string>('TRƯỜNG THCS & THPT EDUTEST');
  const [departmentName, setDepartmentName] = useState<string>('SỞ GIÁO DỤC VÀ ĐÀO TẠO');
  const [fontSize, setFontSize] = useState<number>(22); // 11pt
  const [includeStudentBox, setIncludeStudentBox] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setErrorMessage(null);
    try {
      const questions = await getExamQuestions(exam.id);
      if (!questions || questions.length === 0) {
        setErrorMessage('Đề thi chưa có câu hỏi nào để xuất Word.');
        setIsExporting(false);
        return;
      }

      await exportExamToWord(exam, questions, selectedMode, {
        schoolName,
        departmentName,
        fontSize,
        includeStudentBox
      });

      onClose();
    } catch (err: any) {
      console.error('Lỗi xuất Word:', err);
      setErrorMessage(err.message || 'Không thể tạo file Word. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportModes: { mode: WordExportMode; title: string; desc: string; badge: string }[] = [
    {
      mode: 'exam_only',
      title: '1. Đề thi không có đáp án',
      desc: 'Dành cho in ấn phát cho học sinh làm bài thi chính thức. Không lộ bất kỳ đáp án nào.',
      badge: 'CHUẨN IN ẤN'
    },
    {
      mode: 'exam_with_key',
      title: '2. Đề thi có đánh dấu đáp án đúng',
      desc: 'Phương án đúng được in đậm, gạch chân và kèm dấu tích ✓ bên cạnh để giáo viên đối chiếu nhanh.',
      badge: 'ĐỐI CHIẾU'
    },
    {
      mode: 'exam_with_explanations',
      title: '3. Đề thi kèm lời giải chi tiết',
      desc: 'Mỗi câu hỏi có khung lời giải chi tiết và đáp án chuẩn bên dưới. Dành cho ôn tập và tài liệu học tập.',
      badge: 'TÀI LIỆU'
    },
    {
      mode: 'answers_only',
      title: '4. Bảng ma trận đáp án riêng biệt',
      desc: 'Chỉ xuất các bảng ma trận đáp án Phần I, II, III và hướng dẫn chấm tự luận chuẩn Bộ GD&ĐT.',
      badge: 'PHIẾU CHẤM'
    },
    {
      mode: 'full_combined',
      title: '5. Đề thi và Đáp án trong cùng một tài liệu',
      desc: 'Phần đầu là toàn bộ đề thi, ngắt trang ở giữa và phần sau là Bảng đáp án + Hướng dẫn chấm chi tiết.',
      badge: 'TOÀN DIỆN'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:px-6 sm:py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Tùy chọn Xuất Đề thi sang Word (.docx)
                <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full font-black">
                  OFFICE MATH OMML
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Chuyển đổi công thức toán học thành công thức Office Math chỉnh sửa được
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-slate-50/50">
          
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
              {errorMessage}
            </div>
          )}

          {/* Mode Selector */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Chọn định dạng nội dung xuất:
            </label>

            <div className="grid grid-cols-1 gap-2">
              {exportModes.map(item => {
                const isSelected = selectedMode === item.mode;
                return (
                  <div
                    key={item.mode}
                    onClick={() => setSelectedMode(item.mode)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                      isSelected 
                        ? 'bg-blue-50/70 border-blue-500 shadow-xs ring-1 ring-blue-500/30' 
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                        isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${isSelected ? 'text-blue-900' : 'text-slate-900'}`}>
                            {item.title}
                          </span>
                          <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                            isSelected ? 'bg-blue-200/80 text-blue-900' : 'bg-slate-100 text-slate-600'
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

          {/* Advanced Document Settings */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Thông tin tiêu đề &amp; Định dạng trang in:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-600">Đơn vị quản lý cấp trên:</label>
                <input
                  type="text"
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-600">Tên trường / Trung tâm:</label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-600">Cỡ chữ văn bản:</label>
                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  <option value={20}>10 pt (Nhỏ gọn, tiết kiệm giấy in)</option>
                  <option value={22}>11 pt (Tiêu chuẩn Bộ GD&amp;ĐT)</option>
                  <option value={24}>12 pt (Lớn, dễ đọc)</option>
                </select>
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={includeStudentBox}
                    onChange={(e) => setIncludeStudentBox(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300"
                  />
                  <span>Kèm khung thông tin Thí sinh &amp; Mã đề</span>
                </label>
              </div>
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
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Đang tạo file Word...' : 'Tải file Word (.docx)'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
