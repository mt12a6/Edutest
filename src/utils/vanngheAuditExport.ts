import * as XLSX from 'xlsx';

export type AuditCapHoc = 'tieuhoc' | 'thcs' | 'unknown';
export type AuditFormType = 'phieu_cham' | 'tong_hop' | 'unknown';

export interface AuditChamRow {
  id: string;
  sourceFile: string;
  pageOrSheet: string;
  rowNumber: number;
  capHoc: AuditCapHoc;
  giamKhao: string | null;
  namHoc: string | null;
  stt: string | null;
  lop: string | null;
  tenTietMuc: string | null;
  theLoaiThoiGian: string | null;
  diemNoiDung: number | null;
  diemNgheThuat: number | null;
  diemSangTao: number | null;
  diemTacPhong: number | null;
  tongDiemGhiTrenPhieu: number | null;
  ghiChu: string | null;
  ocrNeedsCheck?: boolean;
  ocrCheckNote?: string | null;
}

export interface AuditTongHopRow {
  id: string;
  sourceFile: string;
  pageOrSheet: string;
  rowNumber: number;
  capHoc: AuditCapHoc;
  tt: string | null;
  lop: string | null;
  tenTietMuc: string | null;
  diemGK1: number | null;
  diemGK2: number | null;
  diemGK3: number | null;
  tongDiemGhiTrenPhieu: number | null;
  ketQua: string | null;
  ocrNeedsCheck?: boolean;
  ocrCheckNote?: string | null;
}

export type AuditSheetName =
  | 'Cham_Tieu_hoc'
  | 'Cham_THCS'
  | 'Tong_hop_TH'
  | 'Tong_hop_THCS';

export type AuditIssueType =
  | 'CẦN KIỂM TRA'
  | 'VƯỢT THANG'
  | 'LỆCH TỔNG'
  | 'THIẾU DỮ LIỆU'
  | 'TRÙNG DÒNG';

export interface AuditIssueItem {
  sheetName: AuditSheetName;
  sourceFile: string;
  pageOrSheet: string;
  rowNumber: number;
  lop: string | null;
  tenTietMuc: string | null;
  giamKhao?: string | null;
  issueType: AuditIssueType;
  columnName: string;
  detail: string;
}

export interface ValidatedChamRow extends AuditChamRow {
  tongDiemTinhLai: number | null;
  trangThaiKiemTra: string;
  hasWarning: boolean;
}

export interface ValidatedTongHopRow extends AuditTongHopRow {
  tongDiemTinhLai: number | null;
  diemTrungBinh3GK: number | null;
  trangThaiKiemTra: string;
  hasWarning: boolean;
}

export interface ValidatedAuditDataset {
  chamTieuHoc: ValidatedChamRow[];
  chamTHCS: ValidatedChamRow[];
  tongHopTH: ValidatedTongHopRow[];
  tongHopTHCS: ValidatedTongHopRow[];
  issues: AuditIssueItem[];
}

function normalizeHeaderKey(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');
}

function normalizeTextStrict(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseStrictNullableNumber(raw: unknown): {
  value: number | null;
  invalidRaw?: string;
} {
  if (raw === null || raw === undefined) return { value: null };
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? { value: raw } : { value: null, invalidRaw: String(raw) };
  }
  const str = String(raw).trim();
  if (!str || str === '-' || str === '—' || str === '_' || str.toLowerCase() === 'null') {
    return { value: null };
  }
  // Exact integer or dot-decimal
  if (/^-?\d+(\.\d+)?$/.test(str)) {
    const n = Number(str);
    return Number.isFinite(n) ? { value: n } : { value: null, invalidRaw: str };
  }
  // Vietnamese comma-decimal (only single comma with digits on both sides)
  if (/^-?\d+,\d+$/.test(str)) {
    const n = Number(str.replace(',', '.'));
    return Number.isFinite(n) ? { value: n } : { value: null, invalidRaw: str };
  }
  return { value: null, invalidRaw: str };
}

export function inferCapHoc(
  explicitHint: AuditCapHoc | 'auto',
  textHints: Array<string | null | undefined>,
  lopValue?: string | null
): AuditCapHoc {
  if (explicitHint === 'tieuhoc' || explicitHint === 'thcs') return explicitHint;

  const combined = textHints
    .filter(Boolean)
    .map((t) => normalizeHeaderKey(t))
    .join(' ');

  if (combined.includes('thcs') || combined.includes('trunghoccoso') || combined.includes('cap2')) {
    return 'thcs';
  }
  if (combined.includes('tieuhoc') || combined.includes('cap1')) {
    return 'tieuhoc';
  }

  const lopTrim = String(lopValue || '').trim();
  const gradeMatch = lopTrim.match(/^(\d{1,2})/);
  if (gradeMatch) {
    const grade = parseInt(gradeMatch[1], 10);
    if (grade >= 1 && grade <= 5) return 'tieuhoc';
    if (grade >= 6 && grade <= 9) return 'thcs';
  }
  return 'unknown';
}

