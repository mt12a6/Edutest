import React, { useState } from 'react';
import { 
  FileText, 
  Plus, 
  FileUp, 
  Clock, 
  BookOpen, 
  Users, 
  BarChart3, 
  Trash2, 
  Eye, 
  EyeOff,
  CheckCircle, 
  XCircle, 
  Search,
  Filter,
  Share2,
  Sparkles,
  Shuffle,
  Settings2,
  CheckCircle2,
  AlertCircle,
  Edit3
} from 'lucide-react';
import { Exam, Question, SchoolClass, Subject } from '../../types';
import { 
  toggleExamPublish, 
  toggleExamHide,
  toggleExamShuffle,
  deleteExam, 
  logSystemAction,
  getTeacherScope,
  isExamInTeacherScope,
  TeacherScopeConfig
} from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { ConfirmModal } from '../common/ConfirmModal';
import { TeacherScopeModal } from '../common/TeacherScopeModal';
import { ExamPreviewModal } from './ExamPreviewModal';

interface ExamManagerProps {
  exams: Exam[];
  classes: SchoolClass[];
  subjects: Subject[];
  onOpenWordUpload: () => void;
  onEditExam?: (exam: Exam) => void;
  onViewResults: (exam: Exam) => void;
  onRefreshExams: () => void;
}

