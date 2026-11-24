"use client";

import React, { useEffect, useState, useId } from "react";
import { StudyVisualPayload } from "@/types/study";
import { renderStudyInline } from "@/components/study/StudyMarkdown";
import {
  Card,
  Badge,
  Button,
  Caption,
  Text,
} from "@/components/tailus-ui";
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
        <Card variant="outlined" className="my-3 p-4 text-xs text-body">
          <div className="flex items-center gap-2 font-semibold text-primary-300">
            <Layers className="h-4 w-4 text-primary-400" />
            <span>{this.props.fallbackTitle || "Concept Visual"}</span>
          </div>
          <Caption className="mt-1">
            Visual diagram simplified to text view due to complex formatting.
          </Caption>
        </Card>
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
        <Button.Root
          type="button"
          variant="soft"
          intent="gray"
          size="xs"
          onClick={() => setShowSource((v) => !v)}
        >
          <Button.Icon type="leading">
            {showSource ? (
              <Eye className="h-3 w-3 text-primary-400" />
            ) : (
              <Code2 className="h-3 w-3 text-primary-400" />
            )}
          </Button.Icon>
          <Button.Label>
            {showSource ? "Diagram View" : "Mermaid Source"}
          </Button.Label>
        </Button.Root>
      </div>

      {showSource ? (
        <pre className="overflow-x-auto rounded-[--card-radius] border border-[--ui-border-color] bg-[--ui-bg] p-3.5 font-mono text-xs text-primary-300">
          <code>{code}</code>
        </pre>
      ) : svgHtml && !renderFailed ? (
        <div
          className="flex items-center justify-center overflow-x-auto rounded-[--card-radius] bg-[--ui-soft-bg] border border-[--ui-border-color] p-4 [&_svg]:max-w-full [&_svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: svgHtml }}
        />
      ) : renderFailed ? (
        /* Graceful structured visual flow fallback if Mermaid syntax had an issue */
        <div className="rounded-[--card-radius] border border-[--ui-border-color] bg-[--ui-soft-bg] p-4">
          <div className="mb-2.5 text-[11px] font-mono uppercase tracking-wider text-caption">
            Structured Flow Breakdown — {title}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {fallbackSteps.map((step, idx) => (
              <React.Fragment key={idx}>
                <Card
                  variant="outlined"
                  className="px-3 py-2 text-xs font-medium text-title border-primary-500/35 bg-primary-500/10"
                >
                  {step}
                </Card>
                {idx < fallbackSteps.length - 1 && (
                  <span className="font-mono text-sm font-bold text-primary-400">
                    →
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      ) : (
        <Caption className="flex items-center justify-center py-8">
          Rendering interactive diagram...
        </Caption>
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
      <div className="rounded-[--card-radius] border border-[--ui-border-color] bg-[--ui-soft-bg] p-4 text-xs text-caption">
        Visual diagram: {title}
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-center overflow-x-auto rounded-[--card-radius] bg-[--ui-soft-bg] border border-[--ui-border-color] p-4 [&_svg]:max-w-full [&_svg]:max-h-[340px] [&_svg]:w-auto [&_svg]:h-auto"
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
      <Card
        variant="mixed"
        className={`my-3.5 overflow-hidden p-0 transition-all ${
          expanded ? "ring-1 ring-primary-500/50" : ""
        }`}
      >
        {/* Visual Header */}
        <div className="flex items-center justify-between gap-2 border-b border-[--ui-border-color] bg-[--ui-soft-bg] px-4 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Badge
              variant="soft"
              intent="primary"
              size="xs"
              className="gap-1.5 font-mono uppercase tracking-wider shrink-0"
            >
              <IconComp className="h-3 w-3" />
              {badgeMeta.label}
            </Badge>
            <h5 className="truncate text-xs sm:text-sm font-bold text-title">
              {visual.title}
            </h5>
          </div>
          <Button.Root
            type="button"
            variant="ghost"
            intent="gray"
            size="xs"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? "Compact view" : "Expand visual"}
          >
            <Button.Icon type="only">
              {expanded ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </Button.Icon>
          </Button.Root>
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
              <div className="overflow-x-auto rounded-[--card-radius] border border-[--ui-border-color] bg-[--ui-bg]">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[--ui-border-color] bg-[--ui-soft-bg]">
                      {visual.tableHeaders.map((header, idx) => (
                        <th
                          key={idx}
                          className="px-3.5 py-2.5 font-semibold text-primary-300"
                        >
                          {renderStudyInline(header)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[--ui-border-color]">
                    {visual.tableRows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="hover:bg-[--ui-soft-bg] transition-colors"
                      >
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className={`px-3.5 py-2.5 leading-relaxed ${
                              cIdx === 0
                                ? "font-semibold text-title"
                                : "text-body"
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
                <Card
                  key={idx}
                  variant="soft"
                  className="flex flex-col justify-between p-3.5"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h6 className="text-xs sm:text-sm font-bold text-title">
                        {renderStudyInline(card.title)}
                      </h6>
                      {card.badge && (
                        <Badge
                          variant="soft"
                          intent="primary"
                          size="xs"
                          className="font-mono"
                        >
                          {card.badge}
                        </Badge>
                      )}
                    </div>
                    <ul className="space-y-1.5">
                      {card.points.map((pt, pIdx) => (
                        <li
                          key={pIdx}
                          className="flex items-start gap-2 text-xs text-body leading-relaxed"
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-400" />
                          <span>{renderStudyInline(pt)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {card.highlight && (
                    <div className="mt-3 rounded-[--badge-radius] border border-primary-500/25 bg-primary-500/10 px-2.5 py-1.5 text-[11px] font-medium text-primary-300">
                      {renderStudyInline(card.highlight)}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}

          {visual.caption && (
            <Caption className="mt-2.5 text-center italic block">
              {renderStudyInline(visual.caption)}
            </Caption>
          )}
        </div>
      </Card>
    </VisualErrorBoundary>
  );
};
