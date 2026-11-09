"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  AgentExecutedAction,
  AgentQAPrompt,
  AgentWorkspaceMutationPayload,
  AIModelChoice,
  AIProvider,
  AITone,
  DEFAULT_NVIDIA_MODEL,
  HeroChatMessage,
  NVIDIA_MODEL_OPTIONS,
  QASubmissionPayload,
  TaskItem,
  THEME_OPTIONS,
  UserProfile,
  WorkspaceConfig,
  WorkspaceTab,
} from "@/types/taskit";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  CornerDownLeft,
  ExternalLink,
  Heading,
  HelpCircle,
  KeyRound,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Palette,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings2,
  Sparkles,
  Table2,
  Trash2,
  Wand2,
  Zap,
} from "lucide-react";
import { MyDayStatusBanner } from "@/components/myday/MyDayStatusBanner";
import { EnrichedMyDayBlock } from "@/utils/myDayUtils";
import { KiteFlyingLoader, KiteLogoMark } from "@/components/ui/KiteBrand";
import { SharinganIcon } from "@/components/ui/SharinganIcon";
import { AgentQACard } from "@/components/ai/AgentQACard";

interface GeminiHeroChatProps {
  tasks: TaskItem[];
  profile: UserProfile;
  workspaceConfig: WorkspaceConfig;
  messages: HeroChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<HeroChatMessage[]>>;
  hasApiKey: boolean;
  effectiveApiKey: string;
  activeTab: WorkspaceTab;
  heroResetNonce?: number;
  queuedPrompt?: { nonce: number; text: string } | null;
  onConsumeQueuedPrompt?: () => void;
  onSelectTab: (tab: WorkspaceTab) => void;
  onSaveApiKey: (
    key: string,
    provider?: AIProvider,
    nvidiaModel?: string
  ) => void;
  onUpdateWorkspaceConfig: (updates: Partial<WorkspaceConfig>) => void;
  onOpenApiKeySetup: () => void;
  onOptOutTemporary: () => void;
  onChangeTone: (tone: AITone) => void;
  onOpenSettings: () => void;
  onQuickSyncCanvas: () => void;
  onApplyAgentMutation: (
    mutation: AgentWorkspaceMutationPayload
  ) => HeroChatMessage["undoSnapshot"];
  onUndoAgentMessage: (messageId: string) => void;
  onToggleMyDayBlockComplete?: (block: EnrichedMyDayBlock) => void;
}

interface MentionCandidate {
  id: string;
  kind: "skill" | "task";
  label: string;
  sublabel: string;
  insertText: string;
  immediatePrompt?: string;
}

const TONE_META: Record<AITone, { label: string; desc: string }> = {
  locked_in: { label: "Locked In", desc: "Direct & high-focus" },
  chill_coach: { label: "Chill Coach", desc: "Calm & sustainable" },
  hyper_drive: { label: "Hyper Drive", desc: "Fast deadline blitz" },
  executive: { label: "Executive", desc: "Strategic & analytical" },
};

