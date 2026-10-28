import mammoth from 'mammoth';
import { ParsedDocxQuestion, QuestionType, TrueFalseItem } from '../types';
import { normalizeMathFormulas } from './mathFormatter';

export interface ExamParseResult {
  questions: ParsedDocxQuestion[];
  rawText: string;
  detectedTitle?: string;
  detectedGrade?: string;
  detectedSubject?: string;
}

/**
 * Universal file parser for .docx and .pdf exam files.
 * Extracts text, options, answers, explanations, embedded images (drawings/diagrams),
 * and converts mathematical notation into standard LaTeX ($...$) for KaTeX rendering.
 */
export async function parseExamFile(file: File): Promise<ExamParseResult> {
  const fileNameLower = file.name.toLowerCase();

  if (fileNameLower.endsWith('.pdf')) {
    return parsePdfFile(file);
  }

  if (fileNameLower.endsWith('.json')) {
    return parseJsonFile(file);
  }

  if (fileNameLower.endsWith('.tex') || fileNameLower.endsWith('.latex')) {
    return parseLatexFile(file);
  }

  return parseDocxFile(file);
}

/**
 * Parses LaTeX (.tex) exam files (ex_test, dethi, and standard Vietnamese LaTeX packages)
 */
export async function parseLatexFile(file: File): Promise<ExamParseResult> {
  const text = await file.text();
  
  // Extract title if present
  let detectedTitle = file.name.replace(/\.(tex|latex)$/i, '');
  const titleMatch = text.match(/\\title\s*\{([^}]+)\}/i);
  if (titleMatch) {
    detectedTitle = titleMatch[1].trim();
  }

  // Detect grade and subject
  let detectedGrade = '12';
  if (/Lớp\s*10|10\s*THPT/i.test(text)) detectedGrade = '10';
  else if (/Lớp\s*11|11\s*THPT/i.test(text)) detectedGrade = '11';
  else if (/Lớp\s*12|12\s*THPT/i.test(text)) detectedGrade = '12';

  let detectedSubject = 'Toán';
  if (/Vật\s*l[ií]|Vật lý/i.test(text)) detectedSubject = 'Vật lí';
  else if (/Hóa\s*học|Hóa/i.test(text)) detectedSubject = 'Hóa học';
  else if (/Sinh\s*học|Sinh/i.test(text)) detectedSubject = 'Sinh học';
  else if (/Lịch\s*sử|Sử/i.test(text)) detectedSubject = 'Lịch sử';
  else if (/Địa\s*l[ií]|Địa lý/i.test(text)) detectedSubject = 'Địa lí';
  else if (/Tiếng\s*Anh|English/i.test(text)) detectedSubject = 'Tiếng Anh';

  // Helper to extract balanced curly braces { ... }
  const extractBraceBlocks = (str: string, maxCount = 4): string[] => {
    const blocks: string[] = [];
    let i = 0;
    while (i < str.length && blocks.length < maxCount) {
      if (str[i] === '{') {
        let depth = 1;
        let start = i + 1;
        let j = start;
        while (j < str.length && depth > 0) {
          if (str[j] === '{' && str[j - 1] !== '\\') depth++;
          else if (str[j] === '}' && str[j - 1] !== '\\') depth--;
          j++;
        }
        if (depth === 0) {
          blocks.push(str.slice(start, j - 1).trim());
          i = j;
          continue;
        }
      }
      i++;
    }
    return blocks;
  };

  // Helper to clean LaTeX formatting artifacts while keeping math formulas intact
  const cleanLatexText = (raw: string): string => {
    return raw
      .replace(/\\textbf\{([^}]+)\}/g, '$1')
      .replace(/\\textit\{([^}]+)\}/g, '$1')
      .replace(/\\text\{([^}]+)\}/g, '$1')
      .replace(/\\noindent\s*/g, '')
      .replace(/\\centering\s*/g, '')
      .replace(/\\\\/g, '\n')
      .replace(/\\par\s*/g, '\n')
      .trim();
  };

  const rawBlocks: string[] = [];

  // Match \begin{ex}...\end{ex} or \begin{cau}...\end{cau}
  const envRegex = /\\begin\{(?:ex|cau|question)\}([\s\S]*?)\\end\{(?:ex|cau|question)\}/gi;
  let match;
  while ((match = envRegex.exec(text)) !== null) {
    rawBlocks.push(match[1]);
  }

  // Fallback: If no environments matched, split by \item or "Câu X:"
  if (rawBlocks.length === 0) {
    const lines = text.split('\n');
    let currentBlock = '';
    for (const line of lines) {
      if (/^\\s*(\\item|Câu\s*\d+[:.]|Bài\s*\d+[:.])/i.test(line)) {
        if (currentBlock.trim()) rawBlocks.push(currentBlock);
        currentBlock = line + '\n';
      } else {
        currentBlock += line + '\n';
      }
    }
    if (currentBlock.trim()) rawBlocks.push(currentBlock);
  }

  const questions: ParsedDocxQuestion[] = [];

  rawBlocks.forEach((block, idx) => {
    const qNum = idx + 1;
    let explanation = '';
    let workBlock = block;

    // Extract \loigiai{...}
    const loigiaiIdx = workBlock.indexOf('\\loigiai');
    if (loigiaiIdx !== -1) {
      const rest = workBlock.slice(loigiaiIdx + 8);
      const extracted = extractBraceBlocks(rest, 1);
      if (extracted.length > 0) {
        explanation = cleanLatexText(extracted[0]);
      }
      workBlock = workBlock.slice(0, loigiaiIdx);
    }

    // 1. Check for True/False (\choiceTF)
    const choiceTFIdx = workBlock.indexOf('\\choiceTF');
    if (choiceTFIdx !== -1) {
      const promptPart = cleanLatexText(workBlock.slice(0, choiceTFIdx));
      const rest = workBlock.slice(choiceTFIdx + 9);
      const subItems = extractBraceBlocks(rest, 4);
      const keys: Array<'a' | 'b' | 'c' | 'd'> = ['a', 'b', 'c', 'd'];
      const subQuestions: TrueFalseItem[] = subItems.map((rawSub, sIdx) => {
        const isTrue = /\\True/i.test(rawSub);
        const cleanedSub = cleanLatexText(rawSub.replace(/\\(?:True|False)\s*/gi, ''));
        const optKey: 'a' | 'b' | 'c' | 'd' = keys[sIdx] || 'a';
        return {
          key: optKey,
          text: normalizeMathFormulas(cleanedSub),
          correct: isTrue
        };
      });

      questions.push({
        questionNumber: qNum,
        type: 'true_false',
        prompt: normalizeMathFormulas(promptPart || `Câu ${qNum}`),
        subQuestions,
        explanation: normalizeMathFormulas(explanation),
        points: 1.0,
        warnings: []
      });
      return;
    }

    // 2. Check for Short Answer (\shortans{...})
    const shortansMatch = workBlock.match(/\\shortans\s*\{([^}]+)\}/i);
    if (shortansMatch) {
      const ansVal = cleanLatexText(shortansMatch[1]);
      const promptPart = cleanLatexText(workBlock.replace(/\\shortans\s*\{[^}]+\}/i, ''));
      questions.push({
        questionNumber: qNum,
        type: 'fill_blank',
        prompt: normalizeMathFormulas(promptPart || `Câu ${qNum}`),
        acceptableAnswers: [ansVal],
        explanation: normalizeMathFormulas(explanation),
        points: 0.5,
        warnings: []
      });
      return;
    }

    // 3. Check for 4 Choices (\choice, \motcot, \haicot, \boncot)
    const choiceMatch = workBlock.match(/\\(?:choice|motcot|haicot|boncot)/i);
    if (choiceMatch && choiceMatch.index !== undefined) {
      const promptPart = cleanLatexText(workBlock.slice(0, choiceMatch.index));
      const rest = workBlock.slice(choiceMatch.index + choiceMatch[0].length);
      const rawOptions = extractBraceBlocks(rest, 4);

      let correctOpt: 'A' | 'B' | 'C' | 'D' | undefined = undefined;
      const optKeys: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
      const options: Record<'A' | 'B' | 'C' | 'D', string> = { A: '', B: '', C: '', D: '' };

      rawOptions.forEach((optText, oIdx) => {
        const k = optKeys[oIdx];
        if (!k) return;
        if (/\\True/i.test(optText)) {
          correctOpt = k;
        }
        options[k] = normalizeMathFormulas(cleanLatexText(optText.replace(/\\(?:True|False)\s*/gi, '')));
      });

      questions.push({
        questionNumber: qNum,
        type: 'multiple_choice',
        prompt: normalizeMathFormulas(promptPart || `Câu ${qNum}`),
        options,
        correctOption: correctOpt,
        explanation: normalizeMathFormulas(explanation),
        points: 0.25,
        warnings: !correctOpt ? ['Chưa phát hiện đáp án \\True trong các phương án.'] : []
      });
      return;
    }

    // 4. Default to Essay or Plain Text
    const promptClean = cleanLatexText(workBlock);
    questions.push({
      questionNumber: qNum,
      type: 'essay',
      prompt: normalizeMathFormulas(promptClean || `Câu ${qNum}: Bài tập tự luận`),
      sampleAnswer: explanation ? normalizeMathFormulas(explanation) : undefined,
      explanation: normalizeMathFormulas(explanation),
      points: 2.0,
      warnings: []
    });
  });

  return {
    questions,
    rawText: text,
    detectedTitle,
    detectedGrade,
    detectedSubject
  };
}

