import React, { useState, useMemo, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Image as ImageIcon,
  AlertTriangle,
  CheckCircle2,
  Download,
  Trash2,
  Eye,
  FileText,
  Loader2,
  ShieldAlert,
  CopyCheck
} from 'lucide-react';
import {
  AuditCapHoc,
  AuditChamRow,
  AuditFormType,
  AuditSheetName,
  AuditTongHopRow,
  exportAuditSheetCSV,
  exportAuditWorkbookXLSX,
  inferCapHoc,
  parseExcelWorkbookForAudit,
  parseStrictNullableNumber,
  validateAuditDataset
} from '../../utils/vanngheAuditExport';

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Không thể đọc tệp ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function formatNumberInput(val: number | null): string {
  return val === null || val === undefined ? '' : String(val);
}

export const VanNgheSheetAuditPanel: React.FC = () => {
  const [chamRows, setChamRows] = useState<AuditChamRow[]>([]);
  const [tongHopRows, setTongHopRows] = useState<AuditTongHopRow[]>([]);
  const [fileWarnings, setFileWarnings] = useState<string[]>([]);
  const [processedFiles, setProcessedFiles] = useState<string[]>([]);
  const [capHocHint, setCapHocHint] = useState<AuditCapHoc | 'auto'>('auto');
  const [formTypeHint, setFormTypeHint] = useState<AuditFormType | 'auto'>('auto');
  const [includeAverage, setIncludeAverage] = useState<boolean>(false);
  const [activeSheetTab, setActiveSheetTab] = useState<AuditSheetName | 'Loi_can_kiem_tra'>('Cham_Tieu_hoc');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>('');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dataset = useMemo(
    () => validateAuditDataset(chamRows, tongHopRows),
    [chamRows, tongHopRows]
  );

  const totalRowsCount =
    dataset.chamTieuHoc.length +
    dataset.chamTHCS.length +
    dataset.tongHopTH.length +
    dataset.tongHopTHCS.length;

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    setIsProcessing(true);
    setErrorBanner(null);
    setSuccessBanner(null);

    const newCham: AuditChamRow[] = [];
    const newTongHop: AuditTongHopRow[] = [];
    const newWarnings: string[] = [];
    const newlyProcessedNames: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgressText(`Đang đọc tệp ${i + 1}/${files.length}: ${file.name}...`);
        const lowerName = file.name.toLowerCase();

        if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) {
          const parsed = await parseExcelWorkbookForAudit(file, {
            capHocHint,
            formTypeHint
          });
          newCham.push(...parsed.chamRows);
          newTongHop.push(...parsed.tongHopRows);
          newWarnings.push(...parsed.warnings);
          newlyProcessedNames.push(file.name);
        } else if (
          file.type.startsWith('image/') ||
          file.type === 'application/pdf' ||
          /\.(png|jpg|jpeg|webp|heic|pdf)$/i.test(lowerName)
        ) {
          const base64Data = await fileToBase64(file);
          const mimeType =
            file.type ||
            (lowerName.endsWith('.pdf')
              ? 'application/pdf'
              : lowerName.endsWith('.png')
                ? 'image/png'
                : 'image/jpeg');

          const res = await fetch('/api/vannghe/extract-scoresheet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileBase64: base64Data,
              fileName: file.name,
              mimeType,
              capHocHint,
              formTypeHint
            })
          });

          const payload = await res.json();
          if (!res.ok || !payload.success) {
            newWarnings.push(
              `Tệp "${file.name}": ${payload?.error || 'Không thể trích xuất dữ liệu.'}`
            );
            continue;
          }

          const extracted = payload.data || {};
          const docCapHoc: AuditCapHoc =
            extracted.capHoc === 'tieuhoc' || extracted.capHoc === 'thcs'
              ? extracted.capHoc
              : capHocHint === 'tieuhoc' || capHocHint === 'thcs'
                ? capHocHint
                : 'unknown';

          if (Array.isArray(extracted.detectedIssues)) {
            extracted.detectedIssues.forEach((msg: string) => {
              if (msg && msg.trim()) {
                newWarnings.push(`Tệp "${file.name}": ${msg.trim()}`);
              }
            });
          }

          const rawCham = Array.isArray(extracted.chamRows) ? extracted.chamRows : [];
          rawCham.forEach((r: any, idx: number) => {
            const lop = r.lop ? String(r.lop).trim() : null;
            const rowCap =
              docCapHoc !== 'unknown'
                ? docCapHoc
                : inferCapHoc(capHocHint, [file.name], lop);

            newCham.push({
              id: `ocr_ch_${Date.now()}_${i}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
              sourceFile: file.name,
              pageOrSheet: `Trang ${r.pageNumber || 1}`,
              rowNumber: Number(r.rowNumber) || idx + 1,
              capHoc: rowCap,
              giamKhao: extracted.giamKhao ? String(extracted.giamKhao).trim() : null,
              namHoc: extracted.namHoc ? String(extracted.namHoc).trim() : '2026–2027',
              stt: r.stt !== null && r.stt !== undefined && String(r.stt).trim() !== '' ? String(r.stt).trim() : null,
              lop,
              tenTietMuc: r.tenTietMuc ? String(r.tenTietMuc).trim() : null,
              theLoaiThoiGian: r.theLoaiThoiGian ? String(r.theLoaiThoiGian).trim() : null,
              diemNoiDung: typeof r.diemNoiDung === 'number' && Number.isFinite(r.diemNoiDung) ? r.diemNoiDung : null,
              diemNgheThuat: typeof r.diemNgheThuat === 'number' && Number.isFinite(r.diemNgheThuat) ? r.diemNgheThuat : null,
              diemSangTao: typeof r.diemSangTao === 'number' && Number.isFinite(r.diemSangTao) ? r.diemSangTao : null,
              diemTacPhong: typeof r.diemTacPhong === 'number' && Number.isFinite(r.diemTacPhong) ? r.diemTacPhong : null,
              tongDiemGhiTrenPhieu:
                typeof r.tongDiemGhiTrenPhieu === 'number' && Number.isFinite(r.tongDiemGhiTrenPhieu)
                  ? r.tongDiemGhiTrenPhieu
                  : null,
              ghiChu: r.ghiChu ? String(r.ghiChu).trim() : null,
              ocrNeedsCheck: Boolean(r.needsCheck),
              ocrCheckNote: r.checkNote ? String(r.checkNote).trim() : null
            });
          });

          const rawTH = Array.isArray(extracted.tongHopRows) ? extracted.tongHopRows : [];
          rawTH.forEach((r: any, idx: number) => {
            const lop = r.lop ? String(r.lop).trim() : null;
            const rowCap =
              docCapHoc !== 'unknown'
                ? docCapHoc
                : inferCapHoc(capHocHint, [file.name], lop);

            newTongHop.push({
              id: `ocr_th_${Date.now()}_${i}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
              sourceFile: file.name,
              pageOrSheet: `Trang ${r.pageNumber || 1}`,
              rowNumber: Number(r.rowNumber) || idx + 1,
              capHoc: rowCap,
              tt: r.tt !== null && r.tt !== undefined && String(r.tt).trim() !== '' ? String(r.tt).trim() : null,
              lop,
              tenTietMuc: r.tenTietMuc ? String(r.tenTietMuc).trim() : null,
              diemGK1: typeof r.diemGK1 === 'number' && Number.isFinite(r.diemGK1) ? r.diemGK1 : null,
              diemGK2: typeof r.diemGK2 === 'number' && Number.isFinite(r.diemGK2) ? r.diemGK2 : null,
              diemGK3: typeof r.diemGK3 === 'number' && Number.isFinite(r.diemGK3) ? r.diemGK3 : null,
              tongDiemGhiTrenPhieu:
                typeof r.tongDiemGhiTrenPhieu === 'number' && Number.isFinite(r.tongDiemGhiTrenPhieu)
                  ? r.tongDiemGhiTrenPhieu
                  : null,
              ketQua: r.ketQua ? String(r.ketQua).trim() : null,
              ocrNeedsCheck: Boolean(r.needsCheck),
              ocrCheckNote: r.checkNote ? String(r.checkNote).trim() : null
            });
          });

          newlyProcessedNames.push(file.name);
        } else {
          newWarnings.push(
            `Tệp "${file.name}" không đúng định dạng hỗ trợ (chỉ nhận ảnh JPG/PNG/WEBP, PDF hoặc Excel .xlsx/.xls/.csv).`
          );
        }
      }

      if (newCham.length > 0 || newTongHop.length > 0) {
        setChamRows((prev) => [...prev, ...newCham]);
        setTongHopRows((prev) => [...prev, ...newTongHop]);
        setProcessedFiles((prev) => [...prev, ...newlyProcessedNames]);

        // Auto-select first populated sheet tab
        if (newCham.some((r) => r.capHoc !== 'thcs')) {
          setActiveSheetTab('Cham_Tieu_hoc');
        } else if (newCham.some((r) => r.capHoc === 'thcs')) {
          setActiveSheetTab('Cham_THCS');
        } else if (newTongHop.some((r) => r.capHoc !== 'thcs')) {
          setActiveSheetTab('Tong_hop_TH');
        } else if (newTongHop.some((r) => r.capHoc === 'thcs')) {
          setActiveSheetTab('Tong_hop_THCS');
        }

        setSuccessBanner(
          `Đã trích xuất ${newCham.length} dòng Phiếu chấm và ${newTongHop.length} dòng Bảng tổng hợp từ ${newlyProcessedNames.length} tệp. Vui lòng rà soát danh sách kiểm tra trước khi xuất Excel.`
        );
      } else if (newWarnings.length > 0) {
        setErrorBanner(newWarnings[0]);
      }

      if (newWarnings.length > 0) {
        setFileWarnings((prev) => [...prev, ...newWarnings]);
      }
    } catch (err: any) {
      setErrorBanner(err?.message || 'Đã xảy ra lỗi khi đọc tệp tải lên.');
    } finally {
      setIsProcessing(false);
      setProgressText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateChamCell = (id: string, field: keyof AuditChamRow, rawVal: string, isNumeric = false) => {
    setChamRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        if (!isNumeric) {
          const val = rawVal.trim() ? rawVal : null;
          return { ...row, [field]: val, ocrNeedsCheck: false };
        }
        const trimmed = rawVal.trim();
        if (!trimmed) {
          return { ...row, [field]: null, ocrNeedsCheck: false };
        }
        const parsed = parseStrictNullableNumber(trimmed);
        return {
          ...row,
          [field]: parsed.value,
          ocrNeedsCheck: Boolean(parsed.invalidRaw),
          ocrCheckNote: parsed.invalidRaw ? `Giá trị "${parsed.invalidRaw}" không phải số hợp lệ` : null
        };
      })
    );
  };

  const updateTongHopCell = (id: string, field: keyof AuditTongHopRow, rawVal: string, isNumeric = false) => {
    setTongHopRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        if (!isNumeric) {
          const val = rawVal.trim() ? rawVal : null;
          return { ...row, [field]: val, ocrNeedsCheck: false };
        }
        const trimmed = rawVal.trim();
        if (!trimmed) {
          return { ...row, [field]: null, ocrNeedsCheck: false };
        }
        const parsed = parseStrictNullableNumber(trimmed);
        return {
          ...row,
          [field]: parsed.value,
          ocrNeedsCheck: Boolean(parsed.invalidRaw),
          ocrCheckNote: parsed.invalidRaw ? `Giá trị "${parsed.invalidRaw}" không phải số hợp lệ` : null
        };
      })
    );
  };

  const handleClearSession = () => {
    setChamRows([]);
    setTongHopRows([]);
    setFileWarnings([]);
    setProcessedFiles([]);
    setErrorBanner(null);
    setSuccessBanner(null);
  };

  const renderChamTable = (rows: typeof dataset.chamTieuHoc, capLabel: string) => {
    if (rows.length === 0) {
      return (
        <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
          Chưa có dữ liệu phiếu chấm {capLabel}. Hãy tải lên ảnh chụp, PDF hoặc file Excel ở khung phía trên.
        </div>
      );
    }

    return (
      <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white">
        <table className="w-full text-left text-xs min-w-[1120px]">
          <thead className="bg-slate-100 text-slate-700 font-black uppercase border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-2.5 w-12">STT</th>
              <th className="py-2.5 px-2.5 w-32">Giám khảo</th>
              <th className="py-2.5 px-2.5 w-20">Lớp</th>
              <th className="py-2.5 px-2.5 min-w-[180px]">Tên tiết mục</th>
              <th className="py-2.5 px-2.5 w-28">Thể loại / TG</th>
              <th className="py-2.5 px-2 text-center w-20">Nội dung (25)</th>
              <th className="py-2.5 px-2 text-center w-20">Nghệ thuật (35)</th>
              <th className="py-2.5 px-2 text-center w-20">Sáng tạo (20)</th>
              <th className="py-2.5 px-2 text-center w-20">Tác phong (20)</th>
              <th className="py-2.5 px-2 text-center w-24">Tổng ghi phiếu</th>
              <th className="py-2.5 px-2 text-center w-24">Tổng 4 TC</th>
              <th className="py-2.5 px-2.5 w-32">Ghi chú</th>
              <th className="py-2.5 px-2.5 min-w-[200px]">Trạng thái kiểm tra</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className={r.hasWarning ? 'bg-amber-50/50' : 'hover:bg-slate-50'}>
                <td className="p-1.5">
                  <input
                    type="text"
                    value={r.stt ?? ''}
                    onChange={(e) => updateChamCell(r.id, 'stt', e.target.value)}
                    placeholder="—"
                    className="w-full px-2 py-1 rounded-lg border border-slate-200 bg-white text-center font-semibold"
                  />
                </td>
                <td className="p-1.5">
                  <input
                    type="text"
                    value={r.giamKhao ?? ''}
                    onChange={(e) => updateChamCell(r.id, 'giamKhao', e.target.value)}
                    placeholder="Tên GK"
                    className="w-full px-2 py-1 rounded-lg border border-slate-200 bg-white font-medium"
                  />
                </td>
                <td className="p-1.5">
                  <input
                    type="text"
                    value={r.lop ?? ''}
                    onChange={(e) => updateChamCell(r.id, 'lop', e.target.value)}
                    placeholder="Lớp"
                    className={`w-full px-2 py-1 rounded-lg border font-bold ${
                      !r.lop ? 'border-rose-400 bg-rose-50' : 'border-slate-200 bg-white text-indigo-700'
                    }`}
                  />
                </td>
                <td className="p-1.5">
                  <input
                    type="text"
                    value={r.tenTietMuc ?? ''}
                    onChange={(e) => updateChamCell(r.id, 'tenTietMuc', e.target.value)}
                    placeholder="Tên tiết mục"
                    className={`w-full px-2 py-1 rounded-lg border font-semibold ${
                      !r.tenTietMuc ? 'border-rose-400 bg-rose-50' : 'border-slate-200 bg-white text-slate-900'
                    }`}
                  />
                </td>
                <td className="p-1.5">
                  <input
                    type="text"
                    value={r.theLoaiThoiGian ?? ''}
                    onChange={(e) => updateChamCell(r.id, 'theLoaiThoiGian', e.target.value)}
                    placeholder="Thể loại"
                    className="w-full px-2 py-1 rounded-lg border border-slate-200 bg-white"
                  />
                </td>
                {(
                  [
                    { field: 'diemNoiDung', val: r.diemNoiDung, max: 25 },
                    { field: 'diemNgheThuat', val: r.diemNgheThuat, max: 35 },
                    { field: 'diemSangTao', val: r.diemSangTao, max: 20 },
                    { field: 'diemTacPhong', val: r.diemTacPhong, max: 20 }
                  ] as const
                ).map(({ field, val, max }) => {
                  const isOut = val !== null && (val < 0 || val > max);
                  const isMissing = val === null;
                  return (
                    <td key={field} className="p-1.5">
                      <input
                        type="text"
                        value={formatNumberInput(val)}
                        onChange={(e) => updateChamCell(r.id, field, e.target.value, true)}
                        placeholder="Trống"
                        className={`w-full px-1.5 py-1 rounded-lg border text-center font-bold ${
                          isOut
                            ? 'border-rose-500 bg-rose-50 text-rose-700'
                            : isMissing
                              ? 'border-amber-300 bg-amber-50 text-amber-800 placeholder-amber-500'
                              : 'border-slate-200 bg-white text-slate-900'
                        }`}
                      />
                    </td>
                  );
                })}
                <td className="p-1.5">
                  <input
                    type="text"
                    value={formatNumberInput(r.tongDiemGhiTrenPhieu)}
                    onChange={(e) => updateChamCell(r.id, 'tongDiemGhiTrenPhieu', e.target.value, true)}
                    placeholder="—"
                    className={`w-full px-1.5 py-1 rounded-lg border text-center font-black ${
                      r.tongDiemTinhLai !== null &&
                      r.tongDiemGhiTrenPhieu !== null &&
                      Math.abs(r.tongDiemTinhLai - r.tongDiemGhiTrenPhieu) > 0.001
                        ? 'border-rose-500 bg-rose-50 text-rose-700'
                        : 'border-slate-200 bg-slate-50 text-slate-800'
                    }`}
                  />
                </td>
                <td className="p-1.5 text-center font-black text-rose-700">
                  {r.tongDiemTinhLai !== null ? r.tongDiemTinhLai : <span className="text-slate-400 font-normal">Chờ đủ 4 ô</span>}
                </td>
                <td className="p-1.5">
                  <input
                    type="text"
                    value={r.ghiChu ?? ''}
                    onChange={(e) => updateChamCell(r.id, 'ghiChu', e.target.value)}
                    placeholder="Ghi chú"
                    className="w-full px-2 py-1 rounded-lg border border-slate-200 bg-white"
                  />
                </td>
                <td className="p-2">
                  <div
                    className={`text-[11px] font-semibold px-2 py-1 rounded-lg ${
                      r.hasWarning ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {r.trangThaiKiemTra}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[210px]">
                    {r.sourceFile} • {r.pageOrSheet} • Dòng {r.rowNumber}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTongHopTable = (rows: typeof dataset.tongHopTH, capLabel: string) => {
    if (rows.length === 0) {
      return (
        <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
          Chưa có dữ liệu bảng tổng hợp {capLabel}.
        </div>
      );
    }

    return (
      <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white">
        <table className="w-full text-left text-xs min-w-[960px]">
          <thead className="bg-slate-100 text-slate-700 font-black uppercase border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-2.5 w-14">TT</th>
              <th className="py-2.5 px-2.5 w-24">Lớp</th>
              <th className="py-2.5 px-2.5 min-w-[160px]">Tên tiết mục</th>
              <th className="py-2.5 px-2 text-center w-24">Điểm GK 1</th>
              <th className="py-2.5 px-2 text-center w-24">Điểm GK 2</th>
              <th className="py-2.5 px-2 text-center w-24">Điểm GK 3</th>
              <th className="py-2.5 px-2 text-center w-24">Tổng ghi bảng</th>
              <th className="py-2.5 px-2 text-center w-28">Tổng (GK1+2+3)</th>
              {includeAverage && <th className="py-2.5 px-2 text-center w-24">TB 3 GK</th>}
              <th className="py-2.5 px-2.5 w-32">Kết quả</th>
              <th className="py-2.5 px-2.5 min-w-[200px]">Trạng thái kiểm tra</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} className={r.hasWarning ? 'bg-amber-50/50' : 'hover:bg-slate-50'}>
                <td className="p-1.5">
                  <input
                    type="text"
                    value={r.tt ?? ''}
                    onChange={(e) => updateTongHopCell(r.id, 'tt', e.target.value)}
                    placeholder="—"
                    className="w-full px-2 py-1 rounded-lg border border-slate-200 bg-white text-center font-semibold"
                  />
                </td>
                <td className="p-1.5">
                  <input
                    type="text"
                    value={r.lop ?? ''}
                    onChange={(e) => updateTongHopCell(r.id, 'lop', e.target.value)}
                    placeholder="Lớp"
                    className={`w-full px-2 py-1 rounded-lg border font-bold ${
                      !r.lop ? 'border-rose-400 bg-rose-50' : 'border-slate-200 bg-white text-indigo-700'
                    }`}
                  />
                </td>
                <td className="p-1.5">
                  <input
                    type="text"
                    value={r.tenTietMuc ?? ''}
                    onChange={(e) => updateTongHopCell(r.id, 'tenTietMuc', e.target.value)}
                    placeholder="(Nếu có)"
                    className="w-full px-2 py-1 rounded-lg border border-slate-200 bg-white"
                  />
                </td>
                {(
                  [
                    { field: 'diemGK1', val: r.diemGK1 },
                    { field: 'diemGK2', val: r.diemGK2 },
                    { field: 'diemGK3', val: r.diemGK3 }
                  ] as const
                ).map(({ field, val }) => {
                  const isOut = val !== null && (val < 0 || val > 100);
                  const isMissing = val === null;
                  return (
                    <td key={field} className="p-1.5">
                      <input
                        type="text"
                        value={formatNumberInput(val)}
                        onChange={(e) => updateTongHopCell(r.id, field, e.target.value, true)}
                        placeholder="Trống"
                        className={`w-full px-1.5 py-1 rounded-lg border text-center font-bold ${
                          isOut
                            ? 'border-rose-500 bg-rose-50 text-rose-700'
                            : isMissing
                              ? 'border-amber-300 bg-amber-50 text-amber-800'
                              : 'border-slate-200 bg-white text-slate-900'
                        }`}
                      />
                    </td>
                  );
                })}
                <td className="p-1.5">
                  <input
                    type="text"
                    value={formatNumberInput(r.tongDiemGhiTrenPhieu)}
                    onChange={(e) => updateTongHopCell(r.id, 'tongDiemGhiTrenPhieu', e.target.value, true)}
                    placeholder="—"
                    className={`w-full px-1.5 py-1 rounded-lg border text-center font-black ${
                      r.tongDiemTinhLai !== null &&
                      r.tongDiemGhiTrenPhieu !== null &&
                      Math.abs(r.tongDiemTinhLai - r.tongDiemGhiTrenPhieu) > 0.001
                        ? 'border-rose-500 bg-rose-50 text-rose-700'
                        : 'border-slate-200 bg-slate-50 text-slate-800'
                    }`}
                  />
                </td>
                <td className="p-1.5 text-center font-black text-rose-700">
                  {r.tongDiemTinhLai !== null ? r.tongDiemTinhLai : <span className="text-slate-400 font-normal">Chờ đủ 3 GK</span>}
                </td>
                {includeAverage && (
                  <td className="p-1.5 text-center font-bold text-indigo-700">
                    {r.diemTrungBinh3GK !== null ? r.diemTrungBinh3GK : '—'}
                  </td>
                )}
                <td className="p-1.5">
                  <input
                    type="text"
                    value={r.ketQua ?? ''}
                    onChange={(e) => updateTongHopCell(r.id, 'ketQua', e.target.value)}
                    placeholder="Chưa xếp giải"
                    className="w-full px-2 py-1 rounded-lg border border-slate-200 bg-white"
                  />
                </td>
                <td className="p-2">
                  <div
                    className={`text-[11px] font-semibold px-2 py-1 rounded-lg ${
                      r.hasWarning ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {r.trangThaiKiemTra}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[210px]">
                    {r.sourceFile} • {r.pageOrSheet} • Dòng {r.rowNumber}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Banner Intro */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-black uppercase tracking-wider">
              <CopyCheck className="w-3.5 h-3.5" />
              Trợ lý nhập liệu &amp; kiểm tra điểm — Trường Tiểu học và THCS Nguyễn Văn Trỗi (2026–2027)
            </div>
            <h2 className="text-lg font-black text-slate-900">
              Trích Xuất &amp; Kiểm Tra Phiếu Chấm (Ảnh Chụp, Scan PDF, Excel)
            </h2>
            <p className="text-xs text-slate-600 max-w-3xl leading-relaxed">
              Đọc trung thực từ phiếu chấm viết tay, ảnh chụp màn hình hoặc tệp Excel nhiều sheet. Tự động kiểm tra thang điểm
              (25 / 35 / 20 / 20 = 100đ), đối chiếu tổng điểm ghi trên phiếu, phát hiện ô trống/chữ mờ (<strong>CẦN KIỂM TRA</strong>),
              phát hiện dòng trùng mà không tự ý sửa hay xóa, và xuất Excel 5 sheet chuẩn in A4 kèm công thức tự tính.
            </p>
          </div>

          {totalRowsCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleClearSession}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Làm mới phiên
              </button>
              <button
                type="button"
                onClick={() =>
                  exportAuditWorkbookXLSX(dataset, {
                    includeAverageOnSummary: includeAverage,
                    fileName: 'Bang_diem_van_nghe_20-11_2026-2027.xlsx'
                  })
                }
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Xuất Excel Chuẩn 5 Sheet (.xlsx)
              </button>
            </div>
          )}
        </div>

        {/* Upload Options + Dropzone */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                Gợi ý Cấp học (khi phiếu không ghi rõ)
              </label>
              <select
                value={capHocHint}
                onChange={(e) => setCapHocHint(e.target.value as AuditCapHoc | 'auto')}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800"
              >
                <option value="auto">Tự động nhận diện theo phiếu / tên lớp</option>
                <option value="tieuhoc">Cấp Tiểu học (Lớp 1–5)</option>
                <option value="thcs">Cấp THCS (Lớp 6–9)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 uppercase tracking-wider">
                Gợi ý Loại biểu mẫu
              </label>
              <select
                value={formTypeHint}
                onChange={(e) => setFormTypeHint(e.target.value as AuditFormType | 'auto')}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800"
              >
                <option value="auto">Tự phân biệt Phiếu chấm &amp; Bảng tổng hợp</option>
                <option value="phieu_cham">Phiếu chấm cá nhân Giám khảo (4 tiêu chí)</option>
                <option value="tong_hop">Bảng tổng hợp (GK 1 + GK 2 + GK 3)</option>
              </select>
            </div>

            <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeAverage}
                onChange={(e) => setIncludeAverage(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600"
              />
              <span className="text-[11px] font-semibold text-slate-700">
                Thêm cột chia trung bình (GK1+GK2+GK3)/3 ở Bảng tổng hợp
              </span>
            </label>
          </div>

          <div
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            className={`lg:col-span-2 border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all ${
              isProcessing
                ? 'border-indigo-300 bg-indigo-50/40 cursor-wait'
                : 'border-slate-300 hover:border-rose-400 hover:bg-rose-50/30 cursor-pointer'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.xlsx,.xls,.csv"
              onChange={handleFilesSelected}
              className="hidden"
            />
            {isProcessing ? (
              <>
                <Loader2 className="w-9 h-9 text-indigo-600 animate-spin mb-2" />
                <p className="text-sm font-black text-indigo-900">{progressText || 'Đang trích xuất dữ liệu...'}</p>
                <p className="text-xs text-indigo-600 mt-1">
                  Hệ thống đang đối chiếu từng ô điểm, giữ nguyên dấu tiếng Việt và kiểm tra lỗi bất thường...
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-sm font-black text-slate-800">
                  Nhấn để tải lên nhiều ảnh phiếu chấm, bản scan PDF hoặc file Excel
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-xl">
                  Hỗ trợ chọn nhiều tệp cùng lúc (.jpg, .png, .webp, .pdf, .xlsx, .xls, .csv). Từng trang và từng dòng được giữ nguyên thứ tự để đối chiếu.
                </p>
                {processedFiles.length > 0 && (
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {processedFiles.map((fn, idx) => (
                      <span
                        key={`${fn}-${idx}`}
                        className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-semibold"
                      >
                        {fn}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Alerts */}
        {errorBanner && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl flex items-center gap-2 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorBanner}</span>
          </div>
        )}
        {successBanner && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl flex items-center gap-2 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
        )}
      </div>

      {/* Anomaly Report Banner BEFORE Export */}
      {(totalRowsCount > 0 || fileWarnings.length > 0) && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500">Phiếu chấm Tiểu học</div>
            <div className="text-xl font-black text-rose-600">{dataset.chamTieuHoc.length} dòng</div>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500">Phiếu chấm THCS</div>
            <div className="text-xl font-black text-indigo-600">{dataset.chamTHCS.length} dòng</div>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500">Tổng hợp TH</div>
            <div className="text-xl font-black text-emerald-600">{dataset.tongHopTH.length} dòng</div>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200">
            <div className="text-[11px] font-bold text-slate-500">Tổng hợp THCS</div>
            <div className="text-xl font-black text-teal-600">{dataset.tongHopTHCS.length} dòng</div>
          </div>
          <div
            onClick={() => setActiveSheetTab('Loi_can_kiem_tra')}
            className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
              dataset.issues.length > 0 || fileWarnings.length > 0
                ? 'bg-amber-50 border-amber-300 hover:bg-amber-100/70'
                : 'bg-emerald-50 border-emerald-200'
            }`}
          >
            <div className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
              Lỗi / Cần kiểm tra
            </div>
            <div
              className={`text-xl font-black ${
                dataset.issues.length + fileWarnings.length > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {dataset.issues.length + fileWarnings.length} mục
            </div>
          </div>
        </div>
      )}

      {/* Preview Tabs + Per-sheet CSV Fallback Export */}
      {(totalRowsCount > 0 || fileWarnings.length > 0) && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'Cham_Tieu_hoc', label: `Cham_Tieu_hoc (${dataset.chamTieuHoc.length})` },
                  { id: 'Cham_THCS', label: `Cham_THCS (${dataset.chamTHCS.length})` },
                  { id: 'Tong_hop_TH', label: `Tong_hop_TH (${dataset.tongHopTH.length})` },
                  { id: 'Tong_hop_THCS', label: `Tong_hop_THCS (${dataset.tongHopTHCS.length})` },
                  {
                    id: 'Loi_can_kiem_tra',
                    label: `Loi_can_kiem_tra (${dataset.issues.length + fileWarnings.length})`
                  }
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveSheetTab(t.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeSheetTab === t.id
                      ? t.id === 'Loi_can_kiem_tra' && dataset.issues.length > 0
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => exportAuditSheetCSV(activeSheetTab, dataset, includeAverage)}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              title="Tải riêng sheet đang xem dưới dạng CSV (UTF-8 BOM)"
            >
              <Download className="w-3.5 h-3.5" />
              Xuất CSV sheet này
            </button>
          </div>

          {activeSheetTab === 'Cham_Tieu_hoc' && renderChamTable(dataset.chamTieuHoc, 'Tiểu học')}
          {activeSheetTab === 'Cham_THCS' && renderChamTable(dataset.chamTHCS, 'THCS')}
          {activeSheetTab === 'Tong_hop_TH' && renderTongHopTable(dataset.tongHopTH, 'Tiểu học')}
          {activeSheetTab === 'Tong_hop_THCS' && renderTongHopTable(dataset.tongHopTHCS, 'THCS')}

          {activeSheetTab === 'Loi_can_kiem_tra' && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-black text-amber-950 uppercase">
                    Danh sách lỗi &amp; điểm bất thường cần đối chiếu phiếu gốc
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-amber-800">
                  Ô chỉnh sửa trực tiếp ở từng sheet sẽ cập nhật ngay trạng thái tại đây
                </span>
              </div>

              {fileWarnings.length > 0 && (
                <div className="p-4 border-b border-amber-100 bg-amber-50/30 space-y-1">
                  {fileWarnings.map((w, idx) => (
                    <div key={idx} className="text-xs font-semibold text-amber-900 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {dataset.issues.length === 0 ? (
                <div className="p-8 text-center text-xs font-bold text-emerald-700">
                  Không phát hiện bất thường nào trong các bảng điểm đã nhập!
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-black uppercase border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-12">STT</th>
                        <th className="py-2.5 px-3 w-28">Sheet</th>
                        <th className="py-2.5 px-3 w-32">Loại cảnh báo</th>
                        <th className="py-2.5 px-3">Nguồn / Trang / Dòng</th>
                        <th className="py-2.5 px-3 w-20">Lớp</th>
                        <th className="py-2.5 px-3">Tiết mục</th>
                        <th className="py-2.5 px-3">Cột</th>
                        <th className="py-2.5 px-3">Chi tiết cần kiểm tra</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dataset.issues.map((issue, idx) => (
                        <tr key={idx} className="hover:bg-amber-50/40">
                          <td className="py-2 px-3 font-bold text-slate-500">{idx + 1}</td>
                          <td className="py-2 px-3 font-bold text-indigo-700">{issue.sheetName}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                                issue.issueType === 'VƯỢT THANG' || issue.issueType === 'LỆCH TỔNG'
                                  ? 'bg-rose-100 text-rose-800'
                                  : issue.issueType === 'TRÙNG DÒNG'
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {issue.issueType}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {issue.sourceFile} ({issue.pageOrSheet} - d.{issue.rowNumber})
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-900">{issue.lop || '—'}</td>
                          <td className="py-2 px-3 font-medium text-slate-800">
                            {issue.tenTietMuc || '—'}
                            {issue.giamKhao && (
                              <span className="block text-[10px] text-slate-400">GK: {issue.giamKhao}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-700">{issue.columnName}</td>
                          <td className="py-2 px-3 text-slate-800">{issue.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
