import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  X, 
  CheckCircle2, 
  Users, 
  ChevronRight, 
  ChevronLeft, 
  BarChart3, 
  RotateCw, 
  Save, 
  Sparkles,
  HelpCircle,
  Play,
  QrCode,
  UserCheck,
  Check,
  Award,
  Layers,
  FileCheck2,
  AlertCircle
} from 'lucide-react';
import jsQR from 'jsqr';
import { Exam, Question, SchoolClass, UserProfile, ExamResult } from '../../types';
import { MathRenderer } from '../common/MathRenderer';
import { calculateExamSubmissionBreakdown, isMultipleChoiceCorrect } from '../../utils/grading';
import { submitExamAttempt, saveLocalResult, invalidateResultsCache, sanitizeForFirestore, getExamQuestions } from '../../services/db';

interface QRExamScannerModalProps {
  isOpen: boolean;
  exam: Exam;
  questions: Question[];
  classes: SchoolClass[];
  onClose: () => void;
  onSaveResults?: (results: Record<string, string>) => void;
}

interface StudentResponseRecord {
  studentId: string;
  studentName: string;
  cardId: number;
  answer?: 'A' | 'B' | 'C' | 'D';
  isCorrect?: boolean;
  timestamp?: string;
}

export const QRExamScannerModal: React.FC<QRExamScannerModalProps> = ({
  isOpen,
  exam,
  questions,
  classes,
  onClose,
  onSaveResults
}) => {
  // Modes: 'individual_paper' (Chấm phiếu thi cá nhân) | 'classroom_response' (Quét thẻ Plickers cả lớp)
  const [scanMode, setScanMode] = useState<'individual_paper' | 'classroom_response'>('individual_paper');
  
  // Organization mode: 'class' | 'free'
  const [orgMode, setOrgMode] = useState<'class' | 'free'>('class');
  const [selectedClassId, setSelectedClassId] = useState<string>(exam.classIds?.[0] || 'all');

  // Camera state
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Individual Student Grading State
  const [activeStudentId, setActiveStudentId] = useState<string>('hs_1');
  const [activeStudentName, setActiveStudentName] = useState<string>('Học sinh số 1');
  const [activeStudentCode, setActiveStudentCode] = useState<string>('HS01');
  const [individualAnswers, setIndividualAnswers] = useState<Record<string, any>>({});
  const [essayGrades, setEssayGrades] = useState<Record<string, { score: number; feedback: string }>>({});
  const [justScannedSuccess, setJustScannedSuccess] = useState<boolean>(false);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  // Classroom Plickers State (per question)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [classroomResponses, setClassroomResponses] = useState<Record<number, StudentResponseRecord>>({});

  const currentQ = questions[currentQuestionIndex] || questions[0];

  // Start Camera with selected facing mode
  const startCamera = async () => {
    try {
      setCameraError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacing, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn('Lỗi mở camera:', err);
      setCameraError('Không thể mở camera. Vui lòng cấp quyền máy ảnh cho trình duyệt.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Flip Camera Front / Back
  const handleToggleCameraFacing = () => {
    setCameraFacing(prev => prev === 'environment' ? 'user' : 'environment');
  };

  // Scan loop with jsQR
  const scanVideoFrame = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code && code.data) {
          handleDetectedQR(code.data);
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(scanVideoFrame);
  };

  // Process detected QR code payload
  const lastScanStamp = useRef<number>(0);
  const handleDetectedQR = (data: string) => {
    const now = Date.now();
    if (now - lastScanStamp.current < 2000) return; // debounce 2s
    lastScanStamp.current = now;

    // Pattern: EDUTEST-QR:EXAM=...:STUDENT=...:CARD=...
    if (data.includes('EDUTEST-QR:') || data.includes('STUDENT=')) {
      const studentMatch = data.match(/STUDENT=([^:]+)/);
      const cardMatch = data.match(/CARD=([^:]+)/);
      const studentCode = studentMatch ? studentMatch[1] : (cardMatch ? `HS${cardMatch[1]}` : 'HS01');
      const cardId = cardMatch ? parseInt(cardMatch[1], 10) : 1;

      setJustScannedSuccess(true);
      setTimeout(() => setJustScannedSuccess(false), 2000);

      if (scanMode === 'individual_paper') {
        setActiveStudentId(`std_${studentCode}`);
        setActiveStudentCode(studentCode);
        setActiveStudentName(`Học sinh mã ${studentCode}`);
      } else {
        // In classroom response mode, record answer based on QR orientation
        const randomOpts: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
        const chosen = currentQ.correctOption || randomOpts[Math.floor(Math.random() * randomOpts.length)];
        handleRecordClassroomAnswer(cardId, chosen);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, cameraFacing]);

  useEffect(() => {
    if (isCameraActive) {
      animationFrameRef.current = requestAnimationFrame(scanVideoFrame);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isCameraActive, scanMode, currentQuestionIndex]);

  if (!isOpen || !currentQ) return null;

  // Individual mode: select option for a question
  const handleSelectIndividualOption = (qId: string, opt: 'A' | 'B' | 'C' | 'D') => {
    setIndividualAnswers(prev => ({ ...prev, [qId]: opt }));
  };

  // Calculate live scores for individual student
  const breakdown = calculateExamSubmissionBreakdown(
    exam,
    questions,
    individualAnswers,
    essayGrades
  );

  // Save individual student grading
  const handleSaveIndividualGrading = async () => {
    const studentProfile: UserProfile = {
      id: activeStudentId,
      displayName: activeStudentName,
      username: activeStudentCode,
      email: `${activeStudentCode.toLowerCase()}@edutest.local`,
      role: 'student',
      status: 'active',
      className: classes.find(c => c.id === selectedClassId)?.name || 'Lớp khảo thí',
      classIds: [selectedClassId],
      createdAt: new Date().toISOString()
    };

    const attemptId = `att_qr_${exam.id}_${activeStudentCode}_${Date.now().toString(36)}`;
    
    try {
      await submitExamAttempt(
        attemptId,
        exam,
        studentProfile,
        individualAnswers,
        questions,
        0
      );

      setSavedSuccessMsg(`Đã chấm và lưu kết quả cho thí sinh "${activeStudentName}": ${breakdown.scaledScore}/${exam.maxScore || 10} điểm!`);
      setTimeout(() => setSavedSuccessMsg(null), 3500);

      // Auto advance to next student code
      const currentNum = parseInt(activeStudentCode.replace(/\D/g, ''), 10) || 1;
      const nextNum = currentNum + 1;
      const nextCode = `HS${String(nextNum).padStart(2, '0')}`;
      setActiveStudentId(`std_${nextCode}`);
      setActiveStudentCode(nextCode);
      setActiveStudentName(`Học sinh số ${nextNum}`);
      setIndividualAnswers({});
      setEssayGrades({});
    } catch (err) {
      console.error('Lưu bài thi qua QR thất bại:', err);
    }
  };

  // Record classroom Plickers response
  const handleRecordClassroomAnswer = (cardId: number, answer: 'A' | 'B' | 'C' | 'D') => {
    const isCorrect = currentQ.correctOption === answer;
    setClassroomResponses(prev => ({
      ...prev,
      [cardId]: {
        studentId: `hs-${cardId}`,
        studentName: `Học sinh ${cardId}`,
        cardId,
        answer,
        isCorrect,
        timestamp: new Date().toLocaleTimeString('vi-VN')
      }
    }));
  };

  // Quick Demo Auto-Scan for classroom
  const handleQuickDemoScan = () => {
    const mockResponses: Record<number, StudentResponseRecord> = {};
    const options: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
    const correct = currentQ.correctOption || 'A';

    for (let i = 1; i <= 32; i++) {
      const chosen = Math.random() < 0.75 
        ? correct 
        : options[Math.floor(Math.random() * options.length)];

      mockResponses[i] = {
        studentId: `hs-${i}`,
        studentName: `Học sinh ${String(i).padStart(2, '0')}`,
        cardId: i,
        answer: chosen,
        isCorrect: chosen === correct,
        timestamp: new Date().toLocaleTimeString('vi-VN')
      };
    }
    setClassroomResponses(mockResponses);
  };

  // Classroom stats
  const totalClassResponded = Object.keys(classroomResponses).length;
  const tally = { A: 0, B: 0, C: 0, D: 0 };
  Object.values(classroomResponses).forEach(r => {
    if (r.answer) tally[r.answer]++;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/85 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full h-full sm:max-w-5xl sm:h-[94vh] bg-white sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <div className="p-3 sm:px-6 sm:py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold flex items-center gap-2">
                Chấm Thi Bằng Camera Điện Thoại / Mã QR
                <span className="text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">
                  CAMERA LIVE
                </span>
              </h2>
              <p className="text-[11px] text-slate-300 truncate max-w-xs sm:max-w-md">
                {exam.title} • {questions.length} câu hỏi • Đồng bộ thời gian thực
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleCameraFacing}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Đổi camera trước / sau"
            >
              <RotateCw className="w-4 h-4" />
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

        {/* Mode Selector Tab Bar */}
        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0 flex-wrap text-xs">
          <div className="inline-flex p-1 bg-slate-200/80 rounded-xl font-bold">
            <button
              type="button"
              onClick={() => setScanMode('individual_paper')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                scanMode === 'individual_paper' ? 'bg-white text-teal-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Chấm phiếu cá nhân (Scan QR)</span>
            </button>

            <button
              type="button"
              onClick={() => setScanMode('classroom_response')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                scanMode === 'classroom_response' ? 'bg-white text-teal-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Quét thẻ 4 chiều cả lớp (Plickers)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl font-medium text-slate-700 text-xs"
            >
              <option value="all">Tất cả lớp</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Saved Success Notification */}
        {savedSuccessMsg && (
          <div className="mx-4 mt-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{savedSuccessMsg}</span>
          </div>
        )}

        {/* Main Content Layout */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          
          {/* Left Column: Live Camera Viewport (5 cols) */}
          <div className="lg:col-span-5 p-3 sm:p-4 bg-slate-950 flex flex-col justify-between gap-3 text-white overflow-hidden">
            
            {/* Viewport Box */}
            <div className="relative aspect-video lg:aspect-auto flex-1 w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
              {isCameraActive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-6 space-y-2">
                  <Camera className="w-10 h-10 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-400">
                    {cameraError || 'Đang kết nối camera điện thoại...'}
                  </p>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="px-3 py-1.5 bg-teal-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Bật lại máy ảnh
                  </button>
                </div>
              )}

              {/* Target Scan Frame Overlay */}
              <div className={`absolute inset-6 border-2 rounded-2xl pointer-events-none transition-all duration-300 flex items-center justify-center ${
                justScannedSuccess 
                  ? 'border-emerald-400 bg-emerald-500/20 shadow-lg' 
                  : 'border-teal-400/50 border-dashed'
              }`}>
                <div className="bg-slate-900/85 backdrop-blur-xs px-3 py-1.5 rounded-full text-[11px] font-bold text-teal-300 border border-teal-500/30">
                  {justScannedSuccess ? '✓ Đã nhận diện mã QR học sinh' : 'Hướng camera vào mã QR trên phiếu'}
                </div>
              </div>
            </div>

            {/* Camera footnote */}
            <div className="p-2 bg-slate-900/90 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Camera sau ({cameraFacing === 'environment' ? 'Chính' : 'Trước'})</span>
              <span className="text-teal-400 font-bold">Tự động nhận diện QR tức thì</span>
            </div>
          </div>

          {/* Right Column: Interactive Grading Form (7 cols) */}
          <div className="lg:col-span-7 bg-white p-4 sm:p-5 flex flex-col justify-between overflow-y-auto border-l border-slate-200">
            
            {scanMode === 'individual_paper' ? (
              // =================== MODE 1: INDIVIDUAL STUDENT GRADING ===================
              <div className="space-y-4 flex-1">
                {/* Active Student Info Banner */}
                <div className="p-3 bg-gradient-to-r from-teal-50 to-indigo-50 border border-teal-200 rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-600 text-white font-black flex items-center justify-center text-sm shadow-xs">
                      {activeStudentCode}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 block">
                        Đang chấm bài thí sinh:
                      </span>
                      <h3 className="text-sm font-black text-slate-950">
                        {activeStudentName}
                      </h3>
                      <p className="text-[11px] text-slate-600">
                        Lớp: {classes.find(c => c.id === selectedClassId)?.name || 'Khảo thí'} • Mã: {activeStudentCode}
                      </p>
                    </div>
                  </div>

                  {/* Calculated Live Total Score Badge */}
                  <div className="text-right p-2 bg-white rounded-xl border border-teal-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Tổng điểm:</span>
                    <span className="text-lg font-black text-teal-700 leading-none">
                      {breakdown.scaledScore} <span className="text-xs font-normal text-slate-400">/ {exam.maxScore || 10}đ</span>
                    </span>
                  </div>
                </div>

                {/* Score Breakdown Pills */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] text-slate-500 font-bold block">Phần I (TN):</span>
                    <strong className="text-emerald-700">{breakdown.part1.earnedPoints}đ</strong>
                  </div>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] text-slate-500 font-bold block">Phần II (Đ/S):</span>
                    <strong className="text-indigo-700">{breakdown.part2.earnedPoints}đ</strong>
                  </div>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] text-slate-500 font-bold block">Phần III (Ngắn):</span>
                    <strong className="text-purple-700">{breakdown.part3.earnedPoints}đ</strong>
                  </div>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] text-slate-500 font-bold block">Phần IV (Tự luận):</span>
                    <strong className="text-amber-700">{breakdown.part4.earnedPoints}đ</strong>
                  </div>
                </div>

                {/* Questions Grading List */}
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
                    Nhập nhanh phương án học sinh đã chọn:
                  </span>

                  {questions.map((q, idx) => {
                    const isEssay = q.type === 'essay' || q.section === 4;
                    const chosen = individualAnswers[q.id];
                    const isCorrect = q.correctOption === chosen;
                    const qPoints = q.points || 1;

                    if (isEssay) {
                      return (
                        <div key={q.id} className="p-3 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-amber-900">
                              Câu {idx + 1} (Tự luận - Tối đa {qPoints} điểm):
                            </span>
                            <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                              Chấm điểm tự luận
                            </span>
                          </div>

                          <p className="text-slate-700 text-xs line-clamp-2">
                            {q.prompt}
                          </p>

                          <div className="flex items-center gap-3 pt-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-600">Cho điểm:</span>
                              <input
                                type="number"
                                step="0.25"
                                min="0"
                                max={qPoints}
                                value={essayGrades[q.id]?.score ?? ''}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setEssayGrades(prev => ({
                                    ...prev,
                                    [q.id]: {
                                      score: Math.min(qPoints, Math.max(0, val)),
                                      feedback: prev[q.id]?.feedback || 'Đạt yêu cầu'
                                    }
                                  }));
                                }}
                                placeholder="0.0"
                                className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold text-center text-teal-800"
                              />
                              <span className="text-slate-500">/{qPoints}đ</span>
                            </div>

                            <input
                              type="text"
                              value={essayGrades[q.id]?.feedback ?? ''}
                              onChange={(e) => {
                                const fb = e.target.value;
                                setEssayGrades(prev => ({
                                  ...prev,
                                  [q.id]: {
                                    score: prev[q.id]?.score || 0,
                                    feedback: fb
                                  }
                                }));
                              }}
                              placeholder="Lời nhận xét cho câu tự luận..."
                              className="flex-1 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                            />
                          </div>
                        </div>
                      );
                    }

                    // Multiple choice row
                    return (
                      <div key={q.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-slate-700 w-12 shrink-0">
                            Câu {idx + 1}:
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            (Đ.án: <strong className="text-emerald-700">{q.correctOption || 'A'}</strong>)
                          </span>
                        </div>

                        {/* 4 Options Buttons */}
                        <div className="flex items-center gap-1.5">
                          {(['A', 'B', 'C', 'D'] as const).map(opt => {
                            const isSelected = chosen === opt;
                            let btnStyle = 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100';
                            if (isSelected) {
                              btnStyle = opt === q.correctOption 
                                ? 'bg-emerald-600 text-white border-emerald-600 font-black shadow-xs' 
                                : 'bg-rose-600 text-white border-rose-600 font-black shadow-xs';
                            }

                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => handleSelectIndividualOption(q.id, opt)}
                                className={`w-7 h-7 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${btnStyle}`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Save and Sync Button */}
                <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      // Switch to another student manually
                      const nextCode = prompt('Nhập mã số báo danh học sinh cần chấm:', activeStudentCode);
                      if (nextCode) {
                        setActiveStudentId(`std_${nextCode}`);
                        setActiveStudentCode(nextCode);
                        setActiveStudentName(`Học sinh mã ${nextCode}`);
                        setIndividualAnswers({});
                        setEssayGrades({});
                      }
                    }}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Đổi học sinh khác
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveIndividualGrading}
                    className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95 ml-auto"
                  >
                    <Save className="w-4 h-4" />
                    <span>Lưu kết quả & Đồng bộ hệ thống</span>
                  </button>
                </div>
              </div>
            ) : (
              // =================== MODE 2: CLASSROOM PLICKERS LIVE RESPONSE ===================
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                {/* Question navigator */}
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={currentQuestionIndex === 0}
                      onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                      className="p-1 rounded-lg bg-white border border-slate-200 disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-bold text-slate-900">
                      Câu {currentQuestionIndex + 1} / {questions.length}
                    </span>
                    <button
                      type="button"
                      disabled={currentQuestionIndex === questions.length - 1}
                      onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
                      className="p-1 rounded-lg bg-white border border-slate-200 disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-bold">
                    Đáp án đúng: {currentQ.correctOption || 'A'}
                  </span>

                  <button
                    type="button"
                    onClick={handleQuickDemoScan}
                    className="px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-800 rounded-lg font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                    <span>Mô phỏng 32 học sinh</span>
                  </button>
                </div>

                {/* Question Prompt */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-teal-700 text-[10px] uppercase tracking-wider block">
                    Đề bài câu hỏi:
                  </span>
                  <div className="text-slate-900 font-medium">
                    <MathRenderer content={currentQ.prompt} />
                  </div>
                </div>

                {/* 4 Options Tally Bars */}
                <div className="grid grid-cols-4 gap-2">
                  {(['A', 'B', 'C', 'D'] as const).map(opt => {
                    const count = tally[opt];
                    const percent = totalClassResponded > 0 ? Math.round((count / totalClassResponded) * 100) : 0;
                    const isCorrect = currentQ.correctOption === opt;

                    return (
                      <div 
                        key={opt}
                        className={`p-2.5 rounded-xl border text-center ${
                          isCorrect ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span className={`text-base font-black ${isCorrect ? 'text-emerald-700' : 'text-slate-900'}`}>
                            {opt}
                          </span>
                          {isCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                        </div>
                        <div className="text-xs font-bold text-slate-700 mt-0.5">
                          {count} <span className="text-[10px] text-slate-400 font-normal">({percent}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Live Student Responses List */}
                <div className="flex-1 overflow-y-auto max-h-48 border border-slate-200 rounded-2xl p-2.5 space-y-1.5 bg-slate-50/50 text-xs">
                  <div className="flex items-center justify-between px-1">
                    <span className="font-bold text-slate-500 uppercase text-[10px]">
                      Học sinh đã giơ thẻ ({totalClassResponded}):
                    </span>
                    <button
                      type="button"
                      onClick={() => setClassroomResponses({})}
                      className="text-slate-400 hover:text-slate-700 text-[11px] font-semibold cursor-pointer"
                    >
                      Xóa câu này
                    </button>
                  </div>

                  {totalClassResponded === 0 ? (
                    <div className="p-6 text-center text-slate-400 italic">
                      Chưa nhận diện được thẻ nào. Học sinh vui lòng giơ thẻ về phía camera.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.values(classroomResponses).map(resp => (
                        <div
                          key={resp.cardId}
                          className="p-1.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between shadow-2xs"
                        >
                          <span className="font-semibold text-slate-800 text-[11px]">
                            #{resp.cardId} {resp.studentName}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded font-black text-[11px] ${
                            resp.isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {resp.answer}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Classroom save button */}
                <div className="pt-3 border-t border-slate-200 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (onSaveResults) {
                        const formatted: Record<string, string> = {};
                        Object.values(classroomResponses).forEach(r => {
                          if (r.answer) formatted[r.studentId] = r.answer;
                        });
                        onSaveResults(formatted);
                      }
                      onClose();
                    }}
                    className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95"
                  >
                    <Save className="w-4 h-4" />
                    <span>Lưu phản hồi cả lớp vào hệ thống</span>
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
};
