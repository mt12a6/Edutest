import { ExamResult, Exam, Question } from '../types';
import * as XLSX from 'xlsx';
import { getQuestionFourSection } from './grading';

/**
 * Calculates part scores for a result if not already pre-calculated
 */
export function extractResultPartScores(result: ExamResult, questions?: Question[]) {
  if (result.partScores) {
    return {
      part1: result.partScores.part1?.earned ?? 0,
      part1Max: result.partScores.part1?.max ?? 0,
      part2: result.partScores.part2?.earned ?? 0,
      part2Max: result.partScores.part2?.max ?? 0,
      part3: result.partScores.part3?.earned ?? 0,
      part3Max: result.partScores.part3?.max ?? 0,
      part4: result.partScores.part4?.earned ?? (result.essayScore ?? 0),
      part4Max: result.partScores.part4?.max ?? (questions ? questions.filter(q => q.type === 'essay').reduce((s, q) => s + (q.points || 1), 0) : 0),
    };
  }

  // Fallback if not stored on result object
  const essayScore = result.essayScore ?? 0;
  const objectiveScore = result.objectiveScore ?? Math.max(0, Number(((result.score || 0) - essayScore).toFixed(2)));

  return {
    part1: objectiveScore,
    part1Max: 0,
    part2: 0,
    part2Max: 0,
    part3: 0,
    part3Max: 0,
    part4: essayScore,
    part4Max: 0,
  };
}

/**
 * Builds standard data rows with full 4-part exam component scores
 */
export function buildDetailedResultsData(exam: Exam, results: ExamResult[], questions?: Question[]) {
  return results.map((r, index) => {
    const formattedDate = r.submittedAt 
      ? new Date(r.submittedAt).toLocaleString('vi-VN') 
      : 'Chưa có';

    const p = extractResultPartScores(r, questions);

    const gradingStatus = r.status === 'pending_essay_grading'
      ? 'Chờ chấm tự luận'
      : r.isAiGraded
      ? 'AI đã chấm'
      : r.essayGradedBy
      ? `Giáo viên chấm (${r.essayGradedBy})`
      : 'Đã hoàn thành';

    return {
      'STT': index + 1,
      'Họ và tên thí sinh': r.studentName || 'Thí sinh',
      'Tên đăng nhập / Email': r.studentEmail || '',
      'Lớp': r.classId || '10A1',
      'Mã đề thi': exam.examCode || 'MĐ-01',
      'Điểm Phần I (Trắc nghiệm)': p.part1Max > 0 ? `${p.part1} / ${p.part1Max}đ` : `${p.part1}đ`,
      'Điểm Phần II (Đúng/Sai)': p.part2Max > 0 ? `${p.part2} / ${p.part2Max}đ` : `${p.part2}đ`,
      'Điểm Phần III (Trả lời ngắn)': p.part3Max > 0 ? `${p.part3} / ${p.part3Max}đ` : `${p.part3}đ`,
      'Điểm Phần IV (Tự luận)': p.part4Max > 0 ? `${p.part4} / ${p.part4Max}đ` : `${p.part4}đ`,
      'Tổng điểm': r.score,
      'Thang điểm': r.maxScore || 10,
      'Tỷ lệ (%)': `${r.percentage}%`,
      'Số câu đúng': r.correctCount,
      'Số câu sai': r.wrongCount,
      'Chưa làm': r.unattemptedCount,
      'Vi phạm rời tab': r.tabViolations || 0,
      'Thời gian nộp bài': formattedDate,
      'Trạng thái chấm': gradingStatus,
      'Người chấm / Cập nhật': r.lastUpdatedBy || r.essayGradedBy || 'Hệ thống tự động',
      'Kết quả': r.score >= (exam.passScore || 5) ? 'Đạt' : 'Chưa đạt',
      'Lời phê / Ghi chú': r.feedback || ''
    };
  });
}

/**
 * Exports exam results to modern Excel (.xlsx) file with full component breakdown
 */
export function exportResultsToExcel(exam: Exam, results: ExamResult[], questions?: Question[]) {
  const rows = buildDetailedResultsData(exam, results, questions);
  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-fit column widths
  const colWidths = [
    { wch: 6 },  // STT
    { wch: 24 }, // Họ và tên
    { wch: 24 }, // Email
    { wch: 10 }, // Lớp
    { wch: 12 }, // Mã đề
    { wch: 18 }, // Điểm Phần I
    { wch: 18 }, // Điểm Phần II
    { wch: 20 }, // Điểm Phần III
    { wch: 18 }, // Điểm Phần IV
    { wch: 12 }, // Tổng điểm
    { wch: 12 }, // Thang điểm
    { wch: 10 }, // Tỷ lệ %
    { wch: 12 }, // Đúng
    { wch: 12 }, // Sai
    { wch: 10 }, // Chưa làm
    { wch: 15 }, // Rời tab
    { wch: 20 }, // Thời gian nộp
    { wch: 18 }, // Trạng thái chấm
    { wch: 22 }, // Người chấm
    { wch: 12 }, // Kết quả
    { wch: 30 }  // Lời phê
  ];
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bang_Diem_Tong_Hop');

  const safeTitle = (exam.title || 'Bang_diem')
    .replace(/[^a-zA-Z0-9à-ỹÀ-Ỹ\s-_]/g, '')
    .trim()
    .replace(/\s+/g, '_');

  XLSX.writeFile(wb, `Bang_Diem_${safeTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Exports exam results to CSV file with UTF-8 BOM so Excel opens Vietnamese text without encoding issues.
 * Includes all 4 exam components!
 */
export function exportResultsToCsv(exam: Exam, results: ExamResult[], questions?: Question[]) {
  const data = buildDetailedResultsData(exam, results, questions);
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const rows = data.map(row => {
    return headers.map(h => {
      const val = (row as any)[h];
      return `"${String(val ?? '').replace(/"/g, '""')}"`;
    }).join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const safeTitle = (exam.title || 'Bang_diem')
    .replace(/[^a-zA-Z0-9à-ỹÀ-Ỹ\s-_]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  link.setAttribute('download', `Bang_diem_${safeTitle}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
