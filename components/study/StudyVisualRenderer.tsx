"use client";

import React, { useEffect, useState, useId } from "react";
import { StudyVisualPayload } from "@/types/study";
import { renderStudyInline } from "@/components/study/StudyMarkdown";
import {
  Code2,
  Eye,
  GitBranch,
  Layers,
  Maximize2,
  Minimize2,
  Sparkles,
  Table2,
} from "lucide-react";

interface ErrorBoundaryProps {
  fallbackTitle: string;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class VisualErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("[flo study VisualErrorBoundary] Caught error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="my-3 rounded-xl border border-white/15 bg-black/40 p-4 text-xs text-zinc-300">
          <div className="flex items-center gap-2 font-semibold text-highlight">
            <Layers className="h-4 w-4 text-primary" />
            <span>{this.props.fallbackTitle || "Concept Visual"}</span>
          </div>
          <p className="mt-1 text-white/65">
            Visual diagram simplified to text view due to complex formatting.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Extracts node labels from Mermaid syntax to render a clean visual step flow if Mermaid syntax is malformed.
 */
function parseMermaidFallbackSteps(code: string): string[] {
  const steps: string[] = [];
  const seen = new Set<string>();
  const labelRegex = /\[["']?([^\]"']+)["']?\]|\(["']?([^)"']+)["']?\)/g;
  let m: RegExpExecArray | null;
  while ((m = labelRegex.exec(code)) !== null) {
    const label = (m[1] || m[2] || "").trim();
    if (label && !seen.has(label)) {
      seen.add(label);
      steps.push(label);
    }
  }
  if (steps.length === 0) {
    return code
      .split("\n")
      .map((l) => l.trim())
      .filter(
        (l) =>
          l &&
          !/^(flowchart|graph|sequenceDiagram|stateDiagram|classDiagram|erDiagram|mindmap|timeline)/i.test(
            l
          )
      )
      .slice(0, 6);
  }
  return steps.slice(0, 8);
}

const MermaidDiagramBlock: React.FC<{
  code: string;
  title: string;
}> = ({ code, title }) => {
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [svgHtml, setSvgHtml] = useState<string | null>(null);
  const [renderFailed, setRenderFailed] = useState<boolean>(false);
  const [showSource, setShowSource] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      try {
        const mermaidModule = await import("mermaid");
        const mermaid = mermaidModule.default;

        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "loose",
          suppressErrorRendering: true,
          fontFamily: "var(--font-sans), Inter, sans-serif",
          themeVariables: {
            darkMode: true,
            background: "transparent",
            primaryColor: "#11323b",
            primaryTextColor: "#f8fafc",
            primaryBorderColor: "#38bdf8",
            lineColor: "#94a3b8",
            secondaryColor: "#1e1b4b",
            tertiaryColor: "#0f172a",
          },
        });

        const cleanCode = code
          .trim()
          .replace(/^```(?:mermaid)?\s*/i, "")
          .replace(/```$/i, "")
          .trim();

        const diagramId = `mermaid-${reactId}-${Date.now()}`;
        const { svg } = await mermaid.render(diagramId, cleanCode);

        if (!cancelled) {
          setSvgHtml(svg);
          setRenderFailed(false);
        }
      } catch (err) {
        console.warn("[MermaidDiagramBlock] Fallback triggered:", err);
        if (!cancelled) {
          setRenderFailed(true);
        }
      }
    }

    renderDiagram();
    return () => {
      cancelled = true;
    };
  }, [code, reactId]);

  const fallbackSteps = parseMermaidFallbackSteps(code);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setShowSource((v) => !v)}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-white/65 hover:text-white hover:border-white/25 transition-colors"
        >
          {showSource ? (
            <>
              <Eye className="h-3 w-3 text-primary" />
              <span>Diagram View</span>
            </>
          ) : (
            <>
              <Code2 className="h-3 w-3 text-primary" />
              <span>Mermaid Source</span>
            </>
          )}
        </button>
      </div>

      {showSource ? (
        <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/60 p-3.5 font-mono text-xs text-highlight">
          <code>{code}</code>
        </pre>
      ) : svgHtml && !renderFailed ? (
        <div
          className="flex items-center justify-center overflow-x-auto rounded-xl bg-black/35 p-4 [&_svg]:max-w-full [&_svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      ) : renderFailed ? (
        /* Graceful structured visual flow fallback if Mermaid syntax had an issue */
        <div className="rounded-xl border border-white/10 bg-black/35 p-4">
          <div className="mb-2.5 text-[11px] font-mono uppercase tracking-wider text-white/55">
            Structured Flow Breakdown — {title}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {fallbackSteps.map((step, idx) => (
              <React.Fragment key={idx}>
                <div className="rounded-xl border border-primary/35 bg-primary/10 px-3 py-2 text-xs font-medium text-white shadow-sm">
                  {step}
                </div>
                {idx < fallbackSteps.length - 1 && (
                  <span className="font-mono text-sm font-bold text-primary">
                    →
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center py-8 text-xs text-white/50">
          Rendering interactive diagram...
        </div>
      )}
    </div>
  );
};

const SafeInlineSvgBlock: React.FC<{ svgCode: string; title: string }> = ({
  svgCode,
  title,
}) => {
  const sanitized = React.useMemo(() => {
    if (!svgCode || !svgCode.includes("<svg")) return null;
    // Strip any script tags or inline event handlers for safety
    return svgCode
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/\son\w+="[^"]*"/gi, "")
      .replace(/\son\w+='[^']*'/gi, "");
  }, [svgCode]);

  if (!sanitized) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/35 p-4 text-xs text-white/70">
        Visual diagram: {title}
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center overflow-x-auto rounded-xl bg-black/40 p-4 [&_svg]:max-w-full [&_svg]:max-h-[340px] [&_svg]:w-auto [&_svg]:h-auto"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
};

export const StudyVisualRenderer: React.FC<{
  visual: StudyVisualPayload;
}> = ({ visual }) => {
  const [expanded, setExpanded] = useState(false);

  const badgeMeta = {
    mermaid: { label: "Flowchart / Diagram", icon: GitBranch },
    svg: { label: "Interactive Figure", icon: Sparkles },
    comparison_table: { label: "Comparison Matrix", icon: Table2 },
    visual_cards: { label: "Concept Cards", icon: Layers },
  }[visual.type] || { label: "Visual Aid", icon: Layers };

  const IconComp = badgeMeta.icon;

  return (
    <VisualErrorBoundary fallbackTitle={visual.title}>
      <div
        className={`my-3.5 overflow-hidden rounded-2xl border border-white/15 bg-black/45 shadow-lg transition-all ${
          expanded ? "ring-1 ring-primary/50" : ""
        }`}
      >
        {/* Visual Header */}
        <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-white/[0.04] px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-primary/15 px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-highlight shrink-0">
              <IconComp className="h-3 w-3 text-primary" />
              {badgeMeta.label}
            </span>
            <h5 className="truncate text-xs sm:text-sm font-bold text-white">
              {visual.title}
            </h5>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white transition-colors shrink-0"
            title={expanded ? "Compact view" : "Expand visual"}
          >
            {expanded ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {/* Visual Body */}
        <div className={`p-3.5 sm:p-4 ${expanded ? "sm:p-6" : ""}`}>
          {visual.type === "mermaid" && visual.mermaidCode && (
            <MermaidDiagramBlock
              code={visual.mermaidCode}
              title={visual.title}
            />
          )}

          {visual.type === "svg" && visual.svgCode && (
            <SafeInlineSvgBlock
              svgCode={visual.svgCode}
              title={visual.title}
            />
          )}

          {visual.type === "comparison_table" &&
            visual.tableHeaders &&
            visual.tableRows && (
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/35">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-white/15 bg-white/[0.06]">
                      {visual.tableHeaders.map((header, idx) => (
                        <th
                          key={idx}
                          className="px-3.5 py-2.5 font-semibold text-highlight"
                        >
                          {renderStudyInline(header)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {visual.tableRows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="hover:bg-white/[0.04] transition-colors"
                      >
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className={`px-3.5 py-2.5 leading-relaxed ${
                              cIdx === 0
                                ? "font-semibold text-white"
                                : "text-zinc-200"
                            }`}
                          >
                            {renderStudyInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

          {visual.type === "visual_cards" && visual.cards && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {visual.cards.map((card, idx) => (
                <div
                  key={idx}
                  className="flex flex-col justify-between rounded-xl border border-white/12 bg-white/[0.03] p-3.5"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h6 className="text-xs sm:text-sm font-bold text-white">
                        {renderStudyInline(card.title)}
                      </h6>
                      {card.badge && (
                        <span className="rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[10px] font-mono text-highlight">
                          {card.badge}
                        </span>
                      )}
                    </div>
                    <ul className="space-y-1.5">
                      {card.points.map((pt, pIdx) => (
                        <li
                          key={pIdx}
                          className="flex items-start gap-2 text-xs text-zinc-200 leading-relaxed"
                        >
                          <span
                            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: "var(--primary)" }}
                          />
                          <span>{renderStudyInline(pt)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {card.highlight && (
                    <div className="mt-3 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-highlight">
                      {renderStudyInline(card.highlight)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {visual.caption && (
            <p className="mt-2.5 text-center text-[11px] italic text-white/60">
              {renderStudyInline(visual.caption)}
            </p>
          )}
        </div>
      </div>
    </VisualErrorBoundary>
  );
};
