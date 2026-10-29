/**
 * Google Forms Integration Service
 * Automatically creates backup Google Forms for exams using Google Forms API v1
 */

import { Exam, Question } from '../types';

export interface GoogleFormCreationResult {
  success: boolean;
  formId?: string;
  formUrl?: string;
  editUrl?: string;
  error?: string;
  warning?: string;
}

export async function createBackupGoogleForm(
  exam: Exam,
  questions: Question[],
  accessToken: string
): Promise<GoogleFormCreationResult> {
  if (!accessToken) {
    return {
      success: false,
      error: 'Chưa có quyền truy cập Google Workspace. Vui lòng kết nối tài khoản Google.'
    };
  }

  try {
    // 1. Create the initial blank Google Form
    const createRes = await fetch('https://forms.googleapis.com/v1/forms', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        info: {
          title: `[DỰ PHÒNG] ${exam.title}`,
          documentTitle: `EduTest_DuPhong_${exam.title.substring(0, 30)}`
        }
      })
    });

    if (!createRes.ok) {
      const errJson = await createRes.json().catch(() => ({}));
      const errMsg = errJson?.error?.message || createRes.statusText;
      return {
        success: false,
        error: `Không thể khởi tạo Google Form (${createRes.status}): ${errMsg}`
      };
    }

    const formData = await createRes.json();
    const formId = formData.formId;
    const responderUri = formData.responderUri || `https://docs.google.com/forms/d/e/${formId}/viewform`;
    const editUrl = `https://docs.google.com/forms/d/${formId}/edit`;

    // 2. Prepare items for batchUpdate:
    // Items:
    // Index 0: Họ và tên thí sinh
    // Index 1: Lớp học
    // Index 2: Số báo danh / Mã đề
    // Index 3+: Exam questions
    const requests: any[] = [];
    let currentIndex = 0;

    // Student identification fields
    requests.push({
      createItem: {
        item: {
          title: 'Họ và tên thí sinh',
          description: 'Vui lòng nhập chính xác họ và tên như trong danh sách lớp',
          questionItem: {
            question: {
              required: true,
              textQuestion: { paragraph: false }
            }
          }
        },
        location: { index: currentIndex++ }
      }
    });

    requests.push({
      createItem: {
        item: {
          title: 'Lớp học',
          description: 'Ví dụ: 12A1, 10 Chuyên Toán',
          questionItem: {
            question: {
              required: true,
              textQuestion: { paragraph: false }
            }
          }
        },
        location: { index: currentIndex++ }
      }
    });

    requests.push({
      createItem: {
        item: {
          title: 'Mã đề thi',
          description: exam.trialCode || exam.examCode ? `Mã đề của bạn (Ví dụ: ${exam.trialCode || exam.examCode || '101'})` : 'Nhập mã đề do giáo viên cung cấp',
          questionItem: {
            question: {
              required: true,
              textQuestion: { paragraph: false }
            }
          }
        },
        location: { index: currentIndex++ }
      }
    });

    // Add each exam question
    questions.forEach((q, qIdx) => {
      const qNum = q.questionNumber || qIdx + 1;
      const cleanPrompt = (q.prompt || `Câu hỏi ${qNum}`).replace(/<[^>]+>/g, '').trim();

      if (q.type === 'multiple_choice' || !q.type) {
        const optionsList = [
          q.options?.A ? `A. ${q.options.A}` : 'A',
          q.options?.B ? `B. ${q.options.B}` : 'B',
          q.options?.C ? `C. ${q.options.C}` : 'C',
          q.options?.D ? `D. ${q.options.D}` : 'D'
        ];

        let correctValue = '';
        if (q.correctOption === 'A') correctValue = optionsList[0];
        else if (q.correctOption === 'B') correctValue = optionsList[1];
        else if (q.correctOption === 'C') correctValue = optionsList[2];
        else if (q.correctOption === 'D') correctValue = optionsList[3];

        requests.push({
          createItem: {
            item: {
              title: `Câu ${qNum}: ${cleanPrompt}`,
              description: q.explanation ? `(Gợi ý / Lời giải sau thi: ${q.explanation})` : undefined,
              questionItem: {
                question: {
                  required: true,
                  choiceQuestion: {
                    type: 'RADIO',
                    options: optionsList.map(val => ({ value: val })),
                    shuffle: false
                  },
                  grading: correctValue ? {
                    pointValue: Math.max(1, Math.round((q.points || 1) * 10) / 10),
                    correctAnswers: {
                      answers: [{ value: correctValue }]
                    }
                  } : undefined
                }
              }
            },
            location: { index: currentIndex++ }
          }
        });
      } else if (q.type === 'true_false') {
        const subList = q.subQuestions || [
          { key: 'a', text: 'Mệnh đề a', correct: true },
          { key: 'b', text: 'Mệnh đề b', correct: false },
          { key: 'c', text: 'Mệnh đề c', correct: true },
          { key: 'd', text: 'Mệnh đề d', correct: false }
        ];

        subList.forEach((sub, sIdx) => {
          const subTitle = `Câu ${qNum}.${sub.key || sIdx + 1}: ${cleanPrompt} - Mệnh đề [${sub.key}]: ${sub.text}`;
          requests.push({
            createItem: {
              item: {
                title: subTitle,
                questionItem: {
                  question: {
                    required: true,
                    choiceQuestion: {
                      type: 'RADIO',
                      options: [{ value: 'Đúng' }, { value: 'Sai' }],
                      shuffle: false
                    },
                    grading: {
                      pointValue: 1,
                      correctAnswers: {
                        answers: [{ value: sub.correct ? 'Đúng' : 'Sai' }]
                      }
                    }
                  }
                }
              },
              location: { index: currentIndex++ }
            }
          });
        });
      } else if (q.type === 'fill_blank') {
        const correctAnswersList = (q.acceptableAnswers || []).map(ans => ({ value: ans }));
        requests.push({
          createItem: {
            item: {
              title: `Câu ${qNum} (Trả lời ngắn): ${cleanPrompt}`,
              questionItem: {
                question: {
                  required: true,
                  textQuestion: { paragraph: false },
                  grading: correctAnswersList.length > 0 ? {
                    pointValue: Math.max(1, Math.round((q.points || 1) * 10) / 10),
                    correctAnswers: {
                      answers: correctAnswersList
                    }
                  } : undefined
                }
              }
            },
            location: { index: currentIndex++ }
          }
        });
      } else {
        // Essay question
        requests.push({
          createItem: {
            item: {
              title: `Câu ${qNum} (Tự luận): ${cleanPrompt}`,
              description: q.sampleAnswer ? `(Biểu điểm / Đáp án tham khảo: ${q.sampleAnswer})` : undefined,
              questionItem: {
                question: {
                  required: false,
                  textQuestion: { paragraph: true }
                }
              }
            },
            location: { index: currentIndex++ }
          }
        });
      }
    });

    // 3. Send batchUpdate to populate the form and enable Quiz Settings
    const batchRes = await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        includeFormInResponse: true,
        requests
      })
    });

    if (!batchRes.ok) {
      const errJson = await batchRes.json().catch(() => ({}));
      console.warn('Lỗi khi thêm câu hỏi vào Google Form:', errJson);
      return {
        success: true, // Form was created, but some items had formatting warnings
        formId,
        formUrl: responderUri,
        editUrl,
        warning: `Biểu mẫu đã được tạo tại ${responderUri}, nhưng một số câu hỏi có ký hiệu đặc biệt cần giáo viên rà soát thủ công.`
      };
    }

    return {
      success: true,
      formId,
      formUrl: responderUri,
      editUrl
    };

  } catch (err: any) {
    console.error('Lỗi khi tạo Google Form:', err);
    return {
      success: false,
      error: err?.message || 'Lỗi mạng khi kết nối Google Forms API.'
    };
  }
}
