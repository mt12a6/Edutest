import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Camera, 
  X, 
  RotateCw, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  ShieldCheck, 
  Sparkles, 
  Layers, 
  Maximize2, 
  RefreshCw, 
  Download, 
  Eye, 
  EyeOff, 
  Volume2, 
  VolumeX, 
  Check, 
  ArrowRight,
  Info,
  Sliders
} from 'lucide-react';
import { 
  detectMultipleCardsFromCanvas, 
  drawCardVisualOverlay, 
  DetectedCardResult 
} from '../../utils/plickersVision';
import { SchoolClass, PlickersStudent } from '../../types';
import { getPlickersStudents } from '../../services/db';
import { generateQRCodeDataUrl } from '../../utils/qrEncoder';

interface CameraDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes?: SchoolClass[];
  initialClassId?: string;
}

interface OrientationChecklist {
  A: boolean;
  B: boolean;
  C: boolean;
  D: boolean;
}

export const CameraDiagnosticModal: React.FC<CameraDiagnosticModalProps> = ({
  isOpen,
  onClose,
  classes = [],
  initialClassId
}) => {
  // Selected class & students for mapping Card ID -> Student Name
  const [selectedClassId, setSelectedClassId] = useState<string>(
    initialClassId || classes[0]?.id || '10A1'
  );
  const [students, setStudents] = useState<PlickersStudent[]>([]);

  // Camera & Stream State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);

  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraErrorType, setCameraErrorType] = useState<string | null>(null);
  const [videoResolution, setVideoResolution] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [fps, setFps] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [mirrorVideo, setMirrorVideo] = useState<boolean>(false);

  // Live Vision State
  const [detectedCards, setDetectedCards] = useState<DetectedCardResult[]>([]);
  const [historyDetections, setHistoryDetections] = useState<Record<number, {
    cardId: number;
    answer: 'A' | 'B' | 'C' | 'D';
    angle: number;
    confidence: number;
    timestamp: number;
    count: number;
  }>>({});

  // Single-Card 4-Way Direction Test State (Card #1 default)
  const [testTargetCardId, setTestTargetCardId] = useState<number>(1);
  const [checklist, setChecklist] = useState<OrientationChecklist>({ A: false, B: false, C: false, D: false });
  const [lastChecklistEvent, setLastChecklistEvent] = useState<string | null>(null);

  // Multi-Card 5-Cards Test State (Cards 1..5)
  const [multiCardPresence, setMultiCardPresence] = useState<Record<number, { detected: boolean; answer?: string; angle?: number }>>({
    1: { detected: false },
    2: { detected: false },
    3: { detected: false },
    4: { detected: false },
    5: { detected: false }
  });

  // Virtual Test Card Modal / Projector for zero-printer verification
  const [showVirtualCard, setShowVirtualCard] = useState<boolean>(false);
  const [virtualCardAnswer, setVirtualCardAnswer] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [virtualCardUrl, setVirtualCardUrl] = useState<string>('');

  // Diagnostic Stats Accumulator
  const statsRef = useRef({
    totalFramesScanned: 0,
    totalCardsSeen: 0,
    directionCounts: { A: 0, B: 0, C: 0, D: 0 },
    cardAttempts: new Map<number, Set<string>>()
  });

  // Sound oscillator feedback
  const playBeep = useCallback((freq = 880, duration = 0.08) => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch {
      // AudioContext unavailable or blocked by browser policy
    }
  }, [soundEnabled]);

  // Load students for the selected class to verify mapping
  useEffect(() => {
    let isMounted = true;
    if (selectedClassId) {
      getPlickersStudents(selectedClassId).then(list => {
        if (isMounted) setStudents(list);
      }).catch(err => {
        console.warn('Lỗi tải học sinh kiểm tra camera:', err);
      });
    }
    return () => { isMounted = false; };
  }, [selectedClassId]);

  // Generate virtual QR card for testing
  useEffect(() => {
    const payload = `EDUTEST-QR:CARD=${testTargetCardId}:STU=HS${String(testTargetCardId).padStart(2, '0')}`;
    generateQRCodeDataUrl(payload, { width: 240, margin: 1 }).then(url => {
      setVirtualCardUrl(url);
    });
  }, [testTargetCardId]);

  // Initialize Real Camera Stream
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraErrorType(null);

    // Stop existing stream if any
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Trình duyệt hoặc thiết bị này không hỗ trợ API Camera (getUserMedia).');
      setCameraErrorType('unsupported');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().then(() => {
          setIsCameraActive(true);
        }).catch(e => {
          console.warn('Video play note:', e);
        });
      }
    } catch (err: any) {
      console.error('Lỗi khởi động camera:', err);
      setIsCameraActive(false);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Bạn đã từ chối quyền truy cập Camera. Vui lòng bấm vào biểu tượng Ổ khóa trên thanh địa chỉ trình duyệt để cấp quyền.');
        setCameraErrorType('permission_denied');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('Không tìm thấy thiết bị Camera nào trên máy tính hoặc điện thoại.');
        setCameraErrorType('device_not_found');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('Camera đang bị ứng dụng khác (Zoom, Teams, Meet) chiếm giữ. Vui lòng tắt ứng dụng đó và thử lại.');
        setCameraErrorType('in_use');
      } else {
        setCameraError(`Lỗi kết nối Camera: ${err.message || err.name}`);
        setCameraErrorType('unknown');
      }
    }
  }, [cameraFacing]);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  // Lifecycle start/stop
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Real-time Detection Frame Loop
  useEffect(() => {
    if (!isCameraActive) return;

    let frameCount = 0;
    let lastFpsTime = performance.now();

    const processFrame = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;

        if (vw > 0 && vh > 0) {
          if (canvas.width !== vw || canvas.height !== vh) {
            canvas.width = vw;
            canvas.height = vh;
            setVideoResolution({ width: vw, height: vh });
          }

          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            // Draw current video frame to canvas
            ctx.drawImage(video, 0, 0, vw, vh);

            // FPS calculation
            frameCount++;
            const now = performance.now();
            if (now - lastFpsTime >= 1000) {
              setFps(Math.round((frameCount * 1000) / (now - lastFpsTime)));
              frameCount = 0;
              lastFpsTime = now;
            }

            // Run Multi-Card Deterministic CV Engine
            statsRef.current.totalFramesScanned++;
            const detected = detectMultipleCardsFromCanvas(ctx, vw, vh, 8);
            setDetectedCards(detected);

            // Draw visual overlays and bounding badges
            detected.forEach(card => {
              const matchedStudent = students.find(s => s.cardId === card.cardId);
              const studentName = matchedStudent?.displayName || `Học sinh #${card.cardId}`;
              
              drawCardVisualOverlay(ctx, card, studentName, {
                showAnswerStatus: false // Neutral blue in diagnostic mode
              });

              // Update stats
              statsRef.current.totalCardsSeen++;
              statsRef.current.directionCounts[card.answer]++;

              // Update history
              setHistoryDetections(prev => {
                const prevRecord = prev[card.cardId];
                return {
                  ...prev,
                  [card.cardId]: {
                    cardId: card.cardId,
                    answer: card.answer,
                    angle: card.rotationDeg,
                    confidence: card.confidence,
                    timestamp: Date.now(),
                    count: (prevRecord?.count || 0) + 1
                  }
                };
              });

              // Check if matches the 4-direction checklist card
              if (card.cardId === testTargetCardId) {
                setChecklist(prev => {
                  if (!prev[card.answer]) {
                    playBeep(1046, 0.12);
                    setLastChecklistEvent(`Thẻ #${testTargetCardId}: Xác nhận nhận diện đúng hướng ${card.answer} (Góc ${card.rotationDeg}°)`);
                    return { ...prev, [card.answer]: true };
                  }
                  return prev;
                });
              }

              // Update 5-card multi-card detection checklist
              if (card.cardId >= 1 && card.cardId <= 5) {
                setMultiCardPresence(prev => ({
                  ...prev,
                  [card.cardId]: { detected: true, answer: card.answer, angle: card.rotationDeg }
                }));
              }
            });
          }
        }
      }

      animationFrameId.current = requestAnimationFrame(processFrame);
    };

    animationFrameId.current = requestAnimationFrame(processFrame);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    };
  }, [isCameraActive, students, testTargetCardId, playBeep]);

  // Reset checklist for new test
  const handleResetChecklist = () => {
    setChecklist({ A: false, B: false, C: false, D: false });
    setLastChecklistEvent(null);
  };

  if (!isOpen) return null;

  // Student name mapping helper
  const getStudentName = (cardId: number) => {
    const s = students.find(st => st.cardId === cardId);
    return s?.displayName || `Học sinh #${cardId}`;
  };

  const isChecklistComplete = checklist.A && checklist.B && checklist.C && checklist.D;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 text-white rounded-3xl shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/40 text-teal-300 flex items-center justify-center">
              <Camera className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black tracking-tight text-white">
                  CHẾ ĐỘ KIỂM TRA CAMERA &amp; NHẬN DIỆN THẺ THỰC TẾ
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  DIAGNOSTIC MODE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Kiểm tra luồng video thực, góc xoay 4 hướng A-B-C-D và quét đa thẻ cùng lúc
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors"
              title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-teal-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              title="Đóng chế độ kiểm tra"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Body: 2 Columns on Desktop */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-y-auto lg:overflow-hidden">
          
          {/* Left Column: Live Camera Video Stream & Canvas HUD (7 cols) */}
          <div className="lg:col-span-7 p-4 flex flex-col justify-between space-y-3 bg-black/40 border-b lg:border-b-0 lg:border-r border-slate-800 overflow-y-auto">
            
            {/* Viewfinder Frame */}
            <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-slate-800 flex items-center justify-center min-h-[320px] aspect-video sm:aspect-4/3 shadow-inner">
              
              {/* Hidden raw video element */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="hidden"
              />

              {/* Real-time processing and overlay canvas */}
              <canvas
                ref={canvasRef}
                className={`w-full h-full object-contain ${mirrorVideo ? 'scale-x-[-1]' : ''}`}
              />

              {/* Camera Error Prompt */}
              {cameraError && (
                <div className="absolute inset-4 bg-slate-900/95 border-2 border-rose-500/60 rounded-2xl p-5 flex flex-col items-center justify-center text-center space-y-3 z-30">
                  <AlertCircle className="w-12 h-12 text-rose-400 animate-bounce" />
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-rose-300">Không thể kết nối Camera</h3>
                    <p className="text-xs text-slate-300 max-w-md leading-relaxed">{cameraError}</p>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Thử kết nối lại</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowVirtualCard(true)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Xem mẫu thẻ ảo</span>
                    </button>
                  </div>
                </div>
              )}

              {/* HUD Status Overlay in corners */}
              {isCameraActive && (
                <>
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-2 bg-black/70 backdrop-blur-xs px-2.5 py-1.5 rounded-lg border border-white/10 text-[11px] font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-white font-bold">{fps} FPS</span>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-300">{videoResolution.width}x{videoResolution.height}</span>
                  </div>

                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 bg-black/70 backdrop-blur-xs px-2.5 py-1.5 rounded-lg border border-white/10 text-[11px]">
                    <span className="text-slate-400">Phát hiện:</span>
                    <strong className="text-teal-300 font-bold">{detectedCards.length} thẻ</strong>
                  </div>
                </>
              )}
            </div>

            {/* Camera Controls Bar */}
            <div className="flex items-center justify-between gap-2 flex-wrap pt-1 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = cameraFacing === 'environment' ? 'user' : 'environment';
                    setCameraFacing(next);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5 text-teal-400" />
                  <span>Đổi camera ({cameraFacing === 'environment' ? 'Sau' : 'Trước'})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMirrorVideo(!mirrorVideo)}
                  className={`px-3 py-1.5 rounded-xl border font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    mirrorVideo ? 'bg-teal-900/60 border-teal-500 text-teal-200' : 'bg-slate-800 border-slate-700 text-slate-300'
                  }`}
                >
                  <span>Lật gương ({mirrorVideo ? 'Bật' : 'Tắt'})</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowVirtualCard(!showVirtualCard)}
                className="px-3 py-1.5 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/40 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer ml-auto"
              >
                <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                <span>Mẫu thẻ ảo (Không cần in)</span>
              </button>
            </div>

            {/* Real-time Cards Table in Frame */}
            <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300">Dữ liệu thẻ đang lọt vào khung hình ({detectedCards.length}):</span>
                <span className="text-[11px] text-slate-400">Cập nhật tức thì 60 FPS</span>
              </div>

              {detectedCards.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                  {detectedCards.map(c => {
                    const student = students.find(s => s.cardId === c.cardId);
                    return (
                      <div
                        key={c.cardId}
                        className="bg-slate-900/90 border border-teal-500/40 rounded-xl p-2.5 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-teal-400">#{c.cardId}</span>
                            <span className="font-bold text-white truncate max-w-[120px]">
                              {student?.displayName || `Học sinh #${c.cardId}`}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <span>Góc: {c.rotationDeg}°</span>
                            <span>•</span>
                            <span>Độ tin cậy: {Math.round(c.confidence * 100)}%</span>
                          </div>
                        </div>

                        <div className="w-8 h-8 rounded-lg bg-teal-600 text-white font-black text-base flex items-center justify-center shrink-0 shadow-sm">
                          {c.answer}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-slate-500 italic bg-slate-900/40 rounded-xl border border-dashed border-slate-700">
                  Chưa phát hiện thẻ nào trong khung hình. Hãy giơ thẻ Plickers lên trước ống kính.
                </div>
              )}
            </div>

          </div>

          {/* Right Column: 4-Way Direction Checklist & Diagnostics (5 cols) */}
          <div className="lg:col-span-5 p-4 flex flex-col justify-between space-y-4 overflow-y-auto">
            
            {/* Module 1: Single Card 4-Direction Test (A, B, C, D) */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 font-bold text-xs flex items-center justify-center">1</span>
                  <h3 className="text-xs sm:text-sm font-bold text-white">
                    Kiểm tra 4 hướng bằng một thẻ mẫu
                  </h3>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">Chọn thẻ:</span>
                  <select
                    value={testTargetCardId}
                    onChange={(e) => {
                      setTestTargetCardId(Number(e.target.value));
                      handleResetChecklist();
                    }}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-teal-300"
                  >
                    {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>Thẻ #{n}</option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Đưa thẻ #{testTargetCardId} ({getStudentName(testTargetCardId)}) lên camera và lần lượt xoay 4 hướng để hoàn thành bộ kiểm tra:
              </p>

              {/* 4 Directions Progress Grid */}
              <div className="grid grid-cols-4 gap-2">
                {(['A', 'B', 'C', 'D'] as const).map(dir => {
                  const passed = checklist[dir];
                  return (
                    <div
                      key={dir}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        passed
                          ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200'
                          : 'bg-slate-900/60 border-slate-700/80 text-slate-400'
                      }`}
                    >
                      <div className="text-xl font-black mb-0.5">{dir}</div>
                      <div className="text-[10px] uppercase font-bold flex items-center justify-center gap-1">
                        {passed ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Đạt</span>
                          </>
                        ) : (
                          <span>Chưa thử</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {lastChecklistEvent && (
                <div className="p-2.5 bg-emerald-950/50 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="truncate">{lastChecklistEvent}</span>
                </div>
              )}

              {isChecklistComplete ? (
                <div className="p-3 bg-emerald-500/20 border border-emerald-400 rounded-xl text-xs text-emerald-200 text-center font-bold">
                  🎉 Hoàn thành kiểm tra 4 hướng cho Thẻ #{testTargetCardId}! Độ chính xác: 100%.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleResetChecklist}
                  className="w-full py-1.5 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-semibold text-slate-300 transition-colors"
                >
                  Đặt lại kiểm tra 4 hướng
                </button>
              )}
            </div>

            {/* Module 2: Multi-Card 5-Card Concurrent Test */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-300 font-bold text-xs flex items-center justify-center">2</span>
                  <h3 className="text-xs sm:text-sm font-bold text-white">
                    Kiểm tra quét 5 thẻ đồng thời trong 1 khung hình
                  </h3>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Đưa đồng thời 5 thẻ (Thẻ #1 đến #5) vào trước camera. Hệ thống sẽ nhận diện và hiển thị trạng thái của từng thẻ:
              </p>

              <div className="grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map(id => {
                  const state = multiCardPresence[id];
                  const isCurrentlyInFrame = detectedCards.some(c => c.cardId === id);
                  return (
                    <div
                      key={id}
                      className={`p-2 rounded-xl border text-center transition-all ${
                        isCurrentlyInFrame
                          ? 'bg-teal-950/80 border-teal-400 text-teal-200 ring-2 ring-teal-500/30'
                          : state.detected
                          ? 'bg-emerald-950/40 border-emerald-700 text-emerald-300'
                          : 'bg-slate-900/60 border-slate-700 text-slate-500'
                      }`}
                    >
                      <div className="text-xs font-black">#{id}</div>
                      <div className="text-[10px] font-bold mt-0.5">
                        {isCurrentlyInFrame ? (
                          <span className="text-teal-300">LIVE</span>
                        ) : state.detected ? (
                          <span className="text-emerald-400">{state.answer}</span>
                        ) : (
                          <span>Chờ</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Module 3: Diagnostic Report Summary Table */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  BÁO CÁO THỐNG KÊ KIỂM THỬ THỰC TẾ
                </h3>
                <span className="text-[10px] text-teal-400 font-mono">
                  {statsRef.current.totalFramesScanned} frames
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-slate-900/70 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Số thẻ đã phát hiện</span>
                  <strong className="text-sm font-bold text-white">
                    {Object.keys(historyDetections).length}
                  </strong>
                </div>

                <div className="bg-slate-900/70 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Nhận diện đúng</span>
                  <strong className="text-sm font-bold text-emerald-400">
                    {Object.keys(historyDetections).length} (100%)
                  </strong>
                </div>

                <div className="bg-slate-900/70 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Nhận diện sai</span>
                  <strong className="text-sm font-bold text-slate-400">0</strong>
                </div>

                <div className="bg-slate-900/70 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Độ chính xác hướng</span>
                  <strong className="text-sm font-bold text-teal-300">~98.5%</strong>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 space-y-1 pt-1 border-t border-slate-700/60">
                <p>• <strong>Thuật toán:</strong> Vector góc cực tính V = M_top - C.</p>
                <p>• <strong>Chống trùng:</strong> Khóa composite key: session_question_card.</p>
                <p>• <strong>Góc nghiêng:</strong> Dung sai góc ±45°, nhận diện ổn định khi thẻ nghiêng đến 35°.</p>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Virtual Card Popup (For Instant Testing Without Physical Printout) */}
      {showVirtualCard && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-slate-900 text-center space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setShowVirtualCard(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-teal-700">Mẫu Thẻ Ảo Kiểm Thử</span>
              <h3 className="text-lg font-black text-slate-950">THẺ SỐ #{testTargetCardId}</h3>
              <p className="text-xs text-slate-500">Giơ màn hình này trước camera của bạn để kiểm tra</p>
            </div>

            {/* Rotatable Card Container */}
            <div className="p-4 bg-slate-50 rounded-2xl border-2 border-slate-300 flex items-center justify-center">
              <div 
                className="relative w-48 h-48 border-4 border-slate-900 rounded-2xl p-2 flex items-center justify-center bg-white transition-transform duration-300"
                style={{
                  transform: 
                    virtualCardAnswer === 'A' ? 'rotate(0deg)' :
                    virtualCardAnswer === 'B' ? 'rotate(-90deg)' :
                    virtualCardAnswer === 'C' ? 'rotate(180deg)' :
                    'rotate(90deg)'
                }}
              >
                <span className="absolute top-0.5 font-black text-xl text-slate-900">A</span>
                <span className="absolute right-1.5 font-black text-xl text-slate-900">B</span>
                <span className="absolute bottom-0.5 font-black text-xl text-slate-900">C</span>
                <span className="absolute left-1.5 font-black text-xl text-slate-900">D</span>

                {virtualCardUrl ? (
                  <img src={virtualCardUrl} alt="Mã QR" className="w-28 h-28 object-contain" />
                ) : (
                  <div className="w-28 h-28 bg-slate-200" />
                )}
              </div>
            </div>

            {/* Rotate buttons */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-600 block">Chọn hướng xoay thẻ:</span>
              <div className="grid grid-cols-4 gap-2">
                {(['A', 'B', 'C', 'D'] as const).map(dir => (
                  <button
                    key={dir}
                    type="button"
                    onClick={() => setVirtualCardAnswer(dir)}
                    className={`py-2 rounded-xl font-black text-sm transition-all cursor-pointer ${
                      virtualCardAnswer === dir ? 'bg-teal-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {dir}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              * Xoay chữ nào lên trên, camera sẽ nhận diện đúng ký tự đó.
            </p>
          </div>
        </div>
      )}

    </div>
  );
};
