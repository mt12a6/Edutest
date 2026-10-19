import React, { useState } from 'react';
import { X, Check, Filter, BookOpen, Layers, Sparkles, RotateCcw } from 'lucide-react';
import { TeacherScopeConfig, saveTeacherScope, DEFAULT_TEACHER_SCOPE } from '../../services/db';

interface TeacherScopeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentScope: TeacherScopeConfig;
  onSaveScope: (newScope: TeacherScopeConfig) => void;
}

export const TeacherScopeModal: React.FC<TeacherScopeModalProps> = ({
  isOpen,
  onClose,
  currentScope,
  onSaveScope
}) => {
  const [scopeEnabled, setScopeEnabled] = useState(currentScope.enabled);
  
  // Math grades
  const mathRule = currentScope.rules.find(r => r.subjectKeyword === 'Toán');
  const [mathGrades, setMathGrades] = useState<string[]>(mathRule ? mathRule.grades : ['6']);

  // IT grades
  const itRule = currentScope.rules.find(r => r.subjectKeyword === 'Tin');
  const [itGrades, setItGrades] = useState<string[]>(itRule ? itRule.grades : ['6', '7', '8', '9']);

  if (!isOpen) return null;

  const toggleGrade = (grade: string, currentList: string[], setList: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (currentList.includes(grade)) {
      setList(currentList.filter(g => g !== grade));
    } else {
      setList([...currentList, grade].sort((a, b) => parseInt(a) - parseInt(b)));
    }
  };

  const handleApplyPresetCurrent = () => {
    setScopeEnabled(true);
    setMathGrades(['6']);
    setItGrades(['6', '7', '8', '9']);
  };

  const handleSave = () => {
    const updated: TeacherScopeConfig = {
      enabled: scopeEnabled,
      rules: [
        { subjectKeyword: 'Toán', grades: mathGrades },
        { subjectKeyword: 'Tin', grades: itGrades }
      ]
    };
    saveTeacherScope(updated);
    onSaveScope(updated);
    onClose();
  };

  const allGrades = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-teal-900 to-emerald-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                Cấu hình Môn & Khối Lớp Đang Giảng Dạy
              </h3>
              <p className="text-xs text-emerald-200 mt-0.5">
                Ẩn các đề thi và lớp học ngoài phân công giảng dạy
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-emerald-200 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Main Toggle */}
          <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
            <div className="pr-4">
              <p className="text-sm font-black text-emerald-950">
                Bật bộ lọc Môn giảng dạy
              </p>
              <p className="text-xs text-emerald-800 mt-0.5">
                Khi bật, hệ thống chỉ hiển thị đề thi và lớp học thuộc các khối môn được chọn dưới đây.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={scopeEnabled}
                onChange={(e) => setScopeEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Quick preset button */}
          <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div>
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Mẫu nhanh của bạn:
              </span>
              <p className="text-[11px] text-slate-500">
                Toán 6 và Tin học 6, 7, 8, 9
              </p>
            </div>
            <button
              type="button"
              onClick={handleApplyPresetCurrent}
              className="px-3 py-1.5 bg-white border border-slate-300 hover:border-emerald-500 hover:text-emerald-700 text-slate-700 text-xs font-bold rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              Áp dụng mẫu này
            </button>
          </div>

          {/* Section 1: Toán học */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                Môn Toán học - Các khối đang dạy:
              </label>
              <span className="text-[11px] text-slate-500">
                Đã chọn: {mathGrades.length > 0 ? `Khối ${mathGrades.join(', ')}` : 'Chưa chọn'}
              </span>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-6 gap-2">
              {allGrades.map(g => {
                const isSelected = mathGrades.includes(g);
                return (
                  <button
                    key={`math_${g}`}
                    type="button"
                    onClick={() => toggleGrade(g, mathGrades, setMathGrades)}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    K{g}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Tin học */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                <Layers className="w-4 h-4 text-emerald-600" />
                Môn Tin học - Các khối đang dạy:
              </label>
              <span className="text-[11px] text-slate-500">
                Đã chọn: {itGrades.length > 0 ? `Khối ${itGrades.join(', ')}` : 'Chưa chọn'}
              </span>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-6 gap-2">
              {allGrades.map(g => {
                const isSelected = itGrades.includes(g);
                return (
                  <button
                    key={`it_${g}`}
                    type="button"
                    onClick={() => toggleGrade(g, itGrades, setItGrades)}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
                      isSelected
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    K{g}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Lưu cấu hình</span>
          </button>
        </div>
      </div>
    </div>
  );
};
