"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AIProvider,
  DEFAULT_NVIDIA_MODEL,
  JourneyAgentTraceItem,
  JourneyChatMessage,
  NVIDIA_MODEL_OPTIONS,
  WorkspaceConfig,
} from "@/types/taskit";
import {
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Compass,
  Cpu,
  FastForward,
  KeyRound,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";

interface JourneyAgentChatProps {
  messages: JourneyChatMessage[];
  workspaceConfig: WorkspaceConfig;
  hasApiKey: boolean;
  isThinking: boolean;
  isExecutingSequence: boolean;
  thinkingSeconds: number;
  geminiTier: "flash" | "pro";
  onChangeGeminiTier: (tier: "flash" | "pro") => void;
  onUpdateWorkspaceConfig: (updates: Partial<WorkspaceConfig>) => void;
  onSendMessage: (text: string) => void;
  onClearChat: () => void;
  onSkipAnimation: () => void;
  onFocusMilestone: (milestoneId: string) => void;
  onOpenApiKeySetup: () => void;
}

const STARTER_CHIPS = [
  "Map out a 1-year plan to launch my first startup",
  "Build my college & career milestone path for the next 18 months",
  "Create a 6-month fitness & personal mastery journey",
];

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={match.index} className="font-semibold text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={match.index}
          className="rounded bg-white/10 px-1 py-0.5 font-mono text-[11px] text-highlight"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(
        <em key={match.index} className="italic text-white/90">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIdx = match.index + token.length;
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }
  return parts;
}

const CompactMarkdown: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  return (
    <div className="space-y-1.5 text-[13px] leading-relaxed text-white/90">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (/^[-*•]\s+/.test(trimmed)) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-0.5">
              <span
                className="mt-2 h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: "var(--primary)" }}
              />
              <span>
                {renderInlineMarkdown(trimmed.replace(/^[-*•]\s+/, ""))}
              </span>
            </div>
          );
        }
        return <p key={idx}>{renderInlineMarkdown(trimmed)}</p>;
      })}
    </div>
  );
};

