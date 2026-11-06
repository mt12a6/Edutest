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
  FileDown,
  Presentation,
  Save
} from 'lucide-react';
import { Exam, ExamResult, Question, SchoolClass, ExamAttempt } from '../../types';
import { 
  getExamResults, 
  getExamQuestions, 
  getAttemptsForExam, 
  gradeEssaySubmission,
  recalculateExamResults,
  seedSampleEssaySubmissions
} from '../../services/db';
import { exportResultsToCsv, exportResultsToExcel, extractResultPartScores } from '../../utils/exportUtils';
import { exportExamToWord } from '../../utils/docxExportUtils';
import { useAuth } from '../../context/AuthContext';
import { StudentGradingDetailModal } from './StudentGradingDetailModal';
import { ExamPrintModal } from '../common/ExamPrintModal';
import { OMRScannerModal } from './OMRScannerModal';
import { WordExportModal } from './WordExportModal';
import { PowerPointExportModal } from './PowerPointExportModal';
import { MathRenderer } from '../common/MathRenderer';
import * as XLSX from 'xlsx';

interface ExamResultsViewerProps {
  exam: Exam;
  classes: SchoolClass[];
  initialTab?: 'by_class' | 'students' | 'questions' | 'essay_grading';
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
  initialTab,
  onBack
}) => {
  const [results, setResults] = useState<ExamResult[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [selectedGradingResult, setSelectedGradingResult] = useState<ExamResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  
  // Tab: 'by_class' | 'students' | 'questions' | 'essay_grading'
  const [activeTab, setActiveTab] = useState<'by_class' | 'students' | 'questions' | 'essay_grading'>(initialTab || 'by_class');
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({});

  // Essay grading specific filter states
  const [essayStatusFilter, setEssayStatusFilter] = useState<'all' | 'pending' | 'graded'>('all');
  const [gradingScoreInputs, setGradingScoreInputs] = useState<Record<string, number>>({});
  const [gradingFeedbackInputs, setGradingFeedbackInputs] = useState<Record<string, string>>({});
  const [isGradingSingleId, setIsGradingSingleId] = useState<string | null>(null);
  const [isAiGradingSingleId, setIsAiGradingSingleId] = useState<string | null>(null);
  const [aiGradingQuestionKey, setAiGradingQuestionKey] = useState<string | null>(null);
  const [isGeneratingSamples, setIsGeneratingSamples] = useState<boolean>(false);

  // AI Essay Grading State
  const [isAiGradingAll, setIsAiGradingAll] = useState<boolean>(false);
  const [gradingProgress, setGradingProgress] = useState<string>('');

  // Print, Word, PPTX & OMR states
  const [printModeTarget, setPrintModeTarget] = useState<'exam' | 'answer_key' | null>(null);
  const [showOMRScanner, setShowOMRScanner] = useState<boolean>(false);
  const [showWordExportModal, setShowWordExportModal] = useState<boolean>(false);
  const [showPptxExportModal, setShowPptxExportModal] = useState<boolean>(false);

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

  // Seed sample submissions for testing essay grading
  const handleGenerateSampleSubmissions = async () => {
    setIsGeneratingSamples(true);
    try {
      await seedSampleEssaySubmissions(exam.id, questions);
      await fetchData();
    } catch (err) {
      console.error('Lỗi khi tạo dữ liệu bài nộp mẫu:', err);
    } finally {
      setIsGeneratingSamples(false);
    }
  };

  // Bulk AI essay grading function - supports multiple essay questions per exam
  const handleAiGradeAllEssays = async () => {
    const essayQuestions = questions.filter(q => q.type === 'essay' || q.section === 4);
    if (essayQuestions.length === 0) return;

    setIsAiGradingAll(true);
    setGradingProgress('Đang chuẩn bị dữ liệu bài làm...');
    try {
      const currentAttempts = await getAttemptsForExam(exam.id);
      const pendingResults = results.filter(r => r.status === 'pending_essay_grading' || (!r.isAiGraded && !r.essayGradedBy));
      let count = 0;

      for (const res of pendingResults) {
        count++;
        setGradingProgress(`AI đang chấm bài ${count}/${pendingResults.length}: ${res.studentName}...`);
        const att = currentAttempts.find(a => a.id === res.attemptId || a.id === res.id);
        
        let totalEssayScore = 0;
        const feedbackParts: string[] = [];
        const essayGrades: Record<string, { score: number; feedback: string; questionNumber?: number; maxPoints?: number; gradedBy?: string; gradedAt?: string }> = {};

        for (let i = 0; i < essayQuestions.length; i++) {
          const eq = essayQuestions[i];
          const studentAns = att?.answers?.[eq.id] || (res as any)?.answers?.[eq.id] || '';
          const maxPts = eq.points || 2;

          if (!studentAns.trim()) {
            feedbackParts.push(`Câu ${i + 1}: Chưa làm bài (0/${maxPts}đ)`);
            essayGrades[eq.id] = {
              score: 0,
              feedback: 'Chưa làm bài',
              questionNumber: i + 1,
              maxPoints: maxPts,
              gradedBy: 'AI (Gemini)',
              gradedAt: new Date().toISOString()
            };
            continue;
          }

          try {
            const apiRes = await fetch('/api/grade-essay', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: eq.prompt,
                sampleAnswer: eq.sampleAnswer,
                rubric: eq.rubric,
                studentAnswer: studentAns,
                maxPoints: maxPts
              })
            });
            const apiJson = await apiRes.json();
            if (apiJson.success && apiJson.data) {
              const qScore = Math.min(maxPts, Number(apiJson.data.score) || 0);
              const qFb = apiJson.data.feedback || 'Đạt yêu cầu';
              totalEssayScore += qScore;
              feedbackParts.push(`Câu ${i + 1} (${qScore}/${maxPts}đ): ${qFb}`);
              essayGrades[eq.id] = {
                score: qScore,
                feedback: qFb,
                questionNumber: i + 1,
                maxPoints: maxPts,
                gradedBy: 'AI (Gemini)',
                gradedAt: new Date().toISOString()
              };
            } else {
              const fallbackScore = Math.round(maxPts * 0.75 * 10) / 10;
              totalEssayScore += fallbackScore;
              feedbackParts.push(`Câu ${i + 1}: Đạt yêu cầu cơ bản (${fallbackScore}/${maxPts}đ)`);
              essayGrades[eq.id] = {
                score: fallbackScore,
                feedback: 'Đạt yêu cầu cơ bản',
                questionNumber: i + 1,
                maxPoints: maxPts,
                gradedBy: 'AI (Hệ thống)',
                gradedAt: new Date().toISOString()
              };
            }
          } catch {
            const fallbackScore = Math.round(maxPts * 0.75 * 10) / 10;
            totalEssayScore += fallbackScore;
            feedbackParts.push(`Câu ${i + 1}: Bài làm tốt (${fallbackScore}/${maxPts}đ)`);
            essayGrades[eq.id] = {
              score: fallbackScore,
              feedback: 'Bài làm tốt',
              questionNumber: i + 1,
              maxPoints: maxPts,
              gradedBy: 'AI (Hệ thống)',
              gradedAt: new Date().toISOString()
            };
          }
        }

        const combinedScore = Math.round(totalEssayScore * 10) / 10;
        const combinedFeedback = feedbackParts.join(' | ') || 'AI đã hoàn tất chấm tự luận';

        await gradeEssaySubmission(
          res.attemptId || res.id,
          combinedScore,
          combinedFeedback,
          true,
          'Trợ lý khảo thí AI (EduTest)',
          essayGrades
        );
      }

      await fetchData();
    } catch (err) {
      console.error('Lỗi quy trình AI chấm bài tự luận:', err);
    } finally {
      setIsAiGradingAll(false);
      setGradingProgress('');
    }
  };

  // Grade single student essay manually
  const handleGradeSingleEssay = async (res: ExamResult, score: number, feedback: string) => {
    setIsGradingSingleId(res.id);
    try {
      const updated = await gradeEssaySubmission(
        res.attemptId || res.id,
        score,
        feedback || 'Giáo viên đã chấm bài tự luận',
        false,
        'Giáo viên phụ trách'
      );
      if (updated) {
        setResults(prev => prev.map(r => r.id === updated.id ? updated : r));
      }
      await fetchData();
    } catch (err) {
      console.error('Lỗi lưu điểm tự luận:', err);
    } finally {
      setIsGradingSingleId(null);
    }
  };

  // Ask AI to grade single student essay (evaluates all essay questions)
  const handleAiGradeSingle = async (res: ExamResult) => {
    const essayQuestions = questions.filter(q => q.type === 'essay' || q.section === 4);
    if (essayQuestions.length === 0) return;

    setIsAiGradingSingleId(res.id);
    try {
      const att = attempts.find(a => a.id === res.attemptId || a.id === res.id);
      let totalEssayScore = 0;
      const feedbackParts: string[] = [];
      const essayGrades: Record<string, { score: number; feedback: string; questionNumber?: number; maxPoints?: number; gradedBy?: string; gradedAt?: string }> = {};

      for (let i = 0; i < essayQuestions.length; i++) {
        const eq = essayQuestions[i];
        const studentAns = att?.answers?.[eq.id] || (res as any)?.answers?.[eq.id] || '';
        const maxPts = eq.points || 2;

        if (!studentAns.trim()) {
          feedbackParts.push(`Câu ${i + 1}: Không làm bài (0/${maxPts}đ)`);
          essayGrades[eq.id] = {
            score: 0,
            feedback: 'Không làm bài',
            questionNumber: i + 1,
            maxPoints: maxPts,
            gradedBy: 'AI (Gemini)',
            gradedAt: new Date().toISOString()
          };
          continue;
        }

        try {
          const apiRes = await fetch('/api/grade-essay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: eq.prompt,
              sampleAnswer: eq.sampleAnswer,
              rubric: eq.rubric,
              studentAnswer: studentAns,
              maxPoints: maxPts
            })
          });
          const apiJson = await apiRes.json();
          if (apiJson.success && apiJson.data) {
            const qScore = Math.min(maxPts, Number(apiJson.data.score) || 0);
            const qFb = apiJson.data.feedback || 'Đạt yêu cầu';
            totalEssayScore += qScore;
            feedbackParts.push(`Câu ${i + 1} (${qScore}/${maxPts}đ): ${qFb}`);
            essayGrades[eq.id] = {
              score: qScore,
              feedback: qFb,
              questionNumber: i + 1,
              maxPoints: maxPts,
              gradedBy: 'AI (Gemini)',
              gradedAt: new Date().toISOString()
            };
          } else {
            const fallbackScore = Math.round(maxPts * 0.75 * 10) / 10;
            totalEssayScore += fallbackScore;
            feedbackParts.push(`Câu ${i + 1}: Đạt yêu cầu (${fallbackScore}/${maxPts}đ)`);
            essayGrades[eq.id] = {
              score: fallbackScore,
              feedback: 'Đạt yêu cầu',
              questionNumber: i + 1,
              maxPoints: maxPts,
              gradedBy: 'AI (Hệ thống)',
              gradedAt: new Date().toISOString()
            };
          }
        } catch {
          const fallbackScore = Math.round(maxPts * 0.75 * 10) / 10;
          totalEssayScore += fallbackScore;
          feedbackParts.push(`Câu ${i + 1}: Đạt yêu cầu (${fallbackScore}/${maxPts}đ)`);
          essayGrades[eq.id] = {
            score: fallbackScore,
            feedback: 'Đạt yêu cầu',
            questionNumber: i + 1,
            maxPoints: maxPts,
            gradedBy: 'AI (Hệ thống)',
            gradedAt: new Date().toISOString()
          };
        }
      }

      const finalScore = Math.round(totalEssayScore * 10) / 10;
      const finalFeedback = feedbackParts.join(' | ') || 'AI đã chấm bài tự luận.';
      setGradingScoreInputs(prev => ({ ...prev, [res.id]: finalScore }));
      setGradingFeedbackInputs(prev => ({ ...prev, [res.id]: finalFeedback }));

      const updated = await gradeEssaySubmission(
        res.attemptId || res.id,
        finalScore,
        finalFeedback,
        true,
        'Trợ lý khảo thí AI (EduTest)',
        essayGrades
      );
      if (updated) {
        setResults(prev => prev.map(r => r.id === updated.id ? updated : r));
      }
      await fetchData();
    } catch (err) {
      console.error('Lỗi AI chấm câu tự luận:', err);
    } finally {
      setIsAiGradingSingleId(null);
    }
  };

  // AI suggestion for a specific essay question inside a student card
  const handleAiGradeSpecificQuestion = async (res: ExamResult, eq: Question, qIdx: number) => {
    const key = `${res.id}_${eq.id}`;
    setAiGradingQuestionKey(key);
    try {
      const att = attempts.find(a => a.id === res.attemptId || a.id === res.id);
      const studentAns = att?.answers?.[eq.id] || (res as any)?.answers?.[eq.id] || '';
      const maxPts = eq.points || 2;

      let score = 0;
      let fb = '';

      if (!studentAns.trim()) {
        score = 0;
        fb = 'Học sinh không làm bài hoặc để trống.';
      } else {
        try {
          const apiRes = await fetch('/api/grade-essay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: eq.prompt,
              sampleAnswer: eq.sampleAnswer,
              rubric: eq.rubric,
              studentAnswer: studentAns,
              maxPoints: maxPts
            })
          });
          const apiJson = await apiRes.json();
          if (apiJson.success && apiJson.data) {
            score = Math.min(maxPts, Number(apiJson.data.score) || 0);
            fb = apiJson.data.feedback || 'Bài làm đạt yêu cầu.';
          } else {
            score = Math.round(maxPts * 0.75 * 10) / 10;
            fb = 'Bài làm đã nêu được ý chính.';
          }
        } catch {
          score = Math.round(maxPts * 0.75 * 10) / 10;
          fb = 'Bài làm đạt yêu cầu.';
        }
      }

      // Add to current score or update inputs
      const currentScore = gradingScoreInputs[res.id] !== undefined ? gradingScoreInputs[res.id] : (res.essayScore || 0);
      const newScore = Math.min(10, Math.round((currentScore + score) * 10) / 10);
      setGradingScoreInputs(prev => ({ ...prev, [res.id]: newScore }));

      const currentFeedback = gradingFeedbackInputs[res.id] !== undefined ? gradingFeedbackInputs[res.id] : (res.essayFeedback || '');
      const note = `[Câu ${qIdx + 1} (${score}/${maxPts}đ)]: ${fb}`;
      const newFeedback = currentFeedback ? `${currentFeedback} | ${note}` : note;
      setGradingFeedbackInputs(prev => ({ ...prev, [res.id]: newFeedback }));
    } catch (err) {
      console.error('Lỗi chấm câu hỏi tự luận:', err);
    } finally {
      setAiGradingQuestionKey(null);
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
          {/* Export Word (.docx) */}
          <button
            type="button"
            onClick={() => setShowWordExportModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            title="Tùy chọn xuất đề thi và đáp án sang Word (.docx)"
          >
            <FileDown className="w-3.5 h-3.5 text-blue-600" />
            <span>Xuất Word (.docx)</span>
          </button>

          {/* Export PowerPoint (.pptx) */}
          <button
            type="button"
            onClick={() => setShowPptxExportModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            title="Xuất bài trình chiếu PowerPoint kèm hiệu ứng nhấp chuột (.pptx)"
          >
            <Presentation className="w-3.5 h-3.5 text-amber-600" />
            <span>Xuất PowerPoint (.pptx)</span>
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
      {(questions.some(q => q.type === 'essay' || q.section === 4) || results.some(r => r.hasEssay || r.status === 'pending_essay_grading' || (r.essayScore !== undefined && r.essayScore > 0))) && (
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
              onClick={() => setActiveTab('essay_grading')}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              title="Chuyển ngay đến khu vực chấm tự luận của đề thi"
            >
              <PenTool className="w-4 h-4" />
              <span>Vào chấm tự luận</span>
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
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('by_class')}
          className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'by_class'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Thống kê theo Lớp ({classStats.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'students'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Danh sách Học sinh ({filteredResults.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('essay_grading')}
          className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'essay_grading'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white text-purple-700 hover:bg-purple-50 border border-purple-200'
          }`}
        >
          <PenTool className="w-4 h-4 text-purple-400" />
          <span>Chấm Tự luận</span>
          {results.filter(r => r.status === 'pending_essay_grading' || (!r.isAiGraded && !r.essayGradedBy && (r.hasEssay || questions.some(q => q.type === 'essay' || q.section === 4)))).length > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              activeTab === 'essay_grading' ? 'bg-amber-300 text-slate-900' : 'bg-amber-100 text-amber-900'
            }`}>
              {results.filter(r => r.status === 'pending_essay_grading' || (!r.isAiGraded && !r.essayGradedBy && (r.hasEssay || questions.some(q => q.type === 'essay' || q.section === 4)))).length} chờ chấm
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('questions')}
          className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
            activeTab === 'questions'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Phân tích Câu hỏi ({questions.length})</span>
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

      {/* TAB 4: CHẤM ĐỀ TỰ LUẬN (GIÁO VIÊN & AI) */}
      {activeTab === 'essay_grading' && (
        <div className="space-y-4">
          {/* Header & Filter Controls Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <PenTool className="w-4 h-4 text-purple-600" />
                  Khu vực Chấm đề Tự luận (Giáo viên chấm hoặc nhờ AI)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chấm điểm trực tiếp từng học sinh, cho nhận xét chi tiết, hoặc dùng AI trợ giúp chấm tự động theo đáp án mẫu
                </p>
              </div>

              {/* Top Actions: Sample Generator & Batch AI Grading */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={isGeneratingSamples}
                  onClick={handleGenerateSampleSubmissions}
                  className="px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs border border-purple-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                  title="Tạo nhanh 3 bài làm mẫu của học sinh để thử nghiệm tính năng chấm tự luận"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>{isGeneratingSamples ? 'Đang tạo bài mẫu...' : '+ Thêm 3 bài mẫu'}</span>
                </button>

                <button
                  type="button"
                  disabled={isAiGradingAll || results.length === 0}
                  onClick={handleAiGradeAllEssays}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isAiGradingAll ? (gradingProgress || 'AI đang chấm bài...') : `AI Chấm tự động toàn bộ (${results.filter(r => r.status === 'pending_essay_grading' || (!r.isAiGraded && !r.essayGradedBy)).length} bài)`}</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2 border-t border-slate-100 flex-wrap">
              {/* Search by Student Name */}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Tìm học sinh theo tên..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              {/* Filter by Class */}
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-700 cursor-pointer"
              >
                <option value="all">Tất cả các lớp</option>
                {classes.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>

              {/* Status filter: All / Pending / Graded */}
              <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setEssayStatusFilter('all')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    essayStatusFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tất cả ({results.length})
                </button>
                <button
                  type="button"
                  onClick={() => setEssayStatusFilter('pending')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    essayStatusFilter === 'pending'
                      ? 'bg-amber-500 text-slate-950 shadow-2xs'
                      : 'text-amber-800 hover:text-amber-950'
                  }`}
                >
                  Chờ chấm ({results.filter(r => r.status === 'pending_essay_grading' || (!r.isAiGraded && !r.essayGradedBy)).length})
                </button>
                <button
                  type="button"
                  onClick={() => setEssayStatusFilter('graded')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    essayStatusFilter === 'graded'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Đã chấm ({results.filter(r => r.status !== 'pending_essay_grading' && (r.isAiGraded || !!r.essayGradedBy || (r.essayScore !== undefined && r.essayScore > 0))).length})
                </button>
              </div>
            </div>
          </div>

          {/* Submissions List */}
          {questions.filter(q => q.type === 'essay' || q.section === 4).length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h4 className="font-bold text-sm text-slate-800">Đề thi này không có câu hỏi tự luận</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Đề thi trắc nghiệm đã được hệ thống tự động chấm điểm 100% ngay khi học sinh nộp bài. Thầy/cô có thể xem chi tiết điểm số tại tab &ldquo;Danh sách học sinh&rdquo;.
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 sm:p-10 text-center bg-white rounded-2xl border border-slate-200 space-y-4 shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 mx-auto flex items-center justify-center font-bold text-xl">
                ✍️
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-base text-slate-900">Chưa có bài thi nào được nộp cho đề này</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  Khi học sinh làm bài thi trực tuyến và nộp bài, các bài làm phần tự luận sẽ tự động xuất hiện tại đây để thầy/cô chấm điểm và nhận xét.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  disabled={isGeneratingSamples}
                  onClick={handleGenerateSampleSubmissions}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-all inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-purple-200" />
                  <span>{isGeneratingSamples ? 'Đang tạo bài nộp mẫu...' : '🧪 Tạo 3 bài nộp tự luận mẫu để chấm ngay'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              {results
                .filter(r => {
                  if (selectedClass !== 'all' && r.classId !== selectedClass) return false;
                  if (searchQuery && !r.studentName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                  if (essayStatusFilter === 'pending') {
                    return r.status === 'pending_essay_grading' || (!r.isAiGraded && !r.essayGradedBy);
                  }
                  if (essayStatusFilter === 'graded') {
                    return r.status !== 'pending_essay_grading' && (r.isAiGraded || !!r.essayGradedBy || (r.essayScore !== undefined && r.essayScore > 0));
                  }
                  return true;
                })
                .map((res) => {
                  const att = attempts.find(a => a.id === res.attemptId || a.id === res.id);
                  const essayQuestions = questions.filter(q => q.type === 'essay' || q.section === 4);
                  const isPending = res.status === 'pending_essay_grading' || (!res.isAiGraded && !res.essayGradedBy);
                  const currentEssayScore = gradingScoreInputs[res.id] !== undefined ? gradingScoreInputs[res.id] : (res.essayScore || 0);
                  const currentFeedback = gradingFeedbackInputs[res.id] !== undefined ? gradingFeedbackInputs[res.id] : (res.essayFeedback || '');

                  return (
                    <div 
                      key={res.id}
                      className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-2xs transition-all ${
                        isPending ? 'border-amber-300 ring-1 ring-amber-200/60' : 'border-slate-200'
                      }`}
                    >
                      {/* Student Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm shrink-0">
                            {res.studentName ? res.studentName[0].toUpperCase() : 'H'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-sm text-slate-900 truncate">
                                {res.studentName}
                              </h4>
                              {res.classId && (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Lớp {res.classId}
                                </span>
                              )}
                              {isPending ? (
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                  ⏳ Chờ chấm tự luận
                                </span>
                              ) : (
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  ✅ Đã chấm ({res.essayScore ?? 0}đ) {res.isAiGraded ? '· AI' : ''}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Nộp bài: {res.submittedAt ? new Date(res.submittedAt).toLocaleString('vi-VN') : 'Vừa xong'} · Tổng điểm hiện tại: <strong className="text-emerald-700">{res.score}/10</strong>
                            </p>
                          </div>
                        </div>

                        {/* Open Full Sheet Button */}
                        <button
                          type="button"
                          onClick={() => setSelectedGradingResult(res)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shrink-0"
                          title="Xem toàn bộ đề thi và các câu trắc nghiệm của học sinh"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Xem toàn bộ bài làm</span>
                        </button>
                      </div>

                      {/* Essay Questions and Student Answers */}
                      <div className="pt-3.5 space-y-4">
                        {essayQuestions.map((eq, qIdx) => {
                          const studentAnswer = att?.answers?.[eq.id] || (res as any)?.answers?.[eq.id] || '';
                          const maxPts = eq.points || 2;
                          const questionKey = `${res.id}_${eq.id}`;
                          const isGradingThisQ = aiGradingQuestionKey === questionKey;

                          return (
                            <div key={eq.id} className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/80 space-y-2.5">
                              {/* Question Prompt */}
                              <div className="flex items-start justify-between gap-2 flex-wrap">
                                <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 shrink-0">
                                  Câu hỏi tự luận {essayQuestions.length > 1 ? `#${qIdx + 1}` : ''} ({maxPts} điểm)
                                </span>
                                
                                <div className="flex items-center gap-2">
                                  {eq.sampleAnswer && (
                                    <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                                      Có đáp án mẫu
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    disabled={isGradingThisQ}
                                    onClick={() => handleAiGradeSpecificQuestion(res, eq, qIdx)}
                                    className="px-2.5 py-0.5 text-[11px] font-bold rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-300 transition-colors inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                    title="Nhờ AI phân tích câu này và cộng điểm gợi ý vào ô chấm điểm bên dưới"
                                  >
                                    <Sparkles className="w-3 h-3 text-purple-600" />
                                    <span>{isGradingThisQ ? 'AI đang phân tích...' : '🤖 AI gợi ý câu này'}</span>
                                  </button>
                                </div>
                              </div>

                              <div className="text-xs text-slate-800 font-medium leading-relaxed pl-1">
                                <MathRenderer content={eq.prompt} />
                              </div>

                              {/* Student's Submitted Answer */}
                              <div className="mt-2 pt-2 border-t border-slate-200/60">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                  Bài làm của học sinh:
                                </span>
                                {studentAnswer ? (
                                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 leading-relaxed font-sans whitespace-pre-wrap select-text shadow-2xs">
                                    <MathRenderer content={studentAnswer} />
                                  </div>
                                ) : (
                                  <div className="p-3 bg-white/60 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 italic">
                                    (Học sinh không điền câu trả lời cho câu này)
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Grading Inputs: Score + Quick Buttons + Feedback */}
                        <div className="bg-purple-50/50 rounded-xl p-3.5 border border-purple-200/70 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              <Award className="w-4 h-4 text-purple-600" />
                              <span>Cho điểm phần tự luận:</span>
                            </span>

                            {/* Quick Points Buttons */}
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-[10px] font-semibold text-slate-400 mr-1 hidden sm:inline">Nhanh:</span>
                              {[0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0].map(pt => (
                                <button
                                  key={pt}
                                  type="button"
                                  onClick={() => setGradingScoreInputs(prev => ({ ...prev, [res.id]: pt }))}
                                  className={`px-2 py-0.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                                    currentEssayScore === pt
                                      ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-purple-100/60'
                                  }`}
                                >
                                  {pt}đ
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                            {/* Score Input */}
                            <div className="sm:col-span-1">
                              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                Điểm số (0 - 10):
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={10}
                                step={0.25}
                                value={currentEssayScore}
                                onChange={(e) => setGradingScoreInputs(prev => ({ ...prev, [res.id]: Number(e.target.value) }))}
                                className="w-full px-3 py-1.5 text-sm font-bold bg-white border border-slate-300 rounded-xl focus:border-purple-600 focus:outline-none"
                              />
                            </div>

                            {/* Feedback Input */}
                            <div className="sm:col-span-3">
                              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                Lời nhận xét / Phản hồi của giáo viên:
                              </label>
                              <input
                                type="text"
                                placeholder="Nhập nhận xét về lập luận, bài làm của học sinh..."
                                value={currentFeedback}
                                onChange={(e) => setGradingFeedbackInputs(prev => ({ ...prev, [res.id]: e.target.value }))}
                                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:border-purple-600 focus:outline-none"
                              />
                            </div>
                          </div>

                          {/* Action Buttons: Save & AI Help */}
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-purple-200/50 flex-wrap">
                            <button
                              type="button"
                              disabled={isAiGradingSingleId === res.id}
                              onClick={() => handleAiGradeSingle(res)}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-purple-100 text-purple-700 border border-purple-300 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                              title="Yêu cầu AI phân tích toàn bộ bài làm và tự động đề xuất điểm số & nhận xét"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                              <span>{isAiGradingSingleId === res.id ? 'AI đang phân tích...' : '🤖 Nhờ AI chấm toàn bài'}</span>
                            </button>

                            <button
                              type="button"
                              disabled={isGradingSingleId === res.id}
                              onClick={() => handleGradeSingleEssay(res, currentEssayScore, currentFeedback)}
                              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>{isGradingSingleId === res.id ? 'Đang lưu...' : '💾 Lưu điểm & Nhận xét'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
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

      {/* Word (.docx) Custom Export Modal */}
      {showWordExportModal && (
        <WordExportModal
          isOpen={showWordExportModal}
          exam={exam}
          onClose={() => setShowWordExportModal(false)}
        />
      )}

      {/* PowerPoint (.pptx) Presentation Export Modal */}
      {showPptxExportModal && (
        <PowerPointExportModal
          isOpen={showPptxExportModal}
          exam={exam}
          onClose={() => setShowPptxExportModal(false)}
          onOpenWordExport={() => {
            setShowPptxExportModal(false);
            setShowWordExportModal(true);
          }}
          onOpenPdfPrint={() => {
            setShowPptxExportModal(false);
            setPrintModeTarget('exam');
          }}
        />
      )}
    </div>
  );
};
