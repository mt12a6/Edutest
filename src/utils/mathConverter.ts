import { 
  Paragraph, 
  TextRun, 
  Math as DocxMath, 
  MathRun, 
  MathFraction, 
  MathRadical, 
  MathSuperScript, 
  MathSubScript,
  MathRoundBrackets
} from 'docx';

/**
 * Maps common LaTeX commands to Unicode mathematical characters
 */
export const LATEX_UNICODE_MAP: Record<string, string> = {
  '\\pm': '±',
  '\\mp': '∓',
  '\\times': '×',
  '\\cdot': '·',
  '\\div': '÷',
  '\\le': '≤',
  '\\leq': '≤',
  '\\ge': '≥',
  '\\geq': '≥',
  '\\neq': '≠',
  '\\approx': '≈',
  '\\equiv': '≡',
  '\\sim': '∼',
  // Divisibility (Crucial for Grade 6 Math)
  '\\vdots': '⋮',
  '\\not\\vdots': '∤',
  '\\nmid': '∤',
  '\\mid': '∣',
  '\\dots': '…',
  '\\ldots': '…',
  '\\cdots': '⋯',
  // Sets and logic
  '\\in': '∈',
  '\\notin': '∉',
  '\\ni': '∋',
  '\\subset': '⊂',
  '\\subseteq': '⊆',
  '\\supset': '⊃',
  '\\supseteq': '⊇',
  '\\cup': '∪',
  '\\cap': '∩',
  '\\setminus': '\\',
  '\\emptyset': '∅',
  '\\forall': '∀',
  '\\exists': '∃',
  '\\infty': '∞',
  '\\parallel': '//',
  '\\perp': '⊥',
  '\\degree': '°',
  '\\ang': '°',
  '\\angle': '∠',
  '\\widehat': '∠',
  '\\triangle': '△',
  '\\rightarrow': '→',
  '\\Rightarrow': '⇒',
  '\\leftarrow': '←',
  '\\Leftarrow': '⇐',
  '\\leftrightarrow': '↔',
  '\\Leftrightarrow': '⇔',
  // Greek Lowercase
  '\\alpha': 'α',
  '\\beta': 'β',
  '\\gamma': 'γ',
  '\\delta': 'δ',
  '\\epsilon': 'ε',
  '\\zeta': 'ζ',
  '\\eta': 'η',
  '\\theta': 'θ',
  '\\iota': 'ι',
  '\\kappa': 'κ',
  '\\lambda': 'λ',
  '\\mu': 'μ',
  '\\nu': 'ν',
  '\\xi': 'ξ',
  '\\pi': 'π',
  '\\rho': 'ρ',
  '\\sigma': 'σ',
  '\\tau': 'τ',
  '\\upsilon': 'υ',
  '\\phi': 'φ',
  '\\chi': 'χ',
  '\\psi': 'ψ',
  '\\omega': 'ω',
  // Greek Uppercase
  '\\Gamma': 'Γ',
  '\\Delta': 'Δ',
  '\\Theta': 'Θ',
  '\\Lambda': 'Λ',
  '\\Xi': 'Ξ',
  '\\Pi': 'Π',
  '\\Sigma': 'Σ',
  '\\Phi': 'Φ',
  '\\Psi': 'Ψ',
  '\\Omega': 'Ω',
  // Number sets
  '\\mathbb{R}': 'ℝ',
  '\\mathbb{Z}': 'ℤ',
  '\\mathbb{N}^*': 'ℕ*',
  '\\mathbb{N}^\\ast': 'ℕ*',
  '\\mathbb{N}': 'ℕ',
  '\\mathbb{Q}': 'ℚ',
  '\\mathbb{C}': 'ℂ',
  '\\mathbb{P}': 'ℙ',
  '\\R': 'ℝ',
  '\\Z': 'ℤ',
  '\\N^*': 'ℕ*',
  '\\N': 'ℕ',
  '\\Q': 'ℚ',
  '\\C': 'ℂ'
};

const SUPERSCRIPT_MAP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'n': 'ⁿ', 'i': 'ⁱ', 'x': 'ˣ', 'y': 'ʸ'
};

const SUBSCRIPT_MAP: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'h': 'ₕ', 'i': 'ᵢ', 'j': 'ⱼ',
  'k': 'ₖ', 'l': 'ₗ', 'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ',
  'p': 'ₚ', 'r': 'ᵣ', 's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ',
  'v': 'ᵥ', 'x': 'ₓ'
};