/**
 * Parses a .json File object (Azota / EduTest JSON export standard)
 */
export async function parseJsonFile(file: File): Promise<ExamParseResult> {
  const text = await file.text();
  try {
    const json = JSON.parse(text);
    const title = json.title || file.name.replace(/\.json$/i, '');
    const grade = String(json.grade || '6');
    const subject = json.subject || 'Toán';
    let rawList: any[] = [];

    if (Array.isArray(json)) {
      rawList = json;
    } else if (Array.isArray(json.questions)) {
      rawList = json.questions;
    } else if (json.data && Array.isArray(json.data.questions)) {
      rawList = json.data.questions;
    }

    const questions: ParsedDocxQuestion[] = rawList.map((q, idx) => ({
      questionNumber: q.questionNumber || idx + 1,
      type: q.type || 'multiple_choice',
      prompt: normalizeMathFormulas(q.prompt || `Câu hỏi ${idx + 1}`),
      imageUrl: q.imageUrl,
      options: q.options ? {
        A: normalizeMathFormulas(q.options.A || ''),
        B: normalizeMathFormulas(q.options.B || ''),
        C: normalizeMathFormulas(q.options.C || ''),
        D: normalizeMathFormulas(q.options.D || '')
      } : undefined,
      correctOption: q.correctOption,
      subQuestions: q.subQuestions ? q.subQuestions.map((s: any) => ({
        ...s,
        text: normalizeMathFormulas(s.text || '')
      })) : undefined,
      acceptableAnswers: q.acceptableAnswers,
      explanation: normalizeMathFormulas(q.explanation || ''),
      points: q.points || 1,
      warnings: []
    }));

    return {
      questions,
      rawText: text,
      detectedTitle: title,
      detectedGrade: grade,
      detectedSubject: subject
    };
  } catch (err: any) {
    throw new Error('Tệp JSON không đúng định dạng đề thi chuẩn: ' + (err?.message || 'Lỗi cú pháp'));
  }
}

