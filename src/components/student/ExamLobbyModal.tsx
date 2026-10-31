import React, { useState, useEffect } from 'react';
import { 
  X, 
  Clock, 
  BookOpen, 
  Play, 
  GraduationCap,
  School,
  User,
  AlertCircle,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  LogIn
} from 'lucide-react';
import { Exam, Question, SchoolClass } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { startOrCreateAttempt, getClasses, logSystemAction } from '../../services/db';

interface ExamLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam;
  questions: Question[];
  onStartExam: (attempt: any) => void;
  onOpenLoginModal?: () => void;
}

export const ExamLobbyModal: React.FC<ExamLobbyModalProps> = ({
  isOpen,
  onClose,
  exam,
  questions,
  onStartExam,
  onOpenLoginModal
}) => {
  const { user, profile } = useAuth();
  const [isStarting, setIsStarting] = useState(false);
  const [inputCode, setInputCode] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestClass, setGuestClass] = useState('10A1');
  const [validationError, setValidationError] = useState('');
  const [lockoutRemaining, setLockoutRemaining] = useState<number | null>(null);
  const [systemClasses, setSystemClasses] = useState<SchoolClass[]>([]);

  const isExamSecured = Boolean(exam.isSecure || exam.examCode || (exam.classIds && exam.classIds.length > 0));

  useEffect(() => {
    if (!isOpen) return;
    setValidationError('');
    setInputCode('');
    setLockoutRemaining(null);

    getClasses()
      .then(list => {
        setSystemClasses(list);
        if (list.length > 0) {
          setGuestClass(list[0].name);
        }
      })
      .catch(err => console.warn('Could not load classes for lobby:', err));
  }, [isOpen]);

  // Handle countdown if locked
  useEffect(() => {
    if (!lockoutRemaining || lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemaining(prev => {
        if (!prev || prev <= 1) {
          clearInterval(timer);
          setValidationError('');
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  if (!isOpen) return null;

  // Check 3 conditions
  const isRegisteredAccount = Boolean(profile && profile.role === 'student' && profile.status === 'active');
  
  // Class assignment condition
  const hasClassRestriction = Boolean(exam.classIds && exam.classIds.length > 0);
  const studentAssignedClass = profile?.className || profile?.classIds?.[0] || '';
  const isClassAssigned = !hasClassRestriction || (Boolean(studentAssignedClass) && exam.classIds!.some(c => 
    c.trim().toUpperCase() === studentAssignedClass.trim().toUpperCase()
  ));

  const handleStart = async () => {
    setValidationError('');

    // 1. Condition 1: Check Registered Account for protected exams
    if (isExamSecured && !isRegisteredAccount) {
      setValidationError('Kỳ thi này yêu cầu bạn phải có tài khoản học sinh đã được đăng ký và đăng nhập vào hệ thống.');
      return;
    }

    // Fallback for purely free/open public exams without restrictions
    if (!profile && !guestName.trim()) {
      setValidationError('Vui lòng nhập họ và tên của bạn để bắt đầu làm bài.');
      return;
    }

    // 2. Condition 2: Check Class Assignment
    if (hasClassRestriction && !isClassAssigned) {
      setValidationError(`Bạn không thuộc lớp được phân công tham gia bài thi này. (Lớp của bạn: "${studentAssignedClass || 'Chưa có lớp'}", Lớp được giao: ${exam.classIds!.join(', ')}).`);
      return;
    }

    // 3. Condition 3: Check Exam Code with Server Verification & Rate Limiting
    const expectedCode = exam.examCode || (exam as any).trialCode;
    if (expectedCode) {
      if (!inputCode.trim()) {
        setValidationError('Vui lòng nhập mã bảo mật đề thi do giáo viên cung cấp để mở đề.');
        return;
      }

      setIsStarting(true);
      try {
        const verifyRes = await fetch('/api/verify-exam-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: profile?.id || 'guest',
            studentName: profile?.displayName || guestName.trim(),
            studentClass: studentAssignedClass || guestClass,
            isRegistered: isRegisteredAccount,
            examId: exam.id,
            examTitle: exam.title,
            allowedClassIds: exam.classIds || [],
            examCode: inputCode.trim(),
            requiredExamCode: expectedCode,
            openTime: exam.openTime,
            closeTime: exam.closeTime,
            requiresAuth: isExamSecured
          })
        });

        const verifyData = await verifyRes.json();

        if (!verifyRes.ok || !verifyData.success) {
          if (verifyData.isLocked && verifyData.remainingSeconds) {
            setLockoutRemaining(verifyData.remainingSeconds);
          }
          setValidationError(verifyData.error || 'Xác thực mã đề thi không thành công.');
          setIsStarting(false);

          // Log security failure to system logs
          if (profile) {
            logSystemAction(
              'EXAM_ACCESS_BLOCKED',
              profile.id,
              profile.email,
              exam.id,
              'exam',
              `Thí sinh nhập sai mã đề thi hoặc bị chặn (${verifyData.error})`
            ).catch(() => {});
          }
          return;
        }
      } catch (e) {
        console.warn('Verify API note:', e);
      }
    }

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

      // Audit log successful access
      logSystemAction(
        'EXAM_ACCESS_GRANTED',
        effectiveProfile.id,
        effectiveProfile.email,
        exam.id,
        'exam',
        `Thí sinh bắt đầu làm bài thi: ${exam.title}`
      ).catch(() => {});

      onStartExam(attempt);
      onClose();
    } catch (err) {
      console.error('Không thể bắt đầu kỳ thi:', err);
      setValidationError('Không thể khởi tạo lượt thi. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại.');
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
                {isExamSecured ? 'Phòng thi khảo thí bảo mật' : 'Phòng thi trực tuyến'}
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
                <p className="text-slate-400 text-[10px]">Thời gian làm bài</p>
                <p className="font-extrabold text-slate-900 dark:text-slate-100">{exam.durationMinutes} phút</p>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <div>
                <p className="text-slate-400 text-[10px]">Số lượng câu hỏi</p>
                <p className="font-extrabold text-slate-900 dark:text-slate-100">{questions.length || exam.questionCount} câu</p>
              </div>
            </div>
          </div>

          {/* Condition 1: Check Registered Student Account */}
          {isExamSecured && !profile ? (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-300 dark:border-amber-700/60 space-y-2.5">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <h4 className="font-bold text-amber-900 dark:text-amber-200">
                    Yêu cầu tài khoản học sinh đã đăng ký
                  </h4>
                  <p className="text-[11px] text-amber-800/90 dark:text-amber-300 mt-1">
                    Đây là bài thi được giáo viên phân công. Vui lòng đăng nhập bằng tài khoản học sinh để hệ thống kiểm tra danh sách lớp và cấp quyền vào thi.
                  </p>
                </div>
              </div>

              {onOpenLoginModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenLoginModal();
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Đăng nhập tài khoản ngay</span>
                </button>
              )}
            </div>
          ) : profile ? (
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold">Thí sinh dự thi:</span>
                <strong className="text-slate-900 dark:text-slate-100 text-sm">{profile.displayName}</strong>
                <span className="text-[11px] text-slate-500 ml-1.5 font-bold">
                  (Lớp {profile.className || 'Chưa gán lớp'})
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-300">
                <ShieldCheck className="w-3 h-3" />
                Tài khoản hợp lệ
              </span>
            </div>
          ) : (
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
                    placeholder="Ví dụ: Nguyễn Văn An"
                    value={guestName}
                    onChange={(e) => {
                      setGuestName(e.target.value);
                      if (validationError) setValidationError('');
                    }}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
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
          )}

          {/* Condition 2: Class Assignment check banner */}
          {hasClassRestriction && (
            <div className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 ${
              isClassAssigned 
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' 
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              <School className={`w-4 h-4 shrink-0 mt-0.5 ${isClassAssigned ? 'text-emerald-600' : 'text-rose-600'}`} />
              <div>
                <p className="font-bold">
                  {isClassAssigned ? '✓ Thuộc danh sách lớp được phân công thi' : '⛔ Không thuộc lớp phân công'}
                </p>
                <p className="text-[11px] opacity-80 mt-0.5">
                  Lớp được giao: <strong>{exam.classIds!.join(', ')}</strong> • Lớp của bạn: <strong>{studentAssignedClass || 'Chưa gán'}</strong>
                </p>
              </div>
            </div>
          )}

          {/* Condition 3: Exam Code Input */}
          {(exam.examCode || (exam as any).trialCode) && (
            <div className="space-y-1.5 p-3.5 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800">
              <label className="block text-[11px] font-bold text-indigo-950 dark:text-indigo-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Mã bảo mật đề thi do giáo viên cung cấp:</span>
                </span>
                <span className="text-rose-500 font-extrabold">* Bắt buộc</span>
              </label>
              <input
                type="text"
                disabled={lockoutRemaining !== null && lockoutRemaining > 0}
                placeholder="Nhập mã bảo mật (Ví dụ: THI_TOAN_6A)..."
                value={inputCode}
                onChange={(e) => {
                  setInputCode(e.target.value.toUpperCase());
                  if (validationError) setValidationError('');
                }}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl text-xs font-mono font-bold tracking-wider text-indigo-950 dark:text-indigo-100 uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
              <p className="text-[10px] text-slate-500">
                Hệ thống tự động khóa 2 phút nếu nhập sai quá 5 lần để đảm bảo an toàn khảo thí.
              </p>
            </div>
          )}

          {/* Validation or Lockout Error Message */}
          {validationError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span>{validationError}</span>
                {lockoutRemaining && (
                  <p className="font-bold text-rose-800 mt-1">
                    Thời gian mở khóa sau: {lockoutRemaining} giây
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Action Button: BẮT ĐẦU LÀM BÀI */}
          <div className="pt-1">
            <button
              disabled={
                isStarting || 
                (lockoutRemaining !== null && lockoutRemaining > 0) ||
                (isExamSecured && !isRegisteredAccount) ||
                (hasClassRestriction && !isClassAssigned) ||
                (!profile && !guestName.trim()) ||
                (Boolean(exam.examCode || (exam as any).trialCode) && !inputCode.trim())
              }
              onClick={handleStart}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>
                {isStarting 
                  ? 'Đang xác thực bảo mật & mở phòng thi...' 
                  : (lockoutRemaining ? `Tạm khóa (${lockoutRemaining}s)` : 'Bắt đầu làm bài thi')}
              </span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
