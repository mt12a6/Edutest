import React, { useState } from 'react';
import { 
  X, 
  Calculator, 
  Sigma, 
  Shapes, 
  BookOpen, 
  Sparkles, 
  Layers, 
  Upload, 
  Image as ImageIcon, 
  Check, 
  Eye, 
  Code,
  Copy,
  Plus
} from 'lucide-react';
import { MathRenderer } from './MathRenderer';

interface MathFormulaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (snippet: string) => void;
  title?: string;
}

interface FormulaItem {
  label: string;
  latex: string;
  desc: string;
}

export const MathFormulaModal: React.FC<MathFormulaModalProps> = ({
  isOpen,
  onClose,
  onInsert,
  title = 'Trình soạn thảo Toán học & Hình vẽ chuyên nghiệp'
}) => {
  const [activeTab, setActiveTab] = useState<'formulas' | 'geometry' | 'custom_latex' | 'upload_image'>('formulas');
  const [activeCategory, setActiveCategory] = useState<'fractions_roots' | 'powers_indices' | 'calculus' | 'systems_matrices' | 'geometry_vectors' | 'logic_sets'>('fractions_roots');
  const [customLatex, setCustomLatex] = useState<string>('\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}');
  const [copiedLatex, setCopiedLatex] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Categories for math formulas
  const mathCategories = [
    { id: 'fractions_roots', name: 'Phân số & Căn thức', icon: '½' },
    { id: 'powers_indices', name: 'Lũy thừa & Chỉ số', icon: 'xⁿ' },
    { id: 'calculus', name: 'Giải tích & Tích phân', icon: '∫' },
    { id: 'systems_matrices', name: 'Hệ phương trình & Ma trận', icon: '{ }' },
    { id: 'geometry_vectors', name: 'Hình học & Vector', icon: 'vec' },
    { id: 'logic_sets', name: 'Tập hợp, Logic & Xác suất', icon: '∈' },
  ];

  const formulaData: Record<string, FormulaItem[]> = {
    fractions_roots: [
      { label: 'Phân số đơn', latex: '$\\frac{a}{b}$', desc: 'Phân số cơ bản a trên b' },
      { label: 'Phân số phức hợp', latex: '$\\frac{x^2 + 1}{2x - 3}$', desc: 'Phân thức đại số bậc 2' },
      { label: 'Đạo hàm phân số', latex: '$\\frac{dy}{dx}$', desc: 'Đạo hàm vi phân' },
      { label: 'Đạo hàm riêng', latex: '$\\frac{\\partial f}{\\partial x}$', desc: 'Đạo hàm riêng phần' },
      { label: 'Căn bậc hai', latex: '$\\sqrt{x}$', desc: 'Căn thức bậc 2 của x' },
      { label: 'Căn bậc n', latex: '$\\sqrt[n]{x}$', desc: 'Căn thức bậc n' },
      { label: 'Căn lồng nhau', latex: '$\\sqrt{x + \\sqrt{y}}$', desc: 'Căn thức chứa căn' },
      { label: 'Căn phân thức', latex: '$\\sqrt{\\frac{a}{b}}$', desc: 'Căn của một phân số' },
    ],
    powers_indices: [
      { label: 'Bình phương', latex: '$x^2$', desc: 'x mũ 2' },
      { label: 'Lập phương', latex: '$x^3$', desc: 'x mũ 3' },
      { label: 'Lũy thừa n', latex: '$x^n$', desc: 'x mũ n' },
      { label: 'Lũy thừa biểu thức', latex: '$(a + b)^n$', desc: 'Nhị thức mũ n' },
      { label: 'Mũ âm', latex: '$x^{-1}$', desc: 'Nghịch đảo x' },
      { label: 'Chỉ số dưới 1', latex: '$x_1$', desc: 'Chỉ số dưới 1' },
      { label: 'Chỉ số dưới 2', latex: '$x_2$', desc: 'Chỉ số dưới 2' },
      { label: 'Chỉ số n', latex: '$x_n$', desc: 'Dãy số x_n' },
      { label: 'Cả mũ và chỉ số', latex: '$x_i^2$', desc: 'Chỉ số i bình phương' },
      { label: 'Cơ số logarit', latex: '$\\log_a(b)$', desc: 'Logarit cơ số a của b' },
      { label: 'Logarit tự nhiên', latex: '$\\ln(x)$', desc: 'Logarit tự nhiên Neper' },
    ],
    calculus: [
      { label: 'Giới hạn lim', latex: '$\\lim_{x \\to x_0} f(x)$', desc: 'Giới hạn khi x tiến tới x0' },
      { label: 'Giới hạn vô cực', latex: '$\\lim_{x \\to +\\infty} \\frac{1}{x} = 0$', desc: 'Giới hạn ở vô cực' },
      { label: 'Đạo hàm bậc nhất', latex: '$f\'(x)$', desc: 'f phẩy x' },
      { label: 'Đạo hàm bậc 2', latex: '$f\'\'(x)$', desc: 'f hai phẩy x' },
      { label: 'Nguyên hàm', latex: '$\\int f(x)\\,dx$', desc: 'Tích phân bất định' },
      { label: 'Tích phân xác định', latex: '$\\int_{a}^{b} f(x)\\,dx$', desc: 'Tích phân từ a đến b' },
      { label: 'Tổng sigma', latex: '$\\sum_{i=1}^{n} x_i$', desc: 'Tổng từ 1 đến n' },
      { label: 'Tích chuỗi', latex: '$\\prod_{i=1}^{n} a_i$', desc: 'Tích từ 1 đến n' },
      { label: 'Sin, Cos, Tan', latex: '$\\sin^2(x) + \\cos^2(x) = 1$', desc: 'Hằng đẳng thức lượng giác' },
      { label: 'Công thức nghiệm', latex: '$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$', desc: 'Nghiệm phương trình bậc hai' },
    ],
    systems_matrices: [
      { 
        label: 'Hệ 2 phương trình', 
        latex: '$\\begin{cases} ax + by = c \\\\ dx + ey = f \\end{cases}$', 
        desc: 'Hệ 2 phương trình bậc nhất 2 ẩn' 
      },
      { 
        label: 'Hệ 3 phương trình', 
        latex: '$\\begin{cases} a_1x + b_1y + c_1z = d_1 \\\\ a_2x + b_2y + c_2z = d_2 \\\\ a_3x + b_3y + c_3z = d_3 \\end{cases}$', 
        desc: 'Hệ 3 phương trình 3 ẩn' 
      },
      { 
        label: 'Ma trận vuông 2x2', 
        latex: '$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$', 
        desc: 'Ma trận cấp 2x2' 
      },
      { 
        label: 'Ma trận vuông 3x3', 
        latex: '$\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & k \\end{pmatrix}$', 
        desc: 'Ma trận cấp 3x3' 
      },
      { 
        label: 'Định thức Det', 
        latex: '$\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix} = ad - bc$', 
        desc: 'Định thức cấp 2' 
      },
      { 
        label: 'Hệ ngoặc vuông [', 
        latex: '$\\left[\\begin{matrix} x = a \\\\ x = b \\end{matrix}\\right.$', 
        desc: 'Tập nghiệm tuyển ngoặc vuông' 
      },
    ],
    geometry_vectors: [
      { label: 'Vector AB', latex: '$\\vec{AB}$', desc: 'Véc-tơ nối A và B' },
      { label: 'Vector u', latex: '$\\vec{u}$', desc: 'Véc-tơ u' },
      { label: 'Vector 0', latex: '$\\vec{0}$', desc: 'Véc-tơ không' },
      { label: 'Độ dài vector', latex: '$\\|\\vec{u}\\|$', desc: 'Độ dài mô-đun véc-tơ' },
      { label: 'Tích vô hướng', latex: '$\\vec{u} \\cdot \\vec{v} = |\\vec{u}| |\\vec{v}| \\cos(\\vec{u}, \\vec{v})$', desc: 'Tích vô hướng hai vector' },
      { label: 'Tam giác ABC', latex: '$\\Delta ABC$', desc: 'Ký hiệu tam giác ABC' },
      { label: 'Góc A mũ', latex: '$\\widehat{A}$', desc: 'Góc đỉnh A' },
      { label: 'Góc ABC mũ', latex: '$\\widehat{ABC}$', desc: 'Góc ABC' },
      { label: 'Góc độ 90°', latex: '$90^\\circ$', desc: 'Góc 90 độ' },
      { label: 'Vuông góc ⊥', latex: '$\\perp$', desc: 'Quan hệ vuông góc' },
      { label: 'Song song ∥', latex: '$\\parallel$', desc: 'Quan hệ song song' },
      { label: 'Đồng dạng ∼', latex: '$\\sim$', desc: 'Quan hệ tam giác đồng dạng' },
      { label: 'Bằng nhau ≅', latex: '$\\cong$', desc: 'Tam giác bằng nhau' },
    ],
    logic_sets: [
      { label: 'Thuộc ∈', latex: '$\\in$', desc: 'Phần tử thuộc tập hợp' },
      { label: 'Không thuộc ∉', latex: '$\\notin$', desc: 'Không thuộc tập hợp' },
      { label: 'Tập con ⊂', latex: '$\\subset$', desc: 'Tập con' },
      { label: 'Phép hợp ∪', latex: '$\\cup$', desc: 'Hợp của hai tập hợp' },
      { label: 'Phép giao ∩', latex: '$\\cap$', desc: 'Giao của hai tập hợp' },
      { label: 'Tập rỗng ∅', latex: '$\\emptyset$', desc: 'Tập hợp rỗng' },
      { label: 'Tập số thực R', latex: '$\\mathbb{R}$', desc: 'Tập số thực R' },
      { label: 'Tập số tự nhiên N', latex: '$\\mathbb{N}$', desc: 'Tập số tự nhiên N' },
      { label: 'Tập số nguyên Z', latex: '$\\mathbb{Z}$', desc: 'Tập số nguyên Z' },
      { label: 'Tập số hữu tỉ Q', latex: '$\\mathbb{Q}$', desc: 'Tập số hữu tỉ Q' },
      { label: 'Với mọi ∀', latex: '$\\forall x \\in \\mathbb{R}$', desc: 'Ký hiệu với mọi' },
      { label: 'Tồn tại ∃', latex: '$\\exists x > 0$', desc: 'Ký hiệu tồn tại' },
      { label: 'Suy ra ⇒', latex: '$\\Rightarrow$', desc: 'Dấu suy ra' },
      { label: 'Tương đương ⇔', latex: '$\\Leftrightarrow$', desc: 'Dấu tương đương' },
      { label: 'Chỉnh hợp A(n, k)', latex: '$A_n^k = \\frac{n!}{(n - k)!}$', desc: 'Công thức chỉnh hợp chập k của n' },
      { label: 'Tổ hợp C(n, k)', latex: '$C_n^k = \\frac{n!}{k!(n - k)!}$', desc: 'Công thức tổ hợp chập k của n' },
      { label: 'Xác suất P(A)', latex: '$P(A) = \\frac{n(A)}{n(\\Omega)}$', desc: 'Xác suất cổ điển' },
    ]
  };

  // Geometric diagram library (SVG templates for instant insertion)
  const geometricTemplates = [
    {
      id: 'oxy_axes',
      name: 'Hệ trục tọa độ Oxy',
      desc: 'Mặt phẳng tọa độ Oxy 2 chiều chuẩn',
      snippet: `<svg viewBox="0 0 200 200" width="180" height="180" style="margin: 8px auto; display: block;"><line x1="20" y1="100" x2="180" y2="100" stroke="#334155" stroke-width="2"/><polygon points="180,96 190,100 180,104" fill="#334155"/><line x1="100" y1="180" x2="100" y2="20" stroke="#334155" stroke-width="2"/><polygon points="96,20 100,10 104,20" fill="#334155"/><text x="180" y="115" font-size="12" fill="#334155" font-weight="bold">x</text><text x="85" y="25" font-size="12" fill="#334155" font-weight="bold">y</text><text x="88" y="115" font-size="12" fill="#64748b">O</text></svg>`
    },
    {
      id: 'pyramid_sabc',
      name: 'Hình chóp tam giác S.ABC',
      desc: 'Khối chóp tam giác đáy ABC đỉnh S',
      snippet: `<svg viewBox="0 0 200 180" width="180" height="160" style="margin: 8px auto; display: block;"><polygon points="100,20 30,140 170,140" fill="none" stroke="#2563eb" stroke-width="2"/><line x1="100" y1="20" x2="110" y2="160" stroke="#2563eb" stroke-width="2"/><line x1="30" y1="140" x2="110" y2="160" stroke="#2563eb" stroke-width="2"/><line x1="170" y1="140" x2="110" y2="160" stroke="#2563eb" stroke-width="2"/><line x1="30" y1="140" x2="170" y2="140" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="3 3"/><text x="95" y="15" font-size="12" font-weight="bold" fill="#1e293b">S</text><text x="15" y="145" font-size="12" font-weight="bold" fill="#1e293b">A</text><text x="175" y="145" font-size="12" font-weight="bold" fill="#1e293b">C</text><text x="110" y="175" font-size="12" font-weight="bold" fill="#1e293b">B</text></svg>`
    },
    {
      id: 'pyramid_sabcd',
      name: 'Hình chóp tứ giác S.ABCD',
      desc: 'Khối chóp tứ giác đáy ABCD đỉnh S nét đứt',
      snippet: `<svg viewBox="0 0 220 190" width="190" height="160" style="margin: 8px auto; display: block;"><polygon points="110,20 30,130 150,130" fill="none" stroke="#2563eb" stroke-width="2"/><polygon points="110,20 150,130 190,100" fill="none" stroke="#2563eb" stroke-width="2"/><line x1="110" y1="20" x2="70" y2="100" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="3 3"/><line x1="30" y1="130" x2="70" y2="100" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="3 3"/><line x1="70" y1="100" x2="190" y2="100" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="3 3"/><text x="105" y="15" font-size="12" font-weight="bold" fill="#1e293b">S</text><text x="15" y="135" font-size="12" font-weight="bold" fill="#1e293b">A</text><text x="155" y="140" font-size="12" font-weight="bold" fill="#1e293b">B</text><text x="195" y="105" font-size="12" font-weight="bold" fill="#1e293b">C</text><text x="55" y="95" font-size="12" font-weight="bold" fill="#1e293b">D</text></svg>`
    },
    {
      id: 'right_triangle',
      name: 'Tam giác vuông ABC',
      desc: 'Tam giác ABC vuông tại A với góc vuông đánh dấu',
      snippet: `<svg viewBox="0 0 200 160" width="180" height="140" style="margin: 8px auto; display: block;"><polygon points="40,130 160,130 40,30" fill="none" stroke="#059669" stroke-width="2"/><polyline points="40,115 55,115 55,130" fill="none" stroke="#059669" stroke-width="1.5"/><text x="25" y="140" font-size="12" font-weight="bold" fill="#1e293b">A</text><text x="165" y="135" font-size="12" font-weight="bold" fill="#1e293b">B</text><text x="35" y="25" font-size="12" font-weight="bold" fill="#1e293b">C</text></svg>`
    },
    {
      id: 'prism_triangular',
      name: 'Lăng trụ đứng tam giác ABC.A\'B\'C\'',
      desc: 'Hình lăng trụ tam giác đứng',
      snippet: `<svg viewBox="0 0 200 200" width="170" height="170" style="margin: 8px auto; display: block;"><polygon points="40,70 120,50 160,70" fill="none" stroke="#7c3aed" stroke-width="2"/><polygon points="40,160 120,140 160,160" fill="none" stroke="#7c3aed" stroke-width="2"/><line x1="40" y1="70" x2="40" y2="160" stroke="#7c3aed" stroke-width="2"/><line x1="160" y1="70" x2="160" y2="160" stroke="#7c3aed" stroke-width="2"/><line x1="120" y1="50" x2="120" y2="140" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="3 3"/><text x="25" y="75" font-size="11" font-weight="bold">A'</text><text x="120" y="45" font-size="11" font-weight="bold">B'</text><text x="165" y="75" font-size="11" font-weight="bold">C'</text><text x="25" y="165" font-size="11" font-weight="bold">A</text><text x="120" y="155" font-size="11" font-weight="bold">B</text><text x="165" y="165" font-size="11" font-weight="bold">C</text></svg>`
    },
    {
      id: 'trig_circle',
      name: 'Đường tròn lượng giác',
      desc: 'Đường tròn đơn vị bán kính R=1 kèm trục sin, cos',
      snippet: `<svg viewBox="0 0 200 200" width="180" height="180" style="margin: 8px auto; display: block;"><circle cx="100" cy="100" r="70" fill="none" stroke="#ea580c" stroke-width="2"/><line x1="15" y1="100" x2="185" y2="100" stroke="#334155" stroke-width="1.5"/><line x1="100" y1="185" x2="100" y2="15" stroke="#334155" stroke-width="1.5"/><text x="180" y="95" font-size="11" fill="#ea580c" font-weight="bold">cos</text><text x="105" y="25" font-size="11" fill="#ea580c" font-weight="bold">sin</text><text x="175" y="115" font-size="10">1</text><text x="18" y="115" font-size="10">-1</text><text x="105" y="35" font-size="10">1</text><text x="105" y="175" font-size="10">-1</text></svg>`
    }
  ];

  // Handle local image file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Chỉ hỗ trợ tệp hình ảnh (PNG, JPG, JPEG, SVG, WebP).');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setUploadError('Dung lượng hình ảnh tối đa là 3MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      onInsert(`\n<img src="${base64}" alt="Hình minh họa" class="max-h-60 mx-auto my-2 rounded-xl border border-slate-200" />\n`);
      onClose();
    };
    reader.readAsDataURL(file);
  };

  // Handle image paste from clipboard
  const handlePasteImage = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = reader.result as string;
              onInsert(`\n<img src="${base64}" alt="Hình minh họa từ clipboard" class="max-h-60 mx-auto my-2 rounded-xl border border-slate-200" />\n`);
              onClose();
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
      }
      setUploadError('Không tìm thấy hình ảnh trong bộ nhớ tạm (clipboard). Vui lòng sao chép ảnh trước.');
    } catch {
      setUploadError('Trình duyệt chưa cấp quyền đọc clipboard. Vui lòng sử dụng nút tải ảnh từ máy tính.');
    }
  };

  const handleInsertSnippet = (snippet: string) => {
    onInsert(snippet);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">
                {title}
              </h3>
              <p className="text-xs text-slate-300">
                Chèn công thức toán học LaTeX chuẩn Bộ GD&ĐT, mẫu hình vẽ hình học hoặc ảnh minh họa
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary Tabs */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2 text-xs font-bold shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('formulas')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'formulas' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Sigma className="w-4 h-4" />
            <span>Thư viện công thức ({formulaData[activeCategory]?.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('geometry')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'geometry' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Shapes className="w-4 h-4" />
            <span>Hình vẽ & Đồ thị mẫu</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('custom_latex')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'custom_latex' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <Code className="w-4 h-4" />
            <span>Soạn LaTeX tự do (Xem trước trực tiếp)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('upload_image')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'upload_image' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Chèn ảnh từ máy / Clipboard</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">

          {/* TAB 1: FORMULAS LIBRARY */}
          {activeTab === 'formulas' && (
            <div className="space-y-4">
              {/* Category sub-navigation */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {mathCategories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id as any)}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      activeCategory === cat.id
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-950 font-bold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm font-mono font-black text-indigo-600">{cat.icon}</span>
                    <span className="text-[11px] leading-tight line-clamp-1">{cat.name}</span>
                  </button>
                ))}
              </div>

              {/* Items grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(formulaData[activeCategory] || []).map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-white border border-slate-200 rounded-2xl hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between gap-3 group"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">{item.label}</span>
                        <span className="text-[10px] text-slate-400 line-clamp-1">{item.desc}</span>
                      </div>
                      <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 flex items-center justify-center min-h-[56px] text-slate-900 overflow-x-auto">
                        <MathRenderer content={item.latex} />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleInsertSnippet(item.latex)}
                      className="w-full py-1.5 px-3 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Chèn vào nội dung</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: GEOMETRIC SHAPES & DIAGRAMS */}
          {activeTab === 'geometry' && (
            <div className="space-y-4">
              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-950">
                <strong>Thư viện hình học SVG chuẩn:</strong> Hình ảnh vector hiển thị sắc nét trên mọi thiết bị và màn hình điện thoại, in ấn không bị vỡ hạt. Nhấp "Chèn hình này" để gắn ngay vào câu hỏi.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {geometricTemplates.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-xs text-slate-900">{t.name}</h4>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight">{t.desc}</p>
                      <div 
                        className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center min-h-[140px]"
                        dangerouslySetInnerHTML={{ __html: t.snippet }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleInsertSnippet(`\n${t.snippet}\n`)}
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Chèn hình này</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: CUSTOM LATEX EDITOR WITH LIVE PREVIEW */}
          {activeTab === 'custom_latex' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Input Editor */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">
                      Mã công thức LaTeX:
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Hệ thống tự động kẹp dấu $ khi chèn
                    </span>
                  </div>
                  <textarea
                    rows={6}
                    value={customLatex}
                    onChange={(e) => setCustomLatex(e.target.value)}
                    placeholder="Nhập mã LaTeX, ví dụ: \frac{a}{b} hoặc \sqrt{x^2 + 1}..."
                    className="w-full p-3 font-mono text-xs text-slate-900 bg-white border border-slate-300 rounded-2xl focus:ring-2 focus:ring-indigo-500 font-medium"
                  />

                  {/* Quick LaTeX helper chips */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setCustomLatex(prev => prev + ' \\frac{a}{b}')}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-mono text-[11px]"
                    >
                      \frac
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomLatex(prev => prev + ' \\sqrt{x}')}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-mono text-[11px]"
                    >
                      \sqrt
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomLatex(prev => prev + ' ^{2}')}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-mono text-[11px]"
                    >
                      ^2
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomLatex(prev => prev + ' _{1}')}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-mono text-[11px]"
                    >
                      _1
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomLatex(prev => prev + ' \\int_{a}^{b} f(x)dx')}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-mono text-[11px]"
                    >
                      \int
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomLatex(prev => prev + ' \\vec{AB}')}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-mono text-[11px]"
                    >
                      \vec
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomLatex(prev => prev + ' \\Delta')}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-mono text-[11px]"
                    >
                      \Delta
                    </button>
                  </div>
                </div>

                {/* Live Preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-indigo-600" />
                      Xem trước kết quả trực tiếp (Live KaTeX):
                    </label>
                  </div>
                  <div className="p-4 bg-slate-50 border-2 border-dashed border-indigo-200 rounded-2xl min-h-[175px] flex items-center justify-center text-slate-900 text-sm overflow-x-auto">
                    {customLatex.trim() ? (
                      <MathRenderer 
                        content={customLatex.startsWith('$') ? customLatex : `$${customLatex}$`} 
                      />
                    ) : (
                      <span className="text-slate-400 text-xs italic">
                        (Công thức xem trước sẽ hiển thị tại đây...)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    const formatted = customLatex.trim().startsWith('$') ? customLatex.trim() : `$${customLatex.trim()}$`;
                    handleInsertSnippet(formatted);
                  }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Chèn công thức này vào bài</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: UPLOAD OR PASTE IMAGE */}
          {activeTab === 'upload_image' && (
            <div className="space-y-4 max-w-xl mx-auto">
              <div className="p-6 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-300 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto">
                  <ImageIcon className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    Tải hình vẽ hoặc đồ thị từ máy tính
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Hỗ trợ định dạng PNG, JPG, WebP hoặc SVG. Hình ảnh sẽ được tối ưu và chèn trực tiếp vào câu hỏi.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <label className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md transition-all flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    <span>Chọn tệp ảnh từ máy tính</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handlePasteImage}
                    className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold text-xs rounded-xl cursor-pointer shadow-2xs transition-all flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4 text-emerald-600" />
                    <span>Dán ảnh từ Clipboard (Ctrl+V)</span>
                  </button>
                </div>

                {uploadError && (
                  <p className="text-xs text-rose-600 font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                    {uploadError}
                  </p>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end text-xs shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl cursor-pointer"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
};
