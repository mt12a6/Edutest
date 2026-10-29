import React, { useState, useEffect } from 'react';
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
  CheckSquare,
  AlertCircle
} from 'lucide-react';
import { parseExamFile } from '../../utils/docxParser';
import { normalizeMathFormulas } from '../../utils/mathFormatter';
import { ParsedDocxQuestion, SchoolClass, Subject, QuestionType, TrueFalseItem, Exam, Question } from '../../types';
import { downloadSampleJsonExam, downloadSampleLatexExam } from '../../utils/sampleExamTemplates';
import { 
  createExamWithQuestions, 
  updateExamWithQuestions, 
  logSystemAction,
  getDefaultSubjects,
  getDefaultClasses
} from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { MathRenderer } from '../common/MathRenderer';
import { RichTextEditorToolbar } from '../common/RichTextEditorToolbar';
import { createBackupGoogleForm } from '../../services/googleFormsService';
import { Key, Globe, ExternalLink, Share2, Copy } from 'lucide-react';

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
  const { user, profile, getGoogleAccessToken, requestGoogleScopes } = useAuth();
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

  // Fallbacks ensuring subjects and classes are never empty even if parent state is loading
  const effectiveSubjects: Subject[] = (subjects && subjects.length > 0) ? subjects : getDefaultSubjects();
  const effectiveClasses: SchoolClass[] = (classes && classes.length > 0) ? classes : getDefaultClasses();

  // Custom subject input state
  const [isCustomSubject, setIsCustomSubject] = useState<boolean>(() => {
    if (initialExam?.subjectId) {
      return !effectiveSubjects.some(
        s => s.code === initialExam.subjectId || s.id === initialExam.subjectId
      );
    }
    return false;
  });
  const [customSubjectName, setCustomSubjectName] = useState<string>(() => {
    if (initialExam && !effectiveSubjects.some(s => s.code === initialExam.subjectId || s.id === initialExam.subjectId)) {
      return initialExam.subjectName || initialExam.subjectId || '';
    }
    return '';
  });

  // Exam Configuration
  const [title, setTitle] = useState<string>(initialExam?.title || '');
  const [subjectId, setSubjectId] = useState<string>(() => {
    if (initialExam?.subjectId) return initialExam.subjectId;
    return effectiveSubjects[0]?.code || 'MATH';
  });
  const [grade, setGrade] = useState<string>(initialExam?.grade || '6');

  // Ensure subjectId is always valid
  useEffect(() => {
    if (!subjectId && effectiveSubjects.length > 0) {
      setSubjectId(effectiveSubjects[0]?.code || 'MATH');
    }
  }, [effectiveSubjects, subjectId]);
  const [durationMinutes, setDurationMinutes] = useState<number>(initialExam?.durationMinutes || 45);
  const [passScore, setPassScore] = useState<number>(initialExam?.passScore ?? 5);
  const [maxScore, setMaxScore] = useState<number>(initialExam?.maxScore ?? 10);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(initialExam?.classIds || []);
  const [isPublished, setIsPublished] = useState<boolean>(initialExam?.isPublished ?? true);
  const [isSecure, setIsSecure] = useState<boolean>(initialExam?.isSecure ?? false);
  const [isTrial, setIsTrial] = useState<boolean>(initialExam?.isTrial ?? true);
  const [trialCode, setTrialCode] = useState<string>(initialExam?.trialCode || '');
  const [enableTabWarning, setEnableTabWarning] = useState<boolean>(initialExam?.enableTabWarning ?? initialExam?.warnOnTabSwitch ?? false);
  const [allowRetake, setAllowRetake] = useState<boolean>(initialExam?.allowRetake ?? true);
  const [maxAttempts, setMaxAttempts] = useState<number>(initialExam?.maxAttempts ?? 0);
  const [showScoreAfterExam, setShowScoreAfterExam] = useState<boolean>(initialExam?.showScoreAfterExam ?? true);
  const [showAnswersAfterExam, setShowAnswersAfterExam] = useState<boolean>(initialExam?.showAnswersAfterExam ?? true);
  const [allowReview, setAllowReview] = useState<boolean>(initialExam?.allowReview ?? true);
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(initialExam?.shuffleQuestions ?? true);
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(initialExam?.shuffleOptions ?? true);
  const [isPinned, setIsPinned] = useState<boolean>(initialExam?.isPinned ?? false);

  // Exam Schedule (Asia/Ho_Chi_Minh ISO format or datetime-local)
  const [openTime, setOpenTime] = useState<string>(() => {
    if (!initialExam?.openTime) return '';
    try {
      const d = new Date(initialExam.openTime);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    } catch {
      return '';
    }
  });

  const [closeTime, setCloseTime] = useState<string>(() => {
    if (!initialExam?.closeTime) return '';
    try {
      const d = new Date(initialExam.closeTime);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    } catch {
      return '';
    }
  });

  // Secret Token & Exam Code
  const [secretToken, setSecretToken] = useState<string>(initialExam?.secretToken || '');
  const [examCode, setExamCode] = useState<string>(initialExam?.examCode || '');

  // Google Forms backup state
  const [autoCreateGoogleForm, setAutoCreateGoogleForm] = useState<boolean>(Boolean(initialExam?.googleFormId));
  const [googleFormId, setGoogleFormId] = useState<string>(initialExam?.googleFormId || '');
  const [googleFormUrl, setGoogleFormUrl] = useState<string>(initialExam?.googleFormUrl || '');
  const [googleFormSyncStatus, setGoogleFormSyncStatus] = useState<string | null>(null);

  const generateSecretToken = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let res = 'SEC-';
    for (let i = 0; i < 8; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setSecretToken(res);
  };


  // AI Review State
  const [isAiChecking, setIsAiChecking] = useState<boolean>(false);
  const [aiReviewResult, setAiReviewResult] = useState<{
    overallStatus: 'good' | 'has_warnings' | 'needs_revision';
    overallSummary: string;
    totalIssuesCount: number;
    reminders: Array<{
      questionNumber: number;
      severity: 'error' | 'warning' | 'info';
      issue: string;
      suggestion: string;
    }>;
  } | null>(null);
  const [showAiReviewModal, setShowAiReviewModal] = useState<boolean>(false);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Call backend AI to review exam and answer keys
  const handleAiCheckExam = async () => {
    setIsAiChecking(true);
    try {
      const res = await fetch('/api/check-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          grade,
          subject: subjectId,
          questions: parsedQuestions
        })
      });
      const json = await res.json();
      if (json.success && json.data) {
        setAiReviewResult(json.data);
        setShowAiReviewModal(true);
      }
    } catch (err) {
      console.error('Lỗi khi gọi AI check-exam:', err);
    } finally {
      setIsAiChecking(false);
    }
  };

  if (!isOpen) return null;

  // Handle local .docx, .pdf, or .json file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isDocx = lowerName.endsWith('.docx');
    const isPdf = lowerName.endsWith('.pdf');
    const isJson = lowerName.endsWith('.json');
    const isTex = lowerName.endsWith('.tex') || lowerName.endsWith('.latex');

    if (!isDocx && !isPdf && !isJson && !isTex) {
      setParseError('Vui lòng chọn tệp định dạng Word (.docx), PDF (.pdf), JSON (.json) hoặc LaTeX (.tex / .latex)');
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
        const found = effectiveSubjects.find(s => 
          s.name.toLowerCase().includes(result.detectedSubject!.toLowerCase()) || 
          s.code.toLowerCase().includes(result.detectedSubject!.toLowerCase())
        );
        if (found) {
          setSubjectId(found.code);
          setIsCustomSubject(false);
        }
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

  // Direct 1-click Math Exam Creator
  const handleCreateMathExamDirectly = () => {
    setTitle('Đề kiểm tra Môn Toán học - 45 phút');
    setSubjectId('MATH');
    setGrade('10');
    setDurationMinutes(45);
    setPassScore(5);
    setMaxScore(10);
    setSelectedClassIds([]);
    setIsTrial(true);
    setEnableTabWarning(false);
    setParsedQuestions([
      {
        questionNumber: 1,
        type: 'multiple_choice',
        prompt: 'Rút gọn phân thức đại số $P = \\frac{x^2 - 4}{x - 2}$ với điều kiện $x \\ne 2$:',
        options: {
          A: '$x + 2$',
          B: '$x - 2$',
          C: '$x + 4$',
          D: '$2x$'
        },
        correctOption: 'A',
        explanation: 'Ta có $x^2 - 4 = (x - 2)(x + 2)$. Chia cho $x - 2$ ta được $P = x + 2$.',
        points: 1,
        warnings: []
      },
      {
        questionNumber: 2,
        type: 'true_false',
        prompt: 'Cho tam giác vuông $ABC$ vuông tại $A$ có $AB = 6\\text{ cm}$ và $AC = 8\\text{ cm}$. Xét tính Đúng / Sai của các khẳng định sau:',
        subQuestions: [
          { key: 'a', text: 'Độ dài cạnh huyền $BC = 10\\text{ cm}$.', correct: true },
          { key: 'b', text: 'Diện tích tam giác $S = 48\\text{ cm}^2$.', correct: false },
          { key: 'c', text: 'Giá trị $\\sin B = 0.8$.', correct: true },
          { key: 'd', text: 'Bán kính đường tròn ngoại tiếp $R = 5\\text{ cm}$.', correct: true }
        ],
        explanation: 'BC = √(6² + 8²) = 10 cm; Diện tích S = 1/2 * 6 * 8 = 24 cm² (ý b sai); sin B = 8/10 = 0.8; R = 10/2 = 5 cm.',
        points: 1,
        warnings: []
      },
      {
        questionNumber: 3,
        type: 'fill_blank',
        prompt: 'Điền kết quả: Tìm nghiệm dương lớn nhất của phương trình bậc hai $x^2 - 5x + 6 = 0$. Đáp số:',
        acceptableAnswers: ['3', 'x=3', 'x = 3'],
        explanation: 'Phương trình $(x - 2)(x - 3) = 0$ có hai nghiệm $x = 2$ và $x = 3$. Nghiệm lớn nhất là 3.',
        points: 1,
        warnings: []
      },
      {
        questionNumber: 4,
        type: 'essay',
        prompt: 'Tự luận: Giải bất phương trình bậc hai $x^2 - 4x + 3 \\le 0$ và biểu diễn tập nghiệm trên trục số.',
        sampleAnswer: 'Tập nghiệm là đoạn [1; 3].',
        explanation: 'Tam thức $f(x) = x^2 - 4x + 3$ có hai nghiệm $x_1 = 1, x_2 = 3$. Vì $a = 1 > 0$ nên $f(x) \\le 0 \\Leftrightarrow 1 \\le x \\le 3$.',
        points: 2,
        warnings: []
      }
    ]);
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

  // Handle uploading option image (A, B, C, D)
  const handleOptionImageUpload = (qIndex: number, optKey: 'A' | 'B' | 'C' | 'D', e: React.ChangeEvent<HTMLInputElement>) => {
    const imgFile = e.target.files?.[0];
    if (!imgFile) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target?.result as string;
      const currentQ = parsedQuestions[qIndex];
      const optImgs = { ...(currentQ.optionImages || {}) };
      optImgs[optKey] = dataUrl;
      handleUpdateQuestion(qIndex, {
        ...currentQ,
        optionImages: optImgs
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

    // Auto-repair missing prompts and answers so teacher is never blocked from saving
    const sanitizedQuestions = parsedQuestions.map(q => {
      let prompt = q.prompt?.trim() || `Câu hỏi số ${q.questionNumber}`;
      let correctOption = q.correctOption;
      if (q.type === 'multiple_choice' && !correctOption) {
        correctOption = 'A';
      }
      let acceptableAnswers = q.acceptableAnswers;
      if (q.type === 'fill_blank' && (!acceptableAnswers || acceptableAnswers.length === 0)) {
        acceptableAnswers = ['1'];
      }
      return {
        ...q,
        prompt,
        correctOption,
        acceptableAnswers
      };
    });

    setIsSaving(true);
    try {
      let finalSubjectId = subjectId || 'MATH';
      let finalSubjectName = 'Toán học';

      if (isCustomSubject && customSubjectName.trim()) {
        finalSubjectName = customSubjectName.trim();
        finalSubjectId = customSubjectName.trim().toUpperCase().replace(/\s+/g, '_');
      } else {
        const selectedSubject = effectiveSubjects.find(
          s => s.code === subjectId || s.id === subjectId || s.name.toLowerCase() === subjectId.toLowerCase()
        );
        if (selectedSubject) {
          finalSubjectId = selectedSubject.code || selectedSubject.id;
          finalSubjectName = selectedSubject.name;
        } else {
          finalSubjectId = subjectId || 'MATH';
          finalSubjectName = subjectId || 'Toán học';
        }
      }

      const finalPublished = publishOverride !== undefined ? publishOverride : isPublished;

      const examData: any = {
        title: title.trim(),
        subjectId: finalSubjectId,
        subjectName: finalSubjectName,
        grade,
        durationMinutes: Number(durationMinutes),
        passScore: Number(passScore),
        maxScore: Number(maxScore),
        questionCount: parsedQuestions.length,
        classIds: selectedClassIds,
        startTime: initialExam?.startTime || new Date().toISOString(),
        endTime: initialExam?.endTime || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        openTime: openTime ? new Date(openTime).toISOString() : null,
        closeTime: closeTime ? new Date(closeTime).toISOString() : null,
        secretToken: secretToken.trim() || null,
        examCode: examCode.trim() || null,
        googleFormId: googleFormId || null,
        googleFormUrl: googleFormUrl || null,
        googleFormStatus: googleFormId ? 'created' : null,
        isPublished: finalPublished,
        isSecure,
        isTrial,
        enableTabWarning,
        warnOnTabSwitch: enableTabWarning,
        trialCode: trialCode.trim() || `EDUTEST-${grade}`,
        allowRetake,
        isPinned,

        maxAttempts: Number(maxAttempts) || 0,
        showScoreAfterExam,
        shuffleQuestions,
        shuffleOptions,
        showAnswersAfterExam,
        allowReview,
        createdBy: initialExam?.createdBy || user?.uid || 'teacher',
        createdByName: initialExam?.createdByName || profile?.displayName || user?.email || 'Giáo viên'
      };

      const questionsToSave = sanitizedQuestions.map(q => {
        const item: any = {
          questionNumber: q.questionNumber,
          type: q.type || 'multiple_choice',
          prompt: q.prompt,
          correctOption: q.correctOption,
          explanation: q.explanation || '',
          points: q.points || 1
        };
        if (q.imageUrl && q.imageUrl.trim()) {
          item.imageUrl = q.imageUrl.trim();
        }
        if (q.options) {
          item.options = q.options;
        }
        if (q.optionImages && Object.values(q.optionImages).some(img => !!img)) {
          item.optionImages = q.optionImages;
        }
        if (q.subQuestions) {
          item.subQuestions = q.subQuestions;
        }
        if (q.acceptableAnswers) {
          item.acceptableAnswers = q.acceptableAnswers;
        }
        if (q.sampleAnswer) {
          item.sampleAnswer = q.sampleAnswer;
        }
        return item;
      });

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

      // Automatically create or sync Google Forms backup if selected
      if (autoCreateGoogleForm && savedExamId) {
        try {
          setGoogleFormSyncStatus('Đang khởi tạo bản sao lưu đề thi trên Google Forms & Drive...');
          let token = await getGoogleAccessToken();
          if (!token) {
            token = await requestGoogleScopes([
              'https://www.googleapis.com/auth/forms.body',
              'https://www.googleapis.com/auth/drive.file'
            ]);
          }
          if (token) {
            const fullExamForForm: Exam = {
              ...examData,
              id: savedExamId,
              questions: questionsToSave
            };
            const formRes = await createBackupGoogleForm(fullExamForForm, questionsToSave, token);
            if (formRes.success && formRes.formId) {
              await updateExamWithQuestions(savedExamId, {
                googleFormId: formRes.formId,
                googleFormUrl: formRes.formUrl,
                googleFormStatus: 'created'
              }, questionsToSave);
              setGoogleFormId(formRes.formId);
              if (formRes.formUrl) setGoogleFormUrl(formRes.formUrl);
              setSaveSuccess(`Đã lưu đề thi và đồng bộ thành công Google Form dự phòng!`);
            }
          }
        } catch (gfErr: any) {
          console.warn('Lỗi đồng bộ Google Forms (không ảnh hưởng đề thi EduTest):', gfErr);
        }
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
                  accept=".docx,.pdf,.json,.tex,.latex"
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
                      Chọn tệp Word (.docx), PDF (.pdf), JSON (.json) hoặc LaTeX (.tex)
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                      Tự động trích xuất toàn bộ hình vẽ minh họa, cấu trúc 4 phần, bảng đáp án và chuẩn hóa công thức toán sang mã KaTeX LaTeX ($...$)
                    </p>
                  </div>
                  <span className="mt-2 inline-flex items-center px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs">
                    Tải tệp đề thi lên
                  </span>
                </label>

                {/* Sample Download Action Bar */}
                <div className="mt-5 pt-4 border-t border-slate-200/80 flex flex-wrap items-center justify-center gap-2 text-xs">
                  <span className="text-slate-400 font-semibold text-[11px]">Tải tệp mẫu chuẩn:</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      downloadSampleJsonExam();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:border-indigo-400 text-indigo-700 font-bold text-[11px] shadow-2xs hover:bg-indigo-50 transition-colors cursor-pointer"
                    title="Tải tệp JSON chuẩn 4 phần của hệ thống EduTest"
                  >
                    📄 Tệp mẫu JSON (.json)
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      downloadSampleLatexExam();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:border-emerald-400 text-emerald-700 font-bold text-[11px] shadow-2xs hover:bg-emerald-50 transition-colors cursor-pointer"
                    title="Tải tệp LaTeX (.tex) gói ex_test chuẩn câu hỏi & công thức toán"
                  >
                    📐 Tệp mẫu LaTeX (.tex)
                  </button>
                </div>
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

              {/* Direct Math Exam Creator & Sample Preload */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50/70 rounded-2xl p-4 border border-indigo-200 flex flex-col justify-between gap-3 shadow-xs">
                  <div>
                    <div className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                      <span className="p-1 rounded-lg bg-indigo-600 text-white text-[10px]">TOÁN</span>
                      <span>Soạn đề thi Toán học trực tiếp</span>
                    </div>
                    <p className="text-[11px] text-indigo-800/80 mt-1 leading-relaxed">
                      {"Tạo ngay đề thi Toán mới với 4 phần chuẩn: Trắc nghiệm, Đúng/Sai, Điền số, Tự luận kèm công thức $\\frac{a}{b}$, $\\sqrt{x}$ và hình học mà không cần tệp Word."}
                    </p>

                  </div>
                  <button
                    type="button"
                    onClick={handleCreateMathExamDirectly}
                    className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer text-center"
                  >
                    📐 Soạn đề thi Toán mới ngay
                  </button>
                </div>

                <div className="bg-slate-100/90 rounded-2xl p-4 border border-slate-200 flex flex-col justify-between gap-3">
                  <div>
                    <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      Nạp đề thi mẫu tổng hợp
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      Nạp bộ đề thi Toán 10 hoàn chỉnh có sẵn hình vẽ minh họa tam giác vuông và đồ thị hàm số bậc hai để kiểm tra tính năng.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLoadSample}
                    className="w-full py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer text-center"
                  >
                    ✨ Nạp bộ đề mẫu có sẵn
                  </button>
                </div>
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
                    onClick={handleAiCheckExam}
                    disabled={isAiChecking}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200 cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                    title="Nhờ AI rà soát toàn bộ đề thi, kiểm tra đáp án đúng và đưa ra nhắc nhở để chỉnh sửa"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>{isAiChecking ? 'AI đang rà soát...' : 'AI Rà soát đề & Đáp án'}</span>
                  </button>

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
                              <span>{activeFormulaTarget?.qIndex === index && activeFormulaTarget?.field === 'prompt' ? 'Đóng thanh soạn thảo' : '🎨 Soạn thảo: Đậm/Nghiêng/Tô màu/Toán'}</span>
                            </button>
                            <span className="text-[10px] text-slate-400 hidden sm:inline">
                              Hỗ trợ **đậm**, *nghiêng*, <u>gạch chân</u>, ==tô vàng==, $công thức$
                            </span>
                          </div>
                        </div>

                        {activeFormulaTarget?.qIndex === index && activeFormulaTarget?.field === 'prompt' && (
                          <div className="mb-2">
                            <RichTextEditorToolbar
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
                              onClick={() => {
                                const copy = { ...q };
                                delete copy.imageUrl;
                                handleUpdateQuestion(index, copy);
                              }}
                              className="text-[10px] text-rose-600 font-semibold hover:underline cursor-pointer"
                            >
                              ✕ Xóa ảnh này
                            </button>
                          )}
                        </div>

                        {q.imageUrl ? (
                          <div className="p-2 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <img 
                                src={q.imageUrl} 
                                alt="Minh họa" 
                                className="max-h-24 max-w-xs rounded-lg border object-contain bg-white" 
                              />
                              <span className="text-[11px] text-slate-500">Đã gắn hình ảnh minh họa cho câu hỏi</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const copy = { ...q };
                                delete copy.imageUrl;
                                handleUpdateQuestion(index, copy);
                              }}
                              className="px-2.5 py-1 text-xs bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg font-medium cursor-pointer"
                            >
                              Xóa ảnh
                            </button>
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
                            Các phương án lựa chọn (Click vào chữ cái để chọn đáp án đúng; hỗ trợ nhập LaTeX và đính kèm ảnh cho từng phương án):
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(['A', 'B', 'C', 'D'] as const).map((optKey) => {
                              const isCorrect = q.correctOption === optKey;
                              const currentOptions = q.options || { A: '', B: '', C: '', D: '' };
                              const currentOptImages = q.optionImages || {};
                              const hasOptImg = !!currentOptImages[optKey];
                              const optVal = currentOptions[optKey] || '';

                              return (
                                <div 
                                  key={optKey}
                                  className={`p-2.5 rounded-xl border transition-all space-y-2 ${
                                    isCorrect 
                                      ? 'bg-emerald-50/80 border-emerald-400 ring-1 ring-emerald-400' 
                                      : 'bg-slate-50/70 border-slate-200'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateQuestion(index, { ...q, correctOption: optKey })}
                                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer transition-all ${
                                        isCorrect 
                                          ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-300' 
                                          : 'bg-white text-slate-600 border border-slate-300 hover:border-emerald-500'
                                      }`}
                                      title={`Chọn ${optKey} làm đáp án đúng`}
                                    >
                                      {optKey}
                                    </button>
                                    <input
                                      type="text"
                                      value={optVal}
                                      onChange={(e) => handleUpdateQuestion(index, {
                                        ...q,
                                        options: { ...currentOptions, [optKey]: e.target.value }
                                      })}
                                      placeholder={`Nhập phương án ${optKey}... (hỗ trợ $công thức$)`}
                                      className="w-full text-xs text-slate-800 bg-transparent border-none focus:outline-hidden font-mono"
                                    />
                                    {/* Option image upload button */}
                                    <label 
                                      title={`Thêm hình ảnh cho phương án ${optKey}`}
                                      className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-white cursor-pointer transition-colors shrink-0"
                                    >
                                      <ImageIcon className="w-3.5 h-3.5" />
                                      <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleOptionImageUpload(index, optKey, e)}
                                        className="hidden"
                                      />
                                    </label>
                                  </div>

                                  {/* Live KaTeX Preview for Option if contains formula or text */}
                                  {optVal.trim() && (
                                    <div className="px-2 py-1 bg-white rounded-lg border border-slate-200/80 text-[11px] text-slate-700 flex items-center gap-1.5 overflow-x-auto">
                                      <span className="text-[9px] font-bold text-slate-400 shrink-0">Hiển thị:</span>
                                      <MathRenderer content={optVal} />
                                    </div>
                                  )}

                                  {/* Attached image preview for this option */}
                                  {hasOptImg && (
                                    <div className="p-1.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-2">
                                      <img 
                                        src={currentOptImages[optKey]} 
                                        alt={`Hình phương án ${optKey}`} 
                                        className="max-h-16 max-w-full rounded object-contain"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const nextOptImgs = { ...currentOptImages };
                                          delete nextOptImgs[optKey];
                                          handleUpdateQuestion(index, {
                                            ...q,
                                            optionImages: nextOptImgs
                                          });
                                        }}
                                        className="text-[10px] text-rose-600 hover:bg-rose-50 px-2 py-1 rounded cursor-pointer shrink-0 font-medium"
                                      >
                                        Gỡ ảnh
                                      </button>
                                    </div>
                                  )}
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
                                <div className="flex items-center gap-2 shrink-0">
                                  {/* Points per sub-question */}
                                  <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1" title="Điểm số cho riêng mệnh đề này">
                                    <span className="text-[10px] text-slate-400 font-semibold">Điểm:</span>
                                    <input
                                      type="number"
                                      step="0.05"
                                      min="0"
                                      max="10"
                                      value={sub.points ?? 0.25}
                                      onChange={(e) => {
                                        const nextSub = [...(q.subQuestions || [])];
                                        nextSub[sIdx] = { ...sub, points: parseFloat(e.target.value) || 0 };
                                        handleUpdateQuestion(index, { ...q, subQuestions: nextSub });
                                      }}
                                      className="w-12 text-xs font-bold text-indigo-700 bg-transparent border-none p-0 focus:outline-hidden"
                                    />
                                    <span className="text-[10px] text-slate-400">đ</span>
                                  </div>

                                  {/* Selection toggle buttons */}
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextSub = [...(q.subQuestions || [])];
                                        nextSub[sIdx] = { ...sub, correct: true };
                                        handleUpdateQuestion(index, { ...q, subQuestions: nextSub });
                                      }}
                                      className={`px-2.5 py-1 rounded-lg font-bold text-xs cursor-pointer transition-colors ${
                                        sub.correct ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
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
                                      className={`px-2.5 py-1 rounded-lg font-bold text-xs cursor-pointer transition-colors ${
                                        !sub.correct ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                      }`}
                                    >
                                      Sai
                                    </button>
                                  </div>

                                  {/* Explicit notification of the selected answer */}
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    sub.correct ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                                  }`}>
                                    {sub.correct ? '✓ ĐÚNG' : '✗ SAI'}
                                  </span>
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

                      {/* Explanation with Math Formula Insertion and Live KaTeX Preview */}
                      <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="flex items-center justify-between">
                          <label className="block text-[11px] font-bold text-slate-700">
                            📐 Lời giải chi tiết / Hướng dẫn giải (Hỗ trợ công thức LaTeX $...$):
                          </label>
                          <div className="flex items-center gap-1 flex-wrap">
                            {[
                              { label: 'x²', val: '$x^2$' },
                              { label: 'a/b', val: '$\\frac{a}{b}$' },
                              { label: '√x', val: '$\\sqrt{x}$' },
                              { label: 'Δ', val: '$\\Delta$' },
                              { label: 'π', val: '$\\pi$' },
                              { label: '≤', val: '$\\le$' },
                              { label: '≥', val: '$\\ge$' },
                              { label: '⇒', val: '$\\Rightarrow$' },
                            ].map((f) => (
                              <button
                                key={f.label}
                                type="button"
                                onClick={() => {
                                  const cur = q.explanation || '';
                                  handleUpdateQuestion(index, { ...q, explanation: cur ? `${cur} ${f.val}` : f.val });
                                }}
                                className="px-1.5 py-0.5 text-[10px] bg-white border border-slate-300 hover:border-emerald-500 hover:text-emerald-700 rounded font-mono font-bold transition-colors cursor-pointer"
                                title={`Chèn ${f.val}`}
                              >
                                {f.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <textarea
                          rows={2}
                          value={q.explanation || ''}
                          onChange={(e) => handleUpdateQuestion(index, { ...q, explanation: e.target.value })}
                          placeholder="Nhập lời giải hoặc kiến thức cần ghi nhớ (ví dụ: $x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}$)..."
                          className="w-full text-xs text-slate-800 bg-white border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 font-sans"
                        />

                        {q.explanation && q.explanation.trim() && (
                          <div className="p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-200 text-xs text-slate-800">
                            <span className="text-[10px] font-bold text-emerald-800 block mb-1 uppercase tracking-wider">
                              👁️ Xem trước công thức hiển thị (KaTeX Live):
                            </span>
                            <MathRenderer content={q.explanation} className="leading-relaxed" />
                          </div>
                        )}
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
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Môn học: *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomSubject(!isCustomSubject);
                          if (!isCustomSubject && !customSubjectName) {
                            setCustomSubjectName('');
                          }
                        }}
                        className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
                      >
                        {isCustomSubject ? 'Chọn từ danh mục' : '+ Tự nhập môn khác'}
                      </button>
                    </div>

                    {!isCustomSubject ? (
                      <div className="space-y-2">
                        <select
                          value={subjectId}
                          onChange={(e) => {
                            if (e.target.value === '__CUSTOM__') {
                              setIsCustomSubject(true);
                            } else {
                              setSubjectId(e.target.value);
                            }
                          }}
                          className="w-full text-xs font-semibold text-slate-800 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500 bg-white"
                        >
                          {effectiveSubjects.map(s => {
                            const val = s.code || s.id;
                            return (
                              <option key={s.id || s.code} value={val}>
                                {s.name} ({s.code || val})
                              </option>
                            );
                          })}
                          <option value="__CUSTOM__">✍️ Khác (Tự nhập tên môn học...)</option>
                        </select>

                        {/* Quick pick chips */}
                        <div className="flex flex-wrap gap-1">
                          {effectiveSubjects.slice(0, 6).map(s => {
                            const val = s.code || s.id;
                            const isSelected = subjectId === val;
                            return (
                              <button
                                key={val}
                                type="button"
                                onClick={() => {
                                  setSubjectId(val);
                                  setIsCustomSubject(false);
                                }}
                                className={`text-[10px] px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-emerald-700 text-white shadow-2xs'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                              >
                                {s.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5 animate-in fade-in">
                        <input
                          type="text"
                          value={customSubjectName}
                          onChange={(e) => setCustomSubjectName(e.target.value)}
                          placeholder="Nhập tên môn học (ví dụ: Tin học văn phòng, GDCD...)"
                          className="w-full text-xs font-semibold text-slate-900 border border-emerald-400 bg-emerald-50/30 rounded-xl p-2.5 focus:ring-2 focus:ring-emerald-500"
                          autoFocus
                        />
                        <p className="text-[10px] text-slate-500">
                          Đang bật chế độ tự nhập môn học mới cho đề thi này.
                        </p>
                      </div>
                    )}
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

                {/* SCHEDULE: OPEN TIME & CLOSE TIME */}
                <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      Lịch thi: Giờ Mở đề & Đóng đề (Múi giờ Asia/Ho_Chi_Minh)
                    </span>
                    <span className="text-[10px] text-indigo-700 font-medium">
                      Tự động khóa trước giờ mở & nộp bài khi hết giờ
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Thời gian mở đề (Bắt đầu thi):
                      </label>
                      <input
                        type="datetime-local"
                        value={openTime}
                        onChange={(e) => setOpenTime(e.target.value)}
                        className="w-full text-xs font-medium text-slate-800 bg-white border border-indigo-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        Để trống nếu muốn mở đề tự do bất cứ lúc nào
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Thời gian đóng đề (Hạn chót nộp bài):
                      </label>
                      <input
                        type="datetime-local"
                        value={closeTime}
                        onChange={(e) => setCloseTime(e.target.value)}
                        className="w-full text-xs font-medium text-slate-800 bg-white border border-indigo-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        Đến giờ đóng đề, hệ thống tự động thu bài của thí sinh
                      </span>
                    </div>
                  </div>
                </div>

                {/* SECRET ACCESS TOKEN & EXAM CODE */}
                <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-amber-600" />
                      Mã đề thi & Đường link bí mật của Giáo viên
                    </span>
                    <span className="text-[10px] text-amber-800 font-medium">
                      Bảo vệ chống lộ đề & chống đoán mò
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Mã đề thi (Học sinh nhập khi vào thi):
                      </label>
                      <input
                        type="text"
                        value={examCode}
                        onChange={(e) => setExamCode(e.target.value.toUpperCase())}
                        placeholder="Ví dụ: 101, 201, TOAN12-HK2..."
                        className="w-full text-xs font-mono font-bold text-slate-900 bg-white border border-amber-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500"
                      />
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        Nếu thiết lập, học sinh bắt buộc phải nhập đúng mã để vào làm bài
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Mã định danh đường link bí mật (Secret Token):
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={secretToken}
                          onChange={(e) => setSecretToken(e.target.value)}
                          placeholder="Ví dụ: SEC-K79H2A..."
                          className="w-full text-xs font-mono font-bold text-slate-900 bg-white border border-amber-300 rounded-lg p-2 focus:ring-2 focus:ring-amber-500"
                        />
                        <button
                          type="button"
                          onClick={generateSecretToken}
                          className="px-2.5 py-2 text-[10px] font-bold bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg shrink-0 transition-colors cursor-pointer"
                        >
                          Tạo mã ngẫu nhiên
                        </button>
                      </div>
                      {secretToken && (
                        <p className="text-[10px] font-mono text-amber-800 mt-1 truncate">
                          Link thí sinh: {window.location.origin}/?secretToken={secretToken}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* GOOGLE FORMS BACKUP INTEGRATION */}
                <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoCreateGoogleForm}
                        onChange={(e) => setAutoCreateGoogleForm(e.target.checked)}
                        className="w-4 h-4 mt-0.5 text-emerald-600 rounded focus:ring-emerald-500"
                      />
                      <div>
                        <span className="font-bold text-xs text-emerald-950 block">
                          📑 Tự động tạo Google Form dự phòng (Google Forms API v1 & Drive)
                        </span>
                        <span className="text-[11px] text-emerald-800">
                          Đồng bộ toàn bộ câu hỏi trắc nghiệm, thang điểm và bảng đáp án lên biểu mẫu Google Form trong Drive của bạn
                        </span>
                      </div>
                    </label>
                  </div>

                  {googleFormUrl && (
                    <div className="flex items-center gap-2 pt-1 border-t border-emerald-200/80 text-xs text-emerald-900">
                      <span className="font-semibold text-[11px]">Đã tạo Google Form:</span>
                      <a
                        href={googleFormUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline flex items-center gap-1"
                      >
                        Mở Google Form
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {googleFormSyncStatus && (
                    <p className="text-[11px] text-emerald-800 font-semibold animate-pulse">
                      {googleFormSyncStatus}
                    </p>
                  )}
                </div>


                {/* Assigned Classes */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Phân công lớp tham gia thi:
                    </label>
                    <button
                      type="button"
                      onClick={() => setSelectedClassIds([])}
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                        selectedClassIds.length === 0 
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' 
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {selectedClassIds.length === 0 ? '✓ Đang mở cho TẤT CẢ các lớp' : 'Mở cho tất cả các lớp'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedClassIds([])}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        selectedClassIds.length === 0 
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' 
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      🌐 Tất cả các lớp (Đề tự do)
                    </button>
                    {effectiveClasses.map(c => {
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
                <div className="space-y-3 pt-3 border-t border-slate-200 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={isPublished}
                        onChange={(e) => setIsPublished(e.target.checked)}
                        className="w-4 h-4 mt-0.5 text-emerald-600 rounded focus:ring-emerald-500"
                      />
                      <div>
                        <span className="font-bold text-slate-900 block">Kích hoạt kỳ thi ngay</span>
                        <span className="text-[11px] text-slate-500">Mở phòng cho học sinh tham gia</span>
                      </div>
                    </label>

                    {/* NEW: Tab violation warning toggle */}
                    <label className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-200 bg-amber-50/60 cursor-pointer hover:bg-amber-100/60 transition-colors">
                      <input
                        type="checkbox"
                        checked={enableTabWarning}
                        onChange={(e) => setEnableTabWarning(e.target.checked)}
                        className="w-4 h-4 mt-0.5 text-amber-600 rounded focus:ring-amber-500"
                      />
                      <div>
                        <span className="font-bold text-amber-950 block">⚠️ Cảnh báo chuyển tab màn hình</span>
                        <span className="text-[11px] text-amber-800">
                          {enableTabWarning 
                            ? 'BẬT: Phát hiện và cảnh báo khi thí sinh rời màn hình làm bài' 
                            : 'TẮT: Thí sinh làm bài tự do, không bị cảnh báo khi chuyển tab'}
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={isSecure}
                        onChange={(e) => setIsSecure(e.target.checked)}
                        className="w-4 h-4 mt-0.5 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold text-indigo-900 block">🔒 Đề thi bảo mật chính thức</span>
                        <span className="text-[11px] text-slate-500">Chỉ hiển thị khi người dùng đăng nhập tài khoản</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-200 bg-amber-50/70 cursor-pointer hover:bg-amber-100/60 transition-colors">
                      <input
                        type="checkbox"
                        checked={isPinned}
                        onChange={(e) => setIsPinned(e.target.checked)}
                        className="w-4 h-4 mt-0.5 text-amber-600 rounded focus:ring-amber-500"
                      />
                      <div>
                        <span className="font-bold text-amber-950 block">📌 Ghim đề thi lên đầu Trang chủ</span>
                        <span className="text-[11px] text-amber-800">Hiển thị nổi bật ở khu vực "Đề thi được ghim nổi bật" để học sinh thấy ngay</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={isTrial}
                        onChange={(e) => setIsTrial(e.target.checked)}
                        className="w-4 h-4 mt-0.5 text-emerald-600 rounded focus:ring-emerald-500"
                      />
                      <div>
                        <span className="font-bold text-slate-900 block">⭐ Cho phép thi thử tự do</span>
                        <span className="text-[11px] text-slate-500">Hiển thị ở trang chủ cho thi thử không cần đăng nhập</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={allowRetake}
                        onChange={(e) => setAllowRetake(e.target.checked)}
                        className="w-4 h-4 mt-0.5 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-bold text-slate-900 block">🔁 Cho phép thi lại nhiều lần</span>
                        <span className="text-[11px] text-slate-500">Học sinh có thể làm lại bài để ôn tập</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={showScoreAfterExam}
                        onChange={(e) => setShowScoreAfterExam(e.target.checked)}
                        className="w-4 h-4 mt-0.5 text-emerald-600 rounded focus:ring-emerald-500"
                      />
                      <div>
                        <span className="font-bold text-slate-900 block">📊 Xem điểm số ngay sau khi nộp</span>
                        <span className="text-[11px] text-slate-500">Nếu tắt, điểm số được bảo mật chờ giáo viên duyệt</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={showAnswersAfterExam}
                        onChange={(e) => setShowAnswersAfterExam(e.target.checked)}
                        className="w-4 h-4 mt-0.5 text-emerald-600 rounded focus:ring-emerald-500"
                      />
                      <div>
                        <span className="font-bold text-slate-900 block">📖 Xem đáp án và lời giải chi tiết</span>
                        <span className="text-[11px] text-slate-500">Hiển thị bảng giải thích sau khi nộp bài</span>
                      </div>
                    </label>
                  </div>


                  {/* Detail configs for Trial code & max attempts */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {isTrial && (
                      <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200">
                        <label className="block text-[11px] font-bold text-emerald-900 mb-1">
                          Mã đề thi thử tự do:
                        </label>
                        <input
                          type="text"
                          value={trialCode}
                          onChange={(e) => setTrialCode(e.target.value.toUpperCase())}
                          placeholder={`Ví dụ: TOAN${grade}-01, THITHU-01`}
                          className="w-full text-xs font-bold text-emerald-900 bg-white border border-emerald-300 rounded-lg p-2 focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    )}

                    {allowRetake && (
                      <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-200">
                        <label className="block text-[11px] font-bold text-indigo-900 mb-1">
                          Số lần làm bài tối đa (0 = Không giới hạn):
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={maxAttempts}
                          onChange={(e) => setMaxAttempts(Number(e.target.value))}
                          className="w-full text-xs font-bold text-indigo-900 bg-white border border-indigo-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={shuffleQuestions}
                        onChange={(e) => setShuffleQuestions(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                      />
                      <span className="font-semibold text-indigo-900">🔀 Tự động trộn câu hỏi trong từng phần (giữ nguyên thứ tự Phần 1, 2, 3)</span>
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
                  </div>
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
        {/* AI Exam Review & Reminder Modal */}
        {showAiReviewModal && aiReviewResult && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-4 max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">
                      Kết quả AI Rà soát & Thẩm định đề thi
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Trợ lý khảo thí AI tự động phát hiện lỗi và đề xuất nhắc nhở
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAiReviewModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Overview Status Banner */}
              <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                aiReviewResult.overallStatus === 'good'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : aiReviewResult.overallStatus === 'has_warnings'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                {aiReviewResult.overallStatus === 'good' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="text-xs space-y-1">
                  <p className="font-bold">
                    {aiReviewResult.overallSummary || 'Đề thi đã được rà soát chi tiết.'}
                  </p>
                  <p className="text-[11px] opacity-80">
                    Phát hiện: {aiReviewResult.reminders?.length || 0} điểm lưu ý / nhắc nhở chỉnh sửa.
                  </p>
                </div>
              </div>

              {/* Reminders List */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {aiReviewResult.reminders && aiReviewResult.reminders.length > 0 ? (
                  aiReviewResult.reminders.map((rem, rIdx) => {
                    const isErr = rem.severity === 'error';
                    const isWarn = rem.severity === 'warning';
                    return (
                      <div 
                        key={rIdx} 
                        className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                          isErr ? 'bg-rose-50/60 border-rose-200 text-rose-900' :
                          isWarn ? 'bg-amber-50/60 border-amber-200 text-amber-900' :
                          'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-white text-slate-900 border text-[10px] font-bold">
                              Câu {rem.questionNumber}
                            </span>
                            <span>{rem.issue}</span>
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            isErr ? 'bg-rose-200 text-rose-800' :
                            isWarn ? 'bg-amber-200 text-amber-800' :
                            'bg-slate-200 text-slate-700'
                          }`}>
                            {rem.severity}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 bg-white/70 p-2 rounded-lg border border-slate-200/50">
                          <strong>Gợi ý khắc phục:</strong> {rem.suggestion}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                    <p className="font-bold text-slate-700">Tất cả câu hỏi và đáp án đều chuẩn xác!</p>
                    <p className="text-[11px] text-slate-400 mt-1">Không phát hiện lỗi cú pháp, trùng lặp hay thiếu đáp án.</p>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAiReviewModal(false)}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                >
                  Đã hiểu & Tiếp tục chỉnh sửa
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
