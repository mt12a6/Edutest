import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Download, 
  Search, 
  Filter, 
  Users, 
  Award, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  BookOpen, 
  FileSpreadsheet,
  Calendar,
  GraduationCap,
  ShieldAlert,
  ArrowUpDown,
  Clock
} from 'lucide-react';
import { Exam, ExamResult, SchoolClass, Subject } from '../../types';
import { getAllResults, getExams } from '../../services/db';
import * as XLSX from 'xlsx';

interface AnalyticsDashboardProps {
  exams: Exam[];
  classes: SchoolClass[];
  subjects: Subject[];
  initialExam?: Exam | null;
  onSelectExam?: (exam: Exam) => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  exams,
  classes,
  subjects,
  initialExam,
  onSelectExam
}) => {
  const [viewMode, setViewMode] = useState<'by_grade' | 'by_class' | 'by_subject' | 'by_exam'>('by_grade');
  const [results, setResults] = useState<ExamResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [selectedExamId, setSelectedExamId] = useState<string>(initialExam?.id || 'all');
  const [searchStudent, setSearchStudent] = useState<string>('');

  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      try {
        const allRes = await getAllResults();
        setResults(allRes);
      } catch (err) {
        console.error('Lỗi lấy kết quả thống kê:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllData();

    const handleScoreUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ result: ExamResult; examId: string }>;
      if (customEvent.detail?.result) {
        const updated = customEvent.detail.result;
        setResults(prev => {
          const filtered = prev.filter(r => r.id !== updated.id && r.attemptId !== updated.attemptId);
          return [...filtered, updated];
        });
      }
    };

    window.addEventListener('edutest:score_updated', handleScoreUpdated);
    return () => window.removeEventListener('edutest:score_updated', handleScoreUpdated);
  }, []);

  // Set selectedExamId if initialExam changes
  useEffect(() => {
    if (initialExam) {
      setSelectedExamId(initialExam.id);
      setViewMode('by_exam');
    }
  }, [initialExam]);

  // All available grades: 1 to 12
  const allGrades = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

  // Match exam lookup map
  const examMap = new Map<string, Exam>();
  exams.forEach(e => examMap.set(e.id, e));

  // Enrich results with exam info if missing
  const enrichedResults = results.map(r => {
    const matchedExam = examMap.get(r.examId);
    return {
      ...r,
      examTitle: matchedExam?.title || 'Đề kiểm tra tổng hợp',
      grade: matchedExam?.grade || '10',
      subjectName: matchedExam?.subjectName || 'Toán học',
      subjectId: matchedExam?.subjectId || 'MATH'
    };
  });

  // Export full report to Excel
  const handleExportFullExcel = () => {
    let reportData: any[] = [];

    if (viewMode === 'by_grade') {
      reportData = allGrades.map(g => {
        const gradeResults = enrichedResults.filter(r => r.grade === g);
        const count = gradeResults.length;
        const avg = count > 0 ? (gradeResults.reduce((a, b) => a + b.score, 0) / count).toFixed(2) : '0';
        const pass = gradeResults.filter(r => r.score >= 5).length;
        const excellent = gradeResults.filter(r => r.score >= 8).length;

        return {
          'Khối lớp': `Khối ${g}`,
          'Số lượt thi': count,
          'Điểm trung bình': avg,
          'Số bài Đạt (>=5.0)': pass,
          'Tỷ lệ Đạt (%)': count > 0 ? `${Math.round((pass / count) * 100)}%` : '0%',
          'Số bài Giỏi (>=8.0)': excellent,
          'Tỷ lệ Giỏi (%)': count > 0 ? `${Math.round((excellent / count) * 100)}%` : '0%'
        };
      });
    } else if (viewMode === 'by_class') {
      reportData = classes.map(c => {
        const classResults = enrichedResults.filter(r => r.classId === c.name || r.classId === c.id);
        const count = classResults.length;
        const avg = count > 0 ? (classResults.reduce((a, b) => a + b.score, 0) / count).toFixed(2) : '0';
        const pass = classResults.filter(r => r.score >= 5).length;

        return {
          'Lớp học': c.name,
          'Khối': `Khối ${c.grade}`,
          'Sĩ số': c.studentCount,
          'Số lượt làm bài': count,
          'Điểm trung bình': avg,
          'Số bài Đạt': pass,
          'Tỷ lệ Đạt (%)': count > 0 ? `${Math.round((pass / count) * 100)}%` : '0%'
        };
      });
    } else if (viewMode === 'by_subject') {
      reportData = subjects.map(s => {
        const subResults = enrichedResults.filter(r => r.subjectId === s.code || r.subjectName.toLowerCase().includes(s.name.toLowerCase()));
        const count = subResults.length;
        const avg = count > 0 ? (subResults.reduce((a, b) => a + b.score, 0) / count).toFixed(2) : '0';
        const pass = subResults.filter(r => r.score >= 5).length;

        return {
          'Môn học': s.name,
          'Mã môn': s.code,
          'Số lượt thi': count,
          'Điểm trung bình': avg,
          'Số bài Đạt': pass,
          'Tỷ lệ Đạt (%)': count > 0 ? `${Math.round((pass / count) * 100)}%` : '0%'
        };
      });
    } else {
      // By exam / student list
      reportData = enrichedResults.map((r, i) => ({
        'STT': i + 1,
        'Họ và tên': r.studentName,
        'Email': r.studentEmail,
        'Lớp': r.classId,
        'Đề thi': r.examTitle,
        'Khối': r.grade,
        'Môn học': r.subjectName,
        'Điểm số': r.score,
        'Số câu đúng': r.correctCount,
        'Số câu sai': r.wrongCount,
        'Vi phạm rời tab': r.tabViolations || 0,
        'Thời gian nộp': new Date(r.submittedAt).toLocaleString('vi-VN')
      }));
    }

    const worksheet = XLSX.utils.json_to_sheet(reportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ThongKeEduTest');
    XLSX.writeFile(workbook, `Bao_cao_Thong_ke_EduTest_${viewMode}.xlsx`);
  };

  // Filtered dataset for currently active view
  const currentFilteredResults = enrichedResults.filter(r => {
    const matchGrade = selectedGrade === 'all' || r.grade === selectedGrade;
    const matchClass = selectedClassId === 'all' || r.classId === selectedClassId;
    const matchSubject = selectedSubjectId === 'all' || r.subjectId === selectedSubjectId;
    const matchExam = selectedExamId === 'all' || r.examId === selectedExamId;
    const matchSearch = !searchStudent.trim() || 
      (r.studentName || '').toLowerCase().includes(searchStudent.toLowerCase()) ||
      (r.studentEmail || '').toLowerCase().includes(searchStudent.toLowerCase());

    return matchGrade && matchClass && matchSubject && matchExam && matchSearch;
  });

  // Summary Metrics
  const totalSubmissions = currentFilteredResults.length;
  const avgScore = totalSubmissions > 0 
    ? (currentFilteredResults.reduce((a, b) => a + b.score, 0) / totalSubmissions).toFixed(2)
    : '0.00';
  const highestScore = totalSubmissions > 0 ? Math.max(...currentFilteredResults.map(r => r.score)) : 0;
  const lowestScore = totalSubmissions > 0 ? Math.min(...currentFilteredResults.map(r => r.score)) : 0;
  const passCount = currentFilteredResults.filter(r => r.score >= 5).length;
  const passRate = totalSubmissions > 0 ? Math.round((passCount / totalSubmissions) * 100) : 0;
  const totalViolations = currentFilteredResults.reduce((sum, r) => sum + (r.tabViolations || 0), 0);

  // Score distribution tiers
  const tierExcellent = currentFilteredResults.filter(r => r.score >= 8.0).length; // Giỏi
  const tierGood = currentFilteredResults.filter(r => r.score >= 6.5 && r.score < 8.0).length; // Khá
  const tierAverage = currentFilteredResults.filter(r => r.score >= 5.0 && r.score < 6.5).length; // Trung bình
  const tierWeak = currentFilteredResults.filter(r => r.score < 5.0).length; // Yếu

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 leading-tight">
            Trung tâm Thống kê & Phân tích Kết quả Thi
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Báo cáo đa chiều theo Khối lớp (1 - 12), theo Lớp học, theo Môn học và chi tiết Đề thi
          </p>
        </div>

        <button
          onClick={handleExportFullExcel}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Xuất Báo cáo Excel (.xlsx)</span>
        </button>
      </div>

      {/* 4 View Tabs: Theo Khối / Theo Lớp / Theo Môn / Chi tiết Đề thi */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setViewMode('by_grade')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            viewMode === 'by_grade'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>1. Thống kê theo KHỐI LỚP (Khối 1 - 12)</span>
        </button>

        <button
          onClick={() => setViewMode('by_class')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            viewMode === 'by_class'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>2. Thống kê theo LỚP HỌC</span>
        </button>

        <button
          onClick={() => setViewMode('by_subject')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            viewMode === 'by_subject'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>3. Thống kê theo MÔN HỌC</span>
        </button>

        <button
          onClick={() => setViewMode('by_exam')}
          className={`flex items-center gap-2 px-4 py-2.5 font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
            viewMode === 'by_exam'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>4. Bảng điểm chi tiết & Giám sát rời tab</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Tổng số lượt làm bài</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{totalSubmissions}</p>
          <p className="text-[11px] text-slate-500 mt-1">Bài thi đã nộp & chấm điểm</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Điểm trung bình chung</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600">{avgScore} <span className="text-xs font-normal text-slate-400">/ 10</span></p>
          <p className="text-[11px] text-slate-500 mt-1">Tỷ lệ Đạt: {passRate}% ({passCount} bài)</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Điểm cao nhất / Thấp nhất</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">
            {highestScore} <span className="text-sm font-medium text-slate-400">/ {lowestScore}</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Thang điểm chuẩn 10</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Cảnh báo vi phạm rời tab</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-600">{totalViolations} <span className="text-xs font-normal text-slate-400">lần</span></p>
          <p className="text-[11px] text-slate-500 mt-1">Ghi nhận bởi hệ thống chống gian lận</p>
        </div>
      </div>

      {/* Distribution Spectrum Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800">Phổ điểm & Phân loại học lực:</span>
          <span className="text-slate-500">{totalSubmissions} học sinh</span>
        </div>
        
        {/* Colorful Bar */}
        <div className="w-full h-4 rounded-full overflow-hidden flex bg-slate-100">
          <div 
            style={{ width: `${totalSubmissions > 0 ? (tierExcellent / totalSubmissions) * 100 : 0}%` }} 
            className="bg-emerald-500 transition-all duration-300" 
            title={`Giỏi (>=8.0): ${tierExcellent}`}
          />
          <div 
            style={{ width: `${totalSubmissions > 0 ? (tierGood / totalSubmissions) * 100 : 0}%` }} 
            className="bg-blue-500 transition-all duration-300" 
            title={`Khá (6.5-7.9): ${tierGood}`}
          />
          <div 
            style={{ width: `${totalSubmissions > 0 ? (tierAverage / totalSubmissions) * 100 : 0}%` }} 
            className="bg-amber-400 transition-all duration-300" 
            title={`Trung bình (5.0-6.4): ${tierAverage}`}
          />
          <div 
            style={{ width: `${totalSubmissions > 0 ? (tierWeak / totalSubmissions) * 100 : 0}%` }} 
            className="bg-rose-500 transition-all duration-300" 
            title={`Yếu (<5.0): ${tierWeak}`}
          />
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0"></span>
            <span className="text-slate-600">Giỏi (≥8.0): <strong>{tierExcellent}</strong> ({totalSubmissions > 0 ? Math.round((tierExcellent/totalSubmissions)*100) : 0}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0"></span>
            <span className="text-slate-600">Khá (6.5-7.9): <strong>{tierGood}</strong> ({totalSubmissions > 0 ? Math.round((tierGood/totalSubmissions)*100) : 0}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0"></span>
            <span className="text-slate-600">Trung bình (5.0-6.4): <strong>{tierAverage}</strong> ({totalSubmissions > 0 ? Math.round((tierAverage/totalSubmissions)*100) : 0}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0"></span>
            <span className="text-slate-600">Yếu (&lt;5.0): <strong>{tierWeak}</strong> ({totalSubmissions > 0 ? Math.round((tierWeak/totalSubmissions)*100) : 0}%)</span>
          </div>
        </div>
      </div>

      {/* ================= VIEW 1: THỐNG KÊ THEO KHỐI LỚP (1 -> 12) ================= */}
      {viewMode === 'by_grade' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                K12
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Bảng so sánh chất lượng toàn bộ các Khối lớp (Khối 1 đến 12)</h3>
                <p className="text-xs text-slate-500">Thống kê điểm trung bình, tỷ lệ Đạt và tỷ lệ Giỏi trên toàn trường</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Khối lớp</th>
                  <th className="py-3 px-4">Bậc học</th>
                  <th className="py-3 px-4 text-center">Số bài đã thi</th>
                  <th className="py-3 px-4 text-center">Điểm TB Khối</th>
                  <th className="py-3 px-4 text-center">Tỷ lệ Đạt (≥5.0)</th>
                  <th className="py-3 px-4 text-center">Tỷ lệ Giỏi (≥8.0)</th>
                  <th className="py-3 px-4 text-right">Đánh giá chung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allGrades.map((g) => {
                  const gradeResults = enrichedResults.filter(r => r.grade === g);
                  const count = gradeResults.length;
                  const avg = count > 0 ? (gradeResults.reduce((a, b) => a + b.score, 0) / count).toFixed(2) : '--';
                  const pass = gradeResults.filter(r => r.score >= 5).length;
                  const passPct = count > 0 ? Math.round((pass / count) * 100) : 0;
                  const excellent = gradeResults.filter(r => r.score >= 8).length;
                  const excPct = count > 0 ? Math.round((excellent / count) * 100) : 0;

                  const numG = parseInt(g, 10);
                  const schoolTier = numG <= 5 ? 'Tiểu học' : numG <= 9 ? 'THCS' : 'THPT';

                  return (
                    <tr key={g} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-black">
                          Khối {g}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          schoolTier === 'Tiểu học' ? 'bg-amber-50 text-amber-700' :
                          schoolTier === 'THCS' ? 'bg-cyan-50 text-cyan-700' :
                          'bg-indigo-50 text-indigo-700'
                        }`}>
                          {schoolTier}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-800">
                        {count > 0 ? `${count} lượt` : 'Chưa có bài'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`font-mono font-bold text-xs ${
                          avg === '--' ? 'text-slate-400' :
                          Number(avg) >= 8 ? 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded' :
                          Number(avg) >= 6.5 ? 'text-blue-700 bg-blue-50 px-2 py-0.5 rounded' :
                          'text-amber-700 bg-amber-50 px-2 py-0.5 rounded'
                        }`}>
                          {avg}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 font-semibold text-slate-700">
                          <span>{count > 0 ? `${passPct}%` : '--'}</span>
                          {count > 0 && (
                            <span className="text-[10px] text-slate-400">({pass}/{count})</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="font-semibold text-emerald-700">
                          {count > 0 ? `${excPct}%` : '--'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {count === 0 ? (
                          <span className="text-slate-400 text-[11px]">Chờ tổ chức thi</span>
                        ) : Number(avg) >= 8.0 ? (
                          <span className="text-emerald-700 font-bold text-[11px]">Xuất sắc</span>
                        ) : Number(avg) >= 6.5 ? (
                          <span className="text-blue-700 font-bold text-[11px]">Khá tốt</span>
                        ) : (
                          <span className="text-amber-700 font-bold text-[11px]">Cần bồi dưỡng</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= VIEW 2: THỐNG KÊ THEO LỚP HỌC ================= */}
      {viewMode === 'by_class' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Bảng kết quả thi theo từng Lớp học</h3>
              <p className="text-xs text-slate-500">Theo dõi tiến độ, điểm trung bình và tỷ lệ nộp bài của từng lớp</p>
            </div>
            
            {/* Filter by Grade */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Lọc khối:</span>
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
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Tên lớp</th>
                  <th className="py-3 px-4">Khối</th>
                  <th className="py-3 px-4 text-center">Sĩ số lớp</th>
                  <th className="py-3 px-4 text-center">Số bài đã nộp</th>
                  <th className="py-3 px-4 text-center">Điểm TB Lớp</th>
                  <th className="py-3 px-4 text-center">Tỷ lệ Đạt</th>
                  <th className="py-3 px-4 text-right">Phổ điểm chính</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classes
                  .filter(c => selectedGrade === 'all' || c.grade === selectedGrade)
                  .map((c) => {
                    const classResults = enrichedResults.filter(r => r.classId === c.name || r.classId === c.id);
                    const count = classResults.length;
                    const avg = count > 0 ? (classResults.reduce((a, b) => a + b.score, 0) / count).toFixed(2) : '--';
                    const pass = classResults.filter(r => r.score >= 5).length;
                    const passPct = count > 0 ? Math.round((pass / count) * 100) : 0;

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                          <GraduationCap className="w-4 h-4 text-emerald-600" />
                          <span>{c.name}</span>
                          <span className="text-[10px] text-slate-400 font-normal">({c.description || 'Lớp chuẩn'})</span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 font-semibold">
                          Khối {c.grade}
                        </td>
                        <td className="py-3.5 px-4 text-center text-slate-600 font-medium">
                          {c.studentCount} HS
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                          {count} bài
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`font-mono font-bold text-xs ${
                            avg === '--' ? 'text-slate-400' :
                            Number(avg) >= 8 ? 'text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded' :
                            Number(avg) >= 6.5 ? 'text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded' :
                            'text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded'
                          }`}>
                            {avg}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                          {count > 0 ? `${passPct}%` : '--'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="text-xs text-slate-500">
                            {count > 0 ? (Number(avg) >= 8 ? 'Chủ yếu 8 - 10' : 'Chủ yếu 6.5 - 8') : 'Chưa thi'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= VIEW 3: THỐNG KÊ THEO MÔN HỌC ================= */}
      {viewMode === 'by_subject' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                MÔN
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Bảng phân tích chất lượng theo Môn học</h3>
                <p className="text-xs text-slate-500">So sánh điểm trung bình giữa các bộ môn Toán, Văn, Anh, KHTN...</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Môn học</th>
                  <th className="py-3 px-4">Mã môn</th>
                  <th className="py-3 px-4 text-center">Số bài đã nộp</th>
                  <th className="py-3 px-4 text-center">Điểm TB Môn</th>
                  <th className="py-3 px-4 text-center">Tỷ lệ Đạt (≥5.0)</th>
                  <th className="py-3 px-4 text-right">Khuyến nghị chuyên môn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjects.map((s) => {
                  const subResults = enrichedResults.filter(r => 
                    r.subjectId === s.code || 
                    (r.subjectName && r.subjectName.toLowerCase().includes(s.name.toLowerCase()))
                  );
                  const count = subResults.length;
                  const avg = count > 0 ? (subResults.reduce((a, b) => a + b.score, 0) / count).toFixed(2) : '--';
                  const pass = subResults.filter(r => r.score >= 5).length;
                  const passPct = count > 0 ? Math.round((pass / count) * 100) : 0;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-indigo-600" />
                        <span>{s.name}</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                        {s.code}
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-slate-800">
                        {count > 0 ? `${count} lượt` : 'Chưa có bài'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`font-mono font-bold text-xs ${
                          avg === '--' ? 'text-slate-400' :
                          Number(avg) >= 8 ? 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded' :
                          Number(avg) >= 6.5 ? 'text-blue-700 bg-blue-50 px-2 py-0.5 rounded' :
                          'text-amber-700 bg-amber-50 px-2 py-0.5 rounded'
                        }`}>
                          {avg}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                        {count > 0 ? `${passPct}%` : '--'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {count === 0 ? (
                          <span className="text-slate-400 text-[11px]">Chưa có dữ liệu</span>
                        ) : Number(avg) >= 8.0 ? (
                          <span className="text-emerald-700 font-bold text-[11px]">Duy trì chất lượng tốt</span>
                        ) : (
                          <span className="text-amber-700 font-bold text-[11px]">Cần tăng cường bài tập</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= VIEW 4: BẢNG ĐIỂM CHI TIẾT & GIÁM SÁT RỜI TAB ================= */}
      {viewMode === 'by_exam' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-5">
          
          {/* Multi-Filters bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Filter Exam */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Chọn đề thi:</label>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-xl px-2.5 py-1.5 bg-white font-medium cursor-pointer"
              >
                <option value="all">Tất cả đề thi ({exams.length} đề)</option>
                {exams.map(e => (
                  <option key={e.id} value={e.id}>{e.title} (Khối {e.grade})</option>
                ))}
              </select>
            </div>

            {/* Filter Grade */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Khối lớp:</label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-xl px-2.5 py-1.5 bg-white font-medium cursor-pointer"
              >
                <option value="all">Tất cả các khối</option>
                {allGrades.map(g => (
                  <option key={g} value={g}>Khối {g}</option>
                ))}
              </select>
            </div>

            {/* Filter Class */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Lớp học:</label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-xl px-2.5 py-1.5 bg-white font-medium cursor-pointer"
              >
                <option value="all">Tất cả các lớp</option>
                {classes.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Search Student */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Tìm học sinh:</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchStudent}
                  onChange={(e) => setSearchStudent(e.target.value)}
                  placeholder="Tên hoặc email..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Học sinh</th>
                  <th className="py-2.5 px-3">Lớp</th>
                  <th className="py-2.5 px-3">Đề thi & Môn</th>
                  <th className="py-2.5 px-3 text-center">Điểm số</th>
                  <th className="py-2.5 px-3 text-center">Số câu đúng</th>
                  <th className="py-2.5 px-3 text-center">Giám sát rời tab</th>
                  <th className="py-2.5 px-3 text-right">Thời gian nộp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentFilteredResults.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Không tìm thấy kết quả phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  currentFilteredResults.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{r.studentName}</div>
                        <div className="text-[11px] text-slate-400">{r.studentEmail}</div>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-700">
                        {r.classId || '10A1'}
                      </td>
                      <td className="py-2.5 px-3 max-w-[200px]">
                        <div className="font-medium text-slate-800 truncate" title={r.examTitle}>
                          {r.examTitle}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {r.subjectName} • Khối {r.grade}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                          r.score >= 8.0 ? 'bg-emerald-100 text-emerald-800' :
                          r.score >= 5.0 ? 'bg-blue-100 text-blue-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {r.score.toFixed(1)} / {r.maxScore || 10}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold text-slate-700">
                        <span className="text-emerald-700 font-bold">{r.correctCount}</span> / {r.correctCount + r.wrongCount} câu
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {(r.tabViolations || 0) > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                            <ShieldAlert className="w-3 h-3 text-rose-600" />
                            <span>{r.tabViolations} lần vi phạm</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Nghiêm túc (0 lần)</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500 text-[11px]">
                        {new Date(r.submittedAt).toLocaleTimeString('vi-VN')} {new Date(r.submittedAt).toLocaleDateString('vi-VN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
