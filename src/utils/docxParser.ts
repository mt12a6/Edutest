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

  return parseDocxFile(file);
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
