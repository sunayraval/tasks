"use client";

import React from "react";
import katex from "katex";

interface StudyMarkdownProps {
  content: string;
  className?: string;
}

function renderLatexToHtml(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex.trim(), {
      displayMode,
      throwOnError: false,
      strict: false,
    });
  } catch {
    return latex;
  }
}

/**
 * Renders inline formatting:
 * - $$...$$ or \[...\] block math inside inline lines
 * - $...$ or \(...\) inline math
 * - **bold**
 * - *italic*
 * - `code`
 */
export function renderStudyInline(text: string): React.ReactNode[] {
  if (!text) return [];
  const parts: React.ReactNode[] = [];
  // Match $$...$$, $...$, \(...\), **...**, `...`, *...*
  const tokenRegex =
    /(\$\$[^$]+\$\$|\$[^$\n]+\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]|\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];

    if (
      (token.startsWith("$$") && token.endsWith("$$")) ||
      (token.startsWith("\\[") && token.endsWith("\\]"))
    ) {
      const expr = token.slice(2, -2);
      const html = renderLatexToHtml(expr, true);
      parts.push(
        <span
          key={`bmath-${match.index}`}
          className="my-2 block overflow-x-auto rounded-lg bg-black/35 px-3 py-2 text-center text-highlight"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    } else if (
      (token.startsWith("$") && token.endsWith("$")) ||
      (token.startsWith("\\(") && token.endsWith("\\)"))
    ) {
      const expr = token.startsWith("$")
        ? token.slice(1, -1)
        : token.slice(2, -2);
      const html = renderLatexToHtml(expr, false);
      parts.push(
        <span
          key={`imath-${match.index}`}
          className="inline-block px-0.5 text-highlight"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    } else if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong
          key={`bold-${match.index}`}
          className="font-semibold text-white"
        >
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={`code-${match.index}`}
          className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[12px] text-highlight border border-white/10"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(
        <em key={`em-${match.index}`} className="italic text-zinc-200">
          {token.slice(1, -1)}
        </em>
      );
    } else {
      parts.push(token);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export const StudyMarkdown: React.FC<StudyMarkdownProps> = ({
  content,
  className = "",
}) => {
  const lines = (content || "").split("\n");
  const blocks: React.ReactNode[] = [];
  let idx = 0;

  while (idx < lines.length) {
    const line = lines[idx];
    const trimmed = line.trim();

    if (!trimmed) {
      idx++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(
        <hr key={`hr-${idx}`} className="my-3 border-t border-white/10" />
      );
      idx++;
      continue;
    }

    // Multi-line $$ block math
    if (trimmed.startsWith("$$") && !trimmed.slice(2).includes("$$")) {
      const mathLines: string[] = [trimmed.slice(2)];
      idx++;
      while (idx < lines.length && !lines[idx].trim().includes("$$")) {
        mathLines.push(lines[idx]);
        idx++;
      }
      if (idx < lines.length) {
        mathLines.push(lines[idx].trim().replace(/\$\$$/, ""));
        idx++;
      }
      const html = renderLatexToHtml(mathLines.join("\n"), true);
      blocks.push(
        <div
          key={`mathblock-${idx}`}
          className="my-3 overflow-x-auto rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-center text-highlight"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
      continue;
    }

    // Single-line $$...$$ block math
    if (
      trimmed.startsWith("$$") &&
      trimmed.endsWith("$$") &&
      trimmed.length > 4
    ) {
      const html = renderLatexToHtml(trimmed.slice(2, -2), true);
      blocks.push(
        <div
          key={`mathsingle-${idx}`}
          className="my-3 overflow-x-auto rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-center text-highlight"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
      idx++;
      continue;
    }

    // Code block
    if (trimmed.startsWith("```")) {
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      idx++;
      while (idx < lines.length && !lines[idx].trim().startsWith("```")) {
        codeLines.push(lines[idx]);
        idx++;
      }
      idx++; // skip closing ```
      blocks.push(
        <div
          key={`code-${idx}`}
          className="my-3 overflow-hidden rounded-xl border border-white/10 bg-black/55"
        >
          {lang && (
            <div className="border-b border-white/10 bg-white/5 px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-white/60">
              {lang}
            </div>
          )}
          <pre className="overflow-x-auto p-3.5 font-mono text-xs text-highlight leading-relaxed">
            <code>{codeLines.join("\n")}</code>
          </pre>
        </div>
      );
      continue;
    }

    // Markdown Table
    if (
      trimmed.startsWith("|") &&
      idx + 1 < lines.length &&
      lines[idx + 1].trim().startsWith("|") &&
      lines[idx + 1].includes("---")
    ) {
      const parseRow = (r: string) =>
        r
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim());

      const headers = parseRow(trimmed);
      idx += 2; // skip header + separator
      const rows: string[][] = [];
      while (idx < lines.length && lines[idx].trim().startsWith("|")) {
        rows.push(parseRow(lines[idx]));
        idx++;
      }

      blocks.push(
        <div
          key={`table-${idx}`}
          className="my-3 overflow-x-auto rounded-xl border border-white/15 bg-black/35"
        >
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/15 bg-white/5">
                {headers.map((h, hIdx) => (
                  <th
                    key={hIdx}
                    className="px-3.5 py-2.5 font-semibold text-highlight"
                  >
                    {renderStudyInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-white/5 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3.5 py-2 text-zinc-200">
                      {renderStudyInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Headings
    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h4
          key={`h3-${idx}`}
          className="mt-3.5 mb-1.5 text-sm font-bold text-white tracking-tight"
        >
          {renderStudyInline(trimmed.slice(4))}
        </h4>
      );
      idx++;
      continue;
    }

    if (trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
      const headingText = trimmed.replace(/^#{1,2}\s+/, "");
      blocks.push(
        <h3
          key={`h2-${idx}`}
          className="mt-4 mb-2 text-base font-bold text-highlight tracking-tight"
        >
          {renderStudyInline(headingText)}
        </h3>
      );
      idx++;
      continue;
    }

    // Blockquote / Callout
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (idx < lines.length && lines[idx].trim().startsWith(">")) {
        quoteLines.push(lines[idx].trim().replace(/^>\s?/, ""));
        idx++;
      }
      blocks.push(
        <blockquote
          key={`quote-${idx}`}
          className="my-2.5 rounded-r-xl border-l-2 border-primary bg-primary/10 px-3.5 py-2.5 text-xs sm:text-sm text-zinc-200 leading-relaxed"
        >
          {renderStudyInline(quoteLines.join(" "))}
        </blockquote>
      );
      continue;
    }

    // Unordered list
    if (/^[-*•]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (idx < lines.length && /^[-*•]\s+/.test(lines[idx].trim())) {
        items.push(lines[idx].trim().replace(/^[-*•]\s+/, ""));
        idx++;
      }
      blocks.push(
        <ul key={`ul-${idx}`} className="my-2 space-y-1.5 pl-1">
          {items.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-xs sm:text-sm leading-relaxed text-zinc-200"
            >
              <span
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: "var(--primary)" }}
              />
              <span className="flex-1">{renderStudyInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: Array<{ num: string; text: string }> = [];
      while (idx < lines.length && /^\d+[.)]\s+/.test(lines[idx].trim())) {
        const lineTrim = lines[idx].trim();
        const m = /^(\d+)[.)]\s+(.*)$/.exec(lineTrim);
        if (m) {
          items.push({ num: m[1], text: m[2] });
        }
        idx++;
      }
      blocks.push(
        <ol key={`ol-${idx}`} className="my-2 space-y-1.5 pl-1">
          {items.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-xs sm:text-sm leading-relaxed text-zinc-200"
            >
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/10 font-mono text-[11px] font-bold text-highlight">
                {item.num}
              </span>
              <span className="flex-1">{renderStudyInline(item.text)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Standard Paragraph
    blocks.push(
      <p
        key={`p-${idx}`}
        className="my-2 text-xs sm:text-sm leading-relaxed text-zinc-200"
      >
        {renderStudyInline(trimmed)}
      </p>
    );
    idx++;
  }

  return <div className={`space-y-1 ${className}`}>{blocks}</div>;
};
