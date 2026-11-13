import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import {
  TietMucVanNghe,
  DiemGiamKhao,
  CauHinhVanNghe,
  CapHocVanNghe,
  KetQuaTietMucSummary,
  GiamKhaoInfo
} from '../types/vannghe';
import { sanitizeForFirestore } from './db';

const STORAGE_TIETMUC_KEY = 'edutest_vannghe_tietmuc_v1';
const STORAGE_DIEM_KEY = 'edutest_vannghe_diem_v1';
const STORAGE_CAUHINH_KEY = 'edutest_vannghe_cauhinh_v1';

export const DEFAULT_CAUHINH: CauHinhVanNghe = {
  id: 'cauhinh_chung',
  tenHoiThi: 'HỘI THI VĂN NGHỆ CHÀO MỪNG NGÀY NHÀ GIÁO VIỆT NAM 20/11',
  namHoc: '2026 - 2027',
  isEnabled: true,
  truongBan: 'Thầy Hiệu trưởng',
  thuKy: 'Cô Tổng phụ trách Đội',
  danhSachGiamKhao: [
    { id: 'gk_1', ten: 'Giám khảo 1 (Trưởng ban)', chucVu: 'Trưởng BGK', capHoc: 'all' },
    { id: 'gk_2', ten: 'Giám khảo 2 (Ủy viên)', chucVu: 'Ủy viên', capHoc: 'all' },
    { id: 'gk_3', ten: 'Giám khảo 3 (Ủy viên)', chucVu: 'Ủy viên', capHoc: 'all' }
  ],
  thangDiem: {
    maxNoiDung: 25,
    maxNgheThuat: 35,
    maxSangTao: 20,
    maxTacPhong: 20
  },
  coCauGiai: {
    giaiNhat: 1,
    giaiNhi: 2,
    giaiBa: 3,
    giaiKhuyenKhich: 4
  }
};

export const INITIAL_SAMPLE_TIETMUC: TietMucVanNghe[] = [
  // Cấp Tiểu học
  {
    id: 'tm_th_1',
    stt: 1,
    capHoc: 'tieuhoc',
    lop: '1A',
    tenTietMuc: 'Thầy cô cho em mùa xuân',
    theLoai: 'Múa độc lập',
    thoiLuong: '4:15',
    nguoiTheHien: 'Tốp múa lớp 1A',
    ghiChu: 'Trang phục hoa sen',
    status: 'active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tm_th_2',
    stt: 2,
    capHoc: 'tieuhoc',
    lop: '2B',
    tenTietMuc: 'Bông hồng tặng cô',
    theLoai: 'Đơn ca kết hợp múa phụ họa',
    thoiLuong: '3:50',
    nguoiTheHien: 'Bảo An & Tốp múa',
    ghiChu: '',
    status: 'active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tm_th_3',
    stt: 3,
    capHoc: 'tieuhoc',
    lop: '3C',
    tenTietMuc: 'Khi tóc thầy bạc trắng',
    theLoai: 'Song ca',
    thoiLuong: '4:00',
    nguoiTheHien: 'Minh Khang - Tuệ Mẫn',
    ghiChu: '',
    status: 'active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tm_th_4',
    stt: 4,
    capHoc: 'tieuhoc',
    lop: '4A',
    tenTietMuc: 'Hào khí Việt Nam',
    theLoai: 'Múa cờ & Trống',
    thoiLuong: '5:00',
    nguoiTheHien: 'Đội văn nghệ Khối 4',
    ghiChu: 'Đạo cụ cờ hội đồng',
    status: 'active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tm_th_5',
    stt: 5,
    capHoc: 'tieuhoc',
    lop: '5B',
    tenTietMuc: 'Người thầy năm xưa',
    theLoai: 'Tốp ca',
    thoiLuong: '4:20',
    nguoiTheHien: 'Tập thể lớp 5B',
    ghiChu: '',
    status: 'active',
    createdAt: new Date().toISOString()
  },
  // Cấp THCS
  {
    id: 'tm_thcs_1',
    stt: 1,
    capHoc: 'thcs',
    lop: '6A1',
    tenTietMuc: 'Lời thầy cô',
    theLoai: 'Tốp ca múa',
    thoiLuong: '4:30',
    nguoiTheHien: 'Chi đội 6A1',
    ghiChu: '',
    status: 'active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tm_thcs_2',
    stt: 2,
    capHoc: 'thcs',
    lop: '7B',
    tenTietMuc: 'Máu đỏ da vàng - Hát vang tiếng cười',
    theLoai: 'Nhảy hiện đại & flashmob',
    thoiLuong: '4:10',
    nguoiTheHien: 'Nhóm nhảy 7B',
    ghiChu: 'Âm thanh beat remix',
    status: 'active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tm_thcs_3',
    stt: 3,
    capHoc: 'thcs',
    lop: '8A2',
    tenTietMuc: 'Bụi phấn & Người thầy',
    theLoai: 'Hòa tấu Acapella',
    thoiLuong: '4:45',
    nguoiTheHien: 'Ban văn nghệ 8A2',
    ghiChu: '',
    status: 'active',
    createdAt: new Date().toISOString()
  },
  {
    id: 'tm_thcs_4',
    stt: 4,
    capHoc: 'thcs',
    lop: '9A',
    tenTietMuc: 'Việt Nam trong tôi là',
    theLoai: 'Hoạt cảnh kịch hát múa',
    thoiLuong: '6:00',
    nguoiTheHien: 'Tập thể học sinh 9A',
    ghiChu: 'Đạo cụ mô hình cánh buồm',
    status: 'active',
    createdAt: new Date().toISOString()
  }
];

