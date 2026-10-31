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
  Packer
} from 'docx';
import { Exam, Question } from '../types';
import { getQuestionFourSection } from './grading';

/**
 * Strips HTML tags, trims text, and cleans formulas
 */
function cleanText(html: string = ''): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Exports exam or answer key to native Microsoft Word (.docx) document
 */
export async function exportExamToWord(
  exam: Exam,
  questions: Question[],
  mode: 'exam' | 'answers' | 'full' = 'exam'
): Promise<void> {
  const safeTitle = (exam.title || 'De_thi')
    .replace(/[^a-zA-Z0-9à-ỹÀ-Ỹ\s-_]/g, '')
    .trim()
    .replace(/\s+/g, '_');

  const part1Questions = questions.filter(q => getQuestionFourSection(q) === 1);
  const part2Questions = questions.filter(q => getQuestionFourSection(q) === 2);
  const part3Questions = questions.filter(q => getQuestionFourSection(q) === 3);
  const part4Questions = questions.filter(q => getQuestionFourSection(q) === 4);

  const children: (Paragraph | Table)[] = [];

  // ==================== 1. HEADER (SCHOOL / EXAM INFO) ====================
  if (mode === 'exam' || mode === 'full') {
    // Two-column top table (Left: School info, Right: Exam info)
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
                    new TextRun({ text: 'SỞ GIÁO DỤC VÀ ĐÀO TẠO', bold: true, size: 21 }),
                  ],
                  alignment: AlignmentType.CENTER
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: 'TRƯỜNG THCS & THPT EDUTEST', bold: true, size: 22 }),
                  ],
                  alignment: AlignmentType.CENTER
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: '---------------------------', size: 18 }),
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
                    new TextRun({ text: 'KỲ THI KHẢO SÁT CHẤT LƯỢNG', bold: true, size: 22 }),
                  ],
                  alignment: AlignmentType.CENTER
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: `MÔN: ${(exam.subjectName || 'CHUNG').toUpperCase()}`, bold: true, size: 22 }),
                  ],
                  alignment: AlignmentType.CENTER
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Khối: ${exam.grade || '10'} - Thời gian: ${exam.durationMinutes || 45} phút`,
                      italics: true,
                      size: 20
                    }),
                  ],
                  alignment: AlignmentType.CENTER
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `(Không kể thời gian phát đề)`,
                      italics: true,
                      size: 18
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

    // Exam title & code
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: exam.title.toUpperCase(), bold: true, size: 26, color: '1e3a8a' })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 240, after: 120 }
      })
    );

    // Student identification box
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
                    new TextRun({ text: 'Họ và tên thí sinh: ..........................................................................', size: 20 }),
                  ],
                  spacing: { before: 60, after: 60 }
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Lớp: .................................... Số báo danh: .................................', size: 20 }),
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
                    new TextRun({ text: 'MÃ ĐỀ THI:', bold: true, size: 20 }),
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 60 }
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: exam.examCode || `MĐ-${exam.grade || '10'}1`,
                      bold: true,
                      size: 24,
                      color: '0f172a'
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

    // ==================== PART I: MULTIPLE CHOICE ====================
    if (part1Questions.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'PHẦN I. CÂU HỎI TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN',
              bold: true,
              size: 22,
              color: '0f172a'
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
              text: 'Thí sinh trả lời từ câu 1 đến câu ' + part1Questions.length + '. Mỗi câu hỏi thí sinh chỉ chọn một phương án trả lời đúng duy nhất.',
              italics: true,
              size: 20,
              color: '475569'
            })
          ],
          spacing: { after: 140 }
        })
      );

      part1Questions.forEach((q, idx) => {
        const qNum = idx + 1;
        const prompt = cleanText(q.prompt);
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `Câu ${qNum}: `, bold: true, size: 21, color: '1e293b' }),
              new TextRun({ text: prompt, size: 21 })
            ],
            spacing: { before: 120, after: 80 }
          })
        );

        if (q.options) {
          const optA = cleanText(q.options.A || '');
          const optB = cleanText(q.options.B || '');
          const optC = cleanText(q.options.C || '');
          const optD = cleanText(q.options.D || '');

          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: '   A. ', bold: true, size: 20 }),
                new TextRun({ text: `${optA}        `, size: 20 }),
                new TextRun({ text: 'B. ', bold: true, size: 20 }),
                new TextRun({ text: optB, size: 20 })
              ],
              spacing: { after: 40 }
            })
          );
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: '   C. ', bold: true, size: 20 }),
                new TextRun({ text: `${optC}        `, size: 20 }),
                new TextRun({ text: 'D. ', bold: true, size: 20 }),
                new TextRun({ text: optD, size: 20 })
              ],
              spacing: { after: 120 }
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
              size: 22,
              color: '0f172a'
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
              text: 'Thí sinh trả lời từ câu 1 đến câu ' + part2Questions.length + '. Trong mỗi ý a), b), c), d) ở mỗi câu, thí sinh chọn Đúng hoặc Sai.',
              italics: true,
              size: 20,
              color: '475569'
            })
          ],
          spacing: { after: 140 }
        })
      );

      part2Questions.forEach((q, idx) => {
        const qNum = idx + 1;
        const prompt = cleanText(q.prompt);
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `Câu ${qNum}: `, bold: true, size: 21, color: '1e293b' }),
              new TextRun({ text: prompt, size: 21 })
            ],
            spacing: { before: 120, after: 60 }
          })
        );

        const subList = q.subQuestions || [
          { key: 'a', text: 'Mệnh đề a', correct: true },
          { key: 'b', text: 'Mệnh đề b', correct: false },
          { key: 'c', text: 'Mệnh đề c', correct: true },
          { key: 'd', text: 'Mệnh đề d', correct: false }
        ];

        subList.forEach(sub => {
          const subText = cleanText(sub.text);
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `   ${sub.key}) `, bold: true, size: 20 }),
                new TextRun({ text: subText, size: 20 })
              ],
              spacing: { after: 40 }
            })
          );
        });
      });
    }

    // ==================== PART III: SHORT ANSWER / FILL BLANK ====================
    if (part3Questions.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'PHẦN III. CÂU HỎI TRẢ LỜI NGẮN & ĐIỀN KHUYẾT',
              bold: true,
              size: 22,
              color: '0f172a'
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
              text: 'Thí sinh trả lời từ câu 1 đến câu ' + part3Questions.length + '. Thí sinh điền đáp số vào ô trống.',
              italics: true,
              size: 20,
              color: '475569'
            })
          ],
          spacing: { after: 140 }
        })
      );

      part3Questions.forEach((q, idx) => {
        const qNum = idx + 1;
        const prompt = cleanText(q.prompt);
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `Câu ${qNum}: `, bold: true, size: 21, color: '1e293b' }),
              new TextRun({ text: prompt, size: 21 })
            ],
            spacing: { before: 120, after: 60 }
          })
        );
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: '   Đáp số: ........................................................................................', italics: true, size: 20, color: '64748b' })
            ],
            spacing: { after: 100 }
          })
        );
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
              size: 22,
              color: '0f172a'
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
              text: 'Thí sinh trình bày lời giải chi tiết cho các câu hỏi sau:',
              italics: true,
              size: 20,
              color: '475569'
            })
          ],
          spacing: { after: 140 }
        })
      );

      part4Questions.forEach((q, idx) => {
        const qNum = idx + 1;
        const prompt = cleanText(q.prompt);
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `Câu ${qNum} (${q.points || 1.5} điểm): `, bold: true, size: 21, color: '1e293b' }),
              new TextRun({ text: prompt, size: 21 })
            ],
            spacing: { before: 120, after: 80 }
          })
        );
        // Answer lines
        for (let l = 0; l < 4; l++) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: '................................................................................................................................................................', size: 18, color: 'cbd5e1' })
              ],
              spacing: { after: 40 }
            })
          );
        }
      });
    }

    // End of exam footer mark
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: '----------------------- HẾT -----------------------', bold: true, size: 20 })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 300, after: 200 }
      })
    );
  }

  // ==================== 2. ANSWER KEY & RUBRIC SECTION ====================
  if (mode === 'answers' || mode === 'full') {
    // If combined mode, add page break
    if (mode === 'full') {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: '', break: 1 })
          ]
        })
      );
    }

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `ĐÁP ÁN VÀ HƯỚNG DẪN CHẤM: ${exam.title.toUpperCase()}`,
            bold: true,
            size: 26,
            color: '047857'
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 100 }
      })
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Môn: ${exam.subjectName} - Khối: ${exam.grade || '10'} - Thang điểm chuẩn: ${exam.maxScore || 10} điểm`,
            italics: true,
            size: 20
          })
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 }
      })
    );

    // Bảng đáp án Phần I
    if (part1Questions.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: '1. BẢNG ĐÁP ÁN PHẦN I (TRẮC NGHIỆM 4 PHƯƠNG ÁN)', bold: true, size: 21, color: '1e3a8a' })
          ],
          spacing: { before: 140, after: 80 }
        })
      );

      // Matrix Table: 10 questions per row
      const tableRows: TableRow[] = [];
      const chunkSize = 10;
      for (let i = 0; i < part1Questions.length; i += chunkSize) {
        const slice = part1Questions.slice(i, i + chunkSize);
        
        // Header row (Question numbers)
        tableRows.push(
          new TableRow({
            children: slice.map((_, sIdx) => 
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: `Câu ${i + sIdx + 1}`, bold: true, size: 18 })], alignment: AlignmentType.CENTER })],
                width: { size: Math.floor(100 / slice.length), type: WidthType.PERCENTAGE }
              })
            )
          })
        );

        // Key row (Correct letters)
        tableRows.push(
          new TableRow({
            children: slice.map((q) => 
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: q.correctOption || '-', bold: true, size: 22, color: 'b91c1c' })], alignment: AlignmentType.CENTER })],
                width: { size: Math.floor(100 / slice.length), type: WidthType.PERCENTAGE }
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
            new TextRun({ text: '2. BẢNG ĐÁP ÁN PHẦN II (ĐÚNG / SAI)', bold: true, size: 21, color: '1e3a8a' })
          ],
          spacing: { before: 140, after: 80 }
        })
      );

      const tfRows: TableRow[] = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Câu', bold: true, size: 19 })], alignment: AlignmentType.CENTER })], width: { size: 20, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Lệnh hỏi a)', bold: true, size: 19 })], alignment: AlignmentType.CENTER })], width: { size: 20, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Lệnh hỏi b)', bold: true, size: 19 })], alignment: AlignmentType.CENTER })], width: { size: 20, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Lệnh hỏi c)', bold: true, size: 19 })], alignment: AlignmentType.CENTER })], width: { size: 20, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Lệnh hỏi d)', bold: true, size: 19 })], alignment: AlignmentType.CENTER })], width: { size: 20, type: WidthType.PERCENTAGE } }),
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
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Câu ${idx + 1}`, bold: true, size: 19 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: findVal('a'), bold: true, color: findVal('a') === 'Đ' ? '047857' : 'b91c1c', size: 20 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: findVal('b'), bold: true, color: findVal('b') === 'Đ' ? '047857' : 'b91c1c', size: 20 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: findVal('c'), bold: true, color: findVal('c') === 'Đ' ? '047857' : 'b91c1c', size: 20 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: findVal('d'), bold: true, color: findVal('d') === 'Đ' ? '047857' : 'b91c1c', size: 20 })], alignment: AlignmentType.CENTER })] }),
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
            new TextRun({ text: '3. BẢNG ĐÁP ÁN PHẦN III (TRẢ LỜI NGẮN)', bold: true, size: 21, color: '1e3a8a' })
          ],
          spacing: { before: 140, after: 80 }
        })
      );

      const p3Rows: TableRow[] = [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Câu', bold: true, size: 19 })], alignment: AlignmentType.CENTER })], width: { size: 20, type: WidthType.PERCENTAGE } }),
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Đáp án chấp nhận / Kết quả', bold: true, size: 19 })] })], width: { size: 80, type: WidthType.PERCENTAGE } }),
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
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `Câu ${idx + 1}`, bold: true, size: 19 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: answers, bold: true, color: '047857', size: 19 })] })] }),
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

    // Hướng dẫn chấm chi tiết Phần IV (Tự luận)
    if (part4Questions.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: '4. HƯỚNG DẪN CHẤM PHẦN IV (TỰ LUẬN)', bold: true, size: 21, color: '1e3a8a' })
          ],
          spacing: { before: 140, after: 80 }
        })
      );

      part4Questions.forEach((q, idx) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `Câu ${idx + 1} (${q.points || 1.5} điểm): `, bold: true, size: 20, color: '0f172a' }),
              new TextRun({ text: cleanText(q.prompt), size: 20 })
            ],
            spacing: { before: 100, after: 40 }
          })
        );

        if (q.sampleAnswer) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: '   • Lời giải mẫu / Hướng dẫn giải: ', bold: true, size: 19, color: '047857' }),
                new TextRun({ text: cleanText(q.sampleAnswer), size: 19 })
              ],
              spacing: { after: 40 }
            })
          );
        }

        if (q.rubric) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: '   • Biểu điểm chi tiết (Rubric): ', bold: true, size: 19, color: '1e3a8a' }),
                new TextRun({ text: cleanText(q.rubric), size: 19 })
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
  const fileSuffix = mode === 'answers' ? 'Dap_an' : mode === 'full' ? 'De_thi_kem_Dap_an' : 'De_thi';
  const fileName = `${fileSuffix}_${safeTitle}_${new Date().toISOString().slice(0, 10)}.docx`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
