"use client";

import React from "react";
import katex from "katex";
import { Card, Separator, Text, Title } from "@/components/tailus-ui";

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
          className="my-2 block overflow-x-auto rounded-[--card-radius] border border-[--ui-border-color] bg-[--ui-soft-bg] px-3 py-2 text-center text-primary-300"
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
          className="inline-block px-0.5 text-primary-300"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    } else if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong
          key={`bold-${match.index}`}
          className="font-semibold text-title"
        >
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={`code-${match.index}`}
          className="rounded-md bg-[--ui-soft-bg] px-1.5 py-0.5 font-mono text-[12px] text-primary-300 border border-[--ui-border-color]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(
        <em key={`em-${match.index}`} className="italic text-body">
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
        <Separator key={`hr-${idx}`} className="my-3" />
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
        <Card
          key={`mathblock-${idx}`}
          variant="soft"
          className="my-3 overflow-x-auto px-4 py-3 text-center text-primary-300"
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
        <Card
          key={`mathsingle-${idx}`}
          variant="soft"
          className="my-3 overflow-x-auto px-4 py-3 text-center text-primary-300"
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
        <Card
          key={`code-${idx}`}
          variant="outlined"
          className="my-3 overflow-hidden p-0"
        >
          {lang && (
            <div className="border-b border-[--ui-border-color] bg-[--ui-soft-bg] px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-caption">
              {lang}
            </div>
          )}
          <pre className="overflow-x-auto p-3.5 font-mono text-xs text-primary-300 leading-relaxed">
            <code>{codeLines.join("\n")}</code>
          </pre>
        </Card>
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
        <Card
          key={`table-${idx}`}
          variant="outlined"
          className="my-3 overflow-x-auto p-0"
        >
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[--ui-border-color] bg-[--ui-soft-bg]">
                {headers.map((h, hIdx) => (
                  <th
                    key={hIdx}
                    className="px-3.5 py-2.5 font-semibold text-primary-300"
                  >
                    {renderStudyInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[--ui-border-color]">
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-[--ui-soft-bg] transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3.5 py-2 text-body">
                      {renderStudyInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      );
      continue;
    }

    // Headings
    if (trimmed.startsWith("### ")) {
      blocks.push(
        <Title
          key={`h3-${idx}`}
          as="h4"
          size="base"
          weight="bold"
          className="mt-3.5 mb-1.5 text-sm tracking-tight"
        >
          {renderStudyInline(trimmed.slice(4))}
        </Title>
      );
      idx++;
      continue;
    }

    if (trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
      const headingText = trimmed.replace(/^#{1,2}\s+/, "");
      blocks.push(
        <Title
          key={`h2-${idx}`}
          as="h3"
          size="base"
          weight="bold"
          className="mt-4 mb-2 text-primary-300 tracking-tight"
        >
          {renderStudyInline(headingText)}
        </Title>
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
          className="my-2.5 rounded-r-[--card-radius] border-l-2 border-primary-500 bg-primary-500/10 px-3.5 py-2.5 text-xs sm:text-sm text-body leading-relaxed"
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
              className="flex items-start gap-2.5 text-xs sm:text-sm leading-relaxed text-body"
            >
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400" />
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
              className="flex items-start gap-2.5 text-xs sm:text-sm leading-relaxed text-body"
            >
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[--ui-soft-bg] border border-[--ui-border-color] font-mono text-[11px] font-bold text-primary-300">
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
      <Text
        key={`p-${idx}`}
        size="sm"
        className="my-2 text-xs sm:text-sm leading-relaxed text-body"
      >
        {renderStudyInline(trimmed)}
      </Text>
    );
    idx++;
  }

  return <div className={`space-y-1 ${className}`}>{blocks}</div>;
};