/**
 * Parses a .docx File object into structured questions with math formatting & images
 */
export async function parseDocxFile(file: File): Promise<ExamParseResult> {
  const arrayBuffer = await file.arrayBuffer();

  // Extract both HTML (with embedded images as base64 data URIs) and raw text using mammoth
  const [htmlResult, textResult] = await Promise.all([
    (mammoth as any).convertToHtml(
      { arrayBuffer },
      {
        convertImage: (mammoth as any).images.imgElement(async (element: any) => {
          const imageBuffer = await element.read('base64');
          return {
            src: `data:${element.contentType || 'image/png'};base64,${imageBuffer}`
          };
        })
      }
    ),
    mammoth.extractRawText({ arrayBuffer })
  ]);

  const rawHtml = htmlResult.value;
  const rawText = textResult.value;

  const questions = parseExamTextAndHtml(rawText, rawHtml);

  // Attempt to extract title from first few lines if available
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  let detectedTitle = '';
  if (lines.length > 0 && !lines[0].toLowerCase().startsWith('câu') && !lines[0].toLowerCase().startsWith('question')) {
    detectedTitle = lines[0];
  }

  // Detect grade and subject hints from text
  let detectedGrade = '6';
  const gradeMatch = rawText.match(/(?:Lớp|Khối|Grade)\s*([0-9]{1,2})\b/i);
  if (gradeMatch) detectedGrade = gradeMatch[1];

  let detectedSubject = 'Toán';
  if (/tin\s*học|tin\s*học\s*[6-9]|lập\s*trình|scratch|python|pascal|máy\s*tính/i.test(rawText)) {
    detectedSubject = 'Tin học';
  } else if (/khoa\s*học\s*tự\s*nhiên|khtn|vật\s*lý|hóa\s*học|sinh\s*học/i.test(rawText)) {
    detectedSubject = 'Khoa học tự nhiên';
  }

  return {
    questions,
    rawText,
    detectedTitle: detectedTitle || file.name.replace(/\.[^/.]+$/, ''),
    detectedGrade,
    detectedSubject
  };
}

