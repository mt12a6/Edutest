import React, { useState, useMemo } from 'react';
import { 
  X, 
  Shuffle, 
  Printer, 
  Copy, 
  Check, 
  ExternalLink, 
  KeyRound, 
  FileText, 
  CheckCircle2, 
  Share2, 
  Download, 
  Layers, 
  Sparkles 
} from 'lucide-react';
import { Exam, Question } from '../../types';
import { MathRenderer } from '../common/MathRenderer';

interface ShuffledExamExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam;
  questions: Question[];
}

interface ShuffledVariant {
  code: string;
  seed: number;
  questions: Question[];
  answerKey: Array<{
    questionNumber: number;
    type: string;
    correctDisplay: string;
    points: number;
  }>;
}

export const ShuffledExamExportModal: React.FC<ShuffledExamExportModalProps> = ({
  isOpen,
  onClose,
  exam,
  questions
}) => {
  const [selectedCode, setSelectedCode] = useState<string>('101');
  const [viewMode, setViewMode] = useState<'overview' | 'print_exam' | 'print_key'>('overview');
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [variantCodes, setVariantCodes] = useState<string[]>(['101', '102', '103', '104']);

  // Base URL for link sharing
  const appBaseUrl = window.location.origin;

  // Generate variants for each code
  const variants: ShuffledVariant[] = useMemo(() => {
    return variantCodes.map((code) => {
      // Deterministic seed from exam ID and code
      const seed = (exam.id + '_' + code).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

      const shuffleWithSeed = (list: Question[], sNum: number): Question[] => {
        if (list.length <= 1) return list;
        const copy = [...list];
        let m = copy.length, t, i, s = sNum;
        while (m) {
          s = (s * 9301 + 49297) % 233280;
          i = Math.floor((s / 233280) * m--);
          t = copy[m];
          copy[m] = copy[i];
          copy[i] = t;
        }
        return copy;
      };

      // Group into 3 parts
      const p1 = questions.filter(q => q.type === 'multiple_choice');
      const p2 = questions.filter(q => q.type === 'true_false');
      const p3 = questions.filter(q => q.type === 'fill_blank' || q.type === 'essay');

      // Shuffle within each part
      const sP1 = shuffleWithSeed(p1, seed + 11);
      const sP2 = shuffleWithSeed(p2, seed + 37);
      const sP3 = shuffleWithSeed(p3, seed + 73);

      // Re-number sequentially 1..N
      const combined = [...sP1, ...sP2, ...sP3].map((q, idx) => ({
        ...q,
        questionNumber: idx + 1
      }));

      // Generate Answer Key for this variant
      const answerKey = combined.map(q => {
        let correctDisplay = '';
        if (q.type === 'multiple_choice') {
          correctDisplay = q.correctOption || 'A';
        } else if (q.type === 'true_false') {
          const subAns = (q.subQuestions || []).map(s => `${s.key}: ${s.correct ? 'Đ' : 'S'}`).join('; ');
          correctDisplay = subAns;
        } else if (q.type === 'fill_blank') {
          correctDisplay = (q.acceptableAnswers || []).join(' hoặc ');
        } else if (q.type === 'essay') {
          correctDisplay = q.sampleAnswer || 'Theo hướng dẫn chấm tự luận';
        }
        return {
          questionNumber: q.questionNumber,
          type: q.type,
          correctDisplay,
          points: q.points || 1
        };
      });

      return {
        code,
        seed,
        questions: combined,
        answerKey
      };
    });
  }, [variantCodes, exam.id, questions]);

  const currentVariant = variants.find(v => v.code === selectedCode) || variants[0];

  if (!isOpen) return null;

  const handleCopyLink = (code: string) => {
    const fullLink = `${appBaseUrl}/?examId=${exam.id}&code=${code}`;
    navigator.clipboard.writeText(fullLink);
    setCopiedLink(code);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <Shuffle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">
                Tạo mã đề hoán vị, Xuất đề thi & Đáp án chấm
              </h3>
              <p className="text-xs text-slate-300">
                Đề gốc: <span className="text-emerald-400 font-bold">{exam.title}</span> • Khối {exam.grade} • {questions.length} câu
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View mode switcher */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">Chọn Mã đề:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {variants.map(v => (
                <button
                  key={v.code}
                  onClick={() => setSelectedCode(v.code)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    selectedCode === v.code
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Mã {v.code}
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  const nextNum = 100 + variantCodes.length + 1;
                  const newCode = String(nextNum);
                  if (!variantCodes.includes(newCode)) {
                    setVariantCodes([...variantCodes, newCode]);
                    setSelectedCode(newCode);
                  }
                }}
                className="px-2.5 py-1.5 rounded-xl border border-dashed border-indigo-300 text-indigo-700 hover:bg-indigo-50 font-bold transition-all cursor-pointer text-xs"
                title="Tạo thêm một mã đề hoán vị mới (105, 106...)"
              >
                + Thêm mã đề
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('overview')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                viewMode === 'overview' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Tổng quan & Link đề
            </button>
            <button
              onClick={() => setViewMode('print_exam')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'print_exam' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Xem & In đề thi</span>
            </button>
            <button
              onClick={() => setViewMode('print_key')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'print_key' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Bảng đáp án chấm</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* VIEW MODE 1: OVERVIEW & SHARE LINKS */}
          {viewMode === 'overview' && (
            <div className="space-y-6">
              
              <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-indigo-950">
                    Cơ chế trộn đề chuẩn theo Bộ Giáo Dục:
                  </p>
                  <p className="text-indigo-900/80 leading-relaxed">
                    Hệ thống tự động xáo trộn độc lập các câu hỏi trong <strong>Phần I (Trắc nghiệm 4 lựa chọn)</strong>, <strong>Phần II (Đúng/Sai)</strong> và <strong>Phần III (Điền kết quả / Tự luận)</strong>. Thứ tự các phần thi được giữ cố định. Mỗi mã đề có bộ đề và bảng đáp án chấm tương ứng riêng biệt.
                  </p>
                </div>
              </div>

              {/* Shuffled variants cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {variants.map((v) => {
                  const directLink = `${appBaseUrl}/?examId=${exam.id}&code=${v.code}`;
                  const isCopied = copiedLink === v.code;

                  return (
                    <div 
                      key={v.code}
                      className={`p-5 rounded-2xl border transition-all space-y-3.5 ${
                        selectedCode === v.code 
                          ? 'border-indigo-400 bg-white ring-2 ring-indigo-500/20 shadow-md' 
                          : 'border-slate-200 bg-white hover:border-slate-300 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center">
                            {v.code}
                          </span>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm">
                              MÃ ĐỀ THI: {v.code}
                            </h4>
                            <p className="text-[11px] text-slate-500">
                              {v.questions.length} câu • {exam.durationMinutes} phút
                            </p>
                          </div>
                        </div>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Sẵn sàng thi
                        </span>
                      </div>

                      {/* Direct Link Box */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 block">
                          Link thi trực tiếp cho mã đề {v.code}:
                        </label>
                        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                          <input
                            type="text"
                            readOnly
                            value={directLink}
                            className="w-full text-xs font-mono text-slate-700 bg-transparent border-none focus:outline-hidden"
                          />
                          <button
                            onClick={() => handleCopyLink(v.code)}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{isCopied ? 'Đã chép' : 'Sao chép'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Action buttons for this variant */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <button
                          onClick={() => {
                            setSelectedCode(v.code);
                            setViewMode('print_exam');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Xuất đề in</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedCode(v.code);
                            setViewMode('print_key');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Đáp án chấm</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* VIEW MODE 2: PRINTABLE EXAM PAPER */}
          {viewMode === 'print_exam' && currentVariant && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 print:hidden">
                <span className="text-xs text-slate-500">
                  Xem trước bản in chính thức dành cho học sinh làm bài trên giấy hoặc xuất file PDF:
                </span>
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>In đề thi / Lưu PDF</span>
                </button>
              </div>

              {/* Printable Document Container */}
              <div className="p-8 sm:p-10 bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-900 max-w-4xl mx-auto space-y-6 font-serif">
                
                {/* School & Exam Header */}
                <div className="grid grid-cols-2 gap-4 pb-4 border-b-2 border-slate-900 text-xs leading-normal">
                  <div className="space-y-1">
                    <p className="font-bold uppercase tracking-wider">SỞ GIÁO DỤC VÀ ĐÀO TẠO</p>
                    <p className="font-bold uppercase">TRƯỜNG THPT CHUYÊN & KHẢO THÍ SỐ</p>
                    <p className="italic">Năm học 2024 - 2025</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="font-extrabold uppercase text-sm">{exam.title}</p>
                    <p className="font-bold">MÔN: {exam.subjectName?.toUpperCase()} - KHỐI {exam.grade}</p>
                    <p>Thời gian làm bài: <strong>{exam.durationMinutes} phút</strong> (Không kể thời gian phát đề)</p>
                  </div>
                </div>

                {/* Student info box and Exam Code */}
                <div className="flex items-center justify-between p-3 border border-slate-400 text-xs">
                  <div className="space-y-1.5 flex-1">
                    <p>Họ và tên thí sinh: ............................................................................ Lớp: .........................</p>
                    <p>Số báo danh (SBD): .........................................................................................................</p>
                  </div>
                  <div className="pl-4 border-l-2 border-slate-400 text-center shrink-0">
                    <span className="block text-[11px] font-bold">MÃ ĐỀ THI</span>
                    <span className="text-2xl font-black font-sans">{currentVariant.code}</span>
                  </div>
                </div>

                {/* Exam Questions Formatted */}
                <div className="space-y-6 pt-2 font-sans text-xs sm:text-sm">
                  
                  {/* Part 1 Header */}
                  {currentVariant.questions.some(q => q.type === 'multiple_choice') && (
                    <div className="space-y-3">
                      <div className="p-2 bg-slate-100 font-bold border-l-4 border-slate-900 text-xs uppercase">
                        PHẦN I: Câu trắc nghiệm nhiều phương án lựa chọn. Thí sinh trả lời từ câu 1 đến câu {currentVariant.questions.filter(q => q.type === 'multiple_choice').length}. Mỗi câu hỏi thí sinh chỉ chọn một phương án.
                      </div>
                      
                      <div className="space-y-4">
                        {currentVariant.questions.filter(q => q.type === 'multiple_choice').map((q) => (
                          <div key={q.id} className="space-y-2">
                            <p className="font-bold text-slate-900 leading-relaxed">
                              Câu {q.questionNumber}: <span className="font-normal"><MathRenderer content={q.prompt} inline /></span>
                            </p>
                            {q.imageUrl && (
                              <img src={q.imageUrl} alt="" className="max-h-48 border rounded my-1" />
                            )}
                            {q.options && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-4">
                                {(['A', 'B', 'C', 'D'] as const).map(k => (
                                  <div key={k} className="flex items-start gap-2">
                                    <span className="font-bold shrink-0">{k}.</span>
                                    <span><MathRenderer content={q.options?.[k] || ''} inline /></span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Part 2 Header */}
                  {currentVariant.questions.some(q => q.type === 'true_false') && (
                    <div className="space-y-3 pt-4 border-t border-slate-200">
                      <div className="p-2 bg-slate-100 font-bold border-l-4 border-slate-900 text-xs uppercase">
                        PHẦN II: Câu trắc nghiệm Đúng / Sai. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn Đúng hoặc Sai.
                      </div>
                      
                      <div className="space-y-5">
                        {currentVariant.questions.filter(q => q.type === 'true_false').map((q) => (
                          <div key={q.id} className="space-y-2">
                            <p className="font-bold text-slate-900 leading-relaxed">
                              Câu {q.questionNumber}: <span className="font-normal"><MathRenderer content={q.prompt} inline /></span>
                            </p>
                            {q.imageUrl && (
                              <img src={q.imageUrl} alt="" className="max-h-48 border rounded my-1" />
                            )}
                            <div className="space-y-1.5 pl-4">
                              {(q.subQuestions || []).map((sub) => (
                                <div key={sub.key} className="flex items-start justify-between gap-4 py-1 border-b border-dashed border-slate-200">
                                  <div className="flex items-start gap-2">
                                    <span className="font-bold">{sub.key})</span>
                                    <span><MathRenderer content={sub.text} inline /></span>
                                  </div>
                                  <span className="text-[11px] text-slate-400 italic shrink-0">[ Đúng / Sai ]</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Part 3 Header */}
                  {currentVariant.questions.some(q => q.type === 'fill_blank' || q.type === 'essay') && (
                    <div className="space-y-3 pt-4 border-t border-slate-200">
                      <div className="p-2 bg-slate-100 font-bold border-l-4 border-slate-900 text-xs uppercase">
                        PHẦN III: Câu trả lời ngắn hoặc Tự luận. Thí sinh điền kết quả hoặc trình bày bài giải chi tiết.
                      </div>
                      
                      <div className="space-y-4">
                        {currentVariant.questions.filter(q => q.type === 'fill_blank' || q.type === 'essay').map((q) => (
                          <div key={q.id} className="space-y-2">
                            <p className="font-bold text-slate-900 leading-relaxed">
                              Câu {q.questionNumber} ({q.points || 1} điểm): <span className="font-normal"><MathRenderer content={q.prompt} inline /></span>
                            </p>
                            {q.imageUrl && (
                              <img src={q.imageUrl} alt="" className="max-h-48 border rounded my-1" />
                            )}
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 italic text-xs">
                              Đáp số / Bài làm: ............................................................................................................
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>

                <div className="text-center pt-8 border-t border-slate-300 text-xs italic font-bold">
                  ------------------------- HẾT -------------------------
                  <p className="font-normal text-[11px] text-slate-500 mt-1">
                    Cán bộ coi thi không giải thích gì thêm. Thí sinh không được sử dụng tài liệu.
                  </p>
                </div>

              </div>
            </div>
          )}

          {/* VIEW MODE 3: ANSWER KEY MATRIX */}
          {viewMode === 'print_key' && currentVariant && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 print:hidden">
                <span className="text-xs text-slate-500">
                  Bảng đáp án chấm chính thức tương ứng cho <strong>Mã đề {currentVariant.code}</strong>:
                </span>
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>In bảng đáp án</span>
                </button>
              </div>

              {/* Answer Key Sheet */}
              <div className="p-8 bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-900 max-w-4xl mx-auto space-y-6">
                
                <div className="text-center space-y-1 pb-4 border-b border-slate-200">
                  <h3 className="font-black text-lg text-slate-900 uppercase">
                    HƯỚNG DẪN CHẤM & BẢNG ĐÁP ÁN
                  </h3>
                  <p className="text-xs text-slate-600 font-bold uppercase">
                    {exam.title} • MÔN: {exam.subjectName} • KHỐI {exam.grade}
                  </p>
                  <div className="inline-block px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-black text-indigo-900 mt-1">
                    MÃ ĐỀ CHẤM: {currentVariant.code}
                  </div>
                </div>

                {/* Table of answers */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                        <th className="p-2.5 text-center w-16">Câu</th>
                        <th className="p-2.5 w-40">Phần / Dạng câu</th>
                        <th className="p-2.5">Đáp án đúng chính thức</th>
                        <th className="p-2.5 text-center w-24">Điểm số</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {currentVariant.answerKey.map((item) => (
                        <tr key={item.questionNumber} className="hover:bg-slate-50">
                          <td className="p-2.5 text-center font-bold text-slate-900">
                            Câu {item.questionNumber}
                          </td>
                          <td className="p-2.5 text-slate-600">
                            {item.type === 'multiple_choice' && 'Trắc nghiệm 4 lựa chọn'}
                            {item.type === 'true_false' && 'Trắc nghiệm Đúng / Sai'}
                            {item.type === 'fill_blank' && 'Điền kết quả'}
                            {item.type === 'essay' && 'Tự luận'}
                          </td>
                          <td className="p-2.5 font-bold text-indigo-950 font-mono">
                            {item.correctDisplay}
                          </td>
                          <td className="p-2.5 text-center font-bold text-emerald-700">
                            {item.points}đ
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5 text-slate-600">
                  <p className="font-bold text-slate-800">Quy tắc tính điểm chuẩn Phần II (Đúng/Sai):</p>
                  <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                    <li>Đúng 1 ý: tính 0.1 điểm.</li>
                    <li>Đúng 2 ý: tính 0.25 điểm.</li>
                    <li>Đúng 3 ý: tính 0.50 điểm.</li>
                    <li>Đúng cả 4 ý: tính 1.0 điểm trọn vẹn (hoặc theo cấu hình điểm số câu hỏi).</li>
                  </ul>
                </div>

              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0 print:hidden">
          <span className="text-slate-500 font-medium">
            Mã đề hiện tại: <strong>{currentVariant.code}</strong> (Tổng {variants.length} mã đề hoán vị)
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl cursor-pointer"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
