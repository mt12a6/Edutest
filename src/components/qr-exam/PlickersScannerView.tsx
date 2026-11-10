import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  X, 
  RotateCw, 
  CheckCircle2, 
  Users, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  AlertCircle, 
  Volume2, 
  VolumeX, 
  Eye, 
  EyeOff, 
  Award, 
  Play, 
  RefreshCw, 
  Save, 
  Layers, 
  FileSpreadsheet,
  Check,
  Zap
} from 'lucide-react';
import { Exam, Question, SchoolClass, PlickersSession, PlickersStudent, PlickersResponse } from '../../types';
import { 
  detectMultipleCardsFromCanvas, 
  drawCardVisualOverlay, 
  DetectedCardResult 
} from '../../utils/plickersVision';
import { 
  createOrGetPlickersSession, 
  updatePlickersSessionState, 
  savePlickersResponse, 
  getPlickersResponsesForSession,
  getPlickersStudents,
  completePlickersSessionAndCalculateResults
} from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { MathRenderer } from '../common/MathRenderer';
import { PlickersSessionReportModal } from './PlickersSessionReportModal';
import { CameraDiagnosticModal } from './CameraDiagnosticModal';

interface PlickersScannerViewProps {
  exam: Exam;
  questions: Question[];
  classes: SchoolClass[];
  initialClassId?: string;
  onClose: () => void;
  onOpenPresentation?: () => void;
}

