import React, { useState, useEffect } from 'react';
import { 
  X, 
  Clock, 
  BookOpen, 
  Play, 
  GraduationCap,
  School,
  User,
  AlertCircle
} from 'lucide-react';
import { Exam, Question, SchoolClass } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { startOrCreateAttempt, getClasses } from '../../services/db';

interface ExamLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam;
  questions: Question[];
  onStartExam: (attempt: any) => void;
}

export const ExamLobbyModal: React.FC<ExamLobbyModalProps> = ({
  isOpen,
  onClose,
  exam,
  questions,
  onStartExam
}) => {
  const { profile } = useAuth();
  const [isStarting, setIsStarting] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestClass, setGuestClass] = useState('10A1');
  const [nameError, setNameError] = useState('');
  const [systemClasses, setSystemClasses] = useState<SchoolClass[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    getClasses()
      .then(list => {
        setSystemClasses(list);
        if (list.length > 0) {
          setGuestClass(list[0].name);
        }
      })
      .catch(err => console.warn('Could not load classes for lobby:', err));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStart = async () => {
    if (!profile && !guestName.trim()) {
      setNameError('Vui lòng nhập họ và tên của bạn để bắt đầu làm bài.');
      return;
    }
    setNameError('');
    setIsStarting(true);
    try {
      const effectiveProfile = profile || {
        id: 'guest_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
        username: (guestName.trim() || 'hocsinh_tudo').replace(/\s+/g, '_').toLowerCase(),
        displayName: guestName.trim() || 'Học sinh tự do',
        email: `${(guestName.trim() || 'guest').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}@edutest.local`,
        role: 'student' as const,
        status: 'active' as const,
        className: guestClass.trim() || 'Tự do',
        classIds: [guestClass.trim() || 'Tự do'],
        createdAt: new Date().toISOString()
      };

      const attempt = await startOrCreateAttempt(exam, effectiveProfile, questions.length);
      onStartExam(attempt);
      onClose();
    } catch (err) {
      console.error('Không thể bắt đầu kỳ thi:', err);
      setNameError('Không thể khởi tạo lượt thi. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại.');
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full overflow-hidden animate-in zoom-in-95">
        
        {/* Compact Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                Phòng thi trực tuyến
              </span>
              <h3 className="font-black text-sm sm:text-base leading-snug line-clamp-1">
                {exam.title}
              </h3>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Compact Body */}
        <div className="p-4 sm:p-5 space-y-4">
          
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="text-slate-400 text-[10px]">Thời gian</p>
                <p className="font-extrabold text-slate-900 dark:text-slate-100">{exam.durationMinutes} phút</p>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <div>
                <p className="text-slate-400 text-[10px]">Số câu hỏi</p>
                <p className="font-extrabold text-slate-900 dark:text-slate-100">{questions.length || exam.questionCount} câu</p>
              </div>
            </div>
          </div>

          {/* Quick Student Identification */}
          {!profile ? (
            <div className="space-y-3 bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-800">
              <div className="text-[11px] font-bold text-emerald-950 dark:text-emerald-300">
                Nhập thông tin thí sinh để ghi nhận bài thi:
              </div>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Họ và tên thí sinh:</span>
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Ví dụ: Nguyễn Văn An"
                    value={guestName}
                    onChange={(e) => {
                      setGuestName(e.target.value);
                      if (nameError) setNameError('');
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                  {nameError && (
                    <p className="text-[10px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      <span>{nameError}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                    <School className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Lớp học:</span>
                  </label>
                  <select
                    value={guestClass}
                    onChange={(e) => setGuestClass(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    {systemClasses.map(c => (
                      <option key={c.id} value={c.name}>
                        Lớp {c.name} {c.grade ? `(Khối ${c.grade})` : ''}
                      </option>
                    ))}
                    <option value="Tự do">Thí sinh tự do</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Thí sinh dự thi:</span>
                <strong className="text-slate-900 dark:text-slate-100 text-sm">{profile.displayName}</strong>
                <span className="text-[11px] text-slate-500 ml-1.5">({profile.className || 'Học sinh'})</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full">
                Đã đăng nhập
              </span>
            </div>
          )}

          {/* Action Button: BẮT ĐẦU LÀM BÀI NGAY */}
          <div className="pt-1">
            <button
              disabled={isStarting || (!profile && !guestName.trim())}
              onClick={handleStart}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{isStarting ? 'Đang mở phòng thi...' : 'Bắt đầu làm bài'}</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
