import React, { useState, useEffect } from 'react';
import { 
  X, 
  BookOpen, 
  Clock, 
  Award, 
  Shuffle, 
  CheckCircle2, 
  XCircle, 
  Download, 
  Edit3, 
  Printer, 
  Layers, 
  ImageIcon, 
  Sparkles,
  Check,
  AlertCircle
} from 'lucide-react';
import { Exam, Question, SchoolClass } from '../../types';
import { getExamQuestions, toggleExamPublish } from '../../services/db';
import { MathRenderer } from '../common/MathRenderer';

interface ExamPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam;
  classes?: SchoolClass[];
  onEditExam?: (exam: Exam, questions: Question[]) => void;
  onRefreshExams?: () => void;
}

export const ExamPreviewModal: React.FC<ExamPreviewModalProps> = ({
  isOpen,
  onClose,
  exam,
  classes = [],
  onEditExam,
  onRefreshExams
}) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPublished, setIsPublished] = useState<boolean>(exam.isPublished);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setIsPublished(exam.isPublished);

    const loadQuestions = async () => {
      setIsLoading(true);
      try {
        const qList = await getExamQuestions(exam.id);
        setQuestions(qList);
      } catch (err) {
        console.error('Lỗi khi tải danh sách câu hỏi đề thi:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadQuestions();
  }, [exam.id, isOpen]);

  if (!isOpen) return null;

  const handleTogglePublish = async () => {
    const nextStatus = !isPublished;
    try {
      await toggleExamPublish(exam.id, nextStatus);
      setIsPublished(nextStatus);
      if (onRefreshExams) onRefreshExams();
    } catch (err) {
      console.error('Lỗi cập nhật trạng thái xuất bản:', err);
    }
  };

  const handleExportJson = () => {
    const dataToExport = {
      title: exam.title,
      grade: exam.grade,
      subject: exam.subjectName,
      subjectId: exam.subjectId,
      durationMinutes: exam.durationMinutes,
      passScore: exam.passScore,
      maxScore: exam.maxScore,
      shuffleQuestions: exam.shuffleQuestions,
      shuffleOptions: exam.shuffleOptions,
      questions: questions.map(q => ({
        questionNumber: q.questionNumber,
        type: q.type,
        prompt: q.prompt,
        imageUrl: q.imageUrl,
        options: q.options,
        correctOption: q.correctOption,
        subQuestions: q.subQuestions,
        acceptableAnswers: q.acceptableAnswers,
        sampleAnswer: q.sampleAnswer,
        explanation: q.explanation,
        points: q.points
      }))
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exam.title.replace(/[/\\?%*:|"<>]/g, '_')}_EduTest.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500 text-slate-900 uppercase">
                  {exam.subjectName} • Khối {exam.grade}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isPublished 
                    ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300' 
                    : 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                }`}>
                  {isPublished ? 'Đang mở kỳ thi' : 'Bản nháp / Đang đóng'}
                </span>
              </div>
              <h3 className="font-extrabold text-base text-white mt-0.5 truncate max-w-xl">
                {exam.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer transition-colors"
              title="Tải tệp JSON chuẩn Azota / EduTest"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Xuất JSON</span>
            </button>

            {onEditExam && (
              <button
                onClick={() => {
                  onClose();
                  onEditExam(exam, questions);
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Chỉnh sửa đề</span>
              </button>
            )}

            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Exam Quick Specs Banner */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Thời gian: <strong>{exam.durationMinutes} phút</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-slate-400" />
              <span>Số câu hỏi: <strong>{questions.length || exam.questionCount} câu</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-emerald-600" />
              <span>Điểm đạt: <strong>{exam.passScore || 5}/{exam.maxScore || 10}</strong></span>
            </div>
            {(exam.shuffleQuestions || exam.shuffleOptions) && (
              <div className="flex items-center gap-1 text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                <Shuffle className="w-3 h-3 text-indigo-600" />
                <span>Trộn đề tự động</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTogglePublish}
              className={`px-3 py-1 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                isPublished
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                  : 'bg-slate-200 border-slate-300 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {isPublished ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-500" />}
              <span>{isPublished ? 'Kỳ thi đang MỞ' : 'Kỳ thi đang ĐÓNG'}</span>
            </button>
          </div>
        </div>

        {/* Content Body: Questions List */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {isLoading ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500">Đang tải toàn bộ dữ liệu câu hỏi và hình vẽ...</p>
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              Chưa có câu hỏi nào trong đề thi này.
            </div>
          ) : (
            questions.map((q, idx) => {
              const qType = q.type || 'multiple_choice';

              return (
                <div 
                  key={q.id || idx}
                  className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-3 shadow-2xs"
                >
                  {/* Question Header */}
                  <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                        {q.questionNumber || idx + 1}
                      </span>
                      <span className="font-bold text-slate-800 text-xs">
                        Câu {q.questionNumber || idx + 1}
                      </span>
                      
                      {qType === 'multiple_choice' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          Trắc nghiệm (4 lựa chọn)
                        </span>
                      )}
                      {qType === 'true_false' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                          Đúng / Sai (4 ý a-b-c-d)
                        </span>
                      )}
                      {qType === 'fill_blank' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          Điền kết quả ngắn
                        </span>
                      )}
                      {qType === 'essay' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Tự luận
                        </span>
                      )}

                      {q.imageUrl && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <ImageIcon className="w-3 h-3 text-indigo-600" />
                          Có hình vẽ / đồ thị
                        </span>
                      )}
                    </div>

                    <span className="text-xs font-semibold text-slate-500">
                      {q.points || 1} điểm
                    </span>
                  </div>

                  {/* Question Prompt with KaTeX */}
                  <div className="text-xs leading-relaxed text-slate-800 font-medium">
                    <MathRenderer content={q.prompt} />
                  </div>

                  {/* Image attachment if exists */}
                  {q.imageUrl && (
                    <div className="my-2">
                      <img 
                        src={q.imageUrl} 
                        alt={`Hình minh họa câu ${q.questionNumber}`} 
                        className="max-h-56 max-w-md rounded-xl border border-slate-200 bg-slate-50 object-contain cursor-pointer hover:opacity-95 shadow-2xs"
                        onClick={() => setExpandedImage(q.imageUrl || null)}
                        title="Bấm để xem ảnh phóng to"
                      />
                    </div>
                  )}

                  {/* Format: Multiple Choice Options */}
                  {qType === 'multiple_choice' && q.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                      {(['A', 'B', 'C', 'D'] as const).map(optKey => {
                        const optText = q.options ? q.options[optKey] : '';
                        const isCorrect = q.correctOption === optKey;

                        return (
                          <div 
                            key={optKey}
                            className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
                              isCorrect 
                                ? 'bg-emerald-50/70 border-emerald-400 text-emerald-950 font-semibold shadow-2xs' 
                                : 'bg-slate-50/60 border-slate-200 text-slate-700'
                            }`}
                          >
                            <span className={`w-5 h-5 rounded-md text-[11px] font-bold flex items-center justify-center shrink-0 ${
                              isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {optKey}
                            </span>
                            <div className="flex-1">
                              <MathRenderer content={optText || ''} />
                            </div>
                            {isCorrect && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0 flex items-center gap-0.5">
                                <Check className="w-3 h-3 text-emerald-600" />
                                Đáp án đúng
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Format: True / False */}
                  {qType === 'true_false' && q.subQuestions && (
                    <div className="space-y-2 pt-2">
                      {q.subQuestions.map(sub => (
                        <div 
                          key={sub.key}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-purple-100 text-purple-800 font-bold text-[11px] flex items-center justify-center">
                              {sub.key})
                            </span>
                            <MathRenderer content={sub.text} />
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            sub.correct 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}>
                            {sub.correct ? 'Đúng' : 'Sai'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Format: Fill in the blank */}
                  {qType === 'fill_blank' && (
                    <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs space-y-1">
                      <span className="font-bold text-amber-900 block">
                        Đáp số chấp nhận:
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        {(q.acceptableAnswers || []).map((ans, aIdx) => (
                          <span key={aIdx} className="px-2 py-0.5 rounded-md bg-white border border-amber-300 font-mono text-amber-900 font-bold">
                            {ans}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Format: Essay */}
                  {qType === 'essay' && q.sampleAnswer && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                      <span className="font-bold text-slate-700 block">
                        Hướng dẫn chấm & Gợi ý giải:
                      </span>
                      <MathRenderer content={q.sampleAnswer} className="text-slate-600" />
                    </div>
                  )}

                  {/* Explanation if exists */}
                  {q.explanation && (
                    <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs space-y-1">
                      <span className="font-bold text-indigo-900 block flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        Lời giải chi tiết:
                      </span>
                      <MathRenderer content={q.explanation} className="text-indigo-950" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJson}
              className="inline-flex sm:hidden items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất JSON</span>
            </button>
            <span className="text-xs text-slate-500">
              Tổng số câu: <strong>{questions.length}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {onEditExam && (
              <button
                onClick={() => {
                  onClose();
                  onEditExam(exam, questions);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Chỉnh sửa câu hỏi & Cấu hình</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>

      </div>

      {/* Expanded Image Modal */}
      {expandedImage && (
        <div 
          className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setExpandedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white p-3 rounded-2xl shadow-2xl">
            <button 
              onClick={() => setExpandedImage(null)}
              className="absolute top-2 right-2 p-1.5 bg-slate-900 text-white rounded-full hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
            <img 
              src={expandedImage} 
              alt="Hình vẽ phóng to" 
              className="max-h-[80vh] max-w-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
};
