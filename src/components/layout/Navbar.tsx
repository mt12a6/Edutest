import React, { useState, useEffect, useRef } from 'react';
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
  Share2,
  Radio,
  Sun,
  Moon,
  Database,
  User
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
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return document.documentElement.classList.contains('dark') || 
      localStorage.getItem('edutest_theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const handleOpenLogin = () => setShowLoginModal(true);
    window.addEventListener('edutest:open_login_modal', handleOpenLogin);
    return () => window.removeEventListener('edutest:open_login_modal', handleOpenLogin);
  }, []);

  // Close account menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setShowAccountMenu(false);
      }
    };
    if (showAccountMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showAccountMenu]);

  const toggleDarkMode = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('edutest_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('edutest_theme', 'light');
    }
  };

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

          {/* Right actions: Online status, Dark mode, Share, Account Menu */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Real-time Status (Desktop Only) */}
            <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
              <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Online</span>
            </div>

            {/* Dark Mode Toggle Button (Desktop Only) */}
            <button
              type="button"
              onClick={toggleDarkMode}
              className="hidden sm:flex p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 shadow-2xs"
              title={isDarkMode ? 'Chuyển sang chế độ Sáng' : 'Chuyển sang chế độ Tối (Dark mode)'}
              aria-label="Chuyển chế độ giao diện"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            </button>

            {/* Share & Deploy Button (Desktop Only) */}
            <button
              onClick={() => setShowShareModal(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold transition-all cursor-pointer border border-emerald-200 dark:border-emerald-800 shadow-2xs"
              title="Mở link công khai hoặc kết nối triển khai Vercel"
            >
              <Share2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Chia sẻ</span>
            </button>

            {(user || profile) ? (
              <div className="relative" ref={accountMenuRef}>
                {/* Unified Account Profile Button - Min 44px touch target, touch-friendly on mobile */}
                <button
                  type="button"
                  onClick={() => {
                    setShowAccountMenu(prev => !prev);
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 p-1 sm:px-3 sm:py-1.5 min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-95 touch-manipulation justify-center"
                  title="Menu tài khoản cá nhân & Đăng xuất"
                  aria-label="Tài khoản người dùng"
                >
                  {/* User Avatar with status dot */}
                  <div className="relative shrink-0">
                    {profile?.photoURL || user?.photoURL ? (
                      <img 
                        src={(profile?.photoURL || user?.photoURL) ?? undefined} 
                        alt="" 
                        className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-600 object-cover" 
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                        {(profile?.displayName || user?.displayName || profile?.email || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                      activeRole === 'admin' ? 'bg-rose-500' : activeRole === 'teacher' ? 'bg-indigo-500' : 'bg-emerald-500'
                    }`} />
                  </div>

                  {/* Desktop Name & Role Badge */}
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight truncate max-w-[130px]">
                      {profile?.displayName || user?.displayName || profile?.email}
                    </p>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 capitalize block">
                      {activeRole === 'admin' ? 'Quản trị viên' : activeRole === 'teacher' ? 'Giáo viên' : 'Học sinh'}
                    </span>
                  </div>

                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block ml-0.5" />
                </button>

                {/* Account Dropdown Popover with Mobile Backdrop */}
                {showAccountMenu && (
                  <>
                    {/* Dark backdrop overlay on mobile */}
                    <div 
                      className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-2xs sm:hidden"
                      onClick={() => setShowAccountMenu(false)}
                    />

                    <div className="fixed sm:absolute top-16 right-3 sm:top-full sm:right-0 mt-1.5 w-[calc(100vw-24px)] max-w-sm sm:w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 z-50 animate-in fade-in slide-in-from-top-2">
                      {/* User Info Header with mobile close button */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3 min-w-0">
                          {profile?.photoURL || user?.photoURL ? (
                            <img 
                              src={(profile?.photoURL || user?.photoURL) ?? undefined} 
                              alt="" 
                              className="w-12 h-12 rounded-full border border-slate-200 dark:border-slate-700 object-cover shrink-0 shadow-xs" 
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
                              {(profile?.displayName || user?.displayName || profile?.email || 'U')[0].toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                              {profile?.displayName || user?.displayName || 'Người dùng'}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                              {profile?.email || user?.email}
                            </p>
                            <div className="mt-1">
                              {getRoleBadge(activeRole)}
                            </div>
                          </div>
                        </div>

                        {/* Mobile close button */}
                        <button
                          type="button"
                          onClick={() => setShowAccountMenu(false)}
                          className="sm:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          title="Đóng menu"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Admin / Teacher Role Switcher */}
                      {(isAdmin || profile?.role === 'teacher' || profile?.role === 'admin') && (
                        <div className="py-3 border-b border-slate-100 dark:border-slate-800 space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1">
                            Xem giao diện theo vai trò:
                          </span>
                          <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => setActiveRole('admin')}
                                className={`py-2 px-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                                  activeRole === 'admin'
                                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 font-bold shadow-2xs'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 border border-transparent'
                                }`}
                              >
                                <ShieldCheck className="w-4 h-4 text-rose-500" />
                                <span className="text-[10px]">Admin</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setActiveRole('teacher')}
                              className={`py-2 px-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                                activeRole === 'teacher'
                                  ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-300 font-bold shadow-2xs'
                                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 border border-transparent'
                              }`}
                            >
                              <GraduationCap className="w-4 h-4 text-indigo-500" />
                              <span className="text-[10px]">Giáo viên</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveRole('student')}
                              className={`py-2 px-2 rounded-xl text-xs font-semibold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                                activeRole === 'student'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 font-bold shadow-2xs'
                                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 border border-transparent'
                              }`}
                            >
                              <UserCheck className="w-4 h-4 text-emerald-500" />
                              <span className="text-[10px]">Học sinh</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Quick Utility Options */}
                      <div className="py-2.5 border-b border-slate-100 dark:border-slate-800 space-y-1">
                        <button
                          type="button"
                          onClick={toggleDarkMode}
                          className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
                            <span>Chế độ giao diện</span>
                          </div>
                          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                            {isDarkMode ? 'Tối' : 'Sáng'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowShareModal(true);
                            setShowAccountMenu(false);
                          }}
                          className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Share2 className="w-4 h-4 text-emerald-600" />
                            <span>Chia sẻ liên kết</span>
                          </div>
                        </button>
                      </div>

                      {/* Big, Clear Logout Button */}
                      <div className="pt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setShowAccountMenu(false);
                            logout();
                          }}
                          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 transition-colors cursor-pointer border border-rose-200 dark:border-rose-800 shadow-2xs"
                        >
                          <LogOut className="w-4 h-4 text-rose-600" />
                          <span>Đăng xuất tài khoản</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="hidden sm:flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Đăng ký</span>
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
              onClick={() => {
                setMobileMenuOpen(!mobileMenuOpen);
                setShowAccountMenu(false);
              }}
              className="md:hidden p-2.5 min-h-[42px] min-w-[42px] rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center"
              aria-label="Menu điều hướng di động"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-slate-800" /> : <Menu className="w-5 h-5 text-slate-800" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 space-y-3 animate-in slide-in-from-top-2 shadow-xl max-h-[calc(100vh-64px)] overflow-y-auto">
          {/* User Profile Card on top of Mobile Drawer */}
          {(user || profile) ? (
            <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-3 border border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="flex items-center gap-3">
                {profile?.photoURL || user?.photoURL ? (
                  <img 
                    src={(profile?.photoURL || user?.photoURL) ?? undefined} 
                    alt="" 
                    className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-600 object-cover shrink-0" 
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                    {(profile?.displayName || user?.displayName || profile?.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                    {profile?.displayName || user?.displayName || 'Người dùng'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {profile?.email || user?.email}
                  </p>
                </div>
                <div>
                  {getRoleBadge(activeRole)}
                </div>
              </div>

              {/* Mobile Role Switcher for Admin/Teacher */}
              {(isAdmin || profile?.role === 'teacher' || profile?.role === 'admin') && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Chuyển vai trò xem:
                  </span>
                  <div className="grid grid-cols-3 gap-1">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setActiveRole('admin')}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
                          activeRole === 'admin'
                            ? 'bg-rose-500 text-white shadow-2xs'
                            : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        Admin
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveRole('teacher')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
                        activeRole === 'teacher'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Giáo viên
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveRole('student')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
                        activeRole === 'student'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      Học sinh
                    </button>
                  </div>
                </div>
              )}

              {/* Logout button in Mobile Drawer */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={toggleDarkMode}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 flex items-center gap-1.5"
                >
                  {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-600" />}
                  <span>{isDarkMode ? 'Giao diện Tối' : 'Giao diện Sáng'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-600" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Chưa đăng nhập</span>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShowLoginModal(true);
                }}
                className="px-3 py-1.5 text-xs font-bold bg-teal-600 text-white rounded-xl shadow-xs"
              >
                Đăng nhập ngay
              </button>
            </div>
          )}

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

          {profile?.role !== 'student' && (
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
                onClick={() => { onTabChange('teacher-live'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold ${
                  currentTab === 'teacher-live' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Radio className="w-4 h-4 text-rose-500" />
                  <span>Giám sát thi (Admin)</span>
                </div>
                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700">LIVE</span>
              </button>
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
              <button
                onClick={() => { onTabChange('admin-backup'); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold ${
                  currentTab === 'admin-backup' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Database className="w-4 h-4 text-rose-500" />
                <span>Sao lưu & Phục hồi</span>
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
