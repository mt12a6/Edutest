import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, 
  CheckCircle2, 
  Flag, 
  ChevronLeft, 
  ChevronRight, 
  Send, 
  AlertTriangle, 
  Save, 
  Wifi, 
  WifiOff, 
  ShieldAlert,
  HelpCircle,
  X,
  Image as ImageIcon,
  Shuffle
} from 'lucide-react';
import { Exam, Question, ExamAttempt, ExamResult } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { saveAttemptProgress, submitExamAttempt, logSystemAction } from '../../services/db';
import { MathRenderer } from '../common/MathRenderer';

interface ExamTakingRoomProps {
  exam: Exam;
  questions: Question[];
  initialAttempt: ExamAttempt;
  onFinishExam: (result: ExamResult) => void;
  onExit: () => void;
}

export const ExamTakingRoom: React.FC<ExamTakingRoomProps> = ({
  exam,
  questions,
  initialAttempt,
  onFinishExam,
  onExit
}) => {
  const { user, profile } = useAuth();

  // Current question index (0-indexed)
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  // Dynamic answers map: { [questionId]: any }
  const [answers, setAnswers] = useState<Record<string, any>>(initialAttempt.answers || {});
  
  // Flagged questions: { [questionId]: boolean }
  const [flagged, setFlagged] = useState<Record<string, boolean>>(initialAttempt.flaggedQuestions || {});

  // Sync / Online state
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSavedTime, setLastSavedTime] = useState<string>('Vừa xong');
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Tab switch anti-cheat detection
  const [tabViolations, setTabViolations] = useState<number>(initialAttempt.tabViolations || 0);
  const [tabViolationLogs, setTabViolationLogs] = useState<string[]>(initialAttempt.tabViolationLogs || []);
  const [showTabWarningModal, setShowTabWarningModal] = useState<boolean>(false);
  const [lastViolationTime, setLastViolationTime] = useState<string>('');
  const lastViolationStamp = useRef<number>(0);

  // Countdown timer in seconds
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    const deadlineMs = new Date(initialAttempt.deadline).getTime();
    const nowMs = Date.now();
    return Math.max(0, Math.floor((deadlineMs - nowMs) / 1000));
  });

  // Modal confirm submit
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Auto-submit guard
  const hasAutoSubmitted = useRef<boolean>(false);

  // Anti-cheat tab switch listeners
  useEffect(() => {
    const handleTabViolation = (reason: string) => {
      const now = Date.now();
      if (now - lastViolationStamp.current < 2500) return; // throttle
      lastViolationStamp.current = now;

      const timeStr = new Date().toLocaleTimeString('vi-VN');
      setTabViolations(prev => {
        const next = prev + 1;
        setTabViolationLogs(logs => [...logs, `${timeStr}: ${reason}`]);
        setLastViolationTime(timeStr);
        setShowTabWarningModal(true);
        return next;
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && secondsRemaining > 0 && !hasAutoSubmitted.current) {
        handleTabViolation('Chuyển tab hoặc ẩn cửa sổ trình duyệt');
      }
    };

    const handleWindowBlur = () => {
      if (secondsRemaining > 0 && !hasAutoSubmitted.current) {
        handleTabViolation('Rời tiêu điểm màn hình thi');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [secondsRemaining]);

  // Online / Offline listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Timer countdown
  useEffect(() => {
    const timer = setInterval(() => {
      const deadlineMs = new Date(initialAttempt.deadline).getTime();
      const diff = Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000));
      setSecondsRemaining(diff);

      if (diff <= 0 && !hasAutoSubmitted.current) {
        hasAutoSubmitted.current = true;
        clearInterval(timer);
        handleAutoSubmit();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [initialAttempt.deadline]);

  // Auto-save debounced sync
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerAutoSave = (newAnswers: Record<string, any>, newFlagged: Record<string, boolean>) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setIsSaving(true);

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveAttemptProgress(
          initialAttempt.id, 
          newAnswers, 
          newFlagged, 
          tabViolations, 
          tabViolationLogs
        );
        setLastSavedTime(new Date().toLocaleTimeString('vi-VN'));
      } catch (err) {
        console.warn('Lưu bài tạm thời thất bại:', err);
      } finally {
        setIsSaving(false);
      }
    }, 800);
  };

  // Multiple Choice selection
  const handleSelectMultipleChoice = (questionId: string, optionKey: 'A' | 'B' | 'C' | 'D') => {
    if (secondsRemaining <= 0 || isSubmitting) return;
    const newAnswers = { ...answers, [questionId]: optionKey };
    setAnswers(newAnswers);
    triggerAutoSave(newAnswers, flagged);
  };

  // True / False selection
  const handleSelectTrueFalse = (questionId: string, subKey: string, value: boolean) => {
    if (secondsRemaining <= 0 || isSubmitting) return;
    const currentSub = answers[questionId] || {};
    const newAnswers = {
      ...answers,
      [questionId]: {
        ...currentSub,
        [subKey]: value
      }
    };
    setAnswers(newAnswers);
    triggerAutoSave(newAnswers, flagged);
  };

  // Fill in the blank change
  const handleFillBlankChange = (questionId: string, value: string) => {
    if (secondsRemaining <= 0 || isSubmitting) return;
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    triggerAutoSave(newAnswers, flagged);
  };

  // Essay change
  const handleEssayChange = (questionId: string, value: string) => {
    if (secondsRemaining <= 0 || isSubmitting) return;
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    triggerAutoSave(newAnswers, flagged);
  };

  // Toggle flag for review
  const handleToggleFlag = (questionId: string) => {
    const newFlagged = { ...flagged, [questionId]: !flagged[questionId] };
    setFlagged(newFlagged);
    triggerAutoSave(answers, newFlagged);
  };

  // Auto submit when time runs out
  const handleAutoSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (profile) {
        const result = await submitExamAttempt(
          initialAttempt.id,
          exam,
          profile,
          answers,
          questions,
          tabViolations
        );
        onFinishExam(result);
      }
    } catch (err) {
      console.error('Lỗi khi tự động nộp bài:', err);
    }
  };

  // Manual submit action
  const handleConfirmSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      if (profile) {
        const result = await submitExamAttempt(
          initialAttempt.id,
          exam,
          profile,
          answers,
          questions,
          tabViolations
        );
        setShowSubmitModal(false);
        onFinishExam(result);
      }
    } catch (err) {
      console.error('Lỗi khi nộp bài:', err);
      setSubmitError('Không thể nộp bài vào máy chủ. Vui lòng kiểm tra lại kết nối mạng và thử lại.');
      setIsSubmitting(false);
    }
  };

  // Format time display
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  // Timer color states
  const isDangerTime = secondsRemaining <= 60;
  const isWarningTime = secondsRemaining <= 300 && !isDangerTime;

  // Check if a question is considered answered
  const isQuestionAnswered = (q: Question) => {
    const val = answers[q.id];
    if (val === undefined || val === null || val === '') return false;
    if (q.type === 'true_false') {
      const subKeys = Object.keys(val);
      return subKeys.length > 0;
    }
    if (typeof val === 'string') {
      return val.trim().length > 0;
    }
    return true;
  };

  // Group questions into 3 distinct parts and shuffle strictly within each part
  const { displayQuestions, section1Count, section2Count, section3Count } = React.useMemo(() => {
    const p1 = questions.filter(q => q.type === 'multiple_choice');
    const p2 = questions.filter(q => q.type === 'true_false');
    const p3 = questions.filter(q => q.type === 'fill_blank' || q.type === 'essay');

    if (!exam.shuffleQuestions) {
      return {
        displayQuestions: [...p1, ...p2, ...p3],
        section1Count: p1.length,
        section2Count: p2.length,
        section3Count: p3.length
      };
    }

    const shuffleWithSeed = (list: Question[], seedNum: number): Question[] => {
      if (list.length <= 1) return list;
      const copy = [...list];
      let m = copy.length, t, i;
      let s = seedNum;
      while (m) {
        s = (s * 9301 + 49297) % 233280;
        i = Math.floor((s / 233280) * m--);
        t = copy[m];
        copy[m] = copy[i];
        copy[i] = t;
      }
      return copy;
    };

    const baseSeed = (initialAttempt.id || 'shuffle').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    // Shuffle strictly WITHIN each part (keeping Part 1 -> Part 2 -> Part 3 order fixed)
    const shuffledP1 = shuffleWithSeed(p1, baseSeed + 17);
    const shuffledP2 = shuffleWithSeed(p2, baseSeed + 53);
    const shuffledP3 = shuffleWithSeed(p3, baseSeed + 97);

    return {
      displayQuestions: [...shuffledP1, ...shuffledP2, ...shuffledP3],
      section1Count: p1.length,
      section2Count: p2.length,
      section3Count: p3.length
    };
  }, [exam.shuffleQuestions, questions, initialAttempt.id]);

  const totalQuestions = displayQuestions.length;
  const answeredCount = displayQuestions.filter(q => isQuestionAnswered(q)).length;
  const progressPercent = Math.round((answeredCount / totalQuestions) * 100);

  const currentQ = displayQuestions[currentIndex] || displayQuestions[0];
  const qType = currentQ?.type || 'multiple_choice';

  const currentSection = React.useMemo(() => {
    if (currentIndex < section1Count) {
      return {
        badge: 'PHẦN I',
        title: 'CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN',
        introText: `Thí sinh trả lời từ câu 1 đến câu ${section1Count}. Mỗi câu hỏi thí sinh chỉ chọn một phương án.`,
        rangeText: `Câu 1 - ${section1Count}`,
        color: 'from-blue-950 via-slate-900 to-indigo-950',
        badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-400/30'
      };
    } else if (currentIndex < section1Count + section2Count) {
      const start = section1Count + 1;
      const end = section1Count + section2Count;
      return {
        badge: 'PHẦN II',
        title: 'CÂU TRẮC NGHIỆM ĐÚNG / SAI',
        introText: `Thí sinh trả lời từ câu ${start} đến câu ${end}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn đúng hoặc sai.`,
        rangeText: `Câu ${start} - ${end}`,
        color: 'from-emerald-950 via-teal-950 to-slate-900',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
      };
    } else {
      const start = section1Count + section2Count + 1;
      const end = totalQuestions;
      return {
        badge: 'PHẦN III',
        title: 'CÂU TRẢ LỜI NGẮN HOẶC TỰ LUẬN',
        introText: `Thí sinh trả lời từ câu ${start} đến câu ${end}. Thí sinh điền kết quả hoặc trình bày bài làm chi tiết.`,
        rangeText: `Câu ${start} - ${end}`,
        color: 'from-purple-950 via-slate-900 to-indigo-950',
        badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-400/30'
      };
    }
  }, [currentIndex, section1Count, section2Count, totalQuestions]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col select-none">
      
      {/* Sticky Exam Header Bar */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Exam info */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-xs text-white">
              THI
            </div>
            <div>
              <h2 className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-md">
                {exam.title}
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-slate-300">
                <span>Môn: {exam.subjectName}</span>
                <span>•</span>
                <span>Khối {exam.grade}</span>
                <span>•</span>
                <span>{totalQuestions} câu</span>
                {(exam.shuffleQuestions || exam.shuffleOptions) && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[10px] font-bold">
                    🔀 Đề đã trộn
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right side: Countdown clock & Submit button */}
          <div className="flex items-center gap-3 sm:gap-4">
            
            {/* Save & Network indicator */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300">
              {isOnline ? (
                <span className="flex items-center gap-1 text-emerald-400">
                  <Wifi className="w-3.5 h-3.5" />
                  <span className="text-[11px]">{isSaving ? 'Đang lưu...' : 'Đã tự lưu'}</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-rose-400">
                  <WifiOff className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Mất kết nối</span>
                </span>
              )}
            </div>

            {/* Tab violation warning badge if > 0 */}
            {tabViolations > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/20 border border-rose-500/50 rounded-lg text-rose-300 text-xs font-bold animate-pulse">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>Rời tab: {tabViolations}</span>
              </div>
            )}

            {/* Prominent Countdown Clock */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-sm font-extrabold shadow-inner transition-colors ${
              isDangerTime 
                ? 'bg-rose-600 text-white animate-pulse' 
                : isWarningTime 
                ? 'bg-amber-500 text-slate-950 font-black' 
                : 'bg-slate-800 text-emerald-400 border border-slate-700'
            }`}>
              <Clock className="w-4 h-4 shrink-0" />
              <span>{timeFormatted}</span>
            </div>

            {/* Submit button */}
            <button
              onClick={() => setShowSubmitModal(true)}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Nộp bài</span>
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-800 h-1">
          <div 
            className="bg-emerald-500 h-1 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* Main Testing Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 flex flex-col lg:flex-row gap-6">
        
        {/* Left: Current Question Area */}
        <div className="flex-1 flex flex-col bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          
          {/* Section Introductory Banner with Explanatory Text */}
          <div className={`px-5 py-3.5 bg-gradient-to-r ${currentSection.color} text-white border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-inner`}>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase border ${currentSection.badgeColor}`}>
                  {currentSection.badge} • {currentSection.rangeText}
                </span>
                <span className="font-extrabold text-xs sm:text-sm text-white tracking-tight">
                  {currentSection.title}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium">
                {currentSection.introText}
              </p>
            </div>
            {exam.shuffleQuestions && (
              <span className="self-start sm:self-center shrink-0 inline-flex items-center gap-1 text-[10px] text-indigo-300 bg-white/10 px-2.5 py-1 rounded-lg border border-white/10">
                <Shuffle className="w-3 h-3 text-indigo-300" />
                <span>Chỉ đảo trong {currentSection.badge}</span>
              </span>
            )}
          </div>

          {/* Question Title & Actions */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-slate-900 text-white font-bold text-xs rounded-lg">
                Câu {currentIndex + 1} / {totalQuestions}
              </span>
              
              {/* Type Badge */}
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {qType === 'multiple_choice' && 'Trắc nghiệm 4 lựa chọn'}
                {qType === 'true_false' && 'Trắc nghiệm Đúng / Sai'}
                {qType === 'fill_blank' && 'Điền kết quả'}
                {qType === 'essay' && 'Tự luận'}
              </span>

              <span className="text-xs text-slate-500 font-medium">
                ({currentQ?.points || 1} điểm)
              </span>
            </div>

            {/* Flag for review button */}
            <button
              onClick={() => handleToggleFlag(currentQ.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                flagged[currentQ.id]
                  ? 'bg-amber-100 text-amber-800 border-amber-300 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Flag className={`w-3.5 h-3.5 ${flagged[currentQ.id] ? 'fill-amber-600 text-amber-600' : 'text-slate-400'}`} />
              <span>{flagged[currentQ.id] ? 'Đã đánh dấu xem lại' : 'Đánh dấu xem lại'}</span>
            </button>
          </div>

          {/* Question Prompt with MathRenderer */}
          <div className="p-6 sm:p-8 flex-1 space-y-6">
            <div className="text-base sm:text-lg font-semibold text-slate-900 leading-relaxed">
              <MathRenderer content={currentQ.prompt} />
            </div>

            {/* Display Question Image if present */}
            {currentQ.imageUrl && (
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 inline-block max-w-full">
                <img 
                  src={currentQ.imageUrl} 
                  alt="Hình minh họa câu hỏi" 
                  className="max-h-64 rounded-xl border object-contain shadow-xs bg-white" 
                />
              </div>
            )}

            {/* RENDER DYNAMIC ANSWER INTERFACES ACCORDING TO QUESTION TYPE */}

            {/* 1. MULTIPLE CHOICE (A, B, C, D) with optional shuffling */}
            {qType === 'multiple_choice' && currentQ.options && (() => {
              const defaultKeys: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
              let displayKeys = [...defaultKeys];

              if (exam.shuffleOptions) {
                // Deterministic shuffle per student attempt and question ID
                const optSeed = (initialAttempt.id + '_' + currentQ.id)
                  .split('')
                  .reduce((acc, c) => acc + c.charCodeAt(0), 0);
                let m = displayKeys.length, t, i, s = optSeed;
                while (m) {
                  s = (s * 9301 + 49297) % 233280;
                  i = Math.floor((s / 233280) * m--);
                  t = displayKeys[m];
                  displayKeys[m] = displayKeys[i];
                  displayKeys[i] = t;
                }
              }

              return (
                <div className="space-y-3.5 max-w-3xl">
                  {displayKeys.map((originalKey, visualIndex) => {
                    const visualLabel = defaultKeys[visualIndex] || originalKey;
                    const optionText = currentQ.options?.[originalKey];
                    if (!optionText && optionText !== '0') return null;
                    const isSelected = answers[currentQ.id] === originalKey;

                    return (
                      <div
                        key={originalKey}
                        onClick={() => handleSelectMultipleChoice(currentQ.id, originalKey)}
                        className={`flex items-start gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-500/20'
                            : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 border border-slate-300'
                        }`}>
                          {visualLabel}
                        </div>

                        <div className="pt-1 text-sm font-medium text-slate-800 leading-normal flex-1">
                          <MathRenderer content={optionText} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* 2. TRUE / FALSE (4 STATEMENTS a, b, c, d) */}
            {qType === 'true_false' && (
              <div className="space-y-3 max-w-3xl">
                <p className="text-xs font-bold text-slate-600">
                  Chọn Đúng hoặc Sai cho mỗi ý kiến sau:
                </p>
                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-slate-50/50">
                  {(currentQ.subQuestions || []).map((sub) => {
                    const currentAnswer = answers[currentQ.id]?.[sub.key];
                    const isTrueSelected = currentAnswer === true;
                    const isFalseSelected = currentAnswer === false;

                    return (
                      <div key={sub.key} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
                        <div className="flex items-start gap-3 flex-1">
                          <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                            {sub.key}
                          </span>
                          <div className="text-sm font-medium text-slate-800 leading-normal">
                            <MathRenderer content={sub.text} />
                          </div>
                        </div>

                        {/* Two big selection buttons & Feedback Status */}
                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 self-end sm:self-center shrink-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                              {sub.points !== undefined ? `${sub.points} điểm` : '0.25 điểm'}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleSelectTrueFalse(currentQ.id, sub.key, true)}
                              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                                isTrueSelected
                                  ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-400 font-black'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>ĐÚNG</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSelectTrueFalse(currentQ.id, sub.key, false)}
                              className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                                isFalseSelected
                                  ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-400 font-black'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>SAI</span>
                            </button>
                          </div>

                          {/* Selected notification badge */}
                          {isTrueSelected && (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 animate-in fade-in">
                              ✓ Bạn đã chọn: ĐÚNG
                            </span>
                          )}
                          {isFalseSelected && (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 animate-in fade-in">
                              ✗ Bạn đã chọn: SAI
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. FILL-IN-THE-BLANK (Trả lời ngắn / Điền kết quả) */}
            {qType === 'fill_blank' && (
              <div className="space-y-3 max-w-xl">
                <label className="block text-xs font-bold text-slate-700">
                  Nhập đáp số hoặc kết quả của bạn:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={answers[currentQ.id] || ''}
                    onChange={(e) => handleFillBlankChange(currentQ.id, e.target.value)}
                    placeholder="Ví dụ: 10, -2.5, 3/4..."
                    className="w-full text-base font-bold text-slate-900 border-2 border-emerald-500 rounded-2xl p-4 focus:ring-4 focus:ring-emerald-500/20 bg-emerald-50/20 shadow-inner"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Câu trả lời của bạn được tự động ghi nhận ngay khi bạn nhập.
                </p>
              </div>
            )}

            {/* 4. ESSAY (Tự luận) */}
            {qType === 'essay' && (
              <div className="space-y-3 max-w-3xl">
                <label className="block text-xs font-bold text-slate-700">
                  Nhập bài làm tự luận hoặc lời giải của bạn:
                </label>
                <textarea
                  value={answers[currentQ.id] || ''}
                  onChange={(e) => handleEssayChange(currentQ.id, e.target.value)}
                  placeholder="Trình bày chi tiết các bước giải, lập luận hoặc giải thích tại đây..."
                  rows={6}
                  className="w-full text-sm font-medium text-slate-800 border-2 border-slate-300 rounded-2xl p-4 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 bg-white"
                />
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Hỗ trợ xuống dòng và định dạng văn bản</span>
                  <span>Đã nhập: {String(answers[currentQ.id] || '').length} ký tự</span>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Buttons: Previous / Next */}
          <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Câu trước</span>
            </button>

            <span className="text-xs text-slate-500 font-medium">
              Đã làm: <strong className="text-emerald-700">{answeredCount}</strong> / {totalQuestions} câu
            </span>

            {currentIndex < totalQuestions - 1 ? (
              <button
                onClick={() => setCurrentIndex(currentIndex + 1)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <span>Câu tiếp theo</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setShowSubmitModal(true)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <span>Hoàn tất & Nộp bài</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Question Palette & Overview */}
        <div className="w-full lg:w-80 shrink-0 space-y-4">
          
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                Danh sách câu hỏi
              </h3>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                {progressPercent}%
              </span>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-600 inline-block"></span>
                <span>Đã làm ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-slate-200 inline-block"></span>
                <span>Chưa làm ({totalQuestions - answeredCount})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-400 inline-block"></span>
                <span>Xem lại ({Object.values(flagged).filter(Boolean).length})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded border-2 border-slate-900 inline-block"></span>
                <span>Đang chọn</span>
              </div>
            </div>

            {/* Question numbers grouped by 3 sections */}
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 py-1">
              {/* Part 1 */}
              {section1Count > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                    <span className="text-blue-700">PHẦN I: Trắc nghiệm 4 lựa chọn</span>
                    <span className="text-[10px] text-slate-400">1 - {section1Count}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {displayQuestions.slice(0, section1Count).map((q, localIdx) => {
                      const idx = localIdx;
                      const isAnswered = isQuestionAnswered(q);
                      const isFlagged = !!flagged[q.id];
                      const isCurrent = idx === currentIndex;

                      let btnClass = 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200';
                      if (isAnswered) btnClass = 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600 font-bold';
                      if (isFlagged) btnClass = 'bg-amber-400 text-slate-900 border-amber-500 font-extrabold ring-2 ring-amber-300';
                      if (isCurrent) btnClass += ' ring-2 ring-slate-900 ring-offset-1';

                      return (
                        <button
                          key={q.id}
                          onClick={() => setCurrentIndex(idx)}
                          className={`h-8 rounded-xl border text-xs font-semibold flex items-center justify-center transition-all cursor-pointer relative ${btnClass}`}
                        >
                          {idx + 1}
                          {isFlagged && <span className="w-1.5 h-1.5 rounded-full bg-rose-600 absolute top-1 right-1"></span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Part 2 */}
              {section2Count > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                    <span className="text-emerald-700">PHẦN II: Trắc nghiệm Đúng / Sai</span>
                    <span className="text-[10px] text-slate-400">{section1Count + 1} - {section1Count + section2Count}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {displayQuestions.slice(section1Count, section1Count + section2Count).map((q, localIdx) => {
                      const idx = section1Count + localIdx;
                      const isAnswered = isQuestionAnswered(q);
                      const isFlagged = !!flagged[q.id];
                      const isCurrent = idx === currentIndex;

                      let btnClass = 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200';
                      if (isAnswered) btnClass = 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600 font-bold';
                      if (isFlagged) btnClass = 'bg-amber-400 text-slate-900 border-amber-500 font-extrabold ring-2 ring-amber-300';
                      if (isCurrent) btnClass += ' ring-2 ring-slate-900 ring-offset-1';

                      return (
                        <button
                          key={q.id}
                          onClick={() => setCurrentIndex(idx)}
                          className={`h-8 rounded-xl border text-xs font-semibold flex items-center justify-center transition-all cursor-pointer relative ${btnClass}`}
                        >
                          {idx + 1}
                          {isFlagged && <span className="w-1.5 h-1.5 rounded-full bg-rose-600 absolute top-1 right-1"></span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Part 3 */}
              {section3Count > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                    <span className="text-purple-700">PHẦN III: Trả lời ngắn / Tự luận</span>
                    <span className="text-[10px] text-slate-400">{section1Count + section2Count + 1} - {totalQuestions}</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {displayQuestions.slice(section1Count + section2Count).map((q, localIdx) => {
                      const idx = section1Count + section2Count + localIdx;
                      const isAnswered = isQuestionAnswered(q);
                      const isFlagged = !!flagged[q.id];
                      const isCurrent = idx === currentIndex;

                      let btnClass = 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200';
                      if (isAnswered) btnClass = 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600 font-bold';
                      if (isFlagged) btnClass = 'bg-amber-400 text-slate-900 border-amber-500 font-extrabold ring-2 ring-amber-300';
                      if (isCurrent) btnClass += ' ring-2 ring-slate-900 ring-offset-1';

                      return (
                        <button
                          key={q.id}
                          onClick={() => setCurrentIndex(idx)}
                          className={`h-8 rounded-xl border text-xs font-semibold flex items-center justify-center transition-all cursor-pointer relative ${btnClass}`}
                        >
                          {idx + 1}
                          {isFlagged && <span className="w-1.5 h-1.5 rounded-full bg-rose-600 absolute top-1 right-1"></span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Submit inside Palette */}
            <button
              onClick={() => setShowSubmitModal(true)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Nộp bài thi ngay</span>
            </button>
          </div>

          {/* Test security tips card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 space-y-1">
            <p className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-indigo-600" />
              Quy chế thi trực tuyến:
            </p>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Bài làm được tự động đồng bộ liên tục. Khi hết thời gian, hệ thống sẽ tự khóa bài và ghi nhận điểm.
            </p>
          </div>
        </div>
      </main>

      {/* Confirmation Modal before Submit */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Send className="w-5 h-5 text-emerald-600" />
                Xác nhận nộp bài thi
              </h3>
              <button 
                onClick={() => setShowSubmitModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <p>Số câu đã trả lời: <strong className="text-emerald-700">{answeredCount} / {totalQuestions}</strong> câu</p>
                <p>Số câu chưa trả lời: <strong className="text-amber-700">{totalQuestions - answeredCount}</strong> câu</p>
                <p>Thời gian còn lại: <strong>{timeFormatted}</strong></p>
              </div>

              {totalQuestions - answeredCount > 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 text-amber-800 rounded-xl border border-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    Bạn vẫn còn {totalQuestions - answeredCount} câu chưa trả lời. Bạn có chắc chắn muốn nộp bài ngay lúc này?
                  </span>
                </div>
              )}

              {submitError && (
                <div className="p-3 bg-rose-50 text-rose-800 rounded-xl border border-rose-200 text-xs font-semibold">
                  {submitError}
                </div>
              )}

              <p className="text-slate-500 text-[11px]">
                Sau khi nộp bài, bạn không thể thay đổi đáp án. Điểm số sẽ được tính toán và công bố theo cài đặt của giáo viên.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Tiếp tục làm bài
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmSubmit}
                className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'Đang chấm điểm...' : 'Xác nhận nộp bài'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Anti-Cheat Warning Modal */}
      {showTabWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border-4 border-rose-500 max-w-lg w-full p-6 sm:p-8 space-y-5 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner ring-4 ring-rose-200">
              <ShieldAlert className="w-9 h-9 animate-bounce" />
            </div>

            <div className="text-center space-y-2">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-700 tracking-wider uppercase">
                Cảnh báo kỷ luật thi cử • Lần vi phạm {tabViolations}
              </span>
              <h3 className="text-xl font-black text-slate-900 leading-tight">
                PHÁT HIỆN RỜI MÀN HÌNH THI!
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Hệ thống EduTest phát hiện bạn vừa rời khỏi màn hình làm bài thi (chuyển sang tab khác, mở ứng dụng khác hoặc thu nhỏ trình duyệt).
              </p>
            </div>

            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 space-y-2 text-xs">
              <div className="flex items-center justify-between text-rose-900 font-bold">
                <span>Số lần vi phạm đã ghi nhận:</span>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-mono text-xs">
                  {tabViolations} lần
                </span>
              </div>
              <p className="text-[11px] text-rose-700 leading-relaxed">
                ⚠️ Mọi thời điểm chuyển tab đều được tự động lưu vào nhật ký giám sát bài thi của Giám thị & Giáo viên. Tái phạm nhiều lần có thể bị hủy kết quả bài thi theo quy chế thi trực tuyến.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowTabWarningModal(false)}
              className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Tôi cam kết quay lại làm bài nghiêm túc</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
