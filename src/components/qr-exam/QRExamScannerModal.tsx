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
  Play
} from 'lucide-react';
import { Exam, Question, SchoolClass, UserProfile } from '../../types';
import { MathRenderer } from '../common/MathRenderer';

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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string>(exam.classIds?.[0] || 'all');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Classroom student responses state for current question
  const [responses, setResponses] = useState<Record<number, StudentResponseRecord>>({});
  const [isScanning, setIsScanning] = useState<boolean>(true);

  const currentQ = questions[currentQuestionIndex];

  // Start Camera
  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn('Lỗi mở camera:', err);
      setCameraError('Không thể truy cập camera. Vui lòng cấp quyền máy ảnh trên trình duyệt.');
      setIsCameraActive(false);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
      // Reset responses for current question
      setResponses({});
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, currentQuestionIndex]);

  if (!isOpen || !currentQ) return null;

  // Simulate or Record a student response
  const handleRecordAnswer = (cardId: number, answer: 'A' | 'B' | 'C' | 'D') => {
    const isCorrect = currentQ.correctOption === answer;
    setResponses(prev => ({
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

  // Quick Demo Auto-Scan (simulate class of 30 students scanning their cards)
  const handleQuickDemoScan = () => {
    const mockResponses: Record<number, StudentResponseRecord> = {};
    const options: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
    const correct = currentQ.correctOption || 'A';

    for (let i = 1; i <= 35; i++) {
      // 70% chance of correct answer, 30% random
      const chosen = Math.random() < 0.7 
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
    setResponses(mockResponses);
  };

  // Tally stats
  const totalResponded = Object.keys(responses).length;
  const tally = { A: 0, B: 0, C: 0, D: 0 };
  Object.values(responses).forEach(r => {
    if (r.answer) tally[r.answer]++;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-5xl h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:px-6 sm:py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold flex items-center gap-2">
                Quét Phiếu Trả Lời Trực Tiếp (Plickers Scanner)
                <span className="text-[10px] bg-rose-500 text-white px-2 py-0.2 rounded-full font-bold animate-pulse">
                  LIVE
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                {exam.title} - Câu {currentQuestionIndex + 1} / {questions.length}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleQuickDemoScan}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 text-xs font-bold transition-all border border-teal-500/30 cursor-pointer"
              title="Mô phỏng quét tự động cho cả lớp"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-300" />
              <span>Quét mẫu cả lớp</span>
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

        {/* Question Selector Bar */}
        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between shrink-0 overflow-x-auto text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentQuestionIndex === 0}
              onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="font-bold text-slate-800">
              Câu {currentQuestionIndex + 1} ({currentQ.points}đ)
            </span>

            <button
              type="button"
              disabled={currentQuestionIndex === questions.length - 1}
              onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Đáp án đúng badge */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Đáp án chuẩn:</span>
            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-black text-xs border border-emerald-300">
              {currentQ.correctOption || 'A'}
            </span>
          </div>

          {/* Reset / Clear current question tally */}
          <button
            type="button"
            onClick={() => setResponses({})}
            className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
          >
            <RotateCw className="w-3 h-3" />
            <span>Xóa kết quả câu này</span>
          </button>
        </div>

        {/* Content Layout: Left = Camera + Question prompt; Right = Live Roster & Graph */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          
          {/* Left Column: Camera Feed & Prompt (7 cols) */}
          <div className="lg:col-span-7 p-4 flex flex-col gap-3 bg-slate-950 text-white overflow-y-auto">
            
            {/* Camera Viewport */}
            <div className="relative aspect-video w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
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
                    {cameraError || 'Đang kết nối camera điện thoại/máy tính...'}
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

              {/* Scanning Target Overlay */}
              <div className="absolute inset-8 border-2 border-teal-400/40 border-dashed rounded-2xl pointer-events-none flex items-center justify-center">
                <div className="bg-slate-900/80 backdrop-blur-xs px-3 py-1.5 rounded-full text-[11px] font-bold text-teal-300 border border-teal-500/30">
                  Hướng camera về phía học sinh giơ thẻ
                </div>
              </div>

              {/* Quick simulation bar at bottom of camera */}
              <div className="absolute bottom-2 inset-x-2 bg-slate-900/90 backdrop-blur-xs p-2 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-[10px] text-slate-400">Nhấp nhanh thẻ số:</span>
                <div className="flex items-center gap-1 overflow-x-auto">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                    <div key={num} className="flex items-center gap-0.5">
                      <span className="text-[10px] text-slate-400 font-mono">#{num}</span>
                      {(['A', 'B', 'C', 'D'] as const).map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleRecordAnswer(num, opt)}
                          className={`w-5 h-5 rounded text-[10px] font-bold ${
                            responses[num]?.answer === opt ? 'bg-teal-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Question Text Box */}
            <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 text-xs">
              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block mb-1">
                Nội dung câu hỏi:
              </span>
              <MathRenderer content={currentQ.prompt} className="text-slate-100" />
            </div>
          </div>

          {/* Right Column: Live Analytics & Student Tally (5 cols) */}
          <div className="lg:col-span-5 p-4 bg-white flex flex-col justify-between border-l border-slate-200 overflow-hidden">
            
            {/* Top Stats */}
            <div className="space-y-3 shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-teal-600" />
                  Thống kê phản hồi trực tiếp
                </h3>
                <span className="text-xs font-black text-teal-700 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                  {totalResponded} đã giơ thẻ
                </span>
              </div>

              {/* 4 Option Tally Bars */}
              <div className="grid grid-cols-4 gap-2">
                {(['A', 'B', 'C', 'D'] as const).map(opt => {
                  const count = tally[opt];
                  const percent = totalResponded > 0 ? Math.round((count / totalResponded) * 100) : 0;
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
            </div>

            {/* Live Student Responses List */}
            <div className="flex-1 overflow-y-auto my-3 border border-slate-200 rounded-2xl p-2 space-y-1.5 bg-slate-50/50">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 block">
                Danh sách học sinh đã nhận diện ({totalResponded}):
              </span>

              {totalResponded === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Chưa nhận diện được thẻ nào. Học sinh vui lòng giơ thẻ về phía ống kính.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.values(responses).map(resp => (
                    <div
                      key={resp.cardId}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs shadow-2xs"
                    >
                      <div className="min-w-0 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded bg-slate-100 font-bold text-[10px] flex items-center justify-center shrink-0">
                          {resp.cardId}
                        </span>
                        <span className="font-semibold text-slate-800 truncate text-[11px]">
                          {resp.studentName}
                        </span>
                      </div>
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

            {/* Footer Bottom Actions */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <span className="text-[11px] text-slate-400">
                Tự động lưu phản hồi từng câu
              </span>

              <button
                type="button"
                onClick={() => {
                  if (onSaveResults) {
                    const formatted: Record<string, string> = {};
                    Object.values(responses).forEach(r => {
                      if (r.answer) formatted[r.studentId] = r.answer;
                    });
                    onSaveResults(formatted);
                  }
                  onClose();
                }}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>Hoàn tất & Lưu điểm</span>
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
