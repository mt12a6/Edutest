import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Pin, 
  Settings2, 
  Check, 
  Search, 
  Filter, 
  ArrowUp, 
  ArrowDown, 
  Sparkles, 
  AlertCircle,
  Clock,
  Layers,
  BookOpen,
  Calendar,
  Eye,
  EyeOff,
  CheckCircle2
} from 'lucide-react';
import { Exam, Subject, HomepageSettings, DEFAULT_HOMEPAGE_SETTINGS } from '../../types';
import { saveHomepageSettings } from '../../services/db';
import { useAuth } from '../../context/AuthContext';

interface PinnedExamsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  exams: Exam[];
  subjects: Subject[];
  currentSettings: HomepageSettings;
  onSaved: (newSettings: HomepageSettings) => void;
}

export const PinnedExamsConfigModal: React.FC<PinnedExamsConfigModalProps> = ({
  isOpen,
  onClose,
  exams,
  subjects,
  currentSettings,
  onSaved
}) => {
  const { user, profile } = useAuth();
  const [settings, setSettings] = useState<HomepageSettings>({
    ...DEFAULT_HOMEPAGE_SETTINGS,
    ...currentSettings
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'rules' | 'select' | 'order'>('rules');

  useEffect(() => {
    if (isOpen) {
      setSettings({
        ...DEFAULT_HOMEPAGE_SETTINGS,
        ...currentSettings
      });
      setErrorMsg(null);
    }
  }, [isOpen, currentSettings]);

  // Available subject options (deduplicated from both subject list and existing exams)
  const availableSubjects = useMemo(() => {
    const map = new Map<string, string>();
    subjects.forEach(s => map.set(s.name, s.name));
    exams.forEach(e => {
      if (e.subjectName) map.set(e.subjectName, e.subjectName);
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [subjects, exams]);

  // Filtered exams for manual selection
  const filteredExams = useMemo(() => {
    return exams.filter(e => {
      if (settings.publishedOnly && !e.isPublished) return false;
      if (settings.hideExpired && e.closeTime) {
        const isExpired = new Date(e.closeTime).getTime() < Date.now();
        if (isExpired) return false;
      }
      if (gradeFilter !== 'all' && e.grade !== gradeFilter) return false;
      if (subjectFilter !== 'all' && (e.subjectName || '') !== subjectFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = e.title.toLowerCase().includes(q);
        const matchCode = (e.trialCode || e.examCode || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCode) return false;
      }
      return true;
    });
  }, [exams, settings.publishedOnly, settings.hideExpired, gradeFilter, subjectFilter, searchQuery]);

  // Selected exams list in order
  const orderedSelectedExams = useMemo(() => {
    const idSet = new Set(settings.pinnedExamIds);
    const examMap = new Map<string, Exam>();
    exams.forEach(e => examMap.set(e.id, e));

    const result: Exam[] = [];
    // First push in order specified by pinnedOrder
    (settings.pinnedOrder || []).forEach(id => {
      if (idSet.has(id) && examMap.has(id)) {
        result.push(examMap.get(id)!);
        idSet.delete(id);
      }
    });
    // Then any remaining selected IDs
    idSet.forEach(id => {
      if (examMap.has(id)) {
        result.push(examMap.get(id)!);
      }
    });
    return result;
  }, [settings.pinnedExamIds, settings.pinnedOrder, exams]);

  if (!isOpen) return null;

  // Toggle subject selection
  const handleToggleSubject = (subjName: string) => {
    const current = settings.pinnedSubjectIds || [];
    const exists = current.includes(subjName);
    let next: string[];
    if (exists) {
      next = current.filter(s => s !== subjName);
    } else {
      if (current.length >= settings.maxPinnedSubjects) {
        setErrorMsg(`Đã đạt giới hạn tối đa ${settings.maxPinnedSubjects} môn học được ghim.`);
        return;
      }
      next = [...current, subjName];
    }
    setErrorMsg(null);
    setSettings(prev => ({ ...prev, pinnedSubjectIds: next }));
  };

  // Toggle individual exam selection
  const handleToggleExam = (exam: Exam) => {
    const currentIds = settings.pinnedExamIds || [];
    const isSelected = currentIds.includes(exam.id);

    if (isSelected) {
      const nextIds = currentIds.filter(id => id !== exam.id);
      const nextOrder = (settings.pinnedOrder || []).filter(id => id !== exam.id);
      setSettings(prev => ({ ...prev, pinnedExamIds: nextIds, pinnedOrder: nextOrder }));
      setErrorMsg(null);
    } else {
      if (currentIds.length >= settings.maxPinnedExams) {
        setErrorMsg(`Đã đạt giới hạn tối đa ${settings.maxPinnedExams} đề thi được ghim. Hãy tăng số lượng tối đa hoặc bỏ chọn bớt đề khác.`);
        return;
      }
      // If subject restriction is enabled, check subject
      if (settings.pinnedSubjectIds.length > 0 && exam.subjectName) {
        if (!settings.pinnedSubjectIds.includes(exam.subjectName)) {
          setErrorMsg(`Đề thi môn "${exam.subjectName}" không nằm trong danh sách các môn được ghim.`);
          return;
        }
      }
      const nextIds = [...currentIds, exam.id];
      const nextOrder = [...(settings.pinnedOrder || []), exam.id];
      setSettings(prev => ({ ...prev, pinnedExamIds: nextIds, pinnedOrder: nextOrder }));
      setErrorMsg(null);
    }
  };

  // Move item up in order
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const currentOrder = orderedSelectedExams.map(e => e.id);
    const temp = currentOrder[index - 1];
    currentOrder[index - 1] = currentOrder[index];
    currentOrder[index] = temp;
    setSettings(prev => ({ ...prev, pinnedOrder: currentOrder }));
  };

  // Move item down in order
  const handleMoveDown = (index: number) => {
    if (index >= orderedSelectedExams.length - 1) return;
    const currentOrder = orderedSelectedExams.map(e => e.id);
    const temp = currentOrder[index + 1];
    currentOrder[index + 1] = currentOrder[index];
    currentOrder[index] = temp;
    setSettings(prev => ({ ...prev, pinnedOrder: currentOrder }));
  };

  // Save settings
  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const saved = await saveHomepageSettings(
        {
          ...settings,
          pinnedOrder: orderedSelectedExams.map(e => e.id)
        },
        {
          id: user?.uid,
          displayName: profile?.displayName || user?.displayName || 'Giáo viên'
        }
      );
      onSaved(saved);
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi lưu cấu hình ghim:', err);
      setErrorMsg('Không thể lưu cấu hình. Vui lòng kiểm tra kết nối mạng và thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-3xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-slate-800"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center">
              <Pin className="w-4 h-4 fill-teal-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Cấu hình Đề thi Ghim nổi bật</span>
                <span className="text-[10px] font-semibold text-teal-800 bg-teal-100/70 px-2 py-0.5 rounded-full">
                  Trang chủ
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Điều chỉnh số lượng đề ghim, môn học hiển thị và thứ tự ưu tiên cho học sinh
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-100 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'rules'
                ? 'border-teal-600 text-teal-700 bg-teal-50/40'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Quy tắc & Số lượng</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('select')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'select'
                ? 'border-teal-600 text-teal-700 bg-teal-50/40'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Chọn đề ghim</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 font-bold">
              {settings.pinnedExamIds?.length || 0}/{settings.maxPinnedExams}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('order')}
            className={`px-3 py-2 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'order'
                ? 'border-teal-600 text-teal-700 bg-teal-50/40'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Sắp xếp thứ tự</span>
            {orderedSelectedExams.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-teal-100 text-teal-800 font-bold">
                {orderedSelectedExams.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: RULES & LIMITS */}
          {activeTab === 'rules' && (
            <div className="space-y-5 animate-in fade-in duration-100">
              {/* Toggle Enable Pinned Section */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="space-y-0.5">
                  <span className="text-sm font-bold text-slate-900 block">
                    Bật khu vực &quot;Đề thi nổi bật&quot; trên trang chủ
                  </span>
                  <span className="text-xs text-slate-500">
                    Khi tắt, hệ thống sẽ ẩn hoàn toàn khu vực ghim đề và chỉ hiển thị danh mục bên dưới.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.pinnedEnabled}
                    onChange={(e) => setSettings(prev => ({ ...prev, pinnedEnabled: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                </label>
              </div>

              {/* A. Max Pinned Exams */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>A. Số lượng đề thi ghim tối đa</span>
                  <span className="text-teal-700 font-semibold">{settings.maxPinnedExams} đề</span>
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[3, 4, 6, 8, 10].map(num => (
                    <button
                      key={`max-exam-${num}`}
                      type="button"
                      onClick={() => setSettings(prev => ({ ...prev, maxPinnedExams: num }))}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                        settings.maxPinnedExams === num
                          ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {num} đề
                    </button>
                  ))}
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={settings.maxPinnedExams}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val > 0) {
                          setSettings(prev => ({ ...prev, maxPinnedExams: val }));
                        }
                      }}
                      className="w-full py-1.5 px-2 text-center text-xs font-bold bg-white border border-slate-200 rounded-xl focus:border-teal-500 focus:outline-none"
                      placeholder="Khác..."
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Số lượng đề thi hiển thị ở khu vực nổi bật sẽ không vượt quá con số này.
                </p>
              </div>

              {/* B. Max Pinned Subjects */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>B. Số lượng môn học được ghim tối đa</span>
                  <span className="text-teal-700 font-semibold">{settings.maxPinnedSubjects} môn</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map(num => (
                    <button
                      key={`max-subj-${num}`}
                      type="button"
                      onClick={() => setSettings(prev => ({ ...prev, maxPinnedSubjects: num }))}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                        settings.maxPinnedSubjects === num
                          ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {num} môn
                    </button>
                  ))}
                </div>
              </div>

              {/* C. Select Pinned Subjects */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-800 block">
                  C. Chọn môn học được phép ghim (Đang chọn: {settings.pinnedSubjectIds.length}/{settings.maxPinnedSubjects} môn)
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableSubjects.map(subjName => {
                    const isChecked = settings.pinnedSubjectIds.includes(subjName);
                    return (
                      <button
                        key={`subj-filter-${subjName}`}
                        type="button"
                        onClick={() => handleToggleSubject(subjName)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                          isChecked
                            ? 'bg-teal-50 text-teal-800 border-teal-300 font-bold'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                          isChecked ? 'bg-teal-600 text-white border-teal-600' : 'border-slate-300'
                        }`}>
                          {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                        <span>{subjName}</span>
                      </button>
                    );
                  })}
                  {availableSubjects.length === 0 && (
                    <span className="text-xs text-slate-400">Chưa có môn học nào trong hệ thống.</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Nếu để trống không chọn môn nào, hệ thống sẽ cho phép ghim đề thuộc mọi môn học.
                </p>
              </div>

              {/* E. Advanced Visibility & Integrity Rules */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-800 block">
                  E. Các quy tắc hiển thị và bảo mật dữ liệu
                </label>
                
                <div className="space-y-2 text-xs">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.excludePinnedFromList}
                      onChange={(e) => setSettings(prev => ({ ...prev, excludePinnedFromList: e.target.checked }))}
                      className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                    />
                    <span className="font-medium text-slate-700">
                      <strong>Tự động loại đề ghim khỏi danh mục bên dưới</strong> (Không hiển thị trùng lặp đề)
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.publishedOnly}
                      onChange={(e) => setSettings(prev => ({ ...prev, publishedOnly: e.target.checked }))}
                      className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                    />
                    <span className="font-medium text-slate-700">
                      Chỉ hiển thị các đề đã xuất bản (Ẩn đề bản nháp khỏi học sinh)
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.hideExpired}
                      onChange={(e) => setSettings(prev => ({ ...prev, hideExpired: e.target.checked }))}
                      className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                    />
                    <span className="font-medium text-slate-700">
                      Tự động ẩn đề đã hết hạn nộp bài khỏi khu vực nổi bật
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EXAM SELECTION */}
          {activeTab === 'select' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              {/* Search & Filter bar */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm tên đề hoặc mã đề..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-teal-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={gradeFilter}
                    onChange={(e) => setGradeFilter(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  >
                    <option value="all">Tất cả khối</option>
                    <option value="6">Khối 6</option>
                    <option value="7">Khối 7</option>
                    <option value="8">Khối 8</option>
                    <option value="9">Khối 9</option>
                    <option value="10">Khối 10</option>
                    <option value="11">Khối 11</option>
                    <option value="12">Khối 12</option>
                  </select>

                  <select
                    value={subjectFilter}
                    onChange={(e) => setSubjectFilter(e.target.value)}
                    className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  >
                    <option value="all">Tất cả môn</option>
                    {availableSubjects.map(s => (
                      <option key={`opt-${s}`} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status indicator */}
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 px-1">
                <span>Đã chọn: <strong className="text-teal-700">{settings.pinnedExamIds?.length || 0}</strong> / {settings.maxPinnedExams} đề</span>
                <span>Tìm thấy: {filteredExams.length} đề thi phù hợp</span>
              </div>

              {/* Exam items list */}
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-[380px] overflow-y-auto bg-slate-50/40">
                {filteredExams.map(exam => {
                  const isSelected = (settings.pinnedExamIds || []).includes(exam.id);
                  return (
                    <div
                      key={`exam-row-${exam.id}`}
                      onClick={() => handleToggleExam(exam)}
                      className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-teal-50/70 hover:bg-teal-50' : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] shrink-0 ${
                          isSelected ? 'bg-teal-600 text-white border-teal-600' : 'border-slate-300 bg-white'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {exam.title}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            <span>Khối {exam.grade || '?'}</span>
                            <span>•</span>
                            <span>{exam.subjectName || 'Chung'}</span>
                            <span>•</span>
                            <span>{exam.durationMinutes} phút</span>
                            <span>•</span>
                            <span>{exam.questionCount || 0} câu</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {exam.isSecure && (
                          <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                            Bảo mật
                          </span>
                        )}
                        {!exam.isPublished && (
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                            Nháp
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filteredExams.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Không tìm thấy đề thi nào phù hợp với bộ lọc hiện tại.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ORDER PRIORITY */}
          {activeTab === 'order' && (
            <div className="space-y-3 animate-in fade-in duration-100">
              <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Sử dụng các nút <strong>Lên</strong> và <strong>Xuống</strong> để sắp xếp thứ tự ưu tiên hiển thị đề thi từ trên xuống dưới trên trang chủ.
                </span>
              </div>

              {orderedSelectedExams.length > 0 ? (
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white overflow-hidden">
                  {orderedSelectedExams.map((exam, idx) => (
                    <div
                      key={`order-${exam.id}`}
                      className="p-3 flex items-center justify-between gap-3 bg-white hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {exam.title}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Khối {exam.grade} • {exam.subjectName} • {exam.durationMinutes} phút
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveUp(idx)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                          title="Di chuyển lên"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === orderedSelectedExams.length - 1}
                          onClick={() => handleMoveDown(idx)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                          title="Di chuyển xuống"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                  Chưa có đề thi nào được chọn để ghim. Hãy chuyển sang tab &quot;Chọn đề ghim&quot; để chọn đề trước.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200/60 transition-colors"
          >
            Hủy bỏ
          </button>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <span>Đang lưu...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Áp dụng cấu hình ghim</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
