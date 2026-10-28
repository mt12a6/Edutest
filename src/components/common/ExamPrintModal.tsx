import React, { useState } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  BookOpen, 
  CheckCircle2, 
  FileText, 
  Settings, 
  Eye, 
  Award,
  Layers,
  GraduationCap
} from 'lucide-react';
import { Exam, Question } from '../../types';
import { MathRenderer } from './MathRenderer';
import { getExamQuestions } from '../../services/db';

interface ExamPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam;
  questions?: Question[];
  defaultMode?: 'exam' | 'answers' | 'answer_key';
  mode?: 'exam' | 'answers' | 'answer_key';
}

export const ExamPrintModal: React.FC<ExamPrintModalProps> = ({
  isOpen,
  onClose,
  exam,
  questions: initialQuestions,
  defaultMode = 'exam',
  mode
}) => {
  const effectiveInitialMode = mode === 'answer_key' ? 'answers' : defaultMode === 'answer_key' ? 'answers' : (mode || defaultMode);
  const [printMode, setPrintMode] = useState<'exam' | 'answers'>(effectiveInitialMode);
  const [loadedQuestions, setLoadedQuestions] = useState<Question[]>(initialQuestions || []);

  React.useEffect(() => {
    if (!initialQuestions || initialQuestions.length === 0) {
      getExamQuestions(exam.id).then(qList => setLoadedQuestions(qList)).catch(() => {});
    } else {
      setLoadedQuestions(initialQuestions);
    }
  }, [exam.id, initialQuestions]);

  const questions = loadedQuestions;
  const [schoolName, setSchoolName] = useState<string>('TRƯỜNG THPT CHUYÊN');
  const [examHeaderTitle, setExamHeaderTitle] = useState<string>('BÀI KIỂM TRA ĐÁNH GIÁ ĐỊNH KỲ');
  const [schoolYear, setSchoolYear] = useState<string>('NĂM HỌC 2024 - 2025');
  const [teacherName, setTeacherName] = useState<string>(exam.createdByName || 'Tổ bộ môn');
  const [examCode, setExamCode] = useState<string>(exam.trialCode || '101');
  const [fontSize, setFontSize] = useState<'normal' | 'compact'>('normal');

  if (!isOpen) return null;

  // Separate questions by type
  const p1 = questions.filter(q => q.type === 'multiple_choice');
  const p2 = questions.filter(q => q.type === 'true_false');
  const p3 = questions.filter(q => q.type === 'fill_blank');
  const p4 = questions.filter(q => q.type === 'essay');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in print:p-0 print:bg-white">
      
      {/* Outer Card */}
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 print:border-none print:shadow-none print:max-h-none print:rounded-none">
        
        {/* Top Control Bar (Hidden on print) */}
        <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base">
                In Đề Thi & Đáp Án Khổ Giấy A4
              </h3>
              <p className="text-[11px] text-slate-300">
                Đề: {exam.title} ({questions.length} câu)
              </p>
            </div>
          </div>

          {/* Mode Switcher Pills */}
          <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setPrintMode('exam')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                printMode === 'exam' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              📄 1. In Đề thi (Cho học sinh)
            </button>
            <button
              type="button"
              onClick={() => setPrintMode('answers')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                printMode === 'answers' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'
              }`}
            >
              🔑 2. In Đáp án & Lời giải
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>In / Xuất PDF (A4)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Customization Options (Hidden on print) */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs shrink-0 print:hidden grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">Tên trường / Đơn vị:</label>
            <input 
              type="text" 
              value={schoolName} 
              onChange={e => setSchoolName(e.target.value)}
              className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">Tiêu đề kỳ thi:</label>
            <input 
              type="text" 
              value={examHeaderTitle} 
              onChange={e => setExamHeaderTitle(e.target.value)}
              className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">Mã đề thi:</label>
            <input 
              type="text" 
              value={examCode} 
              onChange={e => setExamCode(e.target.value)}
              className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium uppercase font-mono"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">Giáo viên / Tổ chuyên môn:</label>
            <input 
              type="text" 
              value={teacherName} 
              onChange={e => setTeacherName(e.target.value)}
              className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium"
            />
          </div>
        </div>

        {/* Printable Paper Canvas (Styled for A4 paper standard) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200/60 print:p-0 print:bg-white print:overflow-visible">
          <div className="max-w-[210mm] mx-auto bg-white p-6 sm:p-10 shadow-lg print:shadow-none print:p-0 text-slate-950 font-serif leading-normal space-y-5 print:space-y-4">
            
            {/* Header section (A4 standard) */}
            <div className="border-b-2 border-slate-900 pb-3">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="space-y-0.5">
                  <p className="font-bold text-xs uppercase tracking-wider">{schoolName}</p>
                  <p className="font-bold text-xs uppercase tracking-wide">TỔ CHUYÊN MÔN: {exam.subjectName?.toUpperCase()}</p>
                  <p className="text-[11px] italic text-slate-600">Mã đề thi: <strong>{examCode}</strong></p>
                </div>
                <div className="space-y-0.5 border-l border-slate-300 pl-4">
                  <p className="font-black text-sm uppercase tracking-wider">{examHeaderTitle}</p>
                  <p className="font-bold text-xs uppercase text-slate-800">MÔN: {exam.subjectName} – KHỐI {exam.grade}</p>
                  <p className="text-[11px] italic text-slate-600">
                    Thời gian làm bài: <strong>{exam.durationMinutes} phút</strong> (Không kể thời gian phát đề)
                  </p>
                </div>
              </div>

              {/* Student info box (Only in exam mode) */}
              {printMode === 'exam' && (
                <div className="mt-4 pt-3 border-t border-dashed border-slate-400 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>Họ và tên thí sinh: .......................................</div>
                  <div>Lớp: ............................</div>
                  <div>Số báo danh: ................</div>
                  <div>Phòng thi: ....................</div>
                </div>
              )}

              {/* Answers Mode Header Banner */}
              {printMode === 'answers' && (
                <div className="mt-3 p-2 bg-emerald-50 border border-emerald-300 text-center text-xs font-bold text-emerald-900 rounded">
                  ★ ĐÁP ÁN CHÍNH THỨC VÀ BIỂU ĐIỂM CHI TIẾT – MÃ ĐỀ: {examCode} ★
                </div>
              )}
            </div>

            {/* Content Body: MODE 1 - EXAM QUESTIONS FOR STUDENTS */}
            {printMode === 'exam' && (
              <div className="space-y-5 text-[13px] leading-relaxed">
                
                {/* PART I: MULTIPLE CHOICE */}
                {p1.length > 0 && (
                  <div className="space-y-3">
                    <div className="font-bold text-xs uppercase bg-slate-100 p-1.5 border-l-4 border-slate-900">
                      PHẦN I. Thí sinh trả lời từ câu 1 đến câu {p1.length}. Mỗi câu hỏi thí sinh chỉ chọn một phương án.
                    </div>

                    <div className="space-y-3.5">
                      {p1.map((q, idx) => (
                        <div key={q.id} className="space-y-1.5 break-inside-avoid">
                          <div className="font-semibold text-slate-900">
                            <strong>Câu {idx + 1}: </strong>
                            <MathRenderer content={q.prompt} inline />
                          </div>

                          {q.imageUrl && (
                            <div className="py-1">
                              <img src={q.imageUrl} alt="Hình minh họa" className="max-h-40 max-w-sm border p-1 rounded" />
                            </div>
                          )}

                          {q.options && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-3 pt-0.5">
                              {(['A', 'B', 'C', 'D'] as const).map(k => (
                                <div key={k} className="flex items-start gap-1">
                                  <strong>{k}.</strong>
                                  <div className="space-y-1">
                                    <MathRenderer content={q.options?.[k] || ''} inline />
                                    {q.optionImages?.[k] && (
                                      <img src={q.optionImages[k]} alt="" className="max-h-20 max-w-full border rounded p-0.5 mt-0.5" />
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* PART II: TRUE / FALSE 4 STATEMENTS */}
                {p2.length > 0 && (
                  <div className="space-y-3 pt-3">
                    <div className="font-bold text-xs uppercase bg-slate-100 p-1.5 border-l-4 border-slate-900">
                      PHẦN II. Thí sinh trả lời từ câu {p1.length + 1} đến câu {p1.length + p2.length}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn Đúng hoặc Sai.
                    </div>

                    <div className="space-y-3.5">
                      {p2.map((q, idx) => (
                        <div key={q.id} className="space-y-1.5 break-inside-avoid">
                          <div className="font-semibold text-slate-900">
                            <strong>Câu {p1.length + idx + 1}: </strong>
                            <MathRenderer content={q.prompt} inline />
                          </div>

                          {q.imageUrl && (
                            <div className="py-1">
                              <img src={q.imageUrl} alt="Hình minh họa" className="max-h-40 max-w-sm border p-1 rounded" />
                            </div>
                          )}

                          <div className="space-y-1 pl-4">
                            {(q.subQuestions || []).map(sub => (
                              <div key={sub.key} className="flex items-start gap-2">
                                <strong>{sub.key})</strong>
                                <span><MathRenderer content={sub.text} inline /></span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* PART III: FILL IN THE BLANK */}
                {p3.length > 0 && (
                  <div className="space-y-3 pt-3">
                    <div className="font-bold text-xs uppercase bg-slate-100 p-1.5 border-l-4 border-slate-900">
                      PHẦN III. Thí sinh trả lời từ câu {p1.length + p2.length + 1} đến câu {p1.length + p2.length + p3.length}. Điền câu trả lời ngắn vào ô tương ứng.
                    </div>

                    <div className="space-y-3.5">
                      {p3.map((q, idx) => (
                        <div key={q.id} className="space-y-1.5 break-inside-avoid">
                          <div className="font-semibold text-slate-900">
                            <strong>Câu {p1.length + p2.length + idx + 1}: </strong>
                            <MathRenderer content={q.prompt} inline />
                          </div>

                          {q.imageUrl && (
                            <div className="py-1">
                              <img src={q.imageUrl} alt="Hình minh họa" className="max-h-40 max-w-sm border p-1 rounded" />
                            </div>
                          )}

                          <div className="pl-4 text-xs italic text-slate-600">
                            Trả lời: ........................................................................................................
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* PART IV: ESSAY */}
                {p4.length > 0 && (
                  <div className="space-y-3 pt-3">
                    <div className="font-bold text-xs uppercase bg-slate-100 p-1.5 border-l-4 border-slate-900">
                      PHẦN IV. CÂU HỎI TỰ LUẬN. Trình bày chi tiết lời giải vào giấy làm bài.
                    </div>

                    <div className="space-y-4">
                      {p4.map((q, idx) => (
                        <div key={q.id} className="space-y-2 break-inside-avoid">
                          <div className="font-semibold text-slate-900">
                            <strong>Câu {p1.length + p2.length + p3.length + idx + 1} ({q.points || 2.5} điểm): </strong>
                            <MathRenderer content={q.prompt} inline />
                          </div>

                          {q.imageUrl && (
                            <div className="py-1">
                              <img src={q.imageUrl} alt="Hình minh họa" className="max-h-48 max-w-sm border p-1 rounded" />
                            </div>
                          )}

                          <div className="h-28 border border-dashed border-slate-300 rounded p-2 text-xs text-slate-400 italic">
                            (Phần dành cho học sinh trình bày bài làm tự luận)
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-center text-xs font-bold pt-4 border-t border-slate-300 text-slate-600">
                  ---------- HẾT ----------
                </div>
              </div>
            )}

            {/* Content Body: MODE 2 - ANSWERS & SCORING RUBRICS */}
            {printMode === 'answers' && (
              <div className="space-y-6 text-[13px] leading-relaxed">
                
                {/* 1. Quick Multiple Choice Answer Matrix */}
                {p1.length > 0 && (
                  <div className="space-y-2 break-inside-avoid">
                    <h4 className="font-bold text-xs uppercase bg-slate-100 p-1.5 border-l-4 border-slate-900">
                      BẢNG ĐÁP ÁN PHẦN I (TRẮC NGHIỆM 4 LỰA CHỌN)
                    </h4>
                    <div className="grid grid-cols-5 sm:grid-cols-10 border border-slate-900 text-center divide-x divide-y divide-slate-900 text-xs font-bold">
                      {p1.map((q, idx) => (
                        <div key={q.id} className="p-1.5">
                          <div className="text-slate-500 text-[10px]">C{idx + 1}</div>
                          <div className="text-emerald-700 text-sm font-black">{q.correctOption || 'A'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. True / False Detailed Matrix */}
                {p2.length > 0 && (
                  <div className="space-y-2 break-inside-avoid">
                    <h4 className="font-bold text-xs uppercase bg-slate-100 p-1.5 border-l-4 border-slate-900">
                      BẢNG ĐÁP ÁN PHẦN II (ĐÚNG / SAI 4 Ý a, b, c, d)
                    </h4>
                    <div className="border border-slate-900 overflow-hidden text-xs">
                      <table className="w-full text-center divide-y divide-slate-900">
                        <thead className="bg-slate-100 font-bold">
                          <tr className="divide-x divide-slate-900">
                            <th className="p-2">Câu hỏi</th>
                            <th className="p-2">Ý a)</th>
                            <th className="p-2">Ý b)</th>
                            <th className="p-2">Ý c)</th>
                            <th className="p-2">Ý d)</th>
                            <th className="p-2">Biểu điểm chuẩn</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900 font-semibold">
                          {p2.map((q, idx) => {
                            const subMap = (q.subQuestions || []).reduce((acc, sub) => {
                              acc[sub.key] = sub.correct;
                              return acc;
                            }, {} as Record<string, boolean>);

                            return (
                              <tr key={q.id} className="divide-x divide-slate-900">
                                <td className="p-2 font-bold bg-slate-50">Câu {p1.length + idx + 1}</td>
                                <td className="p-2">{subMap['a'] ? 'ĐÚNG' : 'SAI'}</td>
                                <td className="p-2">{subMap['b'] ? 'ĐÚNG' : 'SAI'}</td>
                                <td className="p-2">{subMap['c'] ? 'ĐÚNG' : 'SAI'}</td>
                                <td className="p-2">{subMap['d'] ? 'ĐÚNG' : 'SAI'}</td>
                                <td className="p-2 text-[11px] text-slate-600 font-normal">
                                  1 ý: 0.25đ • 2 ý: 0.5đ • 3 ý: 0.75đ • 4 ý: 1.0đ
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 3. Short Answer Answers */}
                {p3.length > 0 && (
                  <div className="space-y-2 break-inside-avoid">
                    <h4 className="font-bold text-xs uppercase bg-slate-100 p-1.5 border-l-4 border-slate-900">
                      ĐÁP ÁN PHẦN III (TRẢ LỜI NGẮN)
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      {p3.map((q, idx) => (
                        <div key={q.id} className="p-2 border border-slate-300 rounded bg-slate-50">
                          <span className="font-bold text-slate-800">Câu {p1.length + p2.length + idx + 1}: </span>
                          <strong className="text-emerald-700">
                            {(q.acceptableAnswers || ['']).join(' hoặc ')}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Detailed Essay Rubric & Explanations */}
                {p4.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h4 className="font-bold text-xs uppercase bg-slate-100 p-1.5 border-l-4 border-slate-900">
                      HƯỚNG DẪN CHẤM VÀ THANG ĐIỂM CHI TIẾT PHẦN IV (TỰ LUẬN)
                    </h4>
                    <div className="space-y-4">
                      {p4.map((q, idx) => (
                        <div key={q.id} className="p-3 border border-slate-300 rounded-lg space-y-2 bg-white break-inside-avoid text-xs">
                          <div className="flex items-center justify-between border-b pb-1 font-bold">
                            <span>Câu {p1.length + p2.length + p3.length + idx + 1}</span>
                            <span className="text-indigo-700">Điểm tối đa: {q.points || 2.5} điểm</span>
                          </div>
                          
                          <div>
                            <span className="font-bold text-slate-700">Nội dung câu hỏi:</span>
                            <div className="p-2 bg-slate-50 rounded mt-0.5"><MathRenderer content={q.prompt} /></div>
                          </div>

                          {q.sampleAnswer && (
                            <div>
                              <span className="font-bold text-emerald-800">Đáp án mẫu / Các bước giải:</span>
                              <div className="p-2 bg-emerald-50/50 border border-emerald-200 rounded mt-0.5 whitespace-pre-line font-mono text-[11px]">
                                {q.sampleAnswer}
                              </div>
                            </div>
                          )}

                          {q.rubric && (
                            <div>
                              <span className="font-bold text-slate-700">Biểu điểm chi tiết từng ý:</span>
                              <div className="p-2 bg-slate-50 rounded mt-0.5 text-[11px] text-slate-700">
                                {q.rubric}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-300 text-right text-xs italic">
                  Người lập hướng dẫn chấm: <strong>{teacherName}</strong>
                </div>

              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};
