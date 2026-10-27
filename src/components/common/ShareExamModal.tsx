import React, { useState } from 'react';
import { 
  X, 
  QrCode, 
  Copy, 
  Check, 
  ExternalLink, 
  Share2, 
  Download, 
  BookOpen, 
  Clock, 
  Sparkles,
  Smartphone
} from 'lucide-react';
import { Exam } from '../../types';

interface ShareExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam | null;
}

export const ShareExamModal: React.FC<ShareExamModalProps> = ({
  isOpen,
  onClose,
  exam
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen || !exam) return null;

  // Build the shareable URL for this specific exam
  const origin = window.location.origin;
  const shareUrl = `${origin}/?examId=${encodeURIComponent(exam.id)}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=12&data=${encodeURIComponent(shareUrl)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleDownloadQr = () => {
    const link = document.createElement('a');
    link.href = qrApiUrl;
    link.download = `QR_DeThi_${exam.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
    link.target = '_blank';
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">
                Mã QR & Chia sẻ Đề thi
              </h3>
              <p className="text-xs text-slate-300">
                Quét mã hoặc gửi liên kết trực tiếp cho học sinh
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 text-center">

          {/* Exam Summary Badge */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {exam.subjectName} • Khối {exam.grade}
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {exam.durationMinutes} phút • {exam.questionCount || 0} câu
              </span>
            </div>
            <h4 className="font-extrabold text-sm text-slate-900 line-clamp-2">
              {exam.title}
            </h4>
          </div>

          {/* QR Code Container */}
          <div className="p-4 bg-gradient-to-b from-slate-50 to-white rounded-3xl border-2 border-emerald-200/80 inline-block shadow-sm">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 inline-block shadow-inner">
              <img 
                src={qrApiUrl} 
                alt="QR Code Đề thi" 
                className="w-52 h-52 mx-auto object-contain rounded-xl"
              />
            </div>
            <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-600 font-semibold">
              <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
              <span>Quét bằng Camera điện thoại hoặc Zalo để vào thi</span>
            </div>
          </div>

          {/* Share URL Input & Copy Button */}
          <div className="space-y-2 text-left">
            <label className="block text-xs font-bold text-slate-700">
              Đường dẫn liên kết đề thi:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="w-full text-xs font-mono text-slate-700 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-xs ${
                  copied 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Đã chép!' : 'Sao chép link'}</span>
              </button>
            </div>
            {copied && (
              <p className="text-[11px] text-emerald-700 font-semibold animate-in fade-in">
                ✓ Đã sao chép liên kết vào bộ nhớ tạm! Bạn có thể dán vào Zalo, Facebook hoặc nhóm lớp.
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleDownloadQr}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Tải ảnh mã QR</span>
            </button>

            <a
              href={`https://zalo.me/share?url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-blue-200"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Gửi qua Zalo</span>
            </a>

            <button
              type="button"
              onClick={() => {
                window.open(shareUrl, '_blank');
              }}
              className="px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-indigo-200"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Mở bài thi</span>
            </button>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end text-xs">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl cursor-pointer"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
