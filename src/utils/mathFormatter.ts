/**
 * Utility to detect and convert mathematical formulas, expressions and symbols
 * into clean KaTeX-compatible LaTeX ($...$ or $$...$$) for rendering.
 */

export function normalizeMathFormulas(text: string): string {
  if (!text) return '';

  let processed = text;

  // 1. If text is already containing balanced $...$ or $$...$$, check if parts need symbol normalization
  // Normalize Unicode math symbols inside and outside LaTeX
  const unicodeReplacements: Array<[RegExp, string | ((substring: string) => string)]> = [
    [/[\u00B2\u00B3\u2074-\u2079]/g, (m: string) => {
      const map: Record<string, string> = { '²': '^2', '³': '^3', '⁴': '^4', '⁵': '^5', '⁶': '^6', '⁷': '^7', '⁸': '^8', '⁹': '^9' };
      return map[m] || m;
    }],
    [/[\u2080-\u2089\u2099]/g, (m: string) => {
      const map: Record<string, string> = { '₀': '_0', '₁': '_1', '₂': '_2', '₃': '_3', '₄': '_4', '₅': '_5', '₆': '_6', '₇': '_7', '₈': '_8', '₉': '_9', 'ₙ': '_n' };
      return map[m] || m;
    }],
    [/≤/g, '\\le '],
    [/≥/g, '\\ge '],
    [/≠/g, '\\ne '],
    [/±/g, '\\pm '],
    [/≈/g, '\\approx '],
    [/∈/g, '\\in '],
    [/∉/g, '\\notin '],
    [/⊂/g, '\\subset '],
    [/∪/g, '\\cup '],
    [/∩/g, '\\cap '],
    [/∅/g, '\\emptyset '],
    [/[Δ∆]/g, '\\Delta '],
    [/∠([A-Za-z0-9]+)/g, '\\widehat{$1}'],
    [/∠/g, '\\angle '],
    [/⊥/g, '\\perp '],
    [/∥/g, '\\parallel '],
    [/∞/g, '\\infty '],
    [/→/g, '\\to '],
    [/∫/g, '\\int '],
    [/∑/g, '\\sum '],
    [/√\(([^)]+)\)/g, '\\sqrt{$1}'],
    [/√([0-9a-zA-Z]+)/g, '\\sqrt{$1}']
  ];

  // If text already has $...$, replace unicode symbols inside them first
  if (processed.includes('$')) {
    processed = processed.replace(/(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$)/g, (mathBlock) => {
      let block = mathBlock;
      for (const [re, rep] of unicodeReplacements) {
        block = block.replace(re, rep as any);
      }
      return block;
    });
  }

  // 2. Identify standalone math expressions not yet enclosed in $...$
  // Patterns like:
  // "x^2 - 4x + 3 = 0"
  // "y = 2x + 1"
  // "f(x) = (2x + 1)/(x - 3)"
  // "A = {1; 2; 3}"
  // "\frac{1}{2}" (unwrapped LaTeX)
  // "\sqrt{x}" (unwrapped LaTeX)

  // Auto-wrap unwrapped standard LaTeX commands: \frac{...}{...}, \sqrt{...}, \lim_{...}, \int_{...}
  processed = processed.replace(/(?<!\$)(?:\\frac\{[^{}]+\}\{[^{}]+\}|\\sqrt\{[^{}]+\}|\\left[([{|][\s\S]*?\\right[)\]}|])(?!\$)/g, (match) => {
    return `$${match}$`;
  });

  // Auto-wrap equations with equals and operators if they contain variables/powers:
  // e.g. "x^2 + 5x + 6 = 0", "y = -x^2 + 2x", "a + b = c"
  const equationRegex = /(?<![\w$])([a-zA-Z]\s*[\^=+\-*/]\s*[0-9a-zA-Z()^+\-*/\s]+\s*=\s*[-+]?[0-9a-zA-Z()^+\-*/\s]+)(?![\w$])/g;
  processed = processed.replace(equationRegex, (match) => {
    // Only wrap if it looks like real math (contains ^, +, -, *, /, or variables) and doesn't contain normal Vietnamese words
    if (/^[a-zA-Z0-9\s()^+\-*/=.,\\_]+$/.test(match) && /[=^+\-*/]/.test(match) && match.trim().length > 3) {
      // Don't wrap if already inside $
      return `$${match.trim()}$`;
    }
    return match;
  });

  // Convert simple fraction notations: e.g. (a+b)/(c+d) into \frac{a+b}{c+d} when inside $ or as standalone
  processed = processed.replace(/\$([^\$]+)\$/g, (full, mathInner) => {
    let clean = mathInner;
    // (a)/(b) -> \frac{a}{b}
    clean = clean.replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, '\\frac{$1}{$2}');
    // a/b with numbers e.g. 1/2, 3/4
    clean = clean.replace(/(?<=\s|^|\+|-|=)([0-9a-zA-Z]+)\s*\/\s*([0-9a-zA-Z]+)(?=\s|$|\+|-|=)/g, '\\frac{$1}{$2}');
    return `$${clean}$`;
  });

  // Auto-wrap simple power expressions like "x^2", "a^3", "10^-5" if standalone
  processed = processed.replace(/(?<![\w$])([a-zA-Z][\^_][0-9a-zA-Z()\-+]+)(?![\w$])/g, (match) => {
    return `$${match}$`;
  });

  // Clean up any double or adjacent delimiters like $$ ... $$ or $ $
  processed = processed.replace(/\$\s*\$/g, '');
  processed = processed.replace(/\$([^\$]+)\$\s*\$([^\$]+)\$/g, '$$$1 $2$$');

  return processed;
}

/**
 * Checks if a question prompt or option has mathematical content
 */
export function hasMathContent(text: string): boolean {
  if (!text) return false;
  return /[\$\\^_{}\[\]]|\\frac|\\sqrt|\\ge|\\le|\\in|\\pm|[=+\-*/]{2,}|[0-9a-zA-Z]\^[0-9]/.test(text);
}
