import { ExamResult, Exam } from '../types';

/**
 * Exports exam results to CSV file with UTF-8 BOM so Excel opens Vietnamese text without encoding issues.
 */
export function exportResultsToCsv(exam: Exam, results: ExamResult[]) {
  const headers = [
    'STT',
    'Họ và tên thí sinh',
    'Email',
    'Lớp',
    'Điểm số',
    'Thang điểm',
    'Số câu đúng',
    'Số câu sai',
    'Chưa trả lời',
    'Tỷ lệ (%)',
    'Thời gian nộp bài',
    'Đánh giá'
  ];

  const rows = results.map((r, index) => {
    const formattedDate = r.submittedAt 
      ? new Date(r.submittedAt).toLocaleString('vi-VN') 
      : 'Chưa có';

    return [
      index + 1,
      `"${(r.studentName || '').replace(/"/g, '""')}"`,
      `"${r.studentEmail || ''}"`,
      `"${r.classId || '10A1'}"`,
      r.score,
      r.maxScore || 10,
      r.correctCount,
      r.wrongCount,
      r.unattemptedCount,
      `${r.percentage}%`,
      `"${formattedDate}"`,
      `"${(r.feedback || '').replace(/"/g, '""')}"`
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const safeTitle = exam.title.replace(/[^a-zA-Z0-9à-ỹÀ-Ỹ\s-_]/g, '').trim().replace(/\s+/g, '_');
  link.setAttribute('download', `Bang_diem_${safeTitle}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
