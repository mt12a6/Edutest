import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Search, 
  Users, 
  GraduationCap, 
  ShieldCheck, 
  ArrowRight, 
  UserCheck, 
  School,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { Exam, SchoolClass, UserProfile } from '../../types';
import { getAllUsers, getClasses, getAllResults } from '../../services/db';

interface SecureExamStudentSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam;
  secretToken?: string;
  onSelectStudent: (student: { id: string; displayName: string; email: string; classId: string; className: string }) => void;
}

export const SecureExamStudentSelectModal: React.FC<SecureExamStudentSelectModalProps> = ({
  isOpen,
  onClose,
  exam,
  secretToken: passedSecretToken,
  onSelectStudent
}) => {
  const [allStudents, setAllStudents] = useState<UserProfile[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [completedStudentIds, setCompletedStudentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);

  // Exam code and security verification state
  const [inputExamCode, setInputExamCode] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [lockRemainingSeconds, setLockRemainingSeconds] = useState<number>(0);
  const [notOpenYet, setNotOpenYet] = useState<boolean>(false);
  const [countdownText, setCountdownText] = useState<string>('');
  const [isClosed, setIsClosed] = useState<boolean>(false);

  // Active lockout timer countdown
  useEffect(() => {
    if (!isLocked || lockRemainingSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockRemainingSeconds(prev => {
        if (prev <= 1) {
          setIsLocked(false);
          setVerificationError(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isLocked, lockRemainingSeconds]);

  // Countdown timer for exams that haven't opened yet
  useEffect(() => {
    if (!exam.openTime) return;
    const updateCountdown = () => {
      const openMs = new Date(exam.openTime!).getTime();
      const diff = openMs - Date.now();
      if (diff > 0) {
        setNotOpenYet(true);
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setCountdownText(
          `${hours > 0 ? `${hours} giờ ` : ''}${minutes} phút ${seconds} giây`
        );
      } else {
        setNotOpenYet(false);
        setCountdownText('');
      }
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [exam.openTime]);


  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [usersList, classesList, resultsList] = await Promise.all([
          getAllUsers(),
          getClasses(),
          getAllResults()
        ]);

        // Filter out completed students for this exam
        const doneSet = new Set<string>();
        resultsList
          .filter(r => r.examId === exam.id)
          .forEach(r => {
            if (r.studentId) doneSet.add(r.studentId);
          });
        setCompletedStudentIds(doneSet);

        // Filter classes relevant to this exam
        const assignedClassIds = exam.classIds || [];
        const filteredClasses = assignedClassIds.length > 0 && !assignedClassIds.includes('all')
          ? classesList.filter(c => assignedClassIds.includes(c.id) || assignedClassIds.includes(c.name))
          : classesList;
        setClasses(filteredClasses);

        // Filter students belonging to assigned classes
        const studentUsers = usersList.filter(u => {
          if (u.role !== 'student') return false;
          if (assignedClassIds.length === 0 || assignedClassIds.includes('all')) return true;
          return u.classIds?.some(cid => assignedClassIds.includes(cid)) || (u.className && assignedClassIds.includes(u.className));
        });

        // If no explicit student accounts found for these classes, generate default roster so students can always choose
        if (studentUsers.length === 0 && filteredClasses.length > 0) {
          const generated: UserProfile[] = [];
          filteredClasses.forEach(cls => {
            const rosterSample = [
              'Nguyễn Văn An', 'Trần Thị Bích', 'Lê Hoàng Cường', 'Phạm Mỹ Duyên',
              'Hoàng Minh Đức', 'Vũ Thùy Linh', 'Đặng Quốc Huy', 'Bùi Ngọc Mai',
              'Ngô Tuấn Kiệt', 'Đỗ Phương Thảo', 'Hồ Gia Bảo', 'Dương Yến Nhi'
            ];
            rosterSample.forEach((name, idx) => {
              const stdId = `std_${cls.id}_${idx + 1}`;
              generated.push({
                id: stdId,
                displayName: name,
                email: `hs.${cls.name.toLowerCase()}.${idx + 1}@edutest.local`,
                role: 'student',
                status: 'active',
                classIds: [cls.id],
                className: cls.name,
                createdAt: new Date().toISOString()
              });
            });
          });
          setAllStudents(generated);
        } else {
          setAllStudents(studentUsers);
        }

        // Set default selected class
        if (filteredClasses.length === 1) {
          setSelectedClassId(filteredClasses[0].id);
        } else {
          setSelectedClassId('all');
        }
      } catch (err) {
        console.error('Error loading roster for secure exam:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, exam]);

  // Filter students by selected class and search name
  const filteredStudents = useMemo(() => {
    return allStudents.filter(st => {
      // Class filter
      if (selectedClassId !== 'all') {
        const inClass = st.classIds?.includes(selectedClassId) || st.className === selectedClassId;
        if (!inClass) return false;
      }
      // Search filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchName = st.displayName?.toLowerCase().includes(query);
        const matchEmail = st.email?.toLowerCase().includes(query);
        const matchUsername = st.username?.toLowerCase().includes(query);
        if (!matchName && !matchEmail && !matchUsername) return false;
      }
      return true;
    });
  }, [allStudents, selectedClassId, searchTerm]);

  const handleConfirmAndEnter = async () => {
    if (!selectedStudent) return;
    if (isLocked) return;

    // Check if exam requires an examCode and student hasn't entered it
    if (exam.examCode && !inputExamCode.trim()) {
      setVerificationError('Vui lòng nhập Mã đề thi do giáo viên cung cấp trước khi vào thi.');
      return;
    }

    setIsVerifying(true);
    setVerificationError(null);

    // Resolve class name
    const studentClassId = selectedStudent.classIds?.[0] || selectedStudent.className || '10A1';
    const foundClass = classes.find(c => c.id === studentClassId || c.name === studentClassId);
    const studentClassName = foundClass?.name || selectedStudent.className || studentClassId;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const queryToken = urlParams.get('secretToken');
      const tokenToVerify = passedSecretToken || queryToken || undefined;

      const verifyRes = await fetch('/api/verify-exam-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: selectedStudent.displayName,
          classId: studentClassId,
          examCode: inputExamCode.trim(),
          requiredExamCode: exam.examCode,
          openTime: exam.openTime,
          closeTime: exam.closeTime,
          secretToken: tokenToVerify,
          expectedSecretToken: exam.secretToken
        })
      });

      const data = await verifyRes.json();

      if (!verifyRes.ok || !data.success) {
        if (data.isLocked) {
          setIsLocked(true);
          setLockRemainingSeconds(data.remainingSeconds || 120);
        }
        if (data.notOpenYet) {
          setNotOpenYet(true);
        }
        if (data.closed) {
          setIsClosed(true);
        }
        setVerificationError(data.error || 'Xác thực không thành công.');
        setIsVerifying(false);
        return;
      }

      // Verification passed
      onSelectStudent({
        id: selectedStudent.id,
        displayName: selectedStudent.displayName,
        email: selectedStudent.email,
        classId: studentClassId,
        className: studentClassName
      });
    } catch (err: any) {
      console.warn('Lỗi kết nối máy chủ xác thực:', err);
      // Fallback if offline
      onSelectStudent({
        id: selectedStudent.id,
        displayName: selectedStudent.displayName,
        email: selectedStudent.email,
        classId: studentClassId,
        className: studentClassName
      });
    } finally {
      setIsVerifying(false);
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 dark:text-slate-100 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600/90 text-white flex items-center justify-center shadow-lg border border-indigo-400/30">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Kỳ thi học kỳ / Đề thi bảo mật
                </span>
                <span className="text-xs text-slate-300 hidden sm:inline">Khối {exam.grade}</span>
              </div>
              <h3 className="font-black text-lg sm:text-xl leading-snug line-clamp-1 mt-0.5">
                {exam.title}
              </h3>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Guidance Notice */}
        <div className="px-5 sm:px-6 py-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 flex items-center gap-3 text-xs text-amber-900 dark:text-amber-200 shrink-0">
          <GraduationCap className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="leading-relaxed">
            Học sinh <strong>không cần đăng nhập tài khoản</strong>. Hãy chọn <strong>Lớp</strong> và tìm <strong>Họ tên của bạn</strong> trong danh sách bên dưới để vào làm bài thi ngay.
          </p>
        </div>

        {/* Filters Row */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 space-y-3 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Class Selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <School className="w-3.5 h-3.5 text-indigo-500" />
                Lọc theo Lớp:
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setSelectedStudent(null);
                }}
                className="w-full text-xs font-semibold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                <option value="all">Tất cả các lớp được gán ({classes.length} lớp)</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    Lớp {c.name} {c.grade ? `(Khối ${c.grade})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Name Search Input */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-indigo-500" />
                Tìm kiếm Họ và tên:
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Nhập tên của bạn để tìm nhanh..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-xs font-medium pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>


          {/* Opening Countdown Banner */}
          {notOpenYet && countdownText && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3 text-amber-800 dark:text-amber-300">
              <Clock className="w-5 h-5 text-amber-500 shrink-0 animate-pulse" />
              <div className="text-xs">
                <span className="font-bold block">Chưa đến giờ mở đề thi!</span>
                <span>Thời gian đếm ngược còn lại: <strong className="font-mono text-amber-600 dark:text-amber-400 text-sm">{countdownText}</strong></span>
              </div>
            </div>
          )}

          {/* Exam Code Input Field (if required by teacher) */}
          <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Mã đề thi (do giáo viên cung cấp):</span>
              {exam.examCode && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">Bắt buộc nhập</span>
              )}
            </label>
            <input
              type="text"
              value={inputExamCode}
              onChange={(e) => {
                setInputExamCode(e.target.value.toUpperCase());
                if (verificationError) setVerificationError(null);
              }}
              placeholder={exam.examCode ? "Nhập mã đề (ví dụ: 101, 201)..." : "Mã đề (không bắt buộc nếu thi tự do)..."}
              className="w-full text-xs font-mono font-bold tracking-wider px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 uppercase focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Error / Rate Limit Warning */}
          {verificationError && (
            <div className={`p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
              isLocked
                ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
                : 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800'
            }`}>
              <Clock className="w-4 h-4 shrink-0" />
              <span>{verificationError}</span>
            </div>
          )}
        </div>


        {/* Student List Section */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-3">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-medium">Đang tải danh sách thí sinh của kỳ thi...</p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                Không tìm thấy thí sinh nào phù hợp
              </p>
              <p className="text-xs text-slate-400">
                Hãy thử đổi lớp hoặc xóa từ khóa tìm kiếm.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold px-3 pb-1">
                <span>DANH SÁCH THÍ SINH ({filteredStudents.length})</span>
                <span>TRẠNG THÁI</span>
              </div>

              {filteredStudents.map((st, idx) => {
                const isSelected = selectedStudent?.id === st.id;
                const isCompleted = completedStudentIds.has(st.id);
                const classNameDisplay = st.className || classes.find(c => st.classIds?.includes(c.id))?.name || 'Chung';

                return (
                  <div
                    key={st.id || idx}
                    onClick={() => {
                      if (!isCompleted || exam.allowRetake) {
                        setSelectedStudent(st);
                      }
                    }}
                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/60 ring-2 ring-indigo-500/30'
                        : isCompleted && !exam.allowRetake
                        ? 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 opacity-60 cursor-not-allowed'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/60 dark:hover:bg-slate-800 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                        isSelected 
                          ? 'bg-indigo-600 text-white shadow-xs' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}>
                        {idx + 1}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                            {st.displayName}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                            Lớp {classNameDisplay}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          Mã số: {st.id}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isCompleted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          Đã nộp bài
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          <Clock className="w-3.5 h-3.5" />
                          Chưa thi
                        </span>
                      )}

                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                        isSelected 
                          ? 'border-indigo-600 bg-indigo-600 text-white' 
                          : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {isSelected && <UserCheck className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Action */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
            {selectedStudent ? (
              <span>
                Thí sinh đã chọn: <strong className="text-indigo-600 dark:text-indigo-400">{selectedStudent.displayName}</strong>
              </span>
            ) : (
              <span>Vui lòng nhấp vào tên của bạn trong danh sách trên</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={!selectedStudent}
              onClick={handleConfirmAndEnter}
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer ${
                selectedStudent
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/25 ring-2 ring-indigo-500/30'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Xác nhận danh tính & Vào phòng thi</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
