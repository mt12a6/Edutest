/**
 * Tiện ích xử lý Slug tiếng Việt & Dynamic Routing tự động cho EduTest
 */

/**
 * Chuyển đổi chuỗi tiếng Việt có dấu thành slug chuẩn SEO, sạch ký tự đặc biệt
 * Ví dụ: "Toán học" -> "toan-hoc"
 * "Vật lí 6 - Thi giữa kỳ I" -> "vat-li-6-thi-giua-ky-i"
 */
export function slugifyVietnamese(text: string): string {
  if (!text) return '';

  let slug = text.trim().toLowerCase();

  // Đổi ký tự có dấu thành không dấu
  slug = slug
    .replace(/á|à|ả|ạ|ã|ă|ắ|ằ|ẳ|ẵ|ặ|â|ấ|ầ|ẩ|ẫ|ậ/gi, 'a')
    .replace(/é|è|ẻ|ẽ|ẹ|ê|ế|ề|ể|ễ|ệ/gi, 'e')
    .replace(/i|í|ì|ỉ|ĩ|ị/gi, 'i')
    .replace(/ó|ò|ỏ|õ|ọ|ô|ố|ồ|ổ|ỗ|ộ|ơ|ớ|ờ|ở|ỡ|ợ/gi, 'o')
    .replace(/ú|ù|ủ|ũ|ụ|ư|ứ|ừ|ử|ữ|ự/gi, 'u')
    .replace(/ý|ỳ|ỷ|ỹ|ỵ/gi, 'y')
    .replace(/đ/gi, 'd');

  // Thay thế ký tự đặc biệt và khoảng trắng bằng gạch ngang '-'
  slug = slug
    .replace(/[^a-z0-9\s-]/g, '') // Xóa toàn bộ ký tự lạ
    .replace(/\s+/g, '-')         // Đổi khoảng trắng thành '-'
    .replace(/-+/g, '-')          // Gộp các dấu '-' liên tiếp
    .replace(/^-+|-+$/g, '');     // Cắt bỏ dấu '-' ở đầu và cuối

  return slug || 'muc-khong-ten';
}

/**
 * Đảm bảo tính duy nhất của slug trong danh sách
 */
export function ensureUniqueSlug(
  baseSlug: string,
  existingSlugs: string[],
  currentSlugToKeep?: string
): string {
  let slug = baseSlug;
  // Nếu slug hiện tại giống slug cần giữ (chưa đổi gì), cho phép giữ nguyên
  if (currentSlugToKeep && slug === currentSlugToKeep) {
    return slug;
  }

  const set = new Set(existingSlugs.filter(s => s !== currentSlugToKeep));
  if (!set.has(slug)) {
    return slug;
  }

  let counter = 2;
  while (set.has(`${slug}-${counter}`)) {
    counter++;
  }
  return `${slug}-${counter}`;
}

/**
 * Sinh URL đầy đủ tự động theo domain hiện tại (Vercel, AI Studio dev, custom domain)
 * Không bao giờ hardcode domain.
 */
export function getDynamicRouteUrl(type: 'thu-muc' | 'bai-thi', slug: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const cleanSlug = slug.replace(/^\/+/, '');
  return `${origin}/${type}/${cleanSlug}`;
}

/**
 * Lấy đường dẫn tương đối (pathname)
 */
export function getRelativeRoutePath(type: 'thu-muc' | 'bai-thi', slug: string): string {
  const cleanSlug = slug.replace(/^\/+/, '');
  return `/${type}/${cleanSlug}`;
}

/**
 * Sao chép liên kết vào Clipboard và kích hoạt thông báo
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback cho trình duyệt cũ hoặc iFrame
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.warn('Sao chép liên kết thất bại:', err);
    return false;
  }
}
