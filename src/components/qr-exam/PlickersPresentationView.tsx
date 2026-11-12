import React, { useState, useEffect } from 'react';
import { 
  Maximize2, 
  Minimize2, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  EyeOff, 
  Users, 
  CheckCircle2, 
  BarChart3, 
  X, 
  Award, 
  Sparkles,
  Camera,
  Play,
  Smartphone,
  QrCode,
  Copy,
  Check,
  Radio
} from 'lucide-react';
import { Exam, Question, SchoolClass, PlickersSession, PlickersResponse, PlickersStudent } from '../../types';
import { MathRenderer } from '../common/MathRenderer';
import { 
  createOrGetPlickersSession, 
  updatePlickersSessionState, 
  getPlickersResponsesForSession,
  getPlickersStudents,
  subscribeToPlickersSession,
  subscribeToPlickersResponses
} from '../../services/db';
import { generateQRCodeDataUrl } from '../../utils/qrEncoder';
import { useAuth } from '../../context/AuthContext';

interface PlickersPresentationViewProps {
  exam: Exam;
  questions: Question[];
  classes: SchoolClass[];
  initialClassId?: string;
  onClose: () => void;
  onOpenScanner?: () => void;
}

export const PlickersPresentationView: React.FC<PlickersPresentationViewProps> = ({
  exam,
  questions,
  classes,
  initialClassId,
  onClose,
  onOpenScanner
}) => {
  const { user, profile } = useAuth();

  const [selectedClassId, setSelectedClassId] = useState<string>(initialClassId || exam.classIds?.[0] || classes[0]?.id || '10A1');
  const [activeSession, setActiveSession] = useState<PlickersSession | null>(null);
  const [students, setStudents] = useState<PlickersStudent[]>([]);
  const [responses, setResponses] = useState<PlickersResponse[]>([]);

  // Navigation
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [revealAnswer, setRevealAnswer] = useState<boolean>(false);
  const [showChart, setShowChart] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Phone Connect Remote QR
  const [showPhoneConnectModal, setShowPhoneConnectModal] = useState<boolean>(false);
  const [connectQrUrl, setConnectQrUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const currentQ = questions[currentQuestionIndex] || questions[0];

  // Initialize Session & Students
  useEffect(() => {
    const initSession = async () => {
      const cls = classes.find(c => c.id === selectedClassId) || {
        id: selectedClassId,
        name: selectedClassId,
        grade: exam.grade || '10',
        schoolYear: '2024 - 2025',
        studentCount: 35,
        createdAt: new Date().toISOString()
      };

      const stdList = await getPlickersStudents(cls.id);
      setStudents(stdList);

      const session = await createOrGetPlickersSession(
        exam,
        cls,
        user?.uid || 'teacher',
        profile?.displayName || user?.displayName || 'Giáo viên'
      );
      setActiveSession(session);
      setCurrentQuestionIndex(session.currentQuestionIndex || 0);
      setRevealAnswer(session.revealAnswer || false);

      const existingResponses = await getPlickersResponsesForSession(session.id);
      setResponses(existingResponses);
    };

    initSession();
  }, [selectedClassId, exam.id]);

  // Generate remote phone connection QR Code
  useEffect(() => {
    if (activeSession?.id && typeof window !== 'undefined') {
      const mobileUrl = `${window.location.origin}/?tab=plickers-live&session=${activeSession.id}&classId=${selectedClassId}`;
      generateQRCodeDataUrl(mobileUrl, { width: 320, margin: 2 })
        .then(setConnectQrUrl)
        .catch(err => console.warn('QR code generation error:', err));
    }
  }, [activeSession?.id, selectedClassId]);

  // Real-time synchronization across devices (PC and Mobile Phone via Firestore)
  useEffect(() => {
    if (!activeSession?.id) return;

    // 1. Listen to remote Firestore session updates (e.g. if phone advances question)
    const unsubSession = subscribeToPlickersSession(activeSession.id, (updatedSession) => {
      if (updatedSession) {
        if (typeof updatedSession.currentQuestionIndex === 'number') {
          setCurrentQuestionIndex(updatedSession.currentQuestionIndex);
        }
        if (typeof updatedSession.revealAnswer === 'boolean') {
          setRevealAnswer(updatedSession.revealAnswer);
        }
      }
    });

    // 2. Listen to remote Firestore card responses from phone camera
    const unsubResponses = subscribeToPlickersResponses(activeSession.id, (realtimeResponses) => {
      setResponses(realtimeResponses);
    });

    // 3. Fallback local window event listeners for single-device testing
    const handleResponseRecorded = (e: any) => {
      if (e.detail) {
        setResponses(prev => {
          const filtered = prev.filter(r => r.id !== e.detail.id);
          return [...filtered, e.detail];
        });
      }
    };

    const handleSessionUpdated = (e: any) => {
      if (e.detail) {
        if (typeof e.detail.currentQuestionIndex === 'number') {
          setCurrentQuestionIndex(e.detail.currentQuestionIndex);
        }
        if (typeof e.detail.revealAnswer === 'boolean') {
          setRevealAnswer(e.detail.revealAnswer);
        }
      }
    };

    window.addEventListener('edutest:plickers_response_recorded', handleResponseRecorded);
    window.addEventListener('edutest:plickers_session_updated', handleSessionUpdated);

    return () => {
      unsubSession();
      unsubResponses();
      window.removeEventListener('edutest:plickers_response_recorded', handleResponseRecorded);
      window.removeEventListener('edutest:plickers_session_updated', handleSessionUpdated);
    };
  }, [activeSession?.id]);

  // Keyboard navigation shortcuts (Left/Right arrows, Space, R)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        handleNavigateQuestion(currentQuestionIndex + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        handleNavigateQuestion(currentQuestionIndex - 1);
      } else if (e.key === ' ' || e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleToggleRevealAnswer();
      } else if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentQuestionIndex, revealAnswer, questions.length]);

  const handleNavigateQuestion = async (newIdx: number) => {
    if (newIdx < 0 || newIdx >= questions.length) return;
    setCurrentQuestionIndex(newIdx);
    setRevealAnswer(false);
    if (activeSession) {
      await updatePlickersSessionState(activeSession.id, {
        currentQuestionIndex: newIdx,
        revealAnswer: false
      });
    }
  };

  const handleToggleRevealAnswer = async () => {
    const nextState = !revealAnswer;
    setRevealAnswer(nextState);
    if (activeSession) {
      await updatePlickersSessionState(activeSession.id, {
        revealAnswer: nextState
      });
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  // Filter responses for current question
  const currentResponses = responses.filter(r => r.questionId === currentQ?.id);
  const totalStudents = students.length || 35;
  const answeredCount = currentResponses.length;
  const percentAnswered = Math.min(100, Math.round((answeredCount / totalStudents) * 100));

  // Tally options A, B, C, D
  const tally = { A: 0, B: 0, C: 0, D: 0 };
  let correctCount = 0;
  currentResponses.forEach(r => {
    if (r.answer && tally[r.answer] !== undefined) {
      tally[r.answer]++;
      if (r.answer === currentQ?.correctOption) {
        correctCount++;
      }
    }
  });

  const correctPercent = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

  if (!currentQ) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between overflow-hidden font-sans select-none animate-in fade-in duration-200">
      
      {/* Top Classroom Presentation Bar */}
      <div className="px-6 py-4 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="px-3.5 py-1.5 rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-300 font-extrabold text-sm flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
            <span>CÂU HỎI {currentQuestionIndex + 1} / {questions.length}</span>
          </div>

          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-white line-clamp-1">
              {exam.title}
            </h1>
            <p className="text-xs text-slate-400">
              Lớp: <span className="font-bold text-teal-400">{classes.find(c => c.id === selectedClassId)?.name || selectedClassId}</span> • Môn: {exam.subjectName}
            </p>
          </div>
        </div>

        {/* Top Control Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowPhoneConnectModal(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-md"
            title="Quét mã QR để mở camera quét thẻ trên điện thoại của giáo viên"
          >
            <Smartphone className="w-4 h-4" />
            <span className="hidden md:inline">KẾT NỐI ĐIỆN THOẠI QUÉT THẺ</span>
            <span className="md:hidden">QUÉT BẰNG ĐIỆN THOẠI</span>
          </button>

          {onOpenScanner && (
            <button
              type="button"
              onClick={onOpenScanner}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/30 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
              title="Mở camera quét thẻ trên thiết bị này"
            >
              <Camera className="w-4 h-4 text-teal-400" />
              <span>Mở Camera Quét</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Toàn màn hình trình chiếu (Phím F)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-rose-900 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Thoát trình chiếu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Presentation Stage */}
      <div className="flex-1 p-6 sm:p-10 flex flex-col justify-center max-w-6xl mx-auto w-full overflow-y-auto space-y-8">
        
        {/* Question Prompt */}
        <div className="space-y-4">
          <div className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-50 leading-snug tracking-tight">
            <MathRenderer content={currentQ.prompt} />
          </div>

          {currentQ.imageUrl && (
            <div className="max-h-72 rounded-2xl overflow-hidden bg-slate-900 border-2 border-slate-800 flex items-center justify-center p-3 shadow-xl">
              <img src={currentQ.imageUrl} alt="Hình minh họa" className="max-h-64 object-contain mx-auto" />
            </div>
          )}
        </div>

        {/* 4 Choices Grid (A, B, C, D) with large legible typography */}
        {currentQ.options && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {(['A', 'B', 'C', 'D'] as const).map(opt => {
              const text = currentQ.options?.[opt];
              if (!text) return null;

              const isCorrectOption = currentQ.correctOption === opt;
              const optCount = tally[opt] || 0;
              const optPct = answeredCount > 0 ? Math.round((optCount / answeredCount) * 100) : 0;

              let cardStyle = 'bg-slate-900/90 border-slate-700 text-slate-100 hover:border-slate-500';
              let badgeStyle = 'bg-slate-800 text-teal-300 border-slate-700';

              if (revealAnswer) {
                if (isCorrectOption) {
                  cardStyle = 'bg-emerald-950/80 border-emerald-500 text-emerald-100 ring-4 ring-emerald-500/40 shadow-lg shadow-emerald-950/50';
                  badgeStyle = 'bg-emerald-600 text-white border-emerald-400';
                } else {
                  cardStyle = 'bg-slate-900/40 border-slate-800 text-slate-400 opacity-70';
                  badgeStyle = 'bg-slate-800 text-slate-500 border-slate-800';
                }
              }

              return (
                <div
                  key={opt}
                  className={`p-5 sm:p-6 rounded-3xl border-2 transition-all flex items-start gap-4 relative overflow-hidden ${cardStyle}`}
                >
                  {/* Option Letter Badge */}
                  <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center font-black text-xl shrink-0 shadow-md ${badgeStyle}`}>
                    {opt}
                  </div>

                  {/* Option Content Text */}
                  <div className="flex-1 text-lg sm:text-xl font-bold leading-snug pt-1">
                    <MathRenderer content={text} />
                  </div>

                  {/* Percentage bar under option in reveal mode */}
                  {revealAnswer && (
                    <div className="absolute bottom-0 inset-x-0 h-2 bg-slate-800 overflow-hidden">
                      <div 
                        className={`h-full ${isCorrectOption ? 'bg-emerald-500' : 'bg-slate-600'}`}
                        style={{ width: `${optPct}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Bottom Live Response Bar & Controller */}
      <div className="px-6 py-4 bg-slate-900/95 border-t border-slate-800 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
        
        {/* Left: Live Response Counter & Progress Bar */}
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/40 flex items-center justify-center font-black text-lg shrink-0">
            {answeredCount}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">
                {answeredCount} / {totalStudents} học sinh đã giơ thẻ
              </span>
              <span className="text-xs font-mono font-bold text-teal-400">
                ({percentAnswered}%)
              </span>
            </div>
            <div className="w-56 sm:w-64 h-2 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${percentAnswered}%` }}
              />
            </div>
          </div>
        </div>

        {/* Center: Real-time Option Distribution Bars */}
        {showChart && (
          <div className="flex items-center gap-3">
            {(['A', 'B', 'C', 'D'] as const).map(opt => {
              const count = tally[opt] || 0;
              const isCorrect = currentQ.correctOption === opt;
              const pct = answeredCount > 0 ? Math.round((count / answeredCount) * 100) : 0;

              return (
                <div key={opt} className="text-center">
                  <div className="h-10 w-8 sm:w-9 bg-slate-800 rounded-lg flex flex-col justify-end p-0.5 relative overflow-hidden">
                    <div 
                      className={`w-full rounded-md transition-all duration-300 ${
                        revealAnswer && isCorrect ? 'bg-emerald-500' : 'bg-teal-500'
                      }`}
                      style={{ height: `${Math.max(10, pct)}%` }}
                    />
                  </div>
                  <span className={`text-[11px] font-bold block mt-1 ${
                    revealAnswer && isCorrect ? 'text-emerald-400 font-black' : 'text-slate-400'
                  }`}>
                    {opt}: {count}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Right: Reveal Answer & Pagination Controls */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Reveal Answer Button */}
          <button
            type="button"
            onClick={handleToggleRevealAnswer}
            className={`px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer shadow-md ${
              revealAnswer 
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white ring-2 ring-emerald-400' 
                : 'bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/40'
            }`}
            title="Hiện hoặc ẩn đáp án đúng trên màn chiếu (Phím Cách hoặc R)"
          >
            {revealAnswer ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span>{revealAnswer ? 'Ẩn Đáp Án Đúng' : 'Hiện Đáp Án Đúng'}</span>
          </button>

          {/* Previous / Next Question Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleNavigateQuestion(currentQuestionIndex - 1)}
              disabled={currentQuestionIndex === 0}
              className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-30 transition-all cursor-pointer"
              title="Câu hỏi trước (Mũi tên trái)"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => handleNavigateQuestion(currentQuestionIndex + 1)}
              disabled={currentQuestionIndex >= questions.length - 1}
              className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-30 transition-all cursor-pointer"
              title="Câu hỏi tiếp theo (Mũi tên phải)"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

      </div>

      {/* MODAL: KẾT NỐI ĐIỆN THOẠI QUÉT THẺ */}
      {showPhoneConnectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Kết Nối Điện Thoại Quét Thẻ</h3>
                  <p className="text-[11px] text-slate-400">Đồng bộ hai chiều với máy chiếu qua Firestore</p>
                </div>
              </div>
              <button
                onClick={() => setShowPhoneConnectModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* QR Code Container */}
            <div className="bg-white p-4 rounded-2xl flex flex-col items-center justify-center shadow-inner mx-auto max-w-[260px]">
              {connectQrUrl ? (
                <img
                  src={connectQrUrl}
                  alt="Mã QR kết nối điện thoại quét thẻ"
                  className="w-56 h-56 object-contain"
                />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-slate-400 text-xs">
                  Đang khởi tạo mã QR...
                </div>
              )}
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-2">
                Quét bằng Camera điện thoại hoặc Zalo
              </span>
            </div>

            {/* Step-by-step Instructions */}
            <div className="space-y-2 bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60 text-xs">
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                <span className="text-slate-300">Dùng điện thoại quét mã QR phía trên để mở trang quét thẻ.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                <span className="text-slate-300">Điện thoại sẽ tự động kết nối vào phiên thi <span className="text-amber-400 font-mono font-bold">Lớp {classes.find(c => c.id === selectedClassId)?.name || selectedClassId}</span>.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                <span className="text-slate-300">Khi bạn cầm điện thoại quét thẻ học sinh, kết quả sẽ nhảy trực tiếp lên màn hình máy chiếu này ngay lập tức!</span>
              </div>
            </div>

            {/* Direct Link Copy */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={typeof window !== 'undefined' ? `${window.location.origin}/?tab=plickers-live&session=${activeSession?.id}&classId=${selectedClassId}` : ''}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 select-all"
              />
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    const mobileUrl = `${window.location.origin}/?tab=plickers-live&session=${activeSession?.id}&classId=${selectedClassId}`;
                    navigator.clipboard.writeText(mobileUrl);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2500);
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 shrink-0"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Đã chép' : 'Sao chép'}</span>
              </button>
            </div>

            {/* Status Live Pulse */}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800 text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Trạng thái máy chủ: Sẵn sàng</span>
              </span>
              <span className="font-mono text-[11px] text-slate-500">ID: {activeSession?.id}</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
