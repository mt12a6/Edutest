import React, { useState, useEffect } from 'react';
import { 
  Award, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Search, 
  BookOpen, 
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';
import { Exam, ExamResult, Question } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { getStudentResults, getExamQuestions, getStudentAttempts } from '../../services/db';

interface StudentHistoryProps {
  exams: Exam[];
  onViewResult: (exam: Exam, result: ExamResult, questions: Question[]) => void;
}

export const StudentHistory: React.FC<StudentHistoryProps> = ({ exams, onViewResult }) => {
  const { profile } = useAuth();
  const [results, setResults] = useState<ExamResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (!profile) return;
    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const resList = await getStudentResults(profile.id);
        setResults(resList);
      } catch (err) {
        console.error('Lỗi khi tải lịch sử bài thi:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchResults();
  }, [profile]);

  // Metrics
  const total = results.length;
  const scores = results.map(r => r.score);
  const avg = total > 0 ? (scores.reduce((a, b) => a + b, 0) / total).toFixed(1) : '0';
  const passCount = results.filter(r => r.score >= 5).length;
  const passRate = total > 0 ? Math.round((passCount / total) * 100) : 0;

  const handleReview = async (res: ExamResult) => {
    const exam = exams.find(e => e.id === res.examId);
    if (!exam) {
      alert('Không tìm thấy thông tin đề thi này.');
      return;
    }
    try {
      const qList = await getExamQuestions(exam.id);
      onViewResult(exam, res, qList);
    } catch (err) {
      console.error('Lỗi khi tải câu hỏi bài thi:', err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <h2 className="text-xl font-bold text-slate-900 leading-tight">
          Lịch sử & Kết quả thi của bạn
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Theo dõi tiến độ học tập, điểm số tích lũy và ôn lại các câu hỏi đã làm
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Số bài đã hoàn thành</span>
            <Award className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{total} bài</p>
          <p className="text-[11px] text-slate-500 mt-1">Ghi nhận chính thức</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Điểm trung bình</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600">{avg} <span className="text-xs font-normal text-slate-400">/ 10</span></p>
          <p className="text-[11px] text-slate-500 mt-1">Hiệu suất học tập</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Tỷ lệ đạt chuẩn</span>
            <CheckCircle2 className="w-4 h-4 text-teal-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{passRate}%</p>
          <p className="text-[11px] text-emerald-600 mt-1 font-semibold">{passCount} bài thi đạt yêu cầu</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Kỳ thi / Đề thi</th>
                <th className="py-3 px-4 text-center">Điểm số</th>
                <th className="py-3 px-4 text-center">Đúng / Sai</th>
                <th className="py-3 px-4 text-center">Tỷ lệ</th>
                <th className="py-3 px-4">Ngày nộp bài</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.length > 0 ? (
                results.map((res) => {
                  const exam = exams.find(e => e.id === res.examId);
                  const isPassed = res.score >= 5;
                  const canShowScore = exam?.showScoreAfterExam !== false;
                  return (
                    <tr key={res.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <p>{exam?.title || 'Đề thi trắc nghiệm'}</p>
                        <p className="text-[10px] text-slate-400 font-normal">
                          Môn {exam?.subjectName || 'Khác'}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {canShowScore ? (
                          <>
                            <span className="text-sm font-black text-slate-900">{res.score}</span>
                            <span className="text-[10px] text-slate-400">/{res.maxScore || 10}</span>
                          </>
                        ) : (
                          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            Bảo mật
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-600">
                        {canShowScore ? (
                          <>
                            <span className="text-emerald-700 font-bold">{res.correctCount}</span>
                            <span className="text-slate-400"> / </span>
                            <span className="text-rose-700">{res.wrongCount}</span>
                          </>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Đã nộp</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                        {canShowScore ? `${res.percentage}%` : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(res.submittedAt).toLocaleDateString('vi-VN')} {new Date(res.submittedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {canShowScore ? (
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {isPassed ? 'Đạt' : 'Chưa đạt'}
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                            Đã nộp bài
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleReview(res)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Xem lại</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 text-xs">
                    {isLoading ? 'Đang tải lịch sử...' : 'Bạn chưa tham gia kỳ thi nào.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
