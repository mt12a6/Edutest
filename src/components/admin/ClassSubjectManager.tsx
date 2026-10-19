import React, { useState } from 'react';
import { 
  Layers, 
  BookOpen, 
  Plus, 
  Trash2, 
  Users, 
  GraduationCap, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  EyeOff,
  Filter,
  Sparkles
} from 'lucide-react';
import { SchoolClass, Subject } from '../../types';
import { 
  addClass, 
  deleteClass, 
  toggleHideClass,
  addSubject, 
  deleteSubject, 
  logSystemAction,
  getTeacherScope,
  isClassInTeacherScope
} from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { ConfirmModal } from '../common/ConfirmModal';

interface ClassSubjectManagerProps {
  classes: SchoolClass[];
  subjects: Subject[];
  onRefresh: () => void;
}

export const ClassSubjectManager: React.FC<ClassSubjectManagerProps> = ({
  classes,
  subjects,
  onRefresh
}) => {
  const { user } = useAuth();
  const teacherScope = getTeacherScope();

  // Filters
  const [onlyTeachingScope, setOnlyTeachingScope] = useState<boolean>(true);
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [showHiddenClasses, setShowHiddenClasses] = useState<boolean>(false);

  // New Class Form
  const [showAddClass, setShowAddClass] = useState(false);
  const [className, setClassName] = useState('');
  const [classGrade, setClassGrade] = useState('6');
  const [classYear, setClassYear] = useState('2024 - 2025');
  const [classDesc, setClassDesc] = useState('');

  // New Subject Form
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectDesc, setSubjectDesc] = useState('');

  // Confirmation Modals State
  const [classToDelete, setClassToDelete] = useState<SchoolClass | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3500);
  };

  const showError = (msg: string) => {
    setActionError(msg);
    setTimeout(() => setActionError(null), 5000);
  };

  // Filter classes
  const filteredClasses = classes.filter(c => {
    // Hidden filter
    if (!showHiddenClasses && c.isHidden) return false;

    // Scope filter (Toán 6, Tin 6-9 -> grades 6, 7, 8, 9)
    if (onlyTeachingScope && !isClassInTeacherScope(c, teacherScope)) {
      return false;
    }

    // Specific grade filter
    if (selectedGradeFilter !== 'all' && c.grade !== selectedGradeFilter) {
      return false;
    }

    return true;
  });

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim()) return;

    try {
      await addClass({
        name: className.trim(),
        grade: classGrade,
        schoolYear: classYear,
        description: classDesc.trim(),
        studentCount: 35,
        createdAt: new Date().toISOString()
      });
      await logSystemAction(
        'CREATE_CLASS',
        user?.uid || 'admin',
        user?.email || 'admin',
        className,
        'class',
        `Tạo lớp học ${className} - Khối ${classGrade}`
      );
      setClassName('');
      setClassDesc('');
      setShowAddClass(false);
      showSuccess(`Đã thêm thành công lớp học "${className.trim()}"!`);
      onRefresh();
    } catch (err) {
      console.error('Lỗi khi tạo lớp:', err);
      showError('Không thể tạo lớp học. Vui lòng kiểm tra lại.');
    }
  };

  const confirmDeleteClass = async () => {
    if (!classToDelete) return;
    const target = classToDelete;
    setClassToDelete(null);

    try {
      await deleteClass(target.id);
      await logSystemAction(
        'DELETE_CLASS',
        user?.uid || 'admin',
        user?.email || 'admin',
        target.id,
        'class',
        `Xóa lớp ${target.name}`
      );
      showSuccess(`Đã xóa vĩnh viễn lớp học "${target.name}".`);
      onRefresh();
    } catch (err) {
      console.error('Lỗi khi xóa lớp:', err);
      showError('Lỗi khi xóa lớp học. Vui lòng thử lại.');
    }
  };

  const handleToggleHideClass = async (c: SchoolClass) => {
    const nextHidden = !c.isHidden;
    try {
      await toggleHideClass(c.id, nextHidden);
      showSuccess(nextHidden ? `Đã tạm ẩn lớp ${c.name}.` : `Đã hiển thị lại lớp ${c.name}.`);
      onRefresh();
    } catch (err) {
      console.error('Lỗi ẩn/hiện lớp:', err);
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName.trim() || !subjectCode.trim()) return;

    try {
      await addSubject({
        name: subjectName.trim(),
        code: subjectCode.trim().toUpperCase(),
        description: subjectDesc.trim()
      });
      await logSystemAction(
        'CREATE_SUBJECT',
        user?.uid || 'admin',
        user?.email || 'admin',
        subjectCode,
        'subject',
        `Thêm môn học ${subjectName} (${subjectCode})`
      );
      setSubjectName('');
      setSubjectCode('');
      setSubjectDesc('');
      setShowAddSubject(false);
      showSuccess(`Đã thêm môn học "${subjectName.trim()}" (${subjectCode.trim().toUpperCase()}).`);
      onRefresh();
    } catch (err) {
      console.error('Lỗi khi thêm môn học:', err);
      showError('Không thể thêm môn học. Vui lòng thử lại.');
    }
  };

  const confirmDeleteSubject = async () => {
    if (!subjectToDelete) return;
    const target = subjectToDelete;
    setSubjectToDelete(null);

    try {
      await deleteSubject(target.id);
      await logSystemAction(
        'DELETE_SUBJECT',
        user?.uid || 'admin',
        user?.email || 'admin',
        target.id,
        'subject',
        `Xóa môn học ${target.name}`
      );
      showSuccess(`Đã xóa thành công môn học "${target.name}".`);
      onRefresh();
    } catch (err) {
      console.error('Lỗi khi xóa môn học:', err);
      showError('Lỗi khi xóa môn học. Vui lòng thử lại.');
    }
  };

  const allGrades = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* Toast Alerts */}
      {actionSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 shadow-xs animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 shadow-xs animate-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-medium">{actionError}</span>
        </div>
      )}

      {/* SECTION 1: CLASSES */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                Danh mục Lớp học ({filteredClasses.length} / {classes.length} lớp)
              </h3>
              {onlyTeachingScope && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  Đang lọc: Khối 6, 7, 8, 9
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Quản lý các lớp trong trường để phân công đề thi trắc nghiệm và xem kết quả
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddClass(!showAddClass)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm lớp mới</span>
            </button>
          </div>
        </div>

        {/* Filter bar for classes */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyTeachingScope(!onlyTeachingScope)}
              className={`px-3 py-1.5 rounded-lg font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                onlyTeachingScope
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Chỉ hiện lớp đang dạy (Khối 6, 7, 8, 9)</span>
            </button>

            <select
              value={selectedGradeFilter}
              onChange={(e) => setSelectedGradeFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-700 cursor-pointer"
            >
              <option value="all">Tất cả khối lớp</option>
              {allGrades.map(g => (
                <option key={g} value={g}>Khối {g}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setShowHiddenClasses(!showHiddenClasses)}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                showHiddenClasses 
                  ? 'bg-amber-100 border-amber-300 text-amber-800' 
                  : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {showHiddenClasses ? 'Đang hiện cả lớp đã ẩn' : 'Hiện lớp đã ẩn'}
            </button>
          </div>

          <span className="text-[11px] text-slate-500">
            Hiển thị {filteredClasses.length} lớp học phù hợp
          </span>
        </div>

        {/* Add Class Form */}
        {showAddClass && (
          <form onSubmit={handleCreateClass} className="bg-slate-50 p-5 rounded-2xl border border-indigo-200 space-y-4 animate-in fade-in duration-150">
            <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
              Khởi tạo lớp học mới
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tên lớp: *</label>
                <input
                  type="text"
                  placeholder="Ví dụ: 6A1, 7A2, 8B1..."
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Khối lớp (1 - 12):</label>
                <select
                  value={classGrade}
                  onChange={(e) => setClassGrade(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  {allGrades.map(g => (
                    <option key={g} value={g}>Khối {g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Niên khóa:</label>
                <input
                  type="text"
                  value={classYear}
                  onChange={(e) => setClassYear(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddClass(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs cursor-pointer"
              >
                Lưu lớp học
              </button>
            </div>
          </form>
        )}

        {/* Classes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredClasses.map((c) => (
            <div 
              key={c.id} 
              className={`p-4 rounded-xl border shadow-xs flex items-center justify-between transition-all ${
                c.isHidden 
                  ? 'bg-slate-50 border-slate-200 opacity-60' 
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    Khối {c.grade} • {c.schoolYear}
                  </span>
                  {c.isHidden && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                      Đã ẩn
                    </span>
                  )}
                </div>
                <p className="text-base font-black text-slate-900 mt-0.5">{c.name}</p>
                <p className="text-[11px] text-slate-500">{c.description || 'Lớp học tiêu chuẩn'}</p>
              </div>

              <div className="flex items-center gap-1">
                {/* Toggle Hide/Show */}
                <button
                  onClick={() => handleToggleHideClass(c)}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    c.isHidden 
                      ? 'text-amber-600 hover:bg-amber-100' 
                      : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                  }`}
                  title={c.isHidden ? "Hiện lại lớp học" : "Tạm ẩn lớp học"}
                >
                  {c.isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>

                {/* Delete class */}
                <button
                  onClick={() => setClassToDelete(c)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="Xóa lớp học vĩnh viễn"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {filteredClasses.length === 0 && (
            <div className="col-span-full py-8 text-center bg-white rounded-xl border border-dashed border-slate-200">
              <p className="text-xs text-slate-500">Không tìm thấy lớp học nào phù hợp với bộ lọc hiện tại.</p>
              <button
                type="button"
                onClick={() => { setOnlyTeachingScope(false); setSelectedGradeFilter('all'); }}
                className="mt-2 text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
              >
                Hiển thị tất cả các lớp
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: SUBJECTS */}
      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-600" />
              Danh mục Môn học ({subjects.length} môn)
            </h3>
            <p className="text-xs text-slate-500">
              Quản lý các môn học được tổ chức kiểm tra, thi trắc nghiệm trong trường. Có thể xóa các môn không sử dụng.
            </p>
          </div>

          <button
            onClick={() => setShowAddSubject(!showAddSubject)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm môn học</span>
          </button>
        </div>

        {/* Add Subject Form */}
        {showAddSubject && (
          <form onSubmit={handleCreateSubject} className="bg-slate-50 p-5 rounded-2xl border border-emerald-200 space-y-4 animate-in fade-in duration-150">
            <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
              Thêm môn học mới
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tên môn học: *</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Tin học, Toán học, KHTN..."
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Mã môn (viết hoa): *</label>
                <input
                  type="text"
                  placeholder="Ví dụ: IT, MATH, KHTN..."
                  value={subjectCode}
                  onChange={(e) => setSubjectCode(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 uppercase font-mono"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddSubject(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs cursor-pointer"
              >
                Lưu môn học
              </button>
            </div>
          </form>
        )}

        {/* Subjects Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {subjects.map((s) => (
            <div 
              key={s.id || s.code} 
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between hover:border-slate-300 transition-all"
            >
              <div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-bold inline-block">
                  {s.code}
                </span>
                <p className="text-sm font-bold text-slate-900 mt-1">{s.name}</p>
                <p className="text-[11px] text-slate-400 truncate max-w-[150px]">{s.description || 'Chương trình giảng dạy'}</p>
              </div>

              {/* Delete Subject Button */}
              <button
                type="button"
                onClick={() => setSubjectToDelete(s)}
                className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title={`Xóa môn ${s.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Confirmation Modal for Class Deletion */}
      <ConfirmModal
        isOpen={classToDelete !== null}
        title={`Xác nhận xóa lớp ${classToDelete?.name}?`}
        message={`Lớp học "${classToDelete?.name}" sẽ bị xóa khỏi hệ thống. Các đề thi và kết quả trước đây vẫn được lưu trong cơ sở dữ liệu.`}
        confirmText="Xóa lớp học"
        onConfirm={confirmDeleteClass}
        onCancel={() => setClassToDelete(null)}
      />

      {/* Confirmation Modal for Subject Deletion */}
      <ConfirmModal
        isOpen={subjectToDelete !== null}
        title={`Xác nhận xóa môn học ${subjectToDelete?.name}?`}
        message={`Môn học "${subjectToDelete?.name}" (${subjectToDelete?.code}) sẽ bị xóa khỏi danh mục. Các đề thi đã tạo của môn này vẫn được bảo toàn.`}
        confirmText="Xóa môn học"
        onConfirm={confirmDeleteSubject}
        onCancel={() => setSubjectToDelete(null)}
      />
    </div>
  );
};
