import React from 'react';
import { ShieldCheck, Heart, Sparkles, BookOpen, ExternalLink, HelpCircle } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Brand & Required Attribution */}
          <div className="space-y-1.5 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <div className="w-6 h-6 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs font-black">
                E
              </div>
              <span className="font-extrabold text-sm text-slate-900 tracking-tight">
                EduTest PRO
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                v2026.4
              </span>
            </div>
            
            {/* User Requested Required Text */}
            <p className="text-xs font-bold text-slate-800">
              © 2026 EduTest PRO. Developed & Managed by Mr Truong.
            </p>
            <p className="text-xs text-slate-500 font-medium">
              Nền tảng kiểm tra & đánh giá năng lực học sinh thông minh.
            </p>
          </div>

          {/* Quick Badges & Features */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Chuẩn GDPT 2018</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>AI Chấm tự luận & Rà soát đề</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
              <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span>3 Phần trắc nghiệm mới</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
