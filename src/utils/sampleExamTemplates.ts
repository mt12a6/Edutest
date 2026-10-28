/**
 * Sample exam templates for JSON, LaTeX (.tex), and Word (.docx format guide)
 */

export const SAMPLE_JSON_EXAM = {
  title: "Đề thi thử THPT Quốc gia - Môn Toán 2026 (Chuẩn 4 phần)",
  subject: "Toán học",
  grade: "12",
  durationMinutes: 90,
  maxScore: 10,
  passScore: 5,
  questions: [
    {
      questionNumber: 1,
      type: "multiple_choice",
      prompt: "Cho hàm số $y = \\frac{2x - 1}{x + 1}$. Đồ thị hàm số có tiệm cận đứng là đường thẳng nào sau đây?",
      options: {
        A: "$x = -1$",
        B: "$x = 2$",
        C: "$y = 2$",
        D: "$y = -1$"
      },
      correctOption: "A",
      explanation: "Tiệm cận đứng của đồ thị hàm số $y = \\frac{ax+b}{cx+d}$ là nghiệm mẫu: $x + 1 = 0 \\Leftrightarrow x = -1$.",
      points: 0.25
    },
    {
      questionNumber: 2,
      type: "multiple_choice",
      prompt: "Tập nghiệm của bất phương trình $\\log_2(x - 1) < 3$ là:",
      options: {
        A: "$(1; 9)$",
        B: "$(-\\infty; 9)$",
        C: "$(1; +\\infty)$",
        D: "$(1; 8)$"
      },
      correctOption: "A",
      explanation: "Điều kiện: $x - 1 > 0 \\Leftrightarrow x > 1$. Khi đó $\\log_2(x - 1) < 3 \\Leftrightarrow x - 1 < 2^3 = 8 \\Leftrightarrow x < 9$. Kết hợp: $1 < x < 9$.",
      points: 0.25
    },
    {
      questionNumber: 3,
      type: "true_false",
      prompt: "Cho hàm số bậc ba $y = f(x) = x^3 - 3x^2 + 2$. Xét tính đúng/sai của các mệnh đề sau:",
      subQuestions: [
        {
          key: "a",
          text: "Hàm số đồng biến trên khoảng $(-\\infty; 0)$ và $(2; +\\infty)$.",
          correct: true
        },
        {
          key: "b",
          text: "Điểm cực tiểu của đồ thị hàm số có tọa độ là $(2; -2)$.",
          correct: true
        },
        {
          key: "c",
          text: "Hàm số đạt cực đại tại $x = 2$.",
          correct: false
        },
        {
          key: "d",
          text: "Giá trị lớn nhất của hàm số trên đoạn $[0; 3]$ bằng 2.",
          correct: true
        }
      ],
      explanation: "Ta có $f'(x) = 3x^2 - 6x = 3x(x - 2)$. $f'(x) = 0 \\Leftrightarrow x = 0$ hoặc $x = 2$. Cực đại tại $x = 0$ với $y(0) = 2$. Cực tiểu tại $x = 2$ với $y(2) = -2$.",
      points: 1.0
    },
    {
      questionNumber: 4,
      type: "fill_blank",
      prompt: "Biết $\\int_0^2 (2x + 1) dx = a$. Giá trị của số thực $a$ bằng bao nhiêu?",
      acceptableAnswers: ["6", "6.0"],
      explanation: "Ta có $\\int_0^2 (2x + 1) dx = [x^2 + x]_0^2 = (4 + 2) - 0 = 6$.",
      points: 0.5
    },
    {
      questionNumber: 5,
      type: "essay",
      prompt: "Trong không gian $Oxyz$, cho mặt cầu $(S): (x-1)^2 + (y-2)^2 + (z+1)^2 = 9$ và mặt phẳng $(P): 2x - y + 2z + 10 = 0$.\na) Xác định tâm $I$ và bán kính $R$ của mặt cầu $(S)$.\nb) Chứng minh rằng mặt phẳng $(P)$ tiếp xúc với mặt cầu $(S)$ và tìm tọa độ tiếp điểm $H$.",
      sampleAnswer: "a) Tâm $I(1; 2; -1)$, bán kính $R = 3$.\nb) Khoảng cách từ $I$ đến $(P)$:\n$d(I, (P)) = \\frac{|2(1) - 2 + 2(-1) + 10|}{\\sqrt{2^2 + (-1)^2 + 2^2}} = \\frac{|8|}{3} = \\frac{8}{3} \\neq 3$.\nNếu $d = R$ thì tiếp xúc. Tọa độ tiếp điểm là hình chiếu của $I$ lên $(P)$.",
      points: 2.0
    }
  ]
};