/**
 * Parses a .pdf File object using the multimodal Gemini API endpoint
 */
export async function parsePdfFile(file: File): Promise<ExamParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const fileBase64 = btoa(binary);

  try {
    const response = await fetch('/api/parse-exam', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileBase64,
        fileName: file.name,
        mimeType: 'application/pdf'
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Máy chủ không thể phân tích file PDF.');
    }

    const data = result.data;
    const questions: ParsedDocxQuestion[] = (data.questions || []).map((q: any, idx: number) => ({
      questionNumber: q.questionNumber || idx + 1,
      type: q.type || 'multiple_choice',
      prompt: normalizeMathFormulas(q.prompt || `Câu hỏi ${idx + 1}`),
      options: q.options ? {
        A: normalizeMathFormulas(q.options.A || ''),
        B: normalizeMathFormulas(q.options.B || ''),
        C: normalizeMathFormulas(q.options.C || ''),
        D: normalizeMathFormulas(q.options.D || '')
      } : undefined,
      correctOption: q.correctOption,
      subQuestions: q.subQuestions ? q.subQuestions.map((s: any) => ({
        ...s,
        text: normalizeMathFormulas(s.text || '')
      })) : undefined,
      acceptableAnswers: q.acceptableAnswers,
      explanation: normalizeMathFormulas(q.explanation || ''),
      points: q.points || 1,
      warnings: []
    }));

    return {
      questions,
      rawText: `[Đã phân tích từ PDF: ${file.name}]`,
      detectedTitle: data.title || file.name.replace(/\.pdf$/i, ''),
      detectedGrade: data.grade || '6',
      detectedSubject: data.subject || 'Toán'
    };
  } catch (err: any) {
    console.warn('Lỗi gọi API parse PDF:', err);
    throw new Error(err.message || 'Không thể bóc tách file PDF bằng AI. Vui lòng kiểm tra lại file hoặc sử dụng định dạng file Word (.docx).');
  }
}

