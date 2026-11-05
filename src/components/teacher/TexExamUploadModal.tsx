import React, { useState, useRef } from 'react';
import { 
  FileCode, 
  X, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  BookOpen, 
  Clock, 
  Sparkles, 
  Eye, 
  Save, 
  ArrowRight,
  Layers,
  FileText
} from 'lucide-react';
import { Exam, Question, SchoolClass, Subject } from '../../types';
import { parseTexExamContent, ParsedTexResult } from '../../utils/texParser';
import { MathRenderer } from '../common/MathRenderer';
import { createExamWithQuestions } from '../../services/db';
import { useAuth } from '../../context/AuthContext';

interface TexExamUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  classes: SchoolClass[];
  onUploadSuccess: (exam: Exam) => void;
}

export const TexExamUploadModal: React.FC<TexExamUploadModalProps> = ({
  isOpen,
  onClose,
  subjects,
  classes,
  onUploadSuccess
}) => {
  const { user, profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rawTexContent, setRawTexContent] = useState<string>('');
  const [parsedData, setParsedData] = useState<ParsedTexResult | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('12');
  const [durationMinutes, setDurationMinutes] = useState<number>(90);
  const [examTitle, setExamTitle] = useState<string>('');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');

  if (!isOpen) return null;

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRawTexContent(text);
      handleParse(text);
    };
    reader.readAsText(file);
  };

  // Run parser
  const handleParse = (contentToParse: string) => {
    try {
      setErrorMessage(null);
      const res = parseTexExamContent(contentToParse);
      setParsedData(res);
      setExamTitle(res.title);
      setSelectedGrade(res.grade || '12');
      setDurationMinutes(res.durationMinutes || 90);

      // Match subject
      const matchedSub = subjects.find(s => s.name.toLowerCase().includes(res.subjectName.toLowerCase()));
      if (matchedSub) {
        setSelectedSubjectId(matchedSub.id);
      } else if (subjects.length > 0) {
        setSelectedSubjectId(subjects[0].id);
      }

      if (res.questions.length > 0) {
        setActiveTab('preview');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi xử lý file LaTeX');
    }
  };

  // Save exam to database
  const handleSaveExam = async () => {
    if (!parsedData || parsedData.questions.length === 0) {
      setErrorMessage('Không có câu hỏi hợp lệ để tạo đề thi.');
      return;
    }

    if (!examTitle.trim()) {
      setErrorMessage('Vui lòng nhập tên đề thi.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const selectedSub = subjects.find(s => s.id === selectedSubjectId);
      const totalPoints = parsedData.questions.reduce((sum, q) => sum + (q.points || 0), 0);

      const examData: Omit<Exam, 'id'> = {
        title: examTitle.trim(),
        subjectId: selectedSubjectId || 'general',
        subjectName: selectedSub?.name || 'Toán học',
        grade: selectedGrade,
        durationMinutes: durationMinutes || 90,
        passScore: Math.round(totalPoints * 0.5 * 10) / 10,
        maxScore: totalPoints || 10,
        questionCount: parsedData.questions.length,
        classIds: selectedClassIds,
        isPublished: true,
        showScoreAfterExam: true,
        showAnswersAfterExam: true,
        allowReview: true,
        createdBy: user?.uid || profile?.id || 'teacher',
        createdByName: profile?.displayName || user?.displayName || 'Giáo viên',
        createdAt: new Date().toISOString()
      };

      const examId = await createExamWithQuestions(examData, parsedData.questions);
      const fullExam: Exam = {
        ...examData,
        id: examId
      };
      onUploadSuccess(fullExam);
      onClose();
    } catch (err: any) {
      console.error('Lỗi lưu đề thi LaTeX:', err);
      setErrorMessage(err.message || 'Không thể lưu đề thi vào cơ sở dữ liệu.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-5xl h-[92vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:px-6 sm:py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold flex items-center gap-2">
                Soạn &amp; Nhập đề thi từ file LaTeX (.tex)
                <span className="text-[10px] bg-teal-500 text-slate-900 px-2 py-0.5 rounded-full font-black">
                  KaTeX ENGINE
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Tự động nhận diện công thức Toán, bảng biểu, hệ phương trình, trắc nghiệm và lời giải chi tiết
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle Bar */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === 'editor' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              1. Tải lên &amp; Mã nguồn .tex
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              disabled={!parsedData}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                activeTab === 'preview' ? 'bg-teal-600 text-white' : 'bg-white text-slate-600 border border-slate-200 disabled:opacity-40'
              }`}
            >
              2. Xem trước đề thi ({parsedData?.questions.length || 0} câu)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".tex,.txt"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:border-teal-500 text-slate-700 font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5 text-teal-600" />
              <span>Chọn file .tex từ máy</span>
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Body View */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
          
          {activeTab === 'editor' ? (
            <div className="space-y-4 max-w-4xl mx-auto">
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <label className="text-xs font-bold text-slate-700 block">
                  Dán nội dung mã nguồn file LaTeX (.tex):
                </label>
                <textarea
                  rows={14}
                  value={rawTexContent}
                  onChange={(e) => setRawTexContent(e.target.value)}
                  placeholder={`% Ví dụ đề thi định dạng LaTeX chuẩn Bộ GD&ĐT:
\\begin{ex}
  Tập nghiệm của bất phương trình $\\log_2 (x - 1) < 3$ là:
  \\choice
  {\\True $(1; 9)$}
  {$(-\\infty; 9)$}
  {$(1; 8)$}
  {$(2; 9)$}
  \\loigiai{
    Điều kiện: $x - 1 > 0 \\Leftrightarrow x > 1$.
    Khi đó: $\\log_2 (x - 1) < 3 \\Leftrightarrow x - 1 < 2^3 = 8 \\Leftrightarrow x < 9$.
    Kết hợp điều kiện suy ra $S = (1; 9)$.
  }
\\end{ex}`}
                  className="w-full p-3 font-mono text-xs bg-slate-900 text-slate-100 rounded-xl border border-slate-700 focus:outline-none focus:border-teal-500"
                />

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-slate-400">
                    Hỗ trợ gói ex_test, exam, thpt, vted... và tự động xử lý công thức toán phức tạp.
                  </span>

                  <button
                    type="button"
                    onClick={() => handleParse(rawTexContent)}
                    disabled={!rawTexContent.trim()}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Phân tích câu hỏi LaTeX</span>
                  </button>
                </div>
              </div>
            </div>

          ) : (

            /* Preview & Configure Tab */
            <div className="space-y-5 max-w-4xl mx-auto">
              {/* Exam Info Form */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Tên đề thi:</label>
                  <input
                    type="text"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Môn học:</label>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Khối lớp:</label>
                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    {['6', '7', '8', '9', '10', '11', '12'].map(g => (
                      <option key={g} value={g}>Khối {g}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Thời gian làm bài:</label>
                  <input
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Số lượng câu hỏi:</label>
                  <div className="px-3 py-1.5 text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-xl">
                    {parsedData?.questions.length || 0} câu đã nhận diện
                  </div>
                </div>
              </div>

              {/* Questions List Preview */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Danh sách câu hỏi hiển thị thử nghiệm (KaTeX):
                </h3>

                {parsedData?.questions.map((q, idx) => (
                  <div key={idx} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-xs font-black text-teal-700">
                        Câu {idx + 1} ({q.points} điểm)
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {q.sectionTitle || 'Trắc nghiệm'}
                      </span>
                    </div>

                    {/* Question Prompt with MathRenderer */}
                    <div className="text-sm font-semibold text-slate-900">
                      <MathRenderer content={q.prompt} />
                    </div>

                    {/* Options */}
                    {q.options && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {(['A', 'B', 'C', 'D'] as const).map(opt => {
                          const isCorrect = q.correctOption === opt;
                          return (
                            <div
                              key={opt}
                              className={`p-2 rounded-xl border text-xs flex items-center gap-2 ${
                                isCorrect ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold' : 'bg-slate-50 border-slate-200 text-slate-700'
                              }`}
                            >
                              <span className="w-5 h-5 rounded-md bg-white border border-slate-300 font-black text-[11px] flex items-center justify-center shrink-0">
                                {opt}
                              </span>
                              <div className="flex-1">
                                <MathRenderer content={q.options?.[opt] || ''} />
                              </div>
                              {isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Explanation */}
                    {q.explanation && (
                      <div className="p-2.5 rounded-xl bg-teal-50/60 border border-teal-200/60 text-xs text-teal-950 mt-2">
                        <span className="font-bold block text-teal-800 mb-0.5">Lời giải chi tiết:</span>
                        <MathRenderer content={q.explanation} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl"
          >
            Hủy bỏ
          </button>

          <div className="flex items-center gap-2">
            {activeTab === 'preview' && (
              <button
                type="button"
                onClick={handleSaveExam}
                disabled={isSaving || !parsedData?.questions.length}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40 active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Đang lưu...' : 'Lưu đề thi vào hệ thống'}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
