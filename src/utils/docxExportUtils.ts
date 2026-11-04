import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  HeadingLevel,
  Packer,
  PageBreak
} from 'docx';
import { Exam, Question } from '../types';
import { getQuestionFourSection } from './grading';
import { parseTextToDocxRuns, stripCommentsAndHtml, latexToUnicodeMath } from './mathConverter';

export type WordExportMode = 
  | 'exam_only'              // 1. Xuất đề thi không có đáp án
  | 'exam_with_key'          // 2. Xuất đề thi có đáp án (gạch chân / in đậm đáp án đúng)
  | 'exam_with_explanations'  // 3. Xuất đề thi có lời giải chi tiết
  | 'answers_only'           // 4. Xuất đáp án riêng (Bảng ma trận)
  | 'full_combined';         // 5. Xuất đề và đáp án trong cùng một tài liệu

export interface WordExportOptions {
  schoolName?: string;
  departmentName?: string;
  fontSize?: number; // default 21 (10.5pt) or 22 (11pt)
  fontFamily?: string;
  includeStudentBox?: boolean;
}

/**
 * Exports exam to native Microsoft Word (.docx) document with Office Math (OMML) support
 */
export async function exportExamToWord(
  exam: Exam,
  questions: Question[],
  mode: WordExportMode | 'exam' | 'answers' | 'full' = 'exam_only',
  options: WordExportOptions = {}
): Promise<void> {
  // Normalize legacy mode arguments
  let normalizedMode: WordExportMode = 'exam_only';
  if (mode === 'exam' || mode === 'exam_only') normalizedMode = 'exam_only';
  else if (mode === 'answers' || mode === 'answers_only') normalizedMode = 'answers_only';
  else if (mode === 'full' || mode === 'full_combined') normalizedMode = 'full_combined';
  else if (mode === 'exam_with_key') normalizedMode = 'exam_with_key';
  else if (mode === 'exam_with_explanations') normalizedMode = 'exam_with_explanations';

  const safeTitle = (exam.title || 'De_thi')
    .replace(/[^a-zA-Z0-9à-ỹÀ-Ỹ\s-_]/g, '')
    .trim()
    .replace(/\s+/g, '_');

  const part1Questions = questions.filter(q => getQuestionFourSection(q) === 1);
  const part2Questions = questions.filter(q => getQuestionFourSection(q) === 2);
  const part3Questions = questions.filter(q => getQuestionFourSection(q) === 3);
  const part4Questions = questions.filter(q => getQuestionFourSection(q) === 4);

  const children: (Paragraph | Table)[] = [];
  const baseSize = options.fontSize || 22; // 11pt

  // Helper to build a question prompt paragraph with OMML math
  const createPromptParagraph = (qNum: number, promptText: string, points?: number) => {
    const mathRuns = parseTextToDocxRuns(promptText, { size: baseSize });
    return new Paragraph({
      children: [
        new TextRun({ 
          text: `Câu ${qNum}${points ? ` (${points} điểm)` : ''}: `, 
          bold: true, 
          size: baseSize, 
          color: '0f172a',
          font: 'Times New Roman'
        }),
        ...mathRuns
      ],
      spacing: { before: 140, after: 80 }
    });
  };

  // ==================== 1. HEADER (SCHOOL / EXAM INFO) ====================
  if (normalizedMode !== 'answers_only') {
    const headerTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE }
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: options.departmentName || 'SỞ GIÁO DỤC VÀ ĐÀO TẠO', bold: true, size: baseSize - 1, font: 'Times New Roman' }),
                  ],
                  alignment: AlignmentType.CENTER
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: options.schoolName || 'TRƯỜNG THCS & THPT EDUTEST', bold: true, size: baseSize, font: 'Times New Roman' }),
                  ],
                  alignment: AlignmentType.CENTER
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: '---------------------------', size: baseSize - 4, font: 'Times New Roman' }),
                  ],
                  alignment: AlignmentType.CENTER
                })
              ]
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'KỲ THI KHẢO SÁT CHẤT LƯỢNG', bold: true, size: baseSize, font: 'Times New Roman' }),
                  ],
                  alignment: AlignmentType.CENTER
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: `MÔN: ${(exam.subjectName || 'CHUNG').toUpperCase()}`, bold: true, size: baseSize, font: 'Times New Roman' }),
                  ],
                  alignment: AlignmentType.CENTER
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Khối: ${exam.grade || '10'} - Thời gian: ${exam.durationMinutes || 45} phút`,
                      italics: true,
                      size: baseSize - 2,
                      font: 'Times New Roman'
                    }),
                  ],
                  alignment: AlignmentType.CENTER
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `(Không kể thời gian phát đề)`,
                      italics: true,
                      size: baseSize - 4,
                      font: 'Times New Roman'
                    }),
                  ],
                  alignment: AlignmentType.CENTER
                })
              ]
            })
          ]
        })
      ]
    });

    children.push(headerTable);

    // Exam title
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: exam.title.toUpperCase(), bold: true, size: baseSize + 4, color: '1e3a8a', font: 'Times New Roman' })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 120 }
      })
    );

    // Student identification box
    if (options.includeStudentBox !== false) {
      const studentBox = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: 'cbd5e1' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'cbd5e1' },
          left: { style: BorderStyle.SINGLE, size: 1, color: 'cbd5e1' },
          right: { style: BorderStyle.SINGLE, size: 1, color: 'cbd5e1' },
          insideHorizontal: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE }
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 70, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: 'Họ và tên thí sinh: ..........................................................................', size: baseSize - 2, font: 'Times New Roman' }),
                    ],
                    spacing: { before: 60, after: 60 }
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: 'Lớp: .................................... Số báo danh: .................................', size: baseSize - 2, font: 'Times New Roman' }),
                    ],
                    spacing: { before: 60, after: 60 }
                  })
                ]
              }),
              new TableCell({
                width: { size: 30, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: 'MÃ ĐỀ THI:', bold: true, size: baseSize - 2, font: 'Times New Roman' }),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 60 }
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: exam.examCode || `MĐ-${exam.grade || '10'}1`,
                        bold: true,
                        size: baseSize + 2,
                        color: '0f172a',
                        font: 'Times New Roman'
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 60 }
                  })
                ]
              })
            ]
          })
        ]
      });

      children.push(studentBox);
      children.push(new Paragraph({ spacing: { after: 200 } }));
    }

    // ==================== PART I: MULTIPLE CHOICE ====================
    if (part1Questions.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'PHẦN I. CÂU HỎI TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN',
              bold: true,
              size: baseSize,
              color: '0f172a',
              font: 'Times New Roman'
            })
          ],
          spacing: { before: 200, after: 60 },
          heading: HeadingLevel.HEADING_2
        })
      );
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Thí sinh trả lời từ câu 1 đến câu ${part1Questions.length}. Mỗi câu hỏi thí sinh chỉ chọn một phương án trả lời đúng duy nhất.`,
              italics: true,
              size: baseSize - 2,
              color: '475569',
              font: 'Times New Roman'
            })
          ],
          spacing: { after: 140 }
        })
      );

      part1Questions.forEach((q, idx) => {
        const qNum = idx + 1;
        children.push(createPromptParagraph(qNum, q.prompt, q.points));

        if (q.options) {
          (['A', 'B', 'C', 'D'] as const).forEach(key => {
            const optRaw = q.options?.[key] || '';
            const isCorrect = (normalizedMode === 'exam_with_key' || normalizedMode === 'exam_with_explanations') && q.correctOption === key;

            const optMathRuns = parseTextToDocxRuns(optRaw, { 
              size: baseSize - 1,
              bold: isCorrect,
              color: isCorrect ? '047857' : '1e293b'
            });

            children.push(
              new Paragraph({
                children: [
                  new TextRun({ 
                    text: `   ${key}. `, 
                    bold: true, 
                    size: baseSize - 1, 
                    color: isCorrect ? '047857' : '0f172a',
                    font: 'Times New Roman'
                  }),
                  ...optMathRuns,
                  ...(isCorrect ? [new TextRun({ text: '  ✓ [Đáp án đúng]', bold: true, size: baseSize - 3, color: '047857', italics: true })] : [])
                ],
                spacing: { after: 40 }
              })
            );
          });
        }

        // Detailed Explanation if requested
        if (normalizedMode === 'exam_with_explanations' && q.explanation) {
          const expRuns = parseTextToDocxRuns(q.explanation, { size: baseSize - 2, italics: true, color: '0f766e' });
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: '   ➜ Lời giải chi tiết: ', bold: true, size: baseSize - 2, color: '0f766e', font: 'Times New Roman' }),
                ...expRuns
              ],
              spacing: { before: 60, after: 100 }
            })
          );
        }
      });
    }

    // ==================== PART II: TRUE / FALSE ====================
    if (part2Questions.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'PHẦN II. CÂU HỎI TRẮC NGHIỆM ĐÚNG / SAI',
              bold: true,
              size: baseSize,
              color: '0f172a',
              font: 'Times New Roman'
            })
          ],
          spacing: { before: 260, after: 60 },
          heading: HeadingLevel.HEADING_2
        })
      );
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Thí sinh trả lời từ câu 1 đến câu ${part2Questions.length}. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn Đúng hoặc Sai.`,
              italics: true,
              size: baseSize - 2,
              color: '475569',
              font: 'Times New Roman'
            })
          ],
          spacing: { after: 140 }
        })
      );

      part2Questions.forEach((q, idx) => {
        const qNum = idx + 1;
        children.push(createPromptParagraph(qNum, q.prompt, q.points));

        const subList = q.subQuestions || [];
        subList.forEach(sub => {
          const isKeyMode = normalizedMode === 'exam_with_key' || normalizedMode === 'exam_with_explanations';
          const subMathRuns = parseTextToDocxRuns(sub.text, { size: baseSize - 1 });

          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `   ${sub.key}) `, bold: true, size: baseSize - 1, font: 'Times New Roman' }),
                ...subMathRuns,
                ...(isKeyMode ? [
                  new TextRun({ 
                    text: sub.correct ? '  ➜ [ĐÚNG]' : '  ➜ [SAI]', 
                    bold: true, 
                    size: baseSize - 2, 
                    color: sub.correct ? '047857' : 'b91c1c' 
                  })
                ] : [])
              ],
              spacing: { after: 40 }
            })
          );
        });

        // Explanation
        if (normalizedMode === 'exam_with_explanations' && q.explanation) {
          const expRuns = parseTextToDocxRuns(q.explanation, { size: baseSize - 2, italics: true, color: '0f766e' });
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: '   ➜ Lời giải chi tiết: ', bold: true, size: baseSize - 2, color: '0f766e', font: 'Times New Roman' }),
                ...expRuns
              ],
              spacing: { before: 60, after: 100 }
            })
          );
        }
      });
    }

    // ==================== PART III: SHORT ANSWER ====================
    if (part3Questions.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'PHẦN III. CÂU HỎI TRẮC NGHIỆM TRẢ LỜI NGẮN',
              bold: true,
              size: baseSize,
              color: '0f172a',
              font: 'Times New Roman'
            })
          ],
          spacing: { before: 260, after: 60 },
          heading: HeadingLevel.HEADING_2
        })
      );
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Thí sinh trả lời từ câu 1 đến câu ${part3Questions.length}. Điền câu trả lời ngắn hoặc kết quả tính toán vào phiếu trả lời.`,
              italics: true,
              size: baseSize - 2,
              color: '475569',
              font: 'Times New Roman'
            })
          ],
          spacing: { after: 140 }
        })
      );

      part3Questions.forEach((q, idx) => {
        const qNum = idx + 1;
        children.push(createPromptParagraph(qNum, q.prompt, q.points));

        if (normalizedMode === 'exam_with_key' || normalizedMode === 'exam_with_explanations') {
          const answers = q.acceptableAnswers?.length ? q.acceptableAnswers.join(' hoặc ') : (q.correctOption || 'Theo hướng dẫn');
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: '   ➜ Đáp án chấp nhận: ', bold: true, size: baseSize - 2, color: '047857', font: 'Times New Roman' }),
                new TextRun({ text: answers, bold: true, size: baseSize - 1, color: '047857' })
              ],
              spacing: { after: 40 }
            })
          );
        }

        if (normalizedMode === 'exam_with_explanations' && q.explanation) {
          const expRuns = parseTextToDocxRuns(q.explanation, { size: baseSize - 2, italics: true, color: '0f766e' });
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: '   ➜ Lời giải chi tiết: ', bold: true, size: baseSize - 2, color: '0f766e', font: 'Times New Roman' }),
                ...expRuns
              ],
              spacing: { before: 60, after: 100 }
            })
          );
        }
      });
    }

    // ==================== PART IV: ESSAY ====================
    if (part4Questions.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'PHẦN IV. CÂU HỎI TỰ LUẬN',
              bold: true,
              size: baseSize,
              color: '0f172a',
              font: 'Times New Roman'
            })
          ],
          spacing: { before: 260, after: 60 },
          heading: HeadingLevel.HEADING_2
        })
      );

      part4Questions.forEach((q, idx) => {
        const qNum = idx + 1;
        children.push(createPromptParagraph(qNum, q.prompt, q.points));

        if (normalizedMode === 'exam_with_explanations') {
          if (q.sampleAnswer) {
            const ansRuns = parseTextToDocxRuns(q.sampleAnswer, { size: baseSize - 2, color: '047857' });
            children.push(
              new Paragraph({
                children: [
                  new TextRun({ text: '   • Hướng dẫn giải mẫu: ', bold: true, size: baseSize - 2, color: '047857', font: 'Times New Roman' }),
                  ...ansRuns
                ],
                spacing: { after: 40 }
              })
            );
          }
          if (q.rubric) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({ text: '   • Biểu điểm chi tiết: ', bold: true, size: baseSize - 2, color: '1e3a8a', font: 'Times New Roman' }),
                  new TextRun({ text: stripCommentsAndHtml(q.rubric), size: baseSize - 2, color: '475569' })
                ],
                spacing: { after: 60 }
              })
            );
          }
        }
      });
    }

    // End of exam marker
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: '---------- HẾT ----------', bold: true, size: baseSize - 2, font: 'Times New Roman' })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 280, after: 200 }
      })
    );
  }

  // ==================== 2. SEPARATE OR COMBINED ANSWER KEY TABLES ====================
  if (normalizedMode === 'answers_only' || normalizedMode === 'full_combined') {
    if (normalizedMode === 'full_combined') {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    // Answer Key Header
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: 'BẢNG ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM CHÍNH THỨC', bold: true, size: baseSize + 3, color: '047857', font: 'Times New Roman' })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 160, after: 80 }
      })
    );

    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `ĐỀ THI: ${exam.title.toUpperCase()}`, bold: true, size: baseSize, color: '1e3a8a', font: 'Times New Roman' })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 180 }
      })
    );

    // Bảng đáp án Phần I
    if (part1Questions.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: '1. BẢNG ĐÁP ÁN PHẦN I (TRẮC NGHIỆM NHIỀU LỰA CHỌN)', bold: true, size: baseSize, color: '1e3a8a', font: 'Times New Roman' })
          ],
          spacing: { before: 140, after: 80 }
        })
      );

      const tableRows: TableRow[] = [];
      const chunkSize = 10;
      for (let i = 0; i < part1Questions.length; i += chunkSize) {
        const chunk = part1Questions.slice(i, i + chunkSize);
        
        // Row 1: Câu
        tableRows.push(
          new TableRow({
            children: chunk.map((_, cIdx) => 
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: `Câu ${i + cIdx + 1}`, bold: true, size: baseSize - 3 })], alignment: AlignmentType.CENTER })],
                width: { size: 100 / chunkSize, type: WidthType.PERCENTAGE }
              })
            )
          })
        );

        // Row 2: Đáp án
        tableRows.push(
          new TableRow({
            children: chunk.map(q => 
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: q.correctOption || 'A', bold: true, color: '047857', size: baseSize - 1 })], alignment: AlignmentType.CENTER })],
                width: { size: 100 / chunkSize, type: WidthType.PERCENTAGE }
              })
            )
          })
        );
      }

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: tableRows
        })
      );
      children.push(new Paragraph({ spacing: { after: 160 } }));
    }

    // Bảng đáp án Phần II
    if (part2Questions.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: '2. BẢNG ĐÁP ÁN PHẦN II (ĐÚNG / SAI)', bold: true, size: baseSize, color: '1e3a8a', font: 'Times New Roman' })
          ],
          spacing: { before: 140, after: 80 }
        })
      );

      const tfRows: TableRow[] = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Câu', bold: true, size: baseSize - 3 })], alignment: AlignmentType.CENTER })], width: { size: 20, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Ý a)', bold: true, size: baseSize - 3 })], alignment: AlignmentType.CENTER })], width: { size: 20, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Ý b)', bold: true, size: baseSize - 3 })], alignment: AlignmentType.CENTER })], width: { size: 20, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Ý c)', bold: true, size: baseSize - 3 })], alignment: AlignmentType.CENTER })], width: { size: 20, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Ý d)', bold: true, size: baseSize - 3 })], alignment: AlignmentType.CENTER })], width: { size: 20, type: WidthType.PERCENTAGE } }),
          ]
        })
      ];

      part2Questions.forEach((q, idx) => {
        const subList = q.subQuestions || [];
        const findVal = (k: string) => {
          const item = subList.find(s => s.key === k);
          return item ? (item.correct ? 'Đ' : 'S') : '-';
        };

        tfRows.push(
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Câu ${idx + 1}`, bold: true, size: baseSize - 3 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: findVal('a'), bold: true, color: findVal('a') === 'Đ' ? '047857' : 'b91c1c', size: baseSize - 1 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: findVal('b'), bold: true, color: findVal('b') === 'Đ' ? '047857' : 'b91c1c', size: baseSize - 1 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: findVal('c'), bold: true, color: findVal('c') === 'Đ' ? '047857' : 'b91c1c', size: baseSize - 1 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: findVal('d'), bold: true, color: findVal('d') === 'Đ' ? '047857' : 'b91c1c', size: baseSize - 1 })], alignment: AlignmentType.CENTER })] }),
            ]
          })
        );
      });

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: tfRows
        })
      );
      children.push(new Paragraph({ spacing: { after: 160 } }));
    }

    // Bảng đáp án Phần III
    if (part3Questions.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: '3. BẢNG ĐÁP ÁN PHẦN III (TRẢ LỜI NGẮN)', bold: true, size: baseSize, color: '1e3a8a', font: 'Times New Roman' })
          ],
          spacing: { before: 140, after: 80 }
        })
      );

      const p3Rows: TableRow[] = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Câu', bold: true, size: baseSize - 3 })], alignment: AlignmentType.CENTER })], width: { size: 20, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Đáp án chấp nhận / Kết quả', bold: true, size: baseSize - 3 })] })], width: { size: 80, type: WidthType.PERCENTAGE } }),
          ]
        })
      ];

      part3Questions.forEach((q, idx) => {
        const answers = (q.acceptableAnswers && q.acceptableAnswers.length > 0)
          ? q.acceptableAnswers.join(' hoặc ')
          : (q.correctOption || q.sampleAnswer || 'Theo hướng dẫn chấm');

        p3Rows.push(
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Câu ${idx + 1}`, bold: true, size: baseSize - 3 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: answers, bold: true, color: '047857', size: baseSize - 2 })] })] }),
            ]
          })
        );
      });

      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: p3Rows
        })
      );
      children.push(new Paragraph({ spacing: { after: 160 } }));
    }

    // Phần IV Hướng dẫn chấm tự luận
    if (part4Questions.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: '4. HƯỚNG DẪN CHẤM PHẦN IV (TỰ LUẬN)', bold: true, size: baseSize, color: '1e3a8a', font: 'Times New Roman' })
          ],
          spacing: { before: 140, after: 80 }
        })
      );

      part4Questions.forEach((q, idx) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `Câu ${idx + 1} (${q.points || 1.5} điểm): `, bold: true, size: baseSize - 1, color: '0f172a', font: 'Times New Roman' }),
              ...parseTextToDocxRuns(q.prompt, { size: baseSize - 1 })
            ],
            spacing: { before: 100, after: 40 }
          })
        );

        if (q.sampleAnswer) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: '   • Lời giải mẫu: ', bold: true, size: baseSize - 2, color: '047857', font: 'Times New Roman' }),
                ...parseTextToDocxRuns(q.sampleAnswer, { size: baseSize - 2, color: '047857' })
              ],
              spacing: { after: 40 }
            })
          );
        }

        if (q.rubric) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: '   • Biểu điểm chi tiết: ', bold: true, size: baseSize - 2, color: '1e3a8a', font: 'Times New Roman' }),
                new TextRun({ text: stripCommentsAndHtml(q.rubric), size: baseSize - 2, color: '475569' })
              ],
              spacing: { after: 60 }
            })
          );
        }
      });
    }
  }

  // Build Word document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              bottom: 1440,
              left: 1440,
              right: 1440
            }
          }
        },
        children
      }
    ]
  });

  // Pack to Blob and trigger download
  const blob = await Packer.toBlob(doc);
  const fileSuffix = normalizedMode === 'answers_only' 
    ? 'Dap_an' 
    : normalizedMode === 'full_combined' 
    ? 'De_thi_va_Dap_an' 
    : normalizedMode === 'exam_with_key'
    ? 'De_thi_co_Dap_an'
    : normalizedMode === 'exam_with_explanations'
    ? 'De_thi_kem_Loi_giai'
    : 'De_thi';

  const fileName = `${fileSuffix}_${safeTitle}_${new Date().toISOString().slice(0, 10)}.docx`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
