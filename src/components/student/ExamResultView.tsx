import React, { useState } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ArrowLeft, 
  Award, 
  Clock, 
  BookOpen, 
  Eye, 
  Check, 
  X,
  Sparkles,
  HelpCircle,
  Image as ImageIcon,
  RotateCcw,
  Lock,
  Printer,
  FileText
} from 'lucide-react';
import { Exam, Question, ExamResult, ExamAttempt } from '../../types';
import { MathRenderer } from '../common/MathRenderer';
import { isQuestionCorrect, evaluateTrueFalseQuestion } from '../../utils/grading';
import { useAuth } from '../../context/AuthContext';

interface ExamResultViewProps {
  exam: Exam;
  result: ExamResult;
  questions: Question[];
  attempt?: ExamAttempt;
  onBackToDashboard: () => void;
  onRetakeExam?: (exam: Exam, questions: Question[]) => void;
}

export const ExamResultView: React.FC<ExamResultViewProps> = ({
  exam,
  result,
  questions,
  attempt,
  onBackToDashboard,
  onRetakeExam
}) => {
  const { isAdmin, isTeacher } = useAuth();
  const [filter, setFilter] = useState<'all' | 'correct' | 'wrong'>('all');
  const [showPrintView, setShowPrintView] = useState<boolean>(false);

  // Privileged users (teachers and admins) can always view scores and answers
  const isPrivileged = Boolean(isAdmin || isTeacher);
  const canShowScore = isPrivileged || exam.showScoreAfterExam !== false;
  const canShowAnswers = isPrivileged || exam.showAnswersAfterExam !== false;

  const isPassed = result.score >= (exam.passScore || 5);
  // Guarantee studentAnswers is never empty by reading from attempt or result
  const studentAnswers = attempt?.answers || result?.answers || {};

  const checkCorrect = (q: Question) => isQuestionCorrect(q, studentAnswers);

  const filteredQuestions = questions.filter(q => {
    if (!canShowAnswers) return true; // If answers are hidden, show all
    const isCorrect = checkCorrect(q);
    if (filter === 'correct') return isCorrect;
    if (filter === 'wrong') return !isCorrect;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* Top Banner */}
      {canShowScore ? (
        <div className={`p-8 rounded-3xl shadow-sm border text-center relative overflow-hidden ${
          isPassed 
            ? 'bg-gradient-to-b from-emerald-50 to-white border-emerald-200' 
            : 'bg-gradient-to-b from-amber-50 to-white border-amber-200'
        }`}>
          <div className="max-w-lg mx-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-white border shadow-xs">
              {isPassed ? (
                <span className="text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Kết quả: Đạt yêu cầu
                </span>
              ) : (
                <span className="text-amber-700 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  Kết quả: Chưa đạt
                </span>
              )}
            </div>

            <h2 className="text-2xl font-extrabold text-slate-900">
              {exam.title}
            </h2>
            <p className="text-xs text-slate-500">
              Môn {exam.subjectName} • Nộp lúc {new Date(result.submittedAt).toLocaleTimeString('vi-VN')} ngày {new Date(result.submittedAt).toLocaleDateString('vi-VN')}
            </p>

            {/* Big Score Display */}
            <div className="py-4">
              <span className="text-6xl font-black tracking-tight text-slate-900">
                {result.score}
              </span>
              <span className="text-xl font-bold text-slate-400"> / {result.maxScore || 10}</span>
              <p className="text-sm font-semibold text-emerald-700 mt-1">
                Đạt {result.percentage}% điểm tổng
              </p>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-3 gap-3 text-xs pt-2 max-w-sm mx-auto">
              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100">
                <p className="text-emerald-600 font-medium">Câu đúng</p>
                <p className="text-base font-bold text-emerald-800">{result.correctCount}</p>
              </div>
              <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-100">
                <p className="text-rose-600 font-medium">Câu sai</p>
                <p className="text-base font-bold text-rose-800">{result.wrongCount}</p>
              </div>
              <div className="p-2.5 bg-slate-100 rounded-xl border border-slate-200">
                <p className="text-slate-600 font-medium">Chưa làm</p>
                <p className="text-base font-bold text-slate-800">{result.unattemptedCount}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Hidden Score Protected Banner */
        <div className="p-8 rounded-3xl shadow-sm border text-center relative overflow-hidden bg-gradient-to-b from-blue-50 to-white border-blue-200">
          <div className="max-w-lg mx-auto space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-blue-100 text-blue-900 border border-blue-200 shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-700" />
              Đã nộp bài thi thành công
            </div>

            <h2 className="text-2xl font-extrabold text-slate-900">
              {exam.title}
            </h2>
            <p className="text-xs text-slate-500">
              Môn {exam.subjectName} • Nộp lúc {new Date(result.submittedAt).toLocaleTimeString('vi-VN')} ngày {new Date(result.submittedAt).toLocaleDateString('vi-VN')}
            </p>

            <div className="py-6 px-4 bg-white/80 rounded-2xl border border-blue-200 my-4 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mx-auto mb-2">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-900">
                Điểm số bài thi đang được bảo mật
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
                Theo quy định của kỳ thi này, giáo viên đã tắt tùy chọn hiển thị điểm ngay sau khi nộp. Kết quả chính thức sẽ được công bố sau khi toàn bộ thí sinh hoàn thành bài thi hoặc giáo viên mở kết quả.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Review Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              {canShowAnswers ? 'Xem lại bài làm & Lời giải chi tiết' : 'Xem lại bài làm đã nộp'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {canShowAnswers 
                ? 'Đối chiếu bài làm của bạn với đáp án chuẩn và phân tích câu hỏi' 
                : 'Quy chế: Đáp án và lời giải chi tiết chưa được mở công khai cho bài thi này.'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowPrintView(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200 shadow-2xs"
              title="In hoặc tải bản PDF bài làm"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-600" />
              <span>In bài làm (PDF)</span>
            </button>

            {canShowAnswers && (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Tất cả ({questions.length})
                </button>
                <button
                  onClick={() => setFilter('correct')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filter === 'correct' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-emerald-700'
                  }`}
                >
                  Đúng ({result.correctCount})
                </button>
                <button
                  onClick={() => setFilter('wrong')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filter === 'wrong' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-500 hover:text-rose-700'
                  }`}
                >
                  Sai ({result.wrongCount})
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-4">
          {filteredQuestions.map((q) => {
            const studentChoice = studentAnswers[q.id];
            const isCorrect = checkCorrect(q);
            const isUnattempted = studentChoice === undefined || studentChoice === null || studentChoice === '';
            const qType = q.type || 'multiple_choice';

            return (
              <div 
                key={q.id} 
                className={`p-6 bg-white rounded-3xl border shadow-xs transition-all space-y-4 ${
                  !canShowAnswers
                    ? 'border-slate-200'
                    : isCorrect 
                    ? 'border-emerald-200 hover:border-emerald-300' 
                    : isUnattempted 
                    ? 'border-slate-200 bg-slate-50/30' 
                    : 'border-rose-200 hover:border-rose-300'
                }`}
              >
                {/* Header info */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                      {q.questionNumber}
                    </span>
                    <span className="font-extrabold text-sm text-slate-900">
                      Câu {q.questionNumber}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                      {qType === 'multiple_choice' && 'Phần I: Trắc nghiệm 4 lựa chọn'}
                      {qType === 'true_false' && 'Phần II: Đúng / Sai 4 ý'}
                      {qType === 'fill_blank' && 'Phần III: Trả lời ngắn'}
                      {qType === 'essay' && 'Phần IV: Tự luận'}
                    </span>
                  </div>

                  {/* Question Result Badge */}
                  <div>
                    {!canShowAnswers ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                        {isUnattempted ? 'Chưa trả lời' : 'Đã nộp bài'}
                      </span>
                    ) : qType === 'true_false' ? (
                      (() => {
                        const tfMatches = (q.subQuestions || []).filter(sub => {
                          const val = studentChoice?.[sub.key];
                          return val !== undefined && val === sub.correct;
                        }).length;
                        const totalSubs = (q.subQuestions || []).length || 4;
                        const earnedTF = Number((tfMatches * 0.25 * (q.points || 1)).toFixed(2));
                        return tfMatches === totalSubs ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Đúng 4/4 ý {canShowScore ? `(+${q.points || 1}đ)` : ''}
                          </span>
                        ) : tfMatches > 0 ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <Check className="w-3.5 h-3.5 text-amber-700" /> Đúng {tfMatches}/{totalSubs} ý {canShowScore ? `(+${earnedTF}đ)` : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            <XCircle className="w-4 h-4 text-rose-600" /> Sai cả {totalSubs} ý {canShowScore ? '(0đ)' : ''}
                          </span>
                        );
                      })()
                    ) : qType === 'essay' ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                        {isUnattempted ? 'Chưa làm' : canShowScore && result.essayGrades?.[q.id]?.score !== undefined ? `Điểm: ${result.essayGrades[q.id].score}/${q.points || 2.5}đ` : 'Tự luận'}
                      </span>
                    ) : isCorrect ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Trả lời đúng {canShowScore ? `(+${q.points || 1}đ)` : ''}
                      </span>
                    ) : isUnattempted ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                        Chưa trả lời {canShowScore ? '(0đ)' : ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                        <XCircle className="w-4 h-4 text-rose-600" /> Trả lời chưa đúng {canShowScore ? '(0đ)' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Prompt with MathRenderer */}
                <div className="text-sm font-semibold text-slate-900 leading-relaxed">
                  <MathRenderer content={q.prompt} />
                </div>

                {/* Image if attached */}
                {q.imageUrl && (
                  <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 inline-block">
                    <img src={q.imageUrl} alt="Hình minh họa" className="max-h-56 rounded-lg object-contain bg-white" />
                  </div>
                )}

                {/* 1. Multiple Choice Review */}
                {qType === 'multiple_choice' && q.options && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(['A', 'B', 'C', 'D'] as const).map((key) => {
                      const text = q.options?.[key];
                      if (!text && text !== '0') return null;

                      const cleanCorrect = (q.correctOption || '').toUpperCase().replace(/[^A-D]/g, '');
                      const cleanStudent = String(studentChoice || '').toUpperCase().replace(/[^A-D]/g, '');
                      const isKeyCorrect = cleanCorrect === key;
                      const isStudentKey = cleanStudent === key || (
                        String(studentChoice || '').trim().toLowerCase() === String(text || '').trim().toLowerCase()
                      );

                      let cardStyle = 'bg-slate-50 border-slate-200 text-slate-700';
                      if (canShowAnswers) {
                        if (isKeyCorrect) {
                          cardStyle = 'bg-emerald-50/80 border-emerald-400 text-emerald-950 font-semibold ring-1 ring-emerald-400';
                        } else if (isStudentKey && !isCorrect) {
                          cardStyle = 'bg-rose-50 border-rose-300 text-rose-950 ring-1 ring-rose-300';
                        }
                      } else {
                        if (isStudentKey) {
                          cardStyle = 'bg-indigo-50 border-indigo-300 text-indigo-950 font-semibold ring-1 ring-indigo-300';
                        }
                      }

                      return (
                        <div 
                          key={key} 
                          className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs ${cardStyle}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                              canShowAnswers && isKeyCorrect 
                                ? 'bg-emerald-600 text-white' 
                                : isStudentKey 
                                ? canShowAnswers ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white' 
                                : 'bg-slate-200 text-slate-700'
                            }`}>
                              {key}
                            </span>
                            <div className="space-y-1">
                              <MathRenderer content={text} inline />
                              {q.optionImages?.[key] && (
                                <div>
                                  <img 
                                    src={q.optionImages[key]} 
                                    alt={`Hình phương án ${key}`} 
                                    className="max-h-24 max-w-xs rounded border border-slate-200 object-contain bg-white mt-1"
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {canShowAnswers && isKeyCorrect && (
                              <span className="text-[10px] font-bold text-emerald-700 uppercase bg-emerald-100 px-2 py-0.5 rounded-full">
                                Đáp án đúng
                              </span>
                            )}
                            {isStudentKey && (
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                canShowAnswers && !isKeyCorrect 
                                  ? 'text-rose-700 bg-rose-100' 
                                  : 'text-indigo-700 bg-indigo-100'
                              }`}>
                                Bạn chọn
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 2. True / False Review */}
                {qType === 'true_false' && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-600">
                      Chi tiết 4 khẳng định:
                    </p>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                      {(q.subQuestions || []).map((sub) => {
                        const rawStudent = studentChoice?.[sub.key];
                        let studentVal: boolean | null = null;
                        if (rawStudent === true || rawStudent === 'true' || rawStudent === 'Đúng') studentVal = true;
                        else if (rawStudent === false || rawStudent === 'false' || rawStudent === 'Sai') studentVal = false;

                        const isMatch = studentVal !== null && studentVal === sub.correct;

                        return (
                          <div key={sub.key} className="p-3 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                            <div className="flex items-start gap-2.5 flex-1">
                              <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">
                                {sub.key}
                              </span>
                              <div className="text-slate-800">
                                <MathRenderer content={sub.text} inline />
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold border bg-slate-50 border-slate-200">
                                Bạn chọn: <strong>{studentVal === true ? 'ĐÚNG' : studentVal === false ? 'SAI' : 'Chưa chọn'}</strong>
                              </span>

                              {canShowAnswers && (
                                <>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    Đáp án: <strong>{sub.correct ? 'ĐÚNG' : 'SAI'}</strong>
                                  </span>

                                  {isMatch ? (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center gap-0.5">
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      {canShowScore ? '+0.25đ' : 'Đúng'}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px] flex items-center gap-0.5">
                                      <X className="w-3 h-3 text-rose-600" />
                                      {canShowScore ? '0đ' : 'Sai'}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Fill in the Blank Review */}
                {qType === 'fill_blank' && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-medium">Bạn đã điền:</span>
                      <strong className={`px-2.5 py-1 rounded-lg ${
                        !canShowAnswers
                          ? 'bg-indigo-100 text-indigo-900 font-mono'
                          : isCorrect 
                          ? 'bg-emerald-100 text-emerald-800 font-mono' 
                          : 'bg-rose-100 text-rose-800 font-mono'
                      }`}>
                        {studentChoice || '(Để trống)'}
                      </strong>
                    </div>

                    {canShowAnswers && (
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                        <span className="text-slate-500 font-medium">Đáp án chấp nhận:</span>
                        <strong className="text-emerald-700 font-mono">
                          {(q.acceptableAnswers || []).join(' hoặc ') || q.correctOption}
                        </strong>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Essay Review */}
                {qType === 'essay' && (
                  <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-200 space-y-3 text-xs">
                    <div>
                      <span className="text-slate-600 font-bold block mb-1">Bài làm tự luận của bạn:</span>
                      <div className="p-3 bg-white rounded-xl border border-indigo-100 text-slate-800 font-mono whitespace-pre-line text-xs min-h-[60px]">
                        {studentChoice || '(Bạn đã để trống câu này)'}
                      </div>
                    </div>

                    {canShowScore && result.essayGrades?.[q.id] && (
                      <div className="p-3 bg-white rounded-xl border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="font-bold text-indigo-950">
                          Điểm chấm: <strong className="text-indigo-700 text-sm">{result.essayGrades[q.id].score}</strong> / {q.points || 2.5}đ
                        </span>
                        {result.essayGrades[q.id].feedback && (
                          <span className="text-[11px] text-slate-600 italic">
                            Lời phê: "{result.essayGrades[q.id].feedback}"
                          </span>
                        )}
                      </div>
                    )}

                    {canShowAnswers && (q.sampleAnswer || q.explanation) && (
                      <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1 text-emerald-950">
                        <span className="font-bold text-emerald-900 block">Dàn ý & Đáp án mẫu:</span>
                        <p className="whitespace-pre-line text-[11px]">{q.sampleAnswer || q.explanation}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Explanation Box (Only shown if answers are permitted) */}
                {canShowAnswers && q.explanation && qType !== 'essay' && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1">
                    <span className="font-bold text-slate-700 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      Lời giải chi tiết:
                    </span>
                    <div className="text-slate-600 leading-relaxed font-normal">
                      <MathRenderer content={q.explanation} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
        <button
          onClick={onBackToDashboard}
          className="px-5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại trang danh sách đề thi</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPrintView(true)}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Printer className="w-4 h-4 text-emerald-600" />
            <span>In bài thi (4 phần)</span>
          </button>

          {exam.allowRetake && onRetakeExam && (
            <button
              onClick={() => onRetakeExam(exam, questions)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Luyện tập thi lại lần nữa</span>
            </button>
          )}
        </div>
      </div>

      {/* PRINT VIEW OVERLAY */}
      {showPrintView && (
        <div className="fixed inset-0 z-60 bg-white overflow-y-auto p-4 sm:p-8 animate-in fade-in print:p-0">
          <div className="max-w-4xl mx-auto space-y-6 bg-white text-slate-900">
            
            {/* Top Toolbar (Hidden on print) */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 print:hidden">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-sm sm:text-base">
                  Bản in bài thi học sinh (Đầy đủ 4 phần)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>In / Lưu PDF ngay</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintView(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Quay lại
                </button>
              </div>
            </div>

            {/* Print Header */}
            <div className="border-b-2 border-slate-900 pb-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">HỆ THỐNG THI TRỰC TUYẾN EDUTEST</h4>
                  <h2 className="text-xl font-black text-slate-900 uppercase mt-0.5">{exam.title}</h2>
                  <p className="text-xs text-slate-600 font-medium">Môn: {exam.subjectName} • Khối {exam.grade}</p>
                </div>
                <div className="p-3 border-2 border-slate-900 rounded-xl text-center min-w-[120px]">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">ĐIỂM TỔNG KẾT</span>
                  <span className="text-2xl font-black text-slate-900">
                    {canShowScore ? result.score : 'BẢO MẬT'}
                  </span>
                  {canShowScore && <span className="text-xs text-slate-500"> / {result.maxScore || 10}</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px]">Thí sinh:</span>
                  <strong className="text-slate-900">{result.studentName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Lớp:</span>
                  <strong className="text-slate-900">{result.classId || 'Tự do'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Thời gian nộp:</span>
                  <strong className="text-slate-900">{new Date(result.submittedAt).toLocaleString('vi-VN')}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Trạng thái:</span>
                  <strong className="text-emerald-700">ĐÃ NỘP BÀI</strong>
                </div>
              </div>
            </div>

            {/* Questions by Section */}
            {/* PHẦN 1: TRẮC NGHIỆM */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-indigo-950 bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                PHẦN I: CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN
              </h4>
              <div className="space-y-3">
                {questions.filter(q => (q.type || 'multiple_choice') === 'multiple_choice').map(q => {
                  const studentAns = studentAnswers[q.id];
                  const isCorrect = checkCorrect(q);
                  return (
                    <div key={q.id} className="p-3 border border-slate-200 rounded-xl text-xs space-y-2 break-inside-avoid">
                      <div className="flex justify-between font-bold">
                        <span>Câu {q.questionNumber}: <MathRenderer content={q.prompt} inline /></span>
                        {canShowScore && (
                          <span className={isCorrect ? 'text-emerald-700' : 'text-rose-600'}>
                            {isCorrect ? `Đúng (+${q.points || 1}đ)` : 'Sai (0đ)'}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-4 text-[11px]">
                        <span>Học sinh chọn: <strong>{studentAns || 'Chưa chọn'}</strong></span>
                        {canShowAnswers && <span>Đáp án chuẩn: <strong className="text-emerald-700">{q.correctOption}</strong></span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PHẦN 2: ĐÚNG / SAI */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-emerald-950 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                PHẦN II: CÂU TRẮC NGHIỆM ĐÚNG / SAI
              </h4>
              <div className="space-y-3">
                {questions.filter(q => q.type === 'true_false').map(q => {
                  const tfMatches = (q.subQuestions || []).filter(sub => studentChoiceMatches(q.id, sub.key, sub.correct, studentAnswers)).length;
                  return (
                    <div key={q.id} className="p-3 border border-slate-200 rounded-xl text-xs space-y-2 break-inside-avoid">
                      <div className="flex justify-between font-bold">
                        <span>Câu {q.questionNumber}: <MathRenderer content={q.prompt} inline /></span>
                        {canShowScore && (
                          <span className="text-emerald-700">Đạt {(tfMatches * 0.25 * (q.points || 1)).toFixed(2)} / {q.points || 1}đ</span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        {(q.subQuestions || []).map(sub => {
                          const val = studentAnswers[q.id]?.[sub.key];
                          const isMatch = val !== undefined && val === sub.correct;
                          return (
                            <div key={sub.key} className="p-2 bg-slate-50 rounded border border-slate-200 flex justify-between">
                              <span>{sub.key}) <MathRenderer content={sub.text} inline /></span>
                              <span>
                                HS: <strong>{val === true ? 'Đ' : val === false ? 'S' : '-'}</strong>
                                {canShowAnswers && (
                                  <> | ĐA: <strong>{sub.correct ? 'Đ' : 'S'}</strong> {canShowScore ? `(${isMatch ? '+0.25đ' : '0đ'})` : ''}</>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PHẦN 3: ĐIỀN KẾT QUẢ */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-amber-950 bg-amber-50 p-2 rounded-lg border border-amber-100">
                PHẦN III: CÂU HỎI TRẢ LỜI NGẮN / ĐIỀN KẾT QUẢ
              </h4>
              <div className="space-y-3">
                {questions.filter(q => q.type === 'fill_blank').map(q => {
                  const isCorrect = checkCorrect(q);
                  return (
                    <div key={q.id} className="p-3 border border-slate-200 rounded-xl text-xs space-y-1.5 break-inside-avoid">
                      <div className="flex justify-between font-bold">
                        <span>Câu {q.questionNumber}: <MathRenderer content={q.prompt} inline /></span>
                        {canShowScore && (
                          <span className={isCorrect ? 'text-emerald-700' : 'text-rose-600'}>
                            {isCorrect ? `Đúng (+${q.points || 1}đ)` : 'Sai (0đ)'}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-4 text-[11px]">
                        <span>Thí sinh điền: <strong>{studentAnswers[q.id] || '(Để trống)'}</strong></span>
                        {canShowAnswers && <span>Đáp án chuẩn: <strong className="text-emerald-700">{(q.acceptableAnswers || []).join(' hoặc ')}</strong></span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PHẦN 4: TỰ LUẬN */}
            {questions.some(q => q.type === 'essay') && (
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-purple-950 bg-purple-50 p-2 rounded-lg border border-purple-100">
                  PHẦN IV: CÂU HỎI TỰ LUẬN
                </h4>
                <div className="space-y-4">
                  {questions.filter(q => q.type === 'essay').map(q => (
                    <div key={q.id} className="p-4 border-2 border-slate-300 rounded-xl text-xs space-y-2.5 break-inside-avoid">
                      <div className="flex justify-between font-bold">
                        <span>Câu {q.questionNumber}: <MathRenderer content={q.prompt} inline /></span>
                        {canShowScore && result.essayGrades?.[q.id]?.score !== undefined && (
                          <span className="text-indigo-800">Điểm: {result.essayGrades[q.id].score} / {q.points || 2.5}đ</span>
                        )}
                      </div>
                      <div>
                        <span className="font-bold text-slate-700 text-[11px] block mb-1">Bài làm thí sinh:</span>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 font-mono whitespace-pre-line text-[11px]">
                          {studentAnswers[q.id] || '(Học sinh để trống câu này)'}
                        </div>
                      </div>
                      {canShowScore && result.essayGrades?.[q.id]?.feedback && (
                        <div className="p-2.5 bg-indigo-50 rounded-lg border border-indigo-100 text-[11px] text-indigo-950">
                          <strong>Lời phê của giáo viên:</strong> {result.essayGrades[q.id].feedback}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Signature Box */}
            <div className="grid grid-cols-2 gap-8 pt-8 pb-4 text-center text-xs">
              <div>
                <p className="font-bold">THÍ SINH</p>
                <p className="text-[10px] text-slate-400 italic">(Ký và ghi rõ họ tên)</p>
                <div className="h-16"></div>
                <p className="font-bold text-slate-800">{result.studentName}</p>
              </div>
              <div>
                <p className="font-bold">GIÁO VIÊN CHẤM THI</p>
                <p className="text-[10px] text-slate-400 italic">(Ký và ghi rõ họ tên)</p>
                <div className="h-16"></div>
                <p className="font-bold text-slate-800">Giáo viên phụ trách</p>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

// Helper for true false matches in print view
function studentChoiceMatches(qId: string, subKey: string, correctVal: boolean, answers: Record<string, any>): boolean {
  const choice = answers[qId]?.[subKey];
  return choice !== undefined && choice === correctVal;
}
