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
import { Badge, Button, Card, Text, Title } from "@/components/tailus-ui";

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
    <Card variant="soft" className="mb-2.5 border border-[--ui-border-color] p-2.5 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[--ui-border-color]">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold">
          {allDone ? (
            <CheckCircle2 className="size-3.5 text-success-400 shrink-0" />
          ) : (
            <Loader2 className="size-3.5 text-primary-400 animate-spin shrink-0" />
          )}
          <span className={allDone ? "text-success-300" : "text-primary-300"}>
            {allDone
              ? `Agent sequence complete (${doneCount}/${trace.length})`
              : activeStep
              ? `Executing step ${doneCount + 1} of ${trace.length}...`
              : `Running agent sequence (${doneCount}/${trace.length})`}
          </span>
        </div>

        {isExecuting && !allDone && (
          <Button.Root
            variant="outlined"
            intent="gray"
            size="xs"
            onClick={onSkip}
            className="h-5 px-1.5 text-[10px]"
            title="Apply remaining steps immediately"
          >
            <Button.Icon type="leading" size="xs">
              <FastForward />
            </Button.Icon>
            <Button.Label>Instant</Button.Label>
          </Button.Root>
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
                className={`flex items-start gap-2 rounded-[--btn-radius] px-2 py-1 text-[11.5px] transition-all ${
                  isRunning
                    ? "bg-primary-500/15 border border-primary-500/40 text-title"
                    : isDone
                    ? `text-body ${
                        clickable
                          ? "hover:bg-[--ui-bg] cursor-pointer"
                          : ""
                      }`
                    : "text-caption/60"
                }`}
              >
                <span className="mt-0.5 shrink-0">
                  {isDone ? (
                    <span className="flex size-3.5 items-center justify-center rounded-full bg-success-500/20 text-success-400">
                      <Check className="size-2.5" strokeWidth={3} />
                    </span>
                  ) : isRunning ? (
                    <Loader2 className="size-3.5 text-primary-400 animate-spin" />
                  ) : (
                    <Circle className="size-3 text-gray-600" />
                  )}
                </span>
                <div className="min-w-0 flex-1 leading-snug">
                  <div className="font-medium truncate">{step.label}</div>
                  {step.detail && (
                    <div className="text-[10.5px] text-caption truncate">
                      {step.detail}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
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
    <Card
      variant="mixed"
      fancy
      aria-label="Journey Agent Chat"
      className="p-0 flex flex-col backdrop-blur-md overflow-hidden lg:sticky lg:top-[76px] h-[540px] lg:h-[calc(100vh-100px)]"
    >
      {/* Agent Chat Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[--ui-border-color] bg-[--ui-soft-bg]/60 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-[--btn-radius] bg-primary-500/15 border border-primary-500/35 text-primary-400">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0">
            <Title as="h2" size="base" weight="semibold" className="text-sm leading-tight truncate">
              Journey Agent
            </Title>
            <p className="text-[11px] text-caption truncate">
              Builds milestones sequentially
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Model Selector Dropdown */}
          <div className="relative" ref={modelMenuRef}>
            <Button.Root
              variant="outlined"
              intent="gray"
              size="xs"
              onClick={() => setModelMenuOpen((v) => !v)}
              className="h-7 px-2 gap-1 text-[11px] max-w-[144px]"
              title="Choose AI model for Journey Agent"
            >
              <Button.Icon type="leading" size="xs">
                <Cpu className="text-primary-400" />
              </Button.Icon>
              <Button.Label className="truncate">{activeModelLabel}</Button.Label>
              <Button.Icon type="trailing" size="xs">
                <ChevronDown className="text-caption" />
              </Button.Icon>
            </Button.Root>

            {modelMenuOpen && (
              <Card
                variant="elevated"
                fancy
                className="absolute right-0 mt-1.5 w-64 p-1.5 shadow-2xl z-50 max-h-72 overflow-y-auto backdrop-blur-2xl"
              >
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-caption">
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
                      className={`w-full flex items-center justify-between gap-2 rounded-[--btn-radius] px-2 py-1.5 text-left text-xs transition-colors ${
                        selected
                          ? "bg-primary-500/15 text-primary-300 font-semibold"
                          : "text-body hover:text-title hover:bg-[--ui-soft-bg]"
                      }`}
                    >
                      <span className="truncate">{m.shortName}</span>
                      <Badge variant="soft" intent="gray" size="xs" className="font-mono shrink-0">
                        {m.badge}
                      </Badge>
                    </button>
                  );
                })}
                <div className="my-1 border-t border-[--ui-border-color]" />
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-caption">
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
                      className={`w-full flex items-center justify-between gap-2 rounded-[--btn-radius] px-2 py-1.5 text-left text-xs transition-colors ${
                        selected
                          ? "bg-primary-500/15 text-primary-300 font-semibold"
                          : "text-body hover:text-title hover:bg-[--ui-soft-bg]"
                      }`}
                    >
                      <span>
                        {tier === "pro" ? "Gemini 1.5 Pro" : "Gemini 2.0 Flash"}
                      </span>
                      <Badge variant="soft" intent="gray" size="xs" className="font-mono">
                        {tier === "pro" ? "Deep" : "Fast"}
                      </Badge>
                    </button>
                  );
                })}
              </Card>
            )}
          </div>

          {messages.length > 0 && (
            <Button.Root
              variant="ghost"
              intent="gray"
              size="xs"
              onClick={onClearChat}
              disabled={isThinking || isExecutingSequence}
              title="Clear chat history"
            >
              <Button.Icon type="only" size="xs">
                <RotateCcw />
              </Button.Icon>
            </Button.Root>
          )}
        </div>
      </div>

      {/* Chat Messages Stream */}
      <div className="flex-1 overflow-y-auto px-3.5 py-3.5 space-y-3.5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-3 py-6">
            <div className="flex size-11 items-center justify-center rounded-[--card-radius] border border-primary-500/35 bg-primary-500/15 text-primary-400 mb-3">
              <Compass className="size-5" />
            </div>
            <Title as="div" size="base" weight="semibold" className="text-sm mb-1">
              Tell me what you want to achieve
            </Title>
            <Text size="sm" align="center" className="text-caption leading-relaxed max-w-[260px] mb-5">
              Give me your big goals, target dates, or rough ideas — I&apos;ll map
              each milestone onto your journey sequentially.
            </Text>
            <div className="w-full space-y-1.5">
              {STARTER_CHIPS.map((prompt) => (
                <Button.Root
                  key={prompt}
                  variant="outlined"
                  intent="gray"
                  size="sm"
                  disabled={!hasApiKey}
                  onClick={() => onSendMessage(prompt)}
                  className="w-full h-auto justify-start text-left py-2 px-3 text-xs font-normal whitespace-normal"
                >
                  <Button.Label>&ldquo;{prompt}&rdquo;</Button.Label>
                </Button.Root>
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
                    <Card
                      variant="soft"
                      className="max-w-[88%] rounded-2xl rounded-br-sm border border-primary-500/35 bg-primary-500/15 px-3.5 py-2 text-[13px] text-title leading-relaxed"
                    >
                      {msg.content}
                    </Card>
                  ) : (
                    <Card
                      variant="soft"
                      className="w-full rounded-2xl rounded-bl-sm border border-[--ui-border-color] px-3.5 py-2.5"
                    >
                      {msg.trace && msg.trace.length > 0 && (
                        <AgentTraceCard
                          trace={msg.trace}
                          isExecuting={isExecutingSequence}
                          onSkip={onSkipAnimation}
                          onFocusMilestone={onFocusMilestone}
                        />
                      )}
                      {msg.content && <CompactMarkdown content={msg.content} />}
                    </Card>
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
            className="flex items-center gap-2.5 rounded-[--btn-radius] border border-primary-500/30 bg-primary-500/10 px-3 py-2.5 text-xs text-primary-300"
          >
            <Loader2 className="size-3.5 text-primary-400 animate-spin shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">
                Planning milestone sequence...
              </div>
              <div className="text-[10.5px] text-caption font-mono">
                {activeModelLabel} · {thinkingSeconds}s
              </div>
            </div>
          </motion.div>
        )}

        <div ref={endRef} />
      </div>

      {/* API Key Missing Banner OR Composer */}
      <div className="p-3 border-t border-[--ui-border-color] bg-[--ui-soft-bg]/50 shrink-0">
        {!hasApiKey ? (
          <Card
            variant="outlined"
            className="border-warning-500/35 bg-warning-500/10 p-3 text-center space-y-2"
          >
            <p className="text-xs text-warning-200 leading-snug">
              Connect an AI API key to build milestones with the Journey Agent —
              or set milestones manually on the left anytime.
            </p>
            <Button.Root
              variant="solid"
              intent="primary"
              size="xs"
              onClick={onOpenApiKeySetup}
              className="font-semibold"
            >
              <Button.Icon type="leading" size="xs">
                <KeyRound />
              </Button.Icon>
              <Button.Label>Connect API Key</Button.Label>
            </Button.Root>
          </Card>
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
              className="w-full rounded-[--btn-radius] border border-[--ui-border-color] bg-[--ui-bg] pl-3.5 pr-11 py-2.5 text-[13px] text-title placeholder:text-placeholder focus:border-primary-500 focus:outline-none resize-none leading-snug disabled:opacity-60"
            />
            <Button.Root
              type="submit"
              variant="solid"
              intent="primary"
              size="xs"
              disabled={!draft.trim() || isThinking || isExecutingSequence}
              aria-label="Send to Journey Agent"
              className="absolute right-2 bottom-2"
            >
              <Button.Icon type="only" size="xs">
                {isThinking || isExecutingSequence ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <ArrowUp className="stroke-[2.5]" />
                )}
              </Button.Icon>
            </Button.Root>
          </form>
        )}
      </div>
    </Card>
  );
};
