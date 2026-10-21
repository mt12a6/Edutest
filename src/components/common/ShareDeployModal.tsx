import React, { useState } from 'react';
import { 
  X, 
  Share2, 
  Copy, 
  Check, 
  ExternalLink, 
  Globe, 
  Cloud, 
  Terminal, 
  CheckCircle2, 
  Sparkles,
  Zap
} from 'lucide-react';

interface ShareDeployModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareDeployModal: React.FC<ShareDeployModalProps> = ({ isOpen, onClose }) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedVercelCmd, setCopiedVercelCmd] = useState(false);
  const [activeTab, setActiveTab] = useState<'public_url' | 'vercel' | 'github'>('public_url');

  if (!isOpen) return null;

  // The live shared URL generated for this applet
  const sharedUrl = 'https://ais-pre-rglzaif737gllh4cex75p5-82858385606.asia-east1.run.app';
  const devUrl = 'https://ais-dev-rglzaif737gllh4cex75p5-82858385606.asia-east1.run.app';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(sharedUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCmd = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedVercelCmd(true);
    setTimeout(() => setCopiedVercelCmd(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-5 animate-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                Chia sẻ & Triển khai ứng dụng EduTest
              </h3>
              <p className="text-xs text-slate-500">
                Mở link công khai cho mọi người sử dụng hoặc đưa lên Vercel / Cloud Run
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('public_url')}
            className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'public_url' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-4 h-4 text-emerald-600" />
            <span>Link công khai trực tiếp</span>
          </button>
          <button
            onClick={() => setActiveTab('vercel')}
            className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'vercel' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cloud className="w-4 h-4 text-indigo-600" />
            <span>Triển khai lên Vercel</span>
          </button>
          <button
            onClick={() => setActiveTab('github')}
            className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'github' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Terminal className="w-4 h-4 text-purple-600" />
            <span>GitHub & Tùy biến</span>
          </button>
        </div>

        {/* TAB 1: Link công khai ngay lập tức */}
        {activeTab === 'public_url' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Ứng dụng đã sẵn sàng chạy online 24/7 trên máy chủ Google AI Studio!</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Bất kỳ ai (học sinh, giáo viên, phụ huynh) chỉ cần mở link này trên điện thoại hoặc máy tính là có thể vào thi thử tự do, tra cứu đề thi hoặc đăng nhập để làm bài chính thức.
              </p>

              <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-emerald-300">
                <input
                  type="text"
                  readOnly
                  value={sharedUrl}
                  className="w-full text-xs font-mono font-semibold text-slate-800 bg-transparent border-none focus:outline-hidden"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Đã chép link' : 'Sao chép link'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <a
                href={sharedUrl}
                target="_blank"
                rel="noreferrer"
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between group"
              >
                <div>
                  <span className="font-bold text-slate-900 block">Mở trang Web công khai</span>
                  <span className="text-[11px] text-slate-500">Trải nghiệm trên tab mới</span>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
              </a>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="font-bold text-slate-900 block">Tương thích mọi thiết bị</span>
                <span className="text-[11px] text-slate-500">Giao diện chuẩn Responsive mobile & PC</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Triển khai lên Vercel */}
        {activeTab === 'vercel' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-indigo-900">
                <Zap className="w-4 h-4 text-indigo-600" />
                <span>Cấu hình <code>vercel.json</code> đã được tạo sẵn trong dự án!</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                Dự án đã có sẵn cấu hình tương thích 100% với Vercel (Frontend Vite tĩnh + API serverless route hỗ trợ Gemini AI).
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <h4 className="font-bold text-slate-900">Các bước kết nối Vercel:</h4>
              <ol className="list-decimal pl-5 space-y-2 text-slate-600">
                <li>
                  Đăng nhập tài khoản tại <a href="https://vercel.com" target="_blank" rel="noreferrer" className="text-indigo-600 font-bold underline">vercel.com</a> (bằng GitHub hoặc Email).
                </li>
                <li>
                  Nhấn <strong>Add New... &gt; Project</strong> và chọn Kho lưu trữ GitHub của bạn.
                </li>
                <li>
                  Vercel sẽ tự động phát hiện cấu hình từ <code>vercel.json</code>:
                  <ul className="list-disc pl-5 mt-1 space-y-0.5 text-slate-500">
                    <li><strong>Build Command:</strong> <code>npm run build</code></li>
                    <li><strong>Output Directory:</strong> <code>dist</code></li>
                  </ul>
                </li>
                <li>
                  Trong mục <strong>Environment Variables</strong> trên Vercel, thêm biến:
                  <div className="mt-1.5 p-2 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] flex items-center justify-between">
                    <span>GEMINI_API_KEY = your_gemini_api_key_here</span>
                  </div>
                </li>
                <li>
                  Nhấn <strong>Deploy</strong>. Sau khoảng 1 phút, bạn sẽ có tên miền riêng miễn phí dạng <code>ten-app-cua-ban.vercel.app</code>!
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* TAB 3: CLI / GitHub */}
        {activeTab === 'github' && (
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              Nếu bạn muốn triển khai nhanh bằng lệnh từ máy tính cá nhân qua Vercel CLI:
            </p>
            <div className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] space-y-1 relative">
              <p className="text-slate-400"># 1. Cài đặt Vercel CLI</p>
              <p>npm i -g vercel</p>
              <p className="text-slate-400 pt-1"># 2. Triển khai trực tiếp</p>
              <p>vercel</p>
              <p className="text-slate-400 pt-1"># 3. Triển khai bản sản xuất (Production)</p>
              <p>vercel --prod</p>
              <button
                onClick={() => handleCopyCmd('npm i -g vercel && vercel --prod')}
                className="absolute top-2.5 right-2.5 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-[10px] flex items-center gap-1 cursor-pointer"
              >
                {copiedVercelCmd ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedVercelCmd ? 'Đã sao chép' : 'Chép lệnh'}</span>
              </button>
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
