import React, { useState } from 'react';
import { 
  X, 
  Clock, 
  BookOpen, 
  ShieldCheck, 
  Award, 
  AlertCircle, 
  Play, 
  Layers,
  GraduationCap
} from 'lucide-react';
import { Exam, Question, SchoolClass } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { startOrCreateAttempt } from '../../services/db';

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
  const [agreedToRules, setAgreedToRules] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestClass, setGuestClass] = useState('');
  const [nameError, setNameError] = useState('');

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

      const attempt = await startOrCreateAttempt(exam, effectiveProfile);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-teal-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                Phòng thi trực tuyến
              </span>
              <h3 className="font-extrabold text-base leading-tight">
                {exam.title}
              </h3>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Exam specifications */}
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
              <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <p className="text-slate-400 text-[10px]">Thời lượng</p>
                <p className="font-bold text-slate-800">{exam.durationMinutes} phút</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
              <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
              <div>
                <p className="text-slate-400 text-[10px]">Số lượng câu</p>
                <p className="font-bold text-slate-800">{questions.length || exam.questionCount} câu hỏi</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
              <Award className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <p className="text-slate-400 text-[10px]">Thang điểm</p>
                <p className="font-bold text-slate-800">{exam.maxScore || 10} điểm (Đạt: {exam.passScore || 5}đ)</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
              <Layers className="w-4 h-4 text-rose-600 shrink-0" />
              <div>
                <p className="text-slate-400 text-[10px]">Môn học</p>
                <p className="font-bold text-slate-800">{exam.subjectName} - K{exam.grade}</p>
              </div>
            </div>
          </div>

          {(exam.shuffleQuestions || exam.shuffleOptions) && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs flex items-center gap-2.5 text-indigo-900">
              <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 text-[10px] font-black">
                🔀
              </div>
              <div>
                <p className="font-bold text-[11px]">Kỳ thi kích hoạt chế độ Trộn đề</p>
                <p className="text-[10px] text-indigo-700">Trật tự câu hỏi và phương án được xáo trộn tự động cho từng học sinh để chống gian lận.</p>
              </div>
            </div>
          )}

          {/* Guest Candidate Info if not logged in */}
          {!profile && (
            <div className="p-4 bg-emerald-50/90 border border-emerald-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                <span className="p-1 rounded-lg bg-emerald-600 text-white text-[10px]">FREE</span>
                <span>Chế độ thi tự do (Không cần tài khoản)</span>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed">
                Đề thi này mở tự do cho mọi học sinh. Vui lòng nhập họ tên của bạn để hệ thống chấm và ghi nhận kết quả bài thi:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-800 mb-1">
                    Họ và tên thí sinh: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Nguyễn Văn An"
                    value={guestName}
                    onChange={(e) => {
                      setGuestName(e.target.value);
                      if (nameError) setNameError('');
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                  />
                  {nameError && (
                    <p className="text-[10px] text-rose-600 font-bold mt-1">{nameError}</p>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-800 mb-1">
                    Lớp / Trường (tuỳ chọn):
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 10A1 hoặc Tự do"
                    value={guestClass}
                    onChange={(e) => setGuestClass(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Rules and Honor code */}
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-2 text-amber-900">
            <div className="font-bold flex items-center gap-1.5 text-amber-800">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              Quy định phòng thi trực tuyến:
            </div>
            <ul className="list-disc pl-5 space-y-1 text-slate-700 text-[11px]">
              <li>Thời gian làm bài sẽ được tính ngay sau khi bạn bấm <strong>"Bắt đầu làm bài"</strong>.</li>
              <li>Hệ thống tự động lưu câu trả lời mỗi khi bạn chọn đáp án.</li>
              <li>Nếu mất mạng hoặc tải lại trang, hãy mở lại đề thi để tiếp tục thời gian còn lại.</li>
              <li>Khi hết giờ, hệ thống sẽ tự động khóa bài và nộp kết quả.</li>
            </ul>
          </div>

          {/* Agreement Checkbox */}
          <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreedToRules}
              onChange={(e) => setAgreedToRules(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
            />
            <span>Tôi đã hiểu rõ quy chế phòng thi và sẵn sàng bắt đầu làm bài trung thực.</span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl cursor-pointer"
          >
            Để sau
          </button>
          <button
            disabled={!agreedToRules || isStarting || (!profile && !guestName.trim())}
            onClick={handleStart}
            className="px-6 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>{isStarting ? 'Đang mở đề thi...' : 'Bắt đầu làm bài'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

