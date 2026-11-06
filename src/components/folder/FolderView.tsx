import React, { useState } from 'react';
import { 
  Folder, 
  ArrowLeft, 
  Share2, 
  Check, 
  Copy, 
  BookOpen, 
  Clock, 
  Users, 
  Play, 
  Search, 
  Filter,
  CheckCircle2,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { Subject, Exam, SchoolClass, Question } from '../../types';
import { getSubjectIcon } from '../teacher/ExamManager';
import { getDynamicRouteUrl, copyToClipboard } from '../../utils/slugUtils';

interface FolderViewProps {
  subject: Subject;
  exams: Exam[];
  classes: SchoolClass[];
  onBackToHome: () => void;
  onSelectExamToTake: (exam: Exam, questions?: Question[]) => void;
  onViewResults?: (exam: Exam, targetTab?: 'by_class' | 'students' | 'questions' | 'essay_grading') => void;
}

export const FolderView: React.FC<FolderViewProps> = ({
  subject,
  exams,
  classes,
  onBackToHome,
  onSelectExamToTake,
  onViewResults
}) => {
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const folderSlug = subject.slug || 'thu-muc';
  const fullFolderUrl = getDynamicRouteUrl('thu-muc', folderSlug);

  // Filter exams in this folder / subject
  const folderExams = exams.filter(e => {
    const matchSubject = e.subjectId === subject.id || 
                         e.subjectId === subject.code || 
                         (e.subjectName && e.subjectName.toLowerCase() === subject.name.toLowerCase());
    if (!matchSubject) return false;

    // Grade filter
    if (selectedGrade !== 'all' && e.grade !== selectedGrade) {
      return false;
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = e.title.toLowerCase().includes(q);
      const matchGrade = `khối ${e.grade}`.includes(q);
      if (!matchTitle && !matchGrade) return false;
    }

    return true;
  });

  const handleCopyFolderUrl = async () => {
    const success = await copyToClipboard(fullFolderUrl);
    if (success) {
      setCopiedUrl(fullFolderUrl);
      setTimeout(() => setCopiedUrl(null), 3000);
    }
  };

  const handleCopyExamUrl = async (exam: Exam, e: React.MouseEvent) => {
    e.stopPropagation();
    const examUrl = getDynamicRouteUrl('bai-thi', exam.slug || exam.id);
    const success = await copyToClipboard(examUrl);
    if (success) {
      setCopiedUrl(examUrl);
      setTimeout(() => setCopiedUrl(null), 3000);
    }
  };

  const grades = ['6', '7', '8', '9', '10', '11', '12'];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Toast Notification */}
      {copiedUrl && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-teal-900 text-white shadow-xl shadow-teal-950/20 border border-teal-700/50 animate-in slide-in-from-bottom-5">
          <Check className="w-5 h-5 text-teal-300" />
          <div className="text-xs font-semibold">
            Đã sao chép liên kết vào bộ nhớ tạm!
            <div className="text-[11px] font-mono text-teal-200 truncate max-w-xs">{copiedUrl}</div>
          </div>
        </div>
      )}

      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onBackToHome}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-teal-700 transition-colors py-1 px-2.5 rounded-xl hover:bg-slate-100 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại Trang chủ</span>
        </button>

        <div className="text-xs text-slate-500 font-medium">
          Thư mục môn học &bull; <span className="font-bold text-slate-800">{subject.name}</span>
        </div>
      </div>

      {/* Folder Header Card */}
      <div className="bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-teal-900/40">
        <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center shrink-0 shadow-inner">
              <Folder className="w-8 h-8 text-teal-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="px-2.5 py-0.5 rounded-lg bg-teal-400/20 text-teal-200 text-[11px] font-bold uppercase tracking-wider border border-teal-400/30">
                  {subject.code || 'MÔN HỌC'}
                </span>
                <span className="text-slate-400 text-xs">
                  {folderExams.length} bài thi có sẵn
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Thư mục {subject.name}
              </h1>
              {subject.description && (
                <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  {subject.description}
                </p>
              )}
            </div>
          </div>

          {/* Copy Link & Share Button */}
          <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="bg-slate-800/80 backdrop-blur-xs border border-slate-700/60 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono text-teal-300 truncate max-w-[200px]">
                /thu-muc/{folderSlug}
              </span>
              <button
                onClick={handleCopyFolderUrl}
                title="Sao chép liên kết thư mục"
                className="p-1 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                {copiedUrl === fullFolderUrl ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>

            <button
              onClick={handleCopyFolderUrl}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition-all shadow-md hover:shadow-teal-500/20 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Chia sẻ Thư mục</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        {/* Grade Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedGrade('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
              selectedGrade === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả khối
          </button>
          {grades.map(g => (
            <button
              key={g}
              onClick={() => setSelectedGrade(g)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedGrade === g
                  ? 'bg-teal-600 text-white shadow-xs shadow-teal-600/30'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Khối {g}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm bài thi trong thư mục..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all"
          />
        </div>
      </div>

      {/* Exam List within Folder */}
      {folderExams.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center max-w-md mx-auto space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <BookOpen className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Chưa có bài thi nào</h3>
            <p className="text-xs text-slate-500 mt-1">
              Thư mục {subject.name} {selectedGrade !== 'all' ? `(Khối ${selectedGrade})` : ''} hiện chưa có bài thi nào được xuất bản hoặc phù hợp điều kiện tìm kiếm.
            </p>
          </div>
          <button
            onClick={() => { setSelectedGrade('all'); setSearchQuery(''); }}
            className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Xem tất cả bài thi
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {folderExams.map(exam => {
            const examUrl = getDynamicRouteUrl('bai-thi', exam.slug || exam.id);
            return (
              <div
                key={exam.id}
                className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 hover:border-teal-400/80 shadow-xs hover:shadow-md transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0 mt-0.5">
                    {getSubjectIcon(exam.subjectName)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                        Khối {exam.grade}
                      </span>
                      {exam.isPinned && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200">
                          Đã ghim
                        </span>
                      )}
                      {exam.examCode && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200">
                          Có mã bảo mật
                        </span>
                      )}
                    </div>

                    <h3 
                      onClick={() => onSelectExamToTake(exam)}
                      className="text-sm font-bold text-slate-900 hover:text-teal-600 transition-colors cursor-pointer line-clamp-1"
                    >
                      {exam.title}
                    </h3>

                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {exam.durationMinutes} phút
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                        {exam.questionCount || 0} câu hỏi
                      </span>
                      <span>&bull;</span>
                      <div className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md text-[11px] font-mono group-hover:text-teal-800 transition-colors">
                        <span>/bai-thi/{exam.slug || exam.id}</span>
                        <button
                          onClick={(e) => handleCopyExamUrl(exam, e)}
                          title="Sao chép liên kết bài thi này"
                          className="hover:text-teal-600 p-0.5"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    onClick={() => onSelectExamToTake(exam)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-xs hover:shadow-teal-600/30 transition-all cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Vào làm bài</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
