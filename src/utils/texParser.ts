import { Question, QuestionType, TrueFalseItem } from '../types';

export interface ParsedTexResult {
  title: string;
  grade: string;
  subjectName: string;
  durationMinutes: number;
  questions: Question[];
  warnings: string[];
}

/**
 * Remove comments while preserving escaped \%.
 */
function stripTexComments(tex: string): string {
  return tex
    .split('\n')
    .map(line => {
      // Find comment % not preceded by \
      let inComment = false;
      let cleaned = '';
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '%' && (i === 0 || line[i - 1] !== '\\')) {
          inComment = true;
          break;
        }
        cleaned += char;
      }
      return inComment ? cleaned : line;
    })
    .join('\n');
}

/**
 * Extract balanced curly braces content from a string starting at index.
 * Returns { content, endIndex }
 */
function extractBalancedBraces(text: string, startIndex: number): { content: string; endIndex: number } | null {
  const openIndex = text.indexOf('{', startIndex);
  if (openIndex === -1) return null;

  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === '{' && (i === 0 || text[i - 1] !== '\\')) {
      depth++;
    } else if (text[i] === '}' && (i === 0 || text[i - 1] !== '\\')) {
      depth--;
      if (depth === 0) {
        return {
          content: text.slice(openIndex + 1, i),
          endIndex: i + 1
        };
      }
    }
  }
  return null;
}

/**
 * Extract 4 choices from a \choice or \choiceTF command, with support for:
 * - \choice{A}{B}{C}{D}
 * - \choice[!]{A}{B}{C}{D} or \choice[2]{A}{B}{C}{D}
 * - \choice \newline {A} {B} {C} {D}
 * - \True A or !A
 * - Fallback to A. B. C. D.
 */
function extractFourChoices(choiceBody: string): { text: string; isCorrect: boolean }[] {
  const choices: { text: string; isCorrect: boolean }[] = [];
  
  // Strip optional arguments like [!] or [2] directly after \choice
  let cleanBody = choiceBody.replace(/^\s*\[[^\]]*\]/, '').trim();
  let currentIndex = 0;

  for (let c = 0; c < 4; c++) {
    const res = extractBalancedBraces(cleanBody, currentIndex);
    if (!res) break;

    let content = res.content.trim();
    let isCorrect = false;

    // Check if \True is present
    if (/\\True\b/i.test(content)) {
      isCorrect = true;
      content = content.replace(/\\True\s*/gi, '').trim();
    } else if (content.startsWith('!')) {
      isCorrect = true;
      content = content.slice(1).trim();
    }

    // Auto-normalize math inside choice if bare
    if (!content.includes('$') && /\\(dfrac|frac|sqrt|vec|sin|cos|tan|cot|pi|alpha|beta|mathbb)\b/.test(content)) {
      content = `$${content}$`;
    }

    choices.push({ text: content, isCorrect });
    currentIndex = res.endIndex;
  }

  // Fallback: If less than 4 braces choices, attempt matching A. ... B. ... C. ... D. ...
  if (choices.length < 4) {
    const abcdRegex = /(?:^|\s)(?:A|B|C|D)[\.\)]\s*([\s\S]*?)(?=(?:^|\s)(?:[A-D][\.\)]|\\loigiai|$))/gi;
    const fallbackMatches: { text: string; isCorrect: boolean }[] = [];
    let m: RegExpExecArray | null;
    while ((m = abcdRegex.exec(choiceBody)) !== null && fallbackMatches.length < 4) {
      let optText = m[1].trim();
      let isCorrect = false;
      if (/\\True\b/i.test(optText)) {
        isCorrect = true;
        optText = optText.replace(/\\True\s*/gi, '').trim();
      }
      fallbackMatches.push({ text: optText, isCorrect });
    }
    if (fallbackMatches.length === 4) {
      return fallbackMatches;
    }
  }

  return choices;
}

/**
 * Clean and normalize question prompt:
 * - Replace TikZ/PSTricks graphics with a readable badge
 * - Transform \heva and \hoac
 * - Wrap bare \begin{aligned} in $$
 */
