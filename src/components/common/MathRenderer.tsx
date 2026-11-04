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
  '\\C': '\\mathbb{C}'
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

  return text
    // Normalize newlines to <br/>
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
 * Auto-wrap un-delimited LaTeX expressions if user forgot $...$
 */
function autoWrapLatexFormulas(text: string): string {
  if (!text) return '';
  
  // Wrap known environments
  let processed = text.replace(
    /(?<!\$)\\begin\{(aligned|cases|matrix|pmatrix|bmatrix|vmatrix|gathered|array)\}([\s\S]*?)\\end\{\1\}(?!\$)/g,
    '$$$$$&$$$$'
  );

  // If text doesn't contain $ at all, but contains typical math commands
  if (!processed.includes('$') && /\\(dfrac|tfrac|frac|sqrt|vec|mathbb|sin|cos|tan|cot|lim|int|sum|alpha|beta|gamma|theta|pi|partial|subset|in)\b/.test(processed)) {
    // If the entire string is basically a formula, wrap it in $...$
    if (/^[\s\\a-zA-Z0-9_\^\{\}\+\-\*\/\=\(\)\[\]\,\.\<\>\;\:\!]+$/.test(processed)) {
      return `$${processed.trim()}$`;
    }
  }

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
              className="my-2.5 block overflow-x-auto py-1 text-center scrollbar-thin select-text"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <span key={index} className="font-mono text-xs text-rose-600 block py-1">{part}</span>;
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
              className="inline-block px-0.5 align-middle select-text"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <span key={index} className="font-mono text-xs text-rose-600">{part}</span>;
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
    <div className={`leading-relaxed break-words ${className}`}>
      {renderMathContent(content)}
    </div>
  );
};
