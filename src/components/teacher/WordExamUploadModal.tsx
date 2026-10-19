import React, { useState } from 'react';
import { 
  X, 
  Upload, 
  FileUp,
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  Plus, 
  Trash2, 
  Save, 
  Clock, 
  BookOpen, 
  Layers,
  Sparkles,
  ArrowRight,
  Eye,
  Image as ImageIcon,
  Calculator,
  Check,
  CheckSquare
} from 'lucide-react';
import { parseExamFile } from '../../utils/docxParser';
import { normalizeMathFormulas } from '../../utils/mathFormatter';
import { ParsedDocxQuestion, SchoolClass, Subject, QuestionType, TrueFalseItem, Exam, Question } from '../../types';
import { createExamWithQuestions, updateExamWithQuestions, logSystemAction } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { MathRenderer } from '../common/MathRenderer';
import { MathFormulaToolbar } from '../common/MathFormulaToolbar';

interface WordExamUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExamCreated: (examId: string) => void;
  classes: SchoolClass[];
  subjects: Subject[];
  initialExam?: Exam | null;
  initialQuestions?: Question[];
}

export const WordExamUploadModal: React.FC<WordExamUploadModalProps> = ({
  isOpen,
  onClose,
  onExamCreated,
  classes,
  subjects,
  initialExam = null,
  initialQuestions = []
}) => {
  const { user, profile } = useAuth();
  const isEditing = Boolean(initialExam);

  // Wizard steps: 'upload' -> 'preview_edit' -> 'settings_save'
  const [step, setStep] = useState<'upload' | 'preview_edit' | 'settings_save'>(
    initialExam ? 'preview_edit' : 'upload'
  );
  
  // File and questions state
  const [fileName, setFileName] = useState<string>(initialExam ? `${initialExam.title}.docx` : '');
  const [rawText, setRawText] = useState<string>('');
  const [parsedQuestions, setParsedQuestions] = useState<ParsedDocxQuestion[]>(() => {
    if (initialQuestions && initialQuestions.length > 0) {
      return initialQuestions.map(q => ({
        questionNumber: q.questionNumber,
        type: q.type,
        prompt: q.prompt,
        imageUrl: q.imageUrl,
        options: q.options,
        correctOption: q.correctOption,
        subQuestions: q.subQuestions,
        acceptableAnswers: q.acceptableAnswers,
        sampleAnswer: q.sampleAnswer,
        explanation: q.explanation,
        points: q.points || 1,
        warnings: []
      }));
    }
    return [];
  });
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Active question index for inserting math formula toolbar
  const [activeFormulaTarget, setActiveFormulaTarget] = useState<{
    qIndex: number;
    field: 'prompt' | 'explanation' | 'A' | 'B' | 'C' | 'D';
  } | null>(null);

  // Exam Configuration
  const [title, setTitle] = useState<string>(initialExam?.title || '');
  const [subjectId, setSubjectId] = useState<string>(initialExam?.subjectId || subjects[0]?.code || 'MATH');
  const [grade, setGrade] = useState<string>(initialExam?.grade || '6');
  const [durationMinutes, setDurationMinutes] = useState<number>(initialExam?.durationMinutes || 45);
  const [passScore, setPassScore] = useState<number>(initialExam?.passScore ?? 5);
  const [maxScore, setMaxScore] = useState<number>(initialExam?.maxScore ?? 10);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(initialExam?.classIds || ['6A1']);
  const [isPublished, setIsPublished] = useState<boolean>(initialExam?.isPublished ?? false);
  const [showAnswersAfterExam, setShowAnswersAfterExam] = useState<boolean>(initialExam?.showAnswersAfterExam ?? true);
  const [allowReview, setAllowReview] = useState<boolean>(initialExam?.allowReview ?? true);
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(initialExam?.shuffleQuestions ?? true);
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(initialExam?.shuffleOptions ?? true);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle local .docx, .pdf, or .json file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isDocx = lowerName.endsWith('.docx');
    const isPdf = lowerName.endsWith('.pdf');
    const isJson = lowerName.endsWith('.json');

    if (!isDocx && !isPdf && !isJson) {
      setParseError('Vui lòng chọn tệp định dạng Word (.docx), PDF (.pdf) hoặc JSON (.json - chuẩn Azota / EduTest)');
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setFileName(file.name);

    try {
      const result = await parseExamFile(file);
      if (!result.questions || result.questions.length === 0) {
        setParseError('Không tìm thấy câu hỏi nào trong tệp. Hãy kiểm tra lại định dạng câu hỏi trong đề thi (ví dụ: "Câu 1: ... A. ... B. ... C. ... D.").');
        setIsParsing(false);
        return;
      }

      setParsedQuestions(result.questions);
      setRawText(result.rawText);
      if (result.detectedTitle) {
        setTitle(result.detectedTitle);
      } else {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
      if (result.detectedGrade) {
        setGrade(result.detectedGrade);
      }
      if (result.detectedSubject) {
        const found = subjects.find(s => 
          s.name.toLowerCase().includes(result.detectedSubject!.toLowerCase()) || 
          s.code.toLowerCase().includes(result.detectedSubject!.toLowerCase())
        );
        if (found) setSubjectId(found.code);
      }
      setStep('preview_edit');
    } catch (err: any) {
      console.error('Lỗi phân tích tệp:', err);
      setParseError(err?.message || 'Không thể đọc tệp đề thi. Vui lòng đảm bảo tệp không bị khóa hoặc hỏng.');
    } finally {
      setIsParsing(false);
    }
  };

  // Bulk normalize all mathematical formulas into clean LaTeX
  const handleNormalizeAllMath = () => {
    const updated = parsedQuestions.map(q => ({
      ...q,
      prompt: normalizeMathFormulas(q.prompt),
      options: q.options ? {
        A: normalizeMathFormulas(q.options.A || ''),
        B: normalizeMathFormulas(q.options.B || ''),
        C: normalizeMathFormulas(q.options.C || ''),
        D: normalizeMathFormulas(q.options.D || '')
      } : undefined,
      subQuestions: q.subQuestions ? q.subQuestions.map(s => ({
        ...s,
        text: normalizeMathFormulas(s.text)
      })) : undefined,
      explanation: normalizeMathFormulas(q.explanation || '')
    }));
    setParsedQuestions(updated);
  };

  // Pre-load a sample exam with all 4 question types + math formulas
  const handleLoadSample = () => {
    const sampleQuestionsList: ParsedDocxQuestion[] = [
      {
        questionNumber: 1,
        type: 'multiple_choice',
        prompt: 'Trong các câu sau, câu nào là mệnh đề toán học đúng về tập số thực $\\mathbb{R}$?',
        options: {
          A: 'Mọi số thực $x$ đều thỏa mãn $x^2 > 0$.',
          B: '$\\exists x \\in \\mathbb{R}: x^2 + 1 = 0$.',
          C: '$\\forall x \\in \\mathbb{R}: x^2 \\ge 0$.',
          D: 'Phương trình $\\sqrt{x} = -2$ có nghiệm thực.'
        },
        correctOption: 'C',
        explanation: 'Bình phương của mọi số thực luôn không âm: $\\forall x \\in \\mathbb{R}, x^2 \\ge 0$.',
        points: 1,
        warnings: []
      },
      {
        questionNumber: 2,
        type: 'true_false',
        prompt: 'Cho tam giác $ABC$ vuông tại $A$ có $AB = 3\\text{ cm}, AC = 4\\text{ cm}$. Xét tính Đúng hay Sai của các khẳng định sau:',
        subQuestions: [
          { key: 'a', text: 'Độ dài cạnh huyền $BC = 5\\text{ cm}$.', correct: true },
          { key: 'b', text: 'Diện tích tam giác $S_{ABC} = 12\\text{ cm}^2$.', correct: false },
          { key: 'c', text: 'Giá trị $\\sin B = \\frac{4}{5}$.', correct: true },
          { key: 'd', text: 'Bán kính đường tròn ngoại tiếp $R = 2.5\\text{ cm}$.', correct: true }
        ],
        explanation: 'BC = √(3² + 4²) = 5; Diện tích S = 1/2 * 3 * 4 = 6 cm² (nên ý b sai); sin B = AC/BC = 4/5; R = BC/2 = 2.5 cm.',
        points: 1,
        warnings: []
      },
      {
        questionNumber: 3,
        type: 'fill_blank',
        prompt: 'Điền kết quả: Cho phương trình bậc hai $x^2 - 6x + 9 = 0$. Phương trình có nghiệm kép $x$ bằng bao nhiêu?',
        acceptableAnswers: ['3', 'x=3', 'x = 3'],
        explanation: 'Phương trình tương đương $(x - 3)^2 = 0 \\Leftrightarrow x = 3$.',
        points: 1,
        warnings: []
      },
      {
        questionNumber: 4,
        type: 'multiple_choice',
        prompt: 'Tính giá trị lượng giác của biểu thức $P = \\sin(30^\\circ) + \\cos(60^\\circ)$.',
        options: {
          A: '$\\frac{\\sqrt{3}}{2}$',
          B: '$1$',
          C: '$\\frac{1}{2}$',
          D: '$\\sqrt{2}$'
        },
        correctOption: 'B',
        explanation: 'Ta có $\\sin(30^\\circ) = 1/2$ và $\\cos(60^\\circ) = 1/2$. Do đó $P = 1/2 + 1/2 = 1$.',
        points: 1,
        warnings: []
      },
      {
        questionNumber: 5,
        type: 'essay',
        prompt: 'Tự luận: Cho hàm số bậc hai $y = f(x) = x^2 - 4x + 3$. Hãy lập bảng biến thiên và vẽ phác đồ thị hàm số trên mặt phẳng tọa độ Oxy.',
        sampleAnswer: 'Đỉnh I(2; -1), trục đối xứng x = 2, bề lõm quay lên, cắt Ox tại (1; 0) và (3; 0), cắt Oy tại (0; 3).',
        explanation: 'Xác định tọa độ đỉnh $x_I = 2, y_I = -1$. Chiều biến thiên: nghịch biến trên $(-\\infty; 2)$, đồng biến trên $(2; +\\infty)$.',
        points: 2,
        warnings: []
      }
    ];

    setFileName('De_thi_Tong_hop_Toan_10_chuan_GDPT.docx');
    setTitle('Đề thi Tổng hợp Môn Toán 10 - Đa dạng hình thức thi');
    setParsedQuestions(sampleQuestionsList);
    setRawText('Đề thi Toán 10 tổng hợp...');
    setStep('preview_edit');
  };

  // Question editing helpers
  const handleUpdateQuestion = (index: number, updated: ParsedDocxQuestion) => {
    const list = [...parsedQuestions];
    list[index] = updated;
    list[index].warnings = [];
    list[index].isAmbiguous = false;
    setParsedQuestions(list);
  };

  const handleDeleteQuestion = (index: number) => {
    const list = parsedQuestions.filter((_, i) => i !== index).map((q, i) => ({
      ...q,
      questionNumber: i + 1
    }));
    setParsedQuestions(list);
  };

  const handleAddNewQuestion = (type: QuestionType = 'multiple_choice') => {
    const newQ: ParsedDocxQuestion = {
      questionNumber: parsedQuestions.length + 1,
      type,
      prompt: 'Nhập nội dung câu hỏi (hỗ trợ công thức LaTeX $...$)...',
      options: type === 'multiple_choice' ? {
        A: 'Phương án A',
        B: 'Phương án B',
        C: 'Phương án C',
        D: 'Phương án D'
      } : undefined,
      correctOption: type === 'multiple_choice' ? 'A' : undefined,
      subQuestions: type === 'true_false' ? [
        { key: 'a', text: 'Ý kiến a', correct: true },
        { key: 'b', text: 'Ý kiến b', correct: false },
        { key: 'c', text: 'Ý kiến c', correct: true },
        { key: 'd', text: 'Ý kiến d', correct: false }
      ] : undefined,
      acceptableAnswers: type === 'fill_blank' ? [''] : undefined,
      explanation: '',
      points: 1,
      warnings: []
    };
    setParsedQuestions([...parsedQuestions, newQ]);
  };

  // Handle uploading question image
  const handleQuestionImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const imgFile = e.target.files?.[0];
    if (!imgFile) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target?.result as string;
      handleUpdateQuestion(index, {
        ...parsedQuestions[index],
        imageUrl: dataUrl
      });
    };
    reader.readAsDataURL(imgFile);
  };

  // Final submit to database (supports draft vs publish override)
  const handleSaveExam = async (publishOverride?: boolean) => {
    setValidationError(null);
    setSaveSuccess(null);

    if (!title.trim()) {
      setValidationError('CẢNH BÁO: Vui lòng nhập tên đề thi trước khi lưu.');
      setStep('settings_save');
      return;
    }

    if (parsedQuestions.length === 0) {
      setValidationError('CẢNH BÁO: Đề thi phải có ít nhất 1 câu hỏi.');
      setStep('preview_edit');
      return;
    }

    // Check empty prompt
    const emptyPrompt = parsedQuestions.find(q => !q.prompt || !q.prompt.trim());
    if (emptyPrompt) {
      setValidationError(`CẢNH BÁO: Câu hỏi số ${emptyPrompt.questionNumber} đang để trống nội dung câu hỏi. Vui lòng nhập nội dung.`);
      setStep('preview_edit');
      return;
    }

    // Check multiple choice missing answers
    const missingAnswer = parsedQuestions.find(q => q.type === 'multiple_choice' && !q.correctOption);
    if (missingAnswer) {
      setValidationError(`CẢNH BÁO: Câu hỏi trắc nghiệm số ${missingAnswer.questionNumber} chưa chọn đáp án đúng. Vui lòng chọn A, B, C hoặc D.`);
      setStep('preview_edit');
      return;
    }

    // Check fill-in-the-blank missing acceptable answers
    const missingBlank = parsedQuestions.find(q => q.type === 'fill_blank' && (!q.acceptableAnswers || q.acceptableAnswers.filter(a => a.trim()).length === 0));
    if (missingBlank) {
      setValidationError(`CẢNH BÁO: Câu hỏi điền kết quả số ${missingBlank.questionNumber} chưa có đáp án đúng. Vui lòng nhập ít nhất 1 đáp số hợp lệ.`);
      setStep('preview_edit');
      return;
    }

    setIsSaving(true);
    try {
      const selectedSubject = subjects.find(s => s.code === subjectId);
      const subjectName = selectedSubject ? selectedSubject.name : 'Toán học';
      const finalPublished = publishOverride !== undefined ? publishOverride : isPublished;

      const examData = {
        title: title.trim(),
        subjectId,
        subjectName,
        grade,
        durationMinutes: Number(durationMinutes),
        passScore: Number(passScore),
        maxScore: Number(maxScore),
        questionCount: parsedQuestions.length,
        classIds: selectedClassIds,
        startTime: initialExam?.startTime || new Date().toISOString(),
        endTime: initialExam?.endTime || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        isPublished: finalPublished,
        shuffleQuestions,
        shuffleOptions,
        showAnswersAfterExam,
        allowReview,
        createdBy: initialExam?.createdBy || user?.uid || 'teacher',
        createdByName: initialExam?.createdByName || profile?.displayName || user?.email || 'Giáo viên'
      };

      const questionsToSave = parsedQuestions.map(q => ({
        questionNumber: q.questionNumber,
        type: q.type || 'multiple_choice',
        prompt: q.prompt,
        imageUrl: q.imageUrl || undefined,
        options: q.options || undefined,
        correctOption: q.correctOption,
        subQuestions: q.subQuestions || undefined,
        acceptableAnswers: q.acceptableAnswers || undefined,
        sampleAnswer: q.sampleAnswer,
        explanation: q.explanation || '',
        points: q.points || 1
      }));

      let savedExamId = initialExam?.id;

      if (isEditing && initialExam) {
        await updateExamWithQuestions(initialExam.id, examData, questionsToSave);
        await logSystemAction(
          'UPDATE_EXAM',
          user?.uid || 'unknown',
          user?.email || 'unknown',
          initialExam.id,
          'exam',
          `Cập nhật đề thi "${title}" (${parsedQuestions.length} câu, ${finalPublished ? 'Đã xuất bản' : 'Bản nháp'})`
        );
        setSaveSuccess(`Đã cập nhật thành công đề thi "${title}"!`);
      } else {
        savedExamId = await createExamWithQuestions(examData, questionsToSave);
        await logSystemAction(
          'CREATE_EXAM',
          user?.uid || 'unknown',
          user?.email || 'unknown',
          savedExamId,
          'exam',
          `Tạo đề thi "${title}" gồm ${parsedQuestions.length} câu (${finalPublished ? 'Đã xuất bản' : 'Bản nháp'})`
        );
        setSaveSuccess(`Đã lưu thành công đề thi "${title}" (${parsedQuestions.length} câu)!`);
      }

      setIsSaving(false);
      setTimeout(() => {
        if (savedExamId) onExamCreated(savedExamId);
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('Lỗi khi lưu đề thi:', err);
      setValidationError(`Có lỗi khi lưu đề thi: ${err?.message || 'Lỗi hệ thống'}. Dữ liệu đề thi đã được lưu tạm, vui lòng thử lại.`);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                {isEditing ? `Chỉnh sửa đề thi: ${title || 'Chưa đặt tên'}` : 'Tạo đề thi thông minh (Word, PDF, JSON Azota, Công thức & Hình ảnh)'}
              </h3>
              <p className="text-xs text-slate-300">
                {isEditing ? 'Cập nhật nội dung câu hỏi, đáp án đúng, công thức toán và thiết lập kỳ thi' : 'Hỗ trợ nhập từ Word, PDF, JSON chuẩn Azota kèm trích xuất hình vẽ và công thức KaTeX'}
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

        {/* Step Indicator */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setStep('upload')}
              className={`flex items-center gap-2 font-semibold cursor-pointer ${step === 'upload' ? 'text-emerald-700' : 'text-slate-500'}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'upload' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>1</span>
              Tải tệp Word / PDF
            </button>
            <span className="text-slate-300">/</span>
            <button
              onClick={() => parsedQuestions.length > 0 && setStep('preview_edit')}
              disabled={parsedQuestions.length === 0}
              className={`flex items-center gap-2 font-semibold ${step === 'preview_edit' ? 'text-emerald-700' : 'text-slate-500'} disabled:opacity-40 cursor-pointer`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'preview_edit' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>2</span>
              Xem trước & Chỉnh sửa ({parsedQuestions.length} câu)
            </button>
            <span className="text-slate-300">/</span>
            <button
              onClick={() => parsedQuestions.length > 0 && setStep('settings_save')}
              disabled={parsedQuestions.length === 0}
              className={`flex items-center gap-2 font-semibold ${step === 'settings_save' ? 'text-emerald-700' : 'text-slate-500'} disabled:opacity-40 cursor-pointer`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'settings_save' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>3</span>
              Thiết lập & Lưu đề
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Calculator className="w-3.5 h-3.5 text-indigo-600" />
            <span>Tự động nhận diện công thức LaTeX & Hình vẽ</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* Prominent Red Alert Card for Validation Errors */}
          {validationError && (
            <div className="p-4 bg-rose-50 border-2 border-rose-300 text-rose-900 rounded-2xl text-xs flex items-start gap-3 shadow-xs animate-in fade-in">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-bold text-rose-800">CẢNH BÁO LỖI SOẠN ĐỀ THI:</p>
                <p className="text-rose-700 leading-relaxed">{validationError}</p>
              </div>
              <button 
                onClick={() => setValidationError(null)}
                className="p-1 text-rose-400 hover:text-rose-700 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Green Success Banner */}
          {saveSuccess && (
            <div className="p-4 bg-emerald-50 border-2 border-emerald-300 text-emerald-900 rounded-2xl text-xs flex items-center gap-3 shadow-xs animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="font-bold">{saveSuccess}</span>
            </div>
          )}
          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-6 max-w-2xl mx-auto py-4">
              <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-3xl p-8 text-center bg-slate-50 hover:bg-emerald-50/20 transition-all">
                <input
                  type="file"
                  id="docxInput"
                  accept=".docx,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label 
                  htmlFor="docxInput" 
                  className="cursor-pointer flex flex-col items-center justify-center gap-3"
                >
                  <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-inner">
                    <Upload className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-800">
                      Chọn tệp đề thi Word (.docx) hoặc PDF (.pdf)
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      Tự động trích xuất toàn bộ hình vẽ minh họa, hình học, đồ thị và chuẩn hóa công thức toán sang mã KaTeX LaTeX ($...$)
                    </p>
                  </div>
                  <span className="mt-2 inline-flex items-center px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs">
                    Tải tệp Word / PDF lên
                  </span>
                </label>
              </div>

              {isParsing && (
                <div className="flex items-center justify-center gap-3 p-4 bg-emerald-50 text-emerald-800 rounded-xl text-sm font-medium">
                  <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Đang bóc tách đề thi, trích xuất hình vẽ minh họa và chuẩn hóa công thức toán học...</span>
                </div>
              )}

              {parseError && (
                <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{parseError}</span>
                </div>
              )}

              {/* Sample Preload for instant test */}
              <div className="bg-slate-100/80 rounded-2xl p-4 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-left">
                  <div className="font-semibold text-xs text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Chưa có sẵn tệp Word mẫu trên máy?
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Bấm để nạp ngay bộ đề thi Toán mẫu mới nhất gồm đủ 4 dạng: Trắc nghiệm, Đúng/Sai, Điền kết quả, Tự luận và công thức toán KaTeX.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="shrink-0 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  Nạp đề thi mẫu đa dạng
                </button>
              </div>

              {/* Formatting Guidelines */}
              <div className="text-xs text-slate-600 space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  Quy ước 4 dạng câu hỏi được hệ thống nhận diện tự động:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-500 text-[11px]">
                  <li><strong>Dạng 1 - Trắc nghiệm 4 lựa chọn:</strong> "Câu 1: ... A. ... B. ... C. ... D."</li>
                  <li><strong>Dạng 2 - Trắc nghiệm Đúng/Sai:</strong> "Câu 2: ... a) ... b) ... c) ... d) ..." (kèm [Đ], [S] hoặc (Đúng), (Sai))</li>
                  <li><strong>Dạng 3 - Điền kết quả:</strong> "Câu 3: Điền kết quả: ... Đáp số: 10"</li>
                  <li><strong>Dạng 4 - Tự luận:</strong> "Câu 4: Tự luận: ... Lời giải: ..."</li>
                  <li><strong>Công thức Toán:</strong> Nhập công thức trong dấu <code>$...$</code> hoặc <code>$$...$$</code> (ví dụ: <code>$\frac&#123;a&#125;&#123;b&#125;$</code>, <code>$\sqrt&#123;x&#125;$</code>)</li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & EDIT QUESTIONS */}
          {step === 'preview_edit' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Xem trước và duyệt danh sách {parsedQuestions.length} câu hỏi
                  </h4>
                  <p className="text-xs text-slate-500">
                    Tùy chỉnh dạng câu hỏi, hình ảnh đính kèm, công thức toán LaTeX và đáp án
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleNormalizeAllMath}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 cursor-pointer transition-colors shadow-2xs"
                    title="Tự động chuẩn hóa toàn bộ công thức toán học trong đề sang KaTeX LaTeX chuẩn"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Tự động chuẩn hóa công thức ($...$)</span>
                  </button>

                  <div className="relative group">
                    <button
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Thêm câu hỏi
                    </button>
                    <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg p-1 hidden group-hover:block z-20">
                      <button
                        onClick={() => handleAddNewQuestion('multiple_choice')}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-lg"
                      >
                        + Trắc nghiệm (A, B, C, D)
                      </button>
                      <button
                        onClick={() => handleAddNewQuestion('true_false')}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-lg"
                      >
                        + Đúng / Sai (a, b, c, d)
                      </button>
                      <button
                        onClick={() => handleAddNewQuestion('fill_blank')}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-lg"
                      >
                        + Điền kết quả
                      </button>
                      <button
                        onClick={() => handleAddNewQuestion('essay')}
                        className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-lg"
                      >
                        + Tự luận
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => setStep('settings_save')}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    Tiếp tục cấu hình đề
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-5">
                {parsedQuestions.map((q, index) => {
                  const qType = q.type || 'multiple_choice';

                  return (
                    <div 
                      key={index} 
                      className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4"
                    >
                      {/* Question Header & Type Selector */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-lg bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                            {q.questionNumber}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            Câu {q.questionNumber}
                          </span>

                          {/* Type Selector Dropdown */}
                          <select
                            value={qType}
                            onChange={(e) => handleUpdateQuestion(index, {
                              ...q,
                              type: e.target.value as QuestionType,
                              // initialize subQuestions if true_false
                              subQuestions: e.target.value === 'true_false' && !q.subQuestions ? [
                                { key: 'a', text: 'Mệnh đề a', correct: true },
                                { key: 'b', text: 'Mệnh đề b', correct: false },
                                { key: 'c', text: 'Mệnh đề c', correct: true },
                                { key: 'd', text: 'Mệnh đề d', correct: false }
                              ] : q.subQuestions,
                              acceptableAnswers: e.target.value === 'fill_blank' && !q.acceptableAnswers ? [''] : q.acceptableAnswers
                            })}
                            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1 bg-white font-medium text-slate-700 cursor-pointer"
                          >
                            <option value="multiple_choice">Trắc nghiệm 4 lựa chọn (A, B, C, D)</option>
                            <option value="true_false">Trắc nghiệm Đúng / Sai (a, b, c, d)</option>
                            <option value="fill_blank">Điền kết quả / Trả lời ngắn</option>
                            <option value="essay">Tự luận</option>
                          </select>

                          {q.imageUrl && (
                            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-200">
                              <ImageIcon className="w-3 h-3 text-indigo-600" />
                              Có hình vẽ
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuestion(index, {
                              ...q,
                              prompt: normalizeMathFormulas(q.prompt),
                              options: q.options ? {
                                A: normalizeMathFormulas(q.options.A || ''),
                                B: normalizeMathFormulas(q.options.B || ''),
                                C: normalizeMathFormulas(q.options.C || ''),
                                D: normalizeMathFormulas(q.options.D || '')
                              } : undefined,
                              explanation: normalizeMathFormulas(q.explanation || '')
                            })}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors"
                            title="Chuẩn hóa công thức toán câu này ($...$)"
                          >
                            <Calculator className="w-3.5 h-3.5" />
                            <span className="hidden md:inline text-[11px]">Chuẩn hóa toán</span>
                          </button>

                          {/* Điểm số */}
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <span>Điểm:</span>
                            <input
                              type="number"
                              min={0.25}
                              max={10}
                              step={0.25}
                              value={q.points || 1}
                              onChange={(e) => handleUpdateQuestion(index, { ...q, points: Number(e.target.value) })}
                              className="w-14 p-1 text-xs border border-slate-300 rounded-lg text-center"
                            />
                          </div>

                          <button
                            onClick={() => handleDeleteQuestion(index)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Xóa câu hỏi này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Prompt input with Math Toolbar */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                          <label className="text-[11px] font-semibold text-slate-600">
                            Nội dung câu hỏi (chèn công thức bằng $...$):
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveFormulaTarget(
                                activeFormulaTarget?.qIndex === index && activeFormulaTarget?.field === 'prompt' 
                                  ? null 
                                  : { qIndex: index, field: 'prompt' }
                              )}
                              className={`text-[11px] px-2.5 py-0.5 rounded-lg border font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                                activeFormulaTarget?.qIndex === index && activeFormulaTarget?.field === 'prompt'
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                              }`}
                            >
                              <Calculator className="w-3.5 h-3.5" />
                              <span>{activeFormulaTarget?.qIndex === index && activeFormulaTarget?.field === 'prompt' ? 'Đóng bộ công thức' : 'Bật bộ gõ công thức'}</span>
                            </button>
                            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                              {'Ví dụ: $\\frac{a}{b}, \\sqrt{x}, x^2$'}
                            </span>
                          </div>
                        </div>

                        {activeFormulaTarget?.qIndex === index && activeFormulaTarget?.field === 'prompt' && (
                          <div className="mb-2">
                            <MathFormulaToolbar
                              onInsert={(snippet) => {
                                handleUpdateQuestion(index, {
                                  ...q,
                                  prompt: q.prompt ? `${q.prompt} ${snippet}` : snippet
                                });
                              }}
                            />
                          </div>
                        )}

                        <textarea
                          value={q.prompt}
                          onChange={(e) => handleUpdateQuestion(index, { ...q, prompt: e.target.value })}
                          className="w-full text-xs font-medium text-slate-800 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 font-mono"
                          rows={2}
                          placeholder="Nhập nội dung câu hỏi..."
                        />
                      </div>

                      {/* Live Formula Preview of Prompt */}
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Xem trước hiển thị (KaTeX):
                        </span>
                        <MathRenderer content={q.prompt} className="text-slate-800 font-medium" />
                      </div>

                      {/* Image Attachment for this Question */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
                            <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                            Hình ảnh / Hình vẽ minh họa (tùy chọn):
                          </label>
                          {q.imageUrl && (
                            <button
                              type="button"
                              onClick={() => handleUpdateQuestion(index, { ...q, imageUrl: undefined })}
                              className="text-[10px] text-rose-600 hover:underline cursor-pointer"
                            >
                              Xóa ảnh
                            </button>
                          )}
                        </div>

                        {q.imageUrl ? (
                          <div className="p-2 border border-slate-200 rounded-xl bg-slate-50 flex items-center gap-4">
                            <img 
                              src={q.imageUrl} 
                              alt="Minh họa" 
                              className="max-h-24 max-w-xs rounded-lg border object-contain bg-white" 
                            />
                            <span className="text-[11px] text-slate-500">Đã gắn hình ảnh minh họa cho câu hỏi</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer transition-colors flex items-center gap-1.5">
                              <Upload className="w-3.5 h-3.5" />
                              <span>Tải ảnh từ máy tính</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleQuestionImageUpload(index, e)}
                                className="hidden"
                              />
                            </label>
                            <span className="text-[11px] text-slate-400">hoặc dán đường link ảnh:</span>
                            <input
                              type="url"
                              placeholder="https://..."
                              className="text-xs border border-slate-200 rounded-lg p-1.5 flex-1"
                              onBlur={(e) => {
                                if (e.target.value.trim()) {
                                  handleUpdateQuestion(index, { ...q, imageUrl: e.target.value.trim() });
                                }
                              }}
                            />
                          </div>
                        )}
                      </div>

                      {/* RENDER SPECIFIC INPUTS ACCORDING TO QUESTION TYPE */}

                      {/* TYPE 1: MULTIPLE CHOICE */}
                      {qType === 'multiple_choice' && (
                        <div className="space-y-2">
                          <label className="block text-[11px] font-semibold text-slate-500">
                            Các phương án lựa chọn (Click vào chữ cái để chọn đáp án đúng):
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {(['A', 'B', 'C', 'D'] as const).map((optKey) => {
                              const isCorrect = q.correctOption === optKey;
                              const currentOptions = q.options || { A: '', B: '', C: '', D: '' };
                              return (
                                <div 
                                  key={optKey}
                                  className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${
                                    isCorrect 
                                      ? 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-400' 
                                      : 'bg-slate-50 border-slate-200'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQuestion(index, { ...q, correctOption: optKey })}
                                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer transition-all ${
                                      isCorrect 
                                        ? 'bg-emerald-600 text-white shadow-xs' 
                                        : 'bg-white text-slate-600 border border-slate-300 hover:border-emerald-500'
                                    }`}
                                    title={`Chọn ${optKey} làm đáp án đúng`}
                                  >
                                    {optKey}
                                  </button>
                                  <input
                                    type="text"
                                    value={currentOptions[optKey] || ''}
                                    onChange={(e) => handleUpdateQuestion(index, {
                                      ...q,
                                      options: { ...currentOptions, [optKey]: e.target.value }
                                    })}
                                    placeholder={`Phương án ${optKey}...`}
                                    className="w-full text-xs text-slate-800 bg-transparent border-none focus:outline-hidden"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* TYPE 2: TRUE / FALSE (4 STATEMENTS a, b, c, d) */}
                      {qType === 'true_false' && (
                        <div className="space-y-2">
                          <label className="block text-[11px] font-semibold text-slate-500">
                            4 Mệnh đề Đúng / Sai (Định dạng thi THPT chuẩn):
                          </label>
                          <div className="space-y-2">
                            {(q.subQuestions || [
                              { key: 'a', text: '', correct: true },
                              { key: 'b', text: '', correct: false },
                              { key: 'c', text: '', correct: true },
                              { key: 'd', text: '', correct: false }
                            ]).map((sub, sIdx) => (
                              <div key={sub.key} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                                <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0">
                                  {sub.key}
                                </span>
                                <input
                                  type="text"
                                  value={sub.text}
                                  onChange={(e) => {
                                    const nextSub = [...(q.subQuestions || [])];
                                    nextSub[sIdx] = { ...sub, text: e.target.value };
                                    handleUpdateQuestion(index, { ...q, subQuestions: nextSub });
                                  }}
                                  placeholder={`Nội dung khẳng định ý ${sub.key}...`}
                                  className="flex-1 bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-800"
                                />
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextSub = [...(q.subQuestions || [])];
                                      nextSub[sIdx] = { ...sub, correct: true };
                                      handleUpdateQuestion(index, { ...q, subQuestions: nextSub });
                                    }}
                                    className={`px-2.5 py-1 rounded-lg font-bold text-xs cursor-pointer ${
                                      sub.correct ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                    }`}
                                  >
                                    Đúng
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextSub = [...(q.subQuestions || [])];
                                      nextSub[sIdx] = { ...sub, correct: false };
                                      handleUpdateQuestion(index, { ...q, subQuestions: nextSub });
                                    }}
                                    className={`px-2.5 py-1 rounded-lg font-bold text-xs cursor-pointer ${
                                      !sub.correct ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                    }`}
                                  >
                                    Sai
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* TYPE 3: FILL-IN-THE-BLANK (Trả lời ngắn / Điền kết quả) */}
                      {qType === 'fill_blank' && (
                        <div className="space-y-2">
                          <label className="block text-[11px] font-semibold text-slate-500">
                            Các đáp số được chấp nhận (ngăn cách bằng dấu chấm phẩy hoặc phẩy):
                          </label>
                          <input
                            type="text"
                            value={(q.acceptableAnswers || []).join('; ')}
                            onChange={(e) => {
                              const ansArr = e.target.value.split(/[;,]/).map(s => s.trim()).filter(Boolean);
                              handleUpdateQuestion(index, { ...q, acceptableAnswers: ansArr });
                            }}
                            placeholder="Ví dụ: 10; 10 cm; 10cm"
                            className="w-full text-xs font-semibold text-emerald-800 bg-emerald-50/50 border border-emerald-300 rounded-xl p-2.5"
                          />
                          <p className="text-[10px] text-slate-400">
                            Hệ thống sẽ tự động đối chiếu kết quả của học sinh với danh sách đáp số trên.
                          </p>
                        </div>
                      )}

                      {/* TYPE 4: ESSAY (Tự luận) */}
                      {qType === 'essay' && (
                        <div className="space-y-2">
                          <label className="block text-[11px] font-semibold text-slate-500">
                            Đáp án mẫu hoặc biểu điểm hướng dẫn chấm:
                          </label>
                          <textarea
                            value={q.sampleAnswer || ''}
                            onChange={(e) => handleUpdateQuestion(index, { ...q, sampleAnswer: e.target.value })}
                            placeholder="Nhập dàn ý hoặc các bước giải để học sinh đối chiếu..."
                            className="w-full text-xs text-slate-800 border border-slate-200 rounded-xl p-2.5"
                            rows={2}
                          />
                        </div>
                      )}

                      {/* Explanation */}
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                          Lời giải chi tiết / Hướng dẫn giải:
                        </label>
                        <input
                          type="text"
                          value={q.explanation || ''}
                          onChange={(e) => handleUpdateQuestion(index, { ...q, explanation: e.target.value })}
                          placeholder="Nhập lời giải hoặc kiến thức cần ghi nhớ..."
                          className="w-full text-xs text-slate-700 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: SETTINGS & SAVE */}
          {step === 'settings_save' && (
            <div className="space-y-6 max-w-2xl mx-auto py-2">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  Cấu hình kỳ thi & Thời gian
                </h4>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tiêu đề đề thi / Kỳ thi: *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ví dụ: Kiểm tra 1 tiết - Môn Toán 10"
                    className="w-full text-sm font-semibold text-slate-900 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Môn học:
                    </label>
                    <select
                      value={subjectId}
                      onChange={(e) => setSubjectId(e.target.value)}
                      className="w-full text-xs font-medium text-slate-800 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      {subjects.map(s => (
                        <option key={s.id || s.code} value={s.code}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Khối lớp:
                    </label>
                    <select
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="w-full text-xs font-medium text-slate-800 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map(g => (
                        <option key={g} value={g}>Khối {g}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Thời lượng thi (phút):
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={180}
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      className="w-full text-xs font-medium text-slate-800 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Thang điểm tối đa:
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={maxScore}
                      onChange={(e) => setMaxScore(Number(e.target.value))}
                      className="w-full text-xs font-medium text-slate-800 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Điểm chuẩn đạt:
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={passScore}
                      onChange={(e) => setPassScore(Number(e.target.value))}
                      className="w-full text-xs font-medium text-slate-800 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                  </div>
                </div>

                {/* Assigned Classes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Phân công lớp tham gia thi:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {classes.map(c => {
                      const isSelected = selectedClassIds.includes(c.name);
                      return (
                        <button
                          key={c.id || c.name}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedClassIds(selectedClassIds.filter(id => id !== c.name));
                            } else {
                              setSelectedClassIds([...selectedClassIds, c.name]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {c.name} ({c.grade})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Options */}
                <div className="space-y-2 pt-2 border-t border-slate-200 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={isPublished}
                      onChange={(e) => setIsPublished(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span>Kích hoạt kỳ thi ngay (Học sinh có thể thấy và tham gia)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={shuffleQuestions}
                      onChange={(e) => setShuffleQuestions(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="font-semibold text-indigo-900">🔀 Tự động trộn ngẫu nhiên thứ tự câu hỏi khi học sinh làm bài</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={shuffleOptions}
                      onChange={(e) => setShuffleOptions(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="font-semibold text-indigo-900">🔀 Tự động hoán vị thứ tự các phương án lựa chọn A, B, C, D</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={showAnswersAfterExam}
                      onChange={(e) => setShowAnswersAfterExam(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span>Cho phép học sinh xem đáp án và lời giải sau khi nộp bài</span>
                  </label>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 flex items-center justify-between text-xs text-emerald-900">
                <div>
                  <p className="font-bold">Tổng số câu hỏi: {parsedQuestions.length} câu</p>
                  <p className="text-emerald-700">
                    Thời lượng: {durationMinutes} phút | Lớp: {selectedClassIds.join(', ') || 'Chưa chọn'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-sm text-emerald-800">
                    Sẵn sàng lưu
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={() => {
              if (step === 'settings_save') setStep('preview_edit');
              else if (step === 'preview_edit') setStep('upload');
              else onClose();
            }}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            {step === 'upload' ? 'Hủy bỏ' : 'Quay lại'}
          </button>

          <div className="flex items-center gap-3">
            {step === 'upload' && (
              <button
                disabled={parsedQuestions.length === 0}
                onClick={() => setStep('preview_edit')}
                className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs disabled:opacity-40 cursor-pointer"
              >
                Tiếp tục xem trước
              </button>
            )}

            {step === 'preview_edit' && (
              <button
                onClick={() => setStep('settings_save')}
                className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                Cấu hình & Lưu
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {step === 'settings_save' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSaveExam(false)}
                  className="px-4 py-2.5 text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl shadow-2xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  title="Lưu bản nháp đề thi, học sinh chưa thể nhìn thấy"
                >
                  <Save className="w-4 h-4 text-slate-500" />
                  <span>{isSaving ? 'Đang lưu...' : 'Lưu bản nháp (Chưa mở)'}</span>
                </button>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleSaveExam(true)}
                  className="px-5 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  title="Lưu và xuất bản đề thi cho học sinh tham gia"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSaving ? 'Đang lưu...' : (isEditing ? 'Lưu & Cập nhật' : 'Lưu & Xuất bản ngay')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
