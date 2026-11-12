import React from 'react';
import katex from 'katex';

interface MathRendererProps {
  content: string;
  className?: string;
  inline?: boolean;
}

// Custom KaTeX macros for Vietnamese high school math (THCS & THPT)
const KATEX_MACROS: Record<string, string> = {
  '\\dfrac': '\\frac{#1}{#2}',
  '\\tfrac': '\\frac{#1}{#2}',
  '\\cfrac': '\\frac{#1}{#2}',
  '\\parallel': '\\mathrel{/\\!/}',
  '\\perp': '\\mathrel{\\bot}',
  '\\degree': '^{\\circ}',
  '\\ang': '^{\\circ}',
  '\\vec': '\\overrightarrow{#1}',
  '\\va': '\\vec{a}',
  '\\vb': '\\vec{b}',
  '\\vc': '\\vec{c}',
  '\\vu': '\\vec{u}',
  '\\vv': '\\vec{v}',
  '\\vn': '\\vec{n}',
  '\\cotan': '\\cot',
  '\\tg': '\\tan',
  '\\cotg': '\\cot',
  '\\arccot': '\\operatorname{arccot}',
  '\\arcsec': '\\operatorname{arcsec}',
  '\\arccsc': '\\operatorname{arccsc}',
  '\\R': '\\mathbb{R}',
  '\\N': '\\mathbb{N}',
  '\\Z': '\\mathbb{Z}',
  '\\Q': '\\mathbb{Q}',
  '\\C': '\\mathbb{C}',
  '\\widehat': '\\widehat{#1}',
  '\\overarc': '\\overset{\\frown}{#1}'
};

/**
 * Clean up LaTeX comments such as %[Câu 6], % [2D1-1.1-1], or inline comments
 * while keeping escaped \% intact.
 */
function stripLatexComments(text: string): string {
  if (!text) return '';
  return text
    // Replace TeX comment artifacts like %[Câu 1] or % [Câu 1] at line start or after space
    .replace(/(^|[^\\])%[^\n]*/g, '$1')
    // Remove isolated %[Câu ...] tags even if embedded
    .replace(/%\[[^\]]*\]/g, '')
    .trim();
}

/**
 * Balance unmatched \left[ or \left( or \left\{ by auto-appending \right.
 */
function balanceLeftRightBrackets(code: string): string {
  if (!code) return '';
  const leftMatches = (code.match(/\\left(\[|\(|\{|\.|\|)/g) || []).length;
  const rightMatches = (code.match(/\\right(\]|\)|\}|\.|\|)/g) || []).length;
  
  if (leftMatches > rightMatches) {
    const diff = leftMatches - rightMatches;
    return code + ' \\right.'.repeat(diff);
  }
  return code;
}

/**
 * Convert common markdown and safe HTML formatting to display-ready HTML
 */
function formatTextDecorations(text: string): string {
  if (!text) return '';

  let formatted = text;

  // Blockquotes: > text
  formatted = formatted.replace(
    /(?:^|\n)>\s*([^\n]+)/g,
    '<blockquote class="border-l-3 border-indigo-400 pl-3 py-1 my-1.5 italic bg-indigo-50/50 dark:bg-indigo-950/30 rounded-r text-slate-700 dark:text-slate-300">$1</blockquote>'
  );

  // Bullet items: - text or * text at line start
  formatted = formatted.replace(
    /(?:^|\n)[-*]\s+([^\n]+)/g,
    '<div class="flex items-start gap-2 my-1 pl-2"><span class="text-indigo-500 font-bold leading-relaxed">•</span><span class="flex-1">$1</span></div>'
  );

  // Numbered items: 1. text or 2. text at line start
  formatted = formatted.replace(
    /(?:^|\n)(\d+)\.\s+([^\n]+)/g,
    '<div class="flex items-start gap-2 my-1 pl-2"><span class="font-bold text-slate-700 dark:text-slate-300 min-w-[1.2rem] leading-relaxed">$1.</span><span class="flex-1">$2</span></div>'
  );

  return formatted
    // Normalize remaining newlines to <br/>
    .replace(/\n/g, '<br/>')
    // Bold: **text**
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>')
    // Italic: *text* (excluding already matched bold)
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em class="italic">$1</em>')
    // Highlight: ==text== or <mark>
    .replace(/==(.+?)==/g, '<mark class="bg-amber-200 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200 px-1 py-0.5 rounded font-medium">$1</mark>')
    .replace(/<mark>(.+?)<\/mark>/gi, '<mark class="bg-amber-200 dark:bg-amber-900/60 text-amber-950 dark:text-amber-200 px-1 py-0.5 rounded font-medium">$1</mark>')
    // Underline: <u>text</u> or __text__
    .replace(/__(.+?)__/g, '<u class="underline decoration-slate-400 underline-offset-2">$1</u>')
    .replace(/<u>(.+?)<\/u>/gi, '<u class="underline decoration-slate-400 underline-offset-2">$1</u>');
}

/**
 * Auto-wrap un-delimited LaTeX expressions if user forgot $...$ or uploaded bare LaTeX
 */
