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
  RotateCcw
} from 'lucide-react';
import { Exam, Question, ExamResult, ExamAttempt } from '../../types';
import { MathRenderer } from '../common/MathRenderer';

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

  const [filter, setFilter] = useState<'all' | 'correct' | 'wrong'>('all');

  const isPassed = result.score >= (exam.passScore || 5);
  const studentAnswers = attempt?.answers || {};

  const isQuestionCorrect = (q: Question) => {
    const studentChoice = studentAnswers[q.id];
    if (studentChoice === undefined || studentChoice === null || studentChoice === '') return false;
    
    if (q.type === 'true_false') {
      if (typeof studentChoice !== 'object') return false;
      const subList = q.subQuestions || [];
      return subList.every(sub => studentChoice[sub.key] === sub.correct);
    }

    if (q.type === 'fill_blank') {
      const cleanAns = String(studentChoice).trim().toLowerCase().replace(/\s+/g, '');
      const acceptable = (q.acceptableAnswers || []).map(a => String(a).trim().toLowerCase().replace(/\s+/g, ''));
      const altAns = cleanAns.includes('.') ? cleanAns.replace('.', ',') : cleanAns.replace(',', '.');
      return acceptable.some(a => a === cleanAns || a === altAns);
    }

    if (q.type === 'essay') {
      return String(studentChoice).trim().length > 0;
    }

    return studentChoice === q.correctOption;
  };

  const filteredQuestions = questions.filter(q => {
    const isCorrect = isQuestionCorrect(q);
    if (filter === 'correct') return isCorrect;
    if (filter === 'wrong') return !isCorrect;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* Top Banner with Score */}
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

      {/* Review Section */}
      {exam.showAnswersAfterExam ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                Xem lại bài làm & Lời giải chi tiết
              </h3>
              <p className="text-xs text-slate-500">
                Hiển thị bài làm của bạn, đáp án chính thức, lời giải chi tiết và công thức Toán KaTeX
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 text-xs">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  filter === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất cả ({questions.length})
              </button>
              <button
                onClick={() => setFilter('correct')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  filter === 'correct' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                Đúng ({result.correctCount})
              </button>
              <button
                onClick={() => setFilter('wrong')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  filter === 'wrong' ? 'bg-rose-600 text-white shadow-xs' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                Sai / Bỏ qua ({result.wrongCount + result.unattemptedCount})
              </button>
            </div>
          </div>

          {/* Questions Detailed Breakdown */}
          <div className="space-y-4">
            {filteredQuestions.map((q) => {
              const studentChoice = studentAnswers[q.id];
              const isCorrect = isQuestionCorrect(q);
              const isUnattempted = studentChoice === undefined || studentChoice === null || studentChoice === '';
              const qType = q.type || 'multiple_choice';

              return (
                <div 
                  key={q.id}
                  className={`p-6 rounded-3xl border bg-white shadow-xs space-y-4 ${
                    isCorrect ? 'border-emerald-200' : 'border-rose-200'
                  }`}
                >
                  {/* Question header */}
                  <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                        {q.questionNumber}
                      </span>
                      <span className="text-xs font-bold text-slate-800">
                        Câu hỏi {q.questionNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {qType === 'multiple_choice' && 'Trắc nghiệm 4 lựa chọn'}
                        {qType === 'true_false' && 'Trắc nghiệm Đúng / Sai'}
                        {qType === 'fill_blank' && 'Điền kết quả'}
                        {qType === 'essay' && 'Tự luận'}
                      </span>
                    </div>

                    <div>
                      {qType === 'true_false' ? (
                        (() => {
                          const tfMatches = (q.subQuestions || []).filter(sub => studentChoice?.[sub.key] === sub.correct).length;
                          const totalSubs = (q.subQuestions || []).length || 4;
                          return tfMatches === totalSubs ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Đúng 4/4 ý (+{q.points || 1}đ)
                            </span>
                          ) : tfMatches > 0 ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              <Check className="w-3.5 h-3.5 text-amber-700" /> Đúng {tfMatches}/{totalSubs} ý
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <XCircle className="w-4 h-4 text-rose-600" /> Sai cả {totalSubs} ý (0đ)
                            </span>
                          );
                        })()
                      ) : isCorrect ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Trả lời đúng (+{q.points || 1}đ)
                        </span>
                      ) : isUnattempted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                          Chưa trả lời (0đ)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          <XCircle className="w-4 h-4 text-rose-600" /> Trả lời chưa đúng (0đ)
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

                        const isKeyCorrect = q.correctOption === key;
                        const isStudentKey = studentChoice === key;

                        let cardStyle = 'bg-slate-50 border-slate-200 text-slate-700';
                        if (isKeyCorrect) {
                          cardStyle = 'bg-emerald-50/80 border-emerald-400 text-emerald-950 font-semibold ring-1 ring-emerald-400';
                        } else if (isStudentKey && !isCorrect) {
                          cardStyle = 'bg-rose-50 border-rose-300 text-rose-950 ring-1 ring-rose-300';
                        }

                        return (
                          <div 
                            key={key} 
                            className={`p-3 rounded-xl border flex items-center gap-3 text-xs ${cardStyle}`}
                          >
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                              isKeyCorrect 
                                ? 'bg-emerald-600 text-white' 
                                : isStudentKey 
                                ? 'bg-rose-600 text-white' 
                                : 'bg-white text-slate-600 border border-slate-300'
                            }`}>
                              {key}
                            </div>
                            <span className="flex-1">
                              <MathRenderer content={text} />
                            </span>
                            {isKeyCorrect && (
                              <span className="text-[10px] uppercase font-bold text-emerald-700 shrink-0">
                                Đáp án đúng
                              </span>
                            )}
                            {isStudentKey && !isKeyCorrect && (
                              <span className="text-[10px] uppercase font-bold text-rose-600 shrink-0">
                                Bạn đã chọn
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 2. True / False Review */}
                  {qType === 'true_false' && (
                    <div className="space-y-2.5 border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 text-xs shadow-2xs">
                      {(q.subQuestions || []).map((sub) => {
                        const studentVal = studentChoice?.[sub.key];
                        const isSubMatch = studentVal !== undefined && studentVal === sub.correct;
                        const isUnanswered = studentVal === undefined || studentVal === null;

                        return (
                          <div 
                            key={sub.key} 
                            className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                              isSubMatch ? 'bg-emerald-50/60' : 'bg-rose-50/60'
                            }`}
                          >
                            <div className="flex items-start gap-2.5 flex-1">
                              <span className={`w-6 h-6 rounded-lg font-bold flex items-center justify-center text-xs shrink-0 shadow-2xs ${
                                isSubMatch ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                              }`}>
                                {sub.key})
                              </span>
                              <div className="text-slate-800 font-medium">
                                <MathRenderer content={sub.text} />
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
                              {/* Student Selection Badge */}
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border shadow-2xs ${
                                isUnanswered 
                                  ? 'bg-slate-100 border-slate-200 text-slate-500' 
                                  : isSubMatch 
                                  ? 'bg-emerald-100 border-emerald-300 text-emerald-900' 
                                  : 'bg-rose-100 border-rose-300 text-rose-900'
                              }`}>
                                {isSubMatch ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                )}
                                <span>Em chọn: {studentVal === true ? 'ĐÚNG' : studentVal === false ? 'SAI' : '(Chưa chọn)'}</span>
                              </span>

                              {/* Official Key Badge */}
                              <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center gap-1 shadow-2xs">
                                <span>Đáp án chuẩn: {sub.correct ? 'ĐÚNG' : 'SAI'}</span>
                              </span>

                              {/* Points Earned */}
                              <span className={`px-2 py-1 rounded-lg font-black text-xs ${
                                isSubMatch ? 'bg-emerald-200 text-emerald-950' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {isSubMatch ? `+${sub.points ?? 0.25}đ` : '0đ'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 3. Fill-in-the-blank Review */}
                  {qType === 'fill_blank' && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-600">Bài làm của bạn:</span>
                        <strong className={`px-2.5 py-1 rounded-lg ${isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {studentChoice || '(Để trống)'}
                        </strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-600">Đáp án được chấp nhận:</span>
                        <strong className="text-emerald-700">
                          {(q.acceptableAnswers || []).join(' hoặc ')}
                        </strong>
                      </div>
                    </div>
                  )}

                  {/* 4. Essay Review */}
                  {qType === 'essay' && (
                    <div className="space-y-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="font-semibold text-slate-600 mb-1">Bài làm tự luận của bạn:</p>
                        <p className="text-slate-800 whitespace-pre-line leading-relaxed font-medium">
                          {studentChoice || '(Học sinh chưa nhập bài làm)'}
                        </p>
                      </div>
                      {q.sampleAnswer && (
                        <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-emerald-950">
                          <p className="font-bold text-emerald-900 mb-1">Dàn ý & Hướng dẫn chấm mẫu:</p>
                          <p className="whitespace-pre-line">{q.sampleAnswer}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Explanation if present */}
                  {q.explanation && (
                    <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl text-xs text-indigo-950 space-y-1">
                      <p className="font-bold text-indigo-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        Lời giải chi tiết:
                      </p>
                      <div className="text-slate-700 text-[11px] leading-relaxed">
                        <MathRenderer content={q.explanation} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-2">
          <HelpCircle className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="font-bold text-slate-800 text-sm">
            Đáp án chi tiết đang được bảo mật
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Giáo viên phụ trách đã cấu hình không hiển thị đáp án và lời giải chi tiết cho kỳ thi này.
          </p>
        </div>
      )}

      {/* Action buttons: Retake exam & Return to dashboard */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-6 border-t border-slate-200">
        {onRetakeExam && (exam.allowRetake !== false || exam.isTrial || !exam.isSecure) && (
          <button
            onClick={() => onRetakeExam(exam, questions)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer transform hover:-translate-y-0.5"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Làm lại bài thi / Ôn tập lại đề này</span>
          </button>
        )}
        <button
          onClick={onBackToDashboard}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại trang chủ</span>
        </button>
      </div>
    </div>
  );
};

