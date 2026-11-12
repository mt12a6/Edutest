export type CapHocVanNghe = 'tieuhoc' | 'thcs';

export interface TietMucVanNghe {
  id: string;
  stt: number;
  capHoc: CapHocVanNghe;
  lop: string;                // Ví dụ: 1A, 2B, 6A1, 9B
  tenTietMuc: string;         // Tên bài hát, múa, kịch
  theLoai: string;            // Đơn ca, Song ca, Tốp ca, Múa, Kịch, Nhảy hiện đại
  thoiLuong?: string;         // Phút:giây
  nguoiTheHien?: string;      // Tên học sinh biểu diễn chính
  ghiChu?: string;
  status: 'active' | 'completed' | 'deleted';
  createdAt: string;
}

export interface DiemGiamKhao {
  id: string;                 // `${tietMucId}_${giamKhaoId}`
  tietMucId: string;
  giamKhaoId: string;
  giamKhaoTen: string;
  capHoc: CapHocVanNghe;
  // 4 tiêu chí chuẩn
  diemNoiDung: number;        // Tối đa 25đ
  diemNgheThuat: number;      // Tối đa 35đ
  diemSangTao: number;        // Tối đa 20đ
  diemTacPhong: number;       // Tối đa 20đ
  tongDiem: number;           // Tổng = NoiDung + NgheThuat + SangTao + TacPhong (tối đa 100đ)
  nhanXet?: string;
  updatedAt: string;
}

export interface GiamKhaoInfo {
  id: string;
  ten: string;
  chucVu: string;             // Ví dụ: Trưởng ban, Ủy viên, v.v.
  capHoc: CapHocVanNghe | 'all';
}

export interface CauHinhVanNghe {
  id: string;
  tenHoiThi: string;          // Ví dụ: HỘI THI VĂN NGHỆ CHÀO MỪNG NGÀY NHÀ GIÁO VIỆT NAM 20/11
  namHoc: string;             // 2024 - 2025
  isEnabled: boolean;         // Bật/tắt hiển thị module trên thanh điều hướng
  thuKy: string;
  truongBan: string;
  danhSachGiamKhao: GiamKhaoInfo[];
  thangDiem: {
    maxNoiDung: number;       // 25
    maxNgheThuat: number;     // 35
    maxSangTao: number;       // 20
    maxTacPhong: number;      // 20
  };
  coCauGiai: {
    giaiNhat: number;         // Số lượng giải nhất
    giaiNhi: number;
    giaiBa: number;
    giaiKhuyenKhich: number;
  };
}

export interface KetQuaTietMucSummary {
  tietMuc: TietMucVanNghe;
  diemCacGiamKhao: DiemGiamKhao[];
  diemTrungBinh: number;
  xepHang?: number;
  danhHieuGiai?: string;      // Giải Nhất, Giải Nhì, Giải Ba, Khuyến Khích
}