export const SAMPLE_LATEX_EXAM = `% ====================================================================
% BỘ GIÁO DỤC VÀ ĐÀO TẠO - ĐỀ THI MINH HỌA THPT QUỐC GIA CHUẨN 2026
% HỖ TRỢ TẢI LÊN TRỰC TIẾP VÀO HỆ THỐNG EDUTEST
% ====================================================================
\\documentclass[12pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[vietnamese]{babel}
\\usepackage{amsmath,amssymb}

\\title{Đề thi thử THPT Quốc gia - Môn Toán học}

\\begin{document}

% ---------------- PHẦN I: TRẮC NGHIỆM 4 LỰA CHỌN ----------------
\\begin{ex}%[Câu 1]
Cho hàm số $y = \\frac{2x - 1}{x + 1}$. Đồ thị hàm số có tiệm cận đứng là đường thẳng nào sau đây?
\\choice
{\\True $x = -1$}
{$x = 2$}
{$y = 2$}
{$y = -1$}
\\loigiai{Nghiệm của phương trình mẫu số là $x + 1 = 0 \\Leftrightarrow x = -1$. Do đó tiệm cận đứng là $x = -1$.}
\\end{ex}

\\begin{ex}%[Câu 2]
Tập nghiệm của bất phương trình $\\log_2(x - 1) < 3$ là:
\\choice
{\\True $(1; 9)$}
{$(-\\infty; 9)$}
{$(1; +\\infty)$}
{$(1; 8)$}
\\loigiai{Điều kiện xác định $x - 1 > 0 \\Leftrightarrow x > 1$. Khi đó $x - 1 < 2^3 = 8 \\Leftrightarrow x < 9$. Kết hợp điều kiện suy ra $S = (1; 9)$.}
\\end{ex}

% ---------------- PHẦN II: TRẮC NGHIỆM ĐÚNG / SAI ----------------
\\begin{ex}%[Câu 3]
Cho hàm số bậc ba $y = f(x) = x^3 - 3x^2 + 2$. Xét tính đúng hoặc sai của các khẳng định sau:
\\choiceTF
{\\True Hàm số đồng biến trên khoảng $(-\\infty; 0)$ và $(2; +\\infty)$}
{\\True Điểm cực tiểu của đồ thị hàm số có tọa độ là $(2; -2)$}
{\\False Hàm số đạt cực đại tại $x = 2$}
{\\True Giá trị lớn nhất của hàm số trên đoạn $[0; 3]$ bằng 2}
\\loigiai{Đạo hàm $f'(x) = 3x^2 - 6x = 3x(x - 2)$. Điểm cực đại là $(0; 2)$, điểm cực tiểu là $(2; -2)$.}
\\end{ex}

% ---------------- PHẦN III: TRẢ LỜI NGẮN / ĐIỀN SỐ ----------------
\\begin{ex}%[Câu 4]
Biết $\\int_0^2 (2x + 1) dx = a$. Giá trị của số thực $a$ bằng bao nhiêu?
\\shortans{6}
\\loigiai{Tích phân $\\int_0^2 (2x+1)dx = [x^2+x]_0^2 = (4+2) - 0 = 6$.}
\\end{ex}

% ---------------- PHẦN IV: TỰ LUẬN ----------------
\\begin{ex}%[Câu 5]
Trong không gian tọa độ $Oxyz$, cho mặt cầu $(S): (x-1)^2 + (y-2)^2 + (z+1)^2 = 9$.
Xác định tọa độ tâm $I$ và tính bán kính $R$ của mặt cầu $(S)$.
\\loigiai{Tâm của mặt cầu là $I(1; 2; -1)$, bán kính $R = \\sqrt{9} = 3$.}
\\end{ex}

\\end{document}
`;

export function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadSampleJsonExam() {
  triggerDownload(
    JSON.stringify(SAMPLE_JSON_EXAM, null, 2),
    'de_thi_mau_edutest_4_phan.json',
    'application/json;charset=utf-8'
  );
}

export function downloadSampleLatexExam() {
  triggerDownload(
    SAMPLE_LATEX_EXAM,
    'de_thi_mau_toan_thpt_4_phan.tex',
    'text/plain;charset=utf-8'
  );
}
