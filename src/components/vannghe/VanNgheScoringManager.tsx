import React, { useState, useEffect } from 'react';
import {
  Music,
  Award,
  Trophy,
  Users,
  CheckCircle2,
  Save,
  Plus,
  Trash2,
  Edit2,
  Printer,
  Download,
  Settings,
  ChevronRight,
  Filter,
  Sparkles,
  AlertCircle,
  Clock,
  Mic,
  Star,
  Upload,
  FileSpreadsheet,
  ScanLine
} from 'lucide-react';
import { VanNgheImportModal } from './VanNgheImportModal';
import { VanNgheSheetAuditPanel } from './VanNgheSheetAuditPanel';
import {
  TietMucVanNghe,
  DiemGiamKhao,
  CauHinhVanNghe,
  CapHocVanNghe,
  KetQuaTietMucSummary,
  GiamKhaoInfo
} from '../../types/vannghe';
import {
  getCauHinhVanNghe,
  updateCauHinhVanNghe,
  getDanhSachTietMuc,
  addTietMuc,
  updateTietMuc,
  deleteTietMuc,
  getDanhSachDiem,
  saveDiemGiamKhao,
  calculateBangTongHop,
  DEFAULT_CAUHINH
} from '../../services/vanngheService';

export const VanNgheScoringManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'nhap-diem' | 'bang-tong-hop' | 'quan-ly-tiet-muc' | 'in-bien-ban' | 'kiem-tra-phieu'>('nhap-diem');
  const [capHocFilter, setCapHocFilter] = useState<CapHocVanNghe>('tieuhoc');
  const [cauhinh, setCauhinh] = useState<CauHinhVanNghe>(DEFAULT_CAUHINH);
  const [tietMucList, setTietMucList] = useState<TietMucVanNghe[]>([]);
  const [diemList, setDiemList] = useState<DiemGiamKhao[]>([]);
  const [bangTongHop, setBangTongHop] = useState<KetQuaTietMucSummary[]>([]);
  const [selectedGiamKhaoId, setSelectedGiamKhaoId] = useState<string>('gk_1');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deletingTietMuc, setDeletingTietMuc] = useState<{ id: string; name: string } | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingTietMuc, setEditingTietMuc] = useState<TietMucVanNghe | null>(null);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);

  // Form input state for scoring
  const [scoreInputs, setScoreInputs] = useState<Record<string, {
    diemNoiDung: number;
    diemNgheThuat: number;
    diemSangTao: number;
    diemTacPhong: number;
    nhanXet: string;
  }>>({});

  // Form state for adding/editing Tiet Muc
  const [formTietMuc, setFormTietMuc] = useState<Partial<TietMucVanNghe>>({
    capHoc: 'tieuhoc',
    lop: '',
    tenTietMuc: '',
    theLoai: 'Múa',
    thoiLuong: '4:00',
    nguoiTheHien: '',
    ghiChu: ''
  });

  // Load all data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ch, tm, dm, th] = await Promise.all([
        getCauHinhVanNghe(),
        getDanhSachTietMuc(capHocFilter),
        getDanhSachDiem(),
        calculateBangTongHop(capHocFilter)
      ]);
      setCauhinh(ch);
      setTietMucList(tm);
      setDiemList(dm);
      setBangTongHop(th);

      // Pre-fill score inputs from existing scores for currently selected judge
      const inputs: Record<string, any> = {};
      tm.forEach(item => {
        const existing = dm.find(d => d.tietMucId === item.id && d.giamKhaoId === selectedGiamKhaoId);
        if (existing) {
          inputs[item.id] = {
            diemNoiDung: existing.diemNoiDung,
            diemNgheThuat: existing.diemNgheThuat,
            diemSangTao: existing.diemSangTao,
            diemTacPhong: existing.diemTacPhong,
            nhanXet: existing.nhanXet || ''
          };
        } else {
          inputs[item.id] = {
            diemNoiDung: 0,
            diemNgheThuat: 0,
            diemSangTao: 0,
            diemTacPhong: 0,
            nhanXet: ''
          };
        }
      });
      setScoreInputs(inputs);
    } catch (err) {
      console.warn('Lỗi tải dữ liệu văn nghệ:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [capHocFilter, selectedGiamKhaoId]);

  // Handle score input change
  const handleScoreChange = (tietMucId: string, field: string, value: any) => {
    setScoreInputs(prev => {
      const current = prev[tietMucId] || { diemNoiDung: 0, diemNgheThuat: 0, diemSangTao: 0, diemTacPhong: 0, nhanXet: '' };
      return {
        ...prev,
        [tietMucId]: {
          ...current,
          [field]: field === 'nhanXet' ? value : Math.max(0, Number(value) || 0)
        }
      };
    });
  };

  // Save score for a single performance
  const handleSaveScore = async (tm: TietMucVanNghe) => {
    const input = scoreInputs[tm.id] || { diemNoiDung: 0, diemNgheThuat: 0, diemSangTao: 0, diemTacPhong: 0, nhanXet: '' };
    const currentGk = cauhinh.danhSachGiamKhao.find(g => g.id === selectedGiamKhaoId) || cauhinh.danhSachGiamKhao[0];

    // Validate boundaries
    const max = cauhinh.thangDiem;
    if (input.diemNoiDung > max.maxNoiDung) {
      setErrorMsg(`Điểm Nội dung tối đa ${max.maxNoiDung} điểm`);
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }
    if (input.diemNgheThuat > max.maxNgheThuat) {
      setErrorMsg(`Điểm Nghệ thuật tối đa ${max.maxNgheThuat} điểm`);
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }
    if (input.diemSangTao > max.maxSangTao) {
      setErrorMsg(`Điểm Sáng tạo tối đa ${max.maxSangTao} điểm`);
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }
    if (input.diemTacPhong > max.maxTacPhong) {
      setErrorMsg(`Điểm Tác phong tối đa ${max.maxTacPhong} điểm`);
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    setErrorMsg(null);
    await saveDiemGiamKhao({
      tietMucId: tm.id,
      giamKhaoId: currentGk.id,
      giamKhaoTen: currentGk.ten,
      capHoc: tm.capHoc,
      diemNoiDung: input.diemNoiDung,
      diemNgheThuat: input.diemNgheThuat,
      diemSangTao: input.diemSangTao,
      diemTacPhong: input.diemTacPhong,
      nhanXet: input.nhanXet
    });

    setSaveSuccessMsg(`Đã lưu điểm tiết mục: ${tm.tenTietMuc} (${tm.lop})`);
    setTimeout(() => setSaveSuccessMsg(null), 3000);

    // Refresh totals
    const th = await calculateBangTongHop(capHocFilter);
    setBangTongHop(th);
  };

  // Add / Update Tiet Muc
  const handleSaveTietMuc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTietMuc.tenTietMuc || !formTietMuc.lop) {
      setErrorMsg('Vui lòng nhập Tên tiết mục và Lớp');
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    if (editingTietMuc) {
      await updateTietMuc(editingTietMuc.id, formTietMuc);
    } else {
      await addTietMuc({
        stt: tietMucList.length + 1,
        capHoc: formTietMuc.capHoc as CapHocVanNghe || capHocFilter,
        lop: formTietMuc.lop || '',
        tenTietMuc: formTietMuc.tenTietMuc || '',
        theLoai: formTietMuc.theLoai || 'Múa',
        thoiLuong: formTietMuc.thoiLuong || '4:00',
        nguoiTheHien: formTietMuc.nguoiTheHien || '',
        ghiChu: formTietMuc.ghiChu || '',
        status: 'active'
      });
    }

    setShowAddModal(false);
    setEditingTietMuc(null);
    setFormTietMuc({
      capHoc: capHocFilter,
      lop: '',
      tenTietMuc: '',
      theLoai: 'Múa',
      thoiLuong: '4:00',
      nguoiTheHien: '',
      ghiChu: ''
    });
    loadData();
  };

  const handleDeleteTietMuc = (id: string, name: string) => {
    setDeletingTietMuc({ id, name });
  };

  const confirmDeleteTietMuc = async () => {
    if (!deletingTietMuc) return;
    await deleteTietMuc(deletingTietMuc.id);
    setDeletingTietMuc(null);
    loadData();
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['STT', 'Lớp', 'Tên tiết mục', 'Thể loại', 'Cấp học', ...cauhinh.danhSachGiamKhao.map(g => g.ten), 'Điểm TB', 'Xếp hạng', 'Giải thưởng'];
    const rows = bangTongHop.map((b, idx) => {
      const gkScores = cauhinh.danhSachGiamKhao.map(g => {
        const d = b.diemCacGiamKhao.find(score => score.giamKhaoId === g.id);
        return d ? d.tongDiem.toFixed(2) : '0';
      });
      return [
        idx + 1,
        `"${b.tietMuc.lop}"`,
        `"${b.tietMuc.tenTietMuc}"`,
        `"${b.tietMuc.theLoai}"`,
        b.tietMuc.capHoc === 'tieuhoc' ? 'Tiểu học' : 'THCS',
        ...gkScores,
        b.diemTrungBinh.toFixed(2),
        b.xepHang,
        `"${b.danhHieuGiai || ''}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Bang_Diem_Van_Nghe_20_11_${capHocFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getBadgeClass = (giai?: string) => {
    switch (giai) {
      case 'Giải Nhất':
        return 'bg-amber-100 text-amber-800 border-amber-300 font-bold';
      case 'Giải Nhì':
        return 'bg-slate-100 text-slate-800 border-slate-300 font-semibold';
      case 'Giải Ba':
        return 'bg-orange-100 text-orange-800 border-orange-300 font-semibold';
      case 'Giải Khuyến khích':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-rose-600 via-pink-600 to-indigo-700 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/10 transform skew-x-12 pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              Chào mừng Ngày Nhà Giáo Việt Nam 20/11
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
              <Music className="w-8 h-8 text-yellow-300 animate-pulse" />
              {cauhinh.tenHoiThi}
            </h1>
            <p className="text-rose-100 text-sm max-w-2xl">
              Hệ thống chấm thi văn nghệ chuyên nghiệp: Chấm theo thang điểm 100, 4 tiêu chí chuẩn hóa, tính điểm trung bình giám khảo tự động, phân giải Nhất - Nhì - Ba và xuất biên bản in A4.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20">
            <button
              onClick={() => setCapHocFilter('tieuhoc')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                capHocFilter === 'tieuhoc'
                  ? 'bg-white text-rose-700 shadow-sm'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              Cấp Tiểu Học (Lớp 1-5)
            </button>
            <button
              onClick={() => setCapHocFilter('thcs')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                capHocFilter === 'thcs'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              Cấp THCS (Lớp 6-9)
            </button>
          </div>
        </div>
      </div>

      {/* Save Success Alert */}
      {saveSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-2xl flex items-center gap-2 text-sm font-semibold shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Validation Error Alert */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-300 text-rose-800 px-4 py-3 rounded-2xl flex items-center gap-2 text-sm font-semibold shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Tab Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('nhap-diem')}
            className={`px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all ${
              activeTab === 'nhap-diem'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Edit2 className="w-4 h-4" />
            Nhập điểm Giám khảo
          </button>

          <button
            onClick={() => setActiveTab('bang-tong-hop')}
            className={`px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all ${
              activeTab === 'bang-tong-hop'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-500" />
            Bảng tổng hợp & Xếp giải
          </button>

          <button
            onClick={() => setActiveTab('quan-ly-tiet-muc')}
            className={`px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all ${
              activeTab === 'quan-ly-tiet-muc'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Music className="w-4 h-4" />
            Danh sách tiết mục ({tietMucList.length})
          </button>

          <button
            onClick={() => setActiveTab('in-bien-ban')}
            className={`px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'in-bien-ban'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Printer className="w-4 h-4" />
            Biên bản in A4
          </button>

          <button
            onClick={() => setActiveTab('kiem-tra-phieu')}
            className={`px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'kiem-tra-phieu'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200'
            }`}
          >
            <ScanLine className="w-4 h-4" />
            Quét &amp; Kiểm tra phiếu
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-3.5 py-2 rounded-2xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            Nhập từ Excel theo mẫu
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-2xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Xuất Excel/CSV
          </button>

          <button
            onClick={() => setShowConfigModal(true)}
            className="p-2 rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 cursor-pointer"
            title="Cấu hình hội thi"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* TAB 1: NHẬP ĐIỂM GIÁM KHẢO */}
      {activeTab === 'nhap-diem' && (
        <div className="space-y-6">
          {/* Selector Giám khảo */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Đang chấm với tư cách:</div>
                <div className="text-sm font-black text-slate-800">
                  {cauhinh.danhSachGiamKhao.find(g => g.id === selectedGiamKhaoId)?.ten || 'Giám khảo'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Chuyển Giám khảo:</span>
              {cauhinh.danhSachGiamKhao.map(gk => (
                <button
                  key={gk.id}
                  onClick={() => setSelectedGiamKhaoId(gk.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedGiamKhaoId === gk.id
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {gk.ten}
                </button>
              ))}
            </div>
          </div>

          {/* Thang điểm quy chuẩn */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-3 text-center">
              <div className="text-xs font-semibold text-rose-700">1. Nội dung</div>
              <div className="text-lg font-black text-rose-900">Tối đa {cauhinh.thangDiem.maxNoiDung}đ</div>
              <div className="text-[11px] text-rose-600">Đúng chủ đề 20/11, quê hương</div>
            </div>
            <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-3 text-center">
              <div className="text-xs font-semibold text-indigo-700">2. Nghệ thuật</div>
              <div className="text-lg font-black text-indigo-900">Tối đa {cauhinh.thangDiem.maxNgheThuat}đ</div>
              <div className="text-[11px] text-indigo-600">Giọng hát, kỹ thuật múa, phối bè</div>
            </div>
            <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-3 text-center">
              <div className="text-xs font-semibold text-amber-700">3. Sáng tạo</div>
              <div className="text-lg font-black text-amber-900">Tối đa {cauhinh.thangDiem.maxSangTao}đ</div>
              <div className="text-[11px] text-amber-600">Dàn dựng mới lạ, độc đáo</div>
            </div>
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-3 text-center">
              <div className="text-xs font-semibold text-emerald-700">4. Tác phong</div>
              <div className="text-lg font-black text-emerald-900">Tối đa {cauhinh.thangDiem.maxTacPhong}đ</div>
              <div className="text-[11px] text-emerald-600">Trang phục, tự tin, đúng giờ</div>
            </div>
          </div>

          {/* Danh sách tiết mục để chấm */}
          <div className="space-y-4">
            {tietMucList.map(tm => {
              const input = scoreInputs[tm.id] || { diemNoiDung: 0, diemNgheThuat: 0, diemSangTao: 0, diemTacPhong: 0, nhanXet: '' };
              const currentTotal = Number((input.diemNoiDung + input.diemNgheThuat + input.diemSangTao + input.diemTacPhong).toFixed(2));
              const isGraded = currentTotal > 0;

              return (
                <div
                  key={tm.id}
                  className={`bg-white rounded-3xl border transition-all p-5 shadow-xs ${
                    isGraded ? 'border-rose-200' : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 font-black flex items-center justify-center text-sm shadow-xs">
                        #{tm.stt}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-black">
                            Lớp {tm.lop}
                          </span>
                          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                            {tm.theLoai}
                          </span>
                          {tm.thoiLuong && (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {tm.thoiLuong}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-black text-slate-900 mt-1">
                          {tm.tenTietMuc}
                        </h3>
                        {tm.nguoiTheHien && (
                          <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Mic className="w-3 h-3 text-slate-400" /> Biểu diễn: <span className="font-semibold text-slate-700">{tm.nguoiTheHien}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
                      <div className="text-right">
                        <div className="text-xs text-slate-400 font-semibold">Tổng điểm bài thi</div>
                        <div className="text-2xl font-black text-rose-600">
                          {currentTotal.toFixed(1)} <span className="text-xs text-slate-400">/ 100đ</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSaveScore(tm)}
                        className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all"
                      >
                        <Save className="w-4 h-4" />
                        Lưu điểm
                      </button>
                    </div>
                  </div>

                  {/* Score Inputs Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        1. Nội dung (max {cauhinh.thangDiem.maxNoiDung})
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={cauhinh.thangDiem.maxNoiDung}
                        step="0.5"
                        value={input.diemNoiDung || ''}
                        onChange={(e) => handleScoreChange(tm.id, 'diemNoiDung', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                        placeholder="0 - 25"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        2. Nghệ thuật (max {cauhinh.thangDiem.maxNgheThuat})
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={cauhinh.thangDiem.maxNgheThuat}
                        step="0.5"
                        value={input.diemNgheThuat || ''}
                        onChange={(e) => handleScoreChange(tm.id, 'diemNgheThuat', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                        placeholder="0 - 35"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        3. Sáng tạo (max {cauhinh.thangDiem.maxSangTao})
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={cauhinh.thangDiem.maxSangTao}
                        step="0.5"
                        value={input.diemSangTao || ''}
                        onChange={(e) => handleScoreChange(tm.id, 'diemSangTao', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                        placeholder="0 - 20"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        4. Tác phong (max {cauhinh.thangDiem.maxTacPhong})
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={cauhinh.thangDiem.maxTacPhong}
                        step="0.5"
                        value={input.diemTacPhong || ''}
                        onChange={(e) => handleScoreChange(tm.id, 'diemTacPhong', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                        placeholder="0 - 20"
                      />
                    </div>
                  </div>

                  {/* Comment */}
                  <div className="mt-3">
                    <input
                      type="text"
                      value={input.nhanXet || ''}
                      onChange={(e) => handleScoreChange(tm.id, 'nhanXet', e.target.value)}
                      placeholder="Ghi chú, nhận xét của giám khảo (ví dụ: Trang phục rất đẹp, giọng hát trong sáng...)"
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: BẢNG TỔNG HỢP & XẾP GIẢI */}
      {activeTab === 'bang-tong-hop' && (
        <div className="space-y-6">
          {/* Top 3 Podium Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {bangTongHop.slice(0, 3).map((item, idx) => {
              const medals = ['🥇 GIẢI NHẤT', '🥈 GIẢI NHÌ', '🥉 GIẢI BA'];
              const cardColors = [
                'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-300',
                'bg-gradient-to-br from-slate-50 to-slate-100 border-slate-300',
                'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-300'
              ];
              return (
                <div
                  key={item.tietMuc.id}
                  className={`p-5 rounded-3xl border shadow-xs relative overflow-hidden ${cardColors[idx]}`}
                >
                  <div className="text-xs font-black tracking-wider text-slate-700 uppercase mb-2">
                    {medals[idx]}
                  </div>
                  <div className="text-lg font-black text-slate-900 mb-1">
                    {item.tietMuc.tenTietMuc}
                  </div>
                  <div className="text-xs font-bold text-slate-600 mb-3">
                    Lớp: {item.tietMuc.lop} • Thể loại: {item.tietMuc.theLoai}
                  </div>
                  <div className="flex items-baseline justify-between pt-3 border-t border-slate-200/60">
                    <span className="text-xs text-slate-500 font-semibold">Điểm trung bình:</span>
                    <span className="text-2xl font-black text-rose-600">
                      {item.diemTrungBinh.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Full Leaderboard Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Bảng Điểm Toàn Diện - Cấp {capHocFilter === 'tieuhoc' ? 'Tiểu Học' : 'THCS'}
                </h3>
                <p className="text-xs text-slate-500">
                  Tính điểm trung bình từ {cauhinh.danhSachGiamKhao.length} giám khảo
                </p>
              </div>
              <button
                onClick={handleExportCSV}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Xuất file Excel
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-black text-slate-600 uppercase">
                    <th className="py-3 px-4">Hạng</th>
                    <th className="py-3 px-4">Lớp</th>
                    <th className="py-3 px-4">Tên tiết mục</th>
                    <th className="py-3 px-4">Thể loại</th>
                    {cauhinh.danhSachGiamKhao.map(gk => (
                      <th key={gk.id} className="py-3 px-3 text-center">{gk.ten}</th>
                    ))}
                    <th className="py-3 px-4 text-center">Điểm TB</th>
                    <th className="py-3 px-4 text-center">Danh hiệu / Giải thưởng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bangTongHop.map((item, idx) => {
                    return (
                      <tr key={item.tietMuc.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-black text-slate-700">
                          #{item.xepHang}
                        </td>
                        <td className="py-3 px-4 font-black text-indigo-700">
                          {item.tietMuc.lop}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{item.tietMuc.tenTietMuc}</div>
                          {item.tietMuc.nguoiTheHien && (
                            <div className="text-xs text-slate-400">{item.tietMuc.nguoiTheHien}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {item.tietMuc.theLoai}
                        </td>
                        {cauhinh.danhSachGiamKhao.map(gk => {
                          const d = item.diemCacGiamKhao.find(score => score.giamKhaoId === gk.id);
                          return (
                            <td key={gk.id} className="py-3 px-3 text-center font-bold text-slate-800">
                              {d ? d.tongDiem.toFixed(1) : '-'}
                            </td>
                          );
                        })}
                        <td className="py-3 px-4 text-center font-black text-base text-rose-600">
                          {item.diemTrungBinh.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs border ${getBadgeClass(item.danhHieuGiai)}`}>
                            {item.danhHieuGiai || 'Tham gia'}
                          </span>
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

      {/* TAB 3: QUẢN LÝ TIẾT MỤC */}
      {activeTab === 'quan-ly-tiet-muc' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-black text-slate-900">
              Danh Sách Tiết Mục Đăng Ký - Cấp {capHocFilter === 'tieuhoc' ? 'Tiểu Học' : 'THCS'}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowImportModal(true)}
                className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Upload Danh Sách Theo Mẫu
              </button>
              <button
                onClick={() => {
                  setEditingTietMuc(null);
                  setFormTietMuc({
                    capHoc: capHocFilter,
                    lop: '',
                    tenTietMuc: '',
                    theLoai: 'Múa',
                    thoiLuong: '4:00',
                    nguoiTheHien: '',
                    ghiChu: ''
                  });
                  setShowAddModal(true);
                }}
                className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Thêm Tiết Mục Mới
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tietMucList.map(tm => (
              <div
                key={tm.id}
                className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-black">
                      Lớp {tm.lop}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">
                      STT #{tm.stt}
                    </span>
                  </div>
                  <h4 className="text-base font-black text-slate-900 mb-1">
                    {tm.tenTietMuc}
                  </h4>
                  <div className="text-xs text-slate-600 space-y-0.5">
                    <div>Thể loại: <span className="font-semibold text-slate-800">{tm.theLoai}</span></div>
                    {tm.nguoiTheHien && (
                      <div>Biểu diễn: <span className="font-semibold text-slate-800">{tm.nguoiTheHien}</span></div>
                    )}
                    {tm.thoiLuong && (
                      <div>Thời lượng: <span className="font-semibold text-slate-800">{tm.thoiLuong}</span></div>
                    )}
                    {tm.ghiChu && (
                      <div className="text-slate-400 italic">Ghi chú: {tm.ghiChu}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setEditingTietMuc(tm);
                      setFormTietMuc(tm);
                      setShowAddModal(true);
                    }}
                    className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
                    title="Chỉnh sửa"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTietMuc(tm.id, tm.tenTietMuc)}
                    className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Xóa tiết mục"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: BIÊN BẢN IN A4 CHUẨN */}
      {activeTab === 'in-bien-ban' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-200">
            <div>
              <h3 className="text-sm font-black text-slate-900">Biên Bản Tổng Kết Chấm Thi</h3>
              <p className="text-xs text-slate-500">Mẫu in chuẩn A4, phù hợp lưu trữ hồ sơ và công bố trao thưởng</p>
            </div>
            <button
              onClick={() => window.print()}
              className="px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs"
            >
              <Printer className="w-4 h-4" />
              In Biên Bản Ngay (Ctrl + P)
            </button>
          </div>

          {/* Formatted Printable A4 Paper */}
          <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-300 shadow-sm text-slate-900 space-y-6 print:m-0 print:p-0 print:border-none print:shadow-none">
            <div className="flex justify-between items-start text-center border-b pb-4">
              <div className="text-xs font-semibold uppercase">
                <div>PHÒNG GIÁO DỤC VÀ ĐÀO TẠO</div>
                <div className="font-black">TRƯỜNG TIỂU HỌC VÀ THCS NGUYỄN VĂN TRỖI</div>
              </div>
              <div className="text-xs font-semibold">
                <div className="font-black uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div className="italic">Độc lập - Tự do - Hạnh phúc</div>
              </div>
            </div>

            <div className="text-center space-y-1">
              <h2 className="text-xl font-black uppercase text-rose-800">
                BIÊN BẢN TỔNG HỢP KẾT QUẢ CHẤM THI VĂN NGHỆ
              </h2>
              <div className="text-sm font-bold text-slate-700 uppercase">
                {cauhinh.tenHoiThi} - NĂM HỌC {cauhinh.namHoc}
              </div>
              <div className="text-xs text-slate-500 italic">
                Cấp học: {capHocFilter === 'tieuhoc' ? 'TIỂU HỌC' : 'TRUNG HỌC CƠ SỞ'}
              </div>
            </div>

            <table className="w-full text-xs border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-slate-800 text-center font-bold">
                  <th className="border border-slate-300 p-2 w-10">STT</th>
                  <th className="border border-slate-300 p-2 w-16">Lớp</th>
                  <th className="border border-slate-300 p-2">Tên tiết mục</th>
                  <th className="border border-slate-300 p-2 w-24">Thể loại</th>
                  {cauhinh.danhSachGiamKhao.map((gk, i) => (
                    <th key={gk.id} className="border border-slate-300 p-2 w-16">GK {i + 1}</th>
                  ))}
                  <th className="border border-slate-300 p-2 w-16">Điểm TB</th>
                  <th className="border border-slate-300 p-2 w-14">Hạng</th>
                  <th className="border border-slate-300 p-2 w-28">Giải thưởng</th>
                </tr>
              </thead>
              <tbody>
                {bangTongHop.map((item, idx) => (
                  <tr key={item.tietMuc.id} className="text-center">
                    <td className="border border-slate-300 p-1.5">{idx + 1}</td>
                    <td className="border border-slate-300 p-1.5 font-bold">{item.tietMuc.lop}</td>
                    <td className="border border-slate-300 p-1.5 text-left font-semibold">{item.tietMuc.tenTietMuc}</td>
                    <td className="border border-slate-300 p-1.5">{item.tietMuc.theLoai}</td>
                    {cauhinh.danhSachGiamKhao.map(gk => {
                      const d = item.diemCacGiamKhao.find(score => score.giamKhaoId === gk.id);
                      return (
                        <td key={gk.id} className="border border-slate-300 p-1.5 font-medium">
                          {d ? d.tongDiem.toFixed(1) : '-'}
                        </td>
                      );
                    })}
                    <td className="border border-slate-300 p-1.5 font-black text-rose-700">
                      {item.diemTrungBinh.toFixed(2)}
                    </td>
                    <td className="border border-slate-300 p-1.5 font-bold">{item.xepHang}</td>
                    <td className="border border-slate-300 p-1.5 font-bold text-slate-800">
                      {item.danhHieuGiai || ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Signature Block */}
            <div className="pt-8 grid grid-cols-2 text-center text-xs">
              <div className="space-y-16">
                <div className="font-bold uppercase">THƯ KÝ HỘI ĐỒNG</div>
                <div className="font-semibold">{cauhinh.thuKy}</div>
              </div>
              <div className="space-y-16">
                <div className="font-bold uppercase">TRƯỞNG BAN GIÁM KHẢO</div>
                <div className="font-semibold">{cauhinh.truongBan}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: QUÉT & KIỂM TRA PHIẾU CHẤM (ẢNH / SCAN / EXCEL) */}
      {activeTab === 'kiem-tra-phieu' && <VanNgheSheetAuditPanel />}

      {/* Modal: Thêm / Sửa Tiết Mục */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900">
              {editingTietMuc ? 'Chỉnh Sửa Tiết Mục' : 'Thêm Tiết Mục Dự Thi'}
            </h3>
            <form onSubmit={handleSaveTietMuc} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cấp học</label>
                  <select
                    value={formTietMuc.capHoc}
                    onChange={(e) => setFormTietMuc({ ...formTietMuc, capHoc: e.target.value as CapHocVanNghe })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
                  >
                    <option value="tieuhoc">Tiểu học</option>
                    <option value="thcs">THCS</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lớp biểu diễn</label>
                  <input
                    type="text"
                    required
                    value={formTietMuc.lop}
                    onChange={(e) => setFormTietMuc({ ...formTietMuc, lop: e.target.value })}
                    placeholder="Ví dụ: 1A, 2B, 6A1"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên tiết mục</label>
                <input
                  type="text"
                  required
                  value={formTietMuc.tenTietMuc}
                  onChange={(e) => setFormTietMuc({ ...formTietMuc, tenTietMuc: e.target.value })}
                  placeholder="Ví dụ: Thầy cô cho em mùa xuân"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Thể loại</label>
                  <select
                    value={formTietMuc.theLoai}
                    onChange={(e) => setFormTietMuc({ ...formTietMuc, theLoai: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
                  >
                    <option value="Đơn ca">Đơn ca</option>
                    <option value="Song ca">Song ca</option>
                    <option value="Tốp ca">Tốp ca</option>
                    <option value="Múa độc lập">Múa độc lập</option>
                    <option value="Hát múa phụ họa">Hát múa phụ họa</option>
                    <option value="Nhảy hiện đại">Nhảy hiện đại</option>
                    <option value="Kịch - Hoạt cảnh">Kịch - Hoạt cảnh</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Thời lượng (phút:giây)</label>
                  <input
                    type="text"
                    value={formTietMuc.thoiLuong}
                    onChange={(e) => setFormTietMuc({ ...formTietMuc, thoiLuong: e.target.value })}
                    placeholder="4:00"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Học sinh / Đội biểu diễn</label>
                <input
                  type="text"
                  value={formTietMuc.nguoiTheHien}
                  onChange={(e) => setFormTietMuc({ ...formTietMuc, nguoiTheHien: e.target.value })}
                  placeholder="Ví dụ: Minh Khang, Tuệ Mẫn & Tốp múa"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú đạo cụ / âm thanh</label>
                <input
                  type="text"
                  value={formTietMuc.ghiChu}
                  onChange={(e) => setFormTietMuc({ ...formTietMuc, ghiChu: e.target.value })}
                  placeholder="Ví dụ: Cần 2 mic không dây, hoa sen múa"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                >
                  {editingTietMuc ? 'Cập Nhật' : 'Thêm Tiết Mục'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cấu hình hội thi */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900">Cấu Hình Hội Thi Văn Nghệ</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên hội thi</label>
                <input
                  type="text"
                  value={cauhinh.tenHoiThi}
                  onChange={(e) => setCauhinh({ ...cauhinh, tenHoiThi: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Năm học</label>
                  <input
                    type="text"
                    value={cauhinh.namHoc}
                    onChange={(e) => setCauhinh({ ...cauhinh, namHoc: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Trưởng Ban Giám Khảo</label>
                  <input
                    type="text"
                    value={cauhinh.truongBan}
                    onChange={(e) => setCauhinh({ ...cauhinh, truongBan: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Thư ký Hội đồng</label>
                <input
                  type="text"
                  value={cauhinh.thuKy}
                  onChange={(e) => setCauhinh({ ...cauhinh, thuKy: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Hiển thị trên thanh điều hướng (Menu)</span>
                  <span className="text-[11px] text-slate-500">Có thể ẩn đi sau khi kết thúc hội thi (dữ liệu vẫn được giữ nguyên)</span>
                </div>
                <input
                  type="checkbox"
                  checked={cauhinh.isEnabled !== false}
                  onChange={(e) => setCauhinh({ ...cauhinh, isEnabled: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await updateCauHinhVanNghe(cauhinh);
                    setShowConfigModal(false);
                    setSaveSuccessMsg('Đã cập nhật cấu hình hội thi thành công!');
                  }}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                >
                  Lưu Cấu Hình
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Xác nhận xóa tiết mục */}
      {deletingTietMuc && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Xác nhận xóa tiết mục</h3>
                <p className="text-xs text-slate-500">Hành động này sẽ gỡ tiết mục khỏi danh sách chấm thi.</p>
              </div>
            </div>
            <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              Bạn có chắc chắn muốn xóa tiết mục <span className="font-bold text-slate-900">"{deletingTietMuc.name}"</span>?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTietMuc(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={confirmDeleteTietMuc}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
              >
                Xóa Tiết Mục
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nhập danh sách tiết mục từ Excel/CSV theo mẫu */}
      <VanNgheImportModal
        isOpen={showImportModal}
        defaultCapHoc={capHocFilter}
        onClose={() => setShowImportModal(false)}
        onSuccess={(addedCount) => {
          setSaveSuccessMsg(`Đã nhập thành công ${addedCount} tiết mục văn nghệ từ danh sách!`);
          setTimeout(() => setSaveSuccessMsg(null), 4000);
          loadData();
        }}
      />
    </div>
  );
};
