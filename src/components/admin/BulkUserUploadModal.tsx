import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { 
  X, 
  Upload, 
  Download, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  ShieldCheck, 
  GraduationCap, 
  UserCheck, 
  Save,
  Trash2,
  Wand2,
  Plus
} from 'lucide-react';
import { ImportedUserRecord, UserRole } from '../../types';
import { batchCreateUsers, logSystemAction } from '../../services/db';
import { useAuth } from '../../context/AuthContext';

interface BulkUserUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BulkUserUploadModal: React.FC<BulkUserUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [records, setRecords] = useState<ImportedUserRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Validate a single record
  const validateRecord = (record: Partial<ImportedUserRecord>): { isValid: boolean; error: string; password: string } => {
    const username = (record.username || '').trim();
    let password = (record.password || '').trim();

    if (!username) {
      return { isValid: false, error: 'Thiếu tên đăng nhập hoặc email', password: '' };
    }
    // Auto-assign default password if not provided in spreadsheet
    if (!password) {
      password = '123456';
    }
    if (password.length < 4) {
      return { isValid: false, error: 'Mật khẩu quá ngắn (tối thiểu 4 ký tự)', password };
    }
    return { isValid: true, error: '', password };
  };

  // Generate and download template Excel file
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Tên đăng nhập / Email': 'hocsinh01@thpt.edu.vn',
        'Mật khẩu': '123456',
        'Họ và tên': 'Nguyễn Văn Minh',
        'Vai trò (student/teacher/admin)': 'student',
        'Lớp học': '10A1'
      },
      {
        'Tên đăng nhập / Email': 'hocsinh02@thpt.edu.vn',
        'Mật khẩu': '123456',
        'Họ và tên': 'Trần Thị Thu Hà',
        'Vai trò (student/teacher/admin)': 'student',
        'Lớp học': '10A1'
      },
      {
        'Tên đăng nhập / Email': 'giaovien.toan@thpt.edu.vn',
        'Mật khẩu': 'Gv@2024!',
        'Họ và tên': 'Thầy Lê Hoàng Long',
        'Vai trò (student/teacher/admin)': 'teacher',
        'Lớp học': '10A1, 10A2'
      },
      {
        'Tên đăng nhập / Email': 'quantri.vien@thpt.edu.vn',
        'Mật khẩu': 'Admin@2024!',
        'Họ và tên': 'Ban Quản Trị Hệ Thống',
        'Vai trò (student/teacher/admin)': 'admin',
        'Lớp học': ''
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'TaiKhoan');
    XLSX.writeFile(workbook, 'Mau_nhap_danh_sach_tai_khoan_EduTest.xlsx');
  };

  // Parse uploaded file (.csv, .xlsx, .xls)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setSaveSuccessMessage(null);
    setFileName(uploadedFile.name);
    setFile(uploadedFile);

    try {
      const data = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (rawRows.length === 0) {
        setErrorMessage('Tệp tải lên không chứa dữ liệu hoặc bảng trống. Vui lòng kiểm tra lại tệp.');
        setIsProcessing(false);
        return;
      }

      // Map rows with tolerant column names
      const parsed: ImportedUserRecord[] = rawRows.map((row) => {
        const username = String(
          row['Tên đăng nhập / Email'] ||
          row['Tên đăng nhập'] ||
          row['Tài khoản'] ||
          row['Mã học sinh'] ||
          row['Mã HS'] ||
          row['Mã SV'] ||
          row['SBD'] ||
          row['Số báo danh'] ||
          row['Email'] ||
          row['username'] ||
          row['Username'] ||
          row['User'] ||
          row['Account'] ||
          row['email'] ||
          ''
        ).trim();

        const rawPassword = String(
          row['Mật khẩu'] ||
          row['Mật khẩu (mặc định 123456)'] ||
          row['password'] ||
          row['Password'] ||
          row['Pass'] ||
          row['MatKhau'] ||
          ''
        ).trim();

        const displayName = String(
          row['Họ và tên'] ||
          row['Họ tên'] ||
          row['Họ và tên học sinh'] ||
          row['Tên học sinh'] ||
          row['Tên'] ||
          row['name'] ||
          row['FullName'] ||
          (username ? username.split('@')[0] : 'Học sinh')
        ).trim();

        let rawRole = String(
          row['Vai trò (student/teacher/admin)'] ||
          row['Vai trò'] ||
          row['Phân quyền'] ||
          row['Quyền'] ||
          row['role'] ||
          row['Role'] ||
          'student'
        ).toLowerCase().trim();

        let role: UserRole = 'student';
        if (rawRole.includes('admin') || rawRole.includes('quản trị')) {
          role = 'admin';
        } else if (rawRole.includes('teacher') || rawRole.includes('giáo viên') || rawRole.includes('gv')) {
          role = 'teacher';
        } else {
          role = 'student';
        }

        const classId = String(
          row['Lớp học'] ||
          row['Lớp'] ||
          row['class'] ||
          row['Class'] ||
          row['Khối'] ||
          '10A1'
        ).trim();

        const val = validateRecord({ username, password: rawPassword });

        return {
          username,
          email: username.includes('@') ? username : `${username}@edutest.local`,
          password: val.password,
          displayName: displayName || username,
          role,
          classId: classId || '10A1',
          isValid: val.isValid,
          error: val.error
        };
      });

      setRecords(parsed);
    } catch (err) {
      console.error('Lỗi khi đọc tệp:', err);
      setErrorMessage('Không thể đọc dữ liệu từ tệp. Vui lòng đảm bảo tệp định dạng .xlsx, .xls hoặc .csv chuẩn.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Modify individual cell directly in table
  const handleUpdateRecordField = (index: number, field: keyof ImportedUserRecord, value: any) => {
    const list = [...records];
    const updated = { ...list[index], [field]: value };
    if (field === 'username') {
      updated.email = String(value).includes('@') ? String(value) : `${value}@edutest.local`;
    }
    const val = validateRecord(updated);
    updated.isValid = val.isValid;
    updated.error = val.error;

    list[index] = updated;
    setRecords(list);
  };

  // Remove single record
  const handleDeleteRow = (index: number) => {
    const list = records.filter((_, i) => i !== index);
    setRecords(list);
  };

  // Auto-fix all invalid rows with 1 click
  const handleAutoFixErrors = () => {
    const fixed = records.map((r, i) => {
      let username = r.username.trim();
      let password = r.password.trim();
      if (!username) username = `user_${Date.now()}_${i + 1}`;
      if (!password || password.length < 4) password = '123456';

      return {
        ...r,
        username,
        email: username.includes('@') ? username : `${username}@edutest.local`,
        password,
        role: r.role || 'student',
        isValid: true,
        error: ''
      };
    });
    setRecords(fixed);
    setErrorMessage(null);
  };

  // Remove all invalid rows
  const handleRemoveInvalidRows = () => {
    const validOnly = records.filter(r => r.isValid);
    setRecords(validOnly);
    setErrorMessage(null);
  };

  // Save imported accounts into system
  const handleSaveAccounts = async () => {
    setErrorMessage(null);
    setSaveSuccessMessage(null);

    const invalidItems = records.filter(r => !r.isValid);
    if (invalidItems.length > 0) {
      setErrorMessage(`Hệ thống phát hiện ${invalidItems.length} tài khoản có lỗi (được đánh dấu đỏ). Vui lòng sửa trực tiếp trong bảng hoặc nhấn "Tự động sửa lỗi" trước khi lưu.`);
      return;
    }

    if (records.length === 0) {
      setErrorMessage('Danh sách đang trống, vui lòng tải lên tệp hoặc thêm dòng.');
      return;
    }

    setIsSaving(true);
    try {
      const createdCount = await batchCreateUsers(records);
      
      await logSystemAction(
        'BULK_USER_IMPORT',
        user?.uid || 'admin',
        user?.email || 'admin',
        'users',
        'user_roster',
        `Nhập danh sách ${createdCount} tài khoản từ tệp "${fileName || 'excel_upload'}"`
      );

      setSaveSuccessMessage(`Đã thêm thành công ${createdCount} tài khoản vào hệ thống EduTest!`);
      setIsSaving(false);

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Lỗi nhập người dùng:', err);
      setErrorMessage(`Có lỗi xảy ra khi lưu tài khoản: ${err?.message || 'Lỗi kết nối'}. Vui lòng thử lại.`);
      setIsSaving(false);
    }
  };

  const validCount = records.filter(r => r.isValid).length;
  const invalidCount = records.filter(r => !r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                Tải lên danh sách tài khoản từ Excel / CSV
              </h3>
              <p className="text-xs text-slate-300">
                Nhập hàng loạt tài khoản gồm Tên đăng nhập, Mật khẩu, Vai trò và Lớp học
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* Top Actions: Template Download & File Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Download Template Box */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">Tệp mẫu chuẩn (.xlsx)</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Tải mẫu Excel mẫu có sẵn các cột chuẩn
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Tải tệp mẫu</span>
              </button>
            </div>

            {/* Upload File Box */}
            <div className="relative border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-4 text-center bg-slate-50 hover:bg-emerald-50/20 transition-all flex items-center justify-center">
              <input
                type="file"
                id="excelUploadInput"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label 
                htmlFor="excelUploadInput" 
                className="cursor-pointer flex items-center gap-3 text-xs font-semibold text-slate-700"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <span className="truncate max-w-[280px]">
                  {fileName ? `Đã chọn: ${fileName}` : 'Chọn tệp Excel (.xlsx, .xls) hoặc .csv'}
                </span>
              </label>
            </div>
          </div>

          {isProcessing && (
            <div className="p-4 bg-emerald-50 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Đang đọc và phân tích cấu trúc dữ liệu tài khoản...</span>
            </div>
          )}

          {/* Red Alert Card for Errors */}
          {errorMessage && (
            <div className="p-4 bg-rose-50 border-2 border-rose-300 text-rose-900 rounded-2xl text-xs flex items-start gap-3 shadow-xs">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-bold text-rose-800">CẢNH BÁO LỖI DỮ LIỆU TÀI KHOẢN:</p>
                <p className="text-rose-700 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Green Success Banner */}
          {saveSuccessMessage && (
            <div className="p-4 bg-emerald-50 border-2 border-emerald-300 text-emerald-900 rounded-2xl text-xs flex items-center gap-3 shadow-xs animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="font-bold">{saveSuccessMessage}</span>
            </div>
          )}

          {/* Records Preview & Inline Editing Table */}
          {records.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-600" />
                    Bảng xem trước & Chỉnh sửa trực tiếp ({records.length} tài khoản)
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                    Hợp lệ: {validCount}
                  </span>
                  {invalidCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[11px]">
                      Lỗi cần sửa: {invalidCount}
                    </span>
                  )}
                </div>

                {/* Quick repair actions */}
                <div className="flex items-center gap-2">
                  {invalidCount > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={handleAutoFixErrors}
                        className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        <span>Tự động sửa lỗi ({invalidCount})</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveInvalidRows}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa dòng lỗi</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-80 overflow-y-auto shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">STT</th>
                      <th className="py-2.5 px-3">Tên đăng nhập / Email *</th>
                      <th className="py-2.5 px-3">Mật khẩu *</th>
                      <th className="py-2.5 px-3">Họ và tên</th>
                      <th className="py-2.5 px-3">Vai trò</th>
                      <th className="py-2.5 px-3">Lớp học</th>
                      <th className="py-2.5 px-3 text-center">Trạng thái</th>
                      <th className="py-2.5 px-2 text-center w-10">Xóa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.map((r, idx) => (
                      <tr key={idx} className={r.isValid ? 'hover:bg-slate-50' : 'bg-rose-50/70 border-l-4 border-l-rose-500'}>
                        <td className="py-2 px-3 text-center text-slate-400 font-medium">
                          {idx + 1}
                        </td>
                        {/* Editable Username */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={r.username}
                            onChange={(e) => handleUpdateRecordField(idx, 'username', e.target.value)}
                            placeholder="Tên đăng nhập hoặc email"
                            className={`w-full px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${
                              !r.username.trim()
                                ? 'border-rose-400 bg-rose-50 text-rose-900 focus:ring-2 focus:ring-rose-400'
                                : 'border-slate-300 focus:border-emerald-500 bg-white'
                            }`}
                          />
                        </td>
                        {/* Editable Password */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={r.password}
                            onChange={(e) => handleUpdateRecordField(idx, 'password', e.target.value)}
                            placeholder="Mật khẩu"
                            className={`w-full px-2 py-1 rounded-lg text-xs font-mono border transition-colors ${
                              !r.password.trim() || r.password.length < 4
                                ? 'border-rose-400 bg-rose-50 text-rose-900 focus:ring-2 focus:ring-rose-400'
                                : 'border-slate-300 focus:border-emerald-500 bg-white'
                            }`}
                          />
                        </td>
                        {/* Editable Display Name */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={r.displayName}
                            onChange={(e) => handleUpdateRecordField(idx, 'displayName', e.target.value)}
                            placeholder="Họ và tên"
                            className="w-full px-2 py-1 rounded-lg text-xs font-medium border border-slate-300 focus:border-emerald-500 bg-white"
                          />
                        </td>
                        {/* Editable Role */}
                        <td className="py-2 px-3">
                          <select
                            value={r.role}
                            onChange={(e) => handleUpdateRecordField(idx, 'role', e.target.value as UserRole)}
                            className="px-2 py-1 rounded-lg text-xs font-bold border border-slate-300 bg-white cursor-pointer"
                          >
                            <option value="student">Học sinh (student)</option>
                            <option value="teacher">Giáo viên (teacher)</option>
                            <option value="admin">Quản trị viên (admin)</option>
                          </select>
                        </td>
                        {/* Editable Class */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={r.classId || ''}
                            onChange={(e) => handleUpdateRecordField(idx, 'classId', e.target.value)}
                            placeholder="10A1, 12A3..."
                            className="w-20 px-2 py-1 rounded-lg text-xs font-medium border border-slate-300 focus:border-emerald-500 bg-white"
                          />
                        </td>
                        {/* Status with error message */}
                        <td className="py-2 px-3 text-center">
                          {r.isValid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px] bg-emerald-100/70 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Hợp lệ
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-800 font-bold text-[11px] bg-rose-100 px-2 py-0.5 rounded-full" title={r.error}>
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              <span className="truncate max-w-[120px]">{r.error}</span>
                            </span>
                          )}
                        </td>
                        {/* Delete Row button */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Xóa dòng này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl cursor-pointer"
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            disabled={validCount === 0 || isSaving}
            onClick={handleSaveAccounts}
            className="px-6 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Đang lưu vào hệ thống...' : `Lưu ${validCount} tài khoản vào hệ thống`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