function autoWrapLatexFormulas(text: string): string {
  if (!text) return '';
  
  let processed = text;

  // 1. Handle TikZ / PSTricks diagrams gracefully so they don't break rendering
  processed = processed.replace(
    /\\begin\{(tikzpicture|pspicture)\}[\s\S]*?\\end\{\1\}/gi,
    '<div class="my-2.5 p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-center text-xs font-semibold text-indigo-700 dark:text-indigo-300">📐 [Hình vẽ minh họa LaTeX TikZ / Đồ thị]</div>'
  );

  // 2. Transform ex_test custom macros \heva and \hoac
  processed = processed.replace(/\\heva\{([^{}]+)\}/g, '$\\begin{cases} $1 \\end{cases}$');
  processed = processed.replace(/\\hoac\{([^{}]+)\}/g, '$\\left[ \\begin{array}{l} $1 \\end{array} \\right.$');

  // 3. Multi-letter vectors: \vec{SB} -> \overrightarrow{SB}
  processed = processed.replace(/\\vec\{([A-Za-z]{2,})\}/g, '\\overrightarrow{$1}');

  // 4. Wrap math environments if not already enclosed in $ or $$
  processed = processed.replace(
    /(?<!\$)\\begin\{(aligned|cases|matrix|pmatrix|bmatrix|vmatrix|gathered|array)\}([\s\S]*?)\\end\{\1\}(?!\$)/g,
    '$$$$$&$$$$'
  );

  // 5. Wrap \left[ ... \right. or \left( ... \right) if outside math mode
  processed = processed.replace(
    /(?<!\$)\\left\[([\s\S]+?)\\right\.(?!\$)/g,
    '$$$$ \\left[ $1 \\right. $$$$'
  );

  // 6. Explicitly catch all fractions \frac{...}{...}, \dfrac, \tfrac with nested braces in text or lists
  processed = processed.replace(
    /(?<!\$|\\)\\(?:d|t|c)?frac\s*\{((?:[^{}]|\{[^{}]*\})*)\}\s*\{((?:[^{}]|\{[^{}]*\})*)\}(?!\$)/g,
    '$\\frac{$1}{$2}$'
  );

  // 7. Wrap inline LaTeX math commands like \sqrt{...}, \sin, \cos, \alpha, \sum if outside $
  const mathCommandRegex = /(?<!\$|\\)(\\(?:sin|cos|tan|cot|arcsin|arccos|arctan|sqrt|vec|overrightarrow|mathbb|mathcal|lim|int|sum|alpha|beta|gamma|Delta|theta|pi|in|notin|subset|cap|cup|ge|le|ne|pm|infty)(?:\{[^{}]*\}|[a-zA-Z0-9_\^=+\-*/()\[\]\,\.\s\\])*?)(?=(?:[\s.,;:?!]|$|\$|[\u00C0-\u1EF9]))/g;
  
  // Only process if not inside $...$
  const segments = processed.split(/(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$)/g);
  processed = segments.map((seg, i) => {
    // Odd indexes are already delimited math
    if (i % 2 === 1) return seg;

    return seg.replace(mathCommandRegex, (match) => {
      const trimmed = match.trim();
      if (!trimmed || trimmed.length <= 1) return match;
      return `$${trimmed}$`;
    });
  }).join('');

  return processed;
}

export const MathRenderer: React.FC<MathRendererProps> = ({ 
  content = '', 
  className = '', 
  inline = false 
}) => {
  if (!content) return null;

  // Split text into normal text parts and LaTeX parts
  const renderMathContent = (rawText: string) => {
    // 1. Clean comments
    let normalized = stripLatexComments(rawText);

    // 2. Convert standard TeX delimiters \[...\] and \(...\) to $$...$$ and $...$
    normalized = normalized
      .replace(/\\\[([\s\S]+?)\\\]/g, '$$$$$1$$$$')
      .replace(/\\\(([\s\S]+?)\\\)/g, '$$$1$$');

    // 3. Auto-wrap environments and un-delimited math
    normalized = autoWrapLatexFormulas(normalized);

    // 4. Regex matching $$...$$ (display mode) or $...$ (inline mode, supporting multiline math)
    const mathRegex = /(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$)/g;
    const parts = normalized.split(mathRegex);

    return parts.map((part, index) => {
      if (!part) return null;

      // Display math $$...$$
      if (part.startsWith('$$') && part.endsWith('$$')) {
        let mathCode = part.slice(2, -2).trim();
        mathCode = balanceLeftRightBrackets(mathCode);

        try {
          const html = katex.renderToString(mathCode, {
            displayMode: true,
            throwOnError: false,
            strict: false,
            macros: KATEX_MACROS
          });
          return (
            <span
              key={index}
              className="my-2.5 block max-w-full overflow-x-auto py-1 text-center scrollbar-thin select-text text-sm sm:text-base [-webkit-overflow-scrolling:touch]"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <span key={index} className="font-mono text-xs text-rose-600 block py-1 overflow-x-auto">{part}</span>;
        }
      }

      // Inline math $...$
      if (part.startsWith('$') && part.endsWith('$')) {
        let mathCode = part.slice(1, -1).trim();
        mathCode = balanceLeftRightBrackets(mathCode);

        try {
          const html = katex.renderToString(mathCode, {
            displayMode: false,
            throwOnError: false,
            strict: false,
            macros: KATEX_MACROS
          });
          return (
            <span
              key={index}
              className="inline-block max-w-full overflow-x-auto align-middle px-0.5 select-text scrollbar-thin [-webkit-overflow-scrolling:touch]"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <span key={index} className="font-mono text-xs text-rose-600 inline-block overflow-x-auto">{part}</span>;
        }
      }

      // Rich formatted normal text
      const formattedHtml = formatTextDecorations(part);
      return (
        <span 
          key={index} 
          dangerouslySetInnerHTML={{ __html: formattedHtml }}
        />
      );
    });
  };

  return (
    <div className={`leading-relaxed break-words max-w-full overflow-hidden ${className}`}>
      {renderMathContent(content)}
    </div>
  );
};
