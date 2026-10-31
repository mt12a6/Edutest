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

/**
 * Determines which of the 4 standard exam sections a question belongs to:
 * 1: Phần I - Trắc nghiệm nhiều phương án lựa chọn
 * 2: Phần II - Trắc nghiệm Đúng / Sai
 * 3: Phần III - Trả lời ngắn / Điền khuyết
 * 4: Phần IV - Tự luận
 */
export function getQuestionFourSection(q: { type?: string; section?: number }): 1 | 2 | 3 | 4 {
  if (q.type === 'essay' || q.section === 4) return 4;
  if (q.type === 'fill_blank' || (q.section === 3 && q.type !== 'essay')) return 3;
  if (q.type === 'true_false' || q.section === 2) return 2;
  if (q.type === 'multiple_choice' || q.section === 1) return 1;
  return 1;
}

export interface ExamPartScoreBreakdown {
  partNumber: 1 | 2 | 3 | 4;
  title: string;
  shortTitle: string;
  earnedPoints: number;
  maxPoints: number;
  questionCount: number;
  correctCount: number;
  wrongCount: number;
  unattemptedCount: number;
}

export interface ExamSubmissionBreakdown {
  part1: ExamPartScoreBreakdown;
  part2: ExamPartScoreBreakdown;
  part3: ExamPartScoreBreakdown;
  part4: ExamPartScoreBreakdown;
  totalEarnedPoints: number;
  totalMaxPoints: number;
  scaledScore: number;
  percentage: number;
  correctCount: number;
  wrongCount: number;
  unattemptedCount: number;
  hasEssay: boolean;
  hasPendingEssay: boolean;
  questionScores: Record<string, {
    earned: number;
    max: number;
    isCorrect: boolean;
    isAnswered: boolean;
    status: 'correct' | 'wrong' | 'partial' | 'unattempted' | 'pending';
  }>;
}

/**
 * Comprehensive calculator for all 4 exam components according to Vietnam MOET & School Exam standards.
 * Dynamically adapts to newly updated question keys, question types, and points.
 */
