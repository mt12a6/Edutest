import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Download, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  FileJson, 
  ShieldCheck, 
  Layers, 
  Users, 
  BookOpen, 
  GraduationCap, 
  HelpCircle 
} from 'lucide-react';
import { exportBackupData, restoreBackupData, EduTestBackupPayload } from '../../services/db';

export const BackupRestoreManager: React.FC = () => {
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<{
    success: boolean;
    message: string;
    stats?: any;
  } | null>(null);
  const [uploadedBackup, setUploadedBackup] = useState<EduTestBackupPayload | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // Statistics preview of current database
  const [currentStats, setCurrentStats] = useState<{
    examsCount: number;
    classesCount: number;
    subjectsCount: number;
    resultsCount: number;
    usersCount: number;
  }>({
    examsCount: 0,
    classesCount: 0,
    subjectsCount: 0,
    resultsCount: 0,
    usersCount: 0
  });

  const loadStats = async () => {
    try {
      const data = await exportBackupData();
      setCurrentStats({
        examsCount: data.data.exams.length,
        classesCount: data.data.classes.length,
        subjectsCount: data.data.subjects.length,
        resultsCount: data.data.results.length,
        usersCount: data.data.users.length
      });
    } catch (e) {
      console.warn('Error previewing backup stats:', e);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  // Handle export to JSON file
  const handleExportBackup = async () => {
    setIsExporting(true);
    setExportSuccessMsg(null);
    try {
      const backupData = await exportBackupData();
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const fileName = `EduTest_Backup_${dateStr}_${timeStr}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportSuccessMsg(`Đã xuất và tải về thành công tệp sao lưu "${fileName}"!`);
      loadStats();
    } catch (err: any) {
      console.error('Lỗi khi sao lưu dữ liệu:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle uploaded JSON file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    setRestoreStatus(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      setFileError('Vui lòng chọn tệp định dạng JSON (.json).');
      return;
    }

    setUploadFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text) as EduTestBackupPayload;
        if (!parsed.data || !parsed.data.exams) {
          setFileError('Tệp không đúng định dạng sao lưu của EduTest (thiếu trường data).');
          setUploadedBackup(null);
          return;
        }
        setUploadedBackup(parsed);
      } catch (err: any) {
        setFileError(`Không thể đọc tệp JSON: ${err.message || 'Lỗi cú pháp'}`);
        setUploadedBackup(null);
      }
    };
    reader.readAsText(file);
  };

  // Handle restore execution
  const handleExecuteRestore = async () => {
    if (!uploadedBackup) return;
    setIsRestoring(true);
    setRestoreStatus(null);
    try {
      const result = await restoreBackupData(uploadedBackup);
      setRestoreStatus({
        success: true,
        message: result.message,
        stats: result.stats
      });
      loadStats();
    } catch (err: any) {
      setRestoreStatus({
        success: false,
        message: `Khôi phục thất bại: ${err.message || 'Lỗi không xác định'}`
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/90 text-white flex items-center justify-center shadow-lg border border-indigo-400/30">
            <Database className="w-6 h-6 text-indigo-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                Trung tâm an toàn dữ liệu
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black mt-0.5">
              Sao lưu & Phục hồi toàn diện hệ thống
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Xuất toàn bộ đề thi, ngân hàng câu hỏi, bảng điểm, lớp học và tài khoản ra tệp JSON an toàn; hoặc khôi phục dữ liệu nguyên trạng khi chuyển máy chủ.
            </p>
          </div>
        </div>

        <button
          onClick={loadStats}
          className="px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-colors border border-slate-700 flex items-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Làm mới thống kê</span>
        </button>
      </div>

      {/* Current System Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Đề thi</span>
            <BookOpen className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{currentStats.examsCount}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Đang lưu trữ</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Lớp học</span>
            <GraduationCap className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600">{currentStats.classesCount}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Tiểu học, THCS, THPT</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Môn học</span>
            <Layers className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600">{currentStats.subjectsCount}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Toán, Lý, Hóa, Văn, Anh...</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Bài nộp / Kết quả</span>
            <CheckCircle2 className="w-4 h-4 text-teal-500" />
          </div>
          <p className="text-2xl font-black text-teal-600">{currentStats.resultsCount}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Bài thi đã làm</p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Tài khoản</span>
            <Users className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-black text-purple-600">{currentStats.usersCount}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">GV, HS & Admin</p>
        </div>
      </div>

      {/* Main Dual Columns: 1. Backup / 2. Restore */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Column 1: Export Backup */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                  1. Sao lưu dữ liệu (Tải về JSON)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Đóng gói trọn vẹn toàn bộ cơ sở dữ liệu hiện tại
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <p className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Gói sao lưu bao gồm:
              </p>
              <ul className="space-y-1 list-disc list-inside text-slate-500 dark:text-slate-400 pl-1">
                <li>Tất cả đề thi và câu hỏi chi tiết (kèm đáp án, công thức, hình ảnh).</li>
                <li>Toàn bộ kết quả thi, lịch sử nộp bài, điểm trắc nghiệm và tự luận.</li>
                <li>Danh mục khối lớp học, môn học và hồ sơ người dùng.</li>
              </ul>
            </div>

            {exportSuccessMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{exportSuccessMsg}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={isExporting}
            onClick={handleExportBackup}
            className={`w-full py-3.5 px-5 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2.5 shadow-md cursor-pointer ${
              isExporting
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25 ring-2 ring-emerald-500/20'
            }`}
          >
            {isExporting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Đang trích xuất dữ liệu hệ thống...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Tải tệp sao lưu ngay (.json)</span>
              </>
            )}
          </button>
        </div>

        {/* Column 2: Restore from Backup */}
        <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                  2. Phục hồi dữ liệu (Nạp tệp JSON)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Khôi phục dữ liệu từ tệp sao lưu đã tạo trước đó
                </p>
              </div>
            </div>

            {/* File Upload Drop Area */}
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-5 text-center bg-slate-50/50 dark:bg-slate-850 hover:bg-slate-50 transition-colors">
              <label className="cursor-pointer block">
                <FileJson className="w-9 h-9 text-indigo-500 mx-auto mb-2" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block">
                  {uploadFileName ? uploadFileName : 'Nhấp để chọn tệp sao lưu (.json)'}
                </span>
                <span className="text-[11px] text-slate-400 block mt-1">
                  Định dạng chuẩn do hệ thống EduTest xuất
                </span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* File Error */}
            {fileError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{fileError}</span>
              </div>
            )}

            {/* Uploaded File Summary Preview */}
            {uploadedBackup && (
              <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl border border-indigo-200 dark:border-indigo-800 text-xs space-y-2">
                <div className="flex items-center justify-between font-bold text-indigo-900 dark:text-indigo-200">
                  <span>Xem trước dữ liệu tệp:</span>
                  <span className="text-[10px] text-indigo-500 font-mono">v{uploadedBackup.version || '2.0'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <div>• Đề thi: <strong>{uploadedBackup.data?.exams?.length || 0}</strong> đề</div>
                  <div>• Kết quả: <strong>{uploadedBackup.data?.results?.length || 0}</strong> bài</div>
                  <div>• Lớp học: <strong>{uploadedBackup.data?.classes?.length || 0}</strong> lớp</div>
                  <div>• Tài khoản: <strong>{uploadedBackup.data?.users?.length || 0}</strong> user</div>
                </div>
              </div>
            )}

            {/* Restore Result Notification */}
            {restoreStatus && (
              <div className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
                restoreStatus.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              }`}>
                {restoreStatus.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold">{restoreStatus.message}</p>
                  {restoreStatus.stats && (
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-1">
                      Đã khôi phục: {restoreStatus.stats.examsCount} đề thi, {restoreStatus.stats.questionsCount} câu hỏi, {restoreStatus.stats.resultsCount} bài nộp.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={!uploadedBackup || isRestoring}
            onClick={handleExecuteRestore}
            className={`w-full py-3.5 px-5 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2.5 shadow-md cursor-pointer ${
              !uploadedBackup || isRestoring
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/25 ring-2 ring-indigo-500/20'
            }`}
          >
            {isRestoring ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Đang tiến hành khôi phục cơ sở dữ liệu...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Bắt đầu khôi phục dữ liệu ngay</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* Safety Guideline Note */}
      <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3">
        <HelpCircle className="w-5 h-5 text-indigo-500 shrink-0" />
        <p>
          <strong>Khuyến cáo:</strong> Bạn nên sao lưu dữ liệu định kỳ trước mỗi kỳ thi lớn của trường hoặc trước khi có kế hoạch di chuyển sang môi trường khác để tránh mất dữ liệu bài làm của học sinh.
        </p>
      </div>
    </div>
  );
};
