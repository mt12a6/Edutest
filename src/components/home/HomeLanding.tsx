import React from 'react';
import { 
  BookOpen, 
  CheckCircle2, 
  FileUp, 
  Clock, 
  BarChart3, 
  ShieldCheck, 
  Users, 
  Award, 
  Sparkles, 
  ArrowRight,
  GraduationCap,
  Play
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Exam, SchoolClass, Subject } from '../../types';

interface HomeLandingProps {
  exams: Exam[];
  classes: SchoolClass[];
  subjects: Subject[];
  onNavigateTab: (tab: string) => void;
  onOpenWordUpload: () => void;
}

export const HomeLanding: React.FC<HomeLandingProps> = ({
  exams,
  classes,
  subjects,
  onNavigateTab,
  onOpenWordUpload
}) => {
  const { user, profile, activeRole, loginWithGoogle } = useAuth();

  // Statistics
  const totalExams = exams.length;
  const activeExams = exams.filter(e => e.isPublished).length;
  const totalClasses = classes.length;
  const estimatedStudents = classes.reduce((sum, c) => sum + (c.studentCount || 35), 0);

  return (
    <div className="space-y-10 pb-12 animate-in fade-in duration-300">
      
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-white p-8 sm:p-12 shadow-xl border border-slate-800">
        <div className="relative z-10 max-w-3xl space-y-5">
          
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>EduTest v2.4 • Nền tảng quản lý thi thông minh</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            EDUTEST – NỀN TẢNG THI TRỰC TUYẾN THÔNG MINH
          </h1>

          <p className="text-base sm:text-lg text-slate-300 font-medium leading-relaxed">
            Tạo đề thi dễ dàng – Tổ chức thi an toàn – Theo dõi kết quả tức thì
          </p>

          {/* Call to action buttons */}
          <div className="pt-2 flex flex-wrap items-center gap-3.5">
            {user ? (
              <>
                {(activeRole === 'teacher' || activeRole === 'admin') && (
                  <button
                    onClick={onOpenWordUpload}
                    className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <FileUp className="w-4 h-4" />
                    <span>Tải đề Word .docx tự động</span>
                  </button>
                )}

                <button
                  onClick={() => onNavigateTab(activeRole === 'student' ? 'student-exams' : 'teacher-exams')}
                  className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm border border-white/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>{activeRole === 'student' ? 'Vào phòng thi ngay' : 'Xem danh sách kỳ thi'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={loginWithGoogle}
                className="px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2.5 cursor-pointer"
              >
                <GraduationCap className="w-5 h-5" />
                <span>Đăng nhập với Google để bắt đầu</span>
              </button>
            )}
          </div>
        </div>

        {/* Decorative background grid elements */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none hidden lg:flex items-center justify-center">
          <BookOpen className="w-96 h-96 text-white" />
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
            <Users className="w-5 h-5" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{estimatedStudents}+</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Học sinh theo dõi</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
            <GraduationCap className="w-5 h-5" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{totalClasses}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Lớp học trực thuộc</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
            <BookOpen className="w-5 h-5" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{totalExams}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Đề thi trong ngân hàng</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
            <Clock className="w-5 h-5" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{activeExams}</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Kỳ thi đang diễn ra</p>
        </div>
      </div>

      {/* Core Feature Pillars */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            Hệ sinh thái tính năng chính của EduTest
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Module 1: Quản lý đề thi */}
          <div 
            onClick={() => onNavigateTab('teacher-exams')}
            className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileUp className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">
                1. Nhập đề Word thông minh
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tự động trích xuất câu hỏi, nhận diện đáp án A/B/C/D, câu đúng và lời giải chi tiết. Kiểm tra trước khi lưu.
              </p>
            </div>
            <div className="pt-4 flex items-center text-xs font-bold text-emerald-700 gap-1">
              <span>Xem ngân hàng đề</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Module 2: Tổ chức thi an toàn */}
          <div 
            onClick={() => onNavigateTab('student-exams')}
            className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-indigo-700 transition-colors">
                2. Phòng thi trực tuyến
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Đồng hồ đếm ngược nổi bật, bảng số câu thông minh, tự động lưu bài liên tục, khôi phục bài khi mất mạng.
              </p>
            </div>
            <div className="pt-4 flex items-center text-xs font-bold text-indigo-700 gap-1">
              <span>Vào thi trực tuyến</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Module 3: Chấm điểm & Báo cáo */}
          <div 
            onClick={() => onNavigateTab('teacher-results')}
            className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-teal-300 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-teal-700 transition-colors">
                3. Báo cáo & Phổ điểm
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Phân tích độ khó từng câu hỏi, thống kê tỷ lệ đạt/trượt theo lớp và xuất bảng điểm Excel/CSV tức thì.
              </p>
            </div>
            <div className="pt-4 flex items-center text-xs font-bold text-teal-700 gap-1">
              <span>Xem phân tích phổ điểm</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Module 4: Quản trị & Phân quyền */}
          <div 
            onClick={() => onNavigateTab('admin-users')}
            className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-rose-300 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-slate-900 group-hover:text-rose-700 transition-colors">
                4. Phân quyền đa cấp (RBAC)
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Quản trị viên, giáo viên và học sinh. Khóa tài khoản, quản lý danh sách lớp và lưu vết kiểm toán an ninh.
              </p>
            </div>
            <div className="pt-4 flex items-center text-xs font-bold text-rose-700 gap-1">
              <span>Bảo mật hệ thống</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
