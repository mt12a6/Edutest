import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  XCircle, 
  Check, 
  Sparkles, 
  Save, 
  Award, 
  Clock, 
  BookOpen, 
  ShieldAlert, 
  User, 
  HelpCircle 
} from 'lucide-react';
import { Exam, Question, ExamResult, ExamAttempt } from '../../types';
import { MathRenderer } from '../common/MathRenderer';
import { gradeEssaySubmission } from '../../services/db';
import { 
  isMultipleChoiceCorrect as checkMCCorrect, 
  isFillBlankCorrect as checkFBCorrect, 
  evaluateTrueFalseQuestion as evalTF 
} from '../../utils/grading';

interface StudentGradingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam;
  questions: Question[];
  result: ExamResult;
  attempt?: ExamAttempt;
  onGradedSuccess: () => void;
}

export const StudentGradingDetailModal: React.FC<StudentGradingDetailModalProps> = ({
  isOpen,
  onClose,
  exam,
  questions,
  result,
  attempt,
  onGradedSuccess
}) => {
  const essayQuestion = questions.find(q => q.type === 'essay');
  const essayMaxPoints = essayQuestion?.points || 2;

  const [essayScoreInput, setEssayScoreInput] = useState<number>(result.essayScore ?? 0);
  const [essayFeedbackInput, setEssayFeedbackInput] = useState<string>(result.essayFeedback || '');
  const [isAiGradingSingle, setIsAiGradingSingle] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const studentAnswers = attempt?.answers || (result as any)?.answers || {};

  // Check if multiple choice is correct
  const isMultipleChoiceCorrect = (q: Question) => {
    return checkMCCorrect(studentAnswers[q.id], q.correctOption, q.options);
  };

  // Check fill blank
  const isFillBlankCorrect = (q: Question) => {
    return checkFBCorrect(studentAnswers[q.id], q.acceptableAnswers, q.correctOption, q.sampleAnswer);
  };

  // Calculate True/False details
  const getTrueFalseBreakdown = (q: Question) => {
    const studentChoice = studentAnswers[q.id] || {};
    const subList = q.subQuestions || [];
    let matchCount = 0;
    const items = subList.map(sub => {
      const studentVal = studentChoice[sub.key];
      const isMatch = studentVal !== undefined && studentVal === sub.correct;
      if (isMatch) matchCount++;
      return {
        key: sub.key,
        text: sub.text,
        studentVal,
        correctVal: sub.correct,
        isMatch,
        points: sub.points ?? 0.25
      };
    });

    let ratio = 0;
    if (matchCount === 4) ratio = 1.0;
    else if (matchCount === 3) ratio = 0.5;
    else if (matchCount === 2) ratio = 0.25;
    else if (matchCount === 1) ratio = 0.1;

    const earnedPoints = Number(((q.points || 1) * ratio).toFixed(2));
    return { items, matchCount, earnedPoints, maxPoints: q.points || 1 };
  };

  // Call AI to suggest essay grade
  const handleAiSuggestEssay = async () => {
    if (!essayQuestion) return;
    setIsAiGradingSingle(true);
    try {
      const studentEssayAns = studentAnswers[essayQuestion.id] || '';
      const apiRes = await fetch('/api/grade-essay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: essayQuestion.prompt,
          sampleAnswer: essayQuestion.sampleAnswer,
          rubric: essayQuestion.rubric,
          studentAnswer: studentEssayAns,
          maxPoints: essayMaxPoints
        })
      });
      const apiJson = await apiRes.json();
      if (apiJson.success && apiJson.data) {
        setEssayScoreInput(apiJson.data.score || 0);
        const fb = `${apiJson.data.feedback || ''}\n• Điểm mạnh: ${apiJson.data.strengths || ''}\n• Cần cải thiện: ${apiJson.data.improvements || ''}`;
        setEssayFeedbackInput(fb.trim());
      }
    } catch (err) {
      console.error('Lỗi khi AI gợi ý chấm bài:', err);
    } finally {
      setIsAiGradingSingle(false);
    }
  };

  // Save manual essay grade
  const handleSaveTeacherGrade = async () => {
    setIsSaving(true);
    setSaveSuccessMsg(null);
    try {
      await gradeEssaySubmission(
        result.attemptId || result.id,
        Number(essayScoreInput),
        essayFeedbackInput || 'Đã được giáo viên chấm và ghi nhận điểm.',
        false, // Marked as teacher graded
        'Giáo viên phụ trách'
      );
      setSaveSuccessMsg('Đã lưu thành công điểm tự luận và cộng vào tổng điểm bài thi!');
      setTimeout(() => {
        onGradedSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Lỗi lưu điểm tự luận:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base leading-tight">
                  Chi tiết bài làm: {result.studentName}
                </h3>
                {result.classId && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                    Lớp {result.classId}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300">
                Đề thi: {exam.title} • Nộp lúc: {new Date(result.submittedAt).toLocaleString('vi-VN')}
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

        {/* Score overview summary ribbon */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-slate-400 font-semibold block text-[10px] uppercase">Điểm hiện tại</span>
              <span className="text-xl font-black text-slate-900">
                {result.score} <span className="text-xs font-normal text-slate-400">/ {result.maxScore || 10}</span>
              </span>
            </div>
            <div className="h-7 w-px bg-slate-200" />
            <div>
              <span className="text-slate-400 font-semibold block text-[10px] uppercase">Đúng / Sai</span>
              <span className="font-bold text-slate-800">
                <span className="text-emerald-700">{result.correctCount} đúng</span> • <span className="text-rose-600">{result.wrongCount} sai</span>
              </span>
            </div>
            <div className="h-7 w-px bg-slate-200" />
            <div>
              <span className="text-slate-400 font-semibold block text-[10px] uppercase">Trạng thái tự luận</span>
              <span className={`inline-block font-bold px-2 py-0.5 rounded-full text-[10px] ${
                result.status === 'pending_essay_grading'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : result.isAiGraded
                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}>
                {result.status === 'pending_essay_grading' ? 'Chờ chấm điểm tự luận' : result.isAiGraded ? '🤖 AI đã chấm' : '🧑‍🏫 Giáo viên đã chấm'}
              </span>
            </div>
          </div>

          {result.tabViolations ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              <span>{result.tabViolations} lần rời màn hình thi</span>
            </span>
          ) : (
            <span className="text-[11px] text-emerald-700 font-semibold">
              ✓ Không vi phạm chuyển tab
            </span>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {saveSuccessMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* SECTION 1: ESSAY GRADING SECTION (PROMINENT AT TOP IF ESSAY EXISTS) */}
          {essayQuestion && (
            <div className="p-5 rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                    ✍️
                  </span>
                  <div>
                    <h4 className="font-extrabold text-sm text-indigo-950">
                      Chấm điểm câu Tự luận (Câu {essayQuestion.questionNumber})
                    </h4>
                    <p className="text-[11px] text-indigo-800/80">
                      Giáo viên chấm điểm trực tiếp và ghi nhận vào kết quả tổng của bài thi
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isAiGradingSingle}
                  onClick={handleAiSuggestEssay}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  title="Nhờ AI chấm tự động theo rubric và đáp án mẫu"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isAiGradingSingle ? 'AI đang đọc bài...' : 'AI gợi ý chấm điểm'}</span>
                </button>
              </div>

              {/* Essay Prompt */}
              <div className="space-y-1 text-xs">
                <span className="font-bold text-slate-700 block">Đề bài:</span>
                <div className="p-3 bg-white rounded-xl border border-indigo-100 text-slate-900 leading-relaxed font-medium">
                  <MathRenderer content={essayQuestion.prompt} />
                </div>
              </div>

              {/* Student's written answer */}
              <div className="space-y-1 text-xs">
                <span className="font-bold text-slate-700 block">Bài làm của học sinh:</span>
                <div className="p-3.5 bg-white rounded-xl border-2 border-indigo-200 text-slate-900 leading-relaxed font-mono whitespace-pre-line text-xs min-h-[90px]">
                  {studentAnswers[essayQuestion.id] || '(Học sinh để trống câu này, không nhập bài làm)'}
                </div>
              </div>

              {/* Sample answer */}
              {essayQuestion.sampleAnswer && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-950 space-y-1">
                  <span className="font-bold text-emerald-900 block">Dàn ý & Hướng dẫn chấm mẫu:</span>
                  <p className="whitespace-pre-line text-[11px]">{essayQuestion.sampleAnswer}</p>
                </div>
              )}

              {/* Teacher Grading Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-bold text-indigo-950 mb-1">
                    Điểm số giáo viên chấm:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      max={essayMaxPoints}
                      value={essayScoreInput}
                      onChange={(e) => setEssayScoreInput(parseFloat(e.target.value) || 0)}
                      className="w-24 p-2 text-sm font-black text-indigo-950 bg-white border-2 border-indigo-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-bold text-slate-600">/ {essayMaxPoints} điểm</span>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-indigo-950 mb-1">
                    Lời phê / Nhận xét của giáo viên:
                  </label>
                  <input
                    type="text"
                    value={essayFeedbackInput}
                    onChange={(e) => setEssayFeedbackInput(e.target.value)}
                    placeholder="Nhận xét ưu điểm và những lỗi cần khắc phục..."
                    className="w-full p-2 text-xs bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveTeacherGrade}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Đang lưu điểm...' : 'Lưu điểm & Cộng vào bài thi'}</span>
                </button>
              </div>
            </div>
          )}

          {/* SECTION 2: QUESTION BY QUESTION DETAILED BREAKDOWN */}
          <div className="space-y-4">
            <h4 className="font-extrabold text-sm text-slate-900 pb-2 border-b border-slate-200 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              Chi tiết từng câu hỏi trong đề thi & Kết quả chấm điểm
            </h4>

            <div className="space-y-4">
              {questions.map((q) => {
                const qType = q.type || 'multiple_choice';

                return (
                  <div key={q.id} className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
                    
                    {/* Question Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-slate-900 text-white font-bold text-[11px] flex items-center justify-center">
                          {q.questionNumber}
                        </span>
                        <span className="font-bold text-slate-800">
                          Câu {q.questionNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {qType === 'multiple_choice' && 'Trắc nghiệm 4 lựa chọn'}
                          {qType === 'true_false' && 'Trắc nghiệm Đúng / Sai'}
                          {qType === 'fill_blank' && 'Điền kết quả'}
                          {qType === 'essay' && 'Tự luận'}
                        </span>
                      </div>

                      {/* Status badge */}
                      {qType === 'multiple_choice' && (
                        isMultipleChoiceCorrect(q) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <Check className="w-3.5 h-3.5" /> Đúng (+{q.points || 1}đ)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            <X className="w-3.5 h-3.5" /> Sai (0đ)
                          </span>
                        )
                      )}

                      {qType === 'fill_blank' && (
                        isFillBlankCorrect(q) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <Check className="w-3.5 h-3.5" /> Đúng (+{q.points || 1}đ)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            <X className="w-3.5 h-3.5" /> Sai (0đ)
                          </span>
                        )
                      )}
                    </div>

                    {/* Prompt */}
                    <div className="text-xs sm:text-sm font-semibold text-slate-900 leading-relaxed">
                      <MathRenderer content={q.prompt} />
                    </div>

                    {/* DẠNG 1: MULTIPLE CHOICE */}
                    {qType === 'multiple_choice' && q.options && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {(['A', 'B', 'C', 'D'] as const).map(key => {
                          const text = q.options?.[key];
                          if (!text && text !== '0') return null;
                          const isCorrect = q.correctOption === key;
                          const isChosen = studentAnswers[q.id] === key;

                          let style = 'bg-slate-50 border-slate-200 text-slate-700';
                          if (isCorrect) style = 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold';
                          else if (isChosen && !isCorrect) style = 'bg-rose-50 border-rose-300 text-rose-950 font-semibold';

                          return (
                            <div key={key} className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${style}`}>
                              <div className="flex items-center gap-2">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                                  isCorrect ? 'bg-emerald-600 text-white' : isChosen ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-700'
                                }`}>
                                  {key}
                                </span>
                                <span><MathRenderer content={text} inline /></span>
                              </div>
                              {isCorrect && <span className="text-[10px] font-bold text-emerald-700 uppercase">Đáp án đúng</span>}
                              {isChosen && !isCorrect && <span className="text-[10px] font-bold text-rose-600 uppercase">Học sinh chọn</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* DẠNG 2: TRUE / FALSE CHI TIẾT TỪNG Ý (RÕ RÀNG MINH BẠCH) */}
                    {qType === 'true_false' && (() => {
                      const tfBreakdown = getTrueFalseBreakdown(q);
                      return (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                            <span>Chi tiết 4 khẳng định Đúng / Sai:</span>
                            <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              Đạt {tfBreakdown.earnedPoints} / {tfBreakdown.maxPoints} điểm (Đúng {tfBreakdown.matchCount}/4 ý)
                            </span>
                          </div>

                          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                            {tfBreakdown.items.map((sub) => (
                              <div key={sub.key} className="p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <div className="flex items-start gap-2 flex-1">
                                  <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 font-bold text-[11px] flex items-center justify-center shrink-0">
                                    {sub.key}
                                  </span>
                                  <div className="text-slate-800">
                                    <MathRenderer content={sub.text} inline />
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                  {/* Student answer badge */}
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                    sub.studentVal === true
                                      ? 'bg-blue-50 text-blue-800 border-blue-200'
                                      : sub.studentVal === false
                                      ? 'bg-slate-100 text-slate-800 border-slate-200'
                                      : 'bg-amber-50 text-amber-800 border-amber-200'
                                  }`}>
                                    HS chọn: <strong>{sub.studentVal === true ? 'ĐÚNG' : sub.studentVal === false ? 'SAI' : 'Chưa chọn'}</strong>
                                  </span>

                                  {/* Official answer badge */}
                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px] border border-slate-200">
                                    Đáp án: <strong>{sub.correctVal ? 'ĐÚNG' : 'SAI'}</strong>
                                  </span>

                                  {/* Matching score badge */}
                                  {sub.isMatch ? (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center gap-1 border border-emerald-300">
                                      <Check className="w-3 h-3 text-emerald-700" />
                                      <span>ĐÚNG (+{sub.points}đ)</span>
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px] flex items-center gap-1 border border-rose-300">
                                      <X className="w-3 h-3 text-rose-700" />
                                      <span>SAI (0đ)</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* DẠNG 3: FILL IN THE BLANK */}
                    {qType === 'fill_blank' && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-medium">Học sinh điền:</span>
                          <strong className={`px-2 py-0.5 rounded ${
                            isFillBlankCorrect(q) ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {studentAnswers[q.id] || '(Để trống)'}
                          </strong>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-medium">Đáp án chuẩn:</span>
                          <strong className="text-emerald-700">
                            {(q.acceptableAnswers || []).join(' hoặc ')}
                          </strong>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 text-xs shrink-0">
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
