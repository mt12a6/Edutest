import PptxGenJS from 'pptxgenjs';
import { Exam, Question } from '../types';
import { latexToUnicodeMath, stripCommentsAndHtml } from './mathConverter';

export type PptxPresentationMode = 
  | 'click_reveal'        // 1. Mặc định: Ban đầu chỉ hiện đề, nhấp chuột hiện đáp án xanh + tích ✓
  | 'questions_only'      // 2. Chỉ đề thi không có đáp án (bản học sinh / kiểm tra trên lớp)
  | 'answers_always'      // 3. Hiện sẵn đáp án (chữa bài trực tiếp)
  | 'with_explanations'   // 4. Kèm slide lời giải & hướng dẫn chấm chi tiết
  | 'answers_only';       // 5. Chỉ slide bảng ma trận đáp án

export interface PptxExportOptions {
  presentationMode?: PptxPresentationMode;
  aspectRatio?: '16:9' | '4:3';
  fontFamily?: string;
  theme?: 'light-clean' | 'slate-dark' | 'navy-blue';
  includeCoverSlide?: boolean;
  includeEndingSlide?: boolean;
  slideTransition?: 'morph' | 'fade' | 'none';
  schoolName?: string;
}

export interface ThemeConfig {
  bgColor: string;
  cardBg: string;
  cardBorder: string;
  titleColor: string;
  textColor: string;
  subtextColor: string;
  accentColor: string;
  headerBg: string;
  headerBorder: string;
  // Option button styles
  optNeutralBg: string;
  optNeutralBorder: string;
  optNeutralText: string;
  // Correct answer styles
  optCorrectBg: string;
  optCorrectBorder: string;
  optCorrectText: string;
  // Essay writing space box
  writingSpaceBg: string;
  writingSpaceBorder: string;
  writingSpaceText: string;
}

export const THEMES: Record<string, ThemeConfig> = {
  'light-clean': {
    bgColor: 'F8FAFC',
    cardBg: 'FFFFFF',
    cardBorder: 'E2E8F0',
    titleColor: '0F172A',
    textColor: '1E293B',
    subtextColor: '64748B',
    accentColor: '0D9488', // Teal-600
    headerBg: 'F1F5F9',
    headerBorder: 'CBD5E1',
    optNeutralBg: 'FFFFFF',
    optNeutralBorder: 'CBD5E1',
    optNeutralText: '1E293B',
    optCorrectBg: 'DCFCE7', // Emerald-100
    optCorrectBorder: '16A34A', // Emerald-600
    optCorrectText: '14532D', // Emerald-900
    writingSpaceBg: 'F8FAFC',
    writingSpaceBorder: 'CBD5E1',
    writingSpaceText: '64748B'
  },
  'navy-blue': {
    bgColor: '0F172A',
    cardBg: '1E293B',
    cardBorder: '334155',
    titleColor: 'F8FAFC',
    textColor: 'E2E8F0',
    subtextColor: '94A3B8',
    accentColor: '14B8A6',
    headerBg: '1E293B',
    headerBorder: '334155',
    optNeutralBg: '1E293B',
    optNeutralBorder: '475569',
    optNeutralText: 'E2E8F0',
    optCorrectBg: '064E3B',
    optCorrectBorder: '10B981',
    optCorrectText: 'A7F3D0',
    writingSpaceBg: '1E293B',
    writingSpaceBorder: '475569',
    writingSpaceText: '94A3B8'
  },
  'slate-dark': {
    bgColor: '090D16',
    cardBg: '131B2E',
    cardBorder: '1E293B',
    titleColor: 'F1F5F9',
    textColor: 'CBD5E1',
    subtextColor: '64748B',
    accentColor: '38BDF8',
    headerBg: '131B2E',
    headerBorder: '1E293B',
    optNeutralBg: '131B2E',
    optNeutralBorder: '334155',
    optNeutralText: 'E2E8F0',
    optCorrectBg: '064E3B',
    optCorrectBorder: '10B981',
    optCorrectText: '6EE7B7',
    writingSpaceBg: '131B2E',
    writingSpaceBorder: '334155',
    writingSpaceText: '64748B'
  }
};

/**
 * Diagnostic pre-flight report for export validation
 */
export interface PreflightDiagnosticReport {
  status: 'passed' | 'warnings' | 'errors';
  totalQuestions: number;
  totalSlidesEstimated: number;
  multiSlideQuestions: { questionNumber: number; reason: string }[];
  oneColQuestions: { questionNumber: number; reason: string }[];
  issues: {
    type: 'error' | 'warning' | 'info';
    questionNumber?: number;
    title: string;
    description: string;
    suggestion?: string;
  }[];
  stats: {
    multipleChoiceCount: number;
    trueFalseCount: number;
    fillBlankCount: number;
    essayCount: number;
    longPromptCount: number;
    imageCount: number;
    isStudentSafe: boolean; // Confirms answers are hidden in student mode
  };
}

/**
 * Runs automated pre-flight inspection before export
 */