function normalizePrompt(rawPrompt: string): string {
  if (!rawPrompt) return '';
  let p = rawPrompt;

  // Clean TikZ
  p = p.replace(
    /\\begin\{(tikzpicture|pspicture)\}[\s\S]*?\\end\{\1\}/gi,
    '\n[Hình vẽ minh họa LaTeX TikZ]\n'
  );

  // Transform \heva and \hoac
  p = p.replace(/\\heva\{([^{}]+)\}/g, '$\\begin{cases} $1 \\end{cases}$');
  p = p.replace(/\\hoac\{([^{}]+)\}/g, '$\\left[ \\begin{array}{l} $1 \\end{array} \\right.$');

  // Multi-letter vector fix
  p = p.replace(/\\vec\{([A-Za-z]{2,})\}/g, '\\overrightarrow{$1}');

  return p.trim();
}

/**
 * Main parser for LaTeX (.tex) exam files
 */
export function parseTexExamContent(rawTex: string): ParsedTexResult {
  const warnings: string[] = [];
  let cleaned = stripTexComments(rawTex);

  // 1. Try to detect Exam Title, Subject, Grade, Duration
  let title = 'Đề thi nhập từ file LaTeX';
  let grade = '12';
  let subjectName = 'Toán học';
  let durationMinutes = 90;

  const titleMatch = cleaned.match(/\\title\{([^}]+)\}/i) || cleaned.match(/\\tieude\{([^}]+)\}/i);
  if (titleMatch) title = titleMatch[1].trim();

  if (/toán|toan/i.test(cleaned)) subjectName = 'Toán học';
  else if (/vật l[ýí]|vat ly/i.test(cleaned)) subjectName = 'Vật lí';
  else if (/hóa|hoa/i.test(cleaned)) subjectName = 'Hóa học';
  else if (/sinh|sinh hoc/i.test(cleaned)) subjectName = 'Sinh học';
  else if (/tiếng anh|anh/i.test(cleaned)) subjectName = 'Tiếng Anh';
  else if (/tin học|tin/i.test(cleaned)) subjectName = 'Tin học';

  const gradeMatch = cleaned.match(/khối\s*([0-9]{1,2})|lớp\s*([0-9]{1,2})/i);
  if (gradeMatch) grade = gradeMatch[1] || gradeMatch[2];

  const durationMatch = cleaned.match(/thời gian[:\s]*([0-9]{2,3})\s*phút/i);
  if (durationMatch) durationMinutes = parseInt(durationMatch[1], 10);

  // 2. Extract Question Blocks: Support ex, cau, cauhoi, bt, vd, question, exercise, problem
  const blockRegex = /\\begin\{(ex|cau|cauhoi|bt|vd|question|exercise|problem)\}([\s\S]*?)\\end\{\1\}/g;
  let match: RegExpExecArray | null;
  const rawBlocks: string[] = [];

  while ((match = blockRegex.exec(cleaned)) !== null) {
    rawBlocks.push(match[2].trim());
  }

  // Fallback: if no standard environment blocks, try splitting by \item or \textbf{Câu X} or Câu X:
  if (rawBlocks.length === 0) {
    const itemSplit = cleaned.split(/(?=\\item\s+|\\textbf\{Câu\s+[0-9]+|Câu\s+[0-9]+[:.]|Bài\s+[0-9]+[:.])/i).filter(b => b.trim().length > 10);
    if (itemSplit.length > 1) {
      rawBlocks.push(...itemSplit);
    }
  }

  const questions: Question[] = [];
  let questionNumber = 1;

  for (const block of rawBlocks) {
    let blockText = block;

    // Check explanation \loigiai{...}
    let explanation = '';
    const loigiaiMatch = blockText.match(/\\loigiai\{/);
    if (loigiaiMatch && loigiaiMatch.index !== undefined) {
      const braceRes = extractBalancedBraces(blockText, loigiaiMatch.index);
      if (braceRes) {
        explanation = braceRes.content.trim();
        blockText = blockText.slice(0, loigiaiMatch.index) + blockText.slice(braceRes.endIndex);
      }
    }

    // Determine type: True/False (\choiceTF) vs Multiple Choice (\choice) vs Fill Blank / Essay
    if (blockText.includes('\\choiceTF')) {
      // Phần II: Trắc nghiệm Đúng / Sai (4 ý a, b, c, d)
      const prompt = normalizePrompt(blockText.split('\\choiceTF')[0].trim());
      const choicePart = blockText.slice(blockText.indexOf('\\choiceTF') + 9);
      const subItems = extractFourChoices(choicePart);

      const subQuestions: TrueFalseItem[] = [
        { key: 'a', text: subItems[0]?.text || '', correct: subItems[0]?.isCorrect ?? false, points: 0.25 },
        { key: 'b', text: subItems[1]?.text || '', correct: subItems[1]?.isCorrect ?? false, points: 0.25 },
        { key: 'c', text: subItems[2]?.text || '', correct: subItems[2]?.isCorrect ?? false, points: 0.25 },
        { key: 'd', text: subItems[3]?.text || '', correct: subItems[3]?.isCorrect ?? false, points: 0.25 }
      ];

      questions.push({
        id: `q-tex-${questionNumber}`,
        examId: '',
        questionNumber,
        section: 2,
        type: 'true_false',
        prompt,
        subQuestions,
        explanation: normalizePrompt(explanation),
        points: 1.0,
        sectionTitle: 'Phần II: Câu trắc nghiệm đúng sai'
      });
    } else if (blockText.includes('\\choice')) {
      // Phần I: Trắc nghiệm 4 lựa chọn A, B, C, D
      const prompt = normalizePrompt(blockText.split('\\choice')[0].trim());
      const choicePart = blockText.slice(blockText.indexOf('\\choice') + 7);
      const fourChoices = extractFourChoices(choicePart);

      let correctOption: 'A' | 'B' | 'C' | 'D' | undefined = undefined;
      const optKeys: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
      const options: { A: string; B: string; C: string; D: string } = {
        A: fourChoices[0]?.text || '',
        B: fourChoices[1]?.text || '',
        C: fourChoices[2]?.text || '',
        D: fourChoices[3]?.text || ''
      };

      fourChoices.forEach((ch, idx) => {
        if (ch.isCorrect) correctOption = optKeys[idx];
      });

      questions.push({
        id: `q-tex-${questionNumber}`,
        examId: '',
        questionNumber,
        section: 1,
        type: 'multiple_choice',
        prompt,
        options,
        correctOption: correctOption || 'A',
        explanation: normalizePrompt(explanation),
        points: 0.25,
        sectionTitle: 'Phần I: Câu trắc nghiệm nhiều phương án lựa chọn'
      });
    } else if (blockText.includes('\\shortans')) {
      // Phần III: Trả lời ngắn
      const shortansMatch = blockText.match(/\\shortans\{([^}]+)\}/);
      const answer = shortansMatch ? shortansMatch[1].trim() : '';
      const prompt = normalizePrompt(blockText.replace(/\\shortans\{[^}]+\}/, '').trim());

      questions.push({
        id: `q-tex-${questionNumber}`,
        examId: '',
        questionNumber,
        section: 3,
        type: 'fill_blank',
        prompt,
        acceptableAnswers: answer ? [answer] : [],
        explanation: normalizePrompt(explanation),
        points: 0.5,
        sectionTitle: 'Phần III: Câu trắc nghiệm trả lời ngắn'
      });
    } else {
      // Phần IV: Tự luận
      questions.push({
        id: `q-tex-${questionNumber}`,
        examId: '',
        questionNumber,
        section: 4,
        type: 'essay',
        prompt: normalizePrompt(blockText.trim()),
        explanation: normalizePrompt(explanation),
        points: 1.0,
        sectionTitle: 'Phần IV: Tự luận'
      });
    }

    questionNumber++;
  }

  if (questions.length === 0) {
    warnings.push('Không tìm thấy cấu trúc câu hỏi chuẩn (\\begin{ex}...\\choice...\\end{ex}). Vui lòng kiểm tra lại định dạng file .tex.');
  }

  return {
    title,
    grade,
    subjectName,
    durationMinutes,
    questions,
    warnings
  };
}
