import PptxGenJS from 'pptxgenjs';
import { Exam, Question } from '../types';
import { latexToUnicodeMath, stripCommentsAndHtml } from './mathConverter';

export type PptxPresentationMode = 
  | 'click_reveal'        // Mặc định: Ban đầu chỉ hiện đề, nhấp chuột hiện đáp án xanh + tích ✓
  | 'questions_only'      // Chỉ đề thi không có đáp án (kiểm tra trên lớp)
  | 'answers_always'      // Hiện sẵn đáp án (chữa bài trực tiếp)
  | 'with_explanations'   // Kèm slide lời giải chi tiết
  | 'answers_only';       // Chỉ slide bảng ma trận đáp án

export interface PptxExportOptions {
  presentationMode?: PptxPresentationMode;
  aspectRatio?: '16:9' | '4:3';
  fontFamily?: string;
  theme?: 'light-clean' | 'slate-dark' | 'navy-blue';
  includeCoverSlide?: boolean;
  includeEndingSlide?: boolean;
  slideTransition?: 'morph' | 'fade' | 'none';
}

interface ThemeConfig {
  bgColor: string;
  cardBg: string;
  cardBorder: string;
  titleColor: string;
  textColor: string;
  subtextColor: string;
  accentColor: string;
  // Option button styles
  optNeutralBg: string;
  optNeutralBorder: string;
  optNeutralText: string;
  // Correct answer styles
  optCorrectBg: string;
  optCorrectBorder: string;
  optCorrectText: string;
}

const THEMES: Record<string, ThemeConfig> = {
  'light-clean': {
    bgColor: 'F8FAFC',
    cardBg: 'FFFFFF',
    cardBorder: 'E2E8F0',
    titleColor: '0F172A',
    textColor: '1E293B',
    subtextColor: '64748B',
    accentColor: '0D9488', // Teal-600
    optNeutralBg: 'FFFFFF',
    optNeutralBorder: 'CBD5E1',
    optNeutralText: '334155',
    optCorrectBg: 'DCFCE7', // Emerald-100
    optCorrectBorder: '16A34A', // Emerald-600
    optCorrectText: '14532D' // Emerald-900
  },
  'navy-blue': {
    bgColor: '0F172A',
    cardBg: '1E293B',
    cardBorder: '334155',
    titleColor: 'F8FAFC',
    textColor: 'E2E8F0',
    subtextColor: '94A3B8',
    accentColor: '14B8A6',
    optNeutralBg: '1E293B',
    optNeutralBorder: '475569',
    optNeutralText: 'E2E8F0',
    optCorrectBg: '064E3B',
    optCorrectBorder: '10B981',
    optCorrectText: 'A7F3D0'
  },
  'slate-dark': {
    bgColor: '090D16',
    cardBg: '131B2E',
    cardBorder: '1E293B',
    titleColor: 'F1F5F9',
    textColor: 'CBD5E1',
    subtextColor: '64748B',
    accentColor: '38BDF8',
    optNeutralBg: '131B2E',
    optNeutralBorder: '334155',
    optNeutralText: 'E2E8F0',
    optCorrectBg: '064E3B',
    optCorrectBorder: '10B981',
    optCorrectText: '6EE7B7'
  }
};

/**
 * Exports exam into a Microsoft PowerPoint (.pptx) presentation
 * Implements click-to-reveal animations, 16:9 / 4:3 ratios, and clean mathematical typography
 */
