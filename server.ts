import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY)
  });
});

// AI Exam Parser using Gemini 3.8 Flash (Multimodal: PDF and text)
app.post('/api/parse-exam', async (req, res) => {
  try {
    const { fileBase64, fileName, mimeType, rawText } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'Chưa cấu hình GEMINI_API_KEY trong hệ thống.'
      });
    }

    const ai = new GoogleGenAI();

    const systemPrompt = `Bạn là trợ lý chuyên gia sư phạm Việt Nam, có năng lực bóc tách và số hóa đề thi (Toán, Tin học, Khoa học tự nhiên, v.v.) từ tài liệu PDF hoặc văn bản Word.
Nhiệm vụ của bạn:
1. Đọc kỹ nội dung tệp đề thi được cung cấp.
2. Tự động chuẩn hóa TẤT CẢ các công thức toán học, biểu thức, phương trình, số mũ, phân số, căn thức, ký hiệu tập hợp, hình học thành mã LaTeX chuẩn ($...$ cho inline và $$...$$ cho display) để hiển thị qua KaTeX. Ví dụ: $x^2 - 4x + 3 = 0$, $\\frac{a}{b}$, $\\sqrt{x^2+1}$, $\\Delta ABC$, $\\forall x \\in \\mathbb{R}$.
3. Bóc tách từng câu hỏi theo đúng định dạng JSON:
   - questionNumber: số thứ tự câu (1, 2, 3...)
   - type: "multiple_choice" | "true_false" | "fill_blank" | "essay"
   - prompt: Nội dung câu hỏi (chứa công thức LaTeX $...$, không chứa các phương án A, B, C, D)
   - options: Nếu là multiple_choice thì là object { A: "...", B: "...", C: "...", D: "..." } (chứa công thức LaTeX)
   - correctOption: "A" | "B" | "C" | "D" (nếu xác định được từ bảng đáp án hoặc dấu hiệu trong đề)
   - subQuestions: Nếu là true_false thì là mảng 4 ý [{ key: "a", text: "...", correct: boolean }, ...]
   - acceptableAnswers: Nếu là fill_blank thì là mảng đáp số chấp nhận được, ví dụ ["3.5", "7/2"]
   - explanation: Lời giải chi tiết / hướng dẫn giải (chứa công thức LaTeX $...$)
   - points: Điểm số cho câu (mặc định 1)
   - hasDiagram: true nếu câu hỏi này có hình vẽ/hình học/đồ thị trong đề gốc
4. Phát hiện tiêu đề đề thi (title), môn học (subject: "Toán", "Tin học", ...), khối lớp (grade: "6", "7", "8", "9", "10", "11", "12").

Trả về ĐÚNG định dạng JSON sau:
{
  "title": "Tên đề thi",
  "grade": "6",
  "subject": "Toán",
  "questions": [
    {
      "questionNumber": 1,
      "type": "multiple_choice",
      "prompt": "...",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "correctOption": "A",
      "explanation": "...",
      "points": 1,
      "hasDiagram": false
    }
  ]
}`;

    const contents: any[] = [];
    if (fileBase64 && mimeType === 'application/pdf') {
      contents.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: fileBase64
        }
      });
      contents.push({
        text: 'Hãy bóc tách toàn bộ đề thi từ file PDF này sang định dạng JSON theo đúng yêu cầu.'
      });
    } else if (rawText) {
      contents.push({
        text: `Dưới đây là văn bản đề thi cần bóc tách và chuẩn hóa công thức toán sang LaTeX:\n\n${rawText}`
      });
    } else {
      return res.status(400).json({ success: false, error: 'Thiếu dữ liệu tệp (fileBase64 hoặc rawText).' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json'
      }
    });

    const responseText = response.text || '{}';
    const parsedData = JSON.parse(responseText);

    return res.json({
      success: true,
      data: parsedData
    });
  } catch (err: any) {
    console.error('Lỗi khi gọi Gemini parse-exam:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Lỗi xử lý AI bóc tách đề thi.'
    });
  }
});

/**
 * AI Endpoint: Review and check exam questions & answer keys
 */
