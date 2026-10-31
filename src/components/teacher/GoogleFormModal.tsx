import React, { useState, useEffect } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles, 
  FileCode, 
  Link, 
  HelpCircle, 
  AlertCircle,
  Play,
  Save,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { Exam, Question } from '../../types';
import { 
  generateGoogleAppsScriptCode, 
  createBackupGoogleForm 
} from '../../services/googleFormsService';
import { getExamQuestions, updateExamWithQuestions } from '../../services/db';
import { useAuth } from '../../context/AuthContext';

interface GoogleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam;
  questions?: Question[];
  onExamUpdated?: () => void;
}

export const GoogleFormModal: React.FC<GoogleFormModalProps> = ({
  isOpen,
  onClose,
  exam,
  questions: propQuestions,
  onExamUpdated
}) => {
  const { getGoogleAccessToken, requestGoogleScopes } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'script' | 'api' | 'manual'>('script');
  const [questions, setQuestions] = useState<Question[]>(propQuestions || []);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [scriptCode, setScriptCode] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [formUrlInput, setFormUrlInput] = useState(exam.googleFormUrl || '');
  const [isSavingUrl, setIsSavingUrl] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Direct API state
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Load questions if not provided
  useEffect(() => {
    if (!isOpen) return;
    setFormUrlInput(exam.googleFormUrl || '');
    setSaveSuccessMsg(null);
    setApiError(null);

    if (propQuestions && propQuestions.length > 0) {
      setQuestions(propQuestions);
      setScriptCode(generateGoogleAppsScriptCode(exam, propQuestions));
    } else {
      setIsLoadingQuestions(true);
      getExamQuestions(exam.id)
        .then(qList => {
          setQuestions(qList);
          setScriptCode(generateGoogleAppsScriptCode(exam, qList));
        })
        .catch(err => {
          console.warn('Lỗi tải câu hỏi tạo Google Form:', err);
        })
        .finally(() => setIsLoadingQuestions(false));
    }
  }, [isOpen, exam, propQuestions]);

  if (!isOpen) return null;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(scriptCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleSaveFormUrl = async () => {
    const cleanUrl = formUrlInput.trim();
    if (!cleanUrl) {
      setSaveSuccessMsg('Vui lòng nhập đường link Google Form');
      return;
    }
    setIsSavingUrl(true);
    try {
      let extractedId = '';
      const match = cleanUrl.match(/\/forms\/d\/(?:e\/)?([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        extractedId = match[1];
      }

      await updateExamWithQuestions(exam.id, {
        googleFormUrl: cleanUrl,
        googleFormId: extractedId || 'custom_form',
        googleFormStatus: 'created'
      });

      exam.googleFormUrl = cleanUrl;
      exam.googleFormId = extractedId || 'custom_form';
      exam.googleFormStatus = 'created';

      setSaveSuccessMsg('Đã lưu liên kết Google Form vào đề thi thành công!');
      if (onExamUpdated) onExamUpdated();
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (e: any) {
      console.error('Lỗi khi lưu link Google Form:', e);
      setSaveSuccessMsg('Lỗi lưu liên kết: ' + (e?.message || 'Thất bại'));
    } finally {
      setIsSavingUrl(false);
    }
  };

  const handleCreateViaApi = async () => {
    setIsApiLoading(true);
    setApiError(null);
    try {
      let token = await getGoogleAccessToken();
      if (!token) {
        token = await requestGoogleScopes([
          'https://www.googleapis.com/auth/forms.body',
          'https://www.googleapis.com/auth/drive.file'
        ]);
      }

      if (!token) {
        setApiError('Không thể lấy mã ủy quyền Google (Có thể do ứng dụng chưa được Google cấp phép xác minh). Bạn vui lòng dùng Tab "1-Click Google Script" bên cạnh để tạo Form trực tiếp 100% không bị chặn!');
        setIsApiLoading(false);
        return;
      }

      const qList = questions.length > 0 ? questions : await getExamQuestions(exam.id);
      const res = await createBackupGoogleForm(exam, qList, token);

      if (res.success && res.formUrl) {
        await updateExamWithQuestions(exam.id, {
          googleFormId: res.formId || 'created',
          googleFormUrl: res.formUrl,
          googleFormStatus: 'created'
        });
        exam.googleFormId = res.formId;
        exam.googleFormUrl = res.formUrl;
        exam.googleFormStatus = 'created';
        setFormUrlInput(res.formUrl);
        setSaveSuccessMsg('Đã tạo thành công Google Form qua API!');
        if (onExamUpdated) onExamUpdated();
      } else {
        setApiError(res.error || 'Tạo Google Form qua API thất bại.');
      }
    } catch (err: any) {
      setApiError(err?.message || 'Lỗi khi gọi Google Forms API.');
    } finally {
      setIsApiLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
        
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                Google Forms &amp; Google Drive Integration
              </span>
              <h3 className="font-black text-sm sm:text-base leading-snug line-clamp-1">
                Tạo Đề Thi Google Form: {exam.title}
              </h3>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Exam Quick Stats Banner */}
        <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-3 flex-wrap">
            <span>Môn: <strong className="text-slate-900 dark:text-slate-100">{exam.subjectName || 'Chung'}</strong></span>
            <span>•</span>
            <span>Khối: <strong className="text-slate-900 dark:text-slate-100">{exam.grade || '10'}</strong></span>
            <span>•</span>
            <span>Số câu hỏi: <strong className="text-indigo-600 dark:text-indigo-400">{questions.length} câu</strong></span>
          </div>
          {exam.googleFormUrl && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
              <Check className="w-3 h-3 text-emerald-600" />
              Đã có Google Form
            </span>
          )}
        </div>

        {/* Existing Google Form Quick Link (if already linked) */}
        {exam.googleFormUrl && (
          <div className="p-3 mx-5 mt-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-3 text-xs">
            <div className="truncate">
              <span className="font-bold text-emerald-950 dark:text-emerald-200 block">Đề thi đã được liên kết với Google Form:</span>
              <a 
                href={exam.googleFormUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-emerald-700 dark:text-emerald-400 hover:underline font-mono truncate block"
              >
                {exam.googleFormUrl}
              </a>
            </div>
            <a 
              href={exam.googleFormUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-xs"
            >
              <span>Mở Form</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* Tab Selection */}
        <div className="px-5 pt-4">
          <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('script')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'script'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>1-Click Google Script (Khuyên dùng • 100% Không lỗi)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'manual'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Link className="w-3.5 h-3.5" />
              <span>Dán link Form có sẵn</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('api')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                activeTab === 'api'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Google API Trực tiếp</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* TAB 1: GOOGLE APPS SCRIPT (BEST & 100% WORKING) */}
          {activeTab === 'script' && (
            <div className="space-y-3.5 text-xs">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200">
                <p className="font-black text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Giải pháp tối ưu: Tạo trực tiếp vào Google Drive cá nhân</span>
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                  Chạy bằng công cụ chính thức của Google (<code className="font-mono bg-white dark:bg-slate-900 px-1 py-0.5 rounded border border-emerald-300">script.new</code>), hoàn toàn không bị hạn chế hoặc báo lỗi 403 xác minh ứng dụng của Google!
                </p>
              </div>

              {/* 3 Step Guide */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                  3 bước thực hiện đơn giản:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-[10px] mb-1">1</span>
                    <strong className="block text-slate-800 dark:text-slate-200">Mở script.new</strong>
                    <span className="text-slate-500">Bấm nút bên dưới để mở trang soạn thảo tập lệnh Google Apps Script.</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-[10px] mb-1">2</span>
                    <strong className="block text-slate-800 dark:text-slate-200">Dán mã &amp; Bấm Run (▶)</strong>
                    <span className="text-slate-500">Dán đoạn mã đã sao chép vào và bấm biểu tượng tam giác ▶ để tạo Form.</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold flex items-center justify-center text-[10px] mb-1">3</span>
                    <strong className="block text-slate-800 dark:text-slate-200">Dán link Form vào EduTest</strong>
                    <span className="text-slate-500">Dán link Google Form tạo được vào ô bên dưới để lưu vào hệ thống.</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons for Script */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <a
                  href="https://script.new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-2 shadow-md cursor-pointer transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Bước 1: Mở Google Apps Script (script.new)</span>
                </a>

                <button
                  type="button"
                  onClick={handleCopyScript}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center gap-2 shadow-md cursor-pointer transition-all"
                >
                  {isCopied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>{isCopied ? 'Đã sao chép mã!' : 'Bước 2: Sao chép toàn bộ mã Script'}</span>
                </button>
              </div>

              {/* Code Preview Box */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Mã Google Apps Script tự động ({questions.length} câu hỏi):</span>
                  <button
                    type="button"
                    onClick={handleCopyScript}
                    className="text-indigo-600 font-bold hover:underline cursor-pointer"
                  >
                    {isCopied ? 'Đã sao chép' : 'Sao chép mã'}
                  </button>
                </div>
                <div className="relative">
                  <pre className="p-3 bg-slate-900 text-emerald-400 rounded-2xl text-[10px] font-mono max-h-40 overflow-y-auto border border-slate-800 select-all">
                    {scriptCode || 'Đang tạo mã script...'}
                  </pre>
                </div>
              </div>

              {/* Step 3: Paste Form URL */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="block font-bold text-slate-800 dark:text-slate-200 text-xs">
                  Bước 3: Dán link Google Form tạo được để liên kết vào đề thi:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={formUrlInput}
                    onChange={(e) => setFormUrlInput(e.target.value)}
                    placeholder="https://docs.google.com/forms/d/e/.../viewform"
                    className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    disabled={isSavingUrl || !formUrlInput.trim()}
                    onClick={handleSaveFormUrl}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingUrl ? 'Đang lưu...' : 'Lưu liên kết'}</span>
                  </button>
                </div>
                {saveSuccessMsg && (
                  <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                    ✓ {saveSuccessMsg}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: MANUAL URL LINK */}
          {activeTab === 'manual' && (
            <div className="space-y-3.5 text-xs">
              <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200">
                <p className="font-bold text-sm">Gắn link Google Form đã có sẵn</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                  Nếu bạn đã có sẵn link Google Form từ trước, chỉ cần dán liên kết vào đây để hệ thống hiển thị nút &quot;Mở Google Form&quot; và tạo mã QR cho học sinh.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700 dark:text-slate-300 text-xs">
                  Đường link Google Form (Responder URL hoặc Edit URL):
                </label>
                <input
                  type="url"
                  value={formUrlInput}
                  onChange={(e) => setFormUrlInput(e.target.value)}
                  placeholder="Ví dụ: https://docs.google.com/forms/d/e/1FAIpQLSc.../viewform"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSavingUrl || !formUrlInput.trim()}
                  onClick={handleSaveFormUrl}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingUrl ? 'Đang lưu...' : 'Lưu liên kết Google Form'}</span>
                </button>
              </div>

              {saveSuccessMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DIRECT GOOGLE API */}
          {activeTab === 'api' && (
            <div className="space-y-3.5 text-xs">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Tạo trực tiếp qua Google Forms API v1
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Yêu cầu tài khoản Google của bạn đã được thêm vào danh sách người thử nghiệm (Test Users) hoặc ứng dụng đã xác minh với Google Cloud.
                </p>
              </div>

              {apiError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">{apiError}</span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('script')}
                      className="mt-2 block text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      👉 Bấm vào đây để dùng Tab 1-Click Script (Đảm bảo 100% thành công)
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  disabled={isApiLoading}
                  onClick={handleCreateViaApi}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isApiLoading ? 'animate-spin' : ''}`} />
                  <span>{isApiLoading ? 'Đang kết nối Google Forms API...' : 'Bắt đầu tạo qua Google Forms API'}</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
