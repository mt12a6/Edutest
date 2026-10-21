import React from 'react';
import katex from 'katex';

interface MathRendererProps {
  content: string;
  className?: string;
  inline?: boolean;
}

// Convert common markdown and safe HTML formatting to display-ready HTML
function formatTextDecorations(text: string): string {
  if (!text) return '';

  let formatted = text
    // Normalize newlines to <br/>
    .replace(/\n/g, '<br/>')
    // Bold: **text**
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>')
    // Italic: *text* (excluding already matched bold)
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em class="italic">$1</em>')
    // Highlight: ==text== or <mark>
    .replace(/==(.+?)==/g, '<mark class="bg-amber-200 text-amber-950 px-1 py-0.5 rounded font-medium">$1</mark>')
    .replace(/<mark>(.+?)<\/mark>/gi, '<mark class="bg-amber-200 text-amber-950 px-1 py-0.5 rounded font-medium">$1</mark>')
    // Underline: <u>text</u> or __text__
    .replace(/__(.+?)__/g, '<u class="underline decoration-slate-400 underline-offset-2">$1</u>')
    .replace(/<u>(.+?)<\/u>/gi, '<u class="underline decoration-slate-400 underline-offset-2">$1</u>');

  return formatted;
}

export const MathRenderer: React.FC<MathRendererProps> = ({ 
  content = '', 
  className = '', 
  inline = false 
}) => {
  if (!content) return null;

  // Split text into normal text parts and LaTeX parts ($...$ or $$...$$)
  const renderMathContent = (rawText: string) => {
    // Regex matches $$...$$ (display mode) or $...$ (inline mode)
    const mathRegex = /(\$\$[\s\S]+?\$\$|\$[^\$\n]+?\$)/g;
    const parts = rawText.split(mathRegex);

    return parts.map((part, index) => {
      if (!part) return null;

      // Display math $$...$$
      if (part.startsWith('$$') && part.endsWith('$$')) {
        const mathCode = part.slice(2, -2).trim();
        try {
          const html = katex.renderToString(mathCode, {
            displayMode: true,
            throwOnError: false
          });
          return (
            <span
              key={index}
              className="my-2 block overflow-x-auto py-1"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <span key={index} className="font-mono text-xs">{part}</span>;
        }
      }

      // Inline math $...$
      if (part.startsWith('$') && part.endsWith('$')) {
        const mathCode = part.slice(1, -1).trim();
        try {
          const html = katex.renderToString(mathCode, {
            displayMode: false,
            throwOnError: false
          });
          return (
            <span
              key={index}
              className="inline-block px-0.5"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <span key={index} className="font-mono text-xs">{part}</span>;
        }
      }

      // Rich formatted text (bold, italic, colors, underlines, highlights)
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
    <div className={`leading-relaxed ${className}`}>
      {renderMathContent(content)}
    </div>
  );
};
