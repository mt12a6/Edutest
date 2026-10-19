import { Question, ParsedDocxQuestion, QuestionType } from '../types';

export interface SectionMeta {
  section: 1 | 2 | 3;
  title: string;
  shortTitle: string;
  badge: string;
  subtitle: string;
  instruction: string;
  startNum: number;
  endNum: number;
  count: number;
}

export function getQuestionSection(q: { type?: QuestionType; section?: 1 | 2 | 3 }): 1 | 2 | 3 {
  if (q.section === 1 || q.section === 2 || q.section === 3) return q.section;
  if (q.type === 'multiple_choice') return 1;
  if (q.type === 'true_false') return 2;
  if (q.type === 'fill_blank' || q.type === 'essay') return 3;
  return 1;
}

export const SECTION_DEFINITIONS: Record<1 | 2 | 3, {
  title: string;
  shortTitle: string;
  badge: string;
  subtitle: string;
  instructionTemplate: string;
}> = {
  1: {
    title: 'PHẦN I: CÂU HỎI TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN',
    shortTitle: 'Phần I: Trắc nghiệm 4 lựa chọn',
    badge: 'Phần I',
    subtitle: 'Mỗi câu hỏi thí sinh chỉ chọn một phương án duy nhất (A, B, C hoặc D)',
    instructionTemplate: 'Thí sinh trả lời từ câu {start} đến câu {end}. Mỗi câu hỏi thí sinh chỉ chọn một phương án trả lời đúng.'
  },
  2: {
    title: 'PHẦN II: CÂU HỎI TRẮC NGHIỆM ĐÚNG / SAI',
    shortTitle: 'Phần II: Đúng / Sai',
    badge: 'Phần II',
    subtitle: 'Mỗi câu gồm 4 ý a, b, c, d - Thí sinh chọn Đúng [Đ] hoặc Sai [S] cho từng ý',
    instructionTemplate: 'Thí sinh trả lời từ câu {start} đến câu {end}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn Đúng hoặc Sai.'
  },
  3: {
    title: 'PHẦN III: CÂU HỎI TRẢ LỜI NGẮN & TỰ LUẬN',
    shortTitle: 'Phần III: Trả lời ngắn / Tự luận',
    badge: 'Phần III',
    subtitle: 'Thí sinh điền kết quả ngắn hoặc trình bày lời giải chi tiết',
    instructionTemplate: 'Thí sinh trả lời từ câu {start} đến câu {end}. Thí sinh điền đáp số vào ô trống hoặc trình bày bài giải tự luận.'
  }
};

/**
 * Pseudo-random shuffle using a deterministic seed so that options and questions
 * remain stable during a single attempt session, but different per student/attempt.
 */
function shuffleArrayWithSeed<T>(array: T[], seedNum: number): T[] {
  const copy = [...array];
  let m = copy.length, t, i;
  let s = seedNum;
  while (m) {
    s = (s * 9301 + 49297) % 233280;
    i = Math.floor((s / 233280) * m--);
    t = copy[m];
    copy[m] = copy[i];
    copy[i] = t;
  }
  return copy;
}

/**
 * Organizes questions into standard 3 Parts (MOET Standard) and shuffles ONLY
 * within each part independently when shuffle is enabled.
 */
export function partitionAndOrderExamQuestions<T extends { type?: QuestionType; section?: 1 | 2 | 3 }>(
  questions: T[],
  shouldShuffle: boolean = false,
  seedStr: string = 'edutest_seed'
): {
  orderedQuestions: T[];
  sectionsMeta: Record<1 | 2 | 3, SectionMeta>;
} {
  const seedNum = seedStr.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) || 12345;

  const part1 = questions.filter(q => getQuestionSection(q) === 1);
  const part2 = questions.filter(q => getQuestionSection(q) === 2);
  const part3 = questions.filter(q => getQuestionSection(q) === 3);

  const shuffledPart1 = shouldShuffle ? shuffleArrayWithSeed(part1, seedNum) : part1;
  const shuffledPart2 = shouldShuffle ? shuffleArrayWithSeed(part2, seedNum + 101) : part2;
  const shuffledPart3 = shouldShuffle ? shuffleArrayWithSeed(part3, seedNum + 202) : part3;

  const orderedQuestions = [...shuffledPart1, ...shuffledPart2, ...shuffledPart3];

  let currentCounter = 1;

  const getMeta = (secNum: 1 | 2 | 3, count: number): SectionMeta => {
    const def = SECTION_DEFINITIONS[secNum];
    const startNum = count > 0 ? currentCounter : 0;
    const endNum = count > 0 ? currentCounter + count - 1 : 0;
    if (count > 0) currentCounter += count;

    const instruction = count > 0 
      ? def.instructionTemplate.replace('{start}', String(startNum)).replace('{end}', String(endNum))
      : '';

    return {
      section: secNum,
      title: def.title,
      shortTitle: def.shortTitle,
      badge: def.badge,
      subtitle: def.subtitle,
      instruction,
      startNum,
      endNum,
      count
    };
  };

  const sectionsMeta: Record<1 | 2 | 3, SectionMeta> = {
    1: getMeta(1, shuffledPart1.length),
    2: getMeta(2, shuffledPart2.length),
    3: getMeta(3, shuffledPart3.length)
  };

  return {
    orderedQuestions,
    sectionsMeta
  };
}