/**
 * Core parser supporting multiple Vietnamese & International exam formatting standards
 */
export function parseExamTextAndHtml(rawText: string, rawHtml: string): ParsedDocxQuestion[] {
  // 1. Answer key map from table or bottom section
  const answerKeyMap = extractAnswerKeyMap(rawText);

  // 2. Bold/underlined options in HTML (teacher markers)
  const htmlCorrectMap = extractHtmlCorrectMap(rawHtml);

  // 3. Question-to-image mapping from HTML structure
  const questionImageMap = extractHtmlQuestionImages(rawHtml);
  const fallbackImages = extractAllHtmlImages(rawHtml);

  // Split text into question blocks
  // Regex to match question start: "Câu 1:", "Câu 1.", "Câu 1 -", "Question 1:", "Bài 1:"
  const questionRegex = /(?:^|\n)\s*(?:Câu|CÂU|Question|Bài)\s*([0-9]+)\s*[:.\-–]\s*/gi;

  const matches: Array<{ index: number; questionNumber: number }> = [];
  let match;
  while ((match = questionRegex.exec(rawText)) !== null) {
    matches.push({
      index: match.index,
      questionNumber: parseInt(match[1], 10)
    });
  }

  const parsedQuestions: ParsedDocxQuestion[] = [];

  if (matches.length > 0) {
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const nextIndex = i + 1 < matches.length ? matches[i + 1].index : rawText.length;
      const chunk = rawText.slice(current.index, nextIndex);
      // Prioritize image belonging directly to this question block
      const attachedImage = questionImageMap.get(current.questionNumber) || fallbackImages[i] || undefined;
      const parsed = parseSingleQuestionChunk(chunk, current.questionNumber, answerKeyMap, htmlCorrectMap, attachedImage);
      parsedQuestions.push(parsed);
    }
  } else {
    // Fallback: try parsing with number dot pattern "1.", "2.", "3."
    const numberMatches: Array<{ index: number; questionNumber: number }> = [];
    const numRegex = /(?:^|\n)\s*([0-9]+)\s*[\.\)]\s+(?=[A-ZÀ-Ỹa-z])/g;
    while ((match = numRegex.exec(rawText)) !== null) {
      numberMatches.push({
        index: match.index,
        questionNumber: parseInt(match[1], 10)
      });
    }

    if (numberMatches.length > 0) {
      for (let i = 0; i < numberMatches.length; i++) {
        const current = numberMatches[i];
        const nextIndex = i + 1 < numberMatches.length ? numberMatches[i + 1].index : rawText.length;
        const chunk = rawText.slice(current.index, nextIndex);
        const attachedImage = questionImageMap.get(current.questionNumber) || fallbackImages[i] || undefined;
        const parsed = parseSingleQuestionChunk(chunk, current.questionNumber, answerKeyMap, htmlCorrectMap, attachedImage);
        parsedQuestions.push(parsed);
      }
    }
  }

  return parsedQuestions;
}

