import React, { useState } from 'react';
import { 
  X, 
  LogIn, 
  User, 
  Lock, 
  AlertTriangle, 
  BookOpen, 
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { loginWithGoogle, loginWithCredentials, isLoading, error, clearError } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'google' | 'credentials'>('google');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCredentialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setLocalError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    setLocalError(null);
    clearError();
    const success = await loginWithCredentials(identifier.trim(), password.trim());
    if (success) {
      onClose();
    } else {
      setLocalError('Tên đăng nhập hoặc mật khẩu không chính xác.');
    }
  };

  const handleGoogleLogin = async () => {
    setLocalError(null);
    clearError();
    try {
      await loginWithGoogle();
      onClose();
    } catch {
      // handled in context
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-teal-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-md">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">
                Đăng nhập EduTest
              </h3>
              <p className="text-xs text-slate-300">
                Hệ thống thi trực tuyến thông minh
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-100 border-b border-slate-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('google')}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'google'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Tài khoản Google
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('credentials')}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'credentials'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Tên đăng nhập & Mật khẩu
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          
          {(localError || error) && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{localError || error}</span>
            </div>
          )}

          {/* Tab 1: Google Sign In */}
          {activeTab === 'google' && (
            <div className="space-y-4 text-center py-2">
              <p className="text-xs text-slate-600 leading-relaxed">
                Đăng nhập nhanh chóng và an toàn bằng tài khoản Google đã được nhà trường cấp quyền.
              </p>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{isLoading ? 'Đang xác thực...' : 'Đăng nhập với Google'}</span>
              </button>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 text-left">
                <strong>Ghi chú:</strong> Tài khoản quản trị viên đầu tiên được tự động kích hoạt cho <code>mt12a6@gmail.com</code>.
              </div>
            </div>
          )}

          {/* Tab 2: Username & Password Sign In */}
          {activeTab === 'credentials' && (
            <form onSubmit={handleCredentialSubmit} className="space-y-3.5 text-xs">
              <p className="text-slate-500 text-[11px]">
                Dành cho tài khoản học sinh, giáo viên được nhập danh sách từ tệp Excel / CSV của trường.
              </p>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tên đăng nhập hoặc Email:
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: hocsinh01@thpt.edu.vn"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mật khẩu:
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    placeholder="Nhập mật khẩu..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                <span>{isLoading ? 'Đang đăng nhập...' : 'Đăng nhập vào hệ thống'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
