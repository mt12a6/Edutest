export type UserRole = 'admin' | 'teacher' | 'student';
export type UserStatus = 'active' | 'disabled';

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  password?: string; // Stored for school bulk imported accounts
  displayName: string;
  photoURL?: string;
  role: UserRole;
  status: UserStatus;
  classIds?: string[];
  className?: string;
  currentSessionId?: string; // Token of currently active session to enforce 1 active login
  createdAt: string;
  updatedAt?: string;
}

export interface SchoolClass {
  id: string;
  name: string; // e.g. "10A1", "12 Chuyên Toán"
  grade: string; // e.g. "10", "11", "12"
  schoolYear: string; // e.g. "2024 - 2025"
  teacherIds?: string[];
  description?: string;
  studentCount: number;
  isHidden?: boolean;
  createdAt: string;
}

export interface Subject {
  id: string;
  name: string; // e.g. "Toán học", "Vật lí", "Tiếng Anh"
  code: string; // e.g. "MATH", "PHYS", "ENG"
  description?: string;
}

export interface Exam {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  grade: string;
  durationMinutes: number;
  passScore: number;
  maxScore: number;
  questionCount: number;
  classIds: string[]; // classes assigned
  startTime?: string;
  endTime?: string;
  openTime?: string; // Thời gian mở đề thi (học sinh không thể vào trước giờ này)
  closeTime?: string; // Thời gian kết thúc nhận bài thi (sau giờ này không thể nộp bài hoặc vào thi)
  secretToken?: string; // Token bí mật cho đường link riêng của giáo viên
  examCode?: string; // Mã đề thi mà học sinh phải nhập để xác thực vào làm bài
  googleFormId?: string; // ID Google Form dự phòng
  googleFormUrl?: string; // Đường link Google Form dự phòng
  googleFormStatus?: 'success' | 'failed' | 'pending' | 'none' | 'created'; // Trạng thái tạo Google Form dự phòng
  googleFormError?: string; // Chi tiết lỗi nếu tạo Google Form thất bại
  isPublished: boolean;
  isHidden?: boolean; // Tạm ẩn đề thi / kỳ thi
  isTrial?: boolean; // Đề thi thử tự do cho người dùng chưa đăng nhập
  trialCode?: string; // Mã đề thi thử (e.g. "TOAN6-01", "THITHU-01")
  isPinned?: boolean; // Ghim đề thi lên đầu để học sinh thấy ngay bài thi cần làm
  isSecure?: boolean; // Đề thi bảo mật (chỉ hiện khi đăng nhập tài khoản hợp lệ)
  enableTabWarning?: boolean; // Cảnh báo khi học sinh rời màn hình / chuyển tab (có thể bật/tắt)
  warnOnTabSwitch?: boolean; // Alias / tương thích
  allowRetake?: boolean; // Cho phép làm lại bài thi nhiều lần
  maxAttempts?: number; // Số lần làm bài tối đa (0 = không giới hạn, 1, 2, 3...)
  showScoreAfterExam?: boolean; // Cho học sinh xem điểm ngay sau khi nộp bài
  shuffleQuestions?: boolean; // Trộn thứ tự câu hỏi khi thi (theo từng phần)
  shuffleOptions?: boolean; // Trộn thứ tự các phương án lựa chọn A, B, C, D
  showAnswersAfterExam: boolean; // reveal explanations and correct answers after student submits
  allowReview: boolean;

  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string;
}

export type QuestionType = 'multiple_choice' | 'true_false' | 'fill_blank' | 'essay';

export interface TrueFalseItem {
  key: 'a' | 'b' | 'c' | 'd';
  text: string;
  correct: boolean; // true = Đúng, false = Sai
  points?: number; // Điểm số riêng cho mỗi ý (mặc định 0.25 hoặc theo biểu điểm)
}

export interface Question {
  id: string;
  examId: string;
  questionNumber: number;
  section?: 1 | 2 | 3 | 4; // 1: Trắc nghiệm 4 lựa chọn, 2: Đúng/Sai, 3: Trả lời ngắn, 4: Tự luận
  type: QuestionType; // 'multiple_choice' | 'true_false' | 'fill_blank' | 'essay'
  prompt: string;
  imageUrl?: string; // Formula diagram or question illustration image
  // Multiple Choice fields
  options?: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  optionImages?: {
    A?: string;
    B?: string;
    C?: string;
    D?: string;
  };
  correctOption?: 'A' | 'B' | 'C' | 'D';
  // True / False fields (Format thi THPT mới gồm 4 ý a, b, c, d)
  subQuestions?: TrueFalseItem[];
  // Fill-in-the-blank fields (Điền kết quả)
  acceptableAnswers?: string[]; // e.g. ["3.5", "7/2", "3,5"]
  // Essay fields (Tự luận)
  sampleAnswer?: string;
  rubric?: string;
  explanation?: string;
  points: number;
  sectionTitle?: string;
}

