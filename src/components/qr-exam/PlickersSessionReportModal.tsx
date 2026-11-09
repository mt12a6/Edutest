import React, { useState } from 'react';
import { 
  X, 
  Award, 
  FileSpreadsheet, 
  Printer, 
  CheckCircle2, 
  XCircle, 
  Users, 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Calendar,
  Layers,
  ChevronRight,
  HelpCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Exam, Question, PlickersSession, PlickersResponse, PlickersStudent } from '../../types';

interface PlickersSessionReportModalProps {
  isOpen: boolean;
  session: PlickersSession;
  exam: Exam;
  questions: Question[];
  responses: PlickersResponse[];
  students: PlickersStudent[];
  onClose: () => void;
}

export const PlickersSessionReportModal: React.FC<PlickersSessionReportModalProps> = ({
  isOpen,
  session,
  exam,
  questions,
  responses,
  students,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'students' | 'questions'>('students');

  if (!isOpen) return null;

  const totalQ = questions.length || 1;
  const maxScore = exam.maxScore || 10;
  const pointsPerQ = maxScore / totalQ;

  // Group responses by student cardId
  const studentRows = students.map((std, idx) => {
    const stdResponses = responses.filter(r => r.cardId === std.cardId);
    let correctCount = 0;
    let wrongCount = 0;

    questions.forEach(q => {
      const resp = stdResponses.find(r => r.questionId === q.id);
      if (resp) {
        if (resp.answer === q.correctOption) {
          correctCount++;
        } else {
          wrongCount++;
        }
      }
    });

    const score = Math.round(correctCount * pointsPerQ * 100) / 100;
    const percentage = Math.round((correctCount / totalQ) * 100);
    const isPassed = score >= (exam.passScore || 5);

    return {
      stt: idx + 1,
      cardId: std.cardId,
      studentCode: std.studentCode,
      studentName: std.displayName,
      answeredCount: stdResponses.length,
      correctCount,
      wrongCount,
      unattemptedCount: totalQ - stdResponses.length,
      score,
      percentage,
      isPassed,
      responses: stdResponses
    };
  });

  // Calculate Class Statistics
  const participatedCount = studentRows.filter(s => s.answeredCount > 0).length;
  const totalScoreSum = studentRows.reduce((acc, s) => acc + s.score, 0);
  const avgScore = participatedCount > 0 ? Math.round((totalScoreSum / participatedCount) * 100) / 100 : 0;
  const passCount = studentRows.filter(s => s.isPassed && s.answeredCount > 0).length;
  const passRate = participatedCount > 0 ? Math.round((passCount / participatedCount) * 100) : 0;

  // Question Analysis
  const questionRows = questions.map((q, idx) => {
    const qResponses = responses.filter(r => r.questionId === q.id);
    const tally = { A: 0, B: 0, C: 0, D: 0 };
    let correct = 0;

    qResponses.forEach(r => {
      if (r.answer && tally[r.answer] !== undefined) {
        tally[r.answer]++;
      }
      if (r.answer === q.correctOption) {
        correct++;
      }
    });

    const totalAns = qResponses.length;
    const correctRate = totalAns > 0 ? Math.round((correct / totalAns) * 100) : 0;

    return {
      questionNumber: q.questionNumber || idx + 1,
      prompt: q.prompt,
      correctOption: q.correctOption || 'A',
      totalAnswered: totalAns,
      correctCount: correct,
      correctRate,
      tally
    };
  });

  // Export Excel
  const handleExportExcel = () => {
    const studentData = studentRows.map(s => ({
      'STT': s.stt,
      'Số thẻ QR': s.cardId,
      'Mã học sinh': s.studentCode,
      'Họ và tên': s.studentName,
      'Số câu đúng': s.correctCount,
      'Số câu sai': s.wrongCount,
      'Chưa làm': s.unattemptedCount,
      'Tổng điểm': s.score,
      'Tỷ lệ đúng (%)': `${s.percentage}%`,
      'Kết quả': s.isPassed ? 'Đạt' : 'Chưa đạt'
    }));

    const questionData = questionRows.map(q => ({
      'Câu hỏi': `Câu ${q.questionNumber}`,
      'Nội dung': q.prompt.replace(/<[^>]*>?/gm, '').slice(0, 150),
      'Đáp án đúng': q.correctOption,
      'Số học sinh chọn đúng': q.correctCount,
      'Tỷ lệ đúng (%)': `${q.correctRate}%`,
      'Chọn A': q.tally.A,
      'Chọn B': q.tally.B,
      'Chọn C': q.tally.C,
      'Chọn D': q.tally.D
    }));

    const wb = XLSX.utils.book_new();
    const wsStudents = XLSX.utils.json_to_sheet(studentData);
    const wsQuestions = XLSX.utils.json_to_sheet(questionData);

    XLSX.utils.book_append_sheet(wb, wsStudents, 'BaoCao_HocSinh');
    XLSX.utils.book_append_sheet(wb, wsQuestions, 'PhanTich_CauHoi');

    XLSX.writeFile(wb, `BaoCao_KhaoThi_Plickers_${session.className}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-4xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:px-6 sm:py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black">Báo Cáo Kết Quả Khảo Thí Plickers</h2>
              <p className="text-xs text-slate-300">
                {session.examTitle} • Lớp: <span className="font-bold text-teal-300">{session.className}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="Xuất bảng điểm và phân tích câu hỏi ra Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Xuất Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Overview Stats Cards */}
        <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Thí sinh tham gia</span>
            <p className="text-xl font-black text-slate-900 mt-0.5">
              {participatedCount} <span className="text-xs font-normal text-slate-400">/ {students.length}</span>
            </p>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Điểm trung bình</span>
            <p className="text-xl font-black text-teal-600 mt-0.5">
              {avgScore} <span className="text-xs font-normal text-slate-400">/ 10</span>
            </p>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Tỷ lệ đạt (&gt;= 5.0)</span>
            <p className="text-xl font-black text-emerald-600 mt-0.5">{passRate}%</p>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Tổng số câu hỏi</span>
            <p className="text-xl font-black text-indigo-600 mt-0.5">{questions.length} câu</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="inline-flex p-1 bg-slate-100 rounded-xl font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('students')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'students' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Bảng điểm từng học sinh ({studentRows.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('questions')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'questions' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Phân tích từng câu hỏi ({questionRows.length})
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {activeTab === 'students' ? (
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 text-center w-12">STT</th>
                    <th className="p-3 text-center w-16">Thẻ</th>
                    <th className="p-3">Mã HS</th>
                    <th className="p-3">Họ và tên thí sinh</th>
                    <th className="p-3 text-center">Đúng</th>
                    <th className="p-3 text-center">Sai</th>
                    <th className="p-3 text-center">Điểm số</th>
                    <th className="p-3 text-center">Kết quả</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {studentRows.map(s => (
                    <tr key={s.cardId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-center text-slate-400">{s.stt}</td>
                      <td className="p-3 text-center font-bold text-teal-700">#{s.cardId}</td>
                      <td className="p-3 font-mono text-slate-600">{s.studentCode}</td>
                      <td className="p-3 font-bold text-slate-900">{s.studentName}</td>
                      <td className="p-3 text-center text-emerald-600 font-bold">{s.correctCount}</td>
                      <td className="p-3 text-center text-rose-600 font-bold">{s.wrongCount}</td>
                      <td className="p-3 text-center">
                        <span className="font-black text-sm text-slate-900">{s.score}</span>
                        <span className="text-[10px] text-slate-400"> / 10</span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          s.isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {s.isPassed ? 'Đạt' : 'Chưa đạt'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-3">
              {questionRows.map(q => (
                <div key={q.questionNumber} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-teal-700 uppercase bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        Câu {q.questionNumber}
                      </span>
                      <p className="text-xs font-semibold text-slate-900 line-clamp-2 mt-1">
                        {q.prompt.replace(/<[^>]*>?/gm, '')}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-slate-500 block">Độ chính xác</span>
                      <span className={`text-base font-black ${
                        q.correctRate >= 70 ? 'text-emerald-600' : q.correctRate >= 40 ? 'text-amber-600' : 'text-rose-600'
                      }`}>
                        {q.correctRate}%
                      </span>
                    </div>
                  </div>

                  {/* Distribution Bar */}
                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
                    {(['A', 'B', 'C', 'D'] as const).map(opt => {
                      const isCorrect = q.correctOption === opt;
                      const count = q.tally[opt];
                      const pct = q.totalAnswered > 0 ? Math.round((count / q.totalAnswered) * 100) : 0;

                      return (
                        <div
                          key={opt}
                          className={`p-2 rounded-xl border text-center ${
                            isCorrect 
                              ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-950' 
                              : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}
                        >
                          <span className="text-xs block font-bold">{opt} {isCorrect ? '★' : ''}</span>
                          <span className="text-[11px] font-bold">{count} ({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
