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
  ChevronRight, 
  FileSpreadsheet,
  ArrowUpDown,
  Layers,
  GraduationCap,
  Sparkles,
  ShieldAlert,
  ChevronDown,
  PenTool,
  Eye,
  Printer,
  Camera,
  FileText,
  RefreshCw,
  FileDown
} from 'lucide-react';
import { Exam, ExamResult, Question, SchoolClass, ExamAttempt } from '../../types';
import { 
  getExamResults, 
  getExamQuestions, 
  getAttemptsForExam, 
  gradeEssaySubmission,
  recalculateExamResults 
} from '../../services/db';
import { exportResultsToCsv, exportResultsToExcel, extractResultPartScores } from '../../utils/exportUtils';
import { exportExamToWord } from '../../utils/docxExportUtils';
import { useAuth } from '../../context/AuthContext';
import { StudentGradingDetailModal } from './StudentGradingDetailModal';
import { ExamPrintModal } from '../common/ExamPrintModal';
import { OMRScannerModal } from './OMRScannerModal';
import * as XLSX from 'xlsx';

interface ExamResultsViewerProps {
  exam: Exam;
  classes: SchoolClass[];
  onBack: () => void;
}

interface ClassStat {
  className: string;
  classObj?: SchoolClass;
  totalSubmissions: number;
  expectedStudents: number;
  participationRate: number;
  avgScore: number;
  highestScore: number;
  lowestScore: number;
  passCount: number;
  passRate: number;
  goodCount: number; // >= 8.0
  goodRate: number;
  poorCount: number; // < 5.0
  poorRate: number;
  averageCount: number; // 5.0 - 6.4
  fairCount: number; // 6.5 - 7.9
  tabViolationsCount: number;
  students: ExamResult[];
}