export interface ExamAssignment {
  id: string;
  examId: string;
  studentId: string;
  studentEmail: string;
  studentName: string;
  classId: string;
  status: 'assigned' | 'in_progress' | 'submitted' | 'missed';
  score?: number;
  startedAt?: string;
  submittedAt?: string;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  examTitle?: string;
  subjectName?: string;
  studentId: string;
  studentEmail: string;
  studentName: string;
  classId?: string;
  startedAt: string;
  deadline: string; // ISO date string calculated from startedAt + duration
  durationMinutes: number;
  status: 'in_progress' | 'submitted' | 'timed_out';
  submittedAt?: string;
  totalQuestions: number;
  answeredCount: number;
  score?: number;
  maxScore?: number;
  answers: Record<string, any>;
  flaggedQuestions: Record<string, boolean>; // questionId -> boolean
  lastSavedAt: string;
  tabViolations?: number; // count of tab switch violations detected
  tabViolationLogs?: string[]; // timestamps of tab switches
}

export interface ExamResult {
  id: string;
  attemptId: string;
  examId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  classId?: string;
  score: number;
  maxScore: number;
  correctCount: number;
  wrongCount: number;
  unattemptedCount: number;
  percentage: number;
  submittedAt: string;
  feedback?: string;
  tabViolations?: number; // Anti-cheat count
  answers?: Record<string, any>; // Student submitted answers map
  flaggedQuestions?: Record<string, boolean>;
  // Essay grading fields
  status?: 'completed' | 'pending_essay_grading';
  hasEssay?: boolean;
  objectiveScore?: number;
  hasEssayGraded?: boolean;
  essayScore?: number;
  essayFeedback?: string;
  isAiGraded?: boolean;
  graderId?: string; // ID tài khoản giáo viên chấm bài
  essayGradedBy?: string; // Họ tên giáo viên chấm bài
  essayGradedAt?: string; // Thời điểm chấm
  lastUpdatedById?: string; // ID giáo viên cập nhật điểm gần nhất
  lastUpdatedBy?: string; // Họ tên giáo viên cập nhật gần nhất
  lastUpdatedAt?: string; // Thời điểm cập nhật gần nhất
  graderHistory?: Array<{
    graderId: string;
    graderName: string;
    score: number;
    timestamp: string;
    action?: string;
  }>;
  source?: 'system' | 'google_forms' | 'omr';
  essayGrades?: Record<string, {
    score: number;
    feedback: string;
    questionNumber?: number;
    maxPoints?: number;
    gradedBy?: string;
    gradedAt?: string;
  }>;
  // 4 Exam Sections Breakdown scores (Phần I, II, III, IV)
  partScores?: {
    part1?: { earned: number; max: number; count: number; correctCount?: number };
    part2?: { earned: number; max: number; count: number; correctCount?: number };
    part3?: { earned: number; max: number; count: number; correctCount?: number };
    part4?: { earned: number; max: number; count: number; correctCount?: number };
  };
}

export interface SystemLog {
  id: string;
  action: string;
  actorId: string;
  actorEmail: string;
  targetId?: string;
  targetType?: string;
  details?: string;
  timestamp: string;
}

export interface ParsedDocxQuestion {
  questionNumber: number;
  type: QuestionType;
  prompt: string;
  imageUrl?: string;
  options?: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  optionImages?: {
    A?: string;
    B?: string;
    C?: string;
    D?: string;
  };
  correctOption?: 'A' | 'B' | 'C' | 'D';
  subQuestions?: TrueFalseItem[];
  acceptableAnswers?: string[];
  sampleAnswer?: string;
  explanation?: string;
  points: number;
  isAmbiguous?: boolean;
  warnings?: string[];
}

export interface ImportedUserRecord {
  username: string;
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  classId?: string;
  isValid: boolean;
  error?: string;
}