function parseSingleQuestionChunk(
  chunk: string,
  qNumber: number,
  answerKeyMap: Map<number, 'A' | 'B' | 'C' | 'D'>,
  htmlCorrectMap: Map<number, 'A' | 'B' | 'C' | 'D'>,
  attachedImage?: string
): ParsedDocxQuestion {
  const warnings: string[] = [];

  // Remove question prefix e.g. "Câu 1: "
  const cleanChunk = chunk.replace(/^\s*(?:Câu|CÂU|Question|Bài)?\s*[0-9]+\s*[:.\-–]\s*/i, '').trim();

  // Extract Explanation / Lời giải if present
  let promptAndOptions = cleanChunk;
  let explanation = '';

  const explanationMatch = promptAndOptions.match(/(?:Lời giải|Hướng dẫn giải|Giải thích|Explanation)\s*[:.\-–]\s*([\s\S]*)$/i);
  if (explanationMatch && explanationMatch.index !== undefined) {
    explanation = explanationMatch[1].trim();
    promptAndOptions = promptAndOptions.substring(0, explanationMatch.index).trim();
  }

  // 1. Detect if this is a True / False question (4 sub-items a, b, c, d)
  const isTrueFalseFormat = /(?:đúng\s*[\/\-]\s*sai|đúng\s*hay\s*sai|khẳng định nào sau đây)/i.test(promptAndOptions) ||
    (/(?:^|\n)\s*[a-d]\s*[\)\.]/i.test(promptAndOptions) && !/(?:^|\n)\s*[A-D]\s*[\)\.]/i.test(promptAndOptions));

  if (isTrueFalseFormat) {
    const tfResult = parseTrueFalseQuestion(promptAndOptions, qNumber, explanation, attachedImage);
    if (tfResult) return tfResult;
  }

  // 2. Detect if this is a Fill-in-the-blank (Trả lời ngắn / Điền kết quả)
  const isFillBlankFormat = /(?:điền\s*kết\s*quả|trả\s*lời\s*ngắn|kết\s*quả\s*bằng|đáp\s*số\s*:)/i.test(promptAndOptions) &&
    !/(?:^|\s)[A-D]\s*[\.\)]/i.test(promptAndOptions);

  if (isFillBlankFormat) {
    return parseFillBlankQuestion(promptAndOptions, qNumber, explanation, attachedImage);
  }

  // 3. Detect if this is an Essay question (Tự luận)
  const isEssayFormat = /(?:tự\s*luận|chứng\s*minh\s*rằng|hãy\s*giải\s*thích|bài\s*toán\s*sau)/i.test(promptAndOptions) &&
    !/(?:^|\s)[A-D]\s*[\.\)]/i.test(promptAndOptions);

  if (isEssayFormat) {
    return {
      questionNumber: qNumber,
      type: 'essay',
      prompt: normalizeMathFormulas(promptAndOptions),
      imageUrl: attachedImage,
      explanation: normalizeMathFormulas(explanation),
      points: 2,
      warnings: []
    };
  }

  // 4. Default: Multiple Choice 4 options (A, B, C, D)
  const optionRegex = /(?:^|\s|\n)(\*|\[x\]|\(\*\))?\s*([A-D])\s*[\.\)]\s*([^\n\r]+?)(?=(?:\s+(\*|\[x\]|\(\*\))?\s*[A-D]\s*[\.\)]|\n\s*(\*|\[x\]|\(\*\))?\s*[A-D]\s*[\.\)]|$))/gi;

  const foundOptions: Record<'A' | 'B' | 'C' | 'D', string> = {
    A: '',
    B: '',
    C: '',
    D: ''
  };

  let detectedCorrectFromAsterisk: 'A' | 'B' | 'C' | 'D' | undefined = undefined;

  const firstOptionIndex = promptAndOptions.search(/(?:^|\s|\n)(?:\*|\[x\]|\(\*\))?\s*[A-D]\s*[\.\)]/i);
  let promptText = '';

  if (firstOptionIndex !== -1) {
    promptText = promptAndOptions.substring(0, firstOptionIndex).trim();
    const optionsSection = promptAndOptions.substring(firstOptionIndex);

    let optMatch;
    while ((optMatch = optionRegex.exec(optionsSection)) !== null) {
      const marker = optMatch[1];
      const optKey = optMatch[2].toUpperCase() as 'A' | 'B' | 'C' | 'D';
      const optText = optMatch[3].trim();

      if (['A', 'B', 'C', 'D'].includes(optKey)) {
        foundOptions[optKey] = normalizeMathFormulas(optText);
        if (marker && (marker.includes('*') || marker.includes('[x]'))) {
          detectedCorrectFromAsterisk = optKey;
        }
      }
    }
  } else {
    promptText = promptAndOptions;
    warnings.push('Không tìm thấy các lựa chọn A, B, C, D theo định dạng chuẩn.');
  }

  let correctOption = detectedCorrectFromAsterisk 
    || htmlCorrectMap.get(qNumber) 
    || answerKeyMap.get(qNumber);

  if (!foundOptions.A || !foundOptions.B || !foundOptions.C || !foundOptions.D) {
    warnings.push('Một số đáp án A/B/C/D bị thiếu hoặc định dạng chưa đúng.');
  }

  if (!correctOption) {
    warnings.push('Chưa xác định được đáp án đúng từ tệp Word. Vui lòng chọn đáp án thủ công.');
  }

  return {
    questionNumber: qNumber,
    type: 'multiple_choice',
    prompt: normalizeMathFormulas(promptText || `Câu hỏi số ${qNumber}`),
    imageUrl: attachedImage,
    options: foundOptions,
    correctOption,
    explanation: normalizeMathFormulas(explanation),
    points: 1,
    isAmbiguous: warnings.length > 0,
    warnings
  };
}

