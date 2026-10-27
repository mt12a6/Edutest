import { Question, Exam, TrueFalseItem } from '../types';

/**
 * Normalizes text for comparison:
 * - Trims whitespace
 * - Strips extra internal whitespace
 * - Removes LaTeX dollar signs $
 * - Normalizes Vietnamese accents and lowercases
 */
export function normalizeAnswerText(val: any): string {
  if (val === undefined || val === null) return '';
  return String(val)
    .trim()
    .toLowerCase()
    .replace(/[\$\`]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Robustly checks if a Multiple Choice answer matches the correct option.
 * Handles:
 * - Direct letter match: 'A' === 'A', case-insensitive ('a' === 'A')
 * - Letter with punctuation: 'A.', 'A)', '(A)', '[A]' -> 'A'
 * - Option text matching: if student selected the text of option A or vice-versa
 */
export function isMultipleChoiceCorrect(
  studentAns: any,
  correctOption?: string,
  options?: Record<string, string>
): boolean {
  if (studentAns === undefined || studentAns === null || studentAns === '') return false;
  if (!correctOption) return false;

  const rawStudent = String(studentAns).trim();
  const rawCorrect = String(correctOption).trim();

  // 1. Direct match (e.g. 'A' === 'A', case-insensitive)
  if (rawStudent.toUpperCase() === rawCorrect.toUpperCase()) return true;

  // 2. Normalize single letter (A, B, C, D)
  const cleanStudentLetter = rawStudent.toUpperCase().replace(/[^A-D]/g, '');
  const cleanCorrectLetter = rawCorrect.toUpperCase().replace(/[^A-D]/g, '');

  if (
    cleanStudentLetter &&
    cleanCorrectLetter &&
    cleanStudentLetter === cleanCorrectLetter &&
    cleanStudentLetter.length === 1 &&
    cleanCorrectLetter.length === 1
  ) {
    return true;
  }

  // 3. If correctOption is a letter (A/B/C/D) and studentAns is the text of that option
  if (options && ['A', 'B', 'C', 'D'].includes(cleanCorrectLetter) && cleanCorrectLetter.length === 1) {
    const optText = options[cleanCorrectLetter as 'A' | 'B' | 'C' | 'D'];
    if (optText) {
      const normOptText = normalizeAnswerText(optText);
      const normStudent = normalizeAnswerText(rawStudent);
      if (normOptText === normStudent) return true;
    }
  }

  // 4. If studentAns is a letter (A/B/C/D) and correctOption is the text of that option
  if (options && ['A', 'B', 'C', 'D'].includes(cleanStudentLetter) && cleanStudentLetter.length === 1) {
    const optText = options[cleanStudentLetter as 'A' | 'B' | 'C' | 'D'];
    if (optText) {
      const normOptText = normalizeAnswerText(optText);
      const normCorrect = normalizeAnswerText(rawCorrect);
      if (normOptText === normCorrect) return true;
    }
  }

  // 5. If options text itself equals student answer and option key is correctOption
  if (options) {
    for (const key of ['A', 'B', 'C', 'D'] as const) {
      const text = options[key];
      if (text && normalizeAnswerText(text) === normalizeAnswerText(rawStudent)) {
        if (key === cleanCorrectLetter) return true;
      }
    }
  }

  return false;
}

/**
 * Robustly checks if a Fill-in-the-blank / Short answer is correct.
 * Handles:
 * - Comma vs Dot decimal separators (3.5 === 3,5)
 * - Numeric equivalence (3.50 === 3.5)
 * - Fractions (7/2 === 3.5)
 * - Prefixes like 'x = 3', 'Đáp số: 3'
 * - Mathematical formatting: spaces around operators
 */
export function isFillBlankCorrect(
  studentAns: any,
  acceptableAnswers?: string[],
  correctOption?: string,
  sampleAnswer?: string
): boolean {
  if (studentAns === undefined || studentAns === null || studentAns === '') return false;

  const rawStudent = String(studentAns).trim();
  if (!rawStudent) return false;

  const cleanVal = (val: string) => {
    return val
      .trim()
      .toLowerCase()
      .replace(/[\$\`]/g, '')
      .replace(/^(đáp số|kết quả|đáp án|nghiệm|x\s*=|y\s*=|z\s*=|k\s*=)\s*[:.\-–]?\s*/i, '')
      .replace(/\s+/g, '');
  };

  const normStudent = cleanVal(rawStudent);
  const studentComma = normStudent.includes('.') ? normStudent.replace('.', ',') : normStudent;
  const studentDot = normStudent.includes(',') ? normStudent.replace(',', '.') : normStudent;

  // Build list of candidate answers
  const candidates: string[] = [];
  if (Array.isArray(acceptableAnswers)) {
    candidates.push(...acceptableAnswers);
  }
  if (correctOption) candidates.push(correctOption);
  if (sampleAnswer) candidates.push(sampleAnswer);

  if (candidates.length === 0) return false;

  const studentNum = Number(studentDot);
  const isStudentNumeric = !isNaN(studentNum) && normStudent !== '';

  return candidates.some(cand => {
    if (!cand) return false;
    const normCand = cleanVal(String(cand));
    if (!normCand) return false;

    // String matches
    if (normCand === normStudent || normCand === studentComma || normCand === studentDot) {
      return true;
    }

    // Numeric match
    if (isStudentNumeric) {
      const candDot = normCand.includes(',') ? normCand.replace(',', '.') : normCand;
      const candNum = Number(candDot);
      if (!isNaN(candNum) && Math.abs(studentNum - candNum) < 0.00001) {
        return true;
      }

      // Fraction match e.g. 7/2 vs 3.5
      if (normCand.includes('/')) {
        const parts = normCand.split('/');
        if (parts.length === 2) {
          const num = Number(parts[0]);
          const den = Number(parts[1]);
          if (!isNaN(num) && !isNaN(den) && den !== 0 && Math.abs(studentNum - (num / den)) < 0.00001) {
            return true;
          }
        }
      }
    }

    return false;
  });
}

/**
 * Evaluates True/False questions according to the official Vietnamese MOET standard:
 * 1 ý đúng = 0.1
 * 2 ý đúng = 0.25
 * 3 ý đúng = 0.50
 * 4 ý đúng = 1.00
 */
export function evaluateTrueFalseQuestion(
  studentChoice: any,
  subQuestions?: TrueFalseItem[],
  questionPoints: number = 1
): {
  subMatches: number;
  totalSubs: number;
  ratio: number;
  earnedPoints: number;
  isFullMatch: boolean;
  subDetails: Record<string, { student: boolean | null; correct: boolean; isMatch: boolean }>;
} {
  const subList = subQuestions || [];
  const totalSubs = subList.length || 4;
  let subMatches = 0;
  const subDetails: Record<string, { student: boolean | null; correct: boolean; isMatch: boolean }> = {};

  if (studentChoice && typeof studentChoice === 'object') {
    subList.forEach(sub => {
      const rawStudentVal = studentChoice[sub.key];
      let studentVal: boolean | null = null;
      if (rawStudentVal === true || rawStudentVal === 'true' || rawStudentVal === 'Đúng') {
        studentVal = true;
      } else if (rawStudentVal === false || rawStudentVal === 'false' || rawStudentVal === 'Sai') {
        studentVal = false;
      }

      const correctVal = sub.correct === true || String(sub.correct) === 'true';
      const isMatch = studentVal !== null && studentVal === correctVal;
      if (isMatch) subMatches++;

      subDetails[sub.key] = {
        student: studentVal,
        correct: correctVal,
        isMatch
      };
    });
  }

  // Quy tắc chấm điểm câu hỏi Đúng/Sai: Số ý đúng × 0.25
  // 0 ý = 0 điểm | 1 ý = 0.25 điểm | 2 ý = 0.50 điểm | 3 ý = 0.75 điểm | 4 ý = 1.00 điểm
  let ratio = 0;
  if (subMatches === 4) ratio = 1.0;
  else if (subMatches === 3) ratio = 0.75;
  else if (subMatches === 2) ratio = 0.50;
  else if (subMatches === 1) ratio = 0.25;
  else ratio = 0.0;

  const earnedPoints = Number((questionPoints * ratio).toFixed(2));
  const isFullMatch = subMatches === totalSubs && totalSubs > 0;

  return {
    subMatches,
    totalSubs,
    ratio,
    earnedPoints,
    isFullMatch,
    subDetails
  };
}

/**
 * Universal evaluator for whether a single question is considered correct.
 * Used for filters and badges in ExamResultView, StudentHistory, and Analytics.
 */
export function isQuestionCorrect(q: Question, studentAnswers: Record<string, any>): boolean {
  const studentChoice = studentAnswers[q.id];
  if (studentChoice === undefined || studentChoice === null || studentChoice === '') return false;

  const qType = q.type || 'multiple_choice';

  if (qType === 'multiple_choice') {
    return isMultipleChoiceCorrect(studentChoice, q.correctOption, q.options);
  }

  if (qType === 'true_false') {
    const { isFullMatch, ratio } = evaluateTrueFalseQuestion(studentChoice, q.subQuestions, q.points);
    return isFullMatch || ratio >= 0.5;
  }

  if (qType === 'fill_blank') {
    return isFillBlankCorrect(studentChoice, q.acceptableAnswers, q.correctOption, q.sampleAnswer);
  }

  if (qType === 'essay') {
    return String(studentChoice).trim().length > 0;
  }

  return false;
}
