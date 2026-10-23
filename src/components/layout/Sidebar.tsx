import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Home, 
  FileText, 
  FileUp, 
  BarChart3, 
  Users, 
  Layers, 
  History, 
  HelpCircle,
  Clock,
  Shield,
  Award,
  Sparkles,
  BookOpen,
  Radio
} from 'lucide-react';


interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onOpenWordUpload?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange, onOpenWordUpload }) => {
  const { user, profile, activeRole } = useAuth();

  const isTeacher = activeRole === 'teacher' || activeRole === 'admin';
  const isAdmin = activeRole === 'admin';

  const navItemClass = (tab: string) => `
    flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer
    ${currentTab === tab 
      ? 'bg-slate-900 text-white shadow-sm font-semibold' 
      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}
  `;

  return (
    <aside className="w-64 shrink-0 hidden md:block">
      <div className="sticky top-20 space-y-5">
        {/* Navigation Groups */}
        <div className="space-y-1">
          <div className="px-3.5 mb-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Điều hướng chung
          </div>
          <button 
            onClick={() => onTabChange('home')}
            className={navItemClass('home')}
          >
            <Home className="w-4 h-4 text-emerald-500" />
            <span>Trang chủ</span>
          </button>
        </div>

        {/* Teacher Navigation (Visible for teachers, admins, or guest previews) */}
        {activeRole !== 'student' && (
          <div className="space-y-1 pt-2 border-t border-slate-200">
            <div className="px-3.5 mb-2 text-[11px] font-bold text-indigo-600 uppercase tracking-wider flex items-center justify-between">
              <span>Khu vực Giáo viên</span>
            </div>
            
            <button 
              onClick={() => onTabChange('teacher-exams')}
              className={navItemClass('teacher-exams')}
            >
              <FileText className="w-4 h-4 text-indigo-500" />
              <span>Quản lý Đề thi</span>
            </button>

            <button 
              onClick={() => {
                if (onOpenWordUpload) {
                  onOpenWordUpload();
                } else {
                  onTabChange('upload-word');
                }
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100/80 transition-colors cursor-pointer border border-emerald-200/60"
            >
              <span className="flex items-center gap-2.5">
                <FileUp className="w-4 h-4 text-emerald-600" />
                <span>Nhập đề từ Word</span>
              </span>
              <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold">
                .docx
              </span>
            </button>

            <button 
              onClick={() => onTabChange('teacher-live')}
              className={navItemClass('teacher-live')}
            >
              <div className="relative">
                <Radio className="w-4 h-4 text-rose-500" />
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              </div>
              <span className="flex-1 flex items-center justify-between">
                <span>Giám sát trực tiếp</span>
                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700">LIVE</span>
              </span>
            </button>

            <button 
              onClick={() => onTabChange('teacher-results')}
              className={navItemClass('teacher-results')}
            >
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              <span>Thống kê (Khối, Lớp, Môn)</span>
            </button>
          </div>
        )}

        {/* Student Navigation */}
        <div className="space-y-1 pt-2 border-t border-slate-200">
          <div className="px-3.5 mb-2 text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
            Khu vực Học sinh
          </div>

          <button 
            onClick={() => onTabChange('student-exams')}
            className={navItemClass('student-exams')}
          >
            <Clock className="w-4 h-4 text-emerald-500" />
            <span>Kỳ thi của tôi</span>
          </button>

          <button 
            onClick={() => onTabChange('student-history')}
            className={navItemClass('student-history')}
          >
            <Award className="w-4 h-4 text-emerald-500" />
            <span>Kết quả & Lịch sử</span>
          </button>
        </div>

        {/* Admin Navigation (Only visible for admin) */}
        {isAdmin && (
          <div className="space-y-1 pt-2 border-t border-slate-200">
            <div className="px-3.5 mb-2 text-[11px] font-bold text-rose-600 uppercase tracking-wider flex items-center justify-between">
              <span>Khu vực Quản trị</span>
            </div>

            <button 
              onClick={() => onTabChange('admin-users')}
              className={navItemClass('admin-users')}
            >
              <Users className="w-4 h-4 text-rose-500" />
              <span>Người dùng & Học sinh</span>
            </button>

            <button 
              onClick={() => onTabChange('admin-classes')}
              className={navItemClass('admin-classes')}
            >
              <Layers className="w-4 h-4 text-rose-500" />
              <span>Lớp học & Môn học</span>
            </button>

            <button 
              onClick={() => onTabChange('admin-logs')}
              className={navItemClass('admin-logs')}
            >
              <Shield className="w-4 h-4 text-rose-500" />
              <span>Nhật ký bảo mật</span>
            </button>
          </div>
        )}

        {/* Quick Help Card */}
        <div className="pt-2">
          <div className="bg-gradient-to-br from-slate-900 to-teal-950 text-white p-4 rounded-2xl shadow-sm text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-300">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Hỗ trợ chuyển đổi Word</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              Tải tệp .docx chuẩn định dạng "Câu 1: ... A. ... B. ... C. ... D." để hệ thống nhận diện tức thì.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};
