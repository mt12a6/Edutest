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
  HelpCircle,
  Printer,
  ChevronDown,
  ChevronUp,
  FileText
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
  const essayQuestions = questions.filter(q => q.type === 'essay');
  const studentAnswers = attempt?.answers || (result as any)?.answers || {};

  // Multiple essay questions score mapping (questionId -> score)
  const [essayScores, setEssayScores] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    essayQuestions.forEach(q => {
      if (result.essayGrades?.[q.id]?.score !== undefined) {
        map[q.id] = result.essayGrades[q.id].score;
      } else if (result.essayScore !== undefined && essayQuestions.length === 1) {
        map[q.id] = result.essayScore;
      } else {
        map[q.id] = 0;
      }
    });
    return map;
  });

  // Multiple essay questions feedback mapping (questionId -> feedback)
  const [essayFeedbacks, setEssayFeedbacks] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    essayQuestions.forEach(q => {
      if (result.essayGrades?.[q.id]?.feedback) {
        map[q.id] = result.essayGrades[q.id].feedback;
      } else if (result.essayFeedback && essayQuestions.length === 1) {
        map[q.id] = result.essayFeedback;
      } else {
        map[q.id] = '';
      }
    });
    return map;
  });

  const [loadingAiMap, setLoadingAiMap] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [showPrintView, setShowPrintView] = useState<boolean>(false);

  if (!isOpen) return null;

  // Calculate sum of essay scores
  const totalEssayScore = Number(
    essayQuestions.reduce((sum, q) => sum + (essayScores[q.id] ?? 0), 0).toFixed(2)
  );
  const totalMaxEssayPoints = Number(
    essayQuestions.reduce((sum, q) => sum + (q.points || 1), 0).toFixed(2)
  );

  // Check if multiple choice is correct
  const isMultipleChoiceCorrect = (q: Question) => {
    return checkMCCorrect(studentAnswers[q.id], q.correctOption, q.options);
  };

  // Check fill blank
  const isFillBlankCorrect = (q: Question) => {
    return checkFBCorrect(studentAnswers[q.id], q.acceptableAnswers, q.correctOption, q.sampleAnswer);
  };

  // Calculate True/False details using the official 0.25 formula
  const getTrueFalseBreakdown = (q: Question) => {
    const studentChoice = studentAnswers[q.id] || {};
    const tfResult = evalTF(studentChoice, q.subQuestions, q.points || 1);
    const subList = q.subQuestions || [];
    const items = subList.map(sub => {
      const detail = tfResult.subDetails[sub.key] || {
        student: null,
        correct: sub.correct,
        isMatch: false
      };
      return {
        key: sub.key,
        text: sub.text,
        studentVal: detail.student,
        correctVal: detail.correct,
        isMatch: detail.isMatch,
        points: sub.points ?? 0.25
      };
    });

    return { 
      items, 
      matchCount: tfResult.subMatches, 
      earnedPoints: tfResult.earnedPoints, 
      maxPoints: q.points || 1 
    };
  };

  // Call AI to suggest essay grade for a specific essay question
  const handleAiSuggestSingleEssay = async (q: Question) => {
    setLoadingAiMap(prev => ({ ...prev, [q.id]: true }));
    try {
      const studentEssayAns = studentAnswers[q.id] || '';
      const apiRes = await fetch('/api/grade-essay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: q.prompt,
          sampleAnswer: q.sampleAnswer,
          rubric: q.rubric,
          studentAnswer: studentEssayAns,
          maxPoints: q.points || 2.5
        })
      });
      const apiJson = await apiRes.json();
      if (apiJson.success && apiJson.data) {
        const score = Number(apiJson.data.score || 0);
        setEssayScores(prev => ({ ...prev, [q.id]: score }));
        const fb = `${apiJson.data.feedback || ''}\n• Điểm mạnh: ${apiJson.data.strengths || ''}\n• Cần cải thiện: ${apiJson.data.improvements || ''}`.trim();
        setEssayFeedbacks(prev => ({ ...prev, [q.id]: fb }));
      }
    } catch (err) {
      console.error('Lỗi khi AI gợi ý chấm bài:', err);
    } finally {
      setLoadingAiMap(prev => ({ ...prev, [q.id]: false }));
    }
  };

  // Save manual essay grades for all essay questions
  const handleSaveTeacherGrade = async () => {
    setIsSaving(true);
    setSaveSuccessMsg(null);
    try {
      const gradesMap: Record<string, {
        score: number;
        feedback: string;
        questionNumber: number;
        maxPoints: number;
        gradedBy: string;
        gradedAt: string;
      }> = {};

      const now = new Date().toISOString();
      essayQuestions.forEach(q => {
        gradesMap[q.id] = {
          score: essayScores[q.id] ?? 0,
          feedback: essayFeedbacks[q.id] || '',
          questionNumber: q.questionNumber,
          maxPoints: q.points || 1,
          gradedBy: 'Giáo viên phụ trách',
          gradedAt: now
        };
      });

      const combinedFeedback = essayQuestions.length === 1
        ? (essayFeedbacks[essayQuestions[0]?.id] || 'Đã được giáo viên chấm và ghi nhận điểm.')
        : essayQuestions.map(q => `Câu ${q.questionNumber}: ${essayFeedbacks[q.id] || 'Đạt ' + (essayScores[q.id] ?? 0) + 'đ'}`).join(' | ');

      await gradeEssaySubmission(
        result.attemptId || result.id,
        totalEssayScore,
        combinedFeedback,
        false, // Marked as teacher graded
        'Giáo viên phụ trách',
        gradesMap
      );

      setSaveSuccessMsg(`Đã lưu thành công điểm tự luận cho tất cả ${essayQuestions.length} câu và cập nhật tổng điểm bài thi!`);
      setTimeout(() => {
        onGradedSuccess();
        onClose();
      }, 1300);
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
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPrintView(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-700 shadow-xs"
              title="In hoặc xuất bài làm học sinh đầy đủ 4 phần (PDF)"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">In bài làm (4 phần)</span>
            </button>
            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Score overview summary ribbon */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-slate-400 font-semibold block text-[10px] uppercase">Tổng điểm bài thi</span>
              {result.hasEssayGraded || (result.essayScore !== undefined && result.essayScore > 0) ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-xl border border-purple-200">
                    {result.score} <span className="text-xs font-normal text-purple-500">/ {result.maxScore || 10}</span>
                  </span>
                  <span className="text-[11px] font-bold text-purple-600 hidden sm:inline">
                    (Trắc nghiệm: {result.objectiveScore ?? Math.max(0, Number(((result.score || 0) - (result.essayScore || 0)).toFixed(2)))}đ + Tự luận: +{result.essayScore}đ)
                  </span>
                </div>
              ) : (
                <span className="text-xl font-black text-slate-900">
                  {result.score} <span className="text-xs font-normal text-slate-400">/ {result.maxScore || 10}</span>
                </span>
              )}
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
                {result.status === 'pending_essay_grading' 
                  ? `Chờ chấm tự luận (${essayQuestions.length} câu)` 
                  : result.isAiGraded 
                  ? '🤖 AI đã chấm' 
                  : '🧑‍🏫 Giáo viên đã chấm'}
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

          {/* SECTION 1: ESSAY GRADING SECTION (RENDERS ALL ESSAY QUESTIONS) */}
          {essayQuestions.length > 0 && (
            <div className="p-5 rounded-3xl border-2 border-indigo-200 bg-indigo-50/40 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-indigo-100 gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-xs">
                    ✍️
                  </span>
                  <div>
                    <h4 className="font-extrabold text-sm text-indigo-950">
                      Chấm điểm phần Tự luận ({essayQuestions.length} câu hỏi)
                    </h4>
                    <p className="text-[11px] text-indigo-800/80">
                      Hiển thị toàn bộ câu tự luận và bài làm của học sinh. Giáo viên chấm điểm từng câu và cộng vào tổng điểm bài thi.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <span className="text-xs font-bold text-indigo-950 px-3 py-1 bg-white rounded-xl border border-indigo-200 shadow-2xs">
                    Tổng điểm tự luận: <strong className="text-indigo-600 font-black">{totalEssayScore}</strong> / {totalMaxEssayPoints}đ
                  </span>
                </div>
              </div>

              {/* Loop over ALL essay questions */}
              <div className="space-y-5">
                {essayQuestions.map((q, idx) => {
                  const studentAns = studentAnswers[q.id];
                  const hasAnswered = typeof studentAns === 'string' && studentAns.trim().length > 0;
                  const isAiLoading = Boolean(loadingAiMap[q.id]);
                  const qMaxPoints = q.points || 2.5;

                  return (
                    <div 
                      key={q.id} 
                      className="p-4 bg-white rounded-2xl border border-indigo-100 shadow-xs space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-indigo-700 text-white font-bold text-xs flex items-center justify-center">
                            {q.questionNumber || idx + 1}
                          </span>
                          <span className="font-extrabold text-xs text-slate-900">
                            Câu {q.questionNumber || idx + 1}: Câu hỏi Tự luận
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Tối đa: {qMaxPoints} điểm
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled={isAiLoading || !hasAnswered}
                          onClick={() => handleAiSuggestSingleEssay(q)}
                          className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-40"
                          title="Nhờ AI gợi ý chấm điểm cho câu này"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>{isAiLoading ? 'Đang đọc bài...' : 'AI gợi ý chấm'}</span>
                        </button>
                      </div>

                      {/* Prompt */}
                      <div className="space-y-1 text-xs">
                        <span className="font-bold text-slate-700 block">Đề bài:</span>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-900 leading-relaxed font-medium">
                          <MathRenderer content={q.prompt} />
                        </div>
                      </div>

                      {/* Image if attached */}
                      {q.imageUrl && (
                        <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 inline-block">
                          <img src={q.imageUrl} alt="Hình minh họa" className="max-h-48 rounded-lg object-contain bg-white" />
                        </div>
                      )}

                      {/* Student's written answer */}
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-700 block">Bài làm của học sinh:</span>
                          {!hasAnswered ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                              Chưa trả lời
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                              Đã nộp bài ({studentAns.length} ký tự)
                            </span>
                          )}
                        </div>

                        {hasAnswered ? (
                          <div className="p-3.5 bg-slate-50/70 rounded-xl border-2 border-indigo-200 text-slate-900 leading-relaxed font-mono whitespace-pre-line text-xs min-h-[70px]">
                            {studentAns}
                          </div>
                        ) : (
                          <div className="p-3.5 bg-rose-50/50 rounded-xl border border-dashed border-rose-300 text-rose-700 text-xs italic">
                            (Học sinh để trống câu này, không nhập bài làm)
                          </div>
                        )}
                      </div>

                      {/* Sample answer / Rubric */}
                      {(q.sampleAnswer || q.rubric) && (
                        <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-xs text-emerald-950 space-y-1">
                          <span className="font-bold text-emerald-900 block">Đáp án mẫu & Biểu điểm:</span>
                          {q.sampleAnswer && <p className="whitespace-pre-line text-[11px] leading-relaxed">{q.sampleAnswer}</p>}
                          {q.rubric && <p className="text-[10px] text-emerald-800 italic mt-1">Thang điểm chi tiết: {q.rubric}</p>}
                        </div>
                      )}

                      {/* Teacher Grading Inputs for this question */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div>
                          <label className="block text-xs font-bold text-indigo-950 mb-1">
                            Điểm câu {q.questionNumber || idx + 1}:
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              max={qMaxPoints}
                              value={essayScores[q.id] ?? 0}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                const clamped = Math.max(0, Math.min(qMaxPoints, val));
                                setEssayScores(prev => ({ ...prev, [q.id]: clamped }));
                              }}
                              className="w-24 p-2 text-sm font-black text-indigo-950 bg-white border-2 border-indigo-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                            />
                            <span className="text-xs font-bold text-slate-600">/ {qMaxPoints} điểm</span>
                          </div>
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-indigo-950 mb-1">
                            Lời phê / Nhận xét câu {q.questionNumber || idx + 1}:
                          </label>
                          <input
                            type="text"
                            value={essayFeedbacks[q.id] || ''}
                            onChange={(e) => setEssayFeedbacks(prev => ({ ...prev, [q.id]: e.target.value }))}
                            placeholder="Nhận xét ưu điểm, lỗi sai hoặc hướng dẫn sửa..."
                            className="w-full p-2 text-xs bg-white border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Save All Essays Button */}
              <div className="pt-3 border-t border-indigo-100 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-indigo-900 font-semibold">
                  Tổng điểm tự luận sẽ được cộng: <span className="font-black text-sm text-indigo-700">{totalEssayScore}đ</span> / {totalMaxEssayPoints}đ
                </div>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveTeacherGrade}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Đang lưu điểm...' : `Lưu điểm tất cả ${essayQuestions.length} câu tự luận`}</span>
                </button>
              </div>
            </div>
          )}

          {/* SECTION 2: QUESTION BY QUESTION DETAILED BREAKDOWN */}
          <div className="space-y-4">
            <h4 className="font-extrabold text-sm text-slate-900 pb-2 border-b border-slate-200 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              Chi tiết toàn bộ bài thi theo từng câu hỏi & Đáp án học sinh
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
                          {qType === 'multiple_choice' && 'Phần I: Trắc nghiệm 4 lựa chọn'}
                          {qType === 'true_false' && 'Phần II: Đúng / Sai 4 ý'}
                          {qType === 'fill_blank' && 'Phần III: Trả lời ngắn'}
                          {qType === 'essay' && 'Phần IV: Tự luận'}
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

                      {qType === 'essay' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                          Đạt {essayScores[q.id] ?? 0} / {q.points || 2.5}đ
                        </span>
                      )}
                    </div>

                    {/* Prompt */}
                    <div className="text-xs sm:text-sm font-semibold text-slate-900 leading-relaxed">
                      <MathRenderer content={q.prompt} />
                    </div>

                    {/* Image if attached */}
                    {q.imageUrl && (
                      <div className="p-2 bg-slate-50 rounded-xl border border-slate-200 inline-block">
                        <img src={q.imageUrl} alt="Hình minh họa" className="max-h-48 rounded-lg object-contain bg-white" />
                      </div>
                    )}

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

                    {/* DẠNG 2: TRUE / FALSE CHI TIẾT TỪNG Ý (ĐÚNG Ý NÀO TÍNH 0.25 Ý ĐÓ) */}
                    {qType === 'true_false' && (() => {
                      const tfBreakdown = getTrueFalseBreakdown(q);
                      return (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                            <span>Chi tiết 4 khẳng định Đúng / Sai:</span>
                            <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              Đạt {tfBreakdown.earnedPoints} / {tfBreakdown.maxPoints} điểm (Đúng {tfBreakdown.matchCount}/4 ý • 0.25đ/ý)
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
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                    sub.studentVal === true
                                      ? 'bg-blue-50 text-blue-800 border-blue-200'
                                      : sub.studentVal === false
                                      ? 'bg-slate-100 text-slate-800 border-slate-200'
                                      : 'bg-amber-50 text-amber-800 border-amber-200'
                                  }`}>
                                    HS: <strong>{sub.studentVal === true ? 'ĐÚNG' : sub.studentVal === false ? 'SAI' : 'Chưa chọn'}</strong>
                                  </span>

                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px] border border-slate-200">
                                    Đáp án: <strong>{sub.correctVal ? 'ĐÚNG' : 'SAI'}</strong>
                                  </span>

                                  {sub.isMatch ? (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center gap-1 border border-emerald-300">
                                      <Check className="w-3 h-3 text-emerald-700" />
                                      <span>ĐÚNG (+0.25đ)</span>
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

                    {/* DẠNG 4: ESSAY IN DETAILED LIST */}
                    {qType === 'essay' && (
                      <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-200 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-indigo-950">Bài làm của học sinh:</span>
                          <span className="font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                            Điểm: {essayScores[q.id] ?? 0} / {q.points || 2.5}đ
                          </span>
                        </div>
                        <div className="p-2.5 bg-white rounded-lg border border-indigo-100 font-mono text-slate-800 whitespace-pre-line text-[11px]">
                          {studentAnswers[q.id] || '(Học sinh để trống)'}
                        </div>
                        {essayFeedbacks[q.id] && (
                          <div className="text-[11px] text-indigo-900 bg-indigo-100/50 p-2 rounded-lg">
                            <strong>Nhận xét:</strong> {essayFeedbacks[q.id]}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 text-xs shrink-0">
          <button
            onClick={() => setShowPrintView(true)}
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <Printer className="w-4 h-4 text-emerald-600" />
            <span>In bài làm (4 phần)</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl cursor-pointer"
          >
            Đóng
          </button>
        </div>

      </div>

      {/* PRINTABLE REPORT OVERLAY (MODAL FOR PRINTING COMPLETE 4-SECTION STUDENT WORK) */}
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
                  <span className="text-2xl font-black text-slate-900">{result.score}</span>
                  <span className="text-xs text-slate-500"> / {result.maxScore || 10}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px]">Họ và tên thí sinh:</span>
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
                  <span className="text-slate-400 block text-[10px]">Kết quả:</span>
                  <strong className={result.score >= (exam.passScore || 5) ? 'text-emerald-700' : 'text-rose-700'}>
                    {result.score >= (exam.passScore || 5) ? 'ĐẠT YÊU CẦU' : 'CHƯA ĐẠT'}
                  </strong>
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
                  const isCorrect = isMultipleChoiceCorrect(q);
                  return (
                    <div key={q.id} className="p-3 border border-slate-200 rounded-xl text-xs space-y-2 break-inside-avoid">
                      <div className="flex justify-between font-bold">
                        <span>Câu {q.questionNumber}: <MathRenderer content={q.prompt} inline /></span>
                        <span className={isCorrect ? 'text-emerald-700' : 'text-rose-600'}>
                          {isCorrect ? `Đúng (+${q.points || 1}đ)` : 'Sai (0đ)'}
                        </span>
                      </div>
                      <div className="flex gap-4 text-[11px]">
                        <span>Học sinh chọn: <strong>{studentAns || 'Chưa chọn'}</strong></span>
                        <span>Đáp án chuẩn: <strong className="text-emerald-700">{q.correctOption}</strong></span>
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
                  const breakdown = getTrueFalseBreakdown(q);
                  return (
                    <div key={q.id} className="p-3 border border-slate-200 rounded-xl text-xs space-y-2 break-inside-avoid">
                      <div className="flex justify-between font-bold">
                        <span>Câu {q.questionNumber}: <MathRenderer content={q.prompt} inline /></span>
                        <span className="text-emerald-700">Đạt {breakdown.earnedPoints} / {breakdown.maxPoints}đ</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        {breakdown.items.map(sub => (
                          <div key={sub.key} className="p-2 bg-slate-50 rounded border border-slate-200 flex justify-between">
                            <span>{sub.key}) <MathRenderer content={sub.text} inline /></span>
                            <span>HS: <strong>{sub.studentVal === true ? 'Đ' : sub.studentVal === false ? 'S' : '-'}</strong> | ĐA: <strong>{sub.correctVal ? 'Đ' : 'S'}</strong> ({sub.isMatch ? '+0.25đ' : '0đ'})</span>
                          </div>
                        ))}
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
                  const isCorrect = isFillBlankCorrect(q);
                  return (
                    <div key={q.id} className="p-3 border border-slate-200 rounded-xl text-xs space-y-1.5 break-inside-avoid">
                      <div className="flex justify-between font-bold">
                        <span>Câu {q.questionNumber}: <MathRenderer content={q.prompt} inline /></span>
                        <span className={isCorrect ? 'text-emerald-700' : 'text-rose-600'}>
                          {isCorrect ? `Đúng (+${q.points || 1}đ)` : 'Sai (0đ)'}
                        </span>
                      </div>
                      <div className="flex gap-4 text-[11px]">
                        <span>Thí sinh điền: <strong>{studentAnswers[q.id] || '(Để trống)'}</strong></span>
                        <span>Đáp án chuẩn: <strong className="text-emerald-700">{(q.acceptableAnswers || []).join(' hoặc ')}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PHẦN 4: TỰ LUẬN */}
            {essayQuestions.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-purple-950 bg-purple-50 p-2 rounded-lg border border-purple-100">
                  PHẦN IV: CÂU HỎI TỰ LUẬN
                </h4>
                <div className="space-y-4">
                  {essayQuestions.map(q => (
                    <div key={q.id} className="p-4 border-2 border-slate-300 rounded-xl text-xs space-y-2.5 break-inside-avoid">
                      <div className="flex justify-between font-bold">
                        <span>Câu {q.questionNumber}: <MathRenderer content={q.prompt} inline /></span>
                        <span className="text-indigo-800">Điểm: {essayScores[q.id] ?? 0} / {q.points || 2.5}đ</span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-700 text-[11px] block mb-1">Bài làm thí sinh:</span>
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 font-mono whitespace-pre-line text-[11px]">
                          {studentAnswers[q.id] || '(Học sinh để trống câu này)'}
                        </div>
                      </div>
                      {essayFeedbacks[q.id] && (
                        <div className="p-2.5 bg-indigo-50 rounded-lg border border-indigo-100 text-[11px] text-indigo-950">
                          <strong>Lời phê của giáo viên:</strong> {essayFeedbacks[q.id]}
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
