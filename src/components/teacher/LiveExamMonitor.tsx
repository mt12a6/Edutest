import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Clock, 
  BookOpen, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Search, 
  Filter, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Send, 
  Radio, 
  ExternalLink,
  GraduationCap,
  Sparkles,
  Zap,
  ChevronDown,
  Trash2,
  Play
} from 'lucide-react';
import { Exam, Question, ExamAttempt, SchoolClass, Subject } from '../../types';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, updateDoc, setDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { getExams, getExamQuestions, submitExamAttempt, sanitizeForFirestore } from '../../services/db';
import { ConfirmModal } from '../common/ConfirmModal';

interface LiveExamMonitorProps {
  exams: Exam[];
  classes: SchoolClass[];
  subjects: Subject[];
}

interface ActiveStudentSession {
  attempt: ExamAttempt;
  exam?: Exam;
  secondsRemaining: number;
  progressPercent: number;
  answeredCount: number;
}

export const LiveExamMonitor: React.FC<LiveExamMonitorProps> = ({
  exams,
  classes,
  subjects
}) => {
  const [sessions, setSessions] = useState<ActiveStudentSession[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('Vừa xong');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>('all');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [filterViolationOnly, setFilterViolationOnly] = useState<boolean>(false);

  // Expanded violation log modal or row
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // In-app Confirm Modal State (eliminates window.confirm)
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Process raw attempts into ActiveStudentSession list
  const processAttempts = (attemptsList: ExamAttempt[]) => {
    const nowMs = Date.now();
    const mapped: ActiveStudentSession[] = attemptsList
      .map(att => {
        const deadlineMs = att.deadline ? new Date(att.deadline).getTime() : nowMs + 45 * 60 * 1000;
        const secs = Math.max(0, Math.floor((deadlineMs - nowMs) / 1000));
        const matchedExam = exams.find(e => e.id === att.examId);
        const totalQ = att.totalQuestions || matchedExam?.questionCount || 20;
        
        let answered = att.answeredCount || 0;
        if (att.answers && typeof att.answers === 'object') {
          answered = Object.keys(att.answers).filter(k => {
            const v = att.answers[k];
            return v !== undefined && v !== null && v !== '';
          }).length;
        }

        const progress = Math.min(100, Math.round((answered / totalQ) * 100));

        return {
          attempt: att,
          exam: matchedExam,
          secondsRemaining: secs,
          progressPercent: progress,
          answeredCount: answered
        };
      })
      .filter(s => s.secondsRemaining > 0); // only active sessions

    setSessions(mapped);
    setLastRefreshed(new Date().toLocaleTimeString('vi-VN'));
  };

  // Fetch active attempts from Firestore and LocalStorage
  const fetchActiveAttempts = async () => {
    try {
      const q = query(collection(db, 'attempts'), where('status', '==', 'in_progress'));
      const snap = await getDocs(q);
      const attemptsList: ExamAttempt[] = [];
      snap.forEach(d => {
        attemptsList.push({ ...d.data(), id: d.id } as ExamAttempt);
      });

      // Also read local attempts in localStorage if any
      try {
        const localSaved = localStorage.getItem('edutest_custom_attempts');
        if (localSaved) {
          const parsed = JSON.parse(localSaved);
          if (Array.isArray(parsed)) {
            parsed.forEach(a => {
              if (a.status === 'in_progress' && !attemptsList.some(x => x.id === a.id)) {
                attemptsList.push(a);
              }
            });
          }
        }
      } catch (e) {
        // ignore
      }

      processAttempts(attemptsList);
    } catch (err) {
      console.warn('Lỗi tải danh sách thí sinh đang thi:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Real-time Firestore Listener
  useEffect(() => {
    fetchActiveAttempts();

    let unsubscribe = () => {};
    try {
      const q = query(collection(db, 'attempts'), where('status', '==', 'in_progress'));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const firestoreAttempts: ExamAttempt[] = [];
        snapshot.forEach(docSnap => {
          firestoreAttempts.push({ ...docSnap.data(), id: docSnap.id } as ExamAttempt);
        });

        // Merge with local storage
        try {
          const localSaved = localStorage.getItem('edutest_custom_attempts');
          if (localSaved) {
            const parsed = JSON.parse(localSaved);
            if (Array.isArray(parsed)) {
              parsed.forEach(a => {
                if (a.status === 'in_progress' && !firestoreAttempts.some(x => x.id === a.id)) {
                  firestoreAttempts.push(a);
                }
              });
            }
          }
        } catch (e) {
          // ignore
        }

        processAttempts(firestoreAttempts);
        setIsLoading(false);
      }, (err) => {
        console.warn('Firestore onSnapshot listener error:', err);
      });
    } catch (e) {
      console.warn('Real-time snapshot error:', e);
    }

    // Real-time custom event listeners for instant local synchronization
    const handleLocalProgressUpdate = () => {
      fetchActiveAttempts();
    };
    window.addEventListener('edutest:attempt_progress_updated', handleLocalProgressUpdate);
    window.addEventListener('edutest:score_updated', handleLocalProgressUpdate);

    // Polling backup every 5 seconds
    const interval = setInterval(() => {
      if (autoRefresh) {
        fetchActiveAttempts();
      }
    }, 4000);

    return () => {
      unsubscribe();
      window.removeEventListener('edutest:attempt_progress_updated', handleLocalProgressUpdate);
      window.removeEventListener('edutest:score_updated', handleLocalProgressUpdate);
      clearInterval(interval);
    };
  }, [exams, autoRefresh]);

  // Tick down seconds smoothly every second
  useEffect(() => {
    const timer = setInterval(() => {
      setSessions(prev =>
        prev.map(s => ({
          ...s,
          secondsRemaining: Math.max(0, s.secondsRemaining - 1)
        }))
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Force Submit attempt (Collect Exam Paper)
  const handleForceSubmit = (session: ActiveStudentSession) => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'Xác nhận thu bài thí sinh',
      message: `Bạn có chắc muốn THU BÀI NGAY của thí sinh "${session.attempt.studentName || 'Học sinh'}"? Hệ thống sẽ kết thúc lượt thi, khóa bài làm và chấm điểm kết quả hiện tại.`,
      confirmText: 'Thu bài ngay',
      cancelText: 'Hủy bỏ',
      isDestructive: false,
      onConfirm: async () => {
        setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
        try {
          const exam = session.exam || exams.find(e => e.id === session.attempt.examId) || {
            id: session.attempt.examId,
            title: session.attempt.examTitle || 'Bài thi trắc nghiệm',
            subjectName: session.attempt.subjectName || 'Khảo thí',
            questionCount: session.attempt.totalQuestions || 20,
            durationMinutes: session.attempt.durationMinutes || 45,
            isPublished: true,
            createdAt: new Date().toISOString()
          } as Exam;

          const questions = await getExamQuestions(exam.id);
          
          const studentProfile = {
            id: session.attempt.studentId,
            displayName: session.attempt.studentName,
            email: session.attempt.studentEmail || '',
            username: session.attempt.studentName,
            role: 'student' as const,
            status: 'active' as const,
            className: session.attempt.classId || '10A1',
            createdAt: new Date().toISOString()
          };

          await submitExamAttempt(
            session.attempt.id,
            exam,
            studentProfile,
            session.attempt.answers || {},
            questions,
            session.attempt.tabViolations || 0
          );

          setActionSuccessMsg(`Đã thu bài và chấm điểm thành công cho thí sinh "${session.attempt.studentName}".`);
          setTimeout(() => setActionSuccessMsg(null), 4000);
          fetchActiveAttempts();
        } catch (err: any) {
          console.error('Lỗi khi thu bài thí sinh:', err);
          setActionErrorMsg('Không thể thu bài tự động. Vui lòng thử lại.');
          setTimeout(() => setActionErrorMsg(null), 4000);
        }
      }
    });
  };

  // Cancel attempt
  const handleCancelAttempt = (session: ActiveStudentSession) => {
    setConfirmModalConfig({
      isOpen: true,
      title: 'Cảnh báo: Hủy lượt thi của thí sinh',
      message: `Bạn có chắc chắn muốn HỦY lượt thi của thí sinh "${session.attempt.studentName}"? Lượt thi này sẽ bị hủy bỏ hoàn toàn và không lưu điểm số.`,
      confirmText: 'Hủy lượt thi này',
      cancelText: 'Đóng',
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
        try {
          try {
            await updateDoc(doc(db, 'attempts', session.attempt.id), {
              status: 'cancelled',
              cancelledAt: new Date().toISOString()
            });
          } catch (e) {
            // ignore firestore error
          }

          // Also remove/cancel from local storage
          try {
            const localSaved = localStorage.getItem('edutest_custom_attempts');
            if (localSaved) {
              const list: ExamAttempt[] = JSON.parse(localSaved);
              const updated = list.filter(x => x.id !== session.attempt.id);
              localStorage.setItem('edutest_custom_attempts', JSON.stringify(updated));
            }
          } catch (e) {}

          setActionSuccessMsg(`Đã hủy lượt thi của thí sinh "${session.attempt.studentName}".`);
          setTimeout(() => setActionSuccessMsg(null), 4000);
          fetchActiveAttempts();
        } catch (err) {
          console.error('Lỗi khi hủy lượt thi:', err);
        }
      }
    });
  };

  // Helper: Create 3 Realistic Mock Live Exam Sessions for Demo & Testing
  const handleCreateMockLiveSessions = async () => {
    setIsLoading(true);
    const now = Date.now();
    const primaryExam = exams[0] || {
      id: 'exam_toan_10',
      title: 'Khảo sát Chất lượng Toán 10 - Học kỳ I',
      subjectName: 'Toán học',
      grade: '10',
      questionCount: 20,
      durationMinutes: 45
    };

    const secondaryExam = exams[1] || exams[0] || {
      id: 'exam_van_11',
      title: 'Kiểm tra Giữa kỳ I môn Ngữ Văn 11',
      subjectName: 'Ngữ văn',
      grade: '11',
      questionCount: 20,
      durationMinutes: 45
    };

    const tertiaryExam = exams[2] || exams[0] || {
      id: 'exam_anh_12',
      title: 'Khảo sát Năng lực Tiếng Anh THPT',
      subjectName: 'Tiếng Anh',
      grade: '12',
      questionCount: 25,
      durationMinutes: 45
    };

    const mockAttempts: ExamAttempt[] = [
      {
        id: 'mock_att_live_1',
        examId: primaryExam.id,
        examTitle: primaryExam.title,
        subjectName: primaryExam.subjectName || 'Toán học',
        studentId: 'u_student_mock_1',
        studentName: 'Nguyễn Văn An',
        studentEmail: 'nguyenvanan.10a1@edutest.edu.vn',
        classId: '10A1',
        startedAt: new Date(now - 15 * 60 * 1000).toISOString(),
        deadline: new Date(now + 30 * 60 * 1000).toISOString(),
        durationMinutes: primaryExam.durationMinutes || 45,
        status: 'in_progress',
        totalQuestions: primaryExam.questionCount || 20,
        answeredCount: 14,
        answers: { q1: 'A', q2: 'B', q3: 'C', q4: 'D', q5: 'A', q6: 'B', q7: 'C', q8: 'D', q9: 'A', q10: 'B', q11: 'C', q12: 'D', q13: 'A', q14: 'B' },
        flaggedQuestions: { q5: true },
        lastSavedAt: new Date().toISOString(),
        tabViolations: 0,
        tabViolationLogs: []
      },
      {
        id: 'mock_att_live_2',
        examId: secondaryExam.id,
        examTitle: secondaryExam.title,
        subjectName: secondaryExam.subjectName || 'Ngữ văn',
        studentId: 'u_student_mock_2',
        studentName: 'Trần Thị Mai',
        studentEmail: 'tranthimai.11b2@edutest.edu.vn',
        classId: '11B2',
        startedAt: new Date(now - 28 * 60 * 1000).toISOString(),
        deadline: new Date(now + 17 * 60 * 1000).toISOString(),
        durationMinutes: secondaryExam.durationMinutes || 45,
        status: 'in_progress',
        totalQuestions: secondaryExam.questionCount || 20,
        answeredCount: 17,
        answers: { q1: 'A', q2: 'A', q3: 'B', q4: 'C', q5: 'B', q6: 'D', q7: 'A', q8: 'C', q9: 'D', q10: 'A', q11: 'B', q12: 'C', q13: 'D', q14: 'A', q15: 'B', q16: 'C', q17: 'D' },
        flaggedQuestions: { q8: true, q12: true },
        lastSavedAt: new Date().toISOString(),
        tabViolations: 3,
        tabViolationLogs: [
          `${new Date(now - 20 * 60 * 1000).toLocaleTimeString('vi-VN')} - Rời tab trình duyệt thi`,
          `${new Date(now - 12 * 60 * 1000).toLocaleTimeString('vi-VN')} - Chuyển sang ứng dụng khác trên thiết bị`,
          `${new Date(now - 4 * 60 * 1000).toLocaleTimeString('vi-VN')} - Rời màn hình làm bài`
        ]
      },
      {
        id: 'mock_att_live_3',
        examId: tertiaryExam.id,
        examTitle: tertiaryExam.title,
        subjectName: tertiaryExam.subjectName || 'Tiếng Anh',
        studentId: 'u_student_mock_3',
        studentName: 'Lê Hoàng Long',
        studentEmail: 'lehoanglong.12a1@edutest.edu.vn',
        classId: '12A1',
        startedAt: new Date(now - 8 * 60 * 1000).toISOString(),
        deadline: new Date(now + 37 * 60 * 1000).toISOString(),
        durationMinutes: tertiaryExam.durationMinutes || 45,
        status: 'in_progress',
        totalQuestions: tertiaryExam.questionCount || 25,
        answeredCount: 8,
        answers: { q1: 'B', q2: 'C', q3: 'A', q4: 'D', q5: 'B', q6: 'C', q7: 'A', q8: 'D' },
        flaggedQuestions: {},
        lastSavedAt: new Date().toISOString(),
        tabViolations: 1,
        tabViolationLogs: [
          `${new Date(now - 5 * 60 * 1000).toLocaleTimeString('vi-VN')} - Thu nhỏ cửa sổ trình duyệt`
        ]
      }
    ];

    try {
      // Save to local storage
      const localSaved = localStorage.getItem('edutest_custom_attempts');
      const existing: ExamAttempt[] = localSaved ? JSON.parse(localSaved) : [];
      const updated = [...mockAttempts, ...existing.filter(x => !x.id.startsWith('mock_att_live_'))];
      localStorage.setItem('edutest_custom_attempts', JSON.stringify(updated));

      // Save to Firestore doc
      for (const att of mockAttempts) {
        try {
          await setDoc(doc(db, 'attempts', att.id), sanitizeForFirestore(att), { merge: true });
        } catch (e) {
          // ignore firestore permissions if offline
        }
      }

      setActionSuccessMsg('Đã khởi tạo 3 thí sinh mô phỏng thi trực tiếp thành công! Bạn có thể xem tiến độ và thử nghiệm tính năng thu bài / cảnh báo.');
      setTimeout(() => setActionSuccessMsg(null), 5000);
      fetchActiveAttempts();
    } catch (err) {
      console.warn('Lỗi tạo thí sinh mô phỏng:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper: Clear Mock Sessions
  const handleClearMockLiveSessions = async () => {
    try {
      const localSaved = localStorage.getItem('edutest_custom_attempts');
      if (localSaved) {
        const list: ExamAttempt[] = JSON.parse(localSaved);
        const filtered = list.filter(x => !x.id.startsWith('mock_att_live_'));
        localStorage.setItem('edutest_custom_attempts', JSON.stringify(filtered));
      }

      for (const id of ['mock_att_live_1', 'mock_att_live_2', 'mock_att_live_3']) {
        try {
          await deleteDoc(doc(db, 'attempts', id));
        } catch (e) {}
      }

      setActionSuccessMsg('Đã dọn dẹp các thí sinh mô phỏng.');
      setTimeout(() => setActionSuccessMsg(null), 3000);
      fetchActiveAttempts();
    } catch (err) {
      console.warn(err);
    }
  };

  // Filtered sessions
  const filteredSessions = sessions.filter(s => {
    const studentName = (s.attempt.studentName || '').toLowerCase();
    const studentClass = (s.attempt.classId || '').toLowerCase();
    const examTitle = (s.attempt.examTitle || s.exam?.title || '').toLowerCase();
    const queryStr = searchQuery.toLowerCase().trim();

    const matchesSearch = !queryStr || studentName.includes(queryStr) || studentClass.includes(queryStr) || examTitle.includes(queryStr);
    const matchesExam = selectedExamId === 'all' || s.attempt.examId === selectedExamId;
    const matchesClass = selectedClassId === 'all' || s.attempt.classId === selectedClassId;
    const matchesViolations = !filterViolationOnly || (s.attempt.tabViolations && s.attempt.tabViolations > 0);

    return matchesSearch && matchesExam && matchesClass && matchesViolations;
  });

  const totalViolationsCount = sessions.filter(s => (s.attempt.tabViolations || 0) > 0).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-7 rounded-3xl shadow-sm border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            <span>HỆ THỐNG GIÁM SÁT TRỰC TUYẾN THEO THỜI GIAN THỰC</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            Kiểm Soát & Giám Sát Phòng Thi Trực Tiếp
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
            Xem chính xác thí sinh nào đang thi bài thi nào, thời gian còn lại, tiến độ câu hỏi và phát hiện cảnh báo rời màn hình thi tức thì.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={handleCreateMockLiveSessions}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="Tạo 3 thí sinh mô phỏng đang thi để thử nghiệm nhanh giám sát"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Thí sinh mẫu (Test Live)</span>
          </button>

          {sessions.some(s => s.attempt.id.startsWith('mock_att_live_')) && (
            <button
              onClick={handleClearMockLiveSessions}
              className="p-2 rounded-xl bg-white/10 hover:bg-rose-500/20 text-slate-300 hover:text-rose-200 border border-white/10 text-xs font-semibold transition-all cursor-pointer"
              title="Xóa 3 thí sinh mẫu mô phỏng"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <div className="text-right hidden sm:block pl-2 border-l border-slate-700">
            <p className="text-[10px] text-slate-400">Đồng bộ lúc:</p>
            <p className="text-xs font-mono font-bold text-emerald-400">{lastRefreshed}</p>
          </div>

          <button
            onClick={() => fetchActiveAttempts()}
            disabled={isLoading}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer border border-white/10"
            title="Làm mới danh sách ngay"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {actionErrorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{actionErrorMsg}</span>
        </div>
      )}

      {/* Real-time Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Đang làm bài</p>
            <p className="text-3xl font-black text-slate-900 mt-1">{sessions.length}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Thí sinh trực tuyến trong phòng thi</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Có cảnh báo rời tab</p>
            <p className="text-3xl font-black text-rose-600 mt-1">{totalViolationsCount}</p>
            <p className="text-[11px] text-rose-500 mt-0.5">Thí sinh bị hệ thống ghi nhận vi phạm</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tự động cập nhật</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-ping' : 'bg-slate-300'}`} />
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                  autoRefresh 
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                    : 'bg-slate-100 border-slate-300 text-slate-600'
                }`}
              >
                {autoRefresh ? 'Đang bật (Real-time)' : 'Đã tạm dừng'}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Lắng nghe sự kiện Firestore trực tiếp</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Zap className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filters and search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm theo tên học sinh, lớp, hoặc đề thi đang làm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium text-slate-700 max-w-[200px] truncate"
          >
            <option value="all">Tất cả đề thi</option>
            {exams.map(ex => (
              <option key={ex.id} value={ex.id}>{ex.title}</option>
            ))}
          </select>

          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium text-slate-700"
          >
            <option value="all">Tất cả lớp</option>
            {classes.map(c => (
              <option key={c.id || c.name} value={c.name}>{c.name}</option>
            ))}
          </select>

          <button
            onClick={() => setFilterViolationOnly(!filterViolationOnly)}
            className={`px-3 py-2 rounded-xl border font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filterViolationOnly 
                ? 'bg-rose-600 text-white border-rose-600' 
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Chỉ xem vi phạm</span>
          </button>
        </div>
      </div>

      {/* Table of active students */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
            <span>Danh sách thí sinh đang trực tiếp làm bài ({filteredSessions.length})</span>
          </h3>
          <span className="text-xs text-slate-400">Đồng bộ tự động</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3">Học sinh</th>
                <th className="py-3 px-3">Đề thi & Môn</th>
                <th className="py-3 px-3 text-center">Trắc nghiệm</th>
                <th className="py-3 px-3 text-center">Trả lời ngắn</th>
                <th className="py-3 px-3 text-center">Tự luận</th>
                <th className="py-3 px-3">Tiến độ (%)</th>
                <th className="py-3 px-3 text-center">Trạng thái</th>
                <th className="py-3 px-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSessions.length > 0 ? (
                filteredSessions.map((session) => {
                  const mins = Math.floor(session.secondsRemaining / 60);
                  const secs = session.secondsRemaining % 60;
                  const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                  const isUrgent = session.secondsRemaining <= 180;
                  const violations = session.attempt.tabViolations || 0;
                  const isExpanded = expandedAttemptId === session.attempt.id;
                  const examDisplayName = session.attempt.examTitle || session.exam?.title || session.attempt.examId;
                  const subjectDisplayName = session.attempt.subjectName || session.exam?.subjectName || 'Khảo thí';
                  
                  const breakdown = session.attempt.sectionBreakdown;
                  const totalQ = session.attempt.totalQuestions || 20;

                  // Section counts
                  const mcAns = breakdown?.mc?.answered ?? Math.min(totalQ - 2, session.answeredCount);
                  const mcTotal = breakdown?.mc?.total ?? Math.max(1, totalQ - 2);
                  const currentQNum = breakdown?.mc?.current || (session.attempt.currentQuestionIndex !== undefined ? session.attempt.currentQuestionIndex + 1 : undefined);

                  const fbAns = breakdown?.fillBlank?.answered ?? 0;
                  const fbTotal = breakdown?.fillBlank?.total ?? 0;

                  const essayAns = breakdown?.essay?.answered ?? 0;
                  const essayTotal = breakdown?.essay?.total ?? (totalQ > 15 ? 1 : 0);
                  const essayWords = breakdown?.essay?.wordCount ?? 0;

                  return (
                    <React.Fragment key={session.attempt.id}>
                      <tr className="hover:bg-slate-50/60 transition-colors">
                        {/* Student Name */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-slate-800 text-white font-bold flex items-center justify-center shrink-0 shadow-2xs">
                              {(session.attempt.studentName || 'H')[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-xs">
                                {session.attempt.studentName || 'Học sinh'}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                <span className="px-1.5 py-0.2 bg-slate-100 rounded font-semibold text-slate-700">
                                  {session.attempt.classId || 'Tự do'}
                                </span>
                                {session.attempt.studentEmail && (
                                  <span className="truncate max-w-[120px]">{session.attempt.studentEmail}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Exam title & subject */}
                        <td className="py-3.5 px-3 max-w-[190px]">
                          <p className="font-bold text-slate-800 truncate" title={examDisplayName}>
                            {examDisplayName}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500">
                            <span className="font-semibold text-indigo-700">
                              {subjectDisplayName}
                            </span>
                            <span>•</span>
                            <span>K{session.exam?.grade || '10'}</span>
                          </div>
                        </td>

                        {/* Trắc nghiệm */}
                        <td className="py-3.5 px-3 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                              mcAns >= mcTotal ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-blue-50 text-blue-800 border border-blue-200'
                            }`}>
                              {mcAns}/{mcTotal}
                            </span>
                            {currentQNum && (
                              <span className="text-[10px] text-slate-500 font-medium mt-0.5">
                                Đang ở câu {currentQNum}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Trả lời ngắn */}
                        <td className="py-3.5 px-3 text-center">
                          {fbTotal > 0 ? (
                            <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                              fbAns >= fbTotal ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-purple-50 text-purple-800 border border-purple-200'
                            }`}>
                              {fbAns}/{fbTotal}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-mono">-</span>
                          )}
                        </td>

                        {/* Tự luận */}
                        <td className="py-3.5 px-3 text-center">
                          {essayTotal > 0 ? (
                            <div className="inline-flex flex-col items-center">
                              <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                                essayAns >= essayTotal ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}>
                                {essayAns}/{essayTotal}
                              </span>
                              {essayWords > 0 && (
                                <span className="text-[10px] text-amber-700 font-medium mt-0.5">
                                  {essayWords} từ đã gõ
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-mono">-</span>
                          )}
                        </td>

                        {/* Progress & Countdown */}
                        <td className="py-3.5 px-3">
                          <div className="w-32 space-y-1">
                            <div className="flex justify-between items-center text-[11px] font-semibold text-slate-600">
                              <span className="text-xs font-bold text-emerald-700">{session.progressPercent}%</span>
                              <span className={`font-mono text-[11px] font-bold ${isUrgent ? 'text-rose-600 animate-pulse' : 'text-slate-500'}`}>
                                {timeFormatted}
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div 
                                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${session.progressPercent}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Status & Violations */}
                        <td className="py-3.5 px-3 text-center">
                          {violations > 0 ? (
                            <button
                              onClick={() => setExpandedAttemptId(isExpanded ? null : session.attempt.id)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold hover:bg-rose-100 transition-colors cursor-pointer"
                              title="Bấm để xem chi tiết vi phạm tab"
                            >
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                              <span>{violations} lần rời tab</span>
                              <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              Đang làm bài
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setExpandedAttemptId(isExpanded ? null : session.attempt.id)}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                              title="Xem chi tiết các câu thí sinh đã làm hoặc đang gõ"
                            >
                              <span>{isExpanded ? 'Đóng' : 'Xem bài'}</span>
                              <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>

                            <button
                              onClick={() => handleForceSubmit(session)}
                              className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                              title="Thu bài và chốt điểm của thí sinh ngay lúc này"
                            >
                              <Send className="w-3.5 h-3.5 text-amber-600" />
                              <span>Thu bài</span>
                            </button>

                            <button
                              onClick={() => handleCancelAttempt(session)}
                              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Hủy lượt thi này"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Real-time Inspection Panel */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b border-slate-200">
                          <td colSpan={8} className="py-4 px-6 text-xs text-slate-800 space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                              <span className="font-bold text-slate-900 flex items-center gap-2">
                                <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                                Bài làm trực tiếp của thí sinh: {session.attempt.studentName} (Cập nhật thời gian thực)
                              </span>
                              <span className="text-[11px] text-slate-400">
                                Lưu tự động lần cuối: {session.attempt.lastSavedAt ? new Date(session.attempt.lastSavedAt).toLocaleTimeString('vi-VN') : 'Mới đây'}
                              </span>
                            </div>

                            {/* Section details grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Left: Answers snapshot */}
                              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                                <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider block">
                                  Các câu trắc nghiệm & trả lời ngắn đã chọn:
                                </span>
                                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                                  {session.attempt.answers && Object.keys(session.attempt.answers).length > 0 ? (
                                    Object.entries(session.attempt.answers).map(([qId, val], aIdx) => {
                                      const isEssay = typeof val === 'string' && val.length > 20;
                                      if (isEssay) return null;
                                      return (
                                        <div key={qId} className="px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs flex items-center gap-1.5">
                                          <span className="font-semibold text-slate-500">#{aIdx + 1}:</span>
                                          <span className="font-bold text-emerald-700">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <span className="text-slate-400 italic text-xs">Thí sinh chưa chọn câu nào.</span>
                                  )}
                                </div>
                              </div>

                              {/* Right: Essay preview */}
                              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                                <span className="font-bold text-amber-800 text-[11px] uppercase tracking-wider block">
                                  Nội dung bài làm tự luận đang viết:
                                </span>
                                {(() => {
                                  const essayAnswers = Object.entries(session.attempt.answers || {}).filter(([_, val]) => typeof val === 'string' && val.length > 5);
                                  if (essayAnswers.length === 0) {
                                    return <span className="text-slate-400 italic text-xs block">Thí sinh chưa nhập nội dung tự luận.</span>;
                                  }
                                  return (
                                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                                      {essayAnswers.map(([qId, textVal]) => (
                                        <div key={qId} className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/80 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                                          {String(textVal)}
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>

                            {/* Violation logs if any */}
                            {violations > 0 && session.attempt.tabViolationLogs && (
                              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2 text-rose-900">
                                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold text-xs">Nhật ký rời màn hình thi:</span>
                                  <ul className="list-disc pl-5 mt-1 space-y-0.5 text-[11px] text-rose-800">
                                    {session.attempt.tabViolationLogs.map((log, idx) => (
                                      <li key={idx}>{log}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Radio className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-sm text-slate-600">Hiện không có thí sinh nào đang làm bài trực tuyến</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                      Khi học sinh bấm "Bắt đầu làm bài", danh sách sẽ tự động xuất hiện tại đây theo thời gian thực. Bạn cũng có thể bấm <strong>"Thí sinh mẫu (Test Live)"</strong> ở góc trên để chạy thử ngay.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* In-app confirmation modal */}
      <ConfirmModal
        isOpen={confirmModalConfig.isOpen}
        title={confirmModalConfig.title}
        message={confirmModalConfig.message}
        confirmText={confirmModalConfig.confirmText}
        cancelText={confirmModalConfig.cancelText}
        isDestructive={confirmModalConfig.isDestructive}
        onConfirm={confirmModalConfig.onConfirm}
        onCancel={() => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