export function calculateExamSubmissionBreakdown(
  exam: Exam,
  questions: Question[],
  studentAnswers: Record<string, any> = {},
  essayGrades?: Record<string, any>,
  existingEssayScore?: number
): ExamSubmissionBreakdown {
  const parts: Record<1 | 2 | 3 | 4, ExamPartScoreBreakdown> = {
    1: {
      partNumber: 1,
      title: 'Phần I: Câu hỏi trắc nghiệm nhiều phương án',
      shortTitle: 'Phần I: Trắc nghiệm',
      earnedPoints: 0,
      maxPoints: 0,
      questionCount: 0,
      correctCount: 0,
      wrongCount: 0,
      unattemptedCount: 0
    },
    2: {
      partNumber: 2,
      title: 'Phần II: Câu hỏi trắc nghiệm Đúng / Sai',
      shortTitle: 'Phần II: Đúng / Sai',
      earnedPoints: 0,
      maxPoints: 0,
      questionCount: 0,
      correctCount: 0,
      wrongCount: 0,
      unattemptedCount: 0
    },
    3: {
      partNumber: 3,
      title: 'Phần III: Câu hỏi trả lời ngắn & điền khuyết',
      shortTitle: 'Phần III: Trả lời ngắn',
      earnedPoints: 0,
      maxPoints: 0,
      questionCount: 0,
      correctCount: 0,
      wrongCount: 0,
      unattemptedCount: 0
    },
    4: {
      partNumber: 4,
      title: 'Phần IV: Câu hỏi tự luận',
      shortTitle: 'Phần IV: Tự luận',
      earnedPoints: 0,
      maxPoints: 0,
      questionCount: 0,
      correctCount: 0,
      wrongCount: 0,
      unattemptedCount: 0
    }
  };

  const questionScores: ExamSubmissionBreakdown['questionScores'] = {};
  let totalCorrect = 0;
  let totalWrong = 0;
  let totalUnattempted = 0;
  let hasPendingEssay = false;

  const essayQuestions = questions.filter(q => q.type === 'essay' || q.section === 4);
  const hasEssay = essayQuestions.length > 0;

  questions.forEach(q => {
    const sec = getQuestionFourSection(q);
    const p = parts[sec];
    const qWeight = typeof q.points === 'number' && q.points > 0 ? q.points : 1;
    p.maxPoints += qWeight;
    p.questionCount += 1;

    const studentAns = studentAnswers[q.id];
    const isAnswered = studentAns !== undefined && studentAns !== null && studentAns !== '';

    if (!isAnswered) {
      p.unattemptedCount += 1;
      totalUnattempted += 1;
      questionScores[q.id] = {
        earned: 0,
        max: qWeight,
        isCorrect: false,
        isAnswered: false,
        status: 'unattempted'
      };
      return;
    }

    const qType = q.type || 'multiple_choice';

    if (qType === 'multiple_choice') {
      const isCorrect = isMultipleChoiceCorrect(studentAns, q.correctOption, q.options);
      if (isCorrect) {
        p.earnedPoints += qWeight;
        p.correctCount += 1;
        totalCorrect += 1;
        questionScores[q.id] = {
          earned: qWeight,
          max: qWeight,
          isCorrect: true,
          isAnswered: true,
          status: 'correct'
        };
      } else {
        p.wrongCount += 1;
        totalWrong += 1;
        questionScores[q.id] = {
          earned: 0,
          max: qWeight,
          isCorrect: false,
          isAnswered: true,
          status: 'wrong'
        };
      }
    } else if (qType === 'true_false') {
      const { subMatches, totalSubs, ratio, earnedPoints: tfEarned } = evaluateTrueFalseQuestion(
        studentAns,
        q.subQuestions,
        qWeight
      );
      p.earnedPoints += tfEarned;

      if (subMatches === totalSubs && totalSubs > 0) {
        p.correctCount += 1;
        totalCorrect += 1;
        questionScores[q.id] = {
          earned: tfEarned,
          max: qWeight,
          isCorrect: true,
          isAnswered: true,
          status: 'correct'
        };
      } else if (subMatches > 0) {
        p.correctCount += ratio;
        p.wrongCount += 1 - ratio;
        totalCorrect += ratio;
        totalWrong += 1 - ratio;
        questionScores[q.id] = {
          earned: tfEarned,
          max: qWeight,
          isCorrect: false,
          isAnswered: true,
          status: 'partial'
        };
      } else {
        p.wrongCount += 1;
        totalWrong += 1;
        questionScores[q.id] = {
          earned: 0,
          max: qWeight,
          isCorrect: false,
          isAnswered: true,
          status: 'wrong'
        };
      }
    } else if (qType === 'fill_blank') {
      const isCorrect = isFillBlankCorrect(
        studentAns,
        q.acceptableAnswers,
        q.correctOption,
        q.sampleAnswer
      );
      if (isCorrect) {
        p.earnedPoints += qWeight;
        p.correctCount += 1;
        totalCorrect += 1;
        questionScores[q.id] = {
          earned: qWeight,
          max: qWeight,
          isCorrect: true,
          isAnswered: true,
          status: 'correct'
        };
      } else {
        p.wrongCount += 1;
        totalWrong += 1;
        questionScores[q.id] = {
          earned: 0,
          max: qWeight,
          isCorrect: false,
          isAnswered: true,
          status: 'wrong'
        };
      }
    } else if (qType === 'essay') {
      // Check if teacher had already assigned a score
      let essayEarned = 0;
      let isGraded = false;

      if (essayGrades && essayGrades[q.id]?.score !== undefined) {
        essayEarned = Math.min(qWeight, Math.max(0, Number(essayGrades[q.id].score)));
        isGraded = true;
      } else if (existingEssayScore !== undefined && essayQuestions.length === 1) {
        essayEarned = Math.min(qWeight, Math.max(0, Number(existingEssayScore)));
        isGraded = true;
      }

      p.earnedPoints += essayEarned;
      if (isGraded) {
        if (essayEarned >= qWeight * 0.5) {
          p.correctCount += 1;
          totalCorrect += 1;
        } else {
          p.wrongCount += 1;
          totalWrong += 1;
        }
        questionScores[q.id] = {
          earned: essayEarned,
          max: qWeight,
          isCorrect: essayEarned >= qWeight * 0.5,
          isAnswered: true,
          status: essayEarned === qWeight ? 'correct' : essayEarned > 0 ? 'partial' : 'wrong'
        };
      } else {
        hasPendingEssay = true;
        questionScores[q.id] = {
          earned: 0,
          max: qWeight,
          isCorrect: false,
          isAnswered: true,
          status: 'pending'
        };
      }
    }
  });

  // Round component points to 2 decimal places
  ([1, 2, 3, 4] as const).forEach(sec => {
    parts[sec].earnedPoints = Number(parts[sec].earnedPoints.toFixed(2));
    parts[sec].maxPoints = Number(parts[sec].maxPoints.toFixed(2));
  });

  const totalEarnedPoints = Number(
    (parts[1].earnedPoints + parts[2].earnedPoints + parts[3].earnedPoints + parts[4].earnedPoints).toFixed(2)
  );
  const totalMaxPoints = Number(
    (parts[1].maxPoints + parts[2].maxPoints + parts[3].maxPoints + parts[4].maxPoints).toFixed(2)
  );

  const maxScale = exam.maxScore || 10;
  // If exam has points configured directly on a 10 scale (or whatever maxScale is)
  // or scaled proportionately:
  let scaledScore = 0;
  if (totalMaxPoints > 0) {
    if (Math.abs(totalMaxPoints - maxScale) < 0.05) {
      scaledScore = totalEarnedPoints;
    } else {
      scaledScore = Number(((totalEarnedPoints / totalMaxPoints) * maxScale).toFixed(2));
    }
  }
  scaledScore = Math.max(0, Math.min(maxScale, scaledScore));
  const percentage = maxScale > 0 ? Math.min(100, Math.round((scaledScore / maxScale) * 100)) : 0;

  return {
    part1: parts[1],
    part2: parts[2],
    part3: parts[3],
    part4: parts[4],
    totalEarnedPoints,
    totalMaxPoints,
    scaledScore,
    percentage,
    correctCount: Math.round(totalCorrect),
    wrongCount: Math.round(totalWrong),
    unattemptedCount: totalUnattempted,
    hasEssay,
    hasPendingEssay,
    questionScores
  };
}