/**
 * Strips TeX comment artifacts like %[Câu 6] or % ...
 */
export function stripCommentsAndHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Remove TeX comment lines or % artifacts
    .replace(/(^|[^\\])%[^\n]*/g, '$1')
    .replace(/%\[[^\]]*\]/g, '')
    .trim();
}

/**
 * Convert LaTeX to rich Unicode Mathematical Typography
 * Used for PowerPoint slide presentation, titles, and readable text
 */
export function latexToUnicodeMath(rawText: string): string {
  if (!rawText) return '';
  let text = stripCommentsAndHtml(rawText);

  // Normalize delimiters
  text = text
    .replace(/\\\[([\s\S]+?)\\\]/g, ' $1 ')
    .replace(/\\\(([\s\S]+?)\\\)/g, ' $1 ')
    .replace(/\$\$([\s\S]+?)\$\$/g, ' $1 ')
    .replace(/\$([^\$]+)\$/g, ' $1 ');

  // Remove TikZ / PSTricks blocks
  text = text.replace(/\\begin\{(tikzpicture|pspicture)\}[\s\S]*?\\end\{\1\}/gi, '[Hình vẽ minh họa]');

  // Vietnamese custom system of equations macros
  text = text.replace(/\\heva\{([^{}]+)\}/g, '{ $1 }');
  text = text.replace(/\\hoac\{([^{}]+)\}/g, '[ $1 ]');

  // Replace vectors \vec{AB} -> AB⃗ or vectơ AB
  text = text.replace(/\\vec\{([^}]+)\}/g, '$1⃗');
  text = text.replace(/\\overrightarrow\{([^}]+)\}/g, '$1⃗');

  // Simple single-char fractions \dfrac{1}{2} -> 1/2
  text = text.replace(/\\(?:dfrac|tfrac|cfrac|frac)\{([0-9a-zA-Z])\}\{([0-9a-zA-Z])\}/g, '$1/$2');
  // General fractions \dfrac{a}{b} -> (a)/(b)
  text = text.replace(/\\(?:dfrac|tfrac|cfrac|frac)\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');

  // Radicals \sqrt[n]{x} -> ⁿ√(x) or \sqrt{x} -> √(x)
  text = text.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, '($1)√($2)');
  text = text.replace(/\\sqrt\{([^}]+)\}/g, '√($1)');

  // Superscripts x^{2} -> x²
  text = text.replace(/\^\{([^}]+)\}/g, (_, exp) => {
    return exp.split('').map((c: string) => SUPERSCRIPT_MAP[c] || c).join('');
  });
  text = text.replace(/\^([0-9a-zA-Z])/g, (_, char) => SUPERSCRIPT_MAP[char] || `^${char}`);

  // Subscripts x_{1} -> x₁
  text = text.replace(/_\{([^}]+)\}/g, (_, sub) => {
    return sub.split('').map((c: string) => SUBSCRIPT_MAP[c] || c).join('');
  });
  text = text.replace(/_([0-9a-zA-Z])/g, (_, char) => SUBSCRIPT_MAP[char] || `_${char}`);

  // Replace mapped symbols (sort longest keys first to prevent partial replacements)
  const sortedEntries = Object.entries(LATEX_UNICODE_MAP).sort((a, b) => b[0].length - a[0].length);
  for (const [tex, uni] of sortedEntries) {
    // Escape regex specials
    const escaped = tex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(escaped, 'g'), uni);
  }

  // Common functions
  text = text
    .replace(/\\(?:sin|cos|tan|cot|ln|log|lim|max|min)\b/g, (m) => m.slice(1))
    .replace(/\\left[\[\(\{]/g, '(')
    .replace(/\\right[\]\)\}]/g, ')')
    .replace(/\\left\./g, '')
    .replace(/\\right\./g, '')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\mathrm\{([^}]+)\}/g, '$1')
    .replace(/\\mathbf\{([^}]+)\}/g, '$1')
    .replace(/\\quad/g, ' ')
    .replace(/\\qquad/g, '  ')
    .replace(/\\,/g, ' ')
    .replace(/\\;/g, ' ')
    .replace(/\\!/g, '')
    .replace(/\\\{/g, '{')
    .replace(/\\\}/g, '}')
    .replace(/\\begin\{aligned\}/g, '')
    .replace(/\\end\{aligned\}/g, '')
    .replace(/\\begin\{cases\}/g, '{ ')
    .replace(/\\end\{cases\}/g, ' }')
    .replace(/\\\\/g, '; ')
    .replace(/&/g, ' ');

  // Clean remaining isolated backslashes before plain letters
  text = text.replace(/\\([a-zA-Z]+)/g, '$1');

  // Collapse multiple spaces
  text = text.replace(/[ \t]+/g, ' ').trim();

  return text;
}

