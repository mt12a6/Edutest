import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  PenTool, 
  Award, 
  Layers, 
  TrendingUp, 
  RefreshCw, 
  FileSpreadsheet, 
  Calendar, 
  Sparkles,
  ChevronRight,
  BookOpen,
  ArrowUpDown,
  Trash2
} from 'lucide-react';
import { Exam, ExamResult, SchoolClass, Question, ExamAttempt } from '../../types';
import { 
  getAllResults, 
  getAllAttempts, 
  getExamQuestions, 
  getExams,
  recalculateExamResults,
  deleteExamResult
} from '../../services/db';
import { StudentGradingDetailModal } from './StudentGradingDetailModal';
import { extractResultPartScores } from '../../utils/exportUtils';
import * as XLSX from 'xlsx';

interface StudentSubmissionsManagerProps {
  exams: Exam[];
  classes: SchoolClass[];
  onSelectExam?: (exam: Exam) => void;
}

export const StudentSubmissionsManager: React.FC<StudentSubmissionsManagerProps> = ({
  exams,
  classes,
  onSelectExam
}) => {
  const [results, setResults] = useState<ExamResult[]>([]);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [questionsCache, setQuestionsCache] = useState<Record<string, Question[]>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>('all');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [formatFilter, setFormatFilter] = useState<'all' | 'multiple_choice' | 'essay' | 'hybrid'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_essay_grading' | 'graded'>('all');
  const [sortBy, setSortBy] = useState<'submittedAt_desc' | 'score_desc' | 'score_asc' | 'studentName_asc'>('submittedAt_desc');

  // Selected for modal
  const [selectedResult, setSelectedResult] = useState<ExamResult | null>(null);
  const [modalExam, setModalExam] = useState<Exam | null>(null);
  const [modalQuestions, setModalQuestions] = useState<Question[]>([]);
  const [modalAttempt, setModalAttempt] = useState<ExamAttempt | undefined>(undefined);

  // Deletion modal state
  const [resultToDelete, setResultToDelete] = useState<ExamResult | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resList, attList] = await Promise.all([
        getAllResults(true),
        getAllAttempts()
      ]);
      setResults(resList);
      setAttempts(attList);
    } catch (err) {
      console.error('Lỗi tải danh sách bài làm học sinh:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleScoreUpdated = () => {
      fetchData();
    };
    window.addEventListener('edutest:score_updated', handleScoreUpdated);
    return () => window.removeEventListener('edutest:score_updated', handleScoreUpdated);
  }, []);

  // Pre-load exam questions cache for active exams
  useEffect(() => {
    exams.forEach(ex => {
      if (!questionsCache[ex.id]) {
        getExamQuestions(ex.id).then(qList => {
          setQuestionsCache(prev => ({ ...prev, [ex.id]: qList }));
        }).catch(() => {});
      }
    });
  }, [exams]);

  // Exam format classifier: 'multiple_choice' | 'essay' | 'hybrid'
  const getExamFormat = (examId: string): 'multiple_choice' | 'essay' | 'hybrid' => {
    const qList = questionsCache[examId] || [];
    if (qList.length === 0) return 'hybrid';
    const hasMC = qList.some(q => !q.type || q.type === 'multiple_choice' || q.type === 'true_false' || q.type === 'fill_blank');
    const hasEssay = qList.some(q => q.type === 'essay' || q.section === 4);
    if (hasMC && hasEssay) return 'hybrid';
    if (hasEssay) return 'essay';
    return 'multiple_choice';
  };

  // Open inspection modal
  const handleOpenSubmissionDetail = async (res: ExamResult) => {
    setSelectedResult(res);
    const foundExam = exams.find(e => e.id === res.examId);
    const targetExam: Exam = foundExam || {
      id: res.examId,
      title: 'Bài thi khảo thí',
      subjectId: 'general',
      subjectName: 'Khảo thí',
      grade: '10',
      durationMinutes: 45,
      passScore: 5,
      maxScore: 10,
      questionCount: 20,
      classIds: [res.classId || '10A1'],
      isPublished: true,
      showAnswersAfterExam: true,
      allowReview: true,
      createdBy: 'system',
      createdByName: 'Giáo viên bộ môn',
      createdAt: res.submittedAt
    };
    setModalExam(targetExam);

    // Questions
    let qList = questionsCache[res.examId];
    if (!qList) {
      qList = await getExamQuestions(res.examId);
      setQuestionsCache(prev => ({ ...prev, [res.examId]: qList }));
    }
    setModalQuestions(qList || []);

    // Attempt
    const matchedAttempt = attempts.find(a => 
      a.id === res.attemptId || 
      a.id === res.id || 
      (a.studentId === res.studentId && a.examId === res.examId)
    );
    setModalAttempt(matchedAttempt);
  };

  // Filtered Results
  const filteredSubmissions = useMemo(() => {
    return results.filter(r => {
      // 1. Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = (r.studentName || '').toLowerCase().includes(query);
        const matchesEmail = (r.studentEmail || '').toLowerCase().includes(query);
        const examObj = exams.find(e => e.id === r.examId);
        const matchesExam = (examObj?.title || '').toLowerCase().includes(query);
        if (!matchesName && !matchesEmail && !matchesExam) return false;
      }

      // 2. Exam filter
      if (selectedExamId !== 'all' && r.examId !== selectedExamId) return false;

      // 3. Class filter
      if (selectedClassId !== 'all' && r.classId !== selectedClassId) return false;

      // 4. Status filter
      if (statusFilter === 'pending_essay_grading' && r.status !== 'pending_essay_grading') return false;
      if (statusFilter === 'graded' && r.status === 'pending_essay_grading') return false;

      // 5. Exam format filter
      if (formatFilter !== 'all') {
        const fmt = getExamFormat(r.examId);
        if (fmt !== formatFilter) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'submittedAt_desc') {
        return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
      }
      if (sortBy === 'score_desc') {
        return b.score - a.score;
      }
      if (sortBy === 'score_asc') {
        return a.score - b.score;
      }
      if (sortBy === 'studentName_asc') {
        return (a.studentName || '').localeCompare(b.studentName || '');
      }
      return 0;
    });
  }, [results, searchQuery, selectedExamId, selectedClassId, statusFilter, formatFilter, sortBy, exams, questionsCache]);

  // Overall Statistics Metrics
  const totalSubmissions = results.length;
  const pendingEssayCount = results.filter(r => r.status === 'pending_essay_grading').length;
  const mcCompletedCount = results.filter(r => r.status === 'completed').length;
  const avgScore = totalSubmissions > 0 
    ? Number((results.reduce((acc, r) => acc + r.score, 0) / totalSubmissions).toFixed(2)) 
    : 0;
  const passRate = totalSubmissions > 0
    ? Math.round((results.filter(r => r.score >= 5).length / totalSubmissions) * 100)
    : 0;

  // Export Excel
  const handleExportAllToExcel = () => {
    if (filteredSubmissions.length === 0) {
      alert('Không có bài làm nào để xuất file.');
      return;
    }

    const exportData = filteredSubmissions.map((r, i) => {
      const ex = exams.find(e => e.id === r.examId);
      const qList = questionsCache[r.examId] || [];
      const parts = extractResultPartScores(r, qList);
      return {
        'STT': i + 1,
        'Họ và tên học sinh': r.studentName,
        'Email / Mã định danh': r.studentEmail,
        'Lớp học': r.classId,
        'Tên bài thi': ex?.title || r.examId,
        'Môn học': ex?.subjectName || '--',
        'Khối lớp': ex?.grade || '--',
        'Hình thức thi': getExamFormat(r.examId) === 'hybrid' ? 'Kết hợp (TN + TL)' : getExamFormat(r.examId) === 'essay' ? 'Tự luận' : 'Trắc nghiệm',
        'Điểm Phần I (Trắc nghiệm)': parts.part1,
        'Điểm Phần II (Đúng/Sai)': parts.part2,
        'Điểm Phần III (Trả lời ngắn)': parts.part3,
        'Điểm Phần IV (Tự luận)': parts.part4,
        'Tổng điểm': r.score,
        'Thang điểm': r.maxScore || 10,
        'Số câu đúng': r.correctCount,
        'Số câu sai': r.wrongCount,
        'Trạng thái tự luận': r.status === 'pending_essay_grading' ? 'Chờ chấm tự luận' : 'Đã chấm đầy đủ',
        'Thời gian nộp bài': new Date(r.submittedAt).toLocaleString('vi-VN'),
        'Đánh giá': r.score >= 5 ? 'Đạt yêu cầu' : 'Chưa đạt'
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BaiLamHocSinh');
    XLSX.writeFile(wb, `DanhSachBaiLam_HocSinh_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 leading-tight">
                Quản lý Bài làm Học sinh
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Tra cứu bài làm trắc nghiệm & tự luận, chấm điểm, ghi nhận xét và theo dõi tiến độ nộp bài.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={fetchData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            title="Tải lại danh sách bài làm mới nhất"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Đang cập nhật...' : 'Làm mới'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportAllToExcel}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Xuất danh sách bài thi và điểm số ra file Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Xuất Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Overview Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Tổng đề thi đã giao */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Đề thi đã giao</span>
            <BookOpen className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{exams.length}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Đề thi trong hệ thống</p>
        </div>

        {/* Card 2: Số bài thi đã nộp */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Bài thi đã nộp</span>
            <Users className="w-4 h-4 text-teal-500" />
          </div>
          <p className="text-2xl font-black text-teal-600">{totalSubmissions}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Lượt nộp của học sinh</p>
        </div>

        {/* Card 3: Tự luận chờ chấm */}
        <div 
          onClick={() => setStatusFilter(prev => prev === 'pending_essay_grading' ? 'all' : 'pending_essay_grading')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'pending_essay_grading'
              ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-300 shadow-xs'
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
          title="Bấm để lọc các bài đang chờ chấm tự luận"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-amber-800 uppercase">Tự luận chờ chấm</span>
            <PenTool className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-600">{pendingEssayCount}</p>
          <p className="text-[11px] text-amber-800 font-medium mt-0.5">
            {pendingEssayCount > 0 ? 'Cần giáo viên/AI chấm' : 'Đã chấm đầy đủ'}
          </p>
        </div>

        {/* Card 4: Điểm trung bình */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Điểm trung bình</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600">
            {avgScore} <span className="text-xs font-normal text-slate-400">/ 10</span>
          </p>
          <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">Tỷ lệ đạt: {passRate}%</p>
        </div>

        {/* Card 5: Bài trắc nghiệm hoàn thành */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Đã chấm xong</span>
            <CheckCircle2 className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900">{totalSubmissions - pendingEssayCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Đã hoàn tất điểm số</p>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search box */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Tìm theo tên học sinh, email hoặc tên đề thi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          {/* Filter by Exam */}
          <div>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Tất cả đề thi ({exams.length})</option>
              {exams.map(ex => (
                <option key={ex.id} value={ex.id}>
                  {ex.title} (Khối {ex.grade})
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Class */}
          <div>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Tất cả lớp học ({classes.length})</option>
              {classes.map(c => (
                <option key={c.id || c.name} value={c.name}>
                  Lớp {c.name} {c.grade ? `(Khối ${c.grade})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Exam Format */}
          <div>
            <select
              value={formatFilter}
              onChange={(e) => setFormatFilter(e.target.value as any)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Tất cả hình thức thi</option>
              <option value="multiple_choice">Chỉ Trắc nghiệm</option>
              <option value="essay">Chỉ Tự luận</option>
              <option value="hybrid">Kết hợp (Trắc nghiệm + Tự luận)</option>
            </select>
          </div>
        </div>

        {/* Secondary Filter Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Trạng thái chấm:</span>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả ({results.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending_essay_grading')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1 ${
                statusFilter === 'pending_essay_grading'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <span>Chờ chấm tự luận</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-200 text-amber-950 font-black">
                {pendingEssayCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('graded')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                statusFilter === 'graded'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              Đã chấm đầy đủ ({totalSubmissions - pendingEssayCount})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] font-bold text-slate-400 uppercase">Sắp xếp:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1 bg-white font-medium text-slate-700"
            >
              <option value="submittedAt_desc">Mới nộp nhất</option>
              <option value="score_desc">Điểm từ cao xuống thấp</option>
              <option value="score_asc">Điểm từ thấp đến cao</option>
              <option value="studentName_asc">Tên học sinh (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Guide Banner */}
      <div className="p-4 bg-indigo-50/80 border border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-indigo-950">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900">
              Tra cứu bài làm học sinh: Bấm nút <span className="text-indigo-700 underline font-black">"Xem bài làm đầy đủ"</span> hoặc bấm thẳng vào hàng bài thi.
            </p>
            <p className="text-[11px] text-slate-600">
              Cửa sổ chi tiết hiển thị <strong>đầy đủ cả trắc nghiệm</strong> (lựa chọn học sinh, đúng/sai, đáp án chuẩn) và <strong>toàn văn bài tự luận</strong> kèm công cụ nhập điểm và phản hồi.
            </p>
          </div>
        </div>
        <span className="text-xs font-bold text-indigo-700 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 w-fit shrink-0 shadow-2xs">
          Hiển thị {filteredSubmissions.length} bài làm
        </span>
      </div>

      {/* Submissions Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">STT</th>
                <th className="py-3.5 px-4">Học sinh</th>
                <th className="py-3.5 px-3">Lớp</th>
                <th className="py-3.5 px-4">Đề thi</th>
                <th className="py-3.5 px-3 text-center">Hình thức</th>
                <th className="py-3.5 px-3 text-center">Trắc nghiệm</th>
                <th className="py-3.5 px-3 text-center">Tự luận</th>
                <th className="py-3.5 px-4 text-center bg-indigo-50/70 text-indigo-950 font-bold">Tổng điểm</th>
                <th className="py-3.5 px-3">Thời gian nộp bài</th>
                <th className="py-3.5 px-3 text-center">Đánh giá</th>
                <th className="py-3.5 px-4 text-right">Chi tiết bài làm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSubmissions.length > 0 ? (
                filteredSubmissions.map((r, i) => {
                  const ex = exams.find(e => e.id === r.examId);
                  const format = getExamFormat(r.examId);
                  const passed = r.score >= (ex?.passScore || 5);
                  const qList = questionsCache[r.examId] || [];
                  const parts = extractResultPartScores(r, qList);

                  return (
                    <tr 
                      key={r.id || i}
                      onClick={() => handleOpenSubmissionDetail(r)}
                      className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-400">
                        {i + 1}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <span className="group-hover:text-indigo-600 transition-colors font-bold text-sm block">
                          {r.studentName}
                        </span>
                        <span className="text-[11px] text-slate-400 font-normal">
                          {r.studentEmail}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold">
                          {r.classId || '10A1'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-800 line-clamp-1">
                          {ex?.title || r.examId}
                        </span>
                        <span className="text-[11px] text-slate-400 font-normal block">
                          Môn {ex?.subjectName || 'Khảo thí'} • Khối {ex?.grade || '--'}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          format === 'hybrid'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : format === 'essay'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {format === 'hybrid' ? 'Kết hợp' : format === 'essay' ? 'Tự luận' : 'Trắc nghiệm'}
                        </span>
                      </td>
                      {/* Multiple Choice Component */}
                      <td className="py-3.5 px-3 text-center font-bold text-slate-700">
                        {parts.part1 + parts.part2 + parts.part3 > 0 ? (
                          <div>
                            <span className="text-slate-800">
                              {(parts.part1 + parts.part2 + parts.part3).toFixed(1)}đ
                            </span>
                            <span className="text-[10px] text-slate-400 block font-normal">
                              ({r.correctCount} câu đúng)
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-300">--</span>
                        )}
                      </td>
                      {/* Essay Component */}
                      <td className="py-3.5 px-3 text-center font-bold">
                        {r.hasEssayGraded || (r.essayScore !== undefined && r.essayScore > 0) ? (
                          <div>
                            <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-800 border border-purple-200">
                              +{r.essayScore}đ
                            </span>
                            <span className="text-[9px] text-purple-600 block mt-0.5">
                              {r.isAiGraded ? '🤖 AI chấm' : '🧑‍🏫 GV chấm'}
                            </span>
                          </div>
                        ) : r.status === 'pending_essay_grading' ? (
                          <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-300 text-[10px] animate-pulse">
                            Chờ chấm
                          </span>
                        ) : (
                          <span className="text-slate-300">--</span>
                        )}
                      </td>
                      {/* Total Score */}
                      <td className="py-3.5 px-4 text-center bg-indigo-50/40 font-extrabold text-sm text-slate-900">
                        <span className="text-indigo-900 font-black text-base">{r.score}</span>
                        <span className="text-[10px] text-slate-400 font-normal"> / {r.maxScore || 10}</span>
                      </td>
                      {/* Submitted Time */}
                      <td className="py-3.5 px-3 text-slate-500 text-[11px]">
                        {new Date(r.submittedAt).toLocaleString('vi-VN')}
                      </td>
                      {/* Pass / Fail */}
                      <td className="py-3.5 px-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {passed ? 'Đạt' : 'Chưa đạt'}
                        </span>
                      </td>
                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenSubmissionDetail(r);
                            }}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs transition-all ${
                              r.status === 'pending_essay_grading'
                                ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            }`}
                            title="Mở toàn bộ bài thi của học sinh gồm trắc nghiệm và tự luận"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>{r.status === 'pending_essay_grading' ? 'Chấm tự luận' : 'Xem chi tiết'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setResultToDelete(r);
                            }}
                            className="p-1.5 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer"
                            title="Xóa bài nộp này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-slate-400">
                    <p className="font-semibold text-sm">Chưa có bài nộp nào phù hợp với điều kiện tìm kiếm.</p>
                    <p className="text-xs text-slate-400 mt-1">Hãy thử xóa từ khóa tìm kiếm hoặc chọn "Tất cả đề thi".</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Safe Delete Confirmation Modal */}
      {resultToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-slate-900 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-slate-900">Xác Nhận Xóa Bài Làm</h3>
              <p className="text-xs text-slate-500">
                Bạn có chắc chắn muốn xóa bài nộp này không? Hành động này sẽ xóa điểm số và dữ liệu bài thi vĩnh viễn khỏi hệ thống.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
              <div>Học sinh: <strong className="text-slate-800">{resultToDelete.studentName}</strong> ({resultToDelete.studentEmail})</div>
              <div>Lớp: <strong className="text-slate-800">{resultToDelete.classId || '10A1'}</strong></div>
              <div>Điểm số: <strong className="text-rose-600">{resultToDelete.score} / {resultToDelete.maxScore || 10}đ</strong></div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResultToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await deleteExamResult(resultToDelete.id);
                    setResultToDelete(null);
                    fetchData();
                  } catch (err) {
                    console.error('Lỗi xóa bài làm:', err);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {isDeleting ? 'Đang xóa...' : 'Xác nhận Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspection & Grading Modal */}
      {selectedResult && modalExam && (
        <StudentGradingDetailModal
          isOpen={!!selectedResult}
          onClose={() => setSelectedResult(null)}
          exam={modalExam}
          questions={modalQuestions}
          result={selectedResult}
          attempt={modalAttempt}
          onGradedSuccess={fetchData}
        />
      )}
    </div>
  );
};
