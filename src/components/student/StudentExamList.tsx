import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  BookOpen, 
  Award, 
  CheckCircle2, 
  Play, 
  Eye, 
  AlertCircle, 
  ArrowRight,
  Sparkles,
  Calendar
} from 'lucide-react';
import { Exam, ExamAttempt, ExamResult, Question } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { getStudentAttempts, getStudentResults, getExamQuestions } from '../../services/db';

interface StudentExamListProps {
  exams: Exam[];
  onSelectExamToTake: (exam: Exam, questions: Question[]) => void;
  onResumeAttempt: (exam: Exam, questions: Question[], attempt: ExamAttempt) => void;
  onViewResult: (exam: Exam, result: ExamResult, questions: Question[], attempt?: ExamAttempt) => void;
}

export const StudentExamList: React.FC<StudentExamListProps> = ({
  exams,
  onSelectExamToTake,
  onResumeAttempt,
  onViewResult
}) => {
  const { user, profile } = useAuth();
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [results, setResults] = useState<ExamResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingExamId, setLoadingExamId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');

  useEffect(() => {
    if (!profile) return;
    const fetchStudentData = async () => {
      setIsLoading(true);
      try {
        const [attList, resList] = await Promise.all([
          getStudentAttempts(profile.id),
          getStudentResults(profile.id)
        ]);
        setAttempts(attList);
        setResults(resList);
      } catch (err) {
        console.error('Lỗi khi tải thông tin kỳ thi của học sinh:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStudentData();
  }, [profile]);

  // All grades 1 - 12
  const allGrades = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

  // Published exams with filter
  const publishedExams = exams.filter(e => {
    if (!e.isPublished || e.isHidden) return false;
    const matchGrade = selectedGrade === 'all' || e.grade === selectedGrade;
    const matchSubject = selectedSubject === 'all' || e.subjectId === selectedSubject;
    return matchGrade && matchSubject;
  });

  // Extract unique subjects
  const availableSubjects = Array.from(new Set(exams.map(e => e.subjectName))).filter(Boolean);

  // Helper to determine status for an exam
  const getExamStatus = (examId: string) => {
    const existingResult = results.find(r => r.examId === examId);
    if (existingResult) {
      return { type: 'completed' as const, result: existingResult };
    }

    const existingAttempt = attempts.find(a => a.examId === examId);
    if (existingAttempt) {
      const deadline = new Date(existingAttempt.deadline).getTime();
      const isExpired = Date.now() >= deadline;
      if (existingAttempt.status === 'in_progress' && !isExpired) {
        return { type: 'in_progress' as const, attempt: existingAttempt };
      }
    }

    return { type: 'not_started' as const };
  };

  const handleActionClick = async (exam: Exam) => {
    setLoadingExamId(exam.id);
    setErrorMessage(null);
    try {
      const qList = await getExamQuestions(exam.id);
      const status = getExamStatus(exam.id);

      if (status.type === 'completed' && status.result) {
        const matchedAttempt = attempts.find(a => a.id === status.result.attemptId);
        onViewResult(exam, status.result, qList, matchedAttempt);
      } else if (status.type === 'in_progress' && status.attempt) {
        onResumeAttempt(exam, qList, status.attempt);
      } else {
        onSelectExamToTake(exam, qList);
      }
    } catch (err: any) {
      console.error('Lỗi khi chuẩn bị bài thi:', err);
      setErrorMessage('Không thể tải dữ liệu câu hỏi đề thi. Vui lòng thử lại.');
    } finally {
      setLoadingExamId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            Cổng làm bài thi trực tuyến
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            Xin chào, {profile?.displayName || 'Học sinh'}!
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
            Kiểm tra danh sách kỳ thi được giao, hoàn thành đúng hạn và xem kết quả tức thì cùng lời giải chi tiết.
          </p>
        </div>

        <div className="p-4 bg-white/5 border border-white/10 rounded-2xl shrink-0 text-center min-w-[140px]">
          <p className="text-[11px] text-slate-400 font-medium">Đã hoàn thành</p>
          <p className="text-2xl font-black text-emerald-400 mt-0.5">{results.length} bài</p>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 border-2 border-rose-300 text-rose-800 rounded-2xl text-xs font-bold">
          {errorMessage}
        </div>
      )}

      {/* Filter Bar by Grade (1 - 12) & Subject */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Lọc theo Khối:</span>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="text-xs border border-slate-300 rounded-xl px-2.5 py-1.5 bg-white font-medium cursor-pointer"
            >
              <option value="all">Tất cả các khối (1 - 12)</option>
              {allGrades.map(g => (
                <option key={g} value={g}>Khối {g}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Môn học:</span>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="text-xs border border-slate-300 rounded-xl px-2.5 py-1.5 bg-white font-medium cursor-pointer"
            >
              <option value="all">Tất cả môn học</option>
              <option value="MATH">Toán học</option>
              <option value="PHYS">Vật lí</option>
              <option value="CHEM">Hóa học</option>
              <option value="BIO">Sinh học</option>
              <option value="ENG">Tiếng Anh</option>
              <option value="VIE">Tiếng Việt</option>
              <option value="KHTN">Khoa học tự nhiên</option>
              <option value="LIT">Ngữ văn</option>
            </select>
          </div>
        </div>

        <span className="text-xs text-slate-500">
          Hiển thị: <strong>{publishedExams.length}</strong> đề thi
        </span>
      </div>

      {/* Exam Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base text-slate-900">
            Kỳ thi đang mở ({publishedExams.length})
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {publishedExams.length > 0 ? (
            publishedExams.map((exam) => {
              const status = getExamStatus(exam.id);
              const isLoadingThis = loadingExamId === exam.id;

              return (
                <div 
                  key={exam.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                >
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {exam.subjectName} • K{exam.grade}
                      </span>

                      {status.type === 'completed' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Điểm: {status.result.score}/10
                        </span>
                      )}

                      {status.type === 'in_progress' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 animate-pulse flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Đang làm dở
                        </span>
                      )}

                      {status.type === 'not_started' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                          Chưa thi
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-sm text-slate-900 line-clamp-2 leading-snug">
                      {exam.title}
                    </h4>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 pt-1">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{exam.durationMinutes} phút</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                        <span>{exam.questionCount} câu hỏi</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Button */}
                  <div className="p-3 bg-slate-50 border-t border-slate-100">
                    {status.type === 'completed' ? (
                      <button
                        onClick={() => handleActionClick(exam)}
                        disabled={isLoadingThis}
                        className="w-full py-2 px-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{isLoadingThis ? 'Đang mở...' : 'Xem lại bài làm & Lời giải'}</span>
                      </button>
                    ) : status.type === 'in_progress' ? (
                      <button
                        onClick={() => handleActionClick(exam)}
                        disabled={isLoadingThis}
                        className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>{isLoadingThis ? 'Đang khôi phục...' : 'Tiếp tục làm bài thi'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleActionClick(exam)}
                        disabled={isLoadingThis}
                        className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>{isLoadingThis ? 'Đang chuẩn bị...' : 'Bắt đầu làm bài thi'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
              <Clock className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700 text-sm">Hiện chưa có kỳ thi nào đang mở</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Khi giáo viên xuất bản đề thi mới, bạn sẽ thấy thông báo và danh sách đề thi tại đây.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