export function runPreflightInspection(
  questions: Question[],
  exam: Exam,
  options: PptxExportOptions = {}
): PreflightDiagnosticReport {
  const issues: PreflightDiagnosticReport['issues'] = [];
  const multiSlideQuestions: { questionNumber: number; reason: string }[] = [];
  const oneColQuestions: { questionNumber: number; reason: string }[] = [];

  const mode = options.presentationMode || 'click_reveal';
  const isStudentMode = mode === 'questions_only';

  let mcCount = 0;
  let tfCount = 0;
  let fbCount = 0;
  let essayCount = 0;
  let longPromptCount = 0;
  let imageCount = 0;

  let slideCounter = (options.includeCoverSlide !== false && mode !== 'answers_only') ? 1 : 0;

  questions.forEach((q, idx) => {
    const qNum = q.questionNumber || (idx + 1);
    const cleanPrompt = latexToUnicodeMath(q.prompt || '');
    if (q.imageUrl) {
      imageCount++;
    }

    if (!cleanPrompt.trim()) {
      issues.push({
        type: 'error',
        questionNumber: qNum,
        title: `Câu ${qNum} thiếu nội dung`,
        description: 'Câu hỏi chưa có nội dung đề bài.',
        suggestion: 'Kiểm tra lại nội dung câu hỏi trong hệ thống.'
      });
    }

    // Check for LaTeX errors (unclosed brackets, bare TeX tags)
    if (q.prompt.includes('\\begin{') && !q.prompt.includes('\\end{')) {
      issues.push({
        type: 'warning',
        questionNumber: qNum,
        title: `Câu ${qNum}: Môi trường LaTeX chưa đóng`,
        description: 'Phát hiện \\begin{...} nhưng không có \\end{...} tương ứng.',
        suggestion: 'Hệ thống đã tự động bao bọc và xử lý chuyển đổi chữ.'
      });
    }

    // Question type categorization
    if (q.type === 'multiple_choice') {
      mcCount++;
      const optKeys: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
      const optTexts = optKeys.map(k => latexToUnicodeMath(q.options?.[k] || ''));

      // Check if any option is empty
      const emptyOpts = optKeys.filter(k => !(q.options?.[k] || '').trim());
      if (emptyOpts.length > 0) {
        issues.push({
          type: 'warning',
          questionNumber: qNum,
          title: `Câu ${qNum}: Thiếu phương án lựa chọn (${emptyOpts.join(', ')})`,
          description: `Phương án ${emptyOpts.join(', ')} hiện đang để trống.`,
          suggestion: 'Bổ sung nội dung phương án trước khi xuất file.'
        });
      }

      // Check option lengths to determine 1-col or 2-col
      const maxOptLen = Math.max(...optTexts.map(t => t.length));
      const hasMultilineOpt = optTexts.some(t => t.includes('\n') || t.length > 45);

      if (maxOptLen > 40 || hasMultilineOpt) {
        oneColQuestions.push({
          questionNumber: qNum,
          reason: `Phương án dài (${maxOptLen} ký tự), chuyển sang 1 cột để chống tràn chữ.`
        });
      }

      // Check prompt length for multi-slide split
      if (cleanPrompt.length > 320) {
        longPromptCount++;
        multiSlideQuestions.push({
          questionNumber: qNum,
          reason: `Đề bài dài (${cleanPrompt.length} ký tự). Tự động dàn trang 2 slide để đảm bảo thoáng chữ.`
        });
        slideCounter += (mode === 'click_reveal' ? 3 : 2);
      } else {
        slideCounter += (mode === 'click_reveal' ? 2 : 1);
      }

    } else if (q.type === 'true_false') {
      tfCount++;
      if (!q.subQuestions || q.subQuestions.length === 0) {
        issues.push({
          type: 'error',
          questionNumber: qNum,
          title: `Câu ${qNum}: Thiếu các ý a, b, c, d`,
          description: 'Câu hỏi Đúng / Sai cần có 4 ý lựa chọn.'
        });
      }
      slideCounter += (mode === 'click_reveal' ? 2 : 1);

    } else if (q.type === 'essay') {
      essayCount++;
      if (cleanPrompt.length > 250) {
        longPromptCount++;
      }
      // In student mode, essay takes 1 slide with writing space
      // In explanation mode, long answers may take continuation slide
      const sampleLen = (q.sampleAnswer || q.explanation || '').length;
      if (!isStudentMode && sampleLen > 300) {
        multiSlideQuestions.push({
          questionNumber: qNum,
          reason: `Hướng dẫn giải tự luận dài (${sampleLen} ký tự), tự động phân tách slide lời giải.`
        });
        slideCounter += 2;
      } else {
        slideCounter += (mode === 'click_reveal' ? 2 : 1);
      }

    } else {
      fbCount++;
      slideCounter += (mode === 'click_reveal' ? 2 : 1);
    }
  });

  if (mode === 'answers_only' || mode === 'with_explanations') {
    slideCounter += 1; // Answer matrix slide
  }
  if (options.includeEndingSlide !== false && mode !== 'answers_only') {
    slideCounter += 1; // Ending slide
  }

  const hasErrors = issues.some(i => i.type === 'error');
  const hasWarnings = issues.some(i => i.type === 'warning');

  return {
    status: hasErrors ? 'errors' : hasWarnings ? 'warnings' : 'passed',
    totalQuestions: questions.length,
    totalSlidesEstimated: slideCounter,
    multiSlideQuestions,
    oneColQuestions,
    issues,
    stats: {
      multipleChoiceCount: mcCount,
      trueFalseCount: tfCount,
      fillBlankCount: fbCount,
      essayCount,
      longPromptCount,
      imageCount,
      isStudentSafe: isStudentMode
    }
  };
}

/**
 * Intelligent helper to estimate text height and lines inside PowerPoint slide box
 */
function estimateTextMetrics(
  text: string, 
  boxWidthInches: number, 
  fontSizePt: number
): { lines: number; heightInches: number } {
  if (!text) return { lines: 1, heightInches: 0.4 };

  const paragraphs = text.split('\n');
  let totalLines = 0;
  // Estimated average characters per inch at given font size (with proportional font spacing)
  const charsPerInch = Math.floor((72 / fontSizePt) * 1.55);
  const charsPerLine = Math.max(10, Math.floor(boxWidthInches * charsPerInch));

  for (const para of paragraphs) {
    const len = para.trim().length;
    if (len === 0) {
      totalLines += 0.5;
    } else {
      totalLines += Math.max(1, Math.ceil(len / charsPerLine));
    }
  }

  const lineHeightInches = (fontSizePt * 1.30) / 72;
  const totalHeight = totalLines * lineHeightInches + 0.15;

  return { lines: totalLines, heightInches: totalHeight };
}

/**
 * Prepares an image for reliable PowerPoint embedding.
 * Converts SVG data URIs into high-resolution PNG data URLs via HTMLCanvas
 * so PowerPoint displays diagrams without rendering errors or missing assets.
 */
