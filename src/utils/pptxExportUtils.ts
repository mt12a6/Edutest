import PptxGenJS from 'pptxgenjs';
import { Exam, Question } from '../types';

export interface PptxExportOptions {
  includeAnswers?: boolean;
  slideTheme?: 'modern-light' | 'dark-slate' | 'navy-blue';
}

/**
 * Clean math text for PPTX display (converts $...$ and LaTeX macros to readable text)
 */
function cleanLatexForPptx(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\dfrac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\vec\{([^}]+)\}/g, 'vectơ $1')
    .replace(/\\mathbb\{R\}/g, 'ℝ')
    .replace(/\\mathbb\{Z\}/g, 'ℤ')
    .replace(/\\mathbb\{N\}/g, 'ℕ')
    .replace(/\\mathbb\{Q\}/g, 'ℚ')
    .replace(/\\pi\b/g, 'π')
    .replace(/\\alpha\b/g, 'α')
    .replace(/\\beta\b/g, 'β')
    .replace(/\\le\b/g, '≤')
    .replace(/\\ge\b/g, '≥')
    .replace(/\\neq\b/g, '≠')
    .replace(/\\in\b/g, '∈')
    .replace(/\\infty\b/g, '∞')
    .replace(/\\times\b/g, '×')
    .replace(/\\pm\b/g, '±')
    .replace(/\$+/g, '')
    .trim();
}

/**
 * Export exam questions into a PowerPoint (.pptx) presentation
 * Designed for classroom interactive voting / Plickers projectors
 */