export interface ParsedExcelAuditResult {
  chamRows: AuditChamRow[];
  tongHopRows: AuditTongHopRow[];
  warnings: string[];
}

export async function parseExcelWorkbookForAudit(
  file: File,
  options: {
    capHocHint?: AuditCapHoc | 'auto';
    formTypeHint?: AuditFormType | 'auto';
  } = {}
): Promise<ParsedExcelAuditResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const chamRows: AuditChamRow[] = [];
  const tongHopRows: AuditTongHopRow[] = [];
  const warnings: string[] = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      raw: true
    });

    if (!matrix || matrix.length === 0) return;

    // Scan first 18 rows to locate table header & sheet metadata
    let headerRowIdx = -1;
    let bestScore = 0;
    const preHeaderTexts: string[] = [file.name, sheetName];
    let detectedJudge: string | null = null;
    let detectedYear: string | null = null;

    for (let r = 0; r < Math.min(matrix.length, 18); r++) {
      const row = matrix[r] || [];
      let rowScore = 0;
      row.forEach((cell) => {
        const cellStr = String(cell ?? '').trim();
        if (!cellStr) return;
        const norm = normalizeHeaderKey(cellStr);

        if (r < 12) preHeaderTexts.push(cellStr);

        const judgeMatch = cellStr.match(/(?:gi[aá]m\s*kh[aả]o|gk)\s*[:\-–]\s*(.+)/i);
        if (judgeMatch && judgeMatch[1] && !detectedJudge) {
          detectedJudge = judgeMatch[1].trim();
        }
        const yearMatch = cellStr.match(/n[aă]m\s*h[oọ]c\s*[:\-–]?\s*(\d{4}\s*[-–]\s*\d{4})/i);
        if (yearMatch && yearMatch[1] && !detectedYear) {
          detectedYear = yearMatch[1].trim();
        }

        if (
          norm === 'lop' ||
          norm === 'tenlop' ||
          norm.includes('tentietmuc') ||
          norm === 'tietmuc' ||
          norm.includes('noidung') ||
          norm.includes('nghethuat') ||
          norm.includes('sangtao') ||
          norm.includes('tacphong') ||
          norm === 'gk1' ||
          norm.includes('diemgk1') ||
          norm === 'ketqua' ||
          norm === 'tongdiem' ||
          norm === 'tong'
        ) {
          rowScore += 1;
        }
      });

      if (rowScore > bestScore && rowScore >= 2) {
        bestScore = rowScore;
        headerRowIdx = r;
      }
    }

    if (headerRowIdx === -1) {
      warnings.push(
        `Sheet "${sheetName}" trong tệp "${file.name}" không nhận diện được dòng tiêu đề cột bảng điểm (cần kiểm tra thủ công).`
      );
      return;
    }

    const headerCells = (matrix[headerRowIdx] || []).map((c) => normalizeHeaderKey(c));

    // Identify column indexes
    const findCol = (predicates: Array<(h: string) => boolean>): number => {
      for (const pred of predicates) {
        const idx = headerCells.findIndex((h) => h && pred(h));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const sttCol = findCol([(h) => h === 'stt' || h === 'tt' || h === 'sothutu']);
    const lopCol = findCol([(h) => h === 'lop' || h === 'tenlop' || h.includes('lophoc')]);
    const tietMucCol = findCol([(h) => h.includes('tentietmuc'), (h) => h === 'tietmuc']);
    const theLoaiCol = findCol([
      (h) => h.includes('theloai'),
      (h) => h.includes('thoigian'),
      (h) => h.includes('loaihinh')
    ]);
    const noiDungCol = findCol([(h) => h.includes('noidung'), (h) => h.includes('chude')]);
    const ngheThuatCol = findCol([(h) => h.includes('nghethuat'), (h) => h.includes('bieudien')]);
    const sangTaoCol = findCol([(h) => h.includes('sangtao'), (h) => h.includes('dandung')]);
    const tacPhongCol = findCol([
      (h) => h.includes('tacphong'),
      (h) => h.includes('trangphuc'),
      (h) => h.includes('daocu')
    ]);
    const gk1Col = findCol([(h) => h === 'gk1' || h.includes('diemgk1') || h.includes('giamkhao1')]);
    const gk2Col = findCol([(h) => h === 'gk2' || h.includes('diemgk2') || h.includes('giamkhao2')]);
    const gk3Col = findCol([(h) => h === 'gk3' || h.includes('diemgk3') || h.includes('giamkhao3')]);
    const tongCol = findCol([(h) => h === 'tongdiem' || h === 'tong' || h.includes('tongcong')]);
    const ghiChuCol = findCol([(h) => h.includes('ghichu')]);
    const ketQuaCol = findCol([(h) => h.includes('ketqua') || h.includes('xepgiai') || h.includes('danhhieu')]);
    const giamKhaoCol = findCol([(h) => h === 'giamkhao' || h === 'tengiamkhao']);

    const isTongHopSheet =
      options.formTypeHint === 'tong_hop' ||
      (options.formTypeHint !== 'phieu_cham' &&
        (gk1Col !== -1 || gk2Col !== -1 || gk3Col !== -1 || normalizeHeaderKey(sheetName).includes('tonghop')));

    for (let r = headerRowIdx + 1; r < matrix.length; r++) {
      const row = matrix[r] || [];
      const hasAnyValue = row.some((c) => c !== null && String(c ?? '').trim() !== '');
      if (!hasAnyValue) continue;

      const firstCellNorm = normalizeHeaderKey(row[0] ?? row[1] ?? '');
      if (
        firstCellNorm.startsWith('thuky') ||
        firstCellNorm.startsWith('truongban') ||
        firstCellNorm.startsWith('giamkhao') ||
        firstCellNorm.startsWith('ngay') ||
        firstCellNorm.startsWith('congcon')
      ) {
        continue;
      }

      const lop = lopCol !== -1 ? normalizeTextStrict(row[lopCol]) : null;
      const tenTietMuc = tietMucCol !== -1 ? normalizeTextStrict(row[tietMucCol]) : null;
      const excelRowNumber = r + 1;
      const inferredCap = inferCapHoc(options.capHocHint || 'auto', preHeaderTexts, lop);

      if (isTongHopSheet) {
        const tt = sttCol !== -1 ? normalizeTextStrict(row[sttCol]) : null;
        const gk1Parsed = gk1Col !== -1 ? parseStrictNullableNumber(row[gk1Col]) : { value: null };
        const gk2Parsed = gk2Col !== -1 ? parseStrictNullableNumber(row[gk2Col]) : { value: null };
        const gk3Parsed = gk3Col !== -1 ? parseStrictNullableNumber(row[gk3Col]) : { value: null };
        const tongParsed = tongCol !== -1 ? parseStrictNullableNumber(row[tongCol]) : { value: null };
        const ketQua = ketQuaCol !== -1 ? normalizeTextStrict(row[ketQuaCol]) : null;

        const badTokens: string[] = [];
        if (gk1Parsed.invalidRaw) badTokens.push(`Điểm GK 1="${gk1Parsed.invalidRaw}"`);
        if (gk2Parsed.invalidRaw) badTokens.push(`Điểm GK 2="${gk2Parsed.invalidRaw}"`);
        if (gk3Parsed.invalidRaw) badTokens.push(`Điểm GK 3="${gk3Parsed.invalidRaw}"`);
        if (tongParsed.invalidRaw) badTokens.push(`Tổng điểm="${tongParsed.invalidRaw}"`);

        if (!lop && !tenTietMuc && gk1Parsed.value === null && gk2Parsed.value === null && gk3Parsed.value === null && badTokens.length === 0) {
          continue;
        }

        tongHopRows.push({
          id: `th_${Date.now()}_${sheetName}_${r}_${Math.random().toString(36).slice(2, 6)}`,
          sourceFile: file.name,
          pageOrSheet: sheetName,
          rowNumber: excelRowNumber,
          capHoc: inferredCap,
          tt,
          lop,
          tenTietMuc,
          diemGK1: gk1Parsed.value,
          diemGK2: gk2Parsed.value,
          diemGK3: gk3Parsed.value,
          tongDiemGhiTrenPhieu: tongParsed.value,
          ketQua,
          ocrNeedsCheck: badTokens.length > 0,
          ocrCheckNote: badTokens.length > 0 ? `CẦN KIỂM TRA - Giá trị không phải số hợp lệ: ${badTokens.join(', ')}` : null
        });
      } else {
        const stt = sttCol !== -1 ? normalizeTextStrict(row[sttCol]) : null;
        const theLoaiThoiGian = theLoaiCol !== -1 ? normalizeTextStrict(row[theLoaiCol]) : null;
        const c1 = noiDungCol !== -1 ? parseStrictNullableNumber(row[noiDungCol]) : { value: null };
        const c2 = ngheThuatCol !== -1 ? parseStrictNullableNumber(row[ngheThuatCol]) : { value: null };
        const c3 = sangTaoCol !== -1 ? parseStrictNullableNumber(row[sangTaoCol]) : { value: null };
        const c4 = tacPhongCol !== -1 ? parseStrictNullableNumber(row[tacPhongCol]) : { value: null };
        const tongParsed = tongCol !== -1 ? parseStrictNullableNumber(row[tongCol]) : { value: null };
        const ghiChu = ghiChuCol !== -1 ? normalizeTextStrict(row[ghiChuCol]) : null;
        const rowJudge = giamKhaoCol !== -1 ? normalizeTextStrict(row[giamKhaoCol]) : detectedJudge;

        const badTokens: string[] = [];
        if (c1.invalidRaw) badTokens.push(`Nội dung="${c1.invalidRaw}"`);
        if (c2.invalidRaw) badTokens.push(`Nghệ thuật="${c2.invalidRaw}"`);
        if (c3.invalidRaw) badTokens.push(`Sáng tạo="${c3.invalidRaw}"`);
        if (c4.invalidRaw) badTokens.push(`Tác phong="${c4.invalidRaw}"`);
        if (tongParsed.invalidRaw) badTokens.push(`Tổng điểm="${tongParsed.invalidRaw}"`);

        if (
          !lop &&
          !tenTietMuc &&
          c1.value === null &&
          c2.value === null &&
          c3.value === null &&
          c4.value === null &&
          badTokens.length === 0
        ) {
          continue;
        }

        chamRows.push({
          id: `ch_${Date.now()}_${sheetName}_${r}_${Math.random().toString(36).slice(2, 6)}`,
          sourceFile: file.name,
          pageOrSheet: sheetName,
          rowNumber: excelRowNumber,
          capHoc: inferredCap,
          giamKhao: rowJudge,
          namHoc: detectedYear || '2026–2027',
          stt,
          lop,
          tenTietMuc,
          theLoaiThoiGian,
          diemNoiDung: c1.value,
          diemNgheThuat: c2.value,
          diemSangTao: c3.value,
          diemTacPhong: c4.value,
          tongDiemGhiTrenPhieu: tongParsed.value,
          ghiChu,
          ocrNeedsCheck: badTokens.length > 0,
          ocrCheckNote: badTokens.length > 0 ? `CẦN KIỂM TRA - Giá trị không phải số hợp lệ: ${badTokens.join(', ')}` : null
        });
      }
    }
  });

  return { chamRows, tongHopRows, warnings };
}