function parseTrueFalseQuestion(
  text: string, 
  qNumber: number, 
  explanation: string, 
  attachedImage?: string
): ParsedDocxQuestion | null {
  const itemRegex = /(?:^|\n|\s*)([a-d])\s*[\)\.]\s*([^\n]+)/gi;
  const subQuestions: TrueFalseItem[] = [];

  let match;
  while ((match = itemRegex.exec(text)) !== null) {
    const key = match[1].toLowerCase() as 'a' | 'b' | 'c' | 'd';
    let statement = match[2].trim();

    let isCorrect = true;
    if (/(?:\[S\]|\(Sai\)|\bSai\b|\bS\b)$/i.test(statement)) {
      isCorrect = false;
      statement = statement.replace(/(?:\[S\]|\(Sai\)|\bSai\b|\bS\b)$/i, '').trim();
    } else if (/(?:\[Đ\]|\[D\]|\(Đúng\)|\(Dung\)|\bĐúng\b|\bĐ\b)$/i.test(statement)) {
      isCorrect = true;
      statement = statement.replace(/(?:\[Đ\]|\[D\]|\(Đúng\)|\(Dung\)|\bĐúng\b|\bĐ\b)$/i, '').trim();
    }

    subQuestions.push({ key, text: normalizeMathFormulas(statement), correct: isCorrect });
  }

  if (subQuestions.length >= 2) {
    const firstIdx = text.search(/(?:^|\n|\s*)[a-d]\s*[\)\.]/i);
    const prompt = firstIdx !== -1 ? text.substring(0, firstIdx).trim() : 'Chọn Đúng hoặc Sai cho mỗi ý kiến sau:';

    return {
      questionNumber: qNumber,
      type: 'true_false',
      prompt: normalizeMathFormulas(prompt || `Câu hỏi Đúng/Sai số ${qNumber}`),
      imageUrl: attachedImage,
      subQuestions,
      explanation: normalizeMathFormulas(explanation),
      points: 1,
      warnings: subQuestions.length < 4 ? ['Câu hỏi Đúng/Sai có ít hơn 4 ý. Đã tự động nhận diện các ý có sẵn.'] : []
    };
  }

  return null;
}

function parseFillBlankQuestion(
  text: string, 
  qNumber: number, 
  explanation: string, 
  attachedImage?: string
): ParsedDocxQuestion {
  const answerMatch = text.match(/(?:Đáp số|Kết quả|Đáp án)\s*[:.\-–]\s*([^\n\r]+)/i);
  const acceptableAnswers: string[] = [];

  let prompt = text;
  if (answerMatch && answerMatch.index !== undefined) {
    const rawAns = answerMatch[1].trim();
    acceptableAnswers.push(rawAns);
    if (rawAns.includes('.')) acceptableAnswers.push(rawAns.replace('.', ','));
    if (rawAns.includes(',')) acceptableAnswers.push(rawAns.replace(',', '.'));
    prompt = text.substring(0, answerMatch.index).trim();
  }

  return {
    questionNumber: qNumber,
    type: 'fill_blank',
    prompt: normalizeMathFormulas(prompt),
    imageUrl: attachedImage,
    acceptableAnswers: acceptableAnswers.length > 0 ? acceptableAnswers : [''],
    explanation: normalizeMathFormulas(explanation),
    points: 1,
    warnings: acceptableAnswers.length === 0 ? ['Chưa tìm thấy đáp án kết quả mẫu. Vui lòng nhập đáp số đúng thủ công.'] : []
  };
}

