import React from 'react';
import { AlertCircle, Home, ArrowLeft, Search, BookOpen } from 'lucide-react';

interface NotFoundViewProps {
  attemptedPath: string;
  type?: 'bai-thi' | 'thu-muc' | 'page';
  onBackToHome: () => void;
}

export const NotFoundView: React.FC<NotFoundViewProps> = ({
  attemptedPath,
  type = 'page',
  onBackToHome
}) => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
          <AlertCircle className="w-10 h-10" />
        </div>

        <div>
          <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-mono font-bold">
            Lỗi 404: Không tìm thấy
          </span>
          <h2 className="text-xl font-extrabold text-slate-900 mt-3">
            {type === 'bai-thi' 
              ? 'Không tìm thấy bài thi' 
              : type === 'thu-muc' 
                ? 'Không tìm thấy thư mục' 
                : 'Đường dẫn không tồn tại'}
          </h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Đường dẫn <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded break-all">{attemptedPath}</span> có thể đã bị thay đổi, xóa bỏ hoặc bạn đã nhập sai ký tự.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onBackToHome}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Về Trang chủ</span>
          </button>
        </div>
      </div>
    </div>
  );
};
