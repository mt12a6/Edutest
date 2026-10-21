import React, { useState } from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  Highlighter, 
  Palette, 
  Calculator, 
  ChevronDown, 
  Sigma, 
  Shapes, 
  BookOpen, 
  Sparkles,
  Check
} from 'lucide-react';

interface RichTextEditorToolbarProps {
  onInsert: (snippet: string) => void;
  className?: string;
  compact?: boolean;
}

export const RichTextEditorToolbar: React.FC<RichTextEditorToolbarProps> = ({
  onInsert,
  className = '',
  compact = false
}) => {
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [showMathCategory, setShowMathCategory] = useState<'algebra' | 'symbols' | 'geometry' | 'calculus' | null>(null);

  const colors = [
    { name: 'Đỏ', hex: '#dc2626', bg: 'bg-red-500' },
    { name: 'Xanh dương', hex: '#2563eb', bg: 'bg-blue-600' },
    { name: 'Xanh lá', hex: '#16a34a', bg: 'bg-emerald-600' },
    { name: 'Cam', hex: '#ea580c', bg: 'bg-orange-500' },
    { name: 'Tím', hex: '#9333ea', bg: 'bg-purple-600' },
    { name: 'Xám đậm', hex: '#475569', bg: 'bg-slate-600' },
  ];

  const mathFormulas: Record<string, Array<{ label: string; latex: string; desc: string }>> = {
    algebra: [
      { label: 'a/b', latex: '$\\frac{a}{b}$', desc: 'Phân số' },
      { label: '√x', latex: '$\\sqrt{x}$', desc: 'Căn bậc hai' },
      { label: 'x²', latex: '$x^2$', desc: 'Bình phương' },
      { label: 'xⁿ', latex: '$x^n$', desc: 'Lũy thừa n' },
      { label: 'x₁', latex: '$x_1$', desc: 'Chỉ số dưới' },
      { label: '|x|', latex: '$|x|$', desc: 'Trị tuyệt đối' },
      { label: '±', latex: '$\\pm$', desc: 'Cộng trừ' },
    ],
    symbols: [
      { label: '≠', latex: '$\\ne$', desc: 'Khác' },
      { label: '≤', latex: '$\\le$', desc: 'Nhỏ hơn hoặc bằng' },
      { label: '≥', latex: '$\\ge$', desc: 'Lớn hơn hoặc bằng' },
      { label: '≈', latex: '$\\approx$', desc: 'Xấp xỉ' },
      { label: '∞', latex: '$\\infty$', desc: 'Vô cực' },
      { label: 'π', latex: '$\\pi$', desc: 'Số Pi' },
      { label: '∆', latex: '$\\Delta$', desc: 'Delta' },
      { label: '∈', latex: '$\\in$', desc: 'Thuộc' },
      { label: '∉', latex: '$\\notin$', desc: 'Không thuộc' },
    ],
    geometry: [
      { label: '∆ABC', latex: '$\\Delta ABC$', desc: 'Tam giác' },
      { label: '∠A', latex: '$\\widehat{A}$', desc: 'Góc A' },
      { label: '⊥', latex: '$\\perp$', desc: 'Vuông góc' },
      { label: '∥', latex: '$\\parallel$', desc: 'Song song' },
      { label: '90°', latex: '$90^\\circ$', desc: 'Độ góc' },
      { label: 'vec(AB)', latex: '$\\vec{AB}$', desc: 'Véc-tơ' },
    ],
    calculus: [
      { label: 'sin', latex: '$\\sin(x)$', desc: 'Sin' },
      { label: 'cos', latex: '$\\cos(x)$', desc: 'Cos' },
      { label: '∫', latex: '$\\int f(x)dx$', desc: 'Tích phân' },
      { label: 'lim', latex: '$\\lim_{x \\to x_0} f(x)$', desc: 'Giới hạn' },
      { label: 'α', latex: '$\\alpha$', desc: 'Alpha' },
      { label: 'β', latex: '$\\beta$', desc: 'Beta' },
    ]
  };

  return (
    <div className={`flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100/90 border border-slate-200 rounded-xl text-xs select-none ${className}`}>
      
      {/* 1. TEXT FORMATTING GROUP */}
      <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200/80 shadow-2xs">
        {/* Bold */}
        <button
          type="button"
          onClick={() => onInsert('**in đậm**')}
          className="p-1.5 rounded hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition-colors"
          title="In đậm chữ (**nội dung**)"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>

        {/* Italic */}
        <button
          type="button"
          onClick={() => onInsert('*in nghiêng*')}
          className="p-1.5 rounded hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition-colors"
          title="In nghiêng chữ (*nội dung*)"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>

        {/* Underline */}
        <button
          type="button"
          onClick={() => onInsert('<u>gạch chân</u>')}
          className="p-1.5 rounded hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition-colors"
          title="Gạch chân chữ (<u>nội dung</u>)"
        >
          <Underline className="w-3.5 h-3.5" />
        </button>

        {/* Highlight Yellow */}
        <button
          type="button"
          onClick={() => onInsert('==tô màu vàng==')}
          className="p-1.5 rounded hover:bg-amber-100 text-amber-700 transition-colors flex items-center gap-0.5"
          title="Tô nền nổi bật (==nội dung==)"
        >
          <Highlighter className="w-3.5 h-3.5" />
        </button>

        {/* Text Color Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColorDropdown(!showColorDropdown)}
            className="p-1.5 rounded hover:bg-slate-100 text-slate-700 transition-colors flex items-center gap-0.5"
            title="Tô màu chữ"
          >
            <Palette className="w-3.5 h-3.5 text-indigo-600" />
            <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
          </button>

          {showColorDropdown && (
            <div className="absolute left-0 mt-1.5 w-36 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in slide-in-from-top-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 px-1">
                Chọn màu chữ:
              </span>
              <div className="space-y-1">
                {colors.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => {
                      onInsert(`<span style="color:${c.hex}">chữ màu ${c.name.toLowerCase()}</span>`);
                      setShowColorDropdown(false);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-left transition-colors text-xs"
                  >
                    <span className={`w-3.5 h-3.5 rounded-full ${c.bg} shrink-0`}></span>
                    <span className="font-semibold text-slate-800">{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="h-5 w-px bg-slate-300 mx-0.5 hidden sm:block"></div>

      {/* 2. MATH FORMULAS SHORTCUTS */}
      <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200/80 shadow-2xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase px-1 hidden md:inline">
          Toán:
        </span>
        
        {/* Quick math chips */}
        <button
          type="button"
          onClick={() => onInsert('$\\frac{a}{b}$')}
          className="px-2 py-1 rounded hover:bg-slate-100 text-slate-700 font-serif font-bold text-xs"
          title="Chèn phân số"
        >
          a/b
        </button>

        <button
          type="button"
          onClick={() => onInsert('$\\sqrt{x}$')}
          className="px-2 py-1 rounded hover:bg-slate-100 text-slate-700 font-serif font-bold text-xs"
          title="Chèn căn bậc hai"
        >
          √x
        </button>

        <button
          type="button"
          onClick={() => onInsert('$x^2$')}
          className="px-2 py-1 rounded hover:bg-slate-100 text-slate-700 font-serif font-bold text-xs"
          title="Chèn bình phương"
        >
          x²
        </button>

        <button
          type="button"
          onClick={() => onInsert('$x_1$')}
          className="px-2 py-1 rounded hover:bg-slate-100 text-slate-700 font-serif font-bold text-xs"
          title="Chèn chỉ số dưới"
        >
          x₁
        </button>

        <button
          type="button"
          onClick={() => onInsert('$\\pi$')}
          className="px-2 py-1 rounded hover:bg-slate-100 text-slate-700 font-serif font-bold text-xs"
          title="Chèn số Pi"
        >
          π
        </button>

        <button
          type="button"
          onClick={() => onInsert('$\\Delta$')}
          className="px-2 py-1 rounded hover:bg-slate-100 text-slate-700 font-serif font-bold text-xs"
          title="Chèn Delta"
        >
          ∆
        </button>

        {/* More Math Formulas Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMathCategory(showMathCategory ? null : 'algebra')}
            className="px-2 py-1 rounded bg-slate-50 hover:bg-slate-100 text-indigo-700 font-semibold text-xs flex items-center gap-1 border border-indigo-100"
          >
            <Calculator className="w-3 h-3 text-indigo-600" />
            <span>Công thức</span>
            <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
          </button>

          {showMathCategory && (
            <div className="absolute right-0 mt-1.5 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 animate-in fade-in slide-in-from-top-1">
              {/* Category tabs */}
              <div className="flex items-center gap-1 pb-2 border-b border-slate-100 mb-2">
                <button
                  type="button"
                  onClick={() => setShowMathCategory('algebra')}
                  className={`px-2 py-1 rounded text-[11px] font-bold ${showMathCategory === 'algebra' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  Đại số
                </button>
                <button
                  type="button"
                  onClick={() => setShowMathCategory('symbols')}
                  className={`px-2 py-1 rounded text-[11px] font-bold ${showMathCategory === 'symbols' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  Ký hiệu
                </button>
                <button
                  type="button"
                  onClick={() => setShowMathCategory('geometry')}
                  className={`px-2 py-1 rounded text-[11px] font-bold ${showMathCategory === 'geometry' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  Hình học
                </button>
                <button
                  type="button"
                  onClick={() => setShowMathCategory('calculus')}
                  className={`px-2 py-1 rounded text-[11px] font-bold ${showMathCategory === 'calculus' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  Giải tích
                </button>
              </div>

              {/* Items grid */}
              <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
                {(mathFormulas[showMathCategory] || []).map((f) => (
                  <button
                    key={f.label}
                    type="button"
                    onClick={() => {
                      onInsert(f.latex);
                      setShowMathCategory(null);
                    }}
                    className="p-1.5 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-slate-800 font-bold text-xs text-center transition-colors truncate"
                    title={f.desc}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
