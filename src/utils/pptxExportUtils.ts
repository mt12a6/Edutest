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

  let slideCounter = (options.includeCoverSlide !== false && mode !== 'answers_only') ? 1 : 0;

  questions.forEach((q, idx) => {
    const qNum = q.questionNumber || (idx + 1);
    const cleanPrompt = latexToUnicodeMath(q.prompt || '');

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

  const lineHeightInches = (fontSizePt * 1.32) / 72;
  const totalHeight = totalLines * lineHeightInches + 0.2; // include padding

  return { lines: totalLines, heightInches: totalHeight };
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

  // Widescreen 16:9 standard (13.33 x 7.5 inches)
  pptx.layout = options.aspectRatio === '4:3' ? 'LAYOUT_4x3' : 'LAYOUT_16x9';

  const themeKey = options.theme || 'light-clean';
  const theme = THEMES[themeKey] || THEMES['light-clean'];
  const fontFace = options.fontFamily || 'Arial';
  const mode = options.presentationMode || 'click_reveal';

  const slideW = options.aspectRatio === '4:3' ? 10.0 : 13.33;
  const slideH = options.aspectRatio === '4:3' ? 7.5 : 7.5;
  const contentW = slideW - 1.6; // Left 0.8, Right 0.8
  const maxAvailableH = 5.85; // From y: 1.05 to y: 6.9

  const schoolName = options.schoolName || 'TRƯỜNG THCS & THPT EDUTEST';
  const examTitle = exam.title || 'BÀI KIỂM TRA ĐÁNH GIÁ';
  const isStudentVersion = mode === 'questions_only';

  const applyTransition = (slide: PptxGenJS.Slide) => {
    if (options.slideTransition === 'fade' || options.slideTransition === 'morph') {
      (slide as any).transition = { type: 'fade', duration: 350 };
    }
  };

  // Helper to add unified slide header
  const addHeader = (slide: PptxGenJS.Slide, qNum: number, continuationTag?: string, isAnswerState?: boolean) => {
    // Top Left: Question Number + Section + Continuation
    const qBadgeText = continuationTag ? `CÂU ${qNum} (${continuationTag})` : `CÂU ${qNum}`;
    
    slide.addText(qBadgeText, {
      x: 0.8,
      y: 0.42,
      w: 3.5,
      h: 0.45,
      fontSize: 16,
      fontFace,
      color: theme.accentColor,
      bold: true
    });

    // Subject + Grade + Duration Subtext
    const subheaderText = `${(exam.subjectName || 'Toán học').toUpperCase()}   •   Khối ${exam.grade || '6'}   •   ${exam.durationMinutes || 45} phút`;
    slide.addText(subheaderText, {
      x: 4.4,
      y: 0.45,
      w: slideW - 8.0,
      h: 0.4,
      fontSize: 12,
      fontFace,
      color: theme.subtextColor
    });

    // Top Right Status Badge
    if (isStudentVersion) {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: slideW - 3.4,
        y: 0.4,
        w: 2.6,
        h: 0.4,
        fill: { color: theme.headerBg },
        line: { color: theme.headerBorder, width: 1 }
      });
      slide.addText('ĐỀ THI HỌC SINH', {
        x: slideW - 3.4,
        y: 0.42,
        w: 2.6,
        h: 0.35,
        fontSize: 10,
        fontFace,
        bold: true,
        color: theme.subtextColor,
        align: 'center'
      });
    } else if (isAnswerState) {
      slide.addShape(pptx.ShapeType.roundRect, {
        x: slideW - 3.4,
        y: 0.4,
        w: 2.6,
        h: 0.4,
        fill: { color: 'DCFCE7' },
        line: { color: '16A34A', width: 1 }
      });
      slide.addText('✓ HƯỚNG DẪN CHẤM', {
        x: slideW - 3.4,
        y: 0.42,
        w: 2.6,
        h: 0.35,
        fontSize: 11,
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

      // Estimate prompt height
      const promptMetrics = estimateTextMetrics(cleanPrompt, contentW - 0.6, 17);
      const isLongPrompt = promptMetrics.lines > 6 || cleanPrompt.length > 320;

      // Determine options layout for Multiple Choice
      let isOneColMc = false;
      let optTexts: Record<'A' | 'B' | 'C' | 'D', string> = { A: '', B: '', C: '', D: '' };
      if (q.type === 'multiple_choice' && q.options) {
        const keys: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
        keys.forEach(k => {
          optTexts[k] = latexToUnicodeMath(q.options?.[k] || '');
        });
        const maxOptLen = Math.max(...keys.map(k => optTexts[k].length));
        isOneColMc = maxOptLen > 40 || keys.some(k => optTexts[k].includes('\n'));
      }

      // Check if we need Multi-slide pagination for this question
      // If prompt is very long, or prompt + options > available height
      const totalEstimatedHeight = promptMetrics.heightInches + (isOneColMc ? 3.8 : 2.5);
      const requiresMultiSlide = isLongPrompt && totalEstimatedHeight > maxAvailableH;

      // Inner function to render Question Content on a slide
      const renderQuestionState = (revealAnswer: boolean) => {

        if (requiresMultiSlide) {
          // ================= MULTI-SLIDE CASE =================
          // SLIDE A: Question Prompt in expansive view
          const slideA = pptx.addSlide();
          slideA.background = { color: theme.bgColor };
          applyTransition(slideA);
          addHeader(slideA, qNum, 'Phần đề bài', false);

          // Prompt Card taking full height
          const promptH = 5.2;
          slideA.addShape(pptx.ShapeType.roundRect, {
            x: 0.8,
            y: 1.05,
            w: contentW,
            h: promptH,
            fill: { color: theme.cardBg },
            line: { color: theme.cardBorder, width: 1.5 }
          });

          slideA.addText(cleanPrompt, {
            x: 1.1,
            y: 1.25,
            w: contentW - 0.6,
            h: promptH - 0.9,
            fontSize: 18,
            fontFace,
            color: theme.titleColor,
            bold: true,
            wrap: true,
            lineSpacingMultiple: 1.25
          });

          slideA.addText('➔ Xem các phương án lựa chọn và làm bài ở slide tiếp theo', {
            x: 1.1,
            y: 1.05 + promptH - 0.6,
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

          // SLIDE B: Options / Answer continuation
          const slideB = pptx.addSlide();
          slideB.background = { color: theme.bgColor };
          applyTransition(slideB);
          addHeader(slideB, qNum, 'tiếp theo', revealAnswer && !isStudentVersion);

          // Mini Prompt Recap Box
          slideB.addShape(pptx.ShapeType.roundRect, {
            x: 0.8,
            y: 1.05,
            w: contentW,
            h: 0.8,
            fill: { color: theme.headerBg },
            line: { color: theme.headerBorder, width: 1 }
          });

          const recapText = cleanPrompt.length > 140 ? `${cleanPrompt.slice(0, 137)}...` : cleanPrompt;
          slideB.addText(`Đề bài: ${recapText}`, {
            x: 1.0,
            y: 1.15,
            w: contentW - 0.4,
            h: 0.6,
            fontSize: 13,
            fontFace,
            color: theme.subtextColor,
            italic: true
          });

          // Render options or answer starting below recap
          const optionsY = 2.05;
          renderOptionsArea(slideB, q, optionsY, revealAnswer && !isStudentVersion, isOneColMc, optTexts);
          addFooter(slideB);

        } else {
          // ================= SINGLE SLIDE CASE =================
          const slide = pptx.addSlide();
          slide.background = { color: theme.bgColor };
          applyTransition(slide);
          addHeader(slide, qNum, undefined, revealAnswer && !isStudentVersion);

          // Calculate balanced prompt height
          const promptFontSize = cleanPrompt.length > 220 ? 16 : cleanPrompt.length > 130 ? 18 : 20;
          const promptH = Math.min(2.4, Math.max(1.3, promptMetrics.heightInches + 0.3));

          // Prompt Card
          slide.addShape(pptx.ShapeType.roundRect, {
            x: 0.8,
            y: 1.05,
            w: contentW,
            h: promptH,
            fill: { color: theme.cardBg },
            line: { color: theme.cardBorder, width: 1.5 }
          });

          slide.addText(cleanPrompt, {
            x: 1.1,
            y: 1.2,
            w: contentW - 0.6,
            h: promptH - 0.3,
            fontSize: promptFontSize,
            fontFace,
            color: theme.titleColor,
            bold: true,
            wrap: true,
            lineSpacingMultiple: 1.2
          });

          // Options / Answer Area
          const optionsY = 1.05 + promptH + 0.25;
          renderOptionsArea(slide, q, optionsY, revealAnswer && !isStudentVersion, isOneColMc, optTexts);
          addFooter(slide);
        }
      };

      // Helper to render the options/answers area
      const renderOptionsArea = (
        slide: PptxGenJS.Slide,
        currQ: Question,
        startY: number,
        reveal: boolean,
        is1Col: boolean,
        optStrings: Record<'A' | 'B' | 'C' | 'D', string>
      ) => {
        if (currQ.type === 'multiple_choice') {
          const keys: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];

          if (is1Col) {
            // 1-column x 4-row layout (Vertical full width)
            const rowH = 0.85;
            const gap = 0.18;
            keys.forEach((key, kIdx) => {
              const yPos = startY + kIdx * (rowH + gap);
              const optContent = optStrings[key];
              const isCorrect = currQ.correctOption === key;
              const isHighlighted = reveal && isCorrect;

              slide.addShape(pptx.ShapeType.roundRect, {
                x: 0.8,
                y: yPos,
                w: contentW,
                h: rowH,
                fill: { color: isHighlighted ? theme.optCorrectBg : theme.optNeutralBg },
                line: {
                  color: isHighlighted ? theme.optCorrectBorder : theme.optNeutralBorder,
                  width: isHighlighted ? 2.5 : 1
                }
              });

              // Letter Pill
              slide.addShape(pptx.ShapeType.roundRect, {
                x: 1.0,
                y: yPos + 0.14,
                w: 0.55,
                h: 0.55,
                fill: { color: isHighlighted ? '16A34A' : themeKey === 'light-clean' ? 'F1F5F9' : '334155' },
                line: { color: isHighlighted ? '15803D' : theme.cardBorder, width: 1 }
              });

              slide.addText(key, {
                x: 1.0,
                y: yPos + 0.16,
                w: 0.55,
                h: 0.5,
                fontSize: 16,
                fontFace,
                bold: true,
                color: isHighlighted ? 'FFFFFF' : theme.titleColor,
                align: 'center'
              });

              // Option Content
              slide.addText(optContent, {
                x: 1.75,
                y: yPos + 0.14,
                w: contentW - 2.5,
                h: rowH - 0.28,
                fontSize: 15,
                fontFace,
                bold: isHighlighted,
                color: isHighlighted ? theme.optCorrectText : theme.textColor,
                wrap: true
              });

              // Checkmark badge if revealed
              if (isHighlighted) {
                slide.addText('✓', {
                  x: contentW - 0.2,
                  y: yPos + 0.16,
                  w: 0.5,
                  h: 0.5,
                  fontSize: 20,
                  fontFace,
                  bold: true,
                  color: '16A34A',
                  align: 'center'
                });
              }
            });

          } else {
            // 2-column x 2-row layout (Balanced Grid)
            const colW = (contentW - 0.4) / 2;
            const cardH = 1.05;
            const positions = [
              { key: 'A' as const, x: 0.8, y: startY },
              { key: 'B' as const, x: 0.8 + colW + 0.4, y: startY },
              { key: 'C' as const, x: 0.8, y: startY + cardH + 0.25 },
              { key: 'D' as const, x: 0.8 + colW + 0.4, y: startY + cardH + 0.25 }
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

              // Letter Pill
              slide.addShape(pptx.ShapeType.roundRect, {
                x: pos.x + 0.15,
                y: pos.y + 0.15,
                w: 0.55,
                h: 0.55,
                fill: { color: isHighlighted ? '16A34A' : themeKey === 'light-clean' ? 'F1F5F9' : '334155' },
                line: { color: isHighlighted ? '15803D' : theme.cardBorder, width: 1 }
              });

              slide.addText(pos.key, {
                x: pos.x + 0.15,
                y: pos.y + 0.17,
                w: 0.55,
                h: 0.5,
                fontSize: 16,
                fontFace,
                bold: true,
                color: isHighlighted ? 'FFFFFF' : theme.titleColor,
                align: 'center'
              });

              // Option Content
              slide.addText(optContent, {
                x: pos.x + 0.85,
                y: pos.y + 0.12,
                w: colW - 1.4,
                h: cardH - 0.24,
                fontSize: 15,
                fontFace,
                bold: isHighlighted,
                color: isHighlighted ? theme.optCorrectText : theme.textColor,
                wrap: true
              });

              if (isHighlighted) {
                slide.addText('✓', {
                  x: pos.x + colW - 0.5,
                  y: pos.y + 0.15,
                  w: 0.4,
                  h: 0.4,
                  fontSize: 18,
                  fontFace,
                  bold: true,
                  color: '16A34A',
                  align: 'center'
                });
              }
            });
          }

        } else if (currQ.type === 'true_false' && currQ.subQuestions) {
          // 4 True/False rows
          const subH = 0.72;
          currQ.subQuestions.forEach((sub, sIdx) => {
            const yPos = startY + sIdx * (subH + 0.15);
            const isCorrect = sub.correct;

            slide.addShape(pptx.ShapeType.roundRect, {
              x: 0.8,
              y: yPos,
              w: contentW,
              h: subH,
              fill: { color: theme.cardBg },
              line: { color: theme.cardBorder, width: 1 }
            });

            slide.addText(`${sub.key})`, {
              x: 1.0,
              y: yPos + 0.12,
              w: 0.5,
              h: 0.45,
              fontSize: 14,
              fontFace,
              bold: true,
              color: theme.accentColor
            });

            slide.addText(latexToUnicodeMath(sub.text), {
              x: 1.5,
              y: yPos + 0.12,
              w: contentW - 2.8,
              h: subH - 0.2,
              fontSize: 14,
              fontFace,
              color: theme.textColor,
              wrap: true
            });

            if (reveal) {
              slide.addShape(pptx.ShapeType.roundRect, {
                x: contentW - 0.8,
                y: yPos + 0.12,
                w: 1.4,
                h: 0.45,
                fill: { color: isCorrect ? 'DCFCE7' : 'FEE2E2' },
                line: { color: isCorrect ? '16A34A' : 'EF4444', width: 1 }
              });

              slide.addText(isCorrect ? 'ĐÚNG' : 'SAI', {
                x: contentW - 0.8,
                y: yPos + 0.14,
                w: 1.4,
                h: 0.4,
                fontSize: 12,
                fontFace,
                bold: true,
                color: isCorrect ? '15803D' : '991B1B',
                align: 'center'
              });
            }
          });

        } else {
          // ESSAY OR FILL-IN-THE-BLANK
          const availableAreaH = Math.max(2.4, 6.85 - startY);

          if (isStudentVersion || !reveal) {
            // Student version: Generous writing space box
            slide.addShape(pptx.ShapeType.roundRect, {
              x: 0.8,
              y: startY,
              w: contentW,
              h: availableAreaH,
              fill: { color: theme.writingSpaceBg },
              line: { color: theme.writingSpaceBorder, width: 1.5, dashType: 'dash' }
            });

            slide.addText('KHÔNG GIAN LÀM BÀI', {
              x: 1.1,
              y: startY + 0.2,
              w: contentW - 0.6,
              h: 0.4,
              fontSize: 13,
              fontFace,
              bold: true,
              color: theme.writingSpaceText
            });

            slide.addText(
              'Học sinh trình bày các bước biến đổi và kết luận chi tiết vào giấy làm bài thi hoặc khung trên.',
              {
                x: 1.1,
                y: startY + availableAreaH / 2 - 0.3,
                w: contentW - 0.6,
                h: 0.6,
                fontSize: 14,
                fontFace,
                color: theme.subtextColor,
                italic: true,
                align: 'center'
              }
            );

          } else {
            // Teacher / Answer revealed version: "HƯỚNG DẪN CHẤM & ĐÁP ÁN"
            slide.addShape(pptx.ShapeType.roundRect, {
              x: 0.8,
              y: startY,
              w: contentW,
              h: availableAreaH,
              fill: { color: theme.cardBg },
              line: { color: '16A34A', width: 1.5 }
            });

            slide.addText('HƯỚNG DẪN CHẤM & BAREM ĐIỂM:', {
              x: 1.1,
              y: startY + 0.2,
              w: contentW - 0.6,
              h: 0.4,
              fontSize: 14,
              fontFace,
              bold: true,
              color: '15803D'
            });

            const answerContent = currQ.sampleAnswer || currQ.explanation || 
              (currQ.acceptableAnswers?.length ? `Đáp án chấp nhận: ${currQ.acceptableAnswers.join(' hoặc ')}` : 'Giáo viên chấm điểm theo barem hướng dẫn.');

            slide.addText(latexToUnicodeMath(answerContent), {
              x: 1.1,
              y: startY + 0.65,
              w: contentW - 0.6,
              h: availableAreaH - 0.85,
              fontSize: 15,
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
          y: 1.1,
          w: contentW,
          h: 5.6,
          fill: { color: theme.cardBg },
          line: { color: theme.cardBorder, width: 1.5 }
        });

        expSlide.addText('LỜI GIẢI CHI TIẾT TỪNG BƯỚC:', {
          x: 1.1,
          y: 1.3,
          w: contentW - 0.6,
          h: 0.4,
          fontSize: 15,
          fontFace,
          bold: true,
          color: theme.accentColor
        });

        expSlide.addText(latexToUnicodeMath(q.explanation), {
          x: 1.1,
          y: 1.8,
          w: contentW - 0.6,
          h: 4.6,
          fontSize: 16,
          fontFace,
          color: theme.textColor,
          wrap: true,
          lineSpacingMultiple: 1.3
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