export const PlickersScannerView: React.FC<PlickersScannerViewProps> = ({
  exam,
  questions,
  classes,
  initialClassId,
  onClose,
  onOpenPresentation
}) => {
  const { user, profile } = useAuth();

  // Selected Class & Active Session
  const [selectedClassId, setSelectedClassId] = useState<string>(initialClassId || exam.classIds?.[0] || classes[0]?.id || '10A1');
  const [activeSession, setActiveSession] = useState<PlickersSession | null>(null);
  const [students, setStudents] = useState<PlickersStudent[]>([]);
  const [responses, setResponses] = useState<PlickersResponse[]>([]);

  // Current Question
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const currentQ = questions[currentQuestionIndex] || questions[0];

  // Camera State
  const [isCameraRunning, setIsCameraRunning] = useState<boolean>(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanningActive, setIsScanningActive] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showAnswerFeedback, setShowAnswerFeedback] = useState<boolean>(true);

  // Stats & Feedback
  const [recentlyScannedCard, setRecentlyScannedCard] = useState<{ cardId: number; studentName: string; answer: string; isCorrect: boolean } | null>(null);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState<boolean>(false);
  const [isCompleting, setIsCompleting] = useState<boolean>(false);
  const [completionSuccess, setCompletionSuccess] = useState<string | null>(null);

  // Video, Canvas and Animation Loop References
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameId = useRef<number | null>(null);
  const lastDetectionTimeMap = useRef<Map<number, number>>(new Map()); // debounce per card

  // Audio Beep generator using Web Audio API (zero external asset dependency)
  const playBeep = (isSuccess: boolean) => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (isSuccess) {
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
      }
    } catch {
      // Audio context might be restricted before interaction
    }
  };

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

      const existingResponses = await getPlickersResponsesForSession(session.id);
      setResponses(existingResponses);
    };

    initSession();
  }, [selectedClassId, exam.id]);

  // Listen for realtime response updates from external tabs or devices
  useEffect(() => {
    const handleResponseRecorded = (e: any) => {
      if (e.detail) {
        setResponses(prev => {
          const list = prev.filter(r => r.id !== e.detail.id);
          return [...list, e.detail];
        });
      }
    };

    window.addEventListener('edutest:plickers_response_recorded', handleResponseRecorded);
    return () => {
      window.removeEventListener('edutest:plickers_response_recorded', handleResponseRecorded);
    };
  }, []);

  // Camera Management
  const startCamera = async () => {
    try {
      setCameraError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(e => console.warn('Video play note:', e));
        };
      }
      setIsCameraRunning(true);
    } catch (err: any) {
      console.warn('Camera access note:', err);
      setCameraError(
        'Không thể mở camera. Vui lòng cấp quyền truy cập máy ảnh trong cài đặt trình duyệt hoặc đổi sang camera khác.'
      );
      setIsCameraRunning(false);
    }
  };

  const stopCamera = () => {
    if (animFrameId.current) {
      cancelAnimationFrame(animFrameId.current);
      animFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraRunning(false);
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [cameraFacing]);

  // Real-time Computer Vision Processing Loop
  useEffect(() => {
    if (!isCameraRunning || !isScanningActive) return;

    const processFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const width = video.videoWidth || 640;
        const height = video.videoHeight || 480;

        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          // 1. Draw video onto hidden processing canvas
          ctx.drawImage(video, 0, 0, width, height);

          // 2. Run multi-card detection
          const detectedCards = detectMultipleCardsFromCanvas(ctx, width, height, 8);

          // 3. Clear canvas for rendering crisp overlay graphics on top of the live video
          ctx.clearRect(0, 0, width, height);

          // 4. Process each detected card
          const now = Date.now();
          detectedCards.forEach(card => {
            // Find student mapped to this cardId
            const student = students.find(s => s.cardId === card.cardId);
            const studentName = student?.displayName || `Học sinh #${card.cardId}`;
            const studentCode = student?.studentCode || `HS${String(card.cardId).padStart(2, '0')}`;
            const studentId = student?.id || `std_card_${card.cardId}`;

            const isCorrect = Boolean(currentQ?.correctOption && currentQ.correctOption === card.answer);

            // Draw visual tracking box and badge
            drawCardVisualOverlay(ctx, card, studentName, {
              isCorrect,
              showAnswerStatus: showAnswerFeedback
            });

            // Anti-duplicate & Debounce logic (500ms per card)
            const lastTime = lastDetectionTimeMap.current.get(card.cardId) || 0;
            if (now - lastTime > 600 && activeSession && currentQ) {
              lastDetectionTimeMap.current.set(card.cardId, now);

              const responseRecord: PlickersResponse = {
                id: `${activeSession.id}_${currentQ.id}_${card.cardId}`,
                sessionId: activeSession.id,
                examId: exam.id,
                questionId: currentQ.id,
                questionNumber: currentQ.questionNumber || currentQuestionIndex + 1,
                cardId: card.cardId,
                studentId,
                studentName,
                studentCode,
                answer: card.answer,
                correctAnswer: currentQ.correctOption,
                isCorrect,
                confidence: card.confidence,
                rotationDeg: card.rotationDeg,
                timestamp: new Date().toISOString()
              };

              // Persist response immediately
              savePlickersResponse(responseRecord);

              // Sound & visual feedback
              playBeep(isCorrect);
              setRecentlyScannedCard({
                cardId: card.cardId,
                studentName,
                answer: card.answer,
                isCorrect
              });

              // Clear preview banner after 3.5s
              setTimeout(() => {
                setRecentlyScannedCard(prev => (prev?.cardId === card.cardId ? null : prev));
              }, 3500);
            }
          });
        }
      }

      animFrameId.current = requestAnimationFrame(processFrame);
    };

    animFrameId.current = requestAnimationFrame(processFrame);
    return () => {
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
    };
  }, [isCameraRunning, isScanningActive, activeSession?.id, currentQ?.id, students, showAnswerFeedback, soundEnabled]);

  // Question Navigation
  const handleNavigateQuestion = async (newIndex: number) => {
    if (newIndex < 0 || newIndex >= questions.length) return;
    setCurrentQuestionIndex(newIndex);
    if (activeSession) {
      await updatePlickersSessionState(activeSession.id, {
        currentQuestionIndex: newIndex
      });
    }
  };

  // Filter responses for current question
  const currentQuestionResponses = responses.filter(r => r.questionId === currentQ?.id);
  const answeredCount = currentQuestionResponses.length;
  const totalStudents = students.length || 35;
  const progressPercent = Math.min(100, Math.round((answeredCount / totalStudents) * 100));

  // Tally options A, B, C, D
  const tally = { A: 0, B: 0, C: 0, D: 0 };
  currentQuestionResponses.forEach(r => {
    if (r.answer && tally[r.answer] !== undefined) {
      tally[r.answer]++;
    }
  });

  // Complete and calculate grades
  const handleCompleteSession = async () => {
    if (!activeSession) return;
    setIsCompleting(true);
    try {
      const results = await completePlickersSessionAndCalculateResults(
        activeSession,
        exam,
        questions
      );
      setCompletionSuccess(`Đã hoàn tất buổi kiểm tra! Đã chấm và tổng hợp điểm cho ${results.length} học sinh.`);
      setTimeout(() => setCompletionSuccess(null), 5000);
      setShowReportModal(true);
    } catch (err) {
      console.error('Lỗi hoàn tất buổi kiểm tra:', err);
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-3 bg-slate-950/90 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full h-full sm:max-w-6xl sm:h-[95vh] bg-white sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Top Header Bar */}
        <div className="p-3 sm:px-6 sm:py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black tracking-tight">
                  Camera Quét Thẻ Plickers Trực Tiếp
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white animate-pulse">
                  CAMERA LIVE
                </span>
              </div>
              <p className="text-xs text-slate-300 truncate max-w-sm sm:max-w-md">
                {exam.title} • Lớp: <span className="font-bold text-teal-300">{classes.find(c => c.id === selectedClassId)?.name || selectedClassId}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Presentation button */}
            {onOpenPresentation && (
              <button
                type="button"
                onClick={onOpenPresentation}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                title="Mở màn hình trình chiếu máy chiếu cho học sinh"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Mở Trình Chiếu</span>
              </button>
            )}

            {/* Camera facing switcher */}
            <button
              type="button"
              onClick={() => setCameraFacing(prev => prev === 'environment' ? 'user' : 'environment')}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Đổi camera trước / sau"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Sound toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(prev => !prev)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={soundEnabled ? 'Tắt âm báo khi quét thẻ' : 'Bật âm báo khi quét thẻ'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Class Selector & Question Navigator */}
        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600">Lớp học:</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Question Paging */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleNavigateQuestion(currentQuestionIndex - 1)}
              disabled={currentQuestionIndex === 0}
              className="p-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="font-bold text-slate-800 text-xs px-2">
              Câu {currentQuestionIndex + 1} / {questions.length}
            </span>

            <button
              type="button"
              onClick={() => handleNavigateQuestion(currentQuestionIndex + 1)}
              disabled={currentQuestionIndex >= questions.length - 1}
              className="p-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 disabled:opacity-30 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Right actions: Pause/Resume, Toggle Answer, Complete Session */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDiagnosticModal(true)}
              className="px-2.5 py-1.5 rounded-xl bg-teal-50 border border-teal-300 text-teal-800 text-xs font-semibold flex items-center gap-1.5 hover:bg-teal-100 transition-colors cursor-pointer"
              title="Mở chế độ kiểm tra chuyên sâu Camera & Thẻ 4 hướng"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
              <span>Kiểm Tra Camera</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAnswerFeedback(prev => !prev)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                showAnswerFeedback ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-white text-slate-600 border-slate-300'
              }`}
              title="Bật/Tắt hiển thị viền xanh/đỏ báo đúng/sai trên camera"
            >
              {showAnswerFeedback ? <Eye className="w-3.5 h-3.5 text-emerald-600" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
              <span>{showAnswerFeedback ? 'Hiện Đúng/Sai' : 'Ẩn Đúng/Sai'}</span>
            </button>

            <button
              type="button"
              onClick={handleCompleteSession}
              disabled={isCompleting || responses.length === 0}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-40"
              title="Tổng hợp điểm cả buổi thi và lưu kết quả"
            >
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>{isCompleting ? 'Đang chấm...' : 'Tổng hợp Điểm'}</span>
            </button>
          </div>
        </div>

        {/* Completion Success Notification */}
        {completionSuccess && (
          <div className="mx-4 mt-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{completionSuccess}</span>
          </div>
        )}

        {/* Main Workspace Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          
          {/* Left Column: Live Camera & Visual Canvas Viewport (7 Cols) */}
          <div className="lg:col-span-7 p-3 sm:p-4 bg-slate-950 flex flex-col justify-between gap-3 text-white overflow-hidden relative">
            
            {/* Viewport container with matching aspect ratio */}
            <div className="relative flex-1 w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center min-h-[300px]">
              {cameraError ? (
                <div className="p-6 text-center space-y-3 max-w-sm">
                  <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
                  <p className="text-xs text-rose-200">{cameraError}</p>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
                  >
                    Thử lại
                  </button>
                </div>
              ) : (
                <>
                  {/* Real video stream */}
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className="w-full h-full object-cover"
                  />

                  {/* High-precision visual tracking overlay canvas */}
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  />

                  {/* Corner Target Frame */}
                  <div className="absolute inset-4 pointer-events-none border-2 border-dashed border-teal-500/30 rounded-2xl flex flex-col justify-between p-3">
                    <div className="flex justify-between items-center text-[11px] font-mono font-bold text-teal-400 bg-slate-950/60 px-2.5 py-1 rounded-lg backdrop-blur-xs self-start">
                      <span>QUÉT THẺ 4 CHIỀU (A, B, C, D)</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Bottom Scanned Feedback Bar */}
            <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
                  {currentQuestionResponses.length}
                </div>
                <div>
                  <span className="font-bold block text-slate-200">
                    Đã nhận diện: {answeredCount} / {totalStudents} học sinh
                  </span>
                  <div className="w-48 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Live Scanned Card Toast */}
              {recentlyScannedCard && (
                <div className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in ${
                  recentlyScannedCard.isCorrect 
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700' 
                    : 'bg-indigo-950/80 text-indigo-300 border border-indigo-700'
                }`}>
                  <Check className="w-3.5 h-3.5" />
                  <span>#{recentlyScannedCard.cardId} {recentlyScannedCard.studentName}: [{recentlyScannedCard.answer}]</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Question Details & Class Response Tally (5 Cols) */}
          <div className="lg:col-span-5 p-4 bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col justify-between overflow-y-auto space-y-4">
            
            {/* Active Question Box */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-lg border border-teal-200">
                  Câu hỏi {currentQuestionIndex + 1}
                </span>
                {currentQ.correctOption && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                    Đáp án đúng: {currentQ.correctOption}
                  </span>
                )}
              </div>

              <div className="text-sm font-semibold text-slate-900 leading-relaxed">
                <MathRenderer content={currentQ.prompt} />
              </div>

              {currentQ.imageUrl && (
                <div className="rounded-xl overflow-hidden border border-slate-200 max-h-36 bg-slate-100 flex items-center justify-center">
                  <img src={currentQ.imageUrl} alt="Hình minh họa" className="object-contain h-full" />
                </div>
              )}

              {/* Options list */}
              {currentQ.options && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {(['A', 'B', 'C', 'D'] as const).map(opt => {
                    const text = currentQ.options?.[opt];
                    if (!text) return null;
                    const isCorrect = currentQ.correctOption === opt;
                    return (
                      <div 
                        key={opt}
                        className={`p-2.5 rounded-xl border text-xs font-medium flex items-start gap-2 ${
                          isCorrect 
                            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-bold' 
                            : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {opt}
                        </span>
                        <div className="min-w-0 flex-1 break-words">
                          <MathRenderer content={text} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Real-time Response Distribution Bars (A, B, C, D) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs">
                <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Thống kê phản hồi ({answeredCount} học sinh)
                </h3>
                <span className="text-slate-500 font-semibold">{progressPercent}% lớp</span>
              </div>

              <div className="space-y-2">
                {(['A', 'B', 'C', 'D'] as const).map(opt => {
                  const count = tally[opt] || 0;
                  const pct = answeredCount > 0 ? Math.round((count / answeredCount) * 100) : 0;
                  const isCorrect = currentQ.correctOption === opt;

                  return (
                    <div key={opt} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] text-white ${
                            isCorrect ? 'bg-emerald-600' : 'bg-slate-700'
                          }`}>
                            {opt}
                          </span>
                          <span>{count} lượt chọn</span>
                        </span>
                        <span>{pct}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isCorrect ? 'bg-emerald-500' : 'bg-indigo-500'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Student Response Roster Pills */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2 flex-1 overflow-y-auto max-h-48">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
                <span>Danh sách thí sinh ({students.length})</span>
                <span className="text-emerald-600">{answeredCount} Đã quét</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {students.map(s => {
                  const resp = currentQuestionResponses.find(r => r.cardId === s.cardId);
                  const hasAnswered = Boolean(resp);
                  const isCorrect = resp?.isCorrect;

                  return (
                    <div
                      key={s.id}
                      className={`p-1.5 rounded-xl border text-[11px] flex items-center justify-between transition-colors ${
                        hasAnswered
                          ? isCorrect && showAnswerFeedback
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                            : 'bg-indigo-50 border-indigo-200 text-indigo-950 font-semibold'
                          : 'bg-slate-50/60 border-slate-200 text-slate-400'
                      }`}
                    >
                      <span className="truncate max-w-[80px]">
                        #{s.cardId} {s.displayName.split(' ').pop()}
                      </span>
                      {hasAnswered && resp ? (
                        <span className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] text-white ${
                          isCorrect && showAnswerFeedback ? 'bg-emerald-600' : 'bg-indigo-600'
                        }`}>
                          {resp.answer}
                        </span>
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mr-1" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Full Session Assessment Report Modal */}
      {showReportModal && activeSession && (
        <PlickersSessionReportModal
          isOpen={showReportModal}
          session={activeSession}
          exam={exam}
          questions={questions}
          responses={responses}
          students={students}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {/* Camera Diagnostic & Real-Time Test Modal */}
      {showDiagnosticModal && (
        <CameraDiagnosticModal
          isOpen={showDiagnosticModal}
          onClose={() => setShowDiagnosticModal(false)}
          classes={classes}
          initialClassId={selectedClassId}
        />
      )}
    </div>
  );
};