export async function prepareImageForPptx(imageUrl?: string): Promise<{ data?: string; path?: string } | null> {
  if (!imageUrl) return null;

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    if (imageUrl.startsWith('data:')) return { data: imageUrl };
    return { path: imageUrl };
  }

  // If SVG data URI or SVG file, rasterize to PNG using canvas
  if (imageUrl.startsWith('data:image/svg+xml') || imageUrl.endsWith('.svg')) {
    try {
      const pngData = await new Promise<string>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const scale = 2; // High-resolution scale
          const w = Math.max(400, (img.naturalWidth || img.width || 480)) * scale;
          const h = Math.max(260, (img.naturalHeight || img.height || 320)) * scale;
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(imageUrl);
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(imageUrl);
        img.src = imageUrl;
      });
      return { data: pngData };
    } catch {
      return { data: imageUrl };
    }
  }

  if (imageUrl.startsWith('data:')) {
    return { data: imageUrl };
  }

  return { path: imageUrl };
}

/**
 * Exports exam into a Microsoft PowerPoint (.pptx) presentation
 * Implements:
 * - Smart auto-pagination (multi-slide continuation for long questions)
 * - Anti-overflow bounding box & font size adaptation
 * - Automatic 1-column vs 2-column option layout
 * - Strict student-safe mode (never leaks answers in student version)
 * - Professional 16:9 layout with unified header & footer
 */