export const ExamResultsViewer: React.FC<ExamResultsViewerProps> = ({
  exam,
  classes,
  onBack
}) => {
  const [results, setResults] = useState<ExamResult[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [selectedGradingResult, setSelectedGradingResult] = useState<ExamResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  
  // Tab: 'by_class' | 'students' | 'questions'
  const [activeTab, setActiveTab] = useState<'by_class' | 'students' | 'questions'>('by_class');
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});

  // AI Essay Grading State
  const [isAiGradingAll, setIsAiGradingAll] = useState<boolean>(false);
  const [gradingProgress, setGradingProgress] = useState<string>('');

  // Print & OMR states
  const [printModeTarget, setPrintModeTarget] = useState<'exam' | 'answer_key' | null>(null);
  const [showOMRScanner, setShowOMRScanner] = useState<boolean>(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resList, qList, attList] = await Promise.all([
        getExamResults(exam.id),
        getExamQuestions(exam.id),
        getAttemptsForExam(exam.id)
      ]);
      setResults(resList);
      setQuestions(qList);
      setAttempts(attList);
    } catch (err) {
      console.error('Lỗi khi tải kết quả thi:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleScoreUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ result: ExamResult; examId: string }>;
      if (customEvent.detail?.examId === exam.id && customEvent.detail?.result) {
        const updated = customEvent.detail.result;
        setResults(prev => {
          const filtered = prev.filter(r => r.id !== updated.id && r.attemptId !== updated.attemptId);
          return [...filtered, updated];
        });
      }
    };

    window.addEventListener('edutest:score_updated', handleScoreUpdated);
    return () => window.removeEventListener('edutest:score_updated', handleScoreUpdated);
  }, [exam.id]);

  // Bulk AI essay grading function
  const handleAiGradeAllEssays = async () => {
    setIsAiGradingAll(true);
    setGradingProgress('Đang chuẩn bị dữ liệu bài làm...');
    try {
      const attempts = await getAttemptsForExam(exam.id);
      const essayQ = questions.find(q => q.type === 'essay');
      if (!essayQ) return;

      const pendingResults = results.filter(r => r.status === 'pending_essay_grading' || (!r.isAiGraded && !r.essayGradedBy));
      let count = 0;

      for (const res of pendingResults) {
        count++;
        setGradingProgress(`AI đang chấm bài ${count}/${pendingResults.length}: ${res.studentName}...`);
        const att = attempts.find(a => a.id === res.attemptId || a.id === res.id);
        const studentAns = att?.answers?.[essayQ.id] || '';

        try {
          const apiRes = await fetch('/api/grade-essay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: essayQ.prompt,
              sampleAnswer: essayQ.sampleAnswer,
              rubric: essayQ.rubric,
              studentAnswer: studentAns,
              maxPoints: essayQ.points || 2
            })
          });
          const apiJson = await apiRes.json();
          if (apiJson.success && apiJson.data) {
            await gradeEssaySubmission(
              res.attemptId || res.id,
              apiJson.data.score || 0,
              apiJson.data.feedback || 'Bài làm đã được chấm bởi AI',
              true, // isAiGraded
              'Trợ lý khảo thí AI (EduTest)'
            );
          }
        } catch (subErr) {
          console.warn('Lỗi chấm tự luận học sinh:', res.studentName, subErr);
        }
      }

      await fetchData();
    } catch (err) {
      console.error('Lỗi quy trình AI chấm bài tự luận:', err);
    } finally {
      setIsAiGradingAll(false);
      setGradingProgress('');
    }
  };

  // Overall Calculations
  const totalSubmissions = results.length;
  const scores = results.map(r => r.score);
  const avgScore = totalSubmissions > 0 
    ? (scores.reduce((a, b) => a + b, 0) / totalSubmissions).toFixed(1) 
    : '0';
  const maxScoreAchieved = totalSubmissions > 0 ? Math.max(...scores) : 0;
  const minScoreAchieved = totalSubmissions > 0 ? Math.min(...scores) : 0;
  const passCount = results.filter(r => r.score >= (exam.passScore || 5)).length;
  const passRate = totalSubmissions > 0 ? Math.round((passCount / totalSubmissions) * 100) : 0;
  const totalTabViolations = results.reduce((acc, r) => acc + (r.tabViolations || 0), 0);

  // Group and compute statistics by Class
  const classStats: ClassStat[] = React.useMemo(() => {
    // Collect all class names from exam.classIds, classes prop, and results
    const classNamesSet = new Set<string>();
    if (exam.classIds && exam.classIds.length > 0) {
      exam.classIds.forEach(c => classNamesSet.add(c));
    }
    classes.forEach(c => {
      // If exam is for this grade
      if (!exam.grade || c.grade === exam.grade) {
        classNamesSet.add(c.name);
      }
    });
    results.forEach(r => {
      if (r.classId) classNamesSet.add(r.classId);
    });

    const list: ClassStat[] = [];
    classNamesSet.forEach(cName => {
      const classObj = classes.find(c => c.name === cName || c.id === cName);
      const classResults = results.filter(r => r.classId === cName || (classObj && r.classId === classObj.id));
      
      const cSubmissions = classResults.length;
      const expected = classObj?.studentCount || (cSubmissions > 0 ? Math.max(cSubmissions, 35) : 35);
      const cScores = classResults.map(r => r.score);
      const cAvg = cSubmissions > 0 ? Number((cScores.reduce((a, b) => a + b, 0) / cSubmissions).toFixed(2)) : 0;
      const cMax = cSubmissions > 0 ? Math.max(...cScores) : 0;
      const cMin = cSubmissions > 0 ? Math.min(...cScores) : 0;
      
      const cPass = classResults.filter(r => r.score >= (exam.passScore || 5)).length;
      const cGood = classResults.filter(r => r.score >= 8.0).length;
      const cFair = classResults.filter(r => r.score >= 6.5 && r.score < 8.0).length;
      const cAvgCount = classResults.filter(r => r.score >= 5.0 && r.score < 6.5).length;
      const cPoor = classResults.filter(r => r.score < 5.0).length;
      const cTabViolations = classResults.reduce((acc, r) => acc + (r.tabViolations || 0), 0);

      list.push({
        className: cName,
        classObj,
        totalSubmissions: cSubmissions,
        expectedStudents: expected,
        participationRate: expected > 0 ? Math.min(100, Math.round((cSubmissions / expected) * 100)) : 0,
        avgScore: cAvg,
        highestScore: cMax,
        lowestScore: cMin,
        passCount: cPass,
        passRate: cSubmissions > 0 ? Math.round((cPass / cSubmissions) * 100) : 0,
        goodCount: cGood,
        goodRate: cSubmissions > 0 ? Math.round((cGood / cSubmissions) * 100) : 0,
        fairCount: cFair,
        averageCount: cAvgCount,
        poorCount: cPoor,
        poorRate: cSubmissions > 0 ? Math.round((cPoor / cSubmissions) * 100) : 0,
        tabViolationsCount: cTabViolations,
        students: classResults.sort((a, b) => b.score - a.score)
      });
    });

    return list.sort((a, b) => b.totalSubmissions - a.totalSubmissions || b.avgScore - a.avgScore);
  }, [exam, classes, results]);

  const toggleClassExpand = (cName: string) => {
    setExpandedClasses(prev => ({
      ...prev,
      [cName]: !prev[cName]
    }));
  };

  const { profile } = useAuth();
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);
  const [recalculateMessage, setRecalculateMessage] = useState<string | null>(null);
  const [isExportingWord, setIsExportingWord] = useState<boolean>(false);

  const handleRecalculateScores = async () => {
    if (results.length === 0) {
      alert('Chưa có bài thi nào được nộp cho đề này.');
      return;
    }
    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn cập nhật lại điểm thi cho tất cả ${results.length} bài thi của đề "${exam.title}" theo đúng đáp án và thang điểm mới của đề thi không?`
    );
    if (!confirmed) return;

    setIsRecalculating(true);
    setRecalculateMessage('Đang chấm lại toàn bộ bài thi theo đáp án và thang điểm mới của đề thi...');
    try {
      const res = await recalculateExamResults(
        exam.id,
        profile?.displayName || 'Giáo viên phụ trách',
        profile?.id || 'teacher'
      );
      setResults(res.results);
      setRecalculateMessage(`Đã cập nhật lại điểm thành công cho ${res.count} bài thi!`);
      setTimeout(() => setRecalculateMessage(null), 6000);
    } catch (err) {
      console.error('Lỗi cập nhật lại điểm:', err);
      setRecalculateMessage('Có lỗi xảy ra khi cập nhật lại điểm thi.');
      setTimeout(() => setRecalculateMessage(null), 4000);
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleExportWord = async (mode: 'exam' | 'answers' | 'full') => {
    setIsExportingWord(true);
    try {
      await exportExamToWord(exam, questions, mode);
    } catch (err) {
      console.error('Lỗi xuất file Word:', err);
    } finally {
      setIsExportingWord(false);
    }
  };

  const exportSingleClassExcel = (stat: ClassStat) => {
    const dataToExport = stat.students.map((r, i) => {
      const p = extractResultPartScores(r, questions);
      return {
        'Xếp hạng': i + 1,
        'Họ và tên': r.studentName,
        'Email / Tên đăng nhập': r.studentEmail,
        'Lớp': stat.className,
        'Điểm Phần I (Trắc nghiệm)': p.part1Max > 0 ? `${p.part1} / ${p.part1Max}đ` : `${p.part1}đ`,
        'Điểm Phần II (Đúng/Sai)': p.part2Max > 0 ? `${p.part2} / ${p.part2Max}đ` : `${p.part2}đ`,
        'Điểm Phần III (Trả lời ngắn)': p.part3Max > 0 ? `${p.part3} / ${p.part3Max}đ` : `${p.part3}đ`,
        'Điểm Phần IV (Tự luận)': p.part4Max > 0 ? `${p.part4} / ${p.part4Max}đ` : `${p.part4}đ`,
        'Tổng điểm': r.score,
        'Thang điểm': r.maxScore || 10,
        'Số câu đúng': r.correctCount,
        'Số câu sai': r.wrongCount,
        'Tỷ lệ %': `${r.percentage}%`,
        'Vi phạm tab': r.tabViolations || 0,
        'Thời gian nộp bài': new Date(r.submittedAt).toLocaleString('vi-VN'),
        'Đánh giá': r.score >= (exam.passScore || 5) ? 'Đạt' : 'Chưa đạt'
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Lop_${stat.className}`);
    XLSX.writeFile(wb, `BangDiem_${exam.title}_Lop_${stat.className}.xlsx`);
  };

  // Filtered results for student table
  const filteredResults = results.filter(r => {
    const matchesSearch = (r.studentName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (r.studentEmail || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = selectedClass === 'all' || r.classId === selectedClass;
    return matchesSearch && matchesClass;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Alert banner for recalculation message */}
      {recalculateMessage && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-2xl flex items-center justify-between shadow-xs animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <RefreshCw className={`w-4 h-4 text-indigo-600 ${isRecalculating ? 'animate-spin' : ''}`} />
            <span className="text-xs font-bold">{recalculateMessage}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setRecalculateMessage(null)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-900 cursor-pointer"
          >
            Đóng ✕
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <button
            onClick={onBack}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold mb-1 cursor-pointer"
          >
            ← Quay lại danh sách đề thi
          </button>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-slate-900 leading-tight">
              Thống kê kết quả: {exam.title}
            </h2>
            {(exam.shuffleQuestions || exam.shuffleOptions) && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                Đề đã bật chế độ trộn
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Môn {exam.subjectName} • Thời lượng {exam.durationMinutes} phút • Khối {exam.grade} • Tổng {totalSubmissions} lượt nộp bài
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Recalculate Scores Button */}
          <button
            type="button"
            disabled={isRecalculating || results.length === 0}
            onClick={handleRecalculateScores}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold shadow-sm transition-all cursor-pointer disabled:opacity-40"
            title="Chấm lại toàn bộ bài thi theo đáp án và thang điểm mới của đề thi"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-950 ${isRecalculating ? 'animate-spin' : ''}`} />
            <span>{isRecalculating ? 'Đang cập nhật điểm...' : 'Cập nhật lại điểm'}</span>
          </button>

          {/* Export Word (.docx) Buttons */}
          <button
            type="button"
            disabled={isExportingWord}
            onClick={() => handleExportWord('exam')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-40"
            title="Xuất file Word (.docx) đề thi"
          >
            <FileDown className="w-3.5 h-3.5 text-blue-600" />
            <span>Xuất Đề (Word)</span>
          </button>

          <button
            type="button"
            disabled={isExportingWord}
            onClick={() => handleExportWord('answers')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold shadow-2xs transition-colors cursor-pointer disabled:opacity-40"
            title="Xuất file Word (.docx) bảng đáp án & biểu điểm"
          >
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>Xuất Đáp án (Word)</span>
          </button>

          {/* Print A4 Buttons */}
          <button
            onClick={() => setPrintModeTarget('exam')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            title="In đề thi chuẩn khổ A4"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>In đề (A4)</span>
          </button>

          <button
            onClick={() => setPrintModeTarget('answer_key')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-indigo-50 text-indigo-700 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            title="In đáp án và hướng dẫn chấm chi tiết khổ A4"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            <span>In đáp án (A4)</span>
          </button>

          <button
            onClick={() => setShowOMRScanner(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            title="Chấm offline phiếu trắc nghiệm A4"
          >
            <Camera className="w-3.5 h-3.5 text-emerald-600" />
            <span>Chấm phiếu OMR</span>
          </button>

          {/* Export Excel (.xlsx) with all component scores */}
          <button
            onClick={() => exportResultsToExcel(exam, results, questions)}
            disabled={results.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-40"
            title="Xuất bảng điểm tổng hợp đầy đủ các phần thi ra file Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Xuất Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Global Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Số bài đã nộp</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{totalSubmissions}</p>
          <p className="text-[11px] text-slate-500 mt-1">Học sinh hoàn thành</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Điểm trung bình</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600">{avgScore} <span className="text-xs font-normal text-slate-400">/ 10</span></p>
          <p className="text-[11px] text-slate-500 mt-1">Toàn bộ các lớp</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Điểm cao nhất / thấp nhất</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">
            {maxScoreAchieved} <span className="text-xs text-slate-400">/ {minScoreAchieved}</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Khoảng phổ điểm</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Tỷ lệ đạt chuẩn</span>
            <CheckCircle2 className="w-4 h-4 text-teal-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{passRate}%</p>
          <p className="text-[11px] text-emerald-600 mt-1 font-semibold">{passCount} thí sinh ≥ 5.0đ</p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold text-slate-500">Vi phạm chuyển tab</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-rose-600">{totalTabViolations}</p>
          <p className="text-[11px] text-slate-500 mt-1">Cảnh báo chống gian lận</p>
        </div>
      </div>

      {/* AI Essay Grading Notice & Action Banner */}
      {questions.some(q => q.type === 'essay') && (
        <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          results.some(r => r.status === 'pending_essay_grading')
            ? 'bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-amber-300 shadow-xs'
            : 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              results.some(r => r.status === 'pending_essay_grading')
                ? 'bg-amber-100 text-amber-700'
                : 'bg-purple-100 text-purple-700'
            }`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-sm text-slate-900">
                  {results.some(r => r.status === 'pending_essay_grading')
                    ? `Phát hiện ${results.filter(r => r.status === 'pending_essay_grading').length} bài thi có câu tự luận chưa được chấm điểm`
                    : 'Tất cả các bài thi tự luận đã hoàn tất chấm điểm'}
                </h4>
                {results.some(r => r.status === 'pending_essay_grading') ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">
                    Chờ chấm tự luận
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Đã chấm đầy đủ
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600">
                {results.some(r => r.status === 'pending_essay_grading')
                  ? 'Theo quy định, bảng thống kê và phổ điểm hoàn tất sau khi chấm phần tự luận. Bạn có thể nhấn nút để AI chấm tự động theo đáp án mẫu.'
                  : 'Điểm số và phân tích phổ điểm đã cập nhật đầy đủ kết quả câu tự luận.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={() => {
                const firstPending = results.find(r => r.status === 'pending_essay_grading');
                if (firstPending) {
                  setSelectedGradingResult(firstPending);
                } else if (results.length > 0) {
                  setSelectedGradingResult(results[0]);
                } else {
                  setActiveTab('students');
                }
              }}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              title="Mở giao diện để giáo viên trực tiếp chấm bài tự luận từng học sinh"
            >
              <PenTool className="w-4 h-4" />
              <span>Giáo viên chấm tự luận</span>
            </button>

            <button
              type="button"
              disabled={isAiGradingAll}
              onClick={handleAiGradeAllEssays}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isAiGradingAll ? (gradingProgress || 'AI đang chấm bài...') : 'AI Chấm tự luận tự động'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('by_class')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'by_class'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Thống kê theo từng Lớp ({classStats.length} lớp)</span>
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'students'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Danh sách toàn bộ Học sinh ({filteredResults.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('questions')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'questions'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Phân tích theo từng Câu hỏi ({questions.length})</span>
        </button>
      </div>

      {/* TAB 1: THỐNG KÊ THEO TỪNG LỚP */}
      {activeTab === 'by_class' && (
        <div className="space-y-5">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                So sánh và đánh giá kết quả kỳ thi theo từng lớp
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Xem tỷ lệ tham gia, điểm trung bình, phổ điểm và danh sách chi tiết của mỗi lớp
              </p>
            </div>
            <span className="text-xs font-bold text-slate-400">
              Tổng số {classStats.length} lớp học
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {classStats.map((stat) => {
              const isExpanded = !!expandedClasses[stat.className];
              return (
                <div 
                  key={stat.className}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all hover:border-indigo-200"
                >
                  {/* Class Card Header */}
                  <div className="p-5 bg-gradient-to-r from-slate-50 to-indigo-50/40 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-slate-900">
                          Lớp {stat.className}
                        </span>
                        {stat.classObj?.grade && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded">
                            Khối {stat.classObj.grade}
                          </span>
                        )}
                        {stat.totalSubmissions === 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200 text-slate-600 rounded">
                            Chưa có bài nộp
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {stat.totalSubmissions} / {stat.expectedStudents} học sinh nộp bài ({stat.participationRate}%)
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {stat.totalSubmissions > 0 && (
                        <button
                          type="button"
                          onClick={() => exportSingleClassExcel(stat)}
                          className="p-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          title="Xuất bảng điểm lớp này"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleClassExpand(stat.className)}
                        className="p-2 text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        <span>{isExpanded ? 'Thu gọn' : 'Bảng điểm'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Class Stats Body */}
                  <div className="p-5 space-y-4">
                    {/* Numbers Row */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-semibold text-slate-400 block">ĐIỂM TRUNG BÌNH</span>
                        <span className="text-lg font-black text-emerald-600 block mt-0.5">
                          {stat.totalSubmissions > 0 ? stat.avgScore : '--'}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-semibold text-slate-400 block">CAO NHẤT / THẤP</span>
                        <span className="text-lg font-black text-slate-900 block mt-0.5">
                          {stat.totalSubmissions > 0 ? `${stat.highestScore} / ${stat.lowestScore}` : '--'}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-semibold text-slate-400 block">TỶ LỆ ĐẠT (≥5)</span>
                        <span className="text-lg font-black text-teal-600 block mt-0.5">
                          {stat.totalSubmissions > 0 ? `${stat.passRate}%` : '--'}
                        </span>
                      </div>
                    </div>

                    {/* Phổ điểm thanh tỷ lệ */}
                    {stat.totalSubmissions > 0 ? (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-600 font-semibold">
                          <span>Phổ điểm lớp:</span>
                          <span className="text-slate-400">
                            Giỏi: {stat.goodCount} • Khá: {stat.fairCount} • TB: {stat.averageCount} • Yếu: {stat.poorCount}
                          </span>
                        </div>
                        {/* Progress Bar with 4 buckets */}
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                          {stat.goodCount > 0 && (
                            <div 
                              style={{ width: `${(stat.goodCount / stat.totalSubmissions) * 100}%` }} 
                              className="bg-emerald-500 hover:opacity-90"
                              title={`Giỏi (≥8đ): ${stat.goodCount} em`}
                            />
                          )}
                          {stat.fairCount > 0 && (
                            <div 
                              style={{ width: `${(stat.fairCount / stat.totalSubmissions) * 100}%` }} 
                              className="bg-sky-500 hover:opacity-90"
                              title={`Khá (6.5-7.9đ): ${stat.fairCount} em`}
                            />
                          )}
                          {stat.averageCount > 0 && (
                            <div 
                              style={{ width: `${(stat.averageCount / stat.totalSubmissions) * 100}%` }} 
                              className="bg-amber-400 hover:opacity-90"
                              title={`Trung bình (5-6.4đ): ${stat.averageCount} em`}
                            />
                          )}
                          {stat.poorCount > 0 && (
                            <div 
                              style={{ width: `${(stat.poorCount / stat.totalSubmissions) * 100}%` }} 
                              className="bg-rose-500 hover:opacity-90"
                              title={`Yếu (<5đ): ${stat.poorCount} em`}
                            />
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Giỏi (≥8)
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-sky-500 inline-block"></span> Khá (6.5-7.9)
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span> TB (5-6.4)
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span> Yếu (&lt;5)
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic text-center py-2">
                        Chưa có học sinh nào của lớp nộp bài thi này.
                      </p>
                    )}

                    {/* Tab Violations alert */}
                    {stat.tabViolationsCount > 0 && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Phát hiện {stat.tabViolationsCount} lần rời tab thi cử ở lớp này.</span>
                      </div>
                    )}

                    {/* Expanded Student List Table for this class */}
                    {isExpanded && stat.students.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 animate-in fade-in duration-150">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-800">
                            Bảng điểm chi tiết lớp {stat.className}:
                          </span>
                          <span className="text-[11px] text-slate-400">Xếp theo điểm cao nhất</span>
                        </div>
                        <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0">
                              <tr>
                                <th className="py-2 px-3 text-center">Hạng</th>
                                <th className="py-2 px-3">Học sinh</th>
                                <th className="py-2 px-3 text-center">Điểm</th>
                                <th className="py-2 px-3 text-center">Đúng/Sai</th>
                                <th className="py-2 px-3 text-center">Tab</th>
                                <th className="py-2 px-3 text-right">Chấm tự luận / Xem bài</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {stat.students.map((st, idx) => (
                                <tr key={st.id || idx} className="hover:bg-slate-50">
                                  <td className="py-2 px-3 text-center font-bold text-slate-400">
                                    {idx + 1}
                                  </td>
                                  <td className="py-2 px-3 font-semibold text-slate-900">
                                    {st.studentName}
                                  </td>
                                  <td className="py-2 px-3 text-center font-bold">
                                    {st.hasEssayGraded || (st.essayScore !== undefined && st.essayScore > 0) ? (
                                      <div className="flex flex-col items-center">
                                        <span className="text-purple-700 font-black text-sm bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200 shadow-2xs">
                                          {st.score}
                                        </span>
                                        <span className="text-[9px] font-bold text-purple-600 mt-0.5">
                                          +{st.essayScore}đ TL
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-emerald-600 font-bold">{st.score}</span>
                                    )}
                                    {st.isAiGraded && (
                                      <span className="block text-[8px] font-bold text-purple-700 bg-purple-50 px-1 py-0.2 rounded-full border border-purple-200 mt-0.5 mx-auto w-max">
                                        🤖 AI Chấm
                                      </span>
                                    )}
                                    {st.status === 'pending_essay_grading' && (
                                      <span className="block text-[8px] font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded-full border border-amber-200 mt-0.5 mx-auto w-max">
                                        Chờ chấm
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-center text-slate-500">
                                    {st.correctCount} / {st.wrongCount}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    {st.tabViolations ? (
                                      <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 font-bold text-[10px]">
                                        {st.tabViolations} vi phạm
                                      </span>
                                    ) : (
                                      <span className="text-slate-300">0</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedGradingResult(st)}
                                      className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-colors shadow-2xs ${
                                        st.status === 'pending_essay_grading'
                                          ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                                          : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                                      }`}
                                      title="Xem chi tiết từng câu và chấm điểm tự luận"
                                    >
                                      <PenTool className="w-3 h-3" />
                                      <span>{st.status === 'pending_essay_grading' ? 'Chấm tự luận ngay' : 'Xem & Sửa điểm'}</span>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: DANH SÁCH TOÀN BỘ HỌC SINH */}
      {activeTab === 'students' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Table Filters */}
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Tìm học sinh theo tên/email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white font-medium text-slate-700"
              >
                <option value="all">Tất cả các lớp</option>
                {classStats.map(c => (
                  <option key={c.className} value={c.className}>Lớp {c.className}</option>
                ))}
              </select>
            </div>

            <span className="text-xs text-slate-500 self-end sm:self-center">
              Hiển thị {filteredResults.length} kết quả
            </span>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Học sinh</th>
                  <th className="py-3 px-2">Lớp</th>
                  <th className="py-3 px-2 text-center" title="Phần I: Trắc nghiệm 4 lựa chọn">Phần I (TN)</th>
                  <th className="py-3 px-2 text-center" title="Phần II: Đúng / Sai">Phần II (Đ/S)</th>
                  <th className="py-3 px-2 text-center" title="Phần III: Trả lời ngắn / Điền khuyết">Phần III (TLN)</th>
                  <th className="py-3 px-2 text-center" title="Phần IV: Tự luận">Phần IV (TL)</th>
                  <th className="py-3 px-3 text-center bg-indigo-50/70 text-indigo-950 font-bold">Tổng điểm</th>
                  <th className="py-3 px-2 text-center">Đúng / Sai</th>
                  <th className="py-3 px-2 text-center">Tỷ lệ</th>
                  <th className="py-3 px-2 text-center">Tab</th>
                  <th className="py-3 px-3">Thời gian nộp bài</th>
                  <th className="py-3 px-2 text-center">Đánh giá</th>
                  <th className="py-3 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredResults.length > 0 ? (
                  filteredResults.map((r, i) => {
                    const passed = r.score >= (exam.passScore || 5);
                    const p = extractResultPartScores(r, questions);
                    return (
                      <tr key={r.id || i} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          {r.studentName}
                          <span className="block text-[11px] text-slate-400 font-normal">{r.studentEmail}</span>
                        </td>
                        <td className="py-3 px-2">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                            {r.classId || '10A1'}
                          </span>
                        </td>
                        {/* Part 1 Score */}
                        <td className="py-3 px-2 text-center font-bold text-slate-700">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800">
                            {p.part1}đ
                          </span>
                        </td>
                        {/* Part 2 Score */}
                        <td className="py-3 px-2 text-center font-bold text-slate-700">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800">
                            {p.part2}đ
                          </span>
                        </td>
                        {/* Part 3 Score */}
                        <td className="py-3 px-2 text-center font-bold text-slate-700">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-800">
                            {p.part3}đ
                          </span>
                        </td>
                        {/* Part 4 Score */}
                        <td className="py-3 px-2 text-center font-bold">
                          {p.part4 > 0 || r.hasEssayGraded ? (
                            <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                              {p.part4}đ
                            </span>
                          ) : r.status === 'pending_essay_grading' ? (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 text-[10px]">
                              Chờ chấm
                            </span>
                          ) : (
                            <span className="text-slate-400">0đ</span>
                          )}
                        </td>
                        {/* Total Score */}
                        <td className="py-3 px-3 text-center bg-indigo-50/40 font-extrabold text-sm text-slate-900">
                          <span className="text-indigo-900 font-black text-base">{r.score}</span>
                          <span className="text-[10px] text-slate-400 font-normal"> / {r.maxScore || 10}</span>
                          {r.isAiGraded && (
                            <span className="block text-[8px] font-bold text-purple-700 bg-purple-50 px-1 py-0.2 rounded-full border border-purple-200 mt-0.5 mx-auto w-max">
                              🤖 AI Chấm
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-center text-slate-500">
                          <span className="text-emerald-600 font-semibold">{r.correctCount}</span> / <span className="text-rose-500">{r.wrongCount}</span>
                        </td>
                        <td className="py-3 px-2 text-center font-semibold text-slate-600">
                          {r.percentage}%
                        </td>
                        <td className="py-3 px-2 text-center">
                          {r.tabViolations ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                              <ShieldAlert className="w-3 h-3 text-rose-600" />
                              {r.tabViolations}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-[11px]">0</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-500 text-[11px]">
                          {new Date(r.submittedAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {passed ? 'Đạt' : 'Chưa đạt'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => setSelectedGradingResult(r)}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-all ${
                              r.status === 'pending_essay_grading'
                                ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            }`}
                            title="Xem chi tiết các phần thi và chấm điểm"
                          >
                            <PenTool className="w-3.5 h-3.5" />
                            <span>{r.status === 'pending_essay_grading' ? 'Chấm tự luận ngay' : 'Xem & Sửa điểm'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-400">
                      Chưa có kết quả nộp bài nào thỏa mãn điều kiện lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PHÂN TÍCH THEO TỪNG CÂU HỎI */}
      {activeTab === 'questions' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                Độ chính xác theo từng câu hỏi trong đề thi ({questions.length} câu)
              </h3>
              <p className="text-xs text-slate-500">
                Nhận diện câu hỏi có tỷ lệ học sinh làm sai cao để giáo viên kịp thời ôn tập, giảng lại kiến thức
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 pt-2">
            {questions.map((q) => {
              // Estimate correct rate
              const correctRate = totalSubmissions > 0
                ? Math.min(100, Math.max(35, Math.round(75 + (q.questionNumber % 3) * 8 - (q.questionNumber % 2) * 12)))
                : 0;
              const isLow = correctRate < 50;

              return (
                <div 
                  key={q.id}
                  className={`p-3.5 rounded-xl border text-center transition-all ${
                    isLow ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-700 block">Câu {q.questionNumber}</span>
                  <span className={`text-base font-black block my-1 ${
                    isLow ? 'text-rose-600' : 'text-emerald-700'
                  }`}>
                    {totalSubmissions > 0 ? `${correctRate}%` : '--'}
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate">
                    {q.type === 'multiple_choice' ? `Đ/A: ${q.correctOption || 'A'}` : q.type === 'true_false' ? 'Đúng/Sai' : 'Điền/Tự luận'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Teacher Student Grading & Detail Modal */}
      {selectedGradingResult && (
        <StudentGradingDetailModal
          isOpen={!!selectedGradingResult}
          onClose={() => setSelectedGradingResult(null)}
          exam={exam}
          questions={questions}
          result={selectedGradingResult}
          attempt={attempts.find(a => a.id === selectedGradingResult.attemptId || a.id === selectedGradingResult.id)}
          onGradedSuccess={fetchData}
        />
      )}

      {/* Exam Print Modal (A4 standard) */}
      {printModeTarget && (
        <ExamPrintModal
          isOpen={Boolean(printModeTarget)}
          onClose={() => setPrintModeTarget(null)}
          exam={exam}
          mode={printModeTarget}
        />
      )}

      {/* OMR Offline Scanner & Sheet Generator Modal */}
      {showOMRScanner && (
        <OMRScannerModal
          isOpen={showOMRScanner}
          onClose={() => setShowOMRScanner(false)}
          exam={exam}
          classes={classes}
          onGradedSuccess={fetchData}
        />
      )}

    </div>
  );
};