// Safe inline markdown formatter (**bold**, *italic*, `code`)
function renderInlineFormatting(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
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
          className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[12px] text-highlight"
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
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

const FormattedAgentMarkdown: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let idx = 0;

  while (idx < lines.length) {
    const line = lines[idx];
    const trimmed = line.trim();

    if (!trimmed) {
      idx++;
      continue;
    }

    // Code block
    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      idx++;
      while (idx < lines.length && !lines[idx].trim().startsWith("```")) {
        codeLines.push(lines[idx]);
        idx++;
      }
      idx++; // skip closing ```
      blocks.push(
        <pre
          key={`code-${idx}`}
          className="my-2 overflow-x-auto rounded-xl border border-white/10 bg-black/55 p-3.5 font-mono text-xs text-highlight"
        >
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Headings
    if (trimmed.startsWith("### ")) {
      blocks.push(
        <h4
          key={`h3-${idx}`}
          className="mt-3 mb-1 text-sm font-bold text-white tracking-tight"
        >
          {renderInlineFormatting(trimmed.slice(4))}
        </h4>
      );
      idx++;
      continue;
    }
    if (trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
      const text = trimmed.replace(/^#{1,2}\s+/, "");
      blocks.push(
        <h3
          key={`h2-${idx}`}
          className="mt-3 mb-1.5 text-base font-bold text-white tracking-tight"
        >
          {renderInlineFormatting(text)}
        </h3>
      );
      idx++;
      continue;
    }

    // Bullet list items (-, *, •)
    if (/^([-*•])\s+/.test(trimmed)) {
      const listItems: string[] = [];
      while (idx < lines.length && /^([-*•])\s+/.test(lines[idx].trim())) {
        listItems.push(lines[idx].trim().replace(/^([-*•])\s+/, ""));
        idx++;
      }
      blocks.push(
        <ul key={`ul-${idx}`} className="my-1.5 space-y-1.5 pl-1">
          {listItems.map((li, i) => (
            <li key={i} className="flex items-start gap-2.5 text-white/85">
              <span
                className="mt-2 h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: "var(--primary)" }}
              />
              <span className="leading-relaxed">
                {renderInlineFormatting(li)}
              </span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list items (1. 2.)
    if (/^\d+\.\s+/.test(trimmed)) {
      const numItems: string[] = [];
      while (idx < lines.length && /^\d+\.\s+/.test(lines[idx].trim())) {
        numItems.push(lines[idx].trim().replace(/^\d+\.\s+/, ""));
        idx++;
      }
      blocks.push(
        <ol key={`ol-${idx}`} className="my-1.5 space-y-1.5 pl-1">
          {numItems.map((li, i) => (
            <li key={i} className="flex items-start gap-2.5 text-white/85">
              <span className="mt-0.5 text-xs font-bold text-primary shrink-0 w-4">
                {i + 1}.
              </span>
              <span className="leading-relaxed">
                {renderInlineFormatting(li)}
              </span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Markdown Table (| Col 1 | Col 2 |)
    if (
      trimmed.startsWith("|") &&
      trimmed.endsWith("|") &&
      idx + 1 < lines.length &&
      /^\|(?:\s*:?-+:?\s*\|)+$/.test(lines[idx + 1].trim())
    ) {
      const headerCells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      idx += 2; // skip header and separator row
      const rows: string[][] = [];

      while (
        idx < lines.length &&
        lines[idx].trim().startsWith("|") &&
        lines[idx].trim().endsWith("|")
      ) {
        const rowCells = lines[idx]
          .trim()
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim());
        rows.push(rowCells);
        idx++;
      }

      blocks.push(
        <div
          key={`table-${idx}`}
          className="my-3 overflow-x-auto rounded-xl border border-white/12 bg-black/45 shadow-lg backdrop-blur-md"
        >
          <table className="w-full border-collapse text-left text-xs sm:text-[13px]">
            <thead>
              <tr className="border-b border-white/12 bg-white/[0.05]">
                {headerCells.map((h, i) => (
                  <th
                    key={i}
                    className="px-3.5 py-2.5 font-semibold text-white/90 whitespace-nowrap"
                  >
                    {renderInlineFormatting(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.07]">
              {rows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className="hover:bg-white/[0.03] transition-colors"
                >
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className="px-3.5 py-2 text-white/80 leading-relaxed font-normal"
                    >
                      {renderInlineFormatting(cell)}
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

    // Standard paragraph
    blocks.push(
      <p key={`p-${idx}`} className="leading-relaxed text-white/90">
        {renderInlineFormatting(trimmed)}
      </p>
    );
    idx++;
  }

  return <div className="space-y-2 text-sm sm:text-[15px]">{blocks}</div>;
};

function getActionCategoryIcon(category: AgentExecutedAction["category"]) {
  switch (category) {
    case "create":
      return <Plus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    case "update":
      return <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    case "delete":
      return <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
    case "move":
      return <ArrowUpDown className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    case "header":
      return <Heading className="w-3.5 h-3.5 text-violet-400 shrink-0" />;
    case "theme":
      return <Palette className="w-3.5 h-3.5 text-pink-400 shrink-0" />;
    case "sync":
      return <RefreshCw className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    case "schedule":
      return <CalendarClock className="w-3.5 h-3.5 text-primary shrink-0" />;
    default:
      return <Settings2 className="w-3.5 h-3.5 text-primary shrink-0" />;
  }
}

export const GeminiHeroChat: React.FC<GeminiHeroChatProps> = ({
  tasks,
  profile,
  workspaceConfig,
  messages,
  setMessages,
  hasApiKey,
  effectiveApiKey,
  activeTab,
  heroResetNonce,
  queuedPrompt,
  onConsumeQueuedPrompt,
  onSelectTab,
  onSaveApiKey,
  onUpdateWorkspaceConfig,
  onOpenApiKeySetup,
  onOptOutTemporary,
  onChangeTone,
  onOpenSettings,
  onQuickSyncCanvas,
  onApplyAgentMutation,
  onUndoAgentMessage,
  onToggleMyDayBlockComplete,
}) => {
  const [input, setInput] = useState("");
  const [modelChoice, setModelChoice] = useState<AIModelChoice>("flash");
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingSeconds, setThinkingSeconds] = useState(0);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  // Always begin on the "What's on your mind?" hero screen first
  const [showConversation, setShowConversation] = useState(false);

  useEffect(() => {
    if (heroResetNonce) {
      setShowConversation(false);
    }
  }, [heroResetNonce]);

  // Live timer while agent is processing
  useEffect(() => {
    if (!isThinking) {
      setThinkingSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setThinkingSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isThinking]);

  // Inline API Key quick-add when on Chat without key
  const [inlineKeyDraft, setInlineKeyDraft] = useState("");
  const [inlineVerifying, setInlineVerifying] = useState(false);
  const [inlineKeyError, setInlineKeyError] = useState<string | null>(null);

  // @ Mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStartIndex, setMentionStartIndex] = useState<number>(-1);
  const [selectedMentionIdx, setSelectedMentionIdx] = useState<number>(0);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const plusMenuRef = useRef<HTMLDivElement | null>(null);
  const modelMenuRef = useRef<HTMLDivElement | null>(null);
  const lastConsumedPromptNonceRef = useRef<number | null>(null);
  interface SpeechRecognitionLike {
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onerror: (() => void) | null;
    onresult:
      | ((event: {
          results?: ArrayLike<ArrayLike<{ transcript?: string }>>;
        }) => void)
      | null;
    start: () => void;
    stop: () => void;
  }

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const lastCompositionEndRef = useRef<number | null>(null);

  const nonHeaderTasks = useMemo(
    () => tasks.filter((t) => !t.custom_properties?.is_header),
    [tasks]
  );

  const activeTaskCount = useMemo(
    () =>
      nonHeaderTasks.filter((t) => {
        const s = (t.status || "").toLowerCase();
        return s !== "done" && s !== "completed";
      }).length,
    [nonHeaderTasks]
  );

  // Auto-scroll chat on new messages or when opening conversation view
  useEffect(() => {
    if (showConversation && (messages.length > 0 || isThinking)) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isThinking, showConversation]);

  // Auto-resize textarea height cleanly
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [input]);

  // Close popovers on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        plusMenuRef.current &&
        !plusMenuRef.current.contains(e.target as Node)
      ) {
        setPlusMenuOpen(false);
      }
      if (
        modelMenuRef.current &&
        !modelMenuRef.current.contains(e.target as Node)
      ) {
        setModelMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Build @ mention candidates (Skills + Live Tasks)
  const mentionCandidates = useMemo<MentionCandidate[]>(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase().trim();

    const skills: MentionCandidate[] = [
      {
        id: "skill-guided-plan",
        kind: "skill",
        label: "@Plan My Day (Q&A)",
        sublabel:
          "Interactive Q&A to gauge your tasks and populate Tasks + my day",
        insertText: "Help me plan my day ",
      },
      {
        id: "skill-myday",
        kind: "skill",
        label: "@my day Schedule",
        sublabel: "Show live my day status bar, current schedule & logistics",
        insertText:
          "Show my current my day schedule, live status bar, and full logistics ",
      },
      {
        id: "skill-briefing",
        kind: "skill",
        label: "@Daily Briefing",
        sublabel: "Summarize today's focus queue, deadlines & time estimate",
        insertText: "Give me a crisp daily briefing of my tasks and what to tackle first ",
      },
      {
        id: "skill-organize",
        kind: "skill",
        label: "@Organize Board",
        sublabel: "Group & sort tasks cleanly by priority and due date",
        insertText: "Organize and sort my task list by priority within each section ",
      },
      {
        id: "skill-canvas",
        kind: "skill",
        label: "@Canvas Sync",
        sublabel: "Sync upcoming class assignments from Canvas LMS",
        insertText: "Sync my Canvas assignments and organize them ",
      },
      {
        id: "skill-theme",
        kind: "skill",
        label: "@Theme Studio",
        sublabel: `Current: ${
          THEME_OPTIONS.find((t) => t.id === profile.theme)?.name || "Custom"
        } — switch or craft custom palette`,
        insertText: "Switch my workspace theme to ",
      },
      {
        id: "skill-cleanup",
        kind: "skill",
        label: "@Clear Completed",
        sublabel: "Delete finished tasks from the workspace",
        insertText: "Clear out all my completed tasks ",
      },
    ];

    const taskCandidates: MentionCandidate[] = nonHeaderTasks.map((t) => ({
      id: `task-${t.id}`,
      kind: "task",
      label: t.title,
      sublabel: `${t.status} • ${t.priority} • ${t.type}`,
      insertText: `@"${t.title}" `,
    }));

    const combined = [...skills, ...taskCandidates];
    if (!q) return combined.slice(0, 8);
    return combined
      .filter(
        (c) =>
          c.label.toLowerCase().includes(q) ||
          c.sublabel.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [mentionQuery, nonHeaderTasks, profile.theme]);

  const handleInputChange = (val: string, caretPos: number) => {
    setInput(val);

    // Detect active @token right before caret
    const textBeforeCaret = val.slice(0, caretPos);
    const atMatch = /(?:^|\s)@([^\s@]*)$/.exec(textBeforeCaret);
    if (atMatch) {
      const atIdx = textBeforeCaret.lastIndexOf("@");
      setMentionStartIndex(atIdx);
      setMentionQuery(atMatch[1] || "");
      setSelectedMentionIdx(0);
    } else {
      setMentionQuery(null);
      setMentionStartIndex(-1);
    }
  };

  const applyMentionCandidate = (candidate: MentionCandidate) => {
    if (mentionStartIndex === -1) return;
    const caret = textareaRef.current?.selectionStart ?? input.length;
    const before = input.slice(0, mentionStartIndex);
    const after = input.slice(caret);
    const nextVal = `${before}${candidate.insertText}${after}`;
    setInput(nextVal);
    setMentionQuery(null);
    setMentionStartIndex(-1);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const toggleSpeechDictation = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    if (typeof window === "undefined") return;
    const speechWindow = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRec =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRec) {
      alert(
        "Voice dictation is not supported in this browser. Try Chrome, Edge, or Safari."
      );
      return;
    }

    const recognition = new SpeechRec();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      if (transcript) {
        setInput((prev) =>
          prev.trim() ? `${prev.trim()} ${transcript}` : transcript
        );
        textareaRef.current?.focus();
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const updateMessageQAPrompt = (
    messageId: string,
    updater: (prev: AgentQAPrompt) => AgentQAPrompt
  ) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId && msg.qaPrompt
          ? { ...msg, qaPrompt: updater(msg.qaPrompt) }
          : msg
      )
    );
  };

  const sendPrompt = async (
    overridePrompt?: string,
    qaSubmission?: QASubmissionPayload
  ) => {
    const promptText = (overridePrompt ?? input).trim();
    if (!promptText || isThinking) return;

    if (!hasApiKey) {
      onOpenApiKeySetup();
      return;
    }

    setMentionQuery(null);
    setPlusMenuOpen(false);
    setShowConversation(true);
    if (overridePrompt === undefined) {
      setInput("");
    }

    const nowLabel = new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

    const userMsg: HeroChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: promptText,
      timestamp: nowLabel,
    };

    const historyForApi = messages
      .filter((m) => !m.isError)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);

    const controller = new AbortController();
    const abortTimeout = setTimeout(() => {
      controller.abort();
    }, 45000);

    try {
      const now = new Date();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          mode: "chat",
          message: promptText,
          history: historyForApi,
          tasks,
          userId: profile.id,
          tone: profile.ai_tone,
          modelChoice,
          aiProvider: workspaceConfig.aiProvider || "nvidia",
          nvidiaModel: workspaceConfig.nvidiaModel || DEFAULT_NVIDIA_MODEL,
          theme: profile.theme,
          videoPreset: profile.video_bg_preset,
          videoDim: profile.video_bg_dim,
          videoBlur: profile.video_bg_blur,
          viewMode: profile.view_mode,
          workspaceConfig,
          customApiKey: effectiveApiKey,
          clientISO: now.toISOString(),
          clientTimezoneOffset: now.getTimezoneOffset(),
          clientLocalDateReadable: now.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          ...(qaSubmission ? { qaSubmission } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errAssistant: HeroChatMessage = {
          id: `err-${Date.now()}`,
          role: "assistant",
          content:
            data.reply ||
            data.error ||
            "Something went wrong while communicating with the AI agent.",
          timestamp: nowLabel,
          isError: true,
        };
        setMessages((prev) => [...prev, errAssistant]);
        return;
      }

      let undoSnap: HeroChatMessage["undoSnapshot"] = null;
      const mutation: AgentWorkspaceMutationPayload | undefined = data.mutation;

      if (
        mutation &&
        (mutation.tasksMutation ||
          mutation.profileUpdates ||
          mutation.workspaceConfigUpdates ||
          mutation.triggerCanvasSync ||
          mutation.switchTab)
      ) {
        undoSnap = onApplyAgentMutation(mutation);
      }

      const assistantMsg: HeroChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.reply || "Done!",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }),
        modelUsed: data.modelUsed,
        executedActions: mutation?.executedActions || [],
        undoSnapshot: undoSnap,
        showMyDayCard: Boolean(mutation?.showMyDayCard),
        qaPrompt: mutation?.qaPrompt || null,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const isTimeout =
        err instanceof Error &&
        (err.name === "AbortError" || err.message?.includes("aborted"));
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: isTimeout
            ? "The AI agent took longer than 45s to respond. Please check your internet connection or try again."
            : "Network hiccup while reaching the AI agent endpoint. Please try again.",
          timestamp: nowLabel,
          isError: true,
        },
      ]);
    } finally {
      clearTimeout(abortTimeout);
      setIsThinking(false);
    }
  };

  const sendPromptRef = useRef(sendPrompt);
  sendPromptRef.current = sendPrompt;

  useEffect(() => {
    if (
      queuedPrompt &&
      queuedPrompt.nonce !== lastConsumedPromptNonceRef.current
    ) {
      lastConsumedPromptNonceRef.current = queuedPrompt.nonce;
      onConsumeQueuedPrompt?.();
      sendPromptRef.current(queuedPrompt.text);
    }
  }, [queuedPrompt, onConsumeQueuedPrompt]);

  const handleInlineKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inlineKeyDraft.trim();
    if (!trimmed) return;
    setInlineVerifying(true);
    setInlineKeyError(null);

    const detectedProvider: AIProvider = trimmed.startsWith("nvapi-")
      ? "nvidia"
      : trimmed.startsWith("AIza")
      ? "gemini"
      : workspaceConfig.aiProvider || "nvidia";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "verify",
          customApiKey: trimmed,
          aiProvider: detectedProvider,
          nvidiaModel: workspaceConfig.nvidiaModel || DEFAULT_NVIDIA_MODEL,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setInlineKeyError(
          data.error ||
            "Invalid API key. Please check your key from NVIDIA NIM (build.nvidia.com) or Google AI Studio."
        );
        return;
      }
      setInlineKeyDraft("");
      onSaveApiKey(
        trimmed,
        detectedProvider,
        workspaceConfig.nvidiaModel || DEFAULT_NVIDIA_MODEL
      );
    } catch {
      setInlineKeyError("Could not verify key right now. Please try again.");
    } finally {
      setInlineVerifying(false);
    }
  };

  // Shared Gemini-styled Chat | Tasks | MY DAY Switcher Pill
  const ModeSwitcherPill = (
    <div
      role="tablist"
      aria-label="Workspace view mode"
      className="inline-flex items-center gap-1 rounded-full p-1 select-none"
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "chat"}
        onClick={() => {
          onSelectTab("chat");
          setShowConversation(false);
        }}
        className={`rounded-full px-5 py-2 text-[13px] font-medium transition-all ${
          activeTab === "chat"
            ? "bg-[#282a2f]/95 border border-white/[0.14] text-white shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
            : "border border-transparent text-white/60 hover:text-white hover:bg-white/[0.06]"
        }`}
      >
        Chat
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "tasks"}
        onClick={() => onSelectTab("tasks")}
        className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[13px] font-medium transition-all ${
          activeTab === "tasks"
            ? "bg-[#282a2f]/95 border border-white/[0.14] text-white shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
            : "border border-transparent text-white/60 hover:text-white hover:bg-white/[0.06]"
        }`}
      >
        <span>Tasks</span>
        {activeTaskCount > 0 && (
          <span className="rounded-full bg-white/10 px-1.5 py-0.2 text-[10px] font-semibold text-white/75">
            {activeTaskCount}
          </span>
        )}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "my_day"}
        onClick={() => onSelectTab("my_day")}
        className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[13px] font-medium transition-all ${
          activeTab === "my_day"
            ? "bg-[#282a2f]/95 border border-white/[0.14] text-white shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
            : "border border-transparent text-white/60 hover:text-white hover:bg-white/[0.06]"
        }`}
      >
        <span>my day</span>
        {(workspaceConfig.myDaySchedule?.blocks.length || 0) > 0 && (
          <span className="rounded-full bg-white/10 px-1.5 py-0.2 text-[10px] font-semibold text-white/75">
            {workspaceConfig.myDaySchedule?.blocks.length}
          </span>
        )}
      </button>
    </div>
  );

  // ---------------------------------------------------------------------------
  // STATE A: Missing AI API Key -> Clear "Please add your API key" Gate
  // ---------------------------------------------------------------------------
  if (!hasApiKey) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-7rem)] px-4 py-10">
        <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-[#15161b]/95 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_24px_70px_rgba(0,0,0,0.65)] space-y-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/35 bg-primary/15 text-primary shadow-neon">
            <KeyRound className="w-5 h-5" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Please add your AI API key to use this feature
            </h1>
            <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
              Kite pairs free inference on leading models via{" "}
              <span className="text-white/90 font-medium">NVIDIA NIM</span>{" "}
              (build.nvidia.com) with{" "}
              <span className="text-white/90 font-medium">Google Gemini</span>{" "}
              to manage tasks, plan your day, and customize your workspace.
            </p>
          </div>

          <form onSubmit={handleInlineKeySubmit} className="space-y-3 text-left">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={inlineKeyDraft}
                onChange={(e) => {
                  setInlineKeyDraft(e.target.value);
                  if (inlineKeyError) setInlineKeyError(null);
                }}
                placeholder="Paste NVIDIA NIM (nvapi-...) or Google AI key here"
                className="flex-1 rounded-2xl border border-white/15 bg-black/60 px-4 py-2.5 text-xs sm:text-sm font-mono text-white placeholder-white/30 focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                disabled={inlineVerifying || !inlineKeyDraft.trim()}
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-primary px-5 py-2.5 text-xs sm:text-sm font-bold text-black shadow-neon hover:brightness-110 disabled:opacity-45 transition-all shrink-0"
              >
                {inlineVerifying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>Save Key</span>
              </button>
            </div>

            {inlineKeyError && (
              <p className="text-xs text-red-300 px-1">{inlineKeyError}</p>
            )}
          </form>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-xs">
            <button
              type="button"
              onClick={onOpenApiKeySetup}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-3.5 py-2 font-medium text-highlight transition-colors"
            >
              <span>Setup Guide &amp; Model Selector</span>
            </button>
            <a
              href="https://build.nvidia.com/models"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] px-3.5 py-2 text-white/75 hover:text-white transition-colors"
            >
              <span>Get Free NVIDIA NIM Key</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              type="button"
              onClick={onOptOutTemporary}
              className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-white/45 hover:text-white/80 transition-colors"
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>Hide AI for now</span>
            </button>
          </div>
        </div>

        <div className="mt-7">{ModeSwitcherPill}</div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Shared Gemini Stadium Input Bar
  // ---------------------------------------------------------------------------
  const isHeroEmpty = !showConversation;

  const GeminiInputBar = (
    <div className="relative w-full max-w-[740px] mx-auto">
      {/* @ Mention Autocomplete Popover */}
      {mentionQuery !== null && mentionCandidates.length > 0 && (
        <div
          style={{ backgroundColor: "rgba(18, 19, 24, 0.94)" }}
          className={`absolute left-2 right-2 ${
            isHeroEmpty ? "top-full mt-2" : "bottom-full mb-2"
          } z-50 rounded-2xl border border-white/20 backdrop-blur-xl p-2 shadow-[0_24px_70px_rgba(0,0,0,0.85)] animate-in fade-in duration-150`}
        >
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40 flex items-center justify-between">
            <span>Connectors, Skills &amp; Live Tasks</span>
            <span>↑↓ Navigate • ↵ Insert</span>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-0.5">
            {mentionCandidates.map((cand, idx) => {
              const selected = idx === selectedMentionIdx;
              return (
                <button
                  key={cand.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyMentionCandidate(cand);
                  }}
                  onMouseEnter={() => setSelectedMentionIdx(idx)}
                  className={`w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                    selected
                      ? "bg-white/[0.11] text-white"
                      : "text-white/75 hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs ${
                        cand.kind === "skill"
                          ? "bg-primary/20 text-highlight"
                          : "bg-white/10 text-white/80"
                      }`}
                    >
                      {cand.kind === "skill" ? (
                        <Zap className="w-3.5 h-3.5" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">
                        {cand.label}
                      </div>
                      <div className="text-[11px] text-white/45 truncate">
                        {cand.sublabel}
                      </div>
                    </div>
                  </div>
                  <CornerDownLeft className="w-3.5 h-3.5 text-white/30 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Pill Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendPrompt();
        }}
        className="relative flex items-end gap-2 rounded-[30px] border border-white/[0.11] bg-[#1c1d21]/95 hover:border-white/[0.18] focus-within:border-white/[0.26] px-3.5 sm:px-4 py-2.5 sm:py-3 shadow-[0_18px_55px_rgba(0,0,0,0.6)] backdrop-blur-2xl transition-all"
      >
        {/* Left + Connector / Quick Skills Button */}
        <div ref={plusMenuRef} className="relative shrink-0 self-center">
          <button
            type="button"
            onClick={() => setPlusMenuOpen((v) => !v)}
            aria-label="Open quick actions and connectors"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/65 hover:bg-white/10 hover:text-white transition-colors"
            title="Quick actions, Canvas sync & skills"
          >
            <Plus className="w-5 h-5 stroke-[1.8]" />
          </button>

          {plusMenuOpen && (
            <div
              style={{ backgroundColor: "rgba(18, 19, 24, 0.94)" }}
              className={`absolute left-0 ${
                isHeroEmpty ? "top-full mt-3" : "bottom-full mb-3"
              } w-64 rounded-2xl border border-white/20 p-2 shadow-[0_24px_70px_rgba(0,0,0,0.85)] backdrop-blur-xl z-50 space-y-1`}
            >
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Workspace Connectors &amp; Skills
              </div>
              <button
                type="button"
                onClick={() => {
                  setPlusMenuOpen(false);
                  setInput((prev) => (prev ? `${prev} @` : "@"));
                  setMentionStartIndex(input ? input.length + 1 : 0);
                  setMentionQuery("");
                  textareaRef.current?.focus();
                }}
                className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-white/85 hover:bg-white/10 transition-colors"
              >
                <Wand2 className="w-3.5 h-3.5 text-primary" />
                <span>Reference a Task (@mention)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlusMenuOpen(false);
                  onQuickSyncCanvas();
                }}
                className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-white/85 hover:bg-white/10 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                <span>Sync Canvas Assignments Now</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlusMenuOpen(false);
                  sendPrompt("Help me plan my day");
                }}
                className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-white/85 hover:bg-white/10 transition-colors"
              >
                <HelpCircle className="w-3.5 h-3.5 text-primary" />
                <span>Plan My Day (Guided Q&amp;A)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlusMenuOpen(false);
                  sendPrompt(
                    "Show my current my day schedule, display the live status bar UI, and summarize my schedule logistics."
                  );
                }}
                className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-white/85 hover:bg-white/10 transition-colors"
              >
                <CalendarClock className="w-3.5 h-3.5 text-primary" />
                <span>Show My Day &amp; Live Status Bar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlusMenuOpen(false);
                  sendPrompt(
                    "Give me a tactical daily briefing of my tasks, highlight urgent items, and suggest an execution order for today."
                  );
                }}
                className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-white/85 hover:bg-white/10 transition-colors"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Generate Daily Briefing</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlusMenuOpen(false);
                  sendPrompt(
                    "Organize my task board cleanly by sorting tasks by priority and grouping them neatly under section headers."
                  );
                }}
                className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-white/85 hover:bg-white/10 transition-colors"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400" />
                <span>Auto-Organize &amp; Sort Board</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlusMenuOpen(false);
                  onOpenSettings();
                }}
                className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-white/85 hover:bg-white/10 transition-colors"
              >
                <Settings2 className="w-3.5 h-3.5 text-white/60" />
                <span>Workspace &amp; Theme Settings</span>
              </button>
              {messages.length > 0 && !showConversation && (
                <button
                  type="button"
                  onClick={() => {
                    setPlusMenuOpen(false);
                    setShowConversation(true);
                  }}
                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-highlight hover:bg-white/10 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-primary" />
                  <span>View Current Chat ({messages.length})</span>
                </button>
              )}
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setPlusMenuOpen(false);
                    setMessages([]);
                    setShowConversation(false);
                  }}
                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs text-rose-300 hover:bg-rose-500/15 transition-colors border-t border-white/10 mt-1 pt-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset / Start New Chat</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Auto-growing Textarea with IME-safe Enter handling */}
        <label htmlFor="gemini-hero-input" className="sr-only">
          Message Gemini Workspace Agent
        </label>
        <textarea
          id="gemini-hero-input"
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) =>
            handleInputChange(
              e.target.value,
              e.target.selectionStart ?? e.target.value.length
            )
          }
          onCompositionEnd={(e) => {
            lastCompositionEndRef.current = e.timeStamp;
          }}
          onKeyDown={(e) => {
            // Handle @ mention keyboard navigation first
            if (mentionQuery !== null && mentionCandidates.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedMentionIdx(
                  (prev) => (prev + 1) % mentionCandidates.length
                );
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedMentionIdx(
                  (prev) =>
                    (prev - 1 + mentionCandidates.length) %
                    mentionCandidates.length
                );
                return;
              }
              if (
                (e.key === "Enter" || e.key === "Tab") &&
                !e.nativeEvent.isComposing &&
                e.keyCode !== 229
              ) {
                e.preventDefault();
                applyMentionCandidate(mentionCandidates[selectedMentionIdx]);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setMentionQuery(null);
                return;
              }
            }

            // IME-safe Enter-to-submit
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (e.nativeEvent.isComposing || e.keyCode === 229) {
                return;
              }
              if (
                lastCompositionEndRef.current !== null &&
                Math.abs(e.timeStamp - lastCompositionEndRef.current) < 50
              ) {
                return;
              }
              sendPrompt();
            }
          }}
          placeholder="Type @ for tasks, skills, themes and more"
          className="flex-1 resize-none bg-transparent py-2 px-1 text-sm sm:text-[15px] text-white placeholder-[#7c7f87] focus:outline-none max-h-44 leading-relaxed"
        />

        {/* Right Controls: NVIDIA NIM / Gemini Model Selector + Mic + Send */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 self-center">
          {/* Model & Tone Dropdown */}
          <div ref={modelMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setModelMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs sm:text-[12px] font-medium text-white/85 hover:bg-white/10 hover:text-white transition-colors"
              title="Select AI model (NVIDIA NIM or Google Gemini) & coaching style"
            >
              <span className="max-w-[140px] sm:max-w-[175px] truncate">
                {(workspaceConfig.aiProvider || "nvidia") === "nvidia"
                  ? NVIDIA_MODEL_OPTIONS.find(
                      (m) =>
                        m.id ===
                        (workspaceConfig.nvidiaModel || DEFAULT_NVIDIA_MODEL)
                    )?.shortName || "Nemotron 3.5 Super"
                  : modelChoice === "pro"
                  ? "Gemini 3.8 Pro"
                  : "Gemini 3.8 Flash"}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-white/55 shrink-0" />
            </button>

            {modelMenuOpen && (
              <div
                style={{ backgroundColor: "rgba(18, 19, 24, 0.94)" }}
                className={`absolute right-0 ${
                  isHeroEmpty ? "top-full mt-3" : "bottom-full mb-3"
                } w-80 sm:w-[350px] max-h-[480px] overflow-y-auto rounded-2xl border border-white/20 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.85)] backdrop-blur-xl z-50 space-y-3`}
              >
                {/* Section 1: NVIDIA NIM Leading Models */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-2.5 py-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      NVIDIA NIM Models (build.nvidia.com)
                    </span>
                    <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
                      Free Inference
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                    {NVIDIA_MODEL_OPTIONS.map((m) => {
                      const isSelected =
                        (workspaceConfig.aiProvider || "nvidia") === "nvidia" &&
                        (workspaceConfig.nvidiaModel || DEFAULT_NVIDIA_MODEL) ===
                          m.id;
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
                          className={`w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left transition-colors ${
                            isSelected
                              ? "bg-primary/20 border border-primary/50 text-white shadow-sm"
                              : "border border-white/5 bg-white/[0.03] text-white/80 hover:bg-white/[0.08] hover:text-white"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold truncate text-white">
                                {m.name}
                              </span>
                              <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold text-white/70">
                                {m.badge}
                              </span>
                            </div>
                            <div className="text-[10px] text-white/55 truncate mt-0.5">
                              {m.provider} • {m.desc}
                            </div>
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-primary shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Section 2: Google Gemini (Paired) */}
                <div className="border-t border-white/10 pt-2.5 space-y-1.5">
                  <div className="flex items-center justify-between px-2.5 py-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                      Google Gemini (Paired Failover)
                    </span>
                  </div>
                  {(
                    [
                      {
                        id: "flash",
                        name: "Gemini 3.8 Flash",
                        desc: "Fast, agile task & board actions",
                      },
                      {
                        id: "pro",
                        name: "Gemini 3.8 Pro",
                        desc: "Deep planning & complex schedules",
                      },
                    ] as const
                  ).map((m) => {
                    const isSelected =
                      workspaceConfig.aiProvider === "gemini" &&
                      modelChoice === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setModelChoice(m.id);
                          onUpdateWorkspaceConfig({ aiProvider: "gemini" });
                          setModelMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-left transition-colors ${
                          isSelected
                            ? "bg-primary/20 border border-primary/50 text-white shadow-sm"
                            : "border border-white/5 bg-white/[0.03] text-white/80 hover:bg-white/[0.08] hover:text-white"
                        }`}
                      >
                        <div>
                          <div className="text-xs font-semibold text-white">{m.name}</div>
                          <div className="text-[10px] text-white/55 mt-0.5">
                            {m.desc}
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-primary shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Section 3: Agent Personality */}
                <div className="border-t border-white/10 pt-2.5 space-y-1.5">
                  <div className="px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/45">
                    Agent Personality
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.keys(TONE_META) as AITone[]).map((tk) => {
                      const active = profile.ai_tone === tk;
                      return (
                        <button
                          key={tk}
                          type="button"
                          onClick={() => {
                            onChangeTone(tk);
                            setModelMenuOpen(false);
                          }}
                          className={`rounded-xl px-2.5 py-2 text-left text-[11px] transition-colors ${
                            active
                              ? "bg-primary/20 border border-primary/50 text-highlight font-semibold shadow-sm"
                              : "border border-white/5 bg-white/[0.03] text-white/75 hover:bg-white/[0.08] hover:text-white"
                          }`}
                        >
                          {TONE_META[tk].label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Microphone Voice Input */}
          <button
            type="button"
            onClick={toggleSpeechDictation}
            aria-label={isListening ? "Stop voice input" : "Voice input"}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
              isListening
                ? "bg-red-500/25 text-red-400 animate-pulse ring-1 ring-red-400/50"
                : "text-white/65 hover:bg-white/10 hover:text-white"
            }`}
            title={isListening ? "Listening... Click to stop" : "Dictate message"}
          >
            {isListening ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          {/* Submit Button (shows when text entered or while thinking) */}
          {(input.trim().length > 0 || isThinking) && (
            <button
              type="submit"
              disabled={!input.trim() || isThinking}
              aria-label="Send message"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-black shadow-neon hover:brightness-110 disabled:opacity-45 transition-all"
            >
              {isThinking ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );

  // ---------------------------------------------------------------------------
  // STATE B: Clean Centered "What's on your mind?" Hero Screen (Always First)
  // ---------------------------------------------------------------------------
  if (isHeroEmpty) {
    return (
      <div className="relative flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-6rem)] px-4 py-10">
        {/* Subtle Radial Ambient Glow */}
        <div
          className="pointer-events-none absolute inset-x-0 top-1/4 mx-auto h-72 max-w-2xl rounded-full blur-[120px] opacity-20"
          style={{ backgroundColor: "var(--primary)" }}
        />

        <div className="relative z-10 w-full max-w-[760px] flex flex-col items-center">
          {/* Minimalist Kite Crest / Sharingan Crest */}
          <div
            className={`mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium backdrop-blur-md select-none transition-all ${
              profile.theme === "sharingan"
                ? "border-red-500/40 bg-red-950/30 text-red-300 shadow-[0_0_16px_rgba(255,31,56,0.35)]"
                : "border-white/[0.09] bg-white/[0.03] text-white/60"
            }`}
          >
            {profile.theme === "sharingan" ? (
              <>
                <SharinganIcon size={16} animate speed="normal" glow interactive />
                <span className="font-semibold tracking-wider text-red-200">
                  UCHIHA CLAN DOMAIN
                </span>
              </>
            ) : (
              <>
                <KiteLogoMark className="w-3.5 h-3.5 text-primary" />
                <span>kite workspace</span>
              </>
            )}
          </div>

          {/* Hero Prompt Headline */}
          <h1 className="text-[32px] sm:text-[44px] font-normal tracking-[-0.025em] text-white/95 text-center mb-8 sm:mb-9 select-none">
            What&apos;s on your mind?
          </h1>

          {/* Live Voice Dictation Indicator */}
          {isListening && (
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-400/35 bg-red-500/15 px-3.5 py-1 text-xs font-medium text-red-200 animate-pulse">
              <Mic className="w-3.5 h-3.5 text-red-400" />
              <span>Listening — speak your mind, then press Enter...</span>
            </div>
          )}

          {/* Stadium Input Pill */}
          {GeminiInputBar}

          {/* One-Click "View Chat" Pill when previous messages exist */}
          {messages.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setShowConversation(true)}
                className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 hover:bg-primary/25 px-4 py-1.5 text-xs font-semibold text-highlight shadow-sm transition-all"
              >
                <MessageSquare className="w-3.5 h-3.5 text-primary" />
                <span>
                  View Chat ({messages.length}{" "}
                  {messages.length === 1 ? "message" : "messages"})
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setMessages([])}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] px-3 py-1.5 text-xs text-white/50 hover:text-white/85 transition-colors"
                title="Start a fresh conversation"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>
          )}

          {/* Centered [ Chat | Tasks | my day ] Switcher Pill */}
          <div className="mt-6">{ModeSwitcherPill}</div>

          {/* Subtle Optional Quick Prompts */}
          <div className="mt-9 flex flex-wrap items-center justify-center gap-2 max-w-2xl">
            {(activeTaskCount === 0
              ? [
                  {
                    label: "Help me plan my day",
                    prompt: "Help me plan my day",
                  },
                  {
                    label: "Show my day schedule",
                    prompt:
                      "Show my current my day schedule, display the live status bar UI, and pull my schedule logistics.",
                  },
                  {
                    label: "Break down a project",
                    prompt:
                      "Help me plan and break down a big project I need to tackle today.",
                  },
                  {
                    label: "Change workspace theme",
                    prompt:
                      "Switch my workspace theme to Electric Lavender with Lofi Bokeh ambiance.",
                  },
                ]
              : [
                  {
                    label: "Show my day schedule",
                    prompt:
                      "Show my current my day schedule, display the live status bar UI, and pull my schedule logistics.",
                  },
                  {
                    label: "Auto-arrange my day",
                    prompt:
                      "Auto-arrange all my active tasks into my my day schedule for the next 4 hours starting right now.",
                  },
                  {
                    label: "Organize & clean up board",
                    prompt:
                      "Sort my tasks by priority inside each section and clean up anything out of place.",
                  },
                  {
                    label: "Change workspace theme",
                    prompt:
                      "Switch my workspace theme to Electric Lavender with Lofi Bokeh ambiance.",
                  },
                ]
            ).map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => sendPrompt(chip.prompt)}
                className="rounded-full border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20 px-3.5 py-1.5 text-xs text-white/50 hover:text-white/85 transition-all"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // STATE C: Active Multi-Turn Agent Conversation Stream
  // ---------------------------------------------------------------------------
  return (
    <div className="flex-1 flex flex-col max-w-[840px] w-full mx-auto px-4 sm:px-6 pt-3 pb-6 min-h-[calc(100vh-5rem)]">
      {/* Top Minimal Session Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-2 border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5 text-xs text-white/55">
          <button
            type="button"
            onClick={() => setShowConversation(false)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] hover:bg-white/10 px-3 py-1 text-xs font-medium text-white/80 hover:text-white transition-colors"
            title="Return to What's on your mind? screen"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-primary" />
            <span>What&apos;s on your mind?</span>
          </button>

          <span className="hidden sm:inline-flex items-center gap-1.5">
            <KiteLogoMark className="w-3.5 h-3.5 text-primary" />
            <span>
              {(workspaceConfig.aiProvider || "nvidia") === "nvidia"
                ? NVIDIA_MODEL_OPTIONS.find(
                    (m) =>
                      m.id ===
                      (workspaceConfig.nvidiaModel || DEFAULT_NVIDIA_MODEL)
                  )?.name || "NVIDIA NIM"
                : `Gemini ${modelChoice === "pro" ? "3.8 Pro" : "3.8 Flash"}`}{" "}
              • {activeTaskCount} active task{activeTaskCount === 1 ? "" : "s"}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSelectTab("my_day")}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/10 px-3 py-1 text-xs text-white/75 hover:text-white transition-colors"
          >
            <CalendarClock className="w-3.5 h-3.5 text-primary" />
            <span>my day</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectTab("tasks")}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/10 px-3 py-1 text-xs text-white/75 hover:text-white transition-colors"
          >
            <Table2 className="w-3.5 h-3.5 text-primary" />
            <span>Open Table</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMessages([]);
              setShowConversation(false);
            }}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/10 px-3 py-1 text-xs text-white/65 hover:text-white transition-colors"
            title="Start a fresh chat"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        </div>
      </div>

      {/* Scrollable Conversation Messages */}
      <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-1">
        {messages.map((m) => {
          if (m.role === "user") {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] sm:max-w-[75%] rounded-3xl rounded-br-md border border-white/[0.12] bg-[#26282e]/90 px-5 py-3 text-sm sm:text-[15px] text-white leading-relaxed shadow-md whitespace-pre-wrap">
                  {m.content}
                </div>
              </div>
            );
          }

          const hasScheduleAction = Boolean(
            m.executedActions?.some((a) => a.category === "schedule")
          );
          const hasTaskOrBoardAction = Boolean(
            m.executedActions?.some(
              (a) => a.category !== "schedule" && a.category !== "theme"
            )
          );

          return (
            <div key={m.id} className="flex items-start gap-3.5">
              {/* Minimalist Kite Avatar */}
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/35 bg-primary/15 text-primary shadow-neon">
                <KiteLogoMark className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0 space-y-3">
                {/* Executed Workspace Operations Summary Card */}
                {m.executedActions && m.executedActions.length > 0 && (
                  <div className="rounded-2xl border border-white/15 bg-[#16181e]/90 p-3.5 space-y-2.5 shadow-lg">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-highlight">
                        <Zap className="w-3.5 h-3.5 text-primary" />
                        <span>
                          {m.executedActions.length} Workspace{" "}
                          {m.executedActions.length === 1 ? "Action" : "Actions"}{" "}
                          Applied
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {(hasTaskOrBoardAction || !hasScheduleAction) && (
                          <button
                            type="button"
                            onClick={() => onSelectTab("tasks")}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80 hover:text-white transition-colors"
                          >
                            <Table2 className="w-3 h-3 text-primary" />
                            <span>View in Tasks</span>
                          </button>
                        )}

                        {hasScheduleAction && (
                          <button
                            type="button"
                            onClick={() => onSelectTab("my_day")}
                            className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80 hover:text-white transition-colors"
                          >
                            <CalendarClock className="w-3 h-3 text-primary" />
                            <span>View in my day</span>
                          </button>
                        )}

                        {m.undoSnapshot && (
                          <button
                            type="button"
                            disabled={m.undone}
                            onClick={() => onUndoAgentMessage(m.id)}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                              m.undone
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 cursor-default"
                                : "border-white/15 bg-white/5 hover:bg-white/10 text-white/75 hover:text-white"
                            }`}
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>{m.undone ? "Reverted" : "Undo"}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {m.executedActions.map((act) => (
                        <div
                          key={act.id}
                          className="flex items-start gap-2 rounded-xl border border-white/[0.07] bg-black/35 px-3 py-2 text-xs"
                        >
                          <div className="mt-0.5">
                            {getActionCategoryIcon(act.category)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-white">
                              {act.summary}
                            </span>
                            {act.detail && (
                              <p className="text-[11px] text-white/50 truncate mt-0.5">
                                {act.detail}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Embedded Live MY DAY Status Bar & Schedule Card */}
                {m.showMyDayCard && (
                  <MyDayStatusBanner
                    schedule={workspaceConfig.myDaySchedule}
                    tasks={tasks}
                    workspaceConfig={workspaceConfig}
                    variant="chat"
                    onOpenMyDay={() => onSelectTab("my_day")}
                    onToggleBlockComplete={onToggleMyDayBlockComplete}
                  />
                )}

                {/* Agent Markdown Reply */}
                <div
                  className={
                    m.isError
                      ? "rounded-2xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                      : "px-0.5"
                  }
                >
                  <FormattedAgentMarkdown content={m.content} />
                  {m.isError && (
                    <div className="mt-2.5">
                      <button
                        type="button"
                        onClick={onOpenApiKeySetup}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-primary" />
                        <span>Check API Key Settings</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Interactive Guided Q&A Card */}
                {m.qaPrompt && (
                  <AgentQACard
                    qaPrompt={m.qaPrompt}
                    disabled={isThinking}
                    onAcceptConsent={() =>
                      updateMessageQAPrompt(m.id, (prev) => ({
                        ...prev,
                        status: "answering",
                      }))
                    }
                    onDismiss={() => {
                      updateMessageQAPrompt(m.id, (prev) => ({
                        ...prev,
                        status: "dismissed",
                      }));
                      setTimeout(() => {
                        textareaRef.current?.focus();
                      }, 50);
                    }}
                    onReopen={() =>
                      updateMessageQAPrompt(m.id, (prev) => ({
                        ...prev,
                        status: "answering",
                      }))
                    }
                    onSubmitAnswers={(payload, summaryText) => {
                      updateMessageQAPrompt(m.id, (prev) => ({
                        ...prev,
                        status: "submitted",
                        submittedAnswers: payload.answers,
                      }));
                      sendPrompt(summaryText, payload);
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}

        {/* Minimalistic Kite Flying Loading Animation */}
        {isThinking && (
          <div className="flex items-start gap-3.5 py-1">
            <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/15 text-primary shadow-neon">
              <KiteLogoMark className="w-4 h-4" />
            </div>
            <KiteFlyingLoader elapsedSeconds={thinkingSeconds} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Sticky Input Pill + Mode Switcher */}
      <div className="pt-3 space-y-3">
        {GeminiInputBar}
        <div className="flex justify-center">{ModeSwitcherPill}</div>
      </div>
    </div>
  );
};
