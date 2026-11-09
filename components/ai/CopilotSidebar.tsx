"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ActionProposalPayload,
  AITone,
  TaskItem,
  TaskPriority,
  TaskType,
  SectionGroup,
} from "@/types/taskit";
import { ActionConfirmationCard } from "@/components/ai/ActionConfirmationCard";
import {
  Bot,
  CalendarClock,
  ChevronRight,
  Layers,
  Loader2,
  Send,
  Sparkles,
  Zap,
  X,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  actionProposal?: ActionProposalPayload | null;
}

interface CopilotSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  tasks: TaskItem[];
  aiTone: AITone;
  customApiKey: string | null;
  onChangeTone: (tone: AITone) => void;
  onConfirmActionProposal: (proposal: ActionProposalPayload) => Promise<void>;
}

const TONE_LABELS: Record<AITone, { label: string; badge: string }> = {
  locked_in: { label: "Locked In", badge: "🎯 Direct & Disciplined" },
  chill_coach: { label: "Chill Coach", badge: "🌿 Mindful & Steady" },
  hyper_drive: { label: "Hyper Drive", badge: "⚡ High-Octane Sprint" },
  executive: { label: "Executive", badge: "📊 High-ROI Strategic" },
  killer_bee: { label: "Killer Bee", badge: "🎤 Bakayaro! Konoyaro!" },
  naruto: { label: "Naruto Uzumaki", badge: "🍥 Believe it! Dattebayo!" },
};

export const CopilotSidebar: React.FC<CopilotSidebarProps> = ({
  isOpen,
  onToggle,
  tasks,
  aiTone,
  customApiKey,
  onChangeTone,
  onConfirmActionProposal,
}) => {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-msg",
      role: "assistant",
      content:
        "Yo Sunay — **kite Copilot** online. I have live visibility into your College apps, HCPSS Canvas assignments, and daily focus queue. All modifications use the **Strict Action Confirmation Card Protocol** so nothing mutates your board until you approve.",
      timestamp: "Just now",
      actionProposal: {
        actionType: "BATCH_RESCHEDULE",
        description: "Move 2 overdue tasks to Saturday, Nov 7",
        newDueDate: new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          new Date().getDate() + 2,
          18,
          0,
          0
        ).toISOString(),
        changes: [
          {
            id: "task-3",
            title: "Linear Algebra Eigenvalue & Diagonalization Problem Set 7",
            from: "Overdue (Yesterday)",
            to: "Saturday, Nov 7",
          },
          {
            id: "task-4",
            title: "AP Biology Cellular Respiration Lab Analysis",
            from: "Overdue (Yesterday)",
            to: "Saturday, Nov 7",
          },
        ],
      },
    },
  ]);

  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          tasks,
          tone: aiTone,
          customApiKey,
        }),
      });
      const data = await res.json();

      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content:
          data.reply ||
          "Here is my analysis and proposed action card for your board.",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        actionProposal: data.actionProposal || null,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content:
            "Connection hiccup while reaching the Copilot route. Try again in a moment.",
          timestamp: "Now",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-2xl border border-primary/50 bg-black/80 px-4 py-3 text-xs sm:text-sm font-bold text-white shadow-neon backdrop-blur-xl hover:scale-105 transition-all"
      >
        <Bot className="w-5 h-5 text-primary" />
        <span>kite Copilot</span>
        <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] text-highlight">
          {TONE_LABELS[aiTone].label}
        </span>
      </button>
    );
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full sm:w-[400px] lg:w-[430px] border-l border-white/15 bg-[#051014]/90 backdrop-blur-2xl shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 bg-black/40">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20 border border-primary/40 text-highlight shadow-neon">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">kite Copilot</h2>
              <span className="rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                Gemini 1.5 Flash
              </span>
            </div>
            <p className="text-[11px] text-white/55">
              {TONE_LABELS[aiTone].badge}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggle}
          className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          title="Collapse Copilot"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tone Switcher Strip */}
      <div className="flex items-center justify-between gap-1 border-b border-white/10 bg-white/[0.02] px-4 py-2 text-[11px]">
        <span className="text-white/45 font-medium">AI Tone:</span>
        <div className="flex items-center gap-1">
          {(Object.keys(TONE_LABELS) as AITone[]).map((tKey) => (
            <button
              key={tKey}
              type="button"
              onClick={() => onChangeTone(tKey)}
              className={`rounded-lg px-2 py-1 font-medium transition-all ${
                aiTone === tKey
                  ? "bg-primary text-black font-bold shadow-sm"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              {TONE_LABELS[tKey].label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Action Tool Prompts */}
      <div className="flex items-center gap-1.5 overflow-x-auto px-4 py-2.5 border-b border-white/10 bg-black/25 no-scrollbar">
        <button
          type="button"
          onClick={() =>
            sendMessage("Reschedule my overdue tasks to Saturday")
          }
          className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white/80 hover:border-primary/50 hover:text-highlight whitespace-nowrap transition-colors"
        >
          <CalendarClock className="w-3 h-3 text-primary" />
          Reschedule Overdue
        </button>
        <button
          type="button"
          onClick={() => sendMessage("Generate my daily briefing")}
          className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white/80 hover:border-primary/50 hover:text-highlight whitespace-nowrap transition-colors"
        >
          <Zap className="w-3 h-3 text-amber-400" />
          Daily Briefing
        </button>
        <button
          type="button"
          onClick={() =>
            sendMessage("Create a batch of 3 study sprint tasks for today")
          }
          className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-white/80 hover:border-primary/50 hover:text-highlight whitespace-nowrap transition-colors"
        >
          <Layers className="w-3 h-3 text-emerald-400" />
          Batch Study Sprint
        </button>
      </div>

      {/* Chat Messages Stream */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${
              m.role === "user" ? "items-end" : "items-start"
            }`}
          >
            <div
              className={`max-w-[92%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-primary text-black font-medium rounded-br-xs"
                  : "border border-white/10 bg-white/[0.05] text-white/90 rounded-bl-xs"
              }`}
            >
              <div className="whitespace-pre-line">{m.content}</div>
            </div>

            {/* Render Interactive Action Confirmation Card if present */}
            {m.actionProposal && (
              <div className="w-full mt-1">
                <ActionConfirmationCard
                  actionType={m.actionProposal.actionType}
                  description={m.actionProposal.description}
                  changes={m.actionProposal.changes}
                  newDueDate={m.actionProposal.newDueDate}
                  onConfirm={() => onConfirmActionProposal(m.actionProposal!)}
                  onDismiss={() => {}}
                />
              </div>
            )}

            <span className="mt-1 px-1 text-[10px] text-white/35">
              {m.timestamp}
            </span>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-highlight/80 px-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span>kite Copilot is computing action proposal...</span>
          </div>
        )}
        <div ref={scrollEndRef} />
      </div>

      {/* Chat Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="border-t border-white/10 bg-black/50 p-3.5"
      >
        <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 focus-within:border-primary transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Copilot to reschedule, batch-create, or brief..."
            className="flex-1 bg-transparent text-xs sm:text-sm text-white placeholder-white/40 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="rounded-lg bg-primary p-2 text-black hover:brightness-110 disabled:opacity-40 transition-all"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </aside>
  );
};