/**
 * Parses LaTeX math snippet into native Office Math (OMML) docx components
 */
function parseFormulaToDocxMath(formula: string): DocxMath {
  let inner = formula.trim();

  // Try detecting fraction \dfrac{num}{den}
  const fracMatch = inner.match(/^\\(?:dfrac|tfrac|cfrac|frac)\{([^}]+)\}\{([^}]+)\}$/);
  if (fracMatch) {
    const numText = latexToUnicodeMath(fracMatch[1]);
    const denText = latexToUnicodeMath(fracMatch[2]);
    return new DocxMath({
      children: [
        new MathFraction({
          numerator: [new MathRun(numText)],
          denominator: [new MathRun(denText)]
        })
      ]
    });
  }

  // Try detecting radical \sqrt{base}
  const sqrtMatch = inner.match(/^\\sqrt\{([^}]+)\}$/);
  if (sqrtMatch) {
    const baseText = latexToUnicodeMath(sqrtMatch[1]);
    return new DocxMath({
      children: [
        new MathRadical({
          children: [new MathRun(baseText)]
        })
      ]
    });
  }

  // Try detecting power base^{exp}
  const powMatch = inner.match(/^([a-zA-Z0-9\(\)]+)\^\{([^}]+)\}$/);
  if (powMatch) {
    const base = latexToUnicodeMath(powMatch[1]);
    const exp = latexToUnicodeMath(powMatch[2]);
    return new DocxMath({
      children: [
        new MathSuperScript({
          children: [new MathRun(base)],
          superScript: [new MathRun(exp)]
        })
      ]
    });
  }

  // Try detecting subscript base_{sub}
  const subMatch = inner.match(/^([a-zA-Z0-9\(\)]+)_\{([^}]+)\}$/);
  if (subMatch) {
    const base = latexToUnicodeMath(subMatch[1]);
    const sub = latexToUnicodeMath(subMatch[2]);
    return new DocxMath({
      children: [
        new MathSubScript({
          children: [new MathRun(base)],
          subScript: [new MathRun(sub)]
        })
      ]
    });
  }

  // Fallback: convert math commands to Unicode and wrap in native MathRun
  const cleanMath = latexToUnicodeMath(inner);
  return new DocxMath({
    children: [
      new MathRun(cleanMath)
    ]
  });
}

/**
 * Splits arbitrary question or text into Word Paragraph children:
 * alternating between normal TextRun and native Office Math (DocxMath)
 */
export function parseTextToDocxRuns(
  text: string, 
  options: { size?: number; bold?: boolean; italics?: boolean; color?: string } = {}
): (TextRun | DocxMath)[] {
  if (!text) return [];

  const cleaned = stripCommentsAndHtml(text);

  // Normalize TeX delimiters
  const normalized = cleaned
    .replace(/\\\[([\s\S]+?)\\\]/g, '$$$$$1$$$$')
    .replace(/\\\(([\s\S]+?)\\\)/g, '$$$1$$');

  // Split by $$...$$ or $...$
  const mathRegex = /(\$\$[\s\S]+?\$\$|\$[^\$]+?\$)/g;
  const parts = normalized.split(mathRegex);

  const runs: (TextRun | DocxMath)[] = [];

  for (const part of parts) {
    if (!part) continue;

    // Display Math $$...$$
    if (part.startsWith('$$') && part.endsWith('$$')) {
      const code = part.slice(2, -2).trim();
      runs.push(parseFormulaToDocxMath(code));
      continue;
    }

    // Inline Math $...$
    if (part.startsWith('$') && part.endsWith('$')) {
      const code = part.slice(1, -1).trim();
      runs.push(parseFormulaToDocxMath(code));
      continue;
    }

    // Plain text (convert any leftover standalone TeX symbols to Unicode)
    const plainText = latexToUnicodeMath(part);
    if (plainText) {
      runs.push(
        new TextRun({
          text: plainText,
          size: options.size || 22, // 11pt default
          bold: options.bold,
          italics: options.italics,
          color: options.color || '0f172a',
          font: 'Times New Roman'
        })
      );
    }
  }

  return runs;
}