// Helper Local Storage
function getLocalTietMuc(): TietMucVanNghe[] {
  try {
    const raw = localStorage.getItem(STORAGE_TIETMUC_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalTietMuc(items: TietMucVanNghe[]) {
  try {
    localStorage.setItem(STORAGE_TIETMUC_KEY, JSON.stringify(items));
  } catch {}
}

function getLocalDiem(): DiemGiamKhao[] {
  try {
    const raw = localStorage.getItem(STORAGE_DIEM_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalDiem(items: DiemGiamKhao[]) {
  try {
    localStorage.setItem(STORAGE_DIEM_KEY, JSON.stringify(items));
  } catch {}
}

function getLocalCauHinh(): CauHinhVanNghe {
  try {
    const raw = localStorage.getItem(STORAGE_CAUHINH_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_CAUHINH;
  } catch {
    return DEFAULT_CAUHINH;
  }
}

function saveLocalCauHinh(config: CauHinhVanNghe) {
  try {
    localStorage.setItem(STORAGE_CAUHINH_KEY, JSON.stringify(config));
  } catch {}
}

// ------------------- API & FIRESTORE CALLS -------------------

/**
 * Lấy cấu hình hội thi văn nghệ
 */
export async function getCauHinhVanNghe(): Promise<CauHinhVanNghe> {
  try {
    const snap = await getDoc(doc(db, 'vannghe_cauhinh', 'cauhinh_chung'));
    if (snap.exists()) {
      const data = snap.data() as CauHinhVanNghe;
      saveLocalCauHinh(data);
      return data;
    }
  } catch (e) {
    console.warn('getCauHinhVanNghe note:', e);
  }
  return getLocalCauHinh();
}

export function isVanNgheModuleEnabled(): boolean {
  return getLocalCauHinh().isEnabled !== false;
}

/**
 * Cập nhật cấu hình hội thi
 */
export async function updateCauHinhVanNghe(config: Partial<CauHinhVanNghe>): Promise<void> {
  const current = getLocalCauHinh();
  const updated: CauHinhVanNghe = {
    ...current,
    ...config,
    id: 'cauhinh_chung'
  };
  saveLocalCauHinh(updated);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('edutest:vannghe_config_updated', { detail: updated }));
  }
  try {
    await setDoc(doc(db, 'vannghe_cauhinh', 'cauhinh_chung'), sanitizeForFirestore(updated), { merge: true });
  } catch (e) {
    console.warn('updateCauHinhVanNghe note:', e);
  }
}

/**
 * Lấy danh sách tiết mục (có lọc theo cấp học nếu cần)
 */
export async function getDanhSachTietMuc(capHoc?: CapHocVanNghe): Promise<TietMucVanNghe[]> {
  let list = getLocalTietMuc();

  try {
    const snap = await getDocs(collection(db, 'vannghe_tietmuc'));
    if (!snap.empty) {
      list = snap.docs.map(d => ({ ...d.data(), id: d.id } as TietMucVanNghe));
      saveLocalTietMuc(list);
    } else if (list.length === 0) {
      // Seed default sample data if totally empty
      list = [...INITIAL_SAMPLE_TIETMUC];
      saveLocalTietMuc(list);
      for (const item of list) {
        setDoc(doc(db, 'vannghe_tietmuc', item.id), sanitizeForFirestore(item)).catch(() => {});
      }
    }
  } catch (e) {
    console.warn('getDanhSachTietMuc note:', e);
    if (list.length === 0) {
      list = [...INITIAL_SAMPLE_TIETMUC];
      saveLocalTietMuc(list);
    }
  }

  const active = list.filter(item => item.status !== 'deleted');
  if (capHoc) {
    return active.filter(item => item.capHoc === capHoc).sort((a, b) => a.stt - b.stt);
  }
  return active.sort((a, b) => a.stt - b.stt);
}

/**
 * Thêm tiết mục mới
 */
export async function addTietMuc(itemData: Omit<TietMucVanNghe, 'id' | 'createdAt'>): Promise<string> {
  const id = `tm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newItem: TietMucVanNghe = {
    ...itemData,
    id,
    createdAt: new Date().toISOString()
  };

  const list = getLocalTietMuc();
  list.push(newItem);
  saveLocalTietMuc(list);

  try {
    await setDoc(doc(db, 'vannghe_tietmuc', id), sanitizeForFirestore(newItem));
  } catch (e) {
    console.warn('addTietMuc note:', e);
  }
  return id;
}

/**
 * Cập nhật tiết mục
 */
export async function updateTietMuc(id: string, updates: Partial<TietMucVanNghe>): Promise<void> {
  const list = getLocalTietMuc();
  const idx = list.findIndex(t => t.id === id);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...updates };
    saveLocalTietMuc(list);
  }

  try {
    await updateDoc(doc(db, 'vannghe_tietmuc', id), sanitizeForFirestore(updates));
  } catch (e) {
    console.warn('updateTietMuc note:', e);
  }
}

/**
 * Xóa tiết mục (đánh dấu status = deleted)
 */
export async function deleteTietMuc(id: string): Promise<void> {
  const list = getLocalTietMuc();
  const filtered = list.filter(t => t.id !== id);
  saveLocalTietMuc(filtered);

  try {
    await deleteDoc(doc(db, 'vannghe_tietmuc', id));
  } catch (e) {
    console.warn('deleteTietMuc note:', e);
  }
}

export interface ImportTietMucInput {
  stt?: number;
  capHoc?: CapHocVanNghe;
  lop: string;
  tenTietMuc: string;
  theLoai: string;
  thoiLuong?: string;
  nguoiTheHien?: string;
  ghiChu?: string;
}

/**
 * Nhập hàng loạt danh sách tiết mục từ Excel/CSV (hỗ trợ thêm tiếp hoặc thay thế theo cấp học)
 */
export async function batchImportTietMuc(
  items: ImportTietMucInput[],
  options: { mode: 'append' | 'replace'; defaultCapHoc: CapHocVanNghe }
): Promise<{ addedCount: number }> {
  const existingList = await getDanhSachTietMuc();
  const baseTime = Date.now();
  const affectedCapHocs = new Set<CapHocVanNghe>(
    items.map((item) => item.capHoc || options.defaultCapHoc)
  );
  if (affectedCapHocs.size === 0) {
    affectedCapHocs.add(options.defaultCapHoc);
  }

  let keptList = existingList.filter((t) => t.status !== 'deleted');
  const idsToDelete: string[] = [];

  if (options.mode === 'replace') {
    idsToDelete.push(
      ...keptList.filter((t) => affectedCapHocs.has(t.capHoc)).map((t) => t.id)
    );
    keptList = keptList.filter((t) => !affectedCapHocs.has(t.capHoc));
  }

  const maxSttByCap: Record<CapHocVanNghe, number> = {
    tieuhoc: 0,
    thcs: 0
  };
  keptList.forEach((t) => {
    if (t.stt > maxSttByCap[t.capHoc]) {
      maxSttByCap[t.capHoc] = t.stt;
    }
  });

  const newRecords: TietMucVanNghe[] = items
    .filter((item) => item.lop.trim() && item.tenTietMuc.trim())
    .map((item, idx) => {
      const cap = item.capHoc || options.defaultCapHoc;
      maxSttByCap[cap] += 1;
      const stt =
        options.mode === 'replace' && item.stt && item.stt > 0
          ? item.stt
          : maxSttByCap[cap];
      return {
        id: `tm_${baseTime}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        stt,
        capHoc: cap,
        lop: item.lop.trim().slice(0, 40),
        tenTietMuc: item.tenTietMuc.trim().slice(0, 200),
        theLoai: (item.theLoai || 'Văn nghệ').trim().slice(0, 100),
        thoiLuong: (item.thoiLuong || '4:00').trim().slice(0, 20),
        nguoiTheHien: (item.nguoiTheHien || '').trim().slice(0, 150),
        ghiChu: (item.ghiChu || '').trim().slice(0, 250),
        status: 'active',
        createdAt: new Date().toISOString()
      };
    });

  const updatedList = [...keptList, ...newRecords];
  saveLocalTietMuc(updatedList);

  try {
    const ops: Array<{ type: 'delete' | 'set'; id: string; data?: TietMucVanNghe }> = [
      ...idsToDelete.map((id) => ({ type: 'delete' as const, id })),
      ...newRecords.map((rec) => ({ type: 'set' as const, id: rec.id, data: rec }))
    ];

    const CHUNK_SIZE = 400;
    for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      const chunk = ops.slice(i, i + CHUNK_SIZE);
      chunk.forEach((op) => {
        const ref = doc(db, 'vannghe_tietmuc', op.id);
        if (op.type === 'delete') {
          batch.delete(ref);
        } else if (op.data) {
          batch.set(ref, sanitizeForFirestore(op.data));
        }
      });
      await batch.commit();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient')) {
      handleFirestoreError(e, OperationType.WRITE, 'vannghe_tietmuc');
    }
    console.warn('batchImportTietMuc note:', e);
  }

  return { addedCount: newRecords.length };
}

/**
 * Lấy tất cả bảng điểm giám khảo
 */
export async function getDanhSachDiem(): Promise<DiemGiamKhao[]> {
  let list = getLocalDiem();
  try {
    const snap = await getDocs(collection(db, 'vannghe_diem'));
    if (!snap.empty) {
      list = snap.docs.map(d => ({ ...d.data(), id: d.id } as DiemGiamKhao));
      saveLocalDiem(list);
    }
  } catch (e) {
    console.warn('getDanhSachDiem note:', e);
  }
  return list;
}

/**
 * Lưu hoặc cập nhật điểm của một giám khảo cho một tiết mục
 */
export async function saveDiemGiamKhao(diemData: Omit<DiemGiamKhao, 'id' | 'tongDiem' | 'updatedAt'>): Promise<void> {
  const tongDiem = Number(
    (
      Number(diemData.diemNoiDung || 0) +
      Number(diemData.diemNgheThuat || 0) +
      Number(diemData.diemSangTao || 0) +
      Number(diemData.diemTacPhong || 0)
    ).toFixed(2)
  );

  const id = `${diemData.tietMucId}_${diemData.giamKhaoId}`;
  const record: DiemGiamKhao = {
    ...diemData,
    id,
    tongDiem,
    updatedAt: new Date().toISOString()
  };

  const currentList = getLocalDiem();
  const filtered = currentList.filter(d => d.id !== id);
  filtered.push(record);
  saveLocalDiem(filtered);

  try {
    await setDoc(doc(db, 'vannghe_diem', id), sanitizeForFirestore(record), { merge: true });
  } catch (e) {
    console.warn('saveDiemGiamKhao note:', e);
  }
}

/**
 * Tính tổng hợp điểm, điểm trung bình và xếp hạng cho từng tiết mục
 */
export async function calculateBangTongHop(capHoc?: CapHocVanNghe): Promise<KetQuaTietMucSummary[]> {
  const [tietMucList, diemList, cauHinh] = await Promise.all([
    getDanhSachTietMuc(capHoc),
    getDanhSachDiem(),
    getCauHinhVanNghe()
  ]);

  const summaries: KetQuaTietMucSummary[] = tietMucList.map(tm => {
    const diemCacGiamKhao = diemList.filter(d => d.tietMucId === tm.id);
    let diemTrungBinh = 0;
    if (diemCacGiamKhao.length > 0) {
      const sum = diemCacGiamKhao.reduce((acc, d) => acc + d.tongDiem, 0);
      diemTrungBinh = Number((sum / diemCacGiamKhao.length).toFixed(2));
    }
    return {
      tietMuc: tm,
      diemCacGiamKhao,
      diemTrungBinh
    };
  });

  // Sắp xếp giảm dần theo điểm trung bình
  summaries.sort((a, b) => b.diemTrungBinh - a.diemTrungBinh);

  // Gán thứ hạng & Cơ cấu giải
  const coCau = cauHinh.coCauGiai;
  summaries.forEach((s, idx) => {
    s.xepHang = idx + 1;
    if (s.diemTrungBinh > 0) {
      if (idx < coCau.giaiNhat) {
        s.danhHieuGiai = 'Giải Nhất';
      } else if (idx < coCau.giaiNhat + coCau.giaiNhi) {
        s.danhHieuGiai = 'Giải Nhì';
      } else if (idx < coCau.giaiNhat + coCau.giaiNhi + coCau.giaiBa) {
        s.danhHieuGiai = 'Giải Ba';
      } else if (idx < coCau.giaiNhat + coCau.giaiNhi + coCau.giaiBa + coCau.giaiKhuyenKhich) {
        s.danhHieuGiai = 'Giải Khuyến khích';
      } else {
        s.danhHieuGiai = 'Giải Phong trào';
      }
    } else {
      s.danhHieuGiai = 'Chưa chấm';
    }
  });

  return summaries;
}