export const ExamManager: React.FC<ExamManagerProps> = ({
  exams,
  classes,
  subjects,
  onOpenWordUpload,
  onEditExam,
  onViewResults,
  onRefreshExams
}) => {
  const { user } = useAuth();
  
  // Teacher teaching scope
  const [teacherScope, setTeacherScope] = useState<TeacherScopeConfig>(getTeacherScope());
  const [showScopeModal, setShowScopeModal] = useState<boolean>(false);
  const [onlyTeachingScope, setOnlyTeachingScope] = useState<boolean>(teacherScope.enabled);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [showHiddenExams, setShowHiddenExams] = useState(false);

  // Exam preview modal
  const [previewExam, setPreviewExam] = useState<Exam | null>(null);

  // Confirmation & Feedback State
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);
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

  const allGrades = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

  const filteredExams = exams.filter(e => {
    // Hidden filter
    if (!showHiddenExams && e.isHidden) return false;

    // Scope filter (Toán 6, Tin 6-9)
    if (onlyTeachingScope && !isExamInTeacherScope(e, teacherScope)) {
      return false;
    }

    // Status filter
    if (statusFilter === 'published' && !e.isPublished) return false;
    if (statusFilter === 'draft' && e.isPublished) return false;

    const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.subjectName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSub = selectedSubject === 'all' || e.subjectId === selectedSubject;
    const matchesGrade = selectedGrade === 'all' || e.grade === selectedGrade;
    return matchesSearch && matchesSub && matchesGrade;
  });

  const handleTogglePublish = async (exam: Exam) => {
    try {
      const nextStatus = !exam.isPublished;
      await toggleExamPublish(exam.id, nextStatus);
      await logSystemAction(
        'TOGGLE_EXAM_PUBLISH',
        user?.uid || 'unknown',
        user?.email || 'unknown',
        exam.id,
        'exam',
        `${nextStatus ? 'Mở' : 'Đóng'} kỳ thi "${exam.title}"`
      );
      showSuccess(nextStatus ? `Đã mở kỳ thi "${exam.title}" cho học sinh.` : `Đã tạm đóng kỳ thi "${exam.title}".`);
      onRefreshExams();
    } catch (err) {
      console.error('Không thể cập nhật trạng thái đề thi:', err);
      showError('Lỗi cập nhật trạng thái đề thi.');
    }
  };

  const handleToggleHide = async (exam: Exam) => {
    const nextHidden = !exam.isHidden;
    try {
      await toggleExamHide(exam.id, nextHidden);
      showSuccess(nextHidden ? `Đã ẩn kỳ thi "${exam.title}".` : `Đã bỏ ẩn kỳ thi "${exam.title}".`);
      onRefreshExams();
    } catch (err) {
      console.error('Lỗi khi ẩn/hiện đề thi:', err);
      showError('Lỗi khi thay đổi trạng thái ẩn/hiện.');
    }
  };

  const handleToggleShuffle = async (exam: Exam) => {
    // Toggle both shuffleQuestions and shuffleOptions
    const nextShuffle = !(exam.shuffleQuestions || exam.shuffleOptions);
    try {
      await toggleExamShuffle(exam.id, nextShuffle, nextShuffle);
      showSuccess(nextShuffle ? `Đã bật tính năng trộn đề & hoán vị đáp án cho "${exam.title}"!` : `Đã tắt trộn đề cho "${exam.title}".`);
      onRefreshExams();
    } catch (err) {
      console.error('Lỗi cập nhật trộn đề:', err);
    }
  };

  const confirmDelete = async () => {
    if (!examToDelete) return;
    const target = examToDelete;
    setExamToDelete(null);

    try {
      await deleteExam(target.id);
      await logSystemAction(
        'DELETE_EXAM',
        user?.uid || 'unknown',
        user?.email || 'unknown',
        target.id,
        'exam',
        `Xóa đề thi "${target.title}"`
      );
      showSuccess(`Đã xóa vĩnh viễn đề thi "${target.title}".`);
      onRefreshExams();
    } catch (err) {
      console.error('Lỗi khi xóa đề thi:', err);
      showError('Không thể xóa đề thi. Vui lòng thử lại.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Toast Alert */}
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

      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 leading-tight">
            Quản lý Ngân hàng Đề thi & Kỳ thi
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Tạo đề trắc nghiệm thông minh, trộn đề chống gian lận, phân công lớp và giám sát kỳ thi trực tuyến
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowScopeModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:text-emerald-700 bg-white text-slate-700 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
          >
            <Settings2 className="w-4 h-4 text-emerald-600" />
            <span>Môn phụ trách (Toán 6, Tin 6-9)</span>
          </button>

          <button
            onClick={onOpenWordUpload}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <FileUp className="w-4 h-4" />
            <span>Nhập đề từ Word / PDF / JSON</span>
          </button>
        </div>
      </div>

      {/* Teacher Scope Banner */}
      <div className="p-4 bg-gradient-to-r from-emerald-50 via-teal-50 to-indigo-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-900">
                Phân công giảng dạy của bạn:
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                Toán 6 • Tin học 6, 7, 8, 9
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Hệ thống hỗ trợ ẩn/hiện các kỳ thi ngoài phạm vi giảng dạy để giao diện luôn gọn gàng, tập trung.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <button
            type="button"
            onClick={() => setOnlyTeachingScope(!onlyTeachingScope)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
              onlyTeachingScope
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{onlyTeachingScope ? 'Đang bật lọc môn đang dạy' : 'Đang hiện tất cả môn & khối'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowScopeModal(true)}
            className="p-1.5 bg-white border border-slate-200 text-slate-600 hover:text-emerald-700 rounded-xl transition-colors cursor-pointer"
            title="Tùy chỉnh môn & khối đang dạy"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Tìm kiếm đề thi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white font-medium text-slate-700 cursor-pointer"
          >
            <option value="all">Tất cả khối lớp</option>
            {allGrades.map(g => (
              <option key={g} value={g}>Khối {g}</option>
            ))}
          </select>

          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white font-medium text-slate-700 cursor-pointer"
          >
            <option value="all">Tất cả môn học</option>
            {subjects.map(s => (
              <option key={s.id || s.code} value={s.id || s.code}>{s.name}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white font-medium text-slate-700 cursor-pointer"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="published">Đang mở thi</option>
            <option value="draft">Bản nháp / Đang đóng</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <button
            type="button"
            onClick={() => setShowHiddenExams(!showHiddenExams)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              showHiddenExams 
                ? 'bg-amber-100 border-amber-300 text-amber-800' 
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {showHiddenExams ? 'Đang hiện đề đã ẩn' : 'Hiện đề đã ẩn'}
          </button>

          <span className="text-xs font-bold text-slate-400">
            {filteredExams.length} đề thi
          </span>
        </div>
      </div>

      {/* Exam Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredExams.map((exam) => {
          const isShuffled = exam.shuffleQuestions || exam.shuffleOptions;
          return (
            <div 
              key={exam.id} 
              className={`rounded-2xl border shadow-xs overflow-hidden transition-all flex flex-col justify-between ${
                exam.isHidden 
                  ? 'bg-slate-50 border-slate-200 opacity-60' 
                  : 'bg-white border-slate-200 hover:shadow-md hover:border-slate-300'
              }`}
            >
              <div className="p-5 space-y-3">
                {/* Header tags */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md border border-emerald-100">
                      {exam.subjectName}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                      Khối {exam.grade}
                    </span>
                    {isShuffled && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200 flex items-center gap-1" title="Đã kích hoạt tự động đảo vị trí câu hỏi & đáp án khi học sinh làm bài">
                        <Shuffle className="w-3 h-3 text-indigo-600" />
                        Trộn đề
                      </span>
                    )}
                    {exam.isHidden && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded">
                        Đang ẩn
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Hide/Show Toggle */}
                    <button
                      onClick={() => handleToggleHide(exam)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        exam.isHidden ? 'text-amber-600 hover:bg-amber-100' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                      }`}
                      title={exam.isHidden ? "Hiện lại đề thi" : "Tạm ẩn đề thi"}
                    >
                      {exam.isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>

                    {/* Delete Exam Button */}
                    <button
                      onClick={() => setExamToDelete(exam)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Xóa đề thi vĩnh viễn"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="font-bold text-sm text-slate-900 leading-snug line-clamp-2">
                  {exam.title}
                </h3>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{exam.durationMinutes} phút</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                    <span>{exam.questionCount} câu hỏi</span>
                  </div>
                </div>

                {/* Shuffle quick toggle bar */}
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Shuffle className={`w-3.5 h-3.5 ${isShuffled ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className="font-semibold text-slate-700 text-[11px]">
                      {isShuffled ? 'Chế độ Trộn đề: Bật' : 'Chế độ Trộn đề: Tắt'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleShuffle(exam)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                      isShuffled 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {isShuffled ? 'Đã bật' : 'Bật ngay'}
                  </button>
                </div>

                {/* Assigned classes */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-semibold text-slate-400">Lớp phân công:</span>
                  {exam.classIds && exam.classIds.length > 0 ? (
                    exam.classIds.map(cid => (
                      <span key={cid} className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 font-bold rounded">
                        {cid}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">Tất cả lớp khối {exam.grade}</span>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => handleTogglePublish(exam)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                      exam.isPublished
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                    }`}
                    title={exam.isPublished ? "Đề đang mở cho học sinh thi. Bấm để đóng." : "Đề đang ở dạng nháp/đóng. Bấm để mở thi."}
                  >
                    {exam.isPublished ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-500" />}
                    <span>{exam.isPublished ? 'Mở thi' : 'Bản nháp'}</span>
                  </button>

                  <button
                    onClick={() => setPreviewExam(exam)}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1"
                    title="Xem chi tiết các câu hỏi, hình vẽ minh họa và công thức toán của đề thi"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                    <span>Xem đề</span>
                  </button>

                  {onEditExam && (
                    <button
                      onClick={() => onEditExam(exam)}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-200 transition-colors cursor-pointer flex items-center gap-1"
                      title="Chỉnh sửa câu hỏi, đáp án và thông số đề thi"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Sửa</span>
                    </button>
                  )}
                </div>

                <button
                  onClick={() => onViewResults(exam)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 ml-auto"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Kết quả & Lớp</span>
                </button>
              </div>
            </div>
          );
        })}

        {filteredExams.length === 0 && (
          <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="font-bold text-sm text-slate-800">Không tìm thấy đề thi phù hợp</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Bạn có thể tắt chế độ lọc môn phụ trách hoặc nhấn "Nhập đề từ Word / PDF" để đưa đề thi mới lên.
            </p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                type="button"
                onClick={() => { setOnlyTeachingScope(false); setSelectedGrade('all'); setSelectedSubject('all'); setStatusFilter('all'); }}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Hiển thị tất cả đề thi
              </button>
              <button
                type="button"
                onClick={onOpenWordUpload}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                Tạo đề thi mới
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Exam Deletion */}
      <ConfirmModal
        isOpen={examToDelete !== null}
        title={`Xác nhận xóa đề thi "${examToDelete?.title}"?`}
        message={`Đề thi "${examToDelete?.title}" và toàn bộ câu hỏi liên quan sẽ bị xóa khỏi ngân hàng đề thi. Thao tác này không thể hoàn tác.`}
        confirmText="Xóa đề thi"
        onConfirm={confirmDelete}
        onCancel={() => setExamToDelete(null)}
      />

      {/* Teaching Scope Modal */}
      <TeacherScopeModal
        isOpen={showScopeModal}
        onClose={() => setShowScopeModal(false)}
        currentScope={teacherScope}
        onSaveScope={(newScope) => {
          setTeacherScope(newScope);
          setOnlyTeachingScope(newScope.enabled);
        }}
      />

      {/* Exam Preview Modal */}
      {previewExam && (
        <ExamPreviewModal
          isOpen={previewExam !== null}
          onClose={() => setPreviewExam(null)}
          exam={previewExam}
          classes={classes}
          onEditExam={(ex, qList) => {
            setPreviewExam(null);
            if (onEditExam) onEditExam(ex);
          }}
          onRefreshExams={onRefreshExams}
        />
      )}
    </div>
  );
};