export function validateAuditDataset(
  chamRows: AuditChamRow[],
  tongHopRows: AuditTongHopRow[]
): ValidatedAuditDataset {
  const issues: AuditIssueItem[] = [];
  const chamTieuHoc: ValidatedChamRow[] = [];
  const chamTHCS: ValidatedChamRow[] = [];
  const tongHopTH: ValidatedTongHopRow[] = [];
  const tongHopTHCS: ValidatedTongHopRow[] = [];

  // Duplicate detection trackers (NO auto-delete!)
  const chamKeyCount = new Map<string, number>();
  chamRows.forEach((row) => {
    const cap = row.capHoc === 'thcs' ? 'thcs' : 'tieuhoc';
    if (row.lop || row.tenTietMuc) {
      const key = [
        cap,
        normalizeHeaderKey(row.giamKhao || ''),
        normalizeHeaderKey(row.lop || ''),
        normalizeHeaderKey(row.tenTietMuc || '')
      ].join('|');
      chamKeyCount.set(key, (chamKeyCount.get(key) || 0) + 1);
    }
  });

  chamRows.forEach((row) => {
    const effectiveCap: 'tieuhoc' | 'thcs' =
      row.capHoc === 'thcs'
        ? 'thcs'
        : row.capHoc === 'tieuhoc'
          ? 'tieuhoc'
          : inferCapHoc('auto', [row.sourceFile, row.pageOrSheet], row.lop) === 'thcs'
            ? 'thcs'
            : 'tieuhoc';

    const sheetName: AuditSheetName = effectiveCap === 'thcs' ? 'Cham_THCS' : 'Cham_Tieu_hoc';
    const rowWarnings: string[] = [];

    const pushIssue = (issueType: AuditIssueType, columnName: string, detail: string) => {
      rowWarnings.push(`${issueType} (${columnName}): ${detail}`);
      issues.push({
        sheetName,
        sourceFile: row.sourceFile,
        pageOrSheet: row.pageOrSheet,
        rowNumber: row.rowNumber,
        lop: row.lop,
        tenTietMuc: row.tenTietMuc,
        giamKhao: row.giamKhao,
        issueType,
        columnName,
        detail
      });
    };

    if (row.capHoc === 'unknown') {
      pushIssue('CẦN KIỂM TRA', 'Cấp học', 'Chưa xác định rõ cấp Tiểu học hay THCS trên phiếu.');
    }
    if (row.ocrNeedsCheck || row.ocrCheckNote) {
      pushIssue('CẦN KIỂM TRA', 'Đọc phiếu', row.ocrCheckNote || 'Có ký tự/điểm không đọc rõ trên phiếu.');
    }
    if (!row.lop) {
      pushIssue('THIẾU DỮ LIỆU', 'Lớp', 'Thiếu tên lớp.');
    }
    if (!row.tenTietMuc) {
      pushIssue('THIẾU DỮ LIỆU', 'Tên tiết mục', 'Thiếu tên tiết mục.');
    }

    const criteriaChecks: Array<{
      val: number | null;
      label: string;
      max: number;
    }> = [
      { val: row.diemNoiDung, label: 'Nội dung & Chủ đề (25đ)', max: 25 },
      { val: row.diemNgheThuat, label: 'Chất lượng nghệ thuật & Biểu diễn (35đ)', max: 35 },
      { val: row.diemSangTao, label: 'Tính sáng tạo & Dàn dựng (20đ)', max: 20 },
      { val: row.diemTacPhong, label: 'Trang phục, Đạo cụ & Tác phong (20đ)', max: 20 }
    ];

    criteriaChecks.forEach(({ val, label, max }) => {
      if (val === null) {
        pushIssue('CẦN KIỂM TRA', label, 'Ô điểm bị trống hoặc không đọc rõ (giữ trống, không tự điền 0).');
      } else if (val < 0 || val > max) {
        pushIssue('VƯỢT THANG', label, `Điểm ${val} vượt giới hạn thang 0–${max}.`);
      }
    });

    if (row.tongDiemGhiTrenPhieu !== null && (row.tongDiemGhiTrenPhieu < 0 || row.tongDiemGhiTrenPhieu > 100)) {
      pushIssue('VƯỢT THANG', 'Tổng điểm ghi trên phiếu', `Tổng điểm ${row.tongDiemGhiTrenPhieu} vượt thang 0–100.`);
    }

    const all4Present =
      row.diemNoiDung !== null &&
      row.diemNgheThuat !== null &&
      row.diemSangTao !== null &&
      row.diemTacPhong !== null;

    const tongDiemTinhLai = all4Present
      ? Number(
          (
            (row.diemNoiDung as number) +
            (row.diemNgheThuat as number) +
            (row.diemSangTao as number) +
            (row.diemTacPhong as number)
          ).toFixed(2)
        )
      : null;

    if (
      tongDiemTinhLai !== null &&
      row.tongDiemGhiTrenPhieu !== null &&
      Math.abs(tongDiemTinhLai - row.tongDiemGhiTrenPhieu) > 0.001
    ) {
      pushIssue(
        'LỆCH TỔNG',
        'Tổng điểm (100đ)',
        `Tổng ghi trên phiếu (${row.tongDiemGhiTrenPhieu}) khác tổng 4 tiêu chí (${tongDiemTinhLai}). Giữ nguyên cả 2 giá trị để kiểm tra.`
      );
    }

    if (row.lop || row.tenTietMuc) {
      const dupKey = [
        effectiveCap,
        normalizeHeaderKey(row.giamKhao || ''),
        normalizeHeaderKey(row.lop || ''),
        normalizeHeaderKey(row.tenTietMuc || '')
      ].join('|');
      if ((chamKeyCount.get(dupKey) || 0) > 1) {
        pushIssue(
          'TRÙNG DÒNG',
          'Lớp / Tiết mục / Giám khảo',
          `Phát hiện dòng trùng lặp (${row.lop || '?'} - ${row.tenTietMuc || '?'}${row.giamKhao ? ` - GK: ${row.giamKhao}` : ''}). Không tự xóa.`
        );
      }
    }

    const validated: ValidatedChamRow = {
      ...row,
      capHoc: effectiveCap,
      tongDiemTinhLai,
      hasWarning: rowWarnings.length > 0,
      trangThaiKiemTra: rowWarnings.length > 0 ? `CẦN KIỂM TRA: ${rowWarnings.join(' | ')}` : 'Hợp lệ'
    };

    if (effectiveCap === 'thcs') {
      chamTHCS.push(validated);
    } else {
      chamTieuHoc.push(validated);
    }
  });

  // Validate Bảng tổng hợp rows
  const thKeyCount = new Map<string, number>();
  tongHopRows.forEach((row) => {
    const cap = row.capHoc === 'thcs' ? 'thcs' : 'tieuhoc';
    if (row.lop || row.tenTietMuc) {
      const key = [cap, normalizeHeaderKey(row.lop || ''), normalizeHeaderKey(row.tenTietMuc || '')].join('|');
      thKeyCount.set(key, (thKeyCount.get(key) || 0) + 1);
    }
  });

  tongHopRows.forEach((row) => {
    const effectiveCap: 'tieuhoc' | 'thcs' =
      row.capHoc === 'thcs'
        ? 'thcs'
        : row.capHoc === 'tieuhoc'
          ? 'tieuhoc'
          : inferCapHoc('auto', [row.sourceFile, row.pageOrSheet], row.lop) === 'thcs'
            ? 'thcs'
            : 'tieuhoc';

    const sheetName: AuditSheetName = effectiveCap === 'thcs' ? 'Tong_hop_THCS' : 'Tong_hop_TH';
    const rowWarnings: string[] = [];

    const pushIssue = (issueType: AuditIssueType, columnName: string, detail: string) => {
      rowWarnings.push(`${issueType} (${columnName}): ${detail}`);
      issues.push({
        sheetName,
        sourceFile: row.sourceFile,
        pageOrSheet: row.pageOrSheet,
        rowNumber: row.rowNumber,
        lop: row.lop,
        tenTietMuc: row.tenTietMuc,
        issueType,
        columnName,
        detail
      });
    };

    if (row.capHoc === 'unknown') {
      pushIssue('CẦN KIỂM TRA', 'Cấp học', 'Chưa xác định rõ bảng tổng hợp Tiểu học hay THCS.');
    }
    if (row.ocrNeedsCheck || row.ocrCheckNote) {
      pushIssue('CẦN KIỂM TRA', 'Đọc bảng', row.ocrCheckNote || 'Có ô dữ liệu mờ/khó đọc trên bảng tổng hợp.');
    }
    if (!row.lop) {
      pushIssue('THIẾU DỮ LIỆU', 'Lớp', 'Thiếu tên lớp.');
    }

    const gkChecks = [
      { val: row.diemGK1, label: 'Điểm GK 1' },
      { val: row.diemGK2, label: 'Điểm GK 2' },
      { val: row.diemGK3, label: 'Điểm GK 3' }
    ];
    gkChecks.forEach(({ val, label }) => {
      if (val === null) {
        pushIssue('CẦN KIỂM TRA', label, 'Thiếu điểm giám khảo (để trống, không tự tính tổng).');
      } else if (val < 0 || val > 100) {
        pushIssue('VƯỢT THANG', label, `Điểm ${val} vượt thang 0–100.`);
      }
    });

    if (row.tongDiemGhiTrenPhieu !== null && (row.tongDiemGhiTrenPhieu < 0 || row.tongDiemGhiTrenPhieu > 300)) {
      pushIssue('VƯỢT THANG', 'Tổng điểm ghi trên bảng', `Tổng điểm ${row.tongDiemGhiTrenPhieu} vượt thang 0–300.`);
    }

    const all3Present = row.diemGK1 !== null && row.diemGK2 !== null && row.diemGK3 !== null;
    const tongDiemTinhLai = all3Present
      ? Number(((row.diemGK1 as number) + (row.diemGK2 as number) + (row.diemGK3 as number)).toFixed(2))
      : null;
    const diemTrungBinh3GK =
      tongDiemTinhLai !== null ? Number((tongDiemTinhLai / 3).toFixed(2)) : null;

    if (
      tongDiemTinhLai !== null &&
      row.tongDiemGhiTrenPhieu !== null &&
      Math.abs(tongDiemTinhLai - row.tongDiemGhiTrenPhieu) > 0.001
    ) {
      pushIssue(
        'LỆCH TỔNG',
        'Tổng điểm',
        `Tổng ghi trên bảng (${row.tongDiemGhiTrenPhieu}) khác GK1+GK2+GK3 (${tongDiemTinhLai}). Giữ nguyên cả 2 giá trị để kiểm tra.`
      );
    }

    if (row.lop || row.tenTietMuc) {
      const dupKey = [
        effectiveCap,
        normalizeHeaderKey(row.lop || ''),
        normalizeHeaderKey(row.tenTietMuc || '')
      ].join('|');
      if ((thKeyCount.get(dupKey) || 0) > 1) {
        pushIssue(
          'TRÙNG DÒNG',
          'Lớp',
          `Phát hiện dòng trùng lặp tại bảng tổng hợp (${row.lop || '?'}). Không tự xóa.`
        );
      }
    }

    const validated: ValidatedTongHopRow = {
      ...row,
      capHoc: effectiveCap,
      tongDiemTinhLai,
      diemTrungBinh3GK,
      hasWarning: rowWarnings.length > 0,
      trangThaiKiemTra: rowWarnings.length > 0 ? `CẦN KIỂM TRA: ${rowWarnings.join(' | ')}` : 'Hợp lệ'
    };

    if (effectiveCap === 'thcs') {
      tongHopTHCS.push(validated);
    } else {
      tongHopTH.push(validated);
    }
  });

  return { chamTieuHoc, chamTHCS, tongHopTH, tongHopTHCS, issues };
}

