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
import { Badge, Button, Caption, Card, Input, Text, Title } from "@/components/tailus-ui";
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
      <Button.Root
        type="button"
        variant="solid"
        intent="primary"
        size="md"
        onClick={onToggle}
        className="fixed bottom-6 right-6 z-40 shadow-neon hover:scale-105 transition-transform"
      >
        <Button.Icon type="leading" size="sm">
          <Bot />
        </Button.Icon>
        <Button.Label>kite Copilot</Button.Label>
        <Badge variant="soft" intent="gray" size="xs" className="ml-1">
          {TONE_LABELS[aiTone].label}
        </Badge>
      </Button.Root>
    );
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-40 w-full sm:w-[400px] lg:w-[430px] border-l border-[--ui-border-color] bg-[--ui-bg]/90 backdrop-blur-2xl shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[--ui-border-color] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <Badge variant="soft" intent="primary" size="sm" className="h-9 w-9 p-0 flex items-center justify-center shadow-neon">
            <Bot className="w-5 h-5" />
          </Badge>
          <div>
            <div className="flex items-center gap-2">
              <Title as="h2" size="base" weight="bold" className="text-sm">
                kite Copilot
              </Title>
              <Badge variant="soft" intent="success" size="xs">
                Gemini 1.5 Flash
              </Badge>
            </div>
            <Caption className="block">{TONE_LABELS[aiTone].badge}</Caption>
          </div>
        </div>

        <Button.Root
          type="button"
          variant="ghost"
          intent="gray"
          size="sm"
          onClick={onToggle}
          title="Collapse Copilot"
          aria-label="Collapse Copilot"
        >
          <Button.Icon type="only" size="sm">
            <X />
          </Button.Icon>
        </Button.Root>
      </div>

      {/* Tone Switcher Strip */}
      <div className="flex items-center justify-between gap-1 border-b border-[--ui-border-color] px-4 py-2">
        <Caption className="font-medium shrink-0">AI Tone:</Caption>
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {(Object.keys(TONE_LABELS) as AITone[]).map((tKey) => (
            <Button.Root
              key={tKey}
              type="button"
              variant={aiTone === tKey ? "solid" : "ghost"}
              intent={aiTone === tKey ? "primary" : "gray"}
              size="xs"
              onClick={() => onChangeTone(tKey)}
              className="whitespace-nowrap"
            >
              <Button.Label>{TONE_LABELS[tKey].label}</Button.Label>
            </Button.Root>
          ))}
        </div>
      </div>

      {/* Quick Action Tool Prompts */}
      <div className="flex items-center gap-1.5 overflow-x-auto px-4 py-2.5 border-b border-[--ui-border-color] no-scrollbar">
        <Button.Root
          type="button"
          variant="outlined"
          intent="gray"
          size="xs"
          onClick={() => sendMessage("Reschedule my overdue tasks to Saturday")}
          className="whitespace-nowrap rounded-full"
        >
          <Button.Icon type="leading" size="xs">
            <CalendarClock className="text-primary-500" />
          </Button.Icon>
          <Button.Label>Reschedule Overdue</Button.Label>
        </Button.Root>
        <Button.Root
          type="button"
          variant="outlined"
          intent="gray"
          size="xs"
          onClick={() => sendMessage("Generate my daily briefing")}
          className="whitespace-nowrap rounded-full"
        >
          <Button.Icon type="leading" size="xs">
            <Zap className="text-warning-500" />
          </Button.Icon>
          <Button.Label>Daily Briefing</Button.Label>
        </Button.Root>
        <Button.Root
          type="button"
          variant="outlined"
          intent="gray"
          size="xs"
          onClick={() =>
            sendMessage("Create a batch of 3 study sprint tasks for today")
          }
          className="whitespace-nowrap rounded-full"
        >
          <Button.Icon type="leading" size="xs">
            <Layers className="text-success-500" />
          </Button.Icon>
          <Button.Label>Batch Study Sprint</Button.Label>
        </Button.Root>
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
            {m.role === "user" ? (
              <div className="max-w-[92%] rounded-2xl rounded-br-xs bg-primary-600 px-4 py-3 text-white">
                <Text size="sm" weight="medium" className="my-0 text-white whitespace-pre-line">
                  {m.content}
                </Text>
              </div>
            ) : (
              <Card variant="soft" className="max-w-[92%] rounded-2xl rounded-bl-xs px-4 py-3">
                <Text size="sm" className="my-0 text-body leading-relaxed whitespace-pre-line">
                  {m.content}
                </Text>
              </Card>
            )}

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

            <Caption className="mt-1 px-1 text-[10px]">{m.timestamp}</Caption>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 px-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
            <Caption>kite Copilot is computing action proposal...</Caption>
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
        className="border-t border-[--ui-border-color] p-3.5"
      >
        <div className="flex items-center gap-2">
          <Input
            type="text"
            variant="mixed"
            size="md"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Copilot to reschedule, batch-create, or brief..."
            className="flex-1"
          />
          <Button.Root
            type="submit"
            variant="solid"
            intent="primary"
            size="md"
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
          >
            <Button.Icon type="only" size="sm">
              <Send />
            </Button.Icon>
          </Button.Root>
        </div>
      </form>
    </aside>
  );
};
