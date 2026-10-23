import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  BookOpen, 
  CheckCircle2, 
  LogOut, 
  LogIn, 
  ShieldCheck, 
  GraduationCap, 
  UserCheck, 
  Clock, 
  ChevronDown,
  Sparkles,
  Wifi,
  AlertTriangle,
  Menu,
  X,
  Home,
  FileText,
  BarChart3,
  Layers,
  Shield,
  Users,
  Award,
  Share2
} from 'lucide-react';
import { UserRole } from '../../types';
import { LoginModal } from '../auth/LoginModal';
import { ShareDeployModal } from '../common/ShareDeployModal';

interface NavbarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onTabChange }) => {
  const { user, profile, activeRole, setActiveRole, isAdmin, logout, isLoading, loginAsDemoRole } = useAuth();
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            Quản trị viên
          </span>
        );
      case 'teacher':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <GraduationCap className="w-3.5 h-3.5" />
            Giáo viên
          </span>
        );
      case 'student':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <UserCheck className="w-3.5 h-3.5" />
            Học sinh
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onTabChange('home')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-900 to-teal-800 flex items-center justify-center text-white shadow-md shadow-teal-900/10">
              <div className="relative">
                <BookOpen className="w-5 h-5 text-teal-300" />
                <CheckCircle2 className="w-3 h-3 text-emerald-400 absolute -bottom-1 -right-1" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight text-slate-900">
                  Edu<span className="text-emerald-600">Test</span>
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 tracking-wider">
                  PRO
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                Nền tảng thi trực tuyến thông minh
              </p>
            </div>
          </div>

          {/* Right actions: Online status, Role badge, Profile / Login */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Share & Deploy Button */}
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all cursor-pointer border border-emerald-200 shadow-2xs"
              title="Mở link công khai hoặc kết nối triển khai Vercel"
            >
              <Share2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Chia sẻ & Vercel</span>
            </button>

            {/* Real-time Status */}
            <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100/80 px-2.5 py-1 rounded-lg">
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
              <span>Online</span>
            </div>

            {(user || profile) ? (
              <div className="flex items-center gap-2.5">
                {/* Role indicator */}
                <div className="relative">
                  {isAdmin ? (
                    <button
                      onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                      className="flex items-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer"
                      title="Chuyển đổi góc nhìn vai trò"
                    >
                      {getRoleBadge(activeRole)}
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  ) : (
                    getRoleBadge(activeRole)
                  )}

                  {/* Dropdown for admin role perspective preview */}
                  {showRoleDropdown && isAdmin && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in slide-in-from-top-2">
                      <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Xem giao diện theo vai trò:
                      </div>
                      <button
                        onClick={() => { setActiveRole('admin'); setShowRoleDropdown(false); }}
                        className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 hover:bg-slate-50 ${activeRole === 'admin' ? 'text-rose-600 bg-rose-50/50 font-semibold' : 'text-slate-700'}`}
                      >
                        <ShieldCheck className="w-4 h-4 text-rose-500" /> Quản trị viên (Admin)
                      </button>
                      <button
                        onClick={() => { setActiveRole('teacher'); setShowRoleDropdown(false); }}
                        className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 hover:bg-slate-50 ${activeRole === 'teacher' ? 'text-indigo-600 bg-indigo-50/50 font-semibold' : 'text-slate-700'}`}
                      >
                        <GraduationCap className="w-4 h-4 text-indigo-500" /> Giáo viên (Teacher)
                      </button>
                      <button
                        onClick={() => { setActiveRole('student'); setShowRoleDropdown(false); }}
                        className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 hover:bg-slate-50 ${activeRole === 'student' ? 'text-emerald-600 bg-emerald-50/50 font-semibold' : 'text-slate-700'}`}
                      >
                        <UserCheck className="w-4 h-4 text-emerald-500" /> Học sinh (Student)
                      </button>
                    </div>
                  )}
                </div>

                {/* User avatar and name */}
                <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                  {profile?.photoURL || user?.photoURL ? (
                    <img 
                      src={(profile?.photoURL || user?.photoURL) ?? undefined} 
                      alt="" 
                      className="w-8 h-8 rounded-full border border-slate-300 object-cover" 
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                      {(profile?.displayName || user?.displayName || profile?.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="hidden lg:block text-left">
                    <p className="text-xs font-semibold text-slate-900 leading-tight truncate max-w-[130px]">
                      {profile?.displayName || user?.displayName || profile?.email}
                    </p>
                    <p className="text-[10px] text-slate-500 leading-tight truncate max-w-[130px]">
                      {profile?.email || user?.email}
                    </p>
                  </div>

                  <button
                    onClick={logout}
                    title="Đăng xuất"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="hidden sm:flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Đăng ký Học sinh</span>
                </button>
                <button
                  onClick={() => setShowLoginModal(true)}
                  disabled={isLoading}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-all hover:shadow-md cursor-pointer disabled:opacity-50"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Đăng nhập</span>
                </button>
              </div>
            )}
            {/* Mobile menu toggle button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Menu điều hướng di động"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-slate-800" /> : <Menu className="w-5 h-5 text-slate-800" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 space-y-2 animate-in slide-in-from-top-2 shadow-lg">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 pt-1">
            Điều hướng chung
          </div>
          <button
            onClick={() => { onTabChange('home'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold ${
              currentTab === 'home' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Home className="w-4 h-4 text-emerald-500" />
            <span>Trang chủ</span>
          </button>

          {(activeRole === 'teacher' || activeRole === 'admin') && (
            <>
              <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider px-2 pt-2 border-t border-slate-100">
                Khu vực Giáo viên
              </div>
              <button
                onClick={() => { onTabChange('teacher-exams'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold ${
                  currentTab === 'teacher-exams' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <FileText className="w-4 h-4 text-indigo-500" />
                <span>Quản lý Đề thi</span>
              </button>
              <button
                onClick={() => { onTabChange('teacher-results'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold ${
                  currentTab === 'teacher-results' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <BarChart3 className="w-4 h-4 text-indigo-500" />
                <span>Thống kê (Khối, Lớp, Môn)</span>
              </button>
            </>
          )}

          <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider px-2 pt-2 border-t border-slate-100">
            Khu vực Học sinh
          </div>
          <button
            onClick={() => { onTabChange('student-exams'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold ${
              currentTab === 'student-exams' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Clock className="w-4 h-4 text-emerald-500" />
            <span>Kỳ thi của tôi</span>
          </button>
          <button
            onClick={() => { onTabChange('student-history'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold ${
              currentTab === 'student-history' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Award className="w-4 h-4 text-emerald-500" />
            <span>Kết quả & Lịch sử</span>
          </button>

          {activeRole === 'admin' && (
            <>
              <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider px-2 pt-2 border-t border-slate-100">
                Khu vực Quản trị
              </div>
              <button
                onClick={() => { onTabChange('admin-users'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold ${
                  currentTab === 'admin-users' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Users className="w-4 h-4 text-rose-500" />
                <span>Người dùng & Quyền</span>
              </button>
              <button
                onClick={() => { onTabChange('admin-classes'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold ${
                  currentTab === 'admin-classes' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-4 h-4 text-rose-500" />
                <span>Lớp học & Môn học</span>
              </button>
              <button
                onClick={() => { onTabChange('admin-logs'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold ${
                  currentTab === 'admin-logs' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Shield className="w-4 h-4 text-rose-500" />
                <span>Nhật ký bảo mật</span>
              </button>
            </>
          )}
        </div>
      )}

      {showLoginModal && (
        <LoginModal 
          isOpen={showLoginModal} 
          onClose={() => setShowLoginModal(false)} 
        />
      )}

      {showShareModal && (
        <ShareDeployModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </header>
  );
};