function extractAnswerKeyMap(text: string): Map<number, 'A' | 'B' | 'C' | 'D'> {
  const map = new Map<number, 'A' | 'B' | 'C' | 'D'>();
  const answerKeySectionRegex = /(?:BẢNG ĐÁP ÁN|ĐÁP ÁN|ANSWER KEY|KEY)\s*[:\n]([\s\S]*)$/i;
  const match = text.match(answerKeySectionRegex);
  if (!match) return map;

  const keyText = match[1];
  const itemRegex = /(?:Câu\s*)?([0-9]+)\s*[:.\-–\s]\s*([A-D])\b/gi;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(keyText)) !== null) {
    const qNum = parseInt(itemMatch[1], 10);
    const key = itemMatch[2].toUpperCase() as 'A' | 'B' | 'C' | 'D';
    map.set(qNum, key);
  }
  return map;
}

function extractHtmlCorrectMap(html: string): Map<number, 'A' | 'B' | 'C' | 'D'> {
  const map = new Map<number, 'A' | 'B' | 'C' | 'D'>();
  // Match bold/underline options in HTML: <strong>A.</strong> or <u>A.</u> or <b>A.</b>
  const boldOptRegex = /(?:<strong>|<b>|<u>)\s*([A-D])\s*[\.\)]\s*(?:<\/strong>|<\/b>|<\/u>)/gi;
  // Also question block tracking
  const qHtmlRegex = /(?:^|>|\n)\s*(?:<[^>]+>)*\s*(?:Câu|CÂU|Question|Bài)\s*([0-9]+)\s*[:.\-–]/gi;
  
  const matches: Array<{ qNum: number; index: number }> = [];
  let m;
  while ((m = qHtmlRegex.exec(html)) !== null) {
    matches.push({ qNum: parseInt(m[1], 10), index: m.index });
  }

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const nextIdx = i + 1 < matches.length ? matches[i + 1].index : html.length;
    const chunkHtml = html.slice(cur.index, nextIdx);
    const boldMatch = chunkHtml.match(boldOptRegex);
    if (boldMatch) {
      const charMatch = boldMatch[0].match(/([A-D])/i);
      if (charMatch) {
        map.set(cur.qNum, charMatch[1].toUpperCase() as 'A' | 'B' | 'C' | 'D');
      }
    }
  }

  return map;
}

function extractHtmlQuestionImages(html: string): Map<number, string> {
  const map = new Map<number, string>();
  const qHtmlRegex = /(?:^|>|\n)\s*(?:<[^>]+>)*\s*(?:Câu|CÂU|Question|Bài)\s*([0-9]+)\s*[:.\-–]/gi;
  
  const matches: Array<{ qNum: number; index: number }> = [];
  let m;
  while ((m = qHtmlRegex.exec(html)) !== null) {
    matches.push({ qNum: parseInt(m[1], 10), index: m.index });
  }

  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/i;

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const nextIdx = i + 1 < matches.length ? matches[i + 1].index : html.length;
    const chunkHtml = html.slice(cur.index, nextIdx);
    const imgMatch = chunkHtml.match(imgRegex);
    if (imgMatch) {
      map.set(cur.qNum, imgMatch[1]);
    }
  }

  return map;
}

function extractAllHtmlImages(html: string): string[] {
  const images: string[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    images.push(match[1]);
  }
  return images;
}
