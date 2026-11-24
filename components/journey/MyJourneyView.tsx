"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AIProvider,
  DEFAULT_NVIDIA_MODEL,
  JourneyAgentOperation,
  JourneyAgentTraceItem,
  JourneyCategory,
  JourneyChatMessage,
  JourneyCheckpoint,
  JourneyMilestone,
  JourneyMilestoneStatus,
  JourneyRoadmap,
  JourneyWorkspaceState,
  NVIDIA_MODEL_OPTIONS,
  UserProfile,
  WorkspaceConfig,
  computeJourneyProgress,
  createDefaultJourneyRoadmap,
  normalizeJourneyCategory,
  normalizeJourneyStatus,
} from "@/types/taskit";
import { JourneyMilestoneCard } from "@/components/journey/JourneyMilestoneCard";
import { JourneyAgentChat } from "@/components/journey/JourneyAgentChat";
import { MilestoneEditorModal } from "@/components/journey/MilestoneEditorModal";
import {
  Check,
  ChevronDown,
  Compass,
  Flag,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Input,
  Progress,
  Tabs,
  Text,
  Title,
} from "@/components/tailus-ui";

const LOCAL_JOURNEY_STORAGE_KEY = "kite_my_journey_v1";

function makeLocalId(prefix = "id"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function findMilestoneIndex(
  milestones: JourneyMilestone[],
  targetIdOrTitle: string
): number {
  const q = (targetIdOrTitle || "").trim();
  if (!q) return -1;
  const qLower = q.toLowerCase();

  const byId = milestones.findIndex((m) => m.id === q);
  if (byId !== -1) return byId;

  const byExact = milestones.findIndex(
    (m) => m.title.trim().toLowerCase() === qLower
  );
  if (byExact !== -1) return byExact;

  // Support "milestone 1", "#1", "1"
  const numMatch = /^(?:milestone\s*|#)?(\d+)$/i.exec(q);
  if (numMatch) {
    const idx = parseInt(numMatch[1], 10) - 1;
    if (idx >= 0 && idx < milestones.length) return idx;
  }

  return milestones.findIndex((m) => m.title.toLowerCase().includes(qLower));
}

function applyOperationToRoadmap(
  roadmap: JourneyRoadmap,
  op: JourneyAgentOperation
): {
  nextRoadmap: JourneyRoadmap;
  touchedMilestoneId?: string;
  highlightLabel?: string;
} {
  const nowISO = new Date().toISOString();
  const nextMilestones = roadmap.milestones.map((m) => ({
    ...m,
    checkpoints: m.checkpoints.map((c) => ({ ...c })),
  }));

  if (op.type === "set_journey_meta") {
    return {
      nextRoadmap: {
        ...roadmap,
        title: op.title?.trim() || roadmap.title,
        vision: op.vision?.trim() || roadmap.vision,
        updatedAt: nowISO,
      },
    };
  }

  if (op.type === "clear_milestones") {
    return {
      nextRoadmap: {
        ...roadmap,
        milestones: [],
        updatedAt: nowISO,
      },
    };
  }

  if (op.type === "add_milestone") {
    const newId = op.milestone.id || makeLocalId("ms");
    const status = normalizeJourneyStatus(op.milestone.status);
    const created: JourneyMilestone = {
      id: newId,
      title: op.milestone.title.trim(),
      description: op.milestone.description?.trim() || undefined,
      timeframe: op.milestone.timeframe?.trim() || "Upcoming",
      category: normalizeJourneyCategory(op.milestone.category),
      status,
      checkpoints: (op.milestone.checkpoints || [])
        .filter((s) => typeof s === "string" && s.trim().length > 0)
        .map((title) => ({
          id: makeLocalId("cp"),
          title: title.trim(),
          completed: status === "completed",
        })),
      orderIndex: nextMilestones.length,
      createdAt: nowISO,
      completedAt: status === "completed" ? nowISO : null,
    };

    if (
      typeof op.milestone.insertAtIndex === "number" &&
      op.milestone.insertAtIndex >= 0 &&
      op.milestone.insertAtIndex < nextMilestones.length
    ) {
      nextMilestones.splice(op.milestone.insertAtIndex, 0, created);
    } else {
      nextMilestones.push(created);
    }

    const indexed = nextMilestones.map((m, idx) => ({ ...m, orderIndex: idx }));
    return {
      nextRoadmap: {
        ...roadmap,
        milestones: indexed,
        updatedAt: nowISO,
      },
      touchedMilestoneId: newId,
      highlightLabel: "Added by Agent",
    };
  }

  if (op.type === "update_milestone") {
    const idx = findMilestoneIndex(nextMilestones, op.targetIdOrTitle);
    if (idx === -1) {
      return { nextRoadmap: roadmap };
    }
    const target = { ...nextMilestones[idx] };
    const u = op.updates;

    if (u.title) target.title = u.title.trim();
    if (u.description !== undefined) {
      target.description = u.description.trim() || undefined;
    }
    if (u.timeframe) target.timeframe = u.timeframe.trim();
    if (u.category) target.category = normalizeJourneyCategory(u.category);
    if (u.status) {
      const nextStatus = normalizeJourneyStatus(u.status);
      target.status = nextStatus;
      target.completedAt = nextStatus === "completed" ? nowISO : null;
    }
    if (u.replaceCheckpoints && u.replaceCheckpoints.length > 0) {
      target.checkpoints = u.replaceCheckpoints.map((cp) => ({
        id: makeLocalId("cp"),
        title: cp.title.trim(),
        completed: Boolean(cp.completed),
      }));
    } else if (u.addCheckpoints && u.addCheckpoints.length > 0) {
      const extra = u.addCheckpoints
        .filter((s) => s.trim().length > 0)
        .map((title) => ({
          id: makeLocalId("cp"),
          title: title.trim(),
          completed: false,
        }));
      target.checkpoints = [...target.checkpoints, ...extra];
    }
    if (u.toggleCheckpointTitle) {
      const qLower = u.toggleCheckpointTitle.trim().toLowerCase();
      target.checkpoints = target.checkpoints.map((cp) =>
        cp.title.toLowerCase().includes(qLower)
          ? { ...cp, completed: !cp.completed }
          : cp
      );
    }

    nextMilestones[idx] = target;
    return {
      nextRoadmap: {
        ...roadmap,
        milestones: nextMilestones,
        updatedAt: nowISO,
      },
      touchedMilestoneId: target.id,
      highlightLabel: "Updated by Agent",
    };
  }

  if (op.type === "delete_milestone") {
    const idx = findMilestoneIndex(nextMilestones, op.targetIdOrTitle);
    if (idx === -1) return { nextRoadmap: roadmap };
    nextMilestones.splice(idx, 1);
    const indexed = nextMilestones.map((m, i) => ({ ...m, orderIndex: i }));
    return {
      nextRoadmap: {
        ...roadmap,
        milestones: indexed,
        updatedAt: nowISO,
      },
    };
  }

  if (op.type === "reorder_milestones") {
    const reordered: JourneyMilestone[] = [];
    const usedIds = new Set<string>();
    for (const key of op.orderedIdsOrTitles) {
      const idx = findMilestoneIndex(nextMilestones, key);
      if (idx !== -1 && !usedIds.has(nextMilestones[idx].id)) {
        reordered.push(nextMilestones[idx]);
        usedIds.add(nextMilestones[idx].id);
      }
    }
    for (const m of nextMilestones) {
      if (!usedIds.has(m.id)) {
        reordered.push(m);
      }
    }
    return {
      nextRoadmap: {
        ...roadmap,
        milestones: reordered.map((m, i) => ({ ...m, orderIndex: i })),
        updatedAt: nowISO,
      },
    };
  }

  return { nextRoadmap: roadmap };
}

function buildTraceLabel(op: JourneyAgentOperation): {
  label: string;
  detail?: string;
} {
  if (op.label) {
    return { label: op.label, detail: op.detail };
  }
  switch (op.type) {
    case "set_journey_meta":
      return {
        label: op.title ? `Setting journey: "${op.title}"` : "Updating journey vision",
        detail: op.vision?.slice(0, 64),
      };
    case "clear_milestones":
      return { label: "Clearing previous milestones" };
    case "add_milestone":
      return {
        label: `Adding "${op.milestone.title}"`,
        detail: op.milestone.timeframe,
      };
    case "update_milestone":
      return { label: `Updating "${op.targetIdOrTitle}"`, detail: op.detail };
    case "delete_milestone":
      return { label: `Removing "${op.targetIdOrTitle}"` };
    case "reorder_milestones":
      return { label: "Reordering milestone timeline" };
  }
}

interface MyJourneyViewProps {
  profile: UserProfile;
  workspaceConfig: WorkspaceConfig;
  hasApiKey: boolean;
  effectiveApiKey: string;
  onUpdateWorkspaceConfig: (updates: Partial<WorkspaceConfig>) => void;
  onOpenApiKeySetup: () => void;
  onShowToast: (msg: string) => void;
  onPushMilestoneToTasks?: (milestone: JourneyMilestone) => void;
}

export const MyJourneyView: React.FC<MyJourneyViewProps> = ({
  profile,
  workspaceConfig,
  hasApiKey,
  effectiveApiKey,
  onUpdateWorkspaceConfig,
  onOpenApiKeySetup,
  onShowToast,
  onPushMilestoneToTasks,
}) => {
  const [journeys, setJourneys] = useState<JourneyRoadmap[]>(() => [
    createDefaultJourneyRoadmap(),
  ]);
  const [activeJourneyId, setActiveJourneyId] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<JourneyChatMessage[]>([]);

  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "completed"
  >("all");
  const [journeySwitcherOpen, setJourneySwitcherOpen] = useState(false);

  // Inline editing for Journey title & vision
  const [editingHeader, setEditingHeader] = useState(false);
  const [headerTitleDraft, setHeaderTitleDraft] = useState("");
  const [headerVisionDraft, setHeaderVisionDraft] = useState("");

  // Milestone Editor Modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] =
    useState<JourneyMilestone | null>(null);

  // Agent State
  const [isThinking, setIsThinking] = useState(false);
  const [isExecutingSequence, setIsExecutingSequence] = useState(false);
  const [thinkingSeconds, setThinkingSeconds] = useState(0);
  const [geminiTier, setGeminiTier] = useState<"flash" | "pro">("flash");
  const [highlightedState, setHighlightedState] = useState<{
    id: string;
    label: string;
  } | null>(null);

  const hydratedRef = useRef(false);
  const skipAnimationRef = useRef(false);
  const mountedRef = useRef(true);
  const switcherRef = useRef<HTMLDivElement | null>(null);
  const journeysRef = useRef<JourneyRoadmap[]>(journeys);
  const activeJourneyIdRef = useRef<string>(activeJourneyId);
  const chatMessagesRef = useRef<JourneyChatMessage[]>(chatMessages);

  journeysRef.current = journeys;
  activeJourneyIdRef.current = activeJourneyId;
  chatMessagesRef.current = chatMessages;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      skipAnimationRef.current = true;
    };
  }, []);

  // Close journey switcher on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        switcherRef.current &&
        !switcherRef.current.contains(e.target as Node)
      ) {
        setJourneySwitcherOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Live elapsed timer while thinking
  useEffect(() => {
    if (!isThinking) {
      setThinkingSeconds(0);
      return;
    }
    const timer = setInterval(() => setThinkingSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [isThinking]);

  // Hydrate & merge from workspaceConfig.journeyState and localStorage
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    let localState: JourneyWorkspaceState | null = null;
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(LOCAL_JOURNEY_STORAGE_KEY);
        if (raw) {
          localState = JSON.parse(raw) as JourneyWorkspaceState;
        }
      } catch {}
    }

    const remoteState = workspaceConfig.journeyState || null;
    const remoteTime = remoteState?.updatedAt
      ? new Date(remoteState.updatedAt).getTime()
      : 0;
    const localTime = localState?.updatedAt
      ? new Date(localState.updatedAt).getTime()
      : 0;

    const chosen =
      remoteState && remoteTime >= localTime ? remoteState : localState;

    if (chosen && Array.isArray(chosen.journeys) && chosen.journeys.length > 0) {
      setJourneys(chosen.journeys);
      const validActive = chosen.journeys.some(
        (j) => j.id === chosen.activeJourneyId
      )
        ? chosen.activeJourneyId
        : chosen.journeys[0].id;
      setActiveJourneyId(validActive);
      if (Array.isArray(chosen.chatMessages)) {
        setChatMessages(chosen.chatMessages.slice(-40));
      }
    } else {
      const def = createDefaultJourneyRoadmap();
      setJourneys([def]);
      setActiveJourneyId(def.id);
    }
  }, [workspaceConfig.journeyState]);

  const persistJourneyState = useCallback(
    (
      nextJourneys: JourneyRoadmap[],
      nextActiveId: string,
      nextMessages?: JourneyChatMessage[]
    ) => {
      const payload: JourneyWorkspaceState = {
        activeJourneyId: nextActiveId,
        journeys: nextJourneys,
        chatMessages: (nextMessages ?? chatMessagesRef.current).slice(-40),
        updatedAt: new Date().toISOString(),
      };

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            LOCAL_JOURNEY_STORAGE_KEY,
            JSON.stringify(payload)
          );
        } catch {}
      }

      onUpdateWorkspaceConfig({ journeyState: payload });
    },
    [onUpdateWorkspaceConfig]
  );

  const activeJourney = useMemo(() => {
    return (
      journeys.find((j) => j.id === activeJourneyId) ||
      journeys[0] ||
      createDefaultJourneyRoadmap()
    );
  }, [journeys, activeJourneyId]);

  const progress = useMemo(
    () => computeJourneyProgress(activeJourney),
    [activeJourney]
  );

  const visibleMilestones = useMemo(() => {
    const all = activeJourney.milestones;
    if (statusFilter === "active") {
      return all.filter((m) => m.status !== "completed");
    }
    if (statusFilter === "completed") {
      return all.filter((m) => m.status === "completed");
    }
    return all;
  }, [activeJourney.milestones, statusFilter]);

  const updateActiveJourney = useCallback(
    (
      updater: (curr: JourneyRoadmap) => JourneyRoadmap,
      nextMessages?: JourneyChatMessage[]
    ) => {
      const currList = journeysRef.current;
      const targetId = activeJourneyIdRef.current || currList[0]?.id;
      const nextList = currList.map((j) =>
        j.id === targetId ? updater(j) : j
      );
      setJourneys(nextList);
      journeysRef.current = nextList;
      persistJourneyState(nextList, targetId, nextMessages);
    },
    [persistJourneyState]
  );

  const triggerHighlight = useCallback((id: string, label: string) => {
    setHighlightedState({ id, label });
    setTimeout(() => {
      if (!mountedRef.current) return;
      const el = document.getElementById(`journey-milestone-${id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);
    setTimeout(() => {
      if (!mountedRef.current) return;
      setHighlightedState((prev) => (prev?.id === id ? null : prev));
    }, 2200);
  }, []);

  // Manual CRUD Handlers ("U SET those")
  const handleSaveHeaderEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = headerTitleDraft.trim() || "My Journey";
    const v =
      headerVisionDraft.trim() ||
      "The big milestones I'm building toward over time.";
    updateActiveJourney((curr) => ({
      ...curr,
      title: t,
      vision: v,
      updatedAt: new Date().toISOString(),
    }));
    setEditingHeader(false);
    onShowToast("Updated journey details");
  };

  const handleCreateNewJourney = () => {
    const created = createDefaultJourneyRoadmap(
      `Journey ${journeys.length + 1}`,
      "Define the major milestones you want to accomplish."
    );
    const nextList = [...journeys, created];
    setJourneys(nextList);
    setActiveJourneyId(created.id);
    setJourneySwitcherOpen(false);
    persistJourneyState(nextList, created.id);
    onShowToast(`Created "${created.title}"`);
  };

  const handleDeleteJourney = (id: string) => {
    if (journeys.length <= 1) {
      updateActiveJourney((curr) => ({
        ...curr,
        milestones: [],
        updatedAt: new Date().toISOString(),
      }));
      onShowToast("Cleared all milestones");
      return;
    }
    const nextList = journeys.filter((j) => j.id !== id);
    const nextActive =
      activeJourneyId === id ? nextList[0].id : activeJourneyId;
    setJourneys(nextList);
    setActiveJourneyId(nextActive);
    setJourneySwitcherOpen(false);
    persistJourneyState(nextList, nextActive);
    onShowToast("Deleted journey");
  };

  const handleSaveMilestoneModal = (data: {
    id?: string;
    title: string;
    timeframe: string;
    category: JourneyCategory;
    status: JourneyMilestoneStatus;
    description: string;
    checkpoints: JourneyCheckpoint[];
  }) => {
    const nowISO = new Date().toISOString();
    if (data.id) {
      updateActiveJourney((curr) => ({
        ...curr,
        milestones: curr.milestones.map((m) =>
          m.id === data.id
            ? {
                ...m,
                title: data.title,
                timeframe: data.timeframe,
                category: data.category,
                status: data.status,
                description: data.description || undefined,
                checkpoints: data.checkpoints,
                completedAt: data.status === "completed" ? nowISO : null,
              }
            : m
        ),
        updatedAt: nowISO,
      }));
      onShowToast(`Saved "${data.title}"`);
    } else {
      const newId = makeLocalId("ms");
      const created: JourneyMilestone = {
        id: newId,
        title: data.title,
        timeframe: data.timeframe,
        category: data.category,
        status: data.status,
        description: data.description || undefined,
        checkpoints: data.checkpoints,
        orderIndex: activeJourney.milestones.length,
        createdAt: nowISO,
        completedAt: data.status === "completed" ? nowISO : null,
      };
      updateActiveJourney((curr) => ({
        ...curr,
        milestones: [...curr.milestones, created].map((m, idx) => ({
          ...m,
          orderIndex: idx,
        })),
        updatedAt: nowISO,
      }));
      triggerHighlight(newId, "Milestone Set");
      onShowToast(`Added "${data.title}" to your journey`);
    }
  };

  const handleCycleStatus = (id: string) => {
    const nowISO = new Date().toISOString();
    updateActiveJourney((curr) => ({
      ...curr,
      milestones: curr.milestones.map((m) => {
        if (m.id !== id) return m;
        const nextStatus: JourneyMilestoneStatus =
          m.status === "upcoming"
            ? "in_progress"
            : m.status === "in_progress"
            ? "completed"
            : "upcoming";
        return {
          ...m,
          status: nextStatus,
          completedAt: nextStatus === "completed" ? nowISO : null,
        };
      }),
      updatedAt: nowISO,
    }));
  };

  const handleSetStatus = (id: string, status: JourneyMilestoneStatus) => {
    const nowISO = new Date().toISOString();
    updateActiveJourney((curr) => ({
      ...curr,
      milestones: curr.milestones.map((m) =>
        m.id === id
          ? {
              ...m,
              status,
              completedAt: status === "completed" ? nowISO : null,
            }
          : m
      ),
      updatedAt: nowISO,
    }));
  };

  const handleDeleteMilestone = (id: string) => {
    const target = activeJourney.milestones.find((m) => m.id === id);
    updateActiveJourney((curr) => ({
      ...curr,
      milestones: curr.milestones
        .filter((m) => m.id !== id)
        .map((m, idx) => ({ ...m, orderIndex: idx })),
      updatedAt: new Date().toISOString(),
    }));
    if (target) onShowToast(`Removed "${target.title}"`);
  };

  const handleMoveMilestone = (id: string, direction: "up" | "down") => {
    updateActiveJourney((curr) => {
      const idx = curr.milestones.findIndex((m) => m.id === id);
      if (idx === -1) return curr;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= curr.milestones.length) return curr;
      const copy = [...curr.milestones];
      const [moved] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, moved);
      return {
        ...curr,
        milestones: copy.map((m, i) => ({ ...m, orderIndex: i })),
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const handleToggleCheckpoint = (milestoneId: string, checkpointId: string) => {
    updateActiveJourney((curr) => ({
      ...curr,
      milestones: curr.milestones.map((m) => {
        if (m.id !== milestoneId) return m;
        const nextCps = m.checkpoints.map((cp) =>
          cp.id === checkpointId ? { ...cp, completed: !cp.completed } : cp
        );
        return { ...m, checkpoints: nextCps };
      }),
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleAddCheckpoint = (milestoneId: string, title: string) => {
    updateActiveJourney((curr) => ({
      ...curr,
      milestones: curr.milestones.map((m) =>
        m.id === milestoneId
          ? {
              ...m,
              checkpoints: [
                ...m.checkpoints,
                { id: makeLocalId("cp"), title, completed: false },
              ],
            }
          : m
      ),
      updatedAt: new Date().toISOString(),
    }));
  };

  const handleDeleteCheckpoint = (milestoneId: string, checkpointId: string) => {
    updateActiveJourney((curr) => ({
      ...curr,
      milestones: curr.milestones.map((m) =>
        m.id === milestoneId
          ? {
              ...m,
              checkpoints: m.checkpoints.filter((cp) => cp.id !== checkpointId),
            }
          : m
      ),
      updatedAt: new Date().toISOString(),
    }));
  };

  // =========================================================================
  // SEQUENTIAL AGENT EXECUTOR — adds/updates milestones one-by-one live!
  // =========================================================================
  const handleSendAgentMessage = async (text: string) => {
    if (!hasApiKey) {
      onOpenApiKeySetup();
      return;
    }

    const userMsg: JourneyChatMessage = {
      id: makeLocalId("jmsg"),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };

    const nextHistoryMsgs = [...chatMessagesRef.current, userMsg];
    setChatMessages(nextHistoryMsgs);
    chatMessagesRef.current = nextHistoryMsgs;
    setIsThinking(true);
    skipAnimationRef.current = false;

    try {
      const provider: AIProvider = workspaceConfig.aiProvider || "nvidia";
      const activeNvidiaModel =
        NVIDIA_MODEL_OPTIONS.find((m) => m.id === workspaceConfig.nvidiaModel)
          ?.id || DEFAULT_NVIDIA_MODEL;

      const res = await fetch("/api/journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          journey: activeJourney,
          history: chatMessagesRef.current.slice(-6).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          apiKey: effectiveApiKey,
          nvidiaApiKey: workspaceConfig.nvidiaApiKey || undefined,
          geminiApiKey: workspaceConfig.geminiApiKey || undefined,
          provider,
          nvidiaModel: activeNvidiaModel,
          modelChoice: geminiTier,
          tone: profile.ai_tone,
          cursingMode: Boolean(workspaceConfig.cursingMode),
          clientDateReadable: new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
        }),
      });

      const data = await res.json();
      setIsThinking(false);

      if (!res.ok) {
        const errMsg: JourneyChatMessage = {
          id: makeLocalId("jmsg"),
          role: "assistant",
          content:
            data.reply || data.error || "Could not reach the Journey Agent.",
          timestamp: new Date().toISOString(),
        };
        const updatedMsgs = [...chatMessagesRef.current, errMsg];
        setChatMessages(updatedMsgs);
        chatMessagesRef.current = updatedMsgs;
        persistJourneyState(
          journeysRef.current,
          activeJourneyIdRef.current,
          updatedMsgs
        );
        return;
      }

      const operations: JourneyAgentOperation[] = Array.isArray(data.operations)
        ? data.operations
        : [];
      const replyText: string =
        typeof data.reply === "string" ? data.reply : "";
      const modelUsed: string | undefined = data.modelUsed;

      // No mutations? Just append assistant text reply
      if (operations.length === 0) {
        const replyMsg: JourneyChatMessage = {
          id: makeLocalId("jmsg"),
          role: "assistant",
          content: replyText || "Done!",
          timestamp: new Date().toISOString(),
          modelUsed,
        };
        const updatedMsgs = [...chatMessagesRef.current, replyMsg];
        setChatMessages(updatedMsgs);
        chatMessagesRef.current = updatedMsgs;
        persistJourneyState(
          journeysRef.current,
          activeJourneyIdRef.current,
          updatedMsgs
        );
        return;
      }

      // Build initial pending trace for sequential agent execution
      const initialTrace: JourneyAgentTraceItem[] = operations.map((op, i) => {
        const { label, detail } = buildTraceLabel(op);
        return {
          id: makeLocalId(`tr-${i}`),
          actionType: op.type,
          label,
          detail,
          status: "pending",
        };
      });

      const assistantMsgId = makeLocalId("jmsg");
      const liveAssistantMsg: JourneyChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        trace: initialTrace,
        modelUsed,
      };

      const msgsWithTrace = [...chatMessagesRef.current, liveAssistantMsg];
      setChatMessages(msgsWithTrace);
      chatMessagesRef.current = msgsWithTrace;
      setIsExecutingSequence(true);

      // Ensure user sees added milestones immediately even if filtered on "completed"
      if (
        statusFilter === "completed" &&
        operations.some((op) => op.type === "add_milestone")
      ) {
        setStatusFilter("all");
      }

      const sleep = (ms: number) =>
        new Promise<void>((resolve) => {
          if (skipAnimationRef.current) {
            resolve();
            return;
          }
          setTimeout(resolve, ms);
        });

      const workingTrace = initialTrace.map((t) => ({ ...t }));
      const targetJourneyId = activeJourney.id;
      let workingRoadmap: JourneyRoadmap =
        journeysRef.current.find((j) => j.id === targetJourneyId) ||
        activeJourney;

      const updateAssistantMsg = (
        nextTrace: JourneyAgentTraceItem[],
        finalContent?: string
      ) => {
        const mapped = chatMessagesRef.current.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                trace: nextTrace.map((t) => ({ ...t })),
                ...(finalContent !== undefined ? { content: finalContent } : {}),
              }
            : m
        );
        chatMessagesRef.current = mapped;
        if (mountedRef.current) {
          setChatMessages(mapped);
        }
      };

      for (let i = 0; i < operations.length; i++) {
        // 1) Mark current step "running"
        workingTrace[i] = { ...workingTrace[i], status: "running" };
        updateAssistantMsg(workingTrace);

        await sleep(220);

        // 2) Apply atomic operation to roadmap
        const { nextRoadmap, touchedMilestoneId, highlightLabel } =
          applyOperationToRoadmap(workingRoadmap, operations[i]);
        workingRoadmap = nextRoadmap;

        const nextJourneyList = journeysRef.current.map((j) =>
          j.id === targetJourneyId ? workingRoadmap : j
        );
        journeysRef.current = nextJourneyList;
        if (mountedRef.current) {
          setJourneys(nextJourneyList);
        }

        if (touchedMilestoneId && mountedRef.current && !skipAnimationRef.current) {
          triggerHighlight(
            touchedMilestoneId,
            highlightLabel || "Added by Agent"
          );
        }

        // 3) Mark step "done" and link milestoneId
        workingTrace[i] = {
          ...workingTrace[i],
          status: "done",
          milestoneId: touchedMilestoneId,
        };
        updateAssistantMsg(workingTrace);

        // Persist incrementally so even tab switches preserve every added milestone
        persistJourneyState(
          nextJourneyList,
          targetJourneyId,
          chatMessagesRef.current
        );

        await sleep(290);
      }

      // Finalize assistant reply underneath the completed trace
      updateAssistantMsg(workingTrace, replyText);
      persistJourneyState(
        journeysRef.current,
        targetJourneyId,
        chatMessagesRef.current
      );

      if (mountedRef.current) {
        setIsExecutingSequence(false);
        const addedCount = operations.filter(
          (o) => o.type === "add_milestone"
        ).length;
        if (addedCount > 0) {
          onShowToast(
            `Agent mapped ${addedCount} milestone${
              addedCount === 1 ? "" : "s"
            } onto your journey`
          );
        }
      }
    } catch (err) {
      setIsThinking(false);
      setIsExecutingSequence(false);
      const errMsg: JourneyChatMessage = {
        id: makeLocalId("jmsg"),
        role: "assistant",
        content:
          err instanceof Error
            ? err.message
            : "Something went wrong contacting the Journey Agent.",
        timestamp: new Date().toISOString(),
      };
      const updatedMsgs = [...chatMessagesRef.current, errMsg];
      setChatMessages(updatedMsgs);
      chatMessagesRef.current = updatedMsgs;
    }
  };

  const handleClearChat = () => {
    setChatMessages([]);
    chatMessagesRef.current = [];
    persistJourneyState(journeysRef.current, activeJourneyIdRef.current, []);
  };

  const handleFocusMilestone = (milestoneId: string) => {
    setStatusFilter("all");
    triggerHighlight(milestoneId, "Focused");
  };

  // Compute progress track fill percentage along the vertical spine
  const spineProgressPct = useMemo(() => {
    const ms = visibleMilestones;
    if (ms.length === 0) return 0;
    let highestProgressedIdx = -1;
    ms.forEach((m, idx) => {
      if (m.status === "completed" || m.status === "in_progress") {
        highestProgressedIdx = idx;
      }
    });
    if (highestProgressedIdx < 0) return 0;
    if (ms.length === 1) return ms[0].status === "completed" ? 100 : 50;
    return Math.min(
      100,
      Math.round((highestProgressedIdx / (ms.length - 1)) * 100)
    );
  }, [visibleMilestones]);

  const horizonLabel = useMemo(() => {
    const ms = activeJourney.milestones;
    if (ms.length === 0) return null;
    if (ms.length === 1) return ms[0].timeframe;
    return `${ms[0].timeframe} → ${ms[ms.length - 1].timeframe}`;
  }, [activeJourney.milestones]);

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_390px] xl:grid-cols-[minmax(0,1fr)_420px] gap-5 items-start">
      {/* ================================================================ */}
      {/* LEFT COLUMN: Clean Visual Milestone Journey Canvas               */}
      {/* ================================================================ */}
      <section aria-label="My Journey Visual Roadmap" className="min-w-0 space-y-5">
        {/* Clean Tailus Header Card */}
        <Card
          variant="mixed"
          fancy
          className="relative overflow-hidden backdrop-blur-md"
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {/* Top tiny label + Journey switcher */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge
                  variant="soft"
                  intent="primary"
                  size="xs"
                  className="inline-flex items-center gap-1.5 rounded-full font-mono font-semibold uppercase tracking-wider"
                >
                  <Compass className="size-3" />
                  my journey
                </Badge>

                {/* Multi-journey switcher dropdown */}
                <div className="relative" ref={switcherRef}>
                  <Button.Root
                    variant="outlined"
                    intent="gray"
                    size="xs"
                    onClick={() => setJourneySwitcherOpen((v) => !v)}
                    className="h-6 rounded-full px-2.5 gap-1 text-[11px]"
                  >
                    <Button.Label>
                      {journeys.length > 1
                        ? `Journeys (${journeys.length})`
                        : "Switch / New"}
                    </Button.Label>
                    <Button.Icon type="trailing" size="xs">
                      <ChevronDown className="opacity-60" />
                    </Button.Icon>
                  </Button.Root>

                  {journeySwitcherOpen && (
                    <Card
                      variant="elevated"
                      fancy
                      className="absolute left-0 mt-1.5 w-64 p-1.5 shadow-2xl z-40 backdrop-blur-2xl"
                    >
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-caption">
                        Your Journeys
                      </div>
                      {journeys.map((j) => {
                        const selected = j.id === activeJourney.id;
                        const prog = computeJourneyProgress(j);
                        return (
                          <div
                            key={j.id}
                            className={`flex items-center justify-between gap-1 rounded-[--btn-radius] px-2 py-1.5 text-xs transition-colors ${
                              selected
                                ? "bg-primary-500/15 text-primary-300 font-semibold border border-primary-500/40"
                                : "text-body hover:bg-[--ui-soft-bg] hover:text-title"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setActiveJourneyId(j.id);
                                setJourneySwitcherOpen(false);
                                persistJourneyState(journeys, j.id);
                              }}
                              className="flex-1 text-left truncate"
                            >
                              {j.title}
                              <span className="ml-1.5 text-[10px] font-mono text-caption">
                                ({prog.completed}/{prog.total})
                              </span>
                            </button>
                            {journeys.length > 1 && (
                              <Button.Root
                                variant="ghost"
                                intent="danger"
                                size="xs"
                                onClick={() => handleDeleteJourney(j.id)}
                                title="Delete journey"
                                className="h-6 w-6"
                              >
                                <Button.Icon type="only" size="xs">
                                  <Trash2 />
                                </Button.Icon>
                              </Button.Root>
                            )}
                          </div>
                        );
                      })}
                      <div className="my-1 border-t border-[--ui-border-color]" />
                      <Button.Root
                        variant="ghost"
                        intent="primary"
                        size="xs"
                        onClick={handleCreateNewJourney}
                        className="w-full justify-start"
                      >
                        <Button.Icon type="leading" size="xs">
                          <Plus />
                        </Button.Icon>
                        <Button.Label>New Journey</Button.Label>
                      </Button.Root>
                    </Card>
                  )}
                </div>

                {horizonLabel && (
                  <span className="text-[11px] font-mono text-caption">
                    {horizonLabel}
                  </span>
                )}
              </div>

              {/* Editable Title & Vision */}
              {editingHeader ? (
                <form
                  onSubmit={handleSaveHeaderEdit}
                  className="space-y-2 mt-1 max-w-xl"
                >
                  <Input
                    type="text"
                    autoFocus
                    variant="outlined"
                    size="lg"
                    value={headerTitleDraft}
                    onChange={(e) => setHeaderTitleDraft(e.target.value)}
                    placeholder="Journey title..."
                    className="font-bold"
                  />
                  <Input
                    type="text"
                    variant="outlined"
                    size="sm"
                    value={headerVisionDraft}
                    onChange={(e) => setHeaderVisionDraft(e.target.value)}
                    placeholder="1-line overarching vision..."
                  />
                  <div className="flex items-center gap-2">
                    <Button.Root
                      type="submit"
                      variant="solid"
                      intent="primary"
                      size="xs"
                      className="font-semibold"
                    >
                      <Button.Icon type="leading" size="xs">
                        <Check />
                      </Button.Icon>
                      <Button.Label>Save</Button.Label>
                    </Button.Root>
                    <Button.Root
                      variant="outlined"
                      intent="gray"
                      size="xs"
                      onClick={() => setEditingHeader(false)}
                    >
                      <Button.Icon type="leading" size="xs">
                        <X />
                      </Button.Icon>
                      <Button.Label>Cancel</Button.Label>
                    </Button.Root>
                  </div>
                </form>
              ) : (
                <div className="group/title">
                  <div className="flex items-center gap-2">
                    <Title
                      as="h1"
                      size="2xl"
                      weight="bold"
                      className="tracking-tight leading-tight truncate"
                    >
                      {activeJourney.title}
                    </Title>
                    <Button.Root
                      variant="ghost"
                      intent="gray"
                      size="xs"
                      onClick={() => {
                        setHeaderTitleDraft(activeJourney.title);
                        setHeaderVisionDraft(activeJourney.vision);
                        setEditingHeader(true);
                      }}
                      title="Edit journey title & vision"
                      className="opacity-0 group-hover/title:opacity-100 h-7 w-7"
                    >
                      <Button.Icon type="only" size="xs">
                        <Pencil />
                      </Button.Icon>
                    </Button.Root>
                  </div>
                  <Text size="sm" className="mt-1 text-caption leading-relaxed max-w-2xl">
                    {activeJourney.vision}
                  </Text>
                </div>
              )}
            </div>

            {/* Right: Progress Summary + Manual Add Button */}
            <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2.5 shrink-0">
              <Button.Root
                variant="solid"
                intent="primary"
                size="sm"
                onClick={() => {
                  setEditingMilestone(null);
                  setEditorOpen(true);
                }}
                className="font-semibold"
              >
                <Button.Icon type="leading" size="xs">
                  <Plus className="stroke-[2.5]" />
                </Button.Icon>
                <Button.Label>Add Milestone</Button.Label>
              </Button.Root>

              {progress.total > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <Trophy
                    className={`size-3.5 ${
                      progress.percentage === 100
                        ? "text-success-400"
                        : "text-primary-400"
                    }`}
                  />
                  <span className="font-mono font-semibold text-title">
                    {progress.completed}/{progress.total}
                  </span>
                  <span className="text-caption">reached</span>
                  <Badge variant="soft" intent="primary" size="xs" className="font-mono">
                    {progress.percentage}%
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Sleek thin progress bar hugging bottom edge of header */}
          {progress.total > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gray-800">
              <motion.div
                className="h-full"
                initial={false}
                animate={{ width: `${progress.percentage}%` }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                style={{
                  background:
                    progress.percentage === 100
                      ? "linear-gradient(90deg, #10b981, #34d399)"
                      : "linear-gradient(90deg, var(--primary), var(--highlight))",
                }}
              />
            </div>
          )}
        </Card>

        {/* Minimal Filter Row via Tailus Tabs (only shown when milestones exist) */}
        {activeJourney.milestones.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <Tabs.Root
              value={statusFilter}
              onValueChange={(v) =>
                setStatusFilter(v as "all" | "active" | "completed")
              }
            >
              <Tabs.List
                variant="soft"
                triggerVariant="softToSoft"
                size="sm"
                intent="primary"
                className="border border-[--ui-border-color] bg-[--ui-soft-bg]/90 p-0.5 backdrop-blur-md"
              >
                {(
                  [
                    { id: "all", label: `All (${progress.total})` },
                    {
                      id: "active",
                      label: `Active (${progress.upcoming + progress.inProgress})`,
                    },
                    { id: "completed", label: `Reached (${progress.completed})` },
                  ] as const
                ).map((tab) => (
                  <Tabs.Trigger
                    key={tab.id}
                    value={tab.id}
                    className="px-3 text-[11px] font-semibold data-[state=active]:bg-[--ui-bg] data-[state=active]:text-title data-[state=active]:shadow-sm"
                  >
                    {tab.label}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </Tabs.Root>

            {isExecutingSequence && (
              <Badge
                variant="soft"
                intent="primary"
                size="sm"
                className="inline-flex items-center gap-1.5 rounded-full"
              >
                <Sparkles className="size-3 animate-pulse" />
                Agent is placing milestones sequentially...
              </Badge>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* MAIN VISUAL MILESTONE PATH OR CLEAN EMPTY STATE                */}
        {/* ============================================================== */}
        {activeJourney.milestones.length === 0 ? (
          <Card
            variant="mixed"
            fancy
            className="p-8 sm:p-10 text-center backdrop-blur-xl"
          >
            {/* Minimalist vertical path illustration */}
            <div
              className="mx-auto mb-6 flex flex-col items-center gap-2 select-none"
              aria-hidden="true"
            >
              <div className="size-3.5 rounded-full bg-success-400/80 shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
              <div className="h-6 w-px bg-gradient-to-b from-success-400/70 to-primary-500/60" />
              <div className="size-5 rounded-full border-2 border-primary-500 bg-primary-500/20 flex items-center justify-center">
                <div className="size-1.5 rounded-full bg-primary-400" />
              </div>
              <div className="h-6 w-px border-l border-dashed border-[--ui-border-color]" />
              <div className="size-3.5 rounded-full border border-[--ui-border-color] bg-[--ui-soft-bg]" />
            </div>

            <Title as="h2" size="xl" weight="bold" align="center">
              Map the big milestones you want to accomplish
            </Title>
            <Text size="sm" align="center" className="mt-2 mx-auto max-w-md text-caption leading-relaxed">
              Set milestones yourself or describe your vision to the{" "}
              <span className="text-primary-300 font-semibold">
                Journey Agent
              </span>{" "}
              on the right — it will place them onto your timeline one by one.
            </Text>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button.Root
                variant="solid"
                intent="primary"
                size="sm"
                onClick={() => {
                  setEditingMilestone(null);
                  setEditorOpen(true);
                }}
                className="font-semibold"
              >
                <Button.Icon type="leading" size="xs">
                  <Flag />
                </Button.Icon>
                <Button.Label>Set Your First Milestone</Button.Label>
              </Button.Root>
              {hasApiKey && (
                <Button.Root
                  variant="outlined"
                  intent="gray"
                  size="sm"
                  onClick={() =>
                    handleSendAgentMessage(
                      "Help me build a clean 4-milestone personal & career roadmap for the next 12 months."
                    )
                  }
                  disabled={isThinking || isExecutingSequence}
                >
                  <Button.Icon type="leading" size="xs">
                    <Sparkles className="text-primary-400" />
                  </Button.Icon>
                  <Button.Label>Let Agent Draft Example Path</Button.Label>
                </Button.Root>
              )}
            </div>
          </Card>
        ) : visibleMilestones.length === 0 ? (
          <Card variant="mixed" fancy className="p-8 text-center backdrop-blur-xl">
            <Text size="sm" align="center" className="text-body font-medium">
              No milestones match this filter.
            </Text>
            <div className="mt-3 flex justify-center">
              <Button.Root
                variant="outlined"
                intent="gray"
                size="xs"
                onClick={() => setStatusFilter("all")}
              >
                <Button.Label>Show all milestones</Button.Label>
              </Button.Root>
            </div>
          </Card>
        ) : (
          <div className="relative pb-6">
            {/* Continuous Background Vertical Spine Track (aligned to 40px node center = left-[19px]) */}
            <div
              className="pointer-events-none absolute left-[19px] top-9 bottom-12 w-[2px] rounded-full bg-gray-800 overflow-hidden"
              aria-hidden="true"
            >
              {/* Animated Progress Glow Fill along the spine */}
              <motion.div
                className="w-full rounded-full"
                initial={false}
                animate={{ height: `${spineProgressPct}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                style={{
                  background:
                    "linear-gradient(180deg, #34d399 0%, var(--primary) 75%, transparent 100%)",
                }}
              />
            </div>

            {/* Ordered Milestone Cards */}
            <div className="space-y-4">
              <AnimatePresence initial={false}>
                {visibleMilestones.map((milestone, idx) => (
                  <JourneyMilestoneCard
                    key={milestone.id}
                    milestone={milestone}
                    index={idx}
                    totalCount={visibleMilestones.length}
                    isHighlighted={highlightedState?.id === milestone.id}
                    highlightLabel={
                      highlightedState?.id === milestone.id
                        ? highlightedState.label
                        : undefined
                    }
                    onCycleStatus={handleCycleStatus}
                    onSetStatus={handleSetStatus}
                    onEdit={(m) => {
                      setEditingMilestone(m);
                      setEditorOpen(true);
                    }}
                    onDelete={handleDeleteMilestone}
                    onMove={handleMoveMilestone}
                    onToggleCheckpoint={handleToggleCheckpoint}
                    onAddCheckpoint={handleAddCheckpoint}
                    onDeleteCheckpoint={handleDeleteCheckpoint}
                    onSendToTasks={onPushMilestoneToTasks}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Bottom Waypoint: "+ Add next milestone" directly on the path */}
            <div className="relative mt-5 flex items-center gap-4 sm:gap-5">
              <button
                type="button"
                onClick={() => {
                  setEditingMilestone(null);
                  setEditorOpen(true);
                }}
                className="relative z-10 flex size-10 items-center justify-center rounded-full border border-dashed border-[--ui-border-color] bg-[--ui-bg] text-caption hover:border-primary-500 hover:text-primary-400 hover:bg-primary-500/15 transition-all"
                title="Add next milestone"
              >
                <Plus className="size-4" />
              </button>
              <Button.Root
                variant="ghost"
                intent="gray"
                size="xs"
                onClick={() => {
                  setEditingMilestone(null);
                  setEditorOpen(true);
                }}
                className="text-caption hover:text-primary-300"
              >
                <Button.Label>
                  + Add next milestone to your journey
                </Button.Label>
              </Button.Root>
            </div>
          </div>
        )}
      </section>

      {/* ================================================================ */}
      {/* RIGHT COLUMN: Sticky Sequential Journey AI Agent Chat            */}
      {/* ================================================================ */}
      <JourneyAgentChat
        messages={chatMessages}
        workspaceConfig={workspaceConfig}
        hasApiKey={hasApiKey}
        isThinking={isThinking}
        isExecutingSequence={isExecutingSequence}
        thinkingSeconds={thinkingSeconds}
        geminiTier={geminiTier}
        onChangeGeminiTier={setGeminiTier}
        onUpdateWorkspaceConfig={onUpdateWorkspaceConfig}
        onSendMessage={handleSendAgentMessage}
        onClearChat={handleClearChat}
        onSkipAnimation={() => {
          skipAnimationRef.current = true;
        }}
        onFocusMilestone={handleFocusMilestone}
        onOpenApiKeySetup={onOpenApiKeySetup}
      />

      {/* Manual Milestone Create / Edit Modal */}
      <MilestoneEditorModal
        isOpen={editorOpen}
        initialMilestone={editingMilestone}
        onClose={() => {
          setEditorOpen(false);
          setEditingMilestone(null);
        }}
        onSave={handleSaveMilestoneModal}
      />
    </div>
  );
};
