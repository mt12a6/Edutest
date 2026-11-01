import React, { useState, useRef, useEffect } from 'react';
import { 
  Clock, 
  BookOpen, 
  Calculator, 
  Laptop, 
  Atom, 
  FlaskConical, 
  Languages, 
  FileText, 
  Play, 
  MoreVertical, 
  QrCode, 
  Edit3, 
  Trash2, 
  Pin, 
  Lock, 
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { Exam, ExamDisplayMode } from '../../types';

interface ExamCardProps {
  exam: Exam;
  displayMode: ExamDisplayMode;
  isPinned?: boolean;
  canManage: boolean;
  canPin: boolean;
  isLoadingThis: boolean;
  onTakeExam: (exam: Exam) => void;
  onShareExam: (exam: Exam) => void;
  onTogglePin?: (exam: Exam, e?: React.MouseEvent) => void;
  onEditExam?: (exam: Exam) => void;
  onDeleteExam?: (exam: Exam) => void;
}

// Helper to pick appropriate subject icon
export const getSubjectIcon = (subjectName?: string) => {
  const s = (subjectName || '').toLowerCase();
  if (s.includes('toán')) return <Calculator className="w-4 h-4 text-teal-600" />;
  if (s.includes('tin') || s.includes('tin học')) return <Laptop className="w-4 h-4 text-blue-600" />;
  if (s.includes('lí') || s.includes('vật lý') || s.includes('vật lí')) return <Atom className="w-4 h-4 text-indigo-600" />;
  if (s.includes('hóa') || s.includes('hóa học')) return <FlaskConical className="w-4 h-4 text-purple-600" />;
  if (s.includes('anh') || s.includes('ngoại ngữ')) return <Languages className="w-4 h-4 text-emerald-600" />;
  return <BookOpen className="w-4 h-4 text-slate-600" />;
};

export const ExamCard: React.FC<ExamCardProps> = ({
  exam,
  displayMode,
  isPinned = false,
  canManage,
  canPin,
  isLoadingThis,
  onTakeExam,
  onShareExam,
  onTogglePin,
  onEditExam,
  onDeleteExam
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown menu on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [menuOpen]);

  // Check if exam is expired
  const isExpired = exam.closeTime ? new Date(exam.closeTime).getTime() < Date.now() : false;

  // Primary action button label
  const primaryButtonLabel = isLoadingThis
    ? 'Đang mở...'
    : isExpired
    ? 'Hết hạn'
    : exam.isSecure
    ? 'Vào thi'
    : 'Vào thi ngay';

  // Secondary actions 3-dot menu dropdown
  const renderDropdownMenu = () => {
    return (
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(prev => !prev);
          }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Tùy chọn khác"
          aria-label="Tùy chọn khác"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100 text-xs">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onShareExam(exam);
              }}
              className="w-full px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-slate-500" />
              <span>Chia sẻ & Mã QR</span>
            </button>

            {canPin && onTogglePin && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onTogglePin(exam, e);
                }}
                className="w-full px-3 py-2 text-left font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
              >
                <Pin className={`w-3.5 h-3.5 ${isPinned ? 'text-amber-500 fill-amber-500' : 'text-slate-500'}`} />
                <span>{isPinned ? 'Bỏ ghim đề này' : 'Ghim đề lên đầu'}</span>
              </button>
            )}

            {canManage && onEditExam && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onEditExam(exam);
                }}
                className="w-full px-3 py-2 text-left font-medium text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Chỉnh sửa đề thi</span>
              </button>
            )}

            {canManage && onDeleteExam && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDeleteExam(exam);
                }}
                className="w-full px-3 py-2 text-left font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2 border-t border-slate-100 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa đề thi</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // MODE 1: SINGLE LINE (DANH SÁCH MỘT DÒNG - MẶC ĐỊNH)
  // Height: ~68-76px on desktop, horizontal alignment
  // =========================================================================
  if (displayMode === 'list') {
    return (
      <div className="group relative bg-white hover:bg-slate-50/80 rounded-xl border border-slate-200/90 hover:border-teal-300 transition-all p-3 sm:px-4 sm:py-3 shadow-2xs hover:shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Icon + Title + Quiet Metadata */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Subject Icon Box */}
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 group-hover:border-teal-200 group-hover:bg-teal-50/50 transition-colors">
            {getSubjectIcon(exam.subjectName)}
          </div>

          {/* Exam Title & Quiet metadata */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 
                onClick={() => onTakeExam(exam)}
                className="text-sm font-bold text-slate-900 truncate hover:text-teal-700 cursor-pointer transition-colors"
                title={exam.title}
              >
                {exam.title}
              </h3>
              {exam.isSecure && (
                <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded shrink-0">
                  Bảo mật
                </span>
              )}
              {!exam.isPublished && (
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded shrink-0">
                  Nháp
                </span>
              )}
            </div>

            {/* Quiet metadata with dot separators */}
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
              <span className="font-medium text-slate-700">{exam.subjectName || 'Chung'}</span>
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
                  <span className="text-slate-400 truncate max-w-[120px]">
                    Lớp: {exam.classIds.join(', ')}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2 justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <button
            type="button"
            onClick={() => onShareExam(exam)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer hidden md:flex items-center justify-center"
            title="Chia sẻ & Mã QR"
          >
            <QrCode className="w-4 h-4 text-slate-500" />
          </button>

          <button
            type="button"
            onClick={() => onTakeExam(exam)}
            disabled={isLoadingThis || isExpired}
            className={`px-4 py-2 min-h-[36px] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 shadow-2xs ${
              isExpired
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : 'bg-teal-600 hover:bg-teal-700 text-white'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{primaryButtonLabel}</span>
          </button>

          {renderDropdownMenu()}
        </div>
      </div>
    );
  }

  // =========================================================================
  // MODE 2: TABLE ROW (DẠNG BẢNG)
  // Columns: Tên đề, Môn, Khối, Thời gian, Số câu, Trạng thái, Thao tác
  // =========================================================================
  if (displayMode === 'table') {
    return (
      <tr className="hover:bg-slate-50/70 border-b border-slate-200/80 transition-colors">
        {/* Tên đề thi */}
        <td className="py-3 px-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
              {getSubjectIcon(exam.subjectName)}
            </div>
            <div className="min-w-0 max-w-sm sm:max-w-md">
              <span 
                onClick={() => onTakeExam(exam)}
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

        {/* Môn */}
        <td className="py-3 px-3 text-xs font-medium text-slate-700 whitespace-nowrap">
          {exam.subjectName || 'Chung'}
        </td>

        {/* Khối */}
        <td className="py-3 px-3 text-xs font-medium text-slate-700 whitespace-nowrap">
          Khối {exam.grade || '?'}
        </td>

        {/* Thời gian */}
        <td className="py-3 px-3 text-xs text-slate-600 whitespace-nowrap">
          {exam.durationMinutes} phút
        </td>

        {/* Số câu */}
        <td className="py-3 px-3 text-xs text-slate-600 whitespace-nowrap">
          {exam.questionCount || 0} câu
        </td>

        {/* Trạng thái */}
        <td className="py-3 px-3 whitespace-nowrap">
          {isExpired ? (
            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              Hết hạn
            </span>
          ) : exam.isSecure ? (
            <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
              Bảo mật
            </span>
          ) : !exam.isPublished ? (
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
              Bản nháp
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
              Sẵn sàng
            </span>
          )}
        </td>

        {/* Thao tác */}
        <td className="py-3 px-3.5 text-right whitespace-nowrap">
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => onTakeExam(exam)}
              disabled={isLoadingThis || isExpired}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                isExpired
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                  : 'bg-teal-600 hover:bg-teal-700 text-white shadow-2xs'
              }`}
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{primaryButtonLabel}</span>
            </button>
            {renderDropdownMenu()}
          </div>
        </td>
      </tr>
    );
  }

  // =========================================================================
  // MODE 3: GRID CARDS (DẠNG THẺ LƯỚI GỌN)
  // Clean white card, max 1-2 badges, no clutter
  // =========================================================================
  return (
    <div className="group bg-white hover:bg-slate-50/50 rounded-2xl border border-slate-200/90 hover:border-teal-300 p-4 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between space-y-3">
      {/* Top Header: Subject + Status Badge + 3-dot Menu */}
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
          {exam.isSecure && (
            <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded">
              Bảo mật
            </span>
          )}
          {!exam.isPublished && (
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
              Nháp
            </span>
          )}
          {renderDropdownMenu()}
        </div>
      </div>

      {/* Main Title */}
      <h3 
        onClick={() => onTakeExam(exam)}
        className="font-bold text-sm text-slate-900 group-hover:text-teal-700 cursor-pointer line-clamp-2 leading-snug transition-colors"
        title={exam.title}
      >
        {exam.title}
      </h3>

      {/* Metadata Row */}
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

      {/* Bottom Footer: Class Target & Main Take Exam Button */}
      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-400 truncate max-w-[130px]">
          {exam.classIds?.length ? `Lớp: ${exam.classIds.join(', ')}` : 'Công khai'}
        </span>

        <button
          type="button"
          onClick={() => onTakeExam(exam)}
          disabled={isLoadingThis || isExpired}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 shadow-2xs ${
            isExpired
              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
              : 'bg-teal-600 hover:bg-teal-700 text-white'
          }`}
        >
          <Play className="w-3 h-3 fill-current" />
          <span>{primaryButtonLabel}</span>
        </button>
      </div>
    </div>
  );
};
