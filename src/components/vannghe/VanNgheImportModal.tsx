import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ClipboardPaste,
  Music
} from 'lucide-react';
import { CapHocVanNghe } from '../../types/vannghe';
import { batchImportTietMuc, ImportTietMucInput } from '../../services/vanngheService';

interface VanNgheImportModalProps {
  isOpen: boolean;
  defaultCapHoc: CapHocVanNghe;
  onClose: () => void;
  onSuccess: (addedCount: number) => void;
}

interface ParsedTietMucRow extends ImportTietMucInput {
  rowIndex: number;
  isValid: boolean;
  error?: string;
}

function normalizeHeader(h: string): string {
  return String(h || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');
}

function inferCapHocFromRow(rawCapHoc: string, lop: string, fallback: CapHocVanNghe): CapHocVanNghe {
  const norm = normalizeHeader(rawCapHoc);
  if (norm.includes('tieuhoc') || norm === 'th' || norm === 'cap1') return 'tieuhoc';
  if (norm.includes('thcs') || norm.includes('trunghoccoso') || norm === 'cap2') return 'thcs';

  const gradeMatch = String(lop || '').trim().match(/^(\d{1,2})/);
  if (gradeMatch) {
    const grade = parseInt(gradeMatch[1], 10);
    if (grade >= 1 && grade <= 5) return 'tieuhoc';
    if (grade >= 6 && grade <= 9) return 'thcs';
  }
  return fallback;
}

export const VanNgheImportModal: React.FC<VanNgheImportModalProps> = ({
  isOpen,
  defaultCapHoc,
  onClose,
  onSuccess
}) => {
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
  const [fileName, setFileName] = useState<string>('');
  const [pasteText, setPasteText] = useState<string>('');
  const [rows, setRows] = useState<ParsedTietMucRow[]>([]);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [forceDefaultCapHoc, setForceDefaultCapHoc] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const sampleRows =
      defaultCapHoc === 'tieuhoc'
        ? [
            {
              'STT': 1,
              'Tên lớp': '1A',
              'Tiết mục': 'Thầy cô cho em mùa xuân',
              'Thể loại': 'Múa độc lập',
              'Người thể hiện': 'Tốp múa lớp 1A',
              'Thời lượng': '4:15',
              'Ghi chú': 'Trang phục hoa sen'
            },
            {
              'STT': 2,
              'Tên lớp': '2B',
              'Tiết mục': 'Bông hồng tặng cô',
              'Thể loại': 'Đơn ca kết hợp múa phụ họa',
              'Người thể hiện': 'Bảo An & Tốp múa',
              'Thời lượng': '3:50',
              'Ghi chú': ''
            },
            {
              'STT': 3,
              'Tên lớp': '4A',
              'Tiết mục': 'Hào khí Việt Nam',
              'Thể loại': 'Tốp ca múa',
              'Người thể hiện': 'Đội văn nghệ 4A',
              'Thời lượng': '4:30',
              'Ghi chú': 'Cần 4 mic không dây'
            }
          ]
        : [
            {
              'STT': 1,
              'Tên lớp': '6A1',
              'Tiết mục': 'Lời thầy cô',
              'Thể loại': 'Tốp ca múa',
              'Người thể hiện': 'Chi đội 6A1',
              'Thời lượng': '4:30',
              'Ghi chú': ''
            },
            {
              'STT': 2,
              'Tên lớp': '7B',
              'Tiết mục': 'Bụi phấn & Người thầy',
              'Thể loại': 'Song ca',
              'Người thể hiện': 'Minh Anh - Gia Huy',
              'Thời lượng': '4:10',
              'Ghi chú': 'Nhạc beat chuẩn'
            },
            {
              'STT': 3,
              'Tên lớp': '9A',
              'Tiết mục': 'Việt Nam trong tôi là',
              'Thể loại': 'Kịch - Hoạt cảnh',
              'Người thể hiện': 'Tập thể lớp 9A',
              'Thời lượng': '5:30',
              'Ghi chú': 'Đạo cụ nón lá'
            }
          ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 12 },
      { wch: 32 },
      { wch: 24 },
      { wch: 24 },
      { wch: 12 },
      { wch: 24 }
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'TietMucVanNghe');
    XLSX.writeFile(workbook, `Mau_Danh_Sach_Tiet_Muc_Van_Nghe_${defaultCapHoc}.xlsx`);
  };

  const mapRawObjectsToRows = (rawObjects: Record<string, unknown>[]): ParsedTietMucRow[] => {
    return rawObjects
      .map((obj, idx) => {
        const entries = Object.entries(obj).map(([k, v]) => [normalizeHeader(k), String(v ?? '').trim()] as const);
        const getField = (aliases: string[]): string => {
          for (const alias of aliases) {
            const found = entries.find(([key]) => key === alias || key.includes(alias));
            if (found && found[1]) return found[1];
          }
          return '';
        };

        const sttRaw = getField(['stt', 'sothutu', 'thutu']);
        const lop = getField(['tenlop', 'lop', 'lophoc', 'chidoi', 'donvi']);
        const tenTietMuc = getField(['tietmuc', 'tentietmuc', 'tenbaihat', 'baihat', 'noidung']);
        const theLoai = getField(['theloai', 'loaihinh', 'hinhthuc']);
        const nguoiTheHien = getField(['nguoithehien', 'bieudien', 'hocsinh', 'doibieudien']);
        const thoiLuong = getField(['thoiluong', 'thoigian']);
        const ghiChu = getField(['ghichu', 'note']);
        const rawCapHoc = getField(['caphoc', 'cap']);

        const sttParsed = parseInt(sttRaw, 10);
        const capHoc = forceDefaultCapHoc
          ? defaultCapHoc
          : inferCapHocFromRow(rawCapHoc, lop, defaultCapHoc);

        const missingFields: string[] = [];
        if (!lop) missingFields.push('Tên lớp');
        if (!tenTietMuc) missingFields.push('Tên tiết mục');

        return {
          rowIndex: idx + 1,
          stt: Number.isFinite(sttParsed) && sttParsed > 0 ? sttParsed : idx + 1,
          capHoc,
          lop,
          tenTietMuc,
          theLoai: theLoai || 'Văn nghệ',
          nguoiTheHien,
          thoiLuong: thoiLuong || '4:00',
          ghiChu,
          isValid: missingFields.length === 0,
          error: missingFields.length > 0 ? `Thiếu ${missingFields.join(', ')}` : undefined
        };
      })
      .filter((r) => r.lop || r.tenTietMuc || r.theLoai !== 'Văn nghệ' || r.nguoiTheHien);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) {
        setErrorMessage('File không có sheet dữ liệu nào.');
        return;
      }
      const worksheet = workbook.Sheets[firstSheet];
      const rawObjects = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

      if (rawObjects.length === 0) {
        setErrorMessage('Tệp tải lên không có dữ liệu. Vui lòng kiểm tra lại đúng mẫu cột: Tên lớp, Tiết mục, Thể loại.');
        setRows([]);
        return;
      }

      const parsed = mapRawObjectsToRows(rawObjects);
      if (parsed.length === 0) {
        setErrorMessage('Không tìm thấy cột "Tên lớp" hoặc "Tiết mục" hợp lệ trong tệp.');
        setRows([]);
        return;
      }
      setRows(parsed);
    } catch (err) {
      console.error('Lỗi đọc tệp danh sách tiết mục:', err);
      setErrorMessage('Không thể đọc dữ liệu từ tệp. Vui lòng dùng tệp .xlsx, .xls hoặc .csv hợp lệ.');
    }
  };

  const handleParsePastedText = () => {
    setErrorMessage(null);
    const lines = pasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setErrorMessage('Vui lòng dán dữ liệu từ Excel hoặc nhập danh sách theo dòng.');
      return;
    }

    const splitLine = (line: string): string[] => {
      if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
      if (line.includes(';')) return line.split(';').map((c) => c.trim());
      if (line.includes('|')) return line.split('|').map((c) => c.trim());
      return line.split(',').map((c) => c.trim());
    };

    const firstCells = splitLine(lines[0]).map(normalizeHeader);
    const hasHeader = firstCells.some(
      (c) => c.includes('lop') || c.includes('tietmuc') || c.includes('theloai')
    );

    const dataLines = hasHeader ? lines.slice(1) : lines;
    const rawObjects: Record<string, unknown>[] = dataLines.map((line) => {
      const cells = splitLine(line);
      if (hasHeader) {
        const obj: Record<string, unknown> = {};
        const headerCells = splitLine(lines[0]);
        headerCells.forEach((h, i) => {
          obj[h] = cells[i] ?? '';
        });
        return obj;
      }

      // Positional fallback: check if col 0 looks like STT (number)
      const isFirstStt = /^\d+$/.test(cells[0] || '') && cells.length >= 3;
      if (isFirstStt) {
        return {
          'STT': cells[0] || '',
          'Tên lớp': cells[1] || '',
          'Tiết mục': cells[2] || '',
          'Thể loại': cells[3] || '',
          'Người thể hiện': cells[4] || '',
          'Thời lượng': cells[5] || '',
          'Ghi chú': cells[6] || ''
        };
      }
      return {
        'Tên lớp': cells[0] || '',
        'Tiết mục': cells[1] || '',
        'Thể loại': cells[2] || '',
        'Người thể hiện': cells[3] || '',
        'Thời lượng': cells[4] || '',
        'Ghi chú': cells[5] || ''
      };
    });

    const parsed = mapRawObjectsToRows(rawObjects);
    if (parsed.length === 0) {
      setErrorMessage('Không phân tích được tiết mục nào từ nội dung đã dán.');
      return;
    }
    setRows(parsed);
  };

  const handleRemoveRow = (rowIndex: number) => {
    setRows((prev) => prev.filter((r) => r.rowIndex !== rowIndex));
  };

  const validRows = rows.filter((r) => r.isValid);
  const invalidRows = rows.filter((r) => !r.isValid);

  const handleConfirmImport = async () => {
    if (validRows.length === 0) {
      setErrorMessage('Chưa có dòng dữ liệu hợp lệ nào để nhập.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    try {
      const { addedCount } = await batchImportTietMuc(
        validRows.map((r) => ({
          stt: r.stt,
          capHoc: forceDefaultCapHoc ? defaultCapHoc : r.capHoc,
          lop: r.lop,
          tenTietMuc: r.tenTietMuc,
          theLoai: r.theLoai,
          thoiLuong: r.thoiLuong,
          nguoiTheHien: r.nguoiTheHien,
          ghiChu: r.ghiChu
        })),
        {
          mode: importMode,
          defaultCapHoc
        }
      );
      onSuccess(addedCount);
      onClose();
    } catch (err) {
      console.error('Lỗi nhập danh sách tiết mục:', err);
      setErrorMessage('Có lỗi khi lưu danh sách tiết mục. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-rose-50 via-white to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                Nhập Danh Sách Tiết Mục Theo Mẫu
              </h3>
              <p className="text-xs text-slate-500">
                Hỗ trợ các cột: <span className="font-bold text-slate-700">Tên lớp</span>,{' '}
                <span className="font-bold text-slate-700">Tiết mục</span>,{' '}
                <span className="font-bold text-slate-700">Thể loại</span> (từ Excel .xlsx / .xls / .csv hoặc dán trực tiếp)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Step 1: Download Template */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-black text-emerald-900 uppercase tracking-wider">
                Bước 1: Tải file mẫu Excel chuẩn (.xlsx)
              </div>
              <p className="text-xs text-emerald-700">
                File mẫu gồm sẵn cột: <span className="font-bold">STT, Tên lớp, Tiết mục, Thể loại</span>, Người thể hiện, Thời lượng, Ghi chú.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shrink-0 shadow-xs cursor-pointer transition-colors"
            >
              <Download className="w-4 h-4" />
              Tải File Mẫu (.xlsx)
            </button>
          </div>

          {/* Input Mode Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setInputMode('file')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  inputMode === 'file' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                Tải file Excel / CSV
              </button>
              <button
                type="button"
                onClick={() => setInputMode('paste')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  inputMode === 'paste' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                Dán nhanh từ Excel
              </button>
            </div>

            <div className="text-xs font-semibold text-slate-600">
              Cấp đang chọn:{' '}
              <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 font-black">
                {defaultCapHoc === 'tieuhoc' ? 'Tiểu học (Lớp 1-5)' : 'THCS (Lớp 6-9)'}
              </span>
            </div>
          </div>

          {/* Step 2: Upload or Paste */}
          {inputMode === 'file' ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-rose-400 hover:bg-rose-50/30 rounded-2xl p-6 text-center cursor-pointer transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800">
                {fileName ? `Đã chọn tệp: ${fileName}` : 'Nhấn để chọn tệp Excel (.xlsx, .xls) hoặc .csv'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Hệ thống tự động nhận diện các cột: Tên lớp, Tiết mục, Thể loại (không phân biệt chữ hoa/thường hoặc dấu).
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <textarea
                rows={5}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={`Dán bảng từ Excel / Google Sheets hoặc nhập mỗi dòng theo dạng:\n1A\tThầy cô cho em mùa xuân\tMúa độc lập\n2B\tBông hồng tặng cô\tĐơn ca`}
                className="w-full p-3.5 rounded-2xl border border-slate-200 text-xs font-mono text-slate-800 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleParsePastedText}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Music className="w-3.5 h-3.5" />
                  Đọc Dữ Liệu Đã Dán
                </button>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl flex items-center gap-2 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Import Options & Preview */}
          {rows.length > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                    Chế độ nhập danh sách
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setImportMode('append')}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        importMode === 'append'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Thêm tiếp vào danh sách
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode('replace')}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        importMode === 'replace'
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Thay thế danh sách cũ
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">
                    Phân loại cấp học
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setForceDefaultCapHoc(true)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        forceDefaultCapHoc
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Gán tất cả vào {defaultCapHoc === 'tieuhoc' ? 'Tiểu học' : 'THCS'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setForceDefaultCapHoc(false)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        !forceDefaultCapHoc
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Tự nhận diện theo Tên lớp
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Hợp lệ: {validRows.length} tiết mục
                  </span>
                  {invalidRows.length > 0 && (
                    <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Lỗi (sẽ bỏ qua): {invalidRows.length}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRows([]);
                    setFileName('');
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-rose-600 cursor-pointer"
                >
                  Xóa xem trước
                </button>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-black uppercase sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3 w-12">STT</th>
                        <th className="py-2.5 px-3 w-24">Tên lớp</th>
                        <th className="py-2.5 px-3">Tiết mục</th>
                        <th className="py-2.5 px-3 w-36">Thể loại</th>
                        <th className="py-2.5 px-3 w-24">Cấp học</th>
                        <th className="py-2.5 px-3 w-28">Trạng thái</th>
                        <th className="py-2.5 px-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((r) => {
                        const effectiveCap = forceDefaultCapHoc ? defaultCapHoc : r.capHoc;
                        return (
                          <tr key={r.rowIndex} className={r.isValid ? 'bg-white' : 'bg-rose-50/50'}>
                            <td className="py-2 px-3 font-bold text-slate-500">#{r.rowIndex}</td>
                            <td className="py-2 px-3 font-black text-indigo-700">{r.lop || '-'}</td>
                            <td className="py-2 px-3">
                              <div className="font-bold text-slate-900">{r.tenTietMuc || '-'}</div>
                              {r.nguoiTheHien && (
                                <div className="text-[11px] text-slate-500">{r.nguoiTheHien}</div>
                              )}
                            </td>
                            <td className="py-2 px-3 font-medium text-slate-700">{r.theLoai}</td>
                            <td className="py-2 px-3 font-semibold text-slate-600">
                              {effectiveCap === 'tieuhoc' ? 'Tiểu học' : 'THCS'}
                            </td>
                            <td className="py-2 px-3">
                              {r.isValid ? (
                                <span className="text-emerald-700 font-bold">Sẵn sàng</span>
                              ) : (
                                <span className="text-rose-600 font-bold">{r.error}</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveRow(r.rowIndex)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                                title="Bỏ dòng này"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
          >
            Đóng
          </button>
          <button
            type="button"
            disabled={isSaving || validRows.length === 0}
            onClick={handleConfirmImport}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            {isSaving ? 'Đang lưu danh sách...' : `Nhập ${validRows.length} Tiết Mục`}
          </button>
        </div>
      </div>
    </div>
  );
};