export async function exportExamToPptx(
  exam: Exam, 
  questions: Question[], 
  options: PptxExportOptions = {}
): Promise<void> {
  const pptx = new PptxGenJS();

  // Layout ratio
  pptx.layout = options.aspectRatio === '4:3' ? 'LAYOUT_4x3' : 'LAYOUT_16x9';

  const themeKey = options.theme || 'light-clean';
  const theme = THEMES[themeKey] || THEMES['light-clean'];
  const fontFace = options.fontFamily || 'Arial';
  const mode = options.presentationMode || 'click_reveal';

  const slideW = options.aspectRatio === '4:3' ? 10.0 : 13.33;
  const slideH = options.aspectRatio === '4:3' ? 7.5 : 7.5;

  // Helper to add Slide Transition
  const applyTransition = (slide: PptxGenJS.Slide) => {
    if (options.slideTransition === 'fade' || options.slideTransition === 'morph') {
      (slide as any).transition = { type: 'fade', duration: 400 };
    }
  };

  // ==================== 1. COVER SLIDE ====================
  if (options.includeCoverSlide !== false && mode !== 'answers_only') {
    const coverSlide = pptx.addSlide();
    coverSlide.background = { color: theme.bgColor };
    applyTransition(coverSlide);

    // Decorative brand banner
    coverSlide.addShape(pptx.ShapeType.roundRect, {
      x: 0.8,
      y: 0.8,
      w: 4.5,
      h: 0.45,
      fill: { color: themeKey === 'light-clean' ? 'CCFBF1' : '134E4A' },
      line: { color: theme.accentColor, width: 1 }
    });

    coverSlide.addText('HỆ THỐNG THI TRỰC TUYẾN EDUTEST PRO', {
      x: 0.9,
      y: 0.82,
      w: 4.3,
      h: 0.4,
      fontSize: 12,
      fontFace,
      color: theme.accentColor,
      bold: true
    });

    // Main Exam Title
    const cleanTitle = latexToUnicodeMath(exam.title || 'BÀI KIỂM TRA TRẮC NGHIỆM');
    coverSlide.addText(cleanTitle, {
      x: 0.8,
      y: 1.6,
      w: slideW - 1.6,
      h: 2.2,
      fontSize: 32,
      fontFace,
      color: theme.titleColor,
      bold: true,
      wrap: true
    });

    // Metadata Tag Box
    coverSlide.addText(
      `Môn học: ${(exam.subjectName || 'Chung').toUpperCase()}   •   Khối: ${exam.grade || '12'}   •   Thời gian: ${exam.durationMinutes} phút   •   Số lượng: ${questions.length} câu`,
      {
        x: 0.8,
        y: 4.2,
        w: slideW - 1.6,
        h: 0.6,
        fontSize: 16,
        fontFace,
        color: theme.subtextColor,
        bold: true
      }
    );

    // Instruction for interactive click-to-reveal
    if (mode === 'click_reveal') {
      coverSlide.addShape(pptx.ShapeType.roundRect, {
        x: 0.8,
        y: 5.2,
        w: slideW - 1.6,
        h: 0.8,
        fill: { color: themeKey === 'light-clean' ? 'F1F5F9' : '1E293B' },
        line: { color: theme.cardBorder, width: 1 }
      });

      coverSlide.addText(
        '💡 Chế độ trình chiếu: Ban đầu chỉ hiển thị câu hỏi và 4 lựa chọn. Nhấp chuột để công bố đáp án đúng.',
        {
          x: 1.0,
          y: 5.3,
          w: slideW - 2.0,
          h: 0.6,
          fontSize: 13,
          fontFace,
          color: theme.textColor,
          italic: true
        }
      );
    }
  }

  // ==================== 2. QUESTION SLIDES ====================
  if (mode !== 'answers_only') {
    questions.forEach((q, idx) => {
      const qNum = idx + 1;
      const cleanPrompt = latexToUnicodeMath(q.prompt);

      // Function to render a question slide state
      const renderQuestionSlide = (revealAnswer: boolean) => {
        const slide = pptx.addSlide();
        slide.background = { color: theme.bgColor };
        applyTransition(slide);

        // Header Bar: Question Number + Section Tag
        slide.addText(`CÂU ${qNum}`, {
          x: 0.8,
          y: 0.45,
          w: 2.5,
          h: 0.45,
          fontSize: 16,
          fontFace,
          color: theme.accentColor,
          bold: true
        });

        const pointsText = q.points ? `(${q.points} điểm)` : '';
        const sectionText = q.sectionTitle || (q.type === 'multiple_choice' ? 'Trắc nghiệm nhiều lựa chọn' : q.type === 'true_false' ? 'Trắc nghiệm Đúng / Sai' : 'Tự luận');
        slide.addText(`${pointsText}   •   ${sectionText}`, {
          x: 2.8,
          y: 0.48,
          w: slideW - 5.5,
          h: 0.4,
          fontSize: 12,
          fontFace,
          color: theme.subtextColor
        });

        // Question Status indicator on right
        if (revealAnswer) {
          slide.addShape(pptx.ShapeType.roundRect, {
            x: slideW - 3.2,
            y: 0.4,
            w: 2.4,
            h: 0.4,
            fill: { color: 'DCFCE7' },
            line: { color: '16A34A', width: 1 }
          });
          slide.addText('✓ ĐÁP ÁN ĐÚNG', {
            x: slideW - 3.2,
            y: 0.42,
            w: 2.4,
            h: 0.35,
            fontSize: 11,
            fontFace,
            color: '15803D',
            bold: true,
            align: 'center'
          });
        }

        // Dynamic prompt sizing based on length
        const promptLength = cleanPrompt.length;
        const promptFontSize = promptLength > 300 ? 15 : promptLength > 180 ? 18 : 21;
        const promptHeight = promptLength > 300 ? 1.8 : 1.4;

        // Prompt Card Box
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 0.8,
          y: 1.0,
          w: slideW - 1.6,
          h: promptHeight,
          fill: { color: theme.cardBg },
          line: { color: theme.cardBorder, width: 1 }
        });

        slide.addText(cleanPrompt, {
          x: 1.1,
          y: 1.1,
          w: slideW - 2.2,
          h: promptHeight - 0.2,
          fontSize: promptFontSize,
          fontFace,
          color: theme.titleColor,
          bold: true,
          wrap: true
        });

        // Options Rendering
        const optionsStartY = 1.0 + promptHeight + 0.3;

        if (q.type === 'multiple_choice' && q.options) {
          // 4 options in 2x2 Grid or 4 vertical rows
          const optKeys: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
          const colW = (slideW - 1.6 - 0.4) / 2;
          const cardH = 1.05;

          const positions = [
            { key: 'A', x: 0.8, y: optionsStartY },
            { key: 'B', x: 0.8 + colW + 0.4, y: optionsStartY },
            { key: 'C', x: 0.8, y: optionsStartY + cardH + 0.25 },
            { key: 'D', x: 0.8 + colW + 0.4, y: optionsStartY + cardH + 0.25 }
          ];

          positions.forEach(pos => {
            const optKey = pos.key as 'A' | 'B' | 'C' | 'D';
            const optText = latexToUnicodeMath(q.options?.[optKey] || '');
            const isCorrect = q.correctOption === optKey;

            // Reveal state determines styling
            const isHighlighted = revealAnswer && isCorrect;

            // Option container card
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

            slide.addText(`${optKey}`, {
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

            // Option Text Content
            slide.addText(optText, {
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

            // If revealed & correct: checkmark icon badge
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

        } else if (q.type === 'true_false' && q.subQuestions) {
          // 4 horizontal statement rows a), b), c), d)
          const subH = 0.72;
          q.subQuestions.forEach((sub, sIdx) => {
            const yPos = optionsStartY + sIdx * (subH + 0.15);
            const isCorrect = sub.correct;
            const isHighlighted = revealAnswer;

            slide.addShape(pptx.ShapeType.roundRect, {
              x: 0.8,
              y: yPos,
              w: slideW - 1.6,
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
              w: slideW - 3.8,
              h: subH - 0.2,
              fontSize: 14,
              fontFace,
              color: theme.textColor,
              wrap: true
            });

            // Revealed badge: ĐÚNG or SAI
            if (isHighlighted) {
              slide.addShape(pptx.ShapeType.roundRect, {
                x: slideW - 2.5,
                y: yPos + 0.12,
                w: 1.4,
                h: 0.45,
                fill: { color: isCorrect ? 'DCFCE7' : 'FEE2E2' },
                line: { color: isCorrect ? '16A34A' : 'EF4444', width: 1 }
              });

              slide.addText(isCorrect ? 'ĐÚNG' : 'SAI', {
                x: slideW - 2.5,
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
          // Short Answer or Essay
          slide.addShape(pptx.ShapeType.roundRect, {
            x: 0.8,
            y: optionsStartY,
            w: slideW - 1.6,
            h: 2.2,
            fill: { color: theme.cardBg },
            line: { color: theme.cardBorder, width: 1 }
          });

          if (revealAnswer) {
            const ansText = q.acceptableAnswers?.length 
              ? `Đáp án chấp nhận: ${q.acceptableAnswers.join(' hoặc ')}`
              : q.sampleAnswer || 'Đáp án theo hướng dẫn chấm của giáo viên.';

            slide.addText(`HƯỚNG DẪN / ĐÁP ÁN:`, {
              x: 1.1,
              y: optionsStartY + 0.2,
              w: slideW - 2.2,
              h: 0.4,
              fontSize: 14,
              fontFace,
              bold: true,
              color: '15803D'
            });

            slide.addText(latexToUnicodeMath(ansText), {
              x: 1.1,
              y: optionsStartY + 0.65,
              w: slideW - 2.2,
              h: 1.4,
              fontSize: 15,
              fontFace,
              color: theme.textColor,
              wrap: true
            });
          } else {
            slide.addText('Học sinh ghi câu trả lời hoặc trình bày lời giải chi tiết.', {
              x: 1.1,
              y: optionsStartY + 0.8,
              w: slideW - 2.2,
              h: 0.8,
              fontSize: 15,
              fontFace,
              color: theme.subtextColor,
              italic: true,
              align: 'center'
            });
          }
        }
      };

      // Execution of slide generation based on mode
      if (mode === 'click_reveal') {
        // Step 1: Neutral slide (Question only, no answer revealed)
        renderQuestionSlide(false);
        // Step 2: Answer revealed slide (Next mouse click reveals answer smoothly)
        renderQuestionSlide(true);
      } else if (mode === 'questions_only') {
        // Only neutral slide
        renderQuestionSlide(false);
      } else {
        // answers_always or with_explanations
        renderQuestionSlide(true);
      }

      // Supplementary Explanation Slide if requested
      if (mode === 'with_explanations' && q.explanation) {
        const expSlide = pptx.addSlide();
        expSlide.background = { color: theme.bgColor };
        applyTransition(expSlide);

        expSlide.addText(`CÂU ${qNum} — HƯỚNG DẪN GIẢI CHI TIẾT`, {
          x: 0.8,
          y: 0.6,
          w: slideW - 1.6,
          h: 0.5,
          fontSize: 18,
          fontFace,
          color: theme.accentColor,
          bold: true
        });

        expSlide.addShape(pptx.ShapeType.roundRect, {
          x: 0.8,
          y: 1.3,
          w: slideW - 1.6,
          h: 5.2,
          fill: { color: theme.cardBg },
          line: { color: theme.cardBorder, width: 1 }
        });

        expSlide.addText(latexToUnicodeMath(q.explanation), {
          x: 1.2,
          y: 1.6,
          w: slideW - 2.4,
          h: 4.6,
          fontSize: 16,
          fontFace,
          color: theme.textColor,
          wrap: true
        });
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
      w: slideW - 1.6,
      h: 0.5,
      fontSize: 22,
      fontFace,
      bold: true,
      color: theme.titleColor,
      align: 'center'
    });

    // 10 items per row grid
    const mcQuestions = questions.filter(q => q.type === 'multiple_choice');
    const rows = Math.ceil(mcQuestions.length / 10);
    const boxW = (slideW - 1.6) / 10;
    const boxH = 0.9;

    mcQuestions.forEach((q, i) => {
      const col = i % 10;
      const row = Math.floor(i / 10);
      const x = 0.8 + col * boxW;
      const y = 1.6 + row * (boxH + 0.2);

      matrixSlide.addShape(pptx.ShapeType.roundRect, {
        x: x + 0.05,
        y,
        w: boxW - 0.1,
        h: boxH,
        fill: { color: theme.cardBg },
        line: { color: '16A34A', width: 1.5 }
      });

      matrixSlide.addText(`${i + 1}`, {
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
  }

  // ==================== 4. ENDING SLIDE ====================
  if (options.includeEndingSlide !== false && mode !== 'answers_only') {
    const endSlide = pptx.addSlide();
    endSlide.background = { color: theme.bgColor };
    applyTransition(endSlide);

    endSlide.addText('CHÚC CÁC EM HỌC TẬP TỐT!', {
      x: 0.8,
      y: 2.5,
      w: slideW - 1.6,
      h: 1.2,
      fontSize: 34,
      fontFace,
      bold: true,
      color: theme.accentColor,
      align: 'center'
    });

    endSlide.addText('Hệ thống thi trắc nghiệm & giảng dạy thông minh EduTest PRO', {
      x: 0.8,
      y: 3.8,
      w: slideW - 1.6,
      h: 0.6,
      fontSize: 16,
      fontFace,
      color: theme.subtextColor,
      align: 'center'
    });
  }

  // Download PPTX
  const safeFilename = `${exam.title || 'De_thi'}_Trinh_chieu.pptx`
    .replace(/[^a-zA-Z0-9_\-\. à-ỹÀ-Ỹ]/g, '_')
    .replace(/\s+/g, '_');

  await pptx.writeFile({ fileName: safeFilename });
}