export async function exportExamToPptx(
  exam: Exam, 
  questions: Question[], 
  options: PptxExportOptions = {}
): Promise<void> {
  const pptx = new PptxGenJS();

  // Widescreen 16:9 standard (13.333333 x 7.5 inches)
  if (options.aspectRatio === '4:3') {
    pptx.defineLayout({ name: 'CUSTOM_4_3', width: 10.0, height: 7.5 });
    pptx.layout = 'CUSTOM_4_3';
  } else {
    // Official Widescreen 16:9: width = 13.333333 inches, height = 7.5 inches
    pptx.defineLayout({ name: 'CUSTOM_WIDESCREEN_16_9', width: 13.333333, height: 7.5 });
    pptx.layout = 'CUSTOM_WIDESCREEN_16_9';
  }

  const themeKey = options.theme || 'light-clean';
  const theme = THEMES[themeKey] || THEMES['light-clean'];
  // Enforce Segoe UI font across all slides and text runs
  const fontFace = options.fontFamily || 'Segoe UI';
  const mode = options.presentationMode || 'click_reveal';

  const slideW = options.aspectRatio === '4:3' ? 10.0 : 13.333333;
  const slideH = 7.5;
  const contentW = options.aspectRatio === '4:3' ? 8.40 : 11.733333; // Left 0.8, Right 0.8
  const maxBottomLimit = 6.80; // Absolute bottom boundary (footer is at 7.05)

  const schoolName = options.schoolName || 'TRƯỜNG THCS & THPT EDUTEST';
  const examTitle = exam.title || 'BÀI KIỂM TRA ĐÁNH GIÁ';
  const isStudentVersion = mode === 'questions_only';

  // Asynchronously prepare images upfront for 100% reliable rendering
  const imageMap: Record<string, { data?: string; path?: string } | null> = {};
  for (const q of questions) {
    if (q.imageUrl) {
      try {
        imageMap[q.id] = await prepareImageForPptx(q.imageUrl);
      } catch {
        imageMap[q.id] = null;
      }
    }
  }

  const applyTransition = (slide: PptxGenJS.Slide) => {
    if (options.slideTransition === 'fade' || options.slideTransition === 'morph') {
      (slide as any).transition = { type: 'fade', duration: 350 };
    }
  };

  // Helper to add unified slide header
  const addHeader = (slide: PptxGenJS.Slide, qNum: number, continuationTag?: string, isAnswerState?: boolean) => {
    // Top Left Question Number Pill
    const qBadgeText = continuationTag ? `CÂU ${qNum} (${continuationTag})` : `CÂU ${qNum}`;
    
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.8,
      y: 0.40,
      w: continuationTag ? 3.6 : 2.0,
      h: 0.44,
      fill: { color: theme.accentColor },
      line: { color: theme.accentColor, width: 1 }
    });

    slide.addText(qBadgeText, {
      x: 0.8,
      y: 0.42,
      w: continuationTag ? 3.6 : 2.0,
      h: 0.40,
      fontSize: 15,
      fontFace,
      color: 'FFFFFF',
      bold: true,
      align: 'center'
    });

    // Subject + Grade + Duration Pill
    const subheaderText = `${(exam.subjectName || 'Toán học').toUpperCase()}  •  Khối ${exam.grade || '6'}  •  ${exam.durationMinutes || 45} phút`;
    const subheaderX = 0.8 + (continuationTag ? 3.75 : 2.15);
    slide.addText(subheaderText, {
      x: subheaderX,
      y: 0.44,
      w: slideW - subheaderX - 3.6,
      h: 0.38,
      fontSize: 13,
      fontFace,
      color: theme.subtextColor,
      bold: true
    });

    // Top Right Status Badge
    if (isStudentVersion) {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: slideW - 3.4,
        y: 0.40,
        w: 2.6,
        h: 0.44,
        fill: { color: theme.headerBg },
        line: { color: theme.headerBorder, width: 1 }
      });
      slide.addText('ĐỀ THI HỌC SINH', {
        x: slideW - 3.4,
        y: 0.42,
        w: 2.6,
        h: 0.38,
        fontSize: 12,
        fontFace,
        bold: true,
        color: theme.subtextColor,
        align: 'center'
      });
    } else if (isAnswerState) {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: slideW - 3.5,
        y: 0.40,
        w: 2.7,
        h: 0.44,
        fill: { color: 'DCFCE7' },
        line: { color: '16A34A', width: 1.5 }
      });
      slide.addText('✓ ĐÁP ÁN & LỜI GIẢI', {
        x: slideW - 3.5,
        y: 0.42,
        w: 2.7,
        h: 0.38,
        fontSize: 12,
        fontFace,
        bold: true,
        color: '15803D',
        align: 'center'
      });
    }
  };

  // Helper to add unified slide footer
  const addFooter = (slide: PptxGenJS.Slide, pageIndicator?: string) => {
    slide.addText(`${schoolName}  —  Hệ thống khảo thí EduTest PRO`, {
      x: 0.8,
      y: 7.05,
      w: slideW - 3.5,
      h: 0.35,
      fontSize: 10,
      fontFace,
      color: theme.subtextColor,
      italic: true
    });

    if (pageIndicator) {
      slide.addText(pageIndicator, {
        x: slideW - 2.5,
        y: 7.05,
        w: 1.7,
        h: 0.35,
        fontSize: 10,
        fontFace,
        color: theme.subtextColor,
        align: 'right'
      });
    }
  };

  // ==================== 1. COVER SLIDE ====================
  if (options.includeCoverSlide !== false && mode !== 'answers_only') {
    const coverSlide = pptx.addSlide();
    coverSlide.background = { color: theme.bgColor };
    applyTransition(coverSlide);

    // Decorative Institution Banner
    coverSlide.addShape(pptx.ShapeType.roundRect, {
      x: 0.8,
      y: 0.8,
      w: 5.5,
      h: 0.45,
      fill: { color: themeKey === 'light-clean' ? 'CCFBF1' : '134E4A' },
      line: { color: theme.accentColor, width: 1 }
    });

    coverSlide.addText(`${schoolName.toUpperCase()}`, {
      x: 0.95,
      y: 0.82,
      w: 5.2,
      h: 0.4,
      fontSize: 12,
      fontFace,
      color: theme.accentColor,
      bold: true
    });

    // Main Exam Title
    const cleanTitle = latexToUnicodeMath(examTitle);
    coverSlide.addText(cleanTitle, {
      x: 0.8,
      y: 1.6,
      w: contentW,
      h: 2.2,
      fontSize: 32,
      fontFace,
      color: theme.titleColor,
      bold: true,
      wrap: true
    });

    // Metadata Tag Box
    coverSlide.addText(
      `Môn: ${(exam.subjectName || 'Toán học').toUpperCase()}   •   Khối: ${exam.grade || '6'}   •   Thời gian: ${exam.durationMinutes || 45} phút   •   Số lượng: ${questions.length} câu`,
      {
        x: 0.8,
        y: 4.2,
        w: contentW,
        h: 0.6,
        fontSize: 16,
        fontFace,
        color: theme.subtextColor,
        bold: true
      }
    );

    // Mode-specific Notice Card
    const modeDesc = isStudentVersion
      ? '📋 Bản đề thi chính thức dành cho học sinh (Toàn bộ đáp án và lời giải đã được bảo mật 100%).'
      : mode === 'click_reveal'
      ? '💡 Chế độ trình chiếu: Ban đầu xuất hiện đề bài và lựa chọn. Nhấp chuột để công bố đáp án đúng.'
      : '📖 Chế độ chữa bài: Hiển thị đầy đủ phương án đúng và thang điểm hướng dẫn chấm.';

    coverSlide.addShape(pptx.ShapeType.roundRect, {
      x: 0.8,
      y: 5.2,
      w: contentW,
      h: 0.85,
      fill: { color: theme.cardBg },
      line: { color: theme.cardBorder, width: 1 }
    });

    coverSlide.addText(modeDesc, {
      x: 1.1,
      y: 5.35,
      w: contentW - 0.6,
      h: 0.6,
      fontSize: 13,
      fontFace,
      color: theme.textColor,
      italic: true
    });

    addFooter(coverSlide);
  }

  // ==================== 2. QUESTION SLIDES ====================
  if (mode !== 'answers_only') {
    questions.forEach((q, idx) => {
      const qNum = q.questionNumber || (idx + 1);
      const cleanPrompt = latexToUnicodeMath(q.prompt || '');
      const hasImage = Boolean(imageMap[q.id]);
      const preparedImg = imageMap[q.id];

      // Layout width: 2 columns if image exists, otherwise full content width
      const leftColW = hasImage ? 6.60 : contentW;
      const promptMetrics = estimateTextMetrics(cleanPrompt, leftColW - 0.5, 16);

      // Determine options layout for Multiple Choice
      let isOneColMc = false;
      let optTexts: Record<'A' | 'B' | 'C' | 'D', string> = { A: '', B: '', C: '', D: '' };
      if (q.type === 'multiple_choice' && q.options) {
        const keys: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
        keys.forEach(k => {
          optTexts[k] = latexToUnicodeMath(q.options?.[k] || '');
        });
        const maxOptLen = Math.max(...keys.map(k => optTexts[k].length));
        isOneColMc = hasImage || maxOptLen > 95;
      }

      // Check if multi-slide is needed (only when no image and prompt is very long)
      const requiresMultiSlide = !hasImage && (
        (cleanPrompt.length > 250 && isOneColMc) ||
        cleanPrompt.length > 320 ||
        (q.type === 'essay' && cleanPrompt.length > 280)
      );

      // Render Question State
      const renderQuestionState = (revealAnswer: boolean) => {
        if (requiresMultiSlide) {
          // MULTI-SLIDE: SLIDE A (Prompt)
          const slideA = pptx.addSlide();
          slideA.background = { color: theme.bgColor };
          applyTransition(slideA);
          addHeader(slideA, qNum, 'Phần đề bài', false);

          const promptH = 5.60;
          slideA.addShape(pptx.ShapeType.roundRect, {
            x: 0.8,
            y: 1.00,
            w: contentW,
            h: promptH,
            fill: { color: theme.cardBg },
            line: { color: theme.cardBorder, width: 1.5 }
          });

          slideA.addText(cleanPrompt, {
            x: 1.1,
            y: 1.25,
            w: contentW - 0.6,
            h: promptH - 1.0,
            fontSize: 18,
            fontFace,
            color: theme.titleColor,
            bold: true,
            wrap: true,
            lineSpacingMultiple: 1.25
          });

          slideA.addText('➔ Xem các phương án lựa chọn và làm bài ở slide tiếp theo', {
            x: 1.1,
            y: 1.00 + promptH - 0.65,
            w: contentW - 0.6,
            h: 0.45,
            fontSize: 13,
            fontFace,
            color: theme.accentColor,
            italic: true,
            bold: true,
            align: 'right'
          });

          addFooter(slideA);

          // MULTI-SLIDE: SLIDE B (Continuation / Options / Answers)
          const slideB = pptx.addSlide();
          slideB.background = { color: theme.bgColor };
          applyTransition(slideB);
          addHeader(slideB, qNum, 'tiếp theo', revealAnswer && !isStudentVersion);

          slideB.addShape(pptx.ShapeType.roundRect, {
            x: 0.8,
            y: 1.00,
            w: contentW,
            h: 0.85,
            fill: { color: theme.headerBg },
            line: { color: theme.headerBorder, width: 1 }
          });

          const recapText = cleanPrompt.length > 150 ? `${cleanPrompt.slice(0, 147)}...` : cleanPrompt;
          slideB.addText(`Đề bài: ${recapText}`, {
            x: 1.0,
            y: 1.12,
            w: contentW - 0.4,
            h: 0.65,
            fontSize: 13,
            fontFace,
            color: theme.subtextColor,
            italic: true
          });

          const optionsY = 2.05;
          renderOptionsArea(slideB, q, optionsY, contentW, 0.8, revealAnswer && !isStudentVersion, isOneColMc, optTexts);
          addFooter(slideB);

        } else {
          // SINGLE SLIDE (With or Without Image)
          const slide = pptx.addSlide();
          slide.background = { color: theme.bgColor };
          applyTransition(slide);
          addHeader(slide, qNum, undefined, revealAnswer && !isStudentVersion);

          if (hasImage && preparedImg) {
            // ================= 2-COLUMN LAYOUT WITH IMAGE =================
            // Right Column: Image Card Container
            const imgCardX = 7.65;
            const imgCardW = 4.88;
            const imgCardH = 5.75;
            slide.addShape(pptx.ShapeType.roundRect, {
              x: imgCardX,
              y: 1.00,
              w: imgCardW,
              h: imgCardH,
              fill: { color: theme.cardBg },
              line: { color: theme.cardBorder, width: 1.5 }
            });

            // Embedded Image fitting snugly inside container
            try {
              slide.addImage({
                data: preparedImg.data,
                path: preparedImg.path,
                x: imgCardX + 0.15,
                y: 1.15,
                w: imgCardW - 0.30,
                h: imgCardH - 0.30,
                sizing: { type: 'contain', w: imgCardW - 0.30, h: imgCardH - 0.30 }
              });
            } catch (imgErr) {
              console.warn('PPTX addImage note:', imgErr);
            }

            // Left Column: Question Prompt (Font clearly readable from afar)
            const promptFontSize = cleanPrompt.length > 180 ? 15 : cleanPrompt.length > 100 ? 17 : 18;
            const promptH = Math.min(2.15, Math.max(1.20, promptMetrics.heightInches + 0.20));

            slide.addShape(pptx.ShapeType.roundRect, {
              x: 0.8,
              y: 1.00,
              w: leftColW,
              h: promptH,
              fill: { color: theme.cardBg },
              line: { color: theme.cardBorder, width: 1.5 }
            });

            slide.addText(cleanPrompt, {
              x: 0.95,
              y: 1.10,
              w: leftColW - 0.30,
              h: promptH - 0.20,
              fontSize: promptFontSize,
              fontFace,
              color: theme.titleColor,
              bold: true,
              wrap: true,
              lineSpacingMultiple: 1.20
            });

            // Left Column: Options / Answers below prompt
            const optionsY = 1.00 + promptH + 0.15;
            renderOptionsArea(slide, q, optionsY, leftColW, 0.8, revealAnswer && !isStudentVersion, true, optTexts);

          } else {
            // ================= FULL WIDTH LAYOUT (NO IMAGE) =================
            // Check if this is an Essay question with answer reveal
            if (q.type === 'essay' && revealAnswer && !isStudentVersion) {
              // DEDICATED FULL-SPACE ESSAY SOLUTION SLIDE
              addHeader(slide, qNum, 'Lời giải & Hướng dẫn chấm', true);

              // 1. Top Prompt Recap Strip
              slide.addShape(pptx.ShapeType.roundRect, {
                x: 0.8,
                y: 1.00,
                w: contentW,
                h: 0.85,
                fill: { color: theme.headerBg },
                line: { color: theme.headerBorder, width: 1 }
              });

              const recap = cleanPrompt.length > 140 ? `${cleanPrompt.slice(0, 137)}...` : cleanPrompt;
              slide.addText(`Đề bài: ${recap}`, {
                x: 1.05,
                y: 1.12,
                w: contentW - 0.5,
                h: 0.60,
                fontSize: 14,
                fontFace,
                color: theme.subtextColor,
                italic: true,
                wrap: true
              });

              // 2. Full Solution & Rubric Workspace Card (Generous 4.75 inch height!)
              const solH = 4.80;
              slide.addShape(pptx.ShapeType.roundRect, {
                x: 0.8,
                y: 1.95,
                w: contentW,
                h: solH,
                fill: { color: theme.cardBg },
                line: { color: '16A34A', width: 2 }
              });

              slide.addText('✓ HƯỚNG DẪN GIẢI CHI TIẾT & BIỂU ĐIỂM BAREM:', {
                x: 1.1,
                y: 2.12,
                w: contentW - 0.6,
                h: 0.40,
                fontSize: 16,
                fontFace,
                bold: true,
                color: '15803D'
              });

              const rawAnswer = q.sampleAnswer || q.explanation || 'Giáo viên chấm điểm theo các bước lập luận đúng và kết quả chính xác.';
              const cleanAnswer = latexToUnicodeMath(rawAnswer);
              const ansFontSize = cleanAnswer.length > 350 ? 14 : cleanAnswer.length > 180 ? 15 : 16;

              slide.addText(cleanAnswer, {
                x: 1.1,
                y: 2.60,
                w: contentW - 0.6,
                h: q.rubric ? solH - 1.25 : solH - 0.85,
                fontSize: ansFontSize,
                fontFace,
                color: theme.textColor,
                wrap: true,
                lineSpacingMultiple: 1.30
              });

              if (q.rubric) {
                slide.addText(`Thang điểm barem: ${latexToUnicodeMath(q.rubric)}`, {
                  x: 1.1,
                  y: 1.95 + solH - 0.55,
                  w: contentW - 0.6,
                  h: 0.40,
                  fontSize: 13,
                  fontFace,
                  bold: true,
                  color: '166534',
                  italic: true
                });
              }

              addFooter(slide);
              return;
            }

            // Standard Question Prompt (Clear, bold, easy to read from afar)
            const promptFontSize = cleanPrompt.length > 200 ? 17 : cleanPrompt.length > 100 ? 19 : 21;
            const promptH = Math.min(2.20, Math.max(1.20, promptMetrics.heightInches + 0.25));

            slide.addShape(pptx.ShapeType.roundRect, {
              x: 0.8,
              y: 1.00,
              w: contentW,
              h: promptH,
              fill: { color: theme.cardBg },
              line: { color: theme.cardBorder, width: 1.5 }
            });

            slide.addText(cleanPrompt, {
              x: 1.1,
              y: 1.15,
              w: contentW - 0.6,
              h: promptH - 0.30,
              fontSize: promptFontSize,
              fontFace,
              color: theme.titleColor,
              bold: true,
              wrap: true,
              lineSpacingMultiple: 1.25
            });

            const optionsY = 1.00 + promptH + 0.18;
            renderOptionsArea(slide, q, optionsY, contentW, 0.8, revealAnswer && !isStudentVersion, isOneColMc, optTexts);
          }

          addFooter(slide);
        }
      };

      // Helper to render the options/answers area with guaranteed boundary compliance & classroom visibility
      const renderOptionsArea = (
        slide: PptxGenJS.Slide,
        currQ: Question,
        startY: number,
        areaWidth: number,
        startX: number,
        reveal: boolean,
        is1Col: boolean,
        optStrings: Record<'A' | 'B' | 'C' | 'D', string>
      ) => {
        const availableH = Math.max(1.8, maxBottomLimit - startY);

        if (currQ.type === 'multiple_choice') {
          const keys: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];

          if (is1Col) {
            // 1-column x 4-row layout: strictly fit in availableH with large, readable text
            const gap = 0.09;
            const rowH = Math.min(0.95, Math.max(0.68, (availableH - 3 * gap) / 4));
            const optFontSize = rowH < 0.75 ? 14 : 16;

            keys.forEach((key, kIdx) => {
              const yPos = startY + kIdx * (rowH + gap);
              const optContent = optStrings[key];
              const isCorrect = currQ.correctOption === key;
              const isHighlighted = reveal && isCorrect;

              slide.addShape(pptx.ShapeType.roundRect, {
                x: startX,
                y: yPos,
                w: areaWidth,
                h: rowH,
                fill: { color: isHighlighted ? theme.optCorrectBg : theme.optNeutralBg },
                line: {
                  color: isHighlighted ? theme.optCorrectBorder : theme.optNeutralBorder,
                  width: isHighlighted ? 2.5 : 1
                }
              });

              // Letter pill
              const pillSize = Math.min(0.52, rowH - 0.16);
              slide.addShape(pptx.ShapeType.roundRect, {
                x: startX + 0.18,
                y: yPos + (rowH - pillSize) / 2,
                w: pillSize,
                h: pillSize,
                fill: { color: isHighlighted ? '16A34A' : themeKey === 'light-clean' ? 'F1F5F9' : '334155' },
                line: { color: isHighlighted ? '15803D' : theme.cardBorder, width: 1 }
              });

              slide.addText(key, {
                x: startX + 0.18,
                y: yPos + (rowH - pillSize) / 2 + 0.02,
                w: pillSize,
                h: pillSize - 0.04,
                fontSize: 16,
                fontFace,
                bold: true,
                color: isHighlighted ? 'FFFFFF' : theme.titleColor,
                align: 'center'
              });

              // Option Text (15-16pt font clearly visible from afar)
              slide.addText(optContent, {
                x: startX + pillSize + 0.35,
                y: yPos + 0.06,
                w: areaWidth - pillSize - 0.95,
                h: rowH - 0.12,
                fontSize: optFontSize,
                fontFace,
                bold: isHighlighted,
                color: isHighlighted ? theme.optCorrectText : theme.textColor,
                wrap: true
              });

              if (isHighlighted) {
                slide.addText('✓', {
                  x: startX + areaWidth - 0.60,
                  y: yPos + (rowH - 0.50) / 2,
                  w: 0.50,
                  h: 0.50,
                  fontSize: 20,
                  fontFace,
                  bold: true,
                  color: '16A34A',
                  align: 'center'
                });
              }
            });

          } else {
            // 2-column x 2-row layout: Balanced Symmetric Grid as strictly specified:
            // Column left (A, C): left = 0.85" (or startX)
            // Column right (B, D): left = 6.85"
            // Width of each option box: 5.65" (ensures clean separation and zero text overlap)
            const isFullWidth = areaWidth > 10;
            const leftColX = isFullWidth ? 0.85 : startX;
            const rightColX = isFullWidth ? 6.85 : (startX + (areaWidth - 0.32) / 2 + 0.32);
            const colW = isFullWidth ? 5.65 : (areaWidth - 0.32) / 2;
            const gapY = 0.16;
            const cardH = Math.min(1.20, Math.max(0.85, (availableH - gapY) / 2));
            const optFontSize = cardH < 0.95 ? 15 : 16;

            const positions = [
              { key: 'A' as const, x: leftColX, y: startY },
              { key: 'B' as const, x: rightColX, y: startY },
              { key: 'C' as const, x: leftColX, y: startY + cardH + gapY },
              { key: 'D' as const, x: rightColX, y: startY + cardH + gapY }
            ];

            positions.forEach(pos => {
              const optContent = optStrings[pos.key];
              const isCorrect = currQ.correctOption === pos.key;
              const isHighlighted = reveal && isCorrect;

              slide.addShape(pptx.ShapeType.roundRect, {
                x: pos.x,
                y: pos.y,
                w: colW,
                h: cardH,
                fill: { color: isHighlighted ? theme.optCorrectBg : theme.optNeutralBg },
                line: {
                  color: isHighlighted ? theme.optCorrectBorder : theme.optNeutralBorder,
                  width: isHighlighted ? 2.5 : 1
                }
              });

              // Letter pill
              const pillSize = Math.min(0.52, cardH - 0.20);
              slide.addShape(pptx.ShapeType.roundRect, {
                x: pos.x + 0.18,
                y: pos.y + (cardH - pillSize) / 2,
                w: pillSize,
                h: pillSize,
                fill: { color: isHighlighted ? '16A34A' : themeKey === 'light-clean' ? 'F1F5F9' : '334155' },
                line: { color: isHighlighted ? '15803D' : theme.cardBorder, width: 1 }
              });

              slide.addText(pos.key, {
                x: pos.x + 0.18,
                y: pos.y + (cardH - pillSize) / 2 + 0.02,
                w: pillSize,
                h: pillSize - 0.04,
                fontSize: 16,
                fontFace,
                bold: true,
                color: isHighlighted ? 'FFFFFF' : theme.titleColor,
                align: 'center'
              });

              slide.addText(optContent, {
                x: pos.x + pillSize + 0.32,
                y: pos.y + 0.08,
                w: colW - pillSize - 0.90,
                h: cardH - 0.16,
                fontSize: optFontSize,
                fontFace,
                bold: isHighlighted,
                color: isHighlighted ? theme.optCorrectText : theme.textColor,
                wrap: true
              });

              if (isHighlighted) {
                slide.addText('✓', {
                  x: pos.x + colW - 0.55,
                  y: pos.y + (cardH - 0.50) / 2,
                  w: 0.50,
                  h: 0.50,
                  fontSize: 20,
                  fontFace,
                  bold: true,
                  color: '16A34A',
                  align: 'center'
                });
              }
            });
          }

        } else if (currQ.type === 'true_false' && currQ.subQuestions) {
          // 4 True/False subquestions
          const gap = 0.09;
          const subH = Math.min(0.85, Math.max(0.65, (availableH - 3 * gap) / 4));
          const tfFontSize = subH < 0.70 ? 14 : 16;

          currQ.subQuestions.forEach((sub, sIdx) => {
            const yPos = startY + sIdx * (subH + gap);
            const isCorrect = sub.correct;

            slide.addShape(pptx.ShapeType.roundRect, {
              x: startX,
              y: yPos,
              w: areaWidth,
              h: subH,
              fill: { color: theme.cardBg },
              line: { color: theme.cardBorder, width: 1 }
            });

            slide.addText(`${sub.key})`, {
              x: startX + 0.18,
              y: yPos + 0.08,
              w: 0.50,
              h: subH - 0.16,
              fontSize: 15,
              fontFace,
              bold: true,
              color: theme.accentColor
            });

            slide.addText(latexToUnicodeMath(sub.text), {
              x: startX + 0.72,
              y: yPos + 0.06,
              w: areaWidth - 2.4,
              h: subH - 0.12,
              fontSize: tfFontSize,
              fontFace,
              color: theme.textColor,
              wrap: true
            });

            if (reveal) {
              slide.addShape(pptx.ShapeType.roundRect, {
                x: startX + areaWidth - 1.50,
                y: yPos + (subH - 0.44) / 2,
                w: 1.35,
                h: 0.44,
                fill: { color: isCorrect ? 'DCFCE7' : 'FEE2E2' },
                line: { color: isCorrect ? '16A34A' : 'EF4444', width: 1 }
              });

              slide.addText(isCorrect ? 'ĐÚNG' : 'SAI', {
                x: startX + areaWidth - 1.50,
                y: yPos + (subH - 0.44) / 2 + 0.02,
                w: 1.35,
                h: 0.40,
                fontSize: 13,
                fontFace,
                bold: true,
                color: isCorrect ? '15803D' : '991B1B',
                align: 'center'
              });
            }
          });

        } else {
          // ESSAY OR FILL-IN-THE-BLANK (Writing space or Explanation)
          const boxH = availableH;

          if (isStudentVersion || !reveal) {
            slide.addShape(pptx.ShapeType.roundRect, {
              x: startX,
              y: startY,
              w: areaWidth,
              h: boxH,
              fill: { color: theme.writingSpaceBg },
              line: { color: theme.writingSpaceBorder, width: 1.5, dashType: 'dash' }
            });

            slide.addText('KHÔNG GIAN LÀM BÀI TỰ LUẬN CỦA HỌC SINH', {
              x: startX + 0.25,
              y: startY + 0.18,
              w: areaWidth - 0.50,
              h: 0.38,
              fontSize: 14,
              fontFace,
              bold: true,
              color: theme.writingSpaceText
            });

            slide.addText(
              'Học sinh trình bày chi tiết các bước biến đổi, lập luận và kết luận vào giấy thi hoặc bảng.',
              {
                x: startX + 0.25,
                y: startY + boxH / 2 - 0.25,
                w: areaWidth - 0.50,
                h: 0.50,
                fontSize: 14,
                fontFace,
                color: theme.subtextColor,
                italic: true,
                align: 'center'
              }
            );

          } else {
            slide.addShape(pptx.ShapeType.roundRect, {
              x: startX,
              y: startY,
              w: areaWidth,
              h: boxH,
              fill: { color: theme.cardBg },
              line: { color: '16A34A', width: 1.5 }
            });

            slide.addText('HƯỚNG DẪN CHẤM & BIỂU ĐIỂM BAREM:', {
              x: startX + 0.25,
              y: startY + 0.18,
              w: areaWidth - 0.50,
              h: 0.38,
              fontSize: 15,
              fontFace,
              bold: true,
              color: '15803D'
            });

            const answerContent = currQ.sampleAnswer || currQ.explanation || 
              (currQ.acceptableAnswers?.length ? `Đáp án chấp nhận: ${currQ.acceptableAnswers.join(' hoặc ')}` : 'Giáo viên chấm điểm theo barem hướng dẫn.');
            const cleanAnswer = latexToUnicodeMath(answerContent);
            const ansFontSize = cleanAnswer.length > 250 ? 14 : cleanAnswer.length > 120 ? 15 : 16;

            slide.addText(cleanAnswer, {
              x: startX + 0.25,
              y: startY + 0.60,
              w: areaWidth - 0.50,
              h: boxH - 0.75,
              fontSize: ansFontSize,
              fontFace,
              color: theme.textColor,
              wrap: true,
              lineSpacingMultiple: 1.25
            });
          }
        }
      };

      // Slide sequence execution based on selected presentationMode
      if (mode === 'click_reveal') {
        renderQuestionState(false);
        renderQuestionState(true);
      } else if (mode === 'questions_only') {
        renderQuestionState(false);
      } else {
        renderQuestionState(true);
      }

      // Supplementary Dedicated Explanation Slide if requested
      if (mode === 'with_explanations' && q.explanation && !requiresMultiSlide) {
        const expSlide = pptx.addSlide();
        expSlide.background = { color: theme.bgColor };
        applyTransition(expSlide);

        addHeader(expSlide, qNum, 'Lời giải chi tiết', true);

        expSlide.addShape(pptx.ShapeType.roundRect, {
          x: 0.8,
          y: 1.00,
          w: contentW,
          h: 5.65,
          fill: { color: theme.cardBg },
          line: { color: theme.cardBorder, width: 1.5 }
        });

        expSlide.addText('LỜI GIẢI CHI TIẾT TỪNG BƯỚC:', {
          x: 1.1,
          y: 1.20,
          w: contentW - 0.6,
          h: 0.4,
          fontSize: 15,
          fontFace,
          bold: true,
          color: theme.accentColor
        });

        expSlide.addText(latexToUnicodeMath(q.explanation), {
          x: 1.1,
          y: 1.70,
          w: contentW - 0.6,
          h: 4.60,
          fontSize: 15,
          fontFace,
          color: theme.textColor,
          wrap: true,
          lineSpacingMultiple: 1.25
        });

        addFooter(expSlide);
      }
    });
  }

  // ==================== 3. SUMMARY ANSWER MATRIX SLIDE ====================
  if (mode === 'answers_only' || mode === 'with_explanations') {
    const matrixSlide = pptx.addSlide();
    matrixSlide.background = { color: theme.bgColor };
    applyTransition(matrixSlide);

    matrixSlide.addText('BẢNG ĐÁP ÁN TỔNG HỢP', {
      x: 0.8,
      y: 0.6,
      w: contentW,
      h: 0.5,
      fontSize: 22,
      fontFace,
      bold: true,
      color: theme.titleColor,
      align: 'center'
    });

    const mcQuestions = questions.filter(q => q.type === 'multiple_choice');
    const boxW = contentW / 10;
    const boxH = 0.9;

    mcQuestions.forEach((q, i) => {
      const col = i % 10;
      const row = Math.floor(i / 10);
      const x = 0.8 + col * boxW;
      const y = 1.5 + row * (boxH + 0.2);

      matrixSlide.addShape(pptx.ShapeType.roundRect, {
        x: x + 0.05,
        y,
        w: boxW - 0.1,
        h: boxH,
        fill: { color: theme.cardBg },
        line: { color: '16A34A', width: 1.5 }
      });

      matrixSlide.addText(`${q.questionNumber || (i + 1)}`, {
        x: x + 0.05,
        y: y + 0.08,
        w: boxW - 0.1,
        h: 0.35,
        fontSize: 12,
        fontFace,
        color: theme.subtextColor,
        bold: true,
        align: 'center'
      });

      matrixSlide.addText(q.correctOption || '-', {
        x: x + 0.05,
        y: y + 0.4,
        w: boxW - 0.1,
        h: 0.45,
        fontSize: 18,
        fontFace,
        bold: true,
        color: '15803D',
        align: 'center'
      });
    });

    addFooter(matrixSlide);
  }

  // ==================== 4. ENDING SLIDE ====================
  if (options.includeEndingSlide !== false && mode !== 'answers_only') {
    const endSlide = pptx.addSlide();
    endSlide.background = { color: theme.bgColor };
    applyTransition(endSlide);

    endSlide.addText('CHÚC CÁC EM HỌC TẬP TỐT!', {
      x: 0.8,
      y: 2.5,
      w: contentW,
      h: 1.2,
      fontSize: 34,
      fontFace,
      bold: true,
      color: theme.accentColor,
      align: 'center'
    });

    endSlide.addText(`${schoolName}  •  Hệ thống thi trắc nghiệm & giảng dạy thông minh EduTest PRO`, {
      x: 0.8,
      y: 3.8,
      w: contentW,
      h: 0.6,
      fontSize: 16,
      fontFace,
      color: theme.subtextColor,
      align: 'center'
    });

    addFooter(endSlide);
  }

  // Download PPTX
  const safeFilename = `${exam.title || 'De_thi'}_Trinh_chieu.pptx`
    .replace(/[^a-zA-Z0-9_\-\. à-ỹÀ-Ỹ]/g, '_')
    .replace(/\s+/g, '_');

  await pptx.writeFile({ fileName: safeFilename });
}