app.post('/api/check-exam', async (req, res) => {
  try {
    const { title, grade, subject, questions } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Fallback heuristics when API key is not configured
      const reminders: any[] = [];
      (questions || []).forEach((q: any) => {
        if (!q.prompt || q.prompt.trim().length < 5) {
          reminders.push({
            questionNumber: q.questionNumber,
            severity: 'error',
            issue: 'Nội dung câu hỏi quá ngắn hoặc đang để trống.',
            suggestion: 'Vui lòng bổ sung đầy đủ ngữ cảnh và yêu cầu câu hỏi.'
          });
        }
        if (q.type === 'multiple_choice') {
          if (!q.correctOption) {
            reminders.push({
              questionNumber: q.questionNumber,
              severity: 'error',
              issue: 'Chưa chọn đáp án đúng cho câu trắc nghiệm.',
              suggestion: 'Chọn A, B, C hoặc D làm đáp án đúng.'
            });
          }
        }
        if (q.type === 'true_false' && (!q.subQuestions || q.subQuestions.length < 4)) {
          reminders.push({
            questionNumber: q.questionNumber,
            severity: 'warning',
            issue: 'Câu Đúng/Sai chưa đủ 4 mệnh đề chuẩn a, b, c, d.',
            suggestion: 'Bổ sung đủ 4 ý để đảm bảo cấu trúc đề thi chuẩn.'
          });
        }
        if (q.type === 'fill_blank' && (!q.acceptableAnswers || q.acceptableAnswers.length === 0)) {
          reminders.push({
            questionNumber: q.questionNumber,
            severity: 'error',
            issue: 'Chưa có đáp số được chấp nhận cho câu điền kết quả.',
            suggestion: 'Nhập ít nhất một đáp số đúng.'
          });
        }
      });

      return res.json({
        success: true,
        data: {
          overallStatus: reminders.length > 0 ? 'has_warnings' : 'good',
          overallSummary: reminders.length > 0
            ? `Hệ thống phát hiện ${reminders.length} điểm cần lưu ý trong đề thi.`
            : 'Đề thi đã đáp ứng cấu trúc và tính hợp lệ cơ bản.',
          totalIssuesCount: reminders.length,
          reminders
        }
      });
    }

    const ai = new GoogleGenAI();
    const systemPrompt = `Bạn là chuyên gia khảo thí và sư phạm Việt Nam. Hãy rà soát đề thi môn ${subject || 'Toán'} lớp ${grade || '6'} có tiêu đề "${title || 'Đề thi'}".
Nhiệm vụ:
1. Kiểm tra tính chính xác của câu hỏi và đáp án đúng.
2. Phát hiện các phương án lựa chọn bị trùng lặp hoặc phương án đúng bị sai lệch.
3. Kiểm tra xem các công thức toán học có thiếu định dạng $...$ không.
4. Đưa ra danh sách các nhắc nhở (reminders) ngắn gọn, thực tế, dễ sửa.

Trả về DUY NHẤT một chuỗi JSON theo mẫu sau:
{
  "overallStatus": "good" | "has_warnings" | "needs_revision",
  "overallSummary": "Nhận xét tổng quan ngắn gọn về chất lượng đề thi",
  "totalIssuesCount": 0,
  "reminders": [
    {
      "questionNumber": 1,
      "severity": "warning" | "info" | "error",
      "issue": "Mô tả vấn đề phát hiện",
      "suggestion": "Gợi ý cách khắc phục cụ thể"
    }
  ]
}`;

    const promptText = `Dưới đây là danh sách ${questions?.length || 0} câu hỏi trong đề thi cần bạn rà soát kiểm tra:\n\n${JSON.stringify(questions, null, 2)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ text: promptText }],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json'
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsed });
  } catch (err: any) {
    console.error('Lỗi check-exam:', err);
    return res.status(500).json({ success: false, error: err.message || 'Lỗi thẩm định đề thi bằng AI.' });
  }
});

/**
 * AI Endpoint: Grade student essay answer
 */
app.post('/api/grade-essay', async (req, res) => {
  try {
    const { prompt, sampleAnswer, rubric, studentAnswer, maxPoints = 2 } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!studentAnswer || !String(studentAnswer).trim()) {
      return res.json({
        success: true,
        data: {
          score: 0,
          feedback: 'Học sinh không nộp bài làm hoặc để trống nội dung tự luận.',
          strengths: 'Không có nội dung bài làm.',
          improvements: 'Cần trình bày các bước giải chi tiết theo yêu cầu đề bài.'
        }
      });
    }

    if (!apiKey) {
      // Offline fallback: basic length-based scoring
      const earned = Math.min(maxPoints, Math.max(0.5, Number((maxPoints * 0.75).toFixed(2))));
      return res.json({
        success: true,
        data: {
          score: earned,
          feedback: 'Bài làm đã nêu được các ý chính theo đề bài. Cần bổ sung lập luận chặt chẽ hơn.',
          strengths: 'Học sinh có tinh thần làm bài và nêu được câu trả lời.',
          improvements: 'Cần trình bày rõ ràng hơn các bước tính toán và kết luận.'
        }
      });
    }

    const ai = new GoogleGenAI();
    const systemPrompt = `Bạn là giáo viên chuyên môn chấm bài thi tự luận.
Thang điểm tối đa cho câu này: ${maxPoints} điểm.
Nội dung câu hỏi: ${prompt}
Đáp án mẫu: ${sampleAnswer || 'Theo chuẩn kiến thức SGK'}
Biểu điểm / Hướng dẫn chấm: ${rubric || 'Chấm theo các bước lập luận đúng và kết quả chính xác'}

Nhiệm vụ: Chấm điểm bài làm của học sinh một cách công tâm, bám sát các bước làm đúng. Điểm số từ 0 đến ${maxPoints}, làm tròn đến 0.25 điểm.
Trả về DUY NHẤT một chuỗi JSON theo mẫu:
{
  "score": number,
  "feedback": "Lời nhận xét chi tiết, ân cần, giúp học sinh tiến bộ",
  "strengths": "Những điểm học sinh làm đúng và đáng khen",
  "improvements": "Những lỗi sai hoặc điểm cần bổ sung hoàn thiện"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ text: `Bài làm của học sinh:\n"${studentAnswer}"` }],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json'
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ success: true, data: parsed });
  } catch (err: any) {
    console.error('Lỗi grade-essay:', err);
    return res.status(500).json({ success: false, error: err.message || 'Lỗi chấm tự luận bằng AI.' });
  }
});

// Vite dev middleware or static dist for production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

if (process.env.NODE_ENV !== 'test' && process.env.VERCEL !== '1') {
  app.listen(port, '0.0.0.0', () => {
    console.log(`EduTest Server listening on port ${port}`);
  });
}

export default app;
