import React, { useState } from 'react';
import { Calculator, ChevronDown, Sparkles, BookOpen, Shapes, Sigma, Copy, Check } from 'lucide-react';

interface MathFormulaToolbarProps {
  onInsert: (snippet: string) => void;
  className?: string;
  compact?: boolean;
}

interface FormulaItem {
  label: string;
  latex: string;
  desc?: string;
}

export const MathFormulaToolbar: React.FC<MathFormulaToolbarProps> = ({
  onInsert,
  className = '',
  compact = false
}) => {
  const [activeCategory, setActiveCategory] = useState<'algebra' | 'symbols' | 'geometry' | 'sets' | 'calculus'>('algebra');
  const [copiedLatex, setCopiedLatex] = useState<string | null>(null);

  const categories: Array<{ id: 'algebra' | 'symbols' | 'geometry' | 'sets' | 'calculus'; name: string; icon: React.ReactNode }> = [
    { id: 'algebra', name: 'Đại số & Phân số', icon: <Calculator className="w-3.5 h-3.5" /> },
    { id: 'symbols', name: 'Dấu & Quan hệ', icon: <Sigma className="w-3.5 h-3.5" /> },
    { id: 'geometry', name: 'Hình học & Góc', icon: <Shapes className="w-3.5 h-3.5" /> },
    { id: 'sets', name: 'Tập hợp & Logic', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'calculus', name: 'Lượng giác & Giải tích', icon: <Sparkles className="w-3.5 h-3.5" /> },
  ];

  const formulaData: Record<string, FormulaItem[]> = {
    algebra: [
      { label: 'a/b', latex: '$\\frac{a}{b}$', desc: 'Phân số' },
      { label: '√x', latex: '$\\sqrt{x}$', desc: 'Căn bậc hai' },
      { label: 'ⁿ√x', latex: '$\\sqrt[n]{x}$', desc: 'Căn bậc n' },
      { label: 'x²', latex: '$x^2$', desc: 'Bình phương' },
      { label: 'xⁿ', latex: '$x^n$', desc: 'Lũy thừa' },
      { label: 'x₁', latex: '$x_1$', desc: 'Chỉ số dưới' },
      { label: 'x_n', latex: '$x_n$', desc: 'Chỉ số n' },
      { label: '|x|', latex: '$|x|$', desc: 'Giá trị tuyệt đối' },
      { label: '(a+b)²', latex: '$(a + b)^2 = a^2 + 2ab + b^2$', desc: 'Hằng đẳng thức' },
      { label: 'f(x)', latex: '$f(x) = ax + b$', desc: 'Hàm số bậc nhất' },
      { label: 'y=ax²+bx+c', latex: '$y = ax^2 + bx + c$', desc: 'Tam thức bậc 2' },
    ],
    symbols: [
      { label: '±', latex: '$\\pm$', desc: 'Cộng trừ' },
      { label: '≠', latex: '$\\ne$', desc: 'Khác' },
      { label: '≤', latex: '$\\le$', desc: 'Nhỏ hơn hoặc bằng' },
      { label: '≥', latex: '$\\ge$', desc: 'Lớn hơn hoặc bằng' },
      { label: '≈', latex: '$\\approx$', desc: 'Xấp xỉ' },
      { label: '×', latex: '$\\times$', desc: 'Dấu nhân' },
      { label: '÷', latex: '$\\div$', desc: 'Dấu chia' },
      { label: '∞', latex: '$\\infty$', desc: 'Vô cực' },
      { label: '→', latex: '$\\to$', desc: 'Tiến tới' },
      { label: '∆', latex: '$\\Delta$', desc: 'Delta biệt thức' },
    ],
    geometry: [
      { label: '∆ABC', latex: '$\\Delta ABC$', desc: 'Tam giác ABC' },
      { label: '∠A', latex: '$\\widehat{A}$', desc: 'Góc A' },
      { label: '∠ABC', latex: '$\\widehat{ABC}$', desc: 'Góc ABC' },
      { label: '⊥', latex: '$\\perp$', desc: 'Vuông góc' },
      { label: '∥', latex: '$\\parallel$', desc: 'Song song' },
      { label: 'v(AB)', latex: '$\\vec{AB}$', desc: 'Véc-tơ AB' },
      { label: 'AB=5cm', latex: '$AB = 5\\text{ cm}$', desc: 'Độ dài cạnh' },
      { label: 'S(ABC)', latex: '$S_{ABC}$', desc: 'Diện tích tam giác' },
      { label: '90°', latex: '$90^\\circ$', desc: 'Độ góc' },
      { label: 'π', latex: '$\\pi$', desc: 'Số Pi' },
    ],
    sets: [
      { label: '∈', latex: '$\\in$', desc: 'Thuộc' },
      { label: '∉', latex: '$\\notin$', desc: 'Không thuộc' },
      { label: '⊂', latex: '$\\subset$', desc: 'Tập con' },
      { label: '∪', latex: '$\\cup$', desc: 'Phép hợp' },
      { label: '∩', latex: '$\\cap$', desc: 'Phép giao' },
      { label: '∅', latex: '$\\emptyset$', desc: 'Tập rỗng' },
      { label: 'R', latex: '$\\mathbb{R}$', desc: 'Tập số thực' },
      { label: 'N', latex: '$\\mathbb{N}$', desc: 'Tập số tự nhiên' },
      { label: 'Z', latex: '$\\mathbb{Z}$', desc: 'Tập số nguyên' },
      { label: 'Q', latex: '$\\mathbb{Q}$', desc: 'Tập số hữu tỉ' },
      { label: '∀', latex: '$\\forall$', desc: 'Với mọi' },
      { label: '∃', latex: '$\\exists$', desc: 'Tồn tại' },
      { label: '⇒', latex: '$\\Rightarrow$', desc: 'Suy ra' },
      { label: '⇔', latex: '$\\Leftrightarrow$', desc: 'Tương đương' },
    ],
    calculus: [
      { label: 'sin', latex: '$\\sin(x)$', desc: 'Sin' },
      { label: 'cos', latex: '$\\cos(x)$', desc: 'Cos' },
      { label: 'tan', latex: '$\\tan(x)$', desc: 'Tan' },
      { label: 'cot', latex: '$\\cot(x)$', desc: 'Cotan' },
      { label: 'lim', latex: '$\\lim_{x \\to x_0} f(x)$', desc: 'Giới hạn' },
      { label: '∫f(x)dx', latex: '$\\int f(x)dx$', desc: 'Nguyên hàm' },
      { label: '∫ₐᵇ', latex: '$\\int_{a}^{b} f(x)dx$', desc: 'Tích phân xác định' },
      { label: '∑', latex: '$\\sum_{i=1}^{n}$', desc: 'Tổng Sigma' },
      { label: 'log_a', latex: '$\\log_a(x)$', desc: 'Logarit cơ số a' },
      { label: 'ln(x)', latex: '$\\ln(x)$', desc: 'Logarit tự nhiên' },
      { label: 'α', latex: '$\\alpha$', desc: 'Alpha' },
      { label: 'β', latex: '$\\beta$', desc: 'Beta' },
      { label: 'θ', latex: '$\\theta$', desc: 'Theta' },
    ]
  };

  const handleItemClick = (latex: string) => {
    onInsert(latex);
    setCopiedLatex(latex);
    setTimeout(() => setCopiedLatex(null), 1500);
  };

  return (
    <div className={`p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs ${className}`}>
      {/* Category selector */}
      <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1 scrollbar-none">
        <div className="flex items-center gap-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer text-[11px] whitespace-nowrap ${
                activeCategory === cat.id
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
              }`}
            >
              {cat.icon}
              <span>{cat.name}</span>
            </button>
          ))}
        </div>

        {copiedLatex && (
          <span className="text-[10px] text-emerald-700 bg-emerald-100 font-bold px-2 py-0.5 rounded flex items-center gap-1 shrink-0 animate-in fade-in">
            <Check className="w-3 h-3 text-emerald-600" />
            Đã chèn
          </span>
        )}
      </div>

      {/* Formula buttons grid */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {(formulaData[activeCategory] || []).map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleItemClick(item.latex)}
            className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-lg text-slate-800 hover:text-indigo-700 font-mono text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer group"
            title={`${item.desc}: ${item.latex}`}
          >
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