const AgentTraceCard: React.FC<{
  trace: JourneyAgentTraceItem[];
  isExecuting: boolean;
  onSkip: () => void;
  onFocusMilestone: (id: string) => void;
}> = ({ trace, isExecuting, onSkip, onFocusMilestone }) => {
  if (!trace || trace.length === 0) return null;

  const doneCount = trace.filter((t) => t.status === "done").length;
  const activeStep = trace.find((t) => t.status === "running");
  const allDone = doneCount === trace.length;

  return (
    <div className="mb-2.5 rounded-xl border border-white/12 bg-black/40 p-2.5 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-white/10">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold">
          {allDone ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
          )}
          <span className={allDone ? "text-emerald-300" : "text-highlight"}>
            {allDone
              ? `Agent sequence complete (${doneCount}/${trace.length})`
              : activeStep
              ? `Executing step ${doneCount + 1} of ${trace.length}...`
              : `Running agent sequence (${doneCount}/${trace.length})`}
          </span>
        </div>

        {isExecuting && !allDone && (
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex items-center gap-1 rounded-md border border-white/12 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/65 hover:text-white hover:bg-white/10 transition-colors"
            title="Apply remaining steps immediately"
          >
            <FastForward className="w-2.5 h-2.5" />
            Instant
          </button>
        )}
      </div>

      <ul className="space-y-1.5">
        {trace.map((step) => {
          const isRunning = step.status === "running";
          const isDone = step.status === "done";
          const clickable = isDone && Boolean(step.milestoneId);

          return (
            <li key={step.id}>
              <div
                onClick={() => {
                  if (clickable && step.milestoneId) {
                    onFocusMilestone(step.milestoneId);
                  }
                }}
                className={`flex items-start gap-2 rounded-lg px-2 py-1 text-[11.5px] transition-all ${
                  isRunning
                    ? "bg-primary/15 border border-primary/40 text-white"
                    : isDone
                    ? `text-white/80 ${
                        clickable
                          ? "hover:bg-white/10 cursor-pointer"
                          : ""
                      }`
                    : "text-white/35"
                }`}
              >
                <span className="mt-0.5 shrink-0">
                  {isDone ? (
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                      <Check className="w-2.5 h-2.5" strokeWidth={3} />
                    </span>
                  ) : isRunning ? (
                    <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                  ) : (
                    <Circle className="w-3 h-3 text-white/25" />
                  )}
                </span>
                <div className="min-w-0 flex-1 leading-snug">
                  <div className="font-medium truncate">{step.label}</div>
                  {step.detail && (
                    <div className="text-[10.5px] text-white/45 truncate">
                      {step.detail}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export const JourneyAgentChat: React.FC<JourneyAgentChatProps> = ({
  messages,
  workspaceConfig,
  hasApiKey,
  isThinking,
  isExecutingSequence,
  thinkingSeconds,
  geminiTier,
  onChangeGeminiTier,
  onUpdateWorkspaceConfig,
  onSendMessage,
  onClearChat,
  onSkipAnimation,
  onFocusMilestone,
  onOpenApiKeySetup,
}) => {
  const [draft, setDraft] = useState("");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);

  const endRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const modelMenuRef = useRef<HTMLDivElement | null>(null);

  const activeProvider: AIProvider = workspaceConfig.aiProvider || "nvidia";
  const activeNvidiaModel =
    NVIDIA_MODEL_OPTIONS.find((m) => m.id === workspaceConfig.nvidiaModel)
      ?.id || DEFAULT_NVIDIA_MODEL;
  const activeModelMeta =
    NVIDIA_MODEL_OPTIONS.find((m) => m.id === activeNvidiaModel) ||
    NVIDIA_MODEL_OPTIONS[0];

  const activeModelLabel =
    activeProvider === "nvidia"
      ? activeModelMeta.shortName
      : geminiTier === "pro"
      ? "Gemini 1.5 Pro"
      : "Gemini 2.0 Flash";

  // Auto-scroll to latest message or trace step
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking, isExecutingSequence]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 130)}px`;
  }, [draft]);

  // Close model dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        modelMenuRef.current &&
        !modelMenuRef.current.contains(e.target as Node)
      ) {
        setModelMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const cleaned = draft.trim();
    if (!cleaned || isThinking || isExecutingSequence) return;
    setDraft("");
    onSendMessage(cleaned);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <aside
      aria-label="Journey Agent Chat"
      className="flex flex-col rounded-2xl border theme-panel backdrop-blur-md overflow-hidden lg:sticky lg:top-[76px] h-[540px] lg:h-[calc(100vh-100px)]"
    >
      {/* Agent Chat Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10 bg-black/25 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/20 border border-primary/40 text-primary shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white leading-tight truncate">
              Journey Agent
            </h2>
            <p className="text-[11px] text-white/50 truncate">
              Builds milestones sequentially
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Model Selector Dropdown */}
          <div className="relative" ref={modelMenuRef}>
            <button
              type="button"
              onClick={() => setModelMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-2 py-1 text-[11px] font-medium text-white/85 transition-colors max-w-[138px]"
              title="Choose AI model for Journey Agent"
            >
              <Cpu className="w-3 h-3 text-primary shrink-0" />
              <span className="truncate">{activeModelLabel}</span>
              <ChevronDown className="w-3 h-3 text-white/50 shrink-0" />
            </button>

            {modelMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-64 rounded-xl border theme-popover p-1.5 shadow-2xl z-50 max-h-72 overflow-y-auto">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/45">
                  NVIDIA NIM Models
                </div>
                {NVIDIA_MODEL_OPTIONS.map((m) => {
                  const selected =
                    activeProvider === "nvidia" && activeNvidiaModel === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        onUpdateWorkspaceConfig({
                          aiProvider: "nvidia",
                          nvidiaModel: m.id,
                        });
                        setModelMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                        selected
                          ? "bg-primary/20 text-highlight font-semibold border border-primary/40"
                          : "text-white/75 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <span className="truncate">{m.shortName}</span>
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-mono text-white/70 shrink-0">
                        {m.badge}
                      </span>
                    </button>
                  );
                })}
                <div className="my-1 border-t border-white/10" />
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/45">
                  Google Gemini
                </div>
                {(["flash", "pro"] as const).map((tier) => {
                  const selected =
                    activeProvider === "gemini" && geminiTier === tier;
                  return (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => {
                        onUpdateWorkspaceConfig({ aiProvider: "gemini" });
                        onChangeGeminiTier(tier);
                        setModelMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                        selected
                          ? "bg-primary/20 text-highlight font-semibold border border-primary/40"
                          : "text-white/75 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <span>
                        {tier === "pro" ? "Gemini 1.5 Pro" : "Gemini 2.0 Flash"}
                      </span>
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-mono text-white/70">
                        {tier === "pro" ? "Deep" : "Fast"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={onClearChat}
              disabled={isThinking || isExecutingSequence}
              title="Clear chat history"
              className="rounded-lg p-1.5 text-white/45 hover:text-white hover:bg-white/10 disabled:opacity-35 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Chat Messages Stream */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3.5 space-y-3.5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-3 py-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/35 bg-primary/10 text-primary mb-3">
              <Compass className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-white mb-1">
              Tell me what you want to achieve
            </p>
            <p className="text-xs text-white/55 leading-relaxed max-w-[260px] mb-5">
              Give me your big goals, target dates, or rough ideas — I&apos;ll map
              each milestone onto your journey sequentially.
            </p>
            <div className="w-full space-y-1.5">
              {STARTER_CHIPS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={!hasApiKey}
                  onClick={() => onSendMessage(prompt)}
                  className="w-full text-left rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.09] hover:border-primary/40 px-3 py-2 text-xs text-white/80 hover:text-white transition-all disabled:opacity-45"
                >
                  &ldquo;{prompt}&rdquo;
                </button>
              ))}
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex flex-col ${
                    isUser ? "items-end" : "items-start"
                  }`}
                >
                  {isUser ? (
                    <div className="max-w-[88%] rounded-2xl rounded-br-sm border border-primary/40 bg-primary/20 px-3.5 py-2 text-[13px] text-white leading-relaxed shadow-sm">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="w-full rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
                      {msg.trace && msg.trace.length > 0 && (
                        <AgentTraceCard
                          trace={msg.trace}
                          isExecuting={isExecutingSequence}
                          onSkip={onSkipAnimation}
                          onFocusMilestone={onFocusMilestone}
                        />
                      )}
                      {msg.content && <CompactMarkdown content={msg.content} />}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {/* Thinking State Bubble */}
        {isThinking && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-xs text-highlight"
          >
            <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">
                Planning milestone sequence...
              </div>
              <div className="text-[10.5px] text-white/55 font-mono">
                {activeModelLabel} · {thinkingSeconds}s
              </div>
            </div>
          </motion.div>
        )}

        <div ref={endRef} />
      </div>

      {/* API Key Missing Banner OR Composer */}
      <div className="p-3 border-t border-white/10 bg-black/25 shrink-0">
        {!hasApiKey ? (
          <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 p-3 text-center space-y-2">
            <p className="text-xs text-amber-100/90 leading-snug">
              Connect an AI API key to build milestones with the Journey Agent —
              or set milestones manually on the left anytime.
            </p>
            <button
              type="button"
              onClick={onOpenApiKeySetup}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-zinc-950 hover:opacity-90 transition-opacity"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Connect API Key
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="relative">
            <textarea
              ref={textareaRef}
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isThinking || isExecutingSequence}
              placeholder={
                isExecutingSequence
                  ? "Agent is adding milestones sequentially..."
                  : "Ask agent to add, edit, or map milestones..."
              }
              className="w-full rounded-xl border theme-input pl-3.5 pr-11 py-2.5 text-[13px] placeholder:text-white/35 focus:outline-none resize-none leading-snug disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!draft.trim() || isThinking || isExecutingSequence}
              aria-label="Send to Journey Agent"
              className="absolute right-2 bottom-2 flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-zinc-950 hover:opacity-90 disabled:opacity-30 transition-all"
            >
              {isThinking || isExecutingSequence ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
              )}
            </button>
          </form>
        )}
      </div>
    </aside>
  );
};