export async function exportExamToPptx(
  exam: Exam, 
  questions: Question[], 
  options: PptxExportOptions = {}
): Promise<void> {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';

  // 1. Cover Slide
  const coverSlide = pptx.addSlide();
  coverSlide.background = { color: '0F172A' }; // Deep slate dark

  // Header tag
  coverSlide.addText('HỆ THỐNG THI TRỰC TUYẾN EDUTEST PRO', {
    x: 0.8,
    y: 1.0,
    w: 8.5,
    h: 0.4,
    fontSize: 14,
    color: '14B8A6', // Teal
    bold: true
  });

  // Title
  coverSlide.addText(exam.title || 'BÀI KIỂM TRA TRẮC NGHIỆM', {
    x: 0.8,
    y: 1.6,
    w: 8.5,
    h: 1.6,
    fontSize: 28,
    color: 'FFFFFF',
    bold: true,
    wrap: true
  });

  // Subtitle / Metadata
  coverSlide.addText(
    `Môn: ${exam.subjectName || 'Chung'}   |   Khối: ${exam.grade || '12'}   |   Thời gian: ${exam.durationMinutes} phút   |   Số câu: ${questions.length} câu`,
    {
      x: 0.8,
      y: 3.5,
      w: 8.5,
      h: 0.5,
      fontSize: 14,
      color: '94A3B8'
    }
  );

  // Footer note
  coverSlide.addText('Trình chiếu câu hỏi tương tác & Quét đáp án QR / Plickers', {
    x: 0.8,
    y: 4.8,
    w: 8.5,
    h: 0.4,
    fontSize: 11,
    color: '64748B',
    italic: true
  });

  // 2. Question Slides (1 slide per question)
  questions.forEach((q, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: 'F8FAFC' }; // Clean off-white

    // Top Question Number Bar
    slide.addText(`CÂU ${index + 1} (${q.points} điểm)`, {
      x: 0.8,
      y: 0.5,
      w: 4.0,
      h: 0.4,
      fontSize: 14,
      color: '0D9488', // Teal-600
      bold: true
    });

    if (q.sectionTitle) {
      slide.addText(q.sectionTitle, {
        x: 4.8,
        y: 0.5,
        w: 4.5,
        h: 0.4,
        fontSize: 11,
        color: '64748B',
        align: 'right'
      });
    }

    // Question Prompt Box
    const cleanPrompt = cleanLatexForPptx(q.prompt);
    slide.addText(cleanPrompt, {
      x: 0.8,
      y: 1.0,
      w: 8.4,
      h: 1.5,
      fontSize: 17,
      color: '0F172A',
      bold: true,
      wrap: true
    });

    // Options rendering based on Question Type
    if (q.type === 'multiple_choice' && q.options) {
      // 2x2 Grid for A, B, C, D
      const gridCoords = [
        { key: 'A', x: 0.8, y: 2.8, bg: 'EEF2FF', border: '6366F1', labelColor: '4338CA' }, // Indigo
        { key: 'B', x: 5.2, y: 2.8, bg: 'ECFDF5', border: '10B981', labelColor: '047857' }, // Emerald
        { key: 'C', x: 0.8, y: 4.0, bg: 'FFFBEB', border: 'F59E0B', labelColor: 'B45309' }, // Amber
        { key: 'D', x: 5.2, y: 4.0, bg: 'FAF5FF', border: 'A855F7', labelColor: '7E22CE' }  // Purple
      ];

      gridCoords.forEach(pos => {
        const optKey = pos.key as 'A' | 'B' | 'C' | 'D';
        const optText = cleanLatexForPptx(q.options?.[optKey] || '');
        const isCorrect = options.includeAnswers && q.correctOption === optKey;

        // Container card
        slide.addShape(pptx.ShapeType.roundRect, {
          x: pos.x,
          y: pos.y,
          w: 4.0,
          h: 0.95,
          fill: { color: isCorrect ? 'DCFCE7' : pos.bg },
          line: { color: isCorrect ? '16A34A' : pos.border, width: isCorrect ? 2 : 1 }
        });

        // Letter pill
        slide.addText(`${pos.key}.`, {
          x: pos.x + 0.15,
          y: pos.y + 0.15,
          w: 0.45,
          h: 0.65,
          fontSize: 16,
          bold: true,
          color: isCorrect ? '15803D' : pos.labelColor,
          align: 'center'
        });

        // Option Content
        slide.addText(optText, {
          x: pos.x + 0.65,
          y: pos.y + 0.1,
          w: 3.2,
          h: 0.75,
          fontSize: 14,
          color: '1E293B',
          wrap: true
        });
      });
    } else if (q.type === 'true_false' && q.subQuestions) {
      // 4 horizontal bars a, b, c, d
      q.subQuestions.forEach((sub, subIdx) => {
        const yPos = 2.7 + subIdx * 0.65;
        slide.addShape(pptx.ShapeType.roundRect, {
          x: 0.8,
          y: yPos,
          w: 8.4,
          h: 0.55,
          fill: { color: 'F1F5F9' },
          line: { color: 'CBD5E1', width: 1 }
        });

        slide.addText(`${sub.key})`, {
          x: 0.9,
          y: yPos + 0.05,
          w: 0.4,
          h: 0.45,
          fontSize: 13,
          bold: true,
          color: '0D9488'
        });

        slide.addText(cleanLatexForPptx(sub.text), {
          x: 1.4,
          y: yPos + 0.05,
          w: 6.5,
          h: 0.45,
          fontSize: 12,
          color: '1E293B'
        });

        if (options.includeAnswers) {
          slide.addText(sub.correct ? 'ĐÚNG' : 'SAI', {
            x: 8.0,
            y: yPos + 0.05,
            w: 1.1,
            h: 0.45,
            fontSize: 11,
            bold: true,
            color: sub.correct ? '15803D' : 'B91C1C',
            align: 'right'
          });
        }
      });
    } else {
      // Fill blank or Essay
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.8,
        y: 2.8,
        w: 8.4,
        h: 1.8,
        fill: { color: 'F1F5F9' },
        line: { color: 'CBD5E1', width: 1 }
      });

      slide.addText(
        options.includeAnswers && q.acceptableAnswers?.length
          ? `Đáp án chấp nhận: ${q.acceptableAnswers.join(', ')}`
          : 'Thí sinh trả lời trực tiếp hoặc điền vào phiếu trả lời.',
        {
          x: 1.0,
          y: 3.2,
          w: 8.0,
          h: 1.0,
          fontSize: 14,
          color: '475569',
          italic: true
        }
      );
    }
  });

  // Save the PPTX file
  const safeFilename = `${exam.title || 'De_thi'}_Trinh_chieu.pptx`
    .replace(/[^a-zA-Z0-9_\-\. ]/g, '_');
  await pptx.writeFile({ fileName: safeFilename });
}