function buildChamWorksheet(rows: ValidatedChamRow[], title: string): XLSX.WorkSheet {
  const aoa: Array<Array<string | number | null>> = [
    ['TRƯỜNG TIỂU HỌC VÀ THCS NGUYỄN VĂN TRỖI'],
    [`${title} — NĂM HỌC 2026–2027`],
    ['Thang điểm: Nội dung & Chủ đề (25đ) | Chất lượng nghệ thuật & Biểu diễn (35đ) | Tính sáng tạo & Dàn dựng (20đ) | Trang phục, Đạo cụ & Tác phong (20đ) | Tổng tối đa 100đ'],
    [],
    [
      'STT',
      'Giám khảo',
      'Lớp',
      'Tên tiết mục',
      'Thể loại / Thời gian',
      'Nội dung & Chủ đề (25đ)',
      'Chất lượng nghệ thuật & Biểu diễn (35đ)',
      'Tính sáng tạo & Dàn dựng (20đ)',
      'Trang phục, Đạo cụ & Tác phong (20đ)',
      'Tổng điểm ghi trên phiếu (100đ)',
      'Tổng điểm tự động (Công thức 100đ)',
      'Ghi chú',
      'Trạng thái kiểm tra',
      'Nguồn tệp / Trang'
    ]
  ];

  rows.forEach((r) => {
    aoa.push([
      r.stt ?? '',
      r.giamKhao ?? '',
      r.lop ?? '',
      r.tenTietMuc ?? '',
      r.theLoaiThoiGian ?? '',
      r.diemNoiDung,
      r.diemNgheThuat,
      r.diemSangTao,
      r.diemTacPhong,
      r.tongDiemGhiTrenPhieu,
      r.tongDiemTinhLai, // Replaced with live Excel formula below
      r.ghiChu ?? '',
      r.trangThaiKiemTra,
      `${r.sourceFile} (${r.pageOrSheet} - dòng ${r.rowNumber})`
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Set live Excel formula for column K (index 10): =IF(COUNT(F{r}:I{r})=4,SUM(F{r}:I{r}),"")
  rows.forEach((r, idx) => {
    const excelRow = 6 + idx; // 1-indexed Excel row (header is row 5)
    const cellAddr = XLSX.utils.encode_cell({ r: 5 + idx, c: 10 });
    ws[cellAddr] = {
      t: 'n',
      f: `IF(COUNT(F${excelRow}:I${excelRow})=4,SUM(F${excelRow}:I${excelRow}),"")`,
      v: r.tongDiemTinhLai ?? undefined
    };
  });

  ws['!cols'] = [
    { wch: 7 },
    { wch: 22 },
    { wch: 10 },
    { wch: 30 },
    { wch: 20 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 24 },
    { wch: 36 },
    { wch: 26 }
  ];
  (ws as Record<string, unknown>)['!pageSetup'] = {
    paperSize: 9, // A4
    orientation: 'landscape',
    fitToWidth: 1,
    fitToHeight: 0
  };
  return ws;
}

function buildTongHopWorksheet(
  rows: ValidatedTongHopRow[],
  title: string,
  includeAverage: boolean
): XLSX.WorkSheet {
  const headers = [
    'TT',
    'Lớp',
    'Tên tiết mục',
    'Điểm GK 1',
    'Điểm GK 2',
    'Điểm GK 3',
    'Tổng điểm ghi trên bảng',
    'Tổng điểm (GK1+GK2+GK3)',
    ...(includeAverage ? ['Điểm trung bình (3 GK)'] : []),
    'Kết quả',
    'Trạng thái kiểm tra',
    'Nguồn tệp / Trang'
  ];

  const aoa: Array<Array<string | number | null>> = [
    ['TRƯỜNG TIỂU HỌC VÀ THCS NGUYỄN VĂN TRỖI'],
    [`${title} — NĂM HỌC 2026–2027`],
    ['Quy tắc: Tổng điểm = GK 1 + GK 2 + GK 3 (chỉ tính khi đủ cả 3 giám khảo; ô trống không tự điền 0).'],
    [],
    headers
  ];

  rows.forEach((r) => {
    aoa.push([
      r.tt ?? '',
      r.lop ?? '',
      r.tenTietMuc ?? '',
      r.diemGK1,
      r.diemGK2,
      r.diemGK3,
      r.tongDiemGhiTrenPhieu,
      r.tongDiemTinhLai,
      ...(includeAverage ? [r.diemTrungBinh3GK] : []),
      r.ketQua ?? '',
      r.trangThaiKiemTra,
      `${r.sourceFile} (${r.pageOrSheet} - dòng ${r.rowNumber})`
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  rows.forEach((r, idx) => {
    const excelRow = 6 + idx;
    const sumAddr = XLSX.utils.encode_cell({ r: 5 + idx, c: 7 });
    ws[sumAddr] = {
      t: 'n',
      f: `IF(COUNT(D${excelRow}:F${excelRow})=3,SUM(D${excelRow}:F${excelRow}),"")`,
      v: r.tongDiemTinhLai ?? undefined
    };
    if (includeAverage) {
      const avgAddr = XLSX.utils.encode_cell({ r: 5 + idx, c: 8 });
      ws[avgAddr] = {
        t: 'n',
        f: `IF(COUNT(D${excelRow}:F${excelRow})=3,ROUND(AVERAGE(D${excelRow}:F${excelRow}),2),"")`,
        v: r.diemTrungBinh3GK ?? undefined
      };
    }
  });

  ws['!cols'] = [
    { wch: 7 },
    { wch: 10 },
    { wch: 28 },
    { wch: 13 },
    { wch: 13 },
    { wch: 13 },
    { wch: 18 },
    { wch: 18 },
    ...(includeAverage ? [{ wch: 16 }] : []),
    { wch: 18 },
    { wch: 36 },
    { wch: 26 }
  ];
  (ws as Record<string, unknown>)['!pageSetup'] = {
    paperSize: 9,
    orientation: 'landscape',
    fitToWidth: 1,
    fitToHeight: 0
  };
  return ws;
}

function buildIssuesWorksheet(issues: AuditIssueItem[]): XLSX.WorkSheet {
  const aoa: Array<Array<string | number | null>> = [
    ['TRƯỜNG TIỂU HỌC VÀ THCS NGUYỄN VĂN TRỖI'],
    ['DANH SÁCH LỖI & ĐIỂM CẦN KIỂM TRA — NĂM HỌC 2026–2027'],
    ['Lưu ý: Hệ thống không tự suy đoán, không tự điền 0 cho ô trống và không tự xóa dòng trùng. Vui lòng đối chiếu phiếu gốc để xác nhận.'],
    [],
    ['STT', 'Sheet', 'Loại cảnh báo', 'Tệp nguồn', 'Trang / Sheet', 'Dòng', 'Giám khảo', 'Lớp', 'Tên tiết mục', 'Cột dữ liệu', 'Chi tiết cần kiểm tra']
  ];

  issues.forEach((item, idx) => {
    aoa.push([
      idx + 1,
      item.sheetName,
      item.issueType,
      item.sourceFile,
      item.pageOrSheet,
      item.rowNumber,
      item.giamKhao ?? '',
      item.lop ?? '',
      item.tenTietMuc ?? '',
      item.columnName,
      item.detail
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 16 },
    { wch: 24 },
    { wch: 16 },
    { wch: 8 },
    { wch: 20 },
    { wch: 10 },
    { wch: 26 },
    { wch: 24 },
    { wch: 48 }
  ];
  (ws as Record<string, unknown>)['!pageSetup'] = {
    paperSize: 9,
    orientation: 'landscape',
    fitToWidth: 1,
    fitToHeight: 0
  };
  return ws;
}

export function exportAuditWorkbookXLSX(
  dataset: ValidatedAuditDataset,
  options: { includeAverageOnSummary?: boolean; fileName?: string } = {}
): void {
  const includeAverage = Boolean(options.includeAverageOnSummary);
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    buildChamWorksheet(dataset.chamTieuHoc, 'PHIẾU CHẤM VĂN NGHỆ CẤP TIỂU HỌC'),
    'Cham_Tieu_hoc'
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildChamWorksheet(dataset.chamTHCS, 'PHIẾU CHẤM VĂN NGHỆ CẤP THCS'),
    'Cham_THCS'
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildTongHopWorksheet(dataset.tongHopTH, 'BẢNG TỔNG HỢP ĐIỂM VĂN NGHỆ CẤP TIỂU HỌC', includeAverage),
    'Tong_hop_TH'
  );
  XLSX.utils.book_append_sheet(
    wb,
    buildTongHopWorksheet(dataset.tongHopTHCS, 'BẢNG TỔNG HỢP ĐIỂM VĂN NGHỆ CẤP THCS', includeAverage),
    'Tong_hop_THCS'
  );
  XLSX.utils.book_append_sheet(wb, buildIssuesWorksheet(dataset.issues), 'Loi_can_kiem_tra');

  const outName = options.fileName || 'Bang_diem_van_nghe_20-11_2026-2027.xlsx';
  XLSX.writeFile(wb, outName);
}

export function exportAuditSheetCSV(
  sheetKey: AuditSheetName | 'Loi_can_kiem_tra',
  dataset: ValidatedAuditDataset,
  includeAverageOnSummary = false
): void {
  let ws: XLSX.WorkSheet;
  switch (sheetKey) {
    case 'Cham_Tieu_hoc':
      ws = buildChamWorksheet(dataset.chamTieuHoc, 'PHIẾU CHẤM VĂN NGHỆ CẤP TIỂU HỌC');
      break;
    case 'Cham_THCS':
      ws = buildChamWorksheet(dataset.chamTHCS, 'PHIẾU CHẤM VĂN NGHỆ CẤP THCS');
      break;
    case 'Tong_hop_TH':
      ws = buildTongHopWorksheet(dataset.tongHopTH, 'BẢNG TỔNG HỢP ĐIỂM VĂN NGHỆ CẤP TIỂU HỌC', includeAverageOnSummary);
      break;
    case 'Tong_hop_THCS':
      ws = buildTongHopWorksheet(dataset.tongHopTHCS, 'BẢNG TỔNG HỢP ĐIỂM VĂN NGHỆ CẤP THCS', includeAverageOnSummary);
      break;
    default:
      ws = buildIssuesWorksheet(dataset.issues);
      break;
  }

  const csv = '\uFEFF' + XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sheetKey}_2026-2027.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
