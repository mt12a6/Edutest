import React from 'react';
import katex from 'katex';

interface MathRendererProps {
  content: string;
  className?: string;
  inline?: boolean;
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
    // Avoid matching single currency signs like $100 by ensuring closing delimiter
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

      // Plain text with line breaks
      return (
        <span key={index} className="whitespace-pre-line">
          {part}
        </span>
      );
    });
  };

  return (
    <div className={`leading-relaxed ${className}`}>
      {renderMathContent(content)}
    </div>
  );
};
