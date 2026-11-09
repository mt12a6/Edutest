import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit3, 
  FileSpreadsheet, 
  Download, 
  Upload, 
  Search, 
  ArrowUpDown, 
  CheckCircle2, 
  AlertCircle, 
  Check, 
  X, 
  QrCode, 
  Printer, 
  Sparkles, 
  Layers,
  GraduationCap,
  Save,
  RotateCcw,
  Eye
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SchoolClass, PlickersStudent } from '../../types';
import { 
  getPlickersStudents, 
  savePlickersStudent, 
  bulkSavePlickersStudents, 
  deletePlickersStudent,
  addClass,
  deleteClass
} from '../../services/db';
import { ConfirmModal } from '../common/ConfirmModal';

interface ClassStudentManagerProps {
  classes: SchoolClass[];
  onRefreshClasses: () => void;
  onOpenCardPrint?: (classId: string) => void;
}

export const ClassStudentManager: React.FC<ClassStudentManagerProps> = ({
  classes,
  onRefreshClasses,
  onOpenCardPrint
}) => {
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id || '10A1');
  const [students, setStudents] = useState<PlickersStudent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<'cardId' | 'name' | 'studentCode'>('cardId');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals & Forms
  const [showAddStudentModal, setShowAddStudentModal] = useState<boolean>(false);
  const [editingStudent, setEditingStudent] = useState<PlickersStudent | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<PlickersStudent | null>(null);

  // Form Fields
  const [formName, setFormName] = useState<string>('');
  const [formCode, setFormCode] = useState<string>('');
  const [formCardId, setFormCardId] = useState<number>(1);
  const [formStatus, setFormStatus] = useState<'active' | 'disabled'>('active');
  const [formError, setFormError] = useState<string | null>(null);

  // Excel Import Preview Modal State
  const [showExcelImportModal, setShowExcelImportModal] = useState<boolean>(false);
  const [excelPreviewStudents, setExcelPreviewStudents] = useState<Array<PlickersStudent & { error?: string }>>([]);
  const [excelImportFile, setExcelImportFile] = useState<File | null>(null);

  // Status Notification
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 4500);
  };

  // Fetch students for selected class
  const loadStudents = async (cId: string) => {
    setIsLoading(true);
    try {
      const list = await getPlickersStudents(cId);
      setStudents(list);
    } catch (err) {
      console.warn('Lỗi tải học sinh:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClassId) {
      loadStudents(selectedClassId);
    }
  }, [selectedClassId]);

  // Next available Card ID
  const getNextAvailableCardId = (): number => {
    const used = new Set(students.map(s => s.cardId));
    for (let i = 1; i <= 100; i++) {
      if (!used.has(i)) return i;
    }
    return students.length + 1;
  };

  // Open Add Student
  const handleOpenAdd = () => {
    setEditingStudent(null);
    setFormName('');
    const nextCard = getNextAvailableCardId();
    setFormCardId(nextCard);
    setFormCode(`HS${String(nextCard).padStart(2, '0')}`);
    setFormStatus('active');
    setFormError(null);
    setShowAddStudentModal(true);
  };

  // Open Edit Student
  const handleOpenEdit = (std: PlickersStudent) => {
    setEditingStudent(std);
    setFormName(std.displayName);
    setFormCode(std.studentCode);
    setFormCardId(std.cardId);
    setFormStatus(std.status);
    setFormError(null);
    setShowAddStudentModal(true);
  };

  // Save Student (with duplicate Card ID & Code check)
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = formName.trim();
    const code = formCode.trim();
    if (!name) {
      setFormError('Vui lòng nhập họ và tên học sinh.');
      return;
    }
    if (!code) {
      setFormError('Vui lòng nhập mã học sinh.');
      return;
    }

    // Check duplicate Card ID
    const duplicateCard = students.find(
      s => s.cardId === formCardId && (!editingStudent || s.id !== editingStudent.id)
    );
    if (duplicateCard) {
      setFormError(`Số thẻ QR #${formCardId} đã được gán cho học sinh "${duplicateCard.displayName}". Vui lòng chọn số thẻ khác.`);
      return;
    }

    // Check duplicate Student Code
    const duplicateCode = students.find(
      s => s.studentCode.toLowerCase() === code.toLowerCase() && (!editingStudent || s.id !== editingStudent.id)
    );
    if (duplicateCode) {
      setFormError(`Mã học sinh "${code}" đã tồn tại trong lớp. Vui lòng kiểm tra lại.`);
      return;
    }

    const currentClass = classes.find(c => c.id === selectedClassId);
    const newRecord: PlickersStudent = {
      id: editingStudent ? editingStudent.id : `std_${selectedClassId}_${Date.now()}`,
      displayName: name,
      studentCode: code,
      cardId: formCardId,
      classId: selectedClassId,
      className: currentClass?.name || selectedClassId,
      status: formStatus,
      createdAt: editingStudent?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await savePlickersStudent(newRecord);
      setShowAddStudentModal(false);
      showSuccess(editingStudent ? `Đã cập nhật học sinh "${name}"!` : `Đã thêm học sinh "${name}" thành công!`);
      loadStudents(selectedClassId);
    } catch (err) {
      console.error('Lỗi lưu học sinh:', err);
      setFormError('Không thể lưu dữ liệu học sinh. Vui lòng thử lại.');
    }
  };

  // Delete Student
  const confirmDeleteStudent = async () => {
    if (!studentToDelete) return;
    try {
      await deletePlickersStudent(selectedClassId, studentToDelete.id);
      showSuccess(`Đã xóa học sinh "${studentToDelete.displayName}".`);
      setStudentToDelete(null);
      loadStudents(selectedClassId);
    } catch (err) {
      showError('Không thể xóa học sinh. Vui lòng thử lại.');
    }
  };

  // Export Class Roster to Excel (.xlsx)
  const handleExportExcel = () => {
    const currentClass = classes.find(c => c.id === selectedClassId);
    const exportData = students.map((s, idx) => ({
      'STT': idx + 1,
      'Số thẻ QR': s.cardId,
      'Mã học sinh': s.studentCode,
      'Họ và tên': s.displayName,
      'Lớp': currentClass?.name || selectedClassId,
      'Trạng thái': s.status === 'active' ? 'Đang học' : 'Nghỉ'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DanhSachHocSinh');
    XLSX.writeFile(wb, `DanhSach_HocSinh_${currentClass?.name || selectedClassId}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Handle Excel File Selection & Parse with Validation Preview
  const handleExcelFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelImportFile(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (rawJson.length <= 1) {
          showError('File Excel không có dữ liệu học sinh.');
          return;
        }

        // Detect column headers
        const headers = rawJson[0] as string[];
        const nameIdx = headers.findIndex(h => /họ.*tên|tên|name/i.test(String(h)));
        const codeIdx = headers.findIndex(h => /mã|code|sbd/i.test(String(h)));
        const cardIdx = headers.findIndex(h => /thẻ|card|qr/i.test(String(h)));

        const currentClass = classes.find(c => c.id === selectedClassId);
        const parsedList: Array<PlickersStudent & { error?: string }> = [];
        const seenCardIds = new Set<number>();
        const seenCodes = new Set<string>();

        for (let i = 1; i < rawJson.length; i++) {
          const row = rawJson[i];
          if (!row || row.length === 0) continue;

          const rawName = nameIdx >= 0 ? row[nameIdx] : (row[1] || row[0]);
          const rawCode = codeIdx >= 0 ? row[codeIdx] : (row[2] || `HS${String(i).padStart(2, '0')}`);
          const rawCard = cardIdx >= 0 ? parseInt(row[cardIdx], 10) : i;

          const name = String(rawName || '').trim();
          const code = String(rawCode || '').trim();
          const cardId = !isNaN(rawCard) && rawCard > 0 ? rawCard : i;

          if (!name) continue;

          let errorMsg: string | undefined = undefined;
          if (seenCardIds.has(cardId)) {
            errorMsg = `Trùng số thẻ #${cardId}`;
          } else if (seenCodes.has(code.toLowerCase())) {
            errorMsg = `Trùng mã HS "${code}"`;
          }

          seenCardIds.add(cardId);
          seenCodes.add(code.toLowerCase());

          parsedList.push({
            id: `std_${selectedClassId}_import_${i}_${Date.now()}`,
            displayName: name,
            studentCode: code,
            cardId,
            classId: selectedClassId,
            className: currentClass?.name || selectedClassId,
            status: 'active',
            error: errorMsg
          });
        }

        setExcelPreviewStudents(parsedList);
        setShowExcelImportModal(true);
      } catch (err) {
        console.error('Lỗi đọc Excel:', err);
        showError('Không thể đọc file Excel. Vui lòng kiểm tra định dạng.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Confirm Excel Bulk Import
  const handleConfirmExcelImport = async () => {
    const validStudents = excelPreviewStudents.filter(s => !s.error);
    if (validStudents.length === 0) {
      showError('Không có dữ liệu học sinh hợp lệ để nhập.');
      return;
    }

    try {
      await bulkSavePlickersStudents(selectedClassId, validStudents);
      setShowExcelImportModal(false);
      showSuccess(`Đã nhập thành công ${validStudents.length} học sinh vào lớp!`);
      loadStudents(selectedClassId);
    } catch (err) {
      showError('Lỗi nhập dữ liệu vào hệ thống. Vui lòng thử lại.');
    }
  };

  // Filtered & Sorted Student List
  const filteredStudents = useMemo(() => {
    let result = students.filter(s => {
      const q = searchQuery.toLowerCase();
      return (
        s.displayName.toLowerCase().includes(q) ||
        s.studentCode.toLowerCase().includes(q) ||
        String(s.cardId).includes(q)
      );
    });

    result.sort((a, b) => {
      let comp = 0;
      if (sortField === 'cardId') {
        comp = a.cardId - b.cardId;
      } else if (sortField === 'name') {
        comp = a.displayName.localeCompare(b.displayName, 'vi');
      } else if (sortField === 'studentCode') {
        comp = a.studentCode.localeCompare(b.studentCode);
      }
      return sortOrder === 'asc' ? comp : -comp;
    });

    return result;
  }, [students, searchQuery, sortField, sortOrder]);

  const toggleSort = (field: 'cardId' | 'name' | 'studentCode') => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const currentClass = classes.find(c => c.id === selectedClassId);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Banner */}
      <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 leading-tight">
              Quản lý Lớp học & Gán Mã Thẻ QR
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Tạo danh sách học sinh, gán số thẻ duy nhất (1..100) cho từng học sinh và đồng bộ với hệ thống quét camera.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {onOpenCardPrint && (
            <button
              type="button"
              onClick={() => onOpenCardPrint(selectedClassId)}
              className="px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold border border-teal-200 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <Printer className="w-4 h-4 text-teal-600" />
              <span>In Thẻ Lớp ({currentClass?.name})</span>
            </button>
          )}

          <label className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs">
            <Upload className="w-4 h-4 text-indigo-600" />
            <span>Nhập Excel (.xlsx)</span>
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              className="hidden" 
              onChange={handleExcelFileSelected}
            />
          </label>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Xuất Excel</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4 text-teal-400" />
            <span>Thêm Học Sinh</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filter and Class Selection Toolbar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-600">Chọn lớp:</span>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-black text-slate-900 text-xs focus:ring-2 focus:ring-teal-500"
          >
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.grade} - {c.studentCount} HS)</option>
            ))}
          </select>

          <span className="text-xs text-slate-400 font-medium">
            • Tổng số: <strong className="text-slate-800">{students.length} học sinh</strong>
          </span>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên, mã HS, số thẻ..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Student Roster Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5 text-center w-14">STT</th>
                <th 
                  className="p-3.5 cursor-pointer hover:text-teal-700 transition-colors w-24 text-center"
                  onClick={() => toggleSort('cardId')}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Số thẻ QR</span>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th 
                  className="p-3.5 cursor-pointer hover:text-teal-700 transition-colors w-28"
                  onClick={() => toggleSort('studentCode')}
                >
                  <div className="flex items-center gap-1">
                    <span>Mã HS</span>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th 
                  className="p-3.5 cursor-pointer hover:text-teal-700 transition-colors"
                  onClick={() => toggleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    <span>Họ và tên học sinh</span>
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th className="p-3.5 w-32">Lớp</th>
                <th className="p-3.5 w-28 text-center">Trạng thái</th>
                <th className="p-3.5 w-28 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Chưa có học sinh nào trong lớp hoặc không tìm thấy kết quả phù hợp.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((std, idx) => (
                  <tr key={std.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                    
                    {/* QR Card Badge */}
                    <td className="p-3.5 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-black text-xs bg-teal-50 text-teal-800 border border-teal-200">
                        <QrCode className="w-3 h-3 text-teal-600" />
                        <span>#{std.cardId}</span>
                      </span>
                    </td>

                    {/* Student Code */}
                    <td className="p-3.5 font-mono font-bold text-slate-700">
                      {std.studentCode}
                    </td>

                    {/* Display Name */}
                    <td className="p-3.5 font-bold text-slate-900 text-sm">
                      {std.displayName}
                    </td>

                    {/* Class */}
                    <td className="p-3.5 text-slate-600">
                      {currentClass?.name || selectedClassId}
                    </td>

                    {/* Status */}
                    <td className="p-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        std.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {std.status === 'active' ? 'Đang học' : 'Nghỉ'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(std)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                          title="Sửa thông tin học sinh"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setStudentToDelete(std)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Xóa học sinh khỏi lớp"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Student Modal Dialog */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingStudent ? 'Chỉnh Sửa Thông Tin Học Sinh' : 'Thêm Học Sinh Mới Vào Lớp'}
              </h3>
              <button 
                type="button" 
                onClick={() => setShowAddStudentModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="p-5 space-y-4 text-xs font-sans">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Họ và tên học sinh *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn An"
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-teal-500 bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Mã học sinh / SBD *</label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="HS01, SBD123..."
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono font-bold focus:ring-2 focus:ring-teal-500 bg-slate-50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Số thẻ QR (1..100) *</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={formCardId}
                    onChange={(e) => setFormCardId(parseInt(e.target.value, 10) || 1)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-black text-teal-800 focus:ring-2 focus:ring-teal-500 bg-teal-50/50"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Trạng thái học sinh</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-teal-500 bg-slate-50"
                >
                  <option value="active">Đang học tập (Hoạt động)</option>
                  <option value="disabled">Đã nghỉ học / Chuyển lớp</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-xs cursor-pointer"
                >
                  Lưu Học Sinh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Import Preview & Validation Modal */}
      {showExcelImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-3xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">Xem Trước Danh Sách Nhập Từ Excel</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowExcelImportModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs flex items-center justify-between gap-3 shrink-0">
              <span className="font-semibold text-slate-700">
                Tổng cộng: <strong className="text-slate-900">{excelPreviewStudents.length} học sinh</strong>
                {' • '}
                Hợp lệ: <strong className="text-emerald-700">{excelPreviewStudents.filter(s => !s.error).length}</strong>
                {' • '}
                Lỗi: <strong className="text-rose-700">{excelPreviewStudents.filter(s => s.error).length}</strong>
              </span>

              <button
                type="button"
                onClick={handleConfirmExcelImport}
                disabled={excelPreviewStudents.filter(s => !s.error).length === 0}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-40"
              >
                Xác Nhận Lưu Vào Lớp
              </button>
            </div>

            {/* Preview table */}
            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 font-bold border-b border-slate-200 text-slate-700">
                  <tr>
                    <th className="p-2.5 text-center w-12">STT</th>
                    <th className="p-2.5 text-center w-16">Số thẻ</th>
                    <th className="p-2.5 w-24">Mã HS</th>
                    <th className="p-2.5">Họ và tên</th>
                    <th className="p-2.5 text-center w-28">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {excelPreviewStudents.map((s, idx) => (
                    <tr key={idx} className={s.error ? 'bg-rose-50/70 text-rose-900' : 'hover:bg-slate-50'}>
                      <td className="p-2.5 text-center text-slate-400">{idx + 1}</td>
                      <td className="p-2.5 text-center font-bold">#{s.cardId}</td>
                      <td className="p-2.5 font-mono">{s.studentCode}</td>
                      <td className="p-2.5 font-bold">{s.displayName}</td>
                      <td className="p-2.5 text-center">
                        {s.error ? (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                            {s.error}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                            Hợp lệ
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      {studentToDelete && (
        <ConfirmModal
          isOpen={Boolean(studentToDelete)}
          title="Xóa Học Sinh Khỏi Lớp"
          message={`Bạn có chắc chắn muốn xóa học sinh "${studentToDelete.displayName}" (Thẻ #${studentToDelete.cardId}) khỏi lớp học này?`}
          confirmText="Xóa học sinh"
          onConfirm={confirmDeleteStudent}
          onCancel={() => setStudentToDelete(null)}
        />
      )}

    </div>
  );
};
