"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  AgentExecutedAction,
  AgentWorkspaceMutationPayload,
  AIModelChoice,
  AITone,
  HeroChatMessage,
  TaskItem,
  THEME_OPTIONS,
  UserProfile,
  WorkspaceConfig,
  WorkspaceTab,
} from "@/types/taskit";
import {
  ArrowUp,
  ArrowUpDown,
  Check,
  CheckCircle2,
  ChevronDown,
  CornerDownLeft,
  ExternalLink,
  Heading,
  KeyRound,
  Loader2,
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

interface GeminiHeroChatProps {
  tasks: TaskItem[];
  profile: UserProfile;
  workspaceConfig: WorkspaceConfig;
  messages: HeroChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<HeroChatMessage[]>>;
  hasApiKey: boolean;
  effectiveApiKey: string;
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onSaveApiKey: (key: string) => void;
  onOpenApiKeySetup: () => void;
  onOptOutTemporary: () => void;
  onChangeTone: (tone: AITone) => void;
  onOpenSettings: () => void;
  onQuickSyncCanvas: () => void;
  onApplyAgentMutation: (
    mutation: AgentWorkspaceMutationPayload
  ) => HeroChatMessage["undoSnapshot"];
  onUndoAgentMessage: (messageId: string) => void;
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
  onSelectTab,
  onSaveApiKey,
  onOpenApiKeySetup,
  onOptOutTemporary,
  onChangeTone,
  onOpenSettings,
  onQuickSyncCanvas,
  onApplyAgentMutation,
  onUndoAgentMessage,
}) => {
  const [input, setInput] = useState("");
  const [modelChoice, setModelChoice] = useState<AIModelChoice>("flash");
  const [isThinking, setIsThinking] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);

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

  // Auto-scroll chat on new messages
  useEffect(() => {
    if (messages.length > 0 || isThinking) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isThinking]);

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

  const sendPrompt = async (overridePrompt?: string) => {
    const promptText = (overridePrompt ?? input).trim();
    if (!promptText || isThinking) return;

    if (!hasApiKey) {
      onOpenApiKeySetup();
      return;
    }

    setMentionQuery(null);
    setPlusMenuOpen(false);
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

    try {
      const now = new Date();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "chat",
          message: promptText,
          history: historyForApi,
          tasks,
          userId: profile.id,
          tone: profile.ai_tone,
          modelChoice,
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
            "Something went wrong while communicating with Google Gemini.",
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
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content:
            "Network hiccup while reaching the Gemini agent endpoint. Please try again.",
          timestamp: nowLabel,
          isError: true,
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleInlineKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inlineKeyDraft.trim();
    if (!trimmed) return;
    setInlineVerifying(true);
    setInlineKeyError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "verify",
          customApiKey: trimmed,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setInlineKeyError(
          data.error ||
            "Invalid API key. Copy a valid key from Google AI Studio (starts with AIza...)."
        );
        return;
      }
      setInlineKeyDraft("");
      onSaveApiKey(trimmed);
    } catch {
      setInlineKeyError("Could not verify key right now. Please try again.");
    } finally {
      setInlineVerifying(false);
    }
  };

  // Shared Gemini-styled Chat | Tasks Switcher Pill (matches uploaded screenshot)
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
        onClick={() => onSelectTab("chat")}
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
    </div>
  );

  // ---------------------------------------------------------------------------
  // STATE A: Missing Google AI API Key -> Clear "Please add your API key" Gate
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
              Please add your Google AI API key to use this feature
            </h1>
            <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
              The Gemini Workspace Agent uses your personal Google AI Studio key
              to manage tasks, organize sections, switch themes, and plan your
              schedule.
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
                placeholder="Paste AIzaSy... key here"
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
              <span>View Step-by-Step Setup Instructions</span>
            </button>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] px-3.5 py-2 text-white/75 hover:text-white transition-colors"
            >
              <span>Get Free Key</span>
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
  const isHeroEmpty = messages.length === 0;

  const GeminiInputBar = (
    <div className="relative w-full max-w-[740px] mx-auto">
      {/* @ Mention Autocomplete Popover */}
      {mentionQuery !== null && mentionCandidates.length > 0 && (
        <div
          className={`absolute left-2 right-2 ${
            isHeroEmpty ? "top-full mt-2" : "bottom-full mb-2"
          } z-50 rounded-2xl border border-white/15 bg-[#191a1f]/98 backdrop-blur-2xl p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.85)] animate-in fade-in duration-150`}
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
              className={`absolute left-0 ${
                isHeroEmpty ? "top-full mt-3" : "bottom-full mb-3"
              } w-64 rounded-2xl border border-white/15 bg-[#191a1f]/98 p-1.5 shadow-2xl backdrop-blur-2xl z-50 space-y-0.5`}
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
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setPlusMenuOpen(false);
                    setMessages([]);
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

        {/* Right Controls: Flash/Pro Model Selector + Mic + Send */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 self-center">
          {/* Model & Tone Dropdown ("Flash v") */}
          <div ref={modelMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setModelMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs sm:text-[13px] font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
              title="Select Gemini model & coaching style"
            >
              <span>{modelChoice === "pro" ? "Pro" : "Flash"}</span>
              <ChevronDown className="w-3.5 h-3.5 text-white/55" />
            </button>

            {modelMenuOpen && (
              <div
                className={`absolute right-0 ${
                  isHeroEmpty ? "top-full mt-3" : "bottom-full mb-3"
                } w-64 rounded-2xl border border-white/15 bg-[#191a1f]/98 p-2 shadow-2xl backdrop-blur-2xl z-50 space-y-2`}
              >
                <div className="space-y-1">
                  <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Gemini Model
                  </div>
                  {(
                    [
                      {
                        id: "flash",
                        name: "2.5 Flash",
                        desc: "Fast, agile task & board actions",
                      },
                      {
                        id: "pro",
                        name: "2.5 Pro",
                        desc: "Deep planning & complex schedules",
                      },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setModelChoice(m.id);
                        setModelMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between rounded-xl px-2.5 py-2 text-left transition-colors ${
                        modelChoice === m.id
                          ? "bg-white/10 text-white"
                          : "text-white/70 hover:bg-white/[0.06]"
                      }`}
                    >
                      <div>
                        <div className="text-xs font-semibold">{m.name}</div>
                        <div className="text-[11px] text-white/45">{m.desc}</div>
                      </div>
                      {modelChoice === m.id && (
                        <Check className="w-4 h-4 text-primary shrink-0" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="border-t border-white/10 pt-2 space-y-1">
                  <div className="px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Agent Personality
                  </div>
                  <div className="grid grid-cols-2 gap-1">
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
                          className={`rounded-lg px-2 py-1.5 text-left text-[11px] transition-colors ${
                            active
                              ? "bg-primary/20 border border-primary/40 text-highlight font-semibold"
                              : "text-white/65 hover:bg-white/10 hover:text-white border border-transparent"
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
  // STATE B: Clean Centered Gemini Hero Screen (No messages yet)
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
          {/* Hero Greeting */}
          <h1 className="text-[32px] sm:text-[42px] font-normal tracking-[-0.02em] text-white/95 text-center mb-8 sm:mb-9 select-none">
            Where should we start?
          </h1>

          {/* Gemini Stadium Input Pill */}
          {GeminiInputBar}

          {/* Centered [ Chat | Tasks ] Switcher Pill right underneath (matches screenshot) */}
          <div className="mt-6">{ModeSwitcherPill}</div>

          {/* Subtle Optional Quick Prompts */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2 max-w-2xl">
            {[
              {
                label: "Plan my focus queue",
                prompt:
                  "Look at my current task list and build a clear game plan for what I should tackle first today.",
              },
              {
                label: "Add tasks for tonight",
                prompt:
                  "Add 2 high-focus tasks under TODAY for tonight and set smart time estimates.",
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
            ].map((chip) => (
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
      <div className="flex items-center justify-between gap-2 pb-3 mb-2 border-b border-white/[0.08]">
        <div className="flex items-center gap-2 text-xs text-white/55">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>
            Gemini {modelChoice === "pro" ? "2.5 Pro" : "2.5 Flash"} •{" "}
            {activeTaskCount} active task{activeTaskCount === 1 ? "" : "s"} in
            context
          </span>
        </div>

        <div className="flex items-center gap-2">
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
            onClick={() => setMessages([])}
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

          return (
            <div key={m.id} className="flex items-start gap-3.5">
              {/* Gemini Sparkle Avatar */}
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/35 bg-primary/15 text-primary shadow-neon">
                <Sparkles className="w-4 h-4" />
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

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectTab("tasks")}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80 hover:text-white transition-colors"
                        >
                          <Table2 className="w-3 h-3 text-primary" />
                          <span>View in Tasks</span>
                        </button>

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
              </div>
            </div>
          );
        })}

        {isThinking && (
          <div className="flex items-center gap-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/20 text-primary animate-pulse">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-white/60">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Thinking &amp; updating workspace...</span>
            </div>
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
