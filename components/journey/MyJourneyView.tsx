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
        {/* Clean Header Card */}
        <div className="relative overflow-hidden rounded-2xl border theme-panel p-5 sm:p-6 backdrop-blur-2xl">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {/* Top tiny label + Journey switcher */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-primary/15 px-2.5 py-0.5 text-[10.5px] font-mono font-semibold uppercase tracking-wider text-highlight">
                  <Compass className="w-3 h-3 text-primary" />
                  my journey
                </span>

                {/* Multi-journey switcher dropdown */}
                <div className="relative" ref={switcherRef}>
                  <button
                    type="button"
                    onClick={() => setJourneySwitcherOpen((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-white/70 hover:text-white transition-colors"
                  >
                    <span>
                      {journeys.length > 1
                        ? `Journeys (${journeys.length})`
                        : "Switch / New"}
                    </span>
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>

                  {journeySwitcherOpen && (
                    <div className="absolute left-0 mt-1.5 w-64 rounded-xl border theme-popover p-1.5 shadow-2xl z-40">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/45">
                        Your Journeys
                      </div>
                      {journeys.map((j) => {
                        const selected = j.id === activeJourney.id;
                        const prog = computeJourneyProgress(j);
                        return (
                          <div
                            key={j.id}
                            className={`flex items-center justify-between gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors ${
                              selected
                                ? "bg-primary/20 text-highlight font-semibold border border-primary/40"
                                : "text-white/75 hover:bg-white/10 hover:text-white"
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
                              <span className="ml-1.5 text-[10px] font-mono text-white/45">
                                ({prog.completed}/{prog.total})
                              </span>
                            </button>
                            {journeys.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteJourney(j.id)}
                                title="Delete journey"
                                className="p-1 text-white/35 hover:text-rose-400"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                      <div className="my-1 border-t border-white/10" />
                      <button
                        type="button"
                        onClick={handleCreateNewJourney}
                        className="w-full flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        New Journey
                      </button>
                    </div>
                  )}
                </div>

                {horizonLabel && (
                  <span className="text-[11px] font-mono text-white/45">
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
                  <input
                    type="text"
                    autoFocus
                    value={headerTitleDraft}
                    onChange={(e) => setHeaderTitleDraft(e.target.value)}
                    placeholder="Journey title..."
                    className="w-full rounded-xl border theme-input px-3 py-1.5 text-lg font-bold focus:outline-none"
                  />
                  <input
                    type="text"
                    value={headerVisionDraft}
                    onChange={(e) => setHeaderVisionDraft(e.target.value)}
                    placeholder="1-line overarching vision..."
                    className="w-full rounded-xl border theme-input px-3 py-1.5 text-xs text-white/85 focus:outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs font-bold text-zinc-950"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingHeader(false)}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-white/70 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="group/title">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-tight truncate">
                      {activeJourney.title}
                    </h1>
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderTitleDraft(activeJourney.title);
                        setHeaderVisionDraft(activeJourney.vision);
                        setEditingHeader(true);
                      }}
                      title="Edit journey title & vision"
                      className="opacity-0 group-hover/title:opacity-100 rounded-lg p-1 text-white/45 hover:text-white hover:bg-white/10 transition-all"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-white/65 leading-relaxed max-w-2xl">
                    {activeJourney.vision}
                  </p>
                </div>
              )}
            </div>

            {/* Right: Progress Summary + Manual Add Button */}
            <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setEditingMilestone(null);
                  setEditorOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-zinc-950 hover:opacity-90 transition-all shadow-lg"
              >
                <Plus className="w-4 h-4" strokeWidth={2.6} />
                Add Milestone
              </button>

              {progress.total > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <Trophy
                    className={`w-3.5 h-3.5 ${
                      progress.percentage === 100
                        ? "text-emerald-400"
                        : "text-primary/80"
                    }`}
                  />
                  <span className="font-mono font-semibold text-white/90">
                    {progress.completed}/{progress.total}
                  </span>
                  <span className="text-white/50">reached</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10.5px] font-mono text-highlight">
                    {progress.percentage}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Sleek thin progress bar hugging bottom edge of header */}
          {progress.total > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10">
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
        </div>

        {/* Minimal Filter Row (only shown when milestones exist) */}
        {activeJourney.milestones.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="inline-flex items-center rounded-full border border-white/12 bg-black/30 p-0.5 backdrop-blur-md">
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
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${
                    statusFilter === tab.id
                      ? "bg-white/15 text-white shadow-sm"
                      : "text-white/55 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {isExecutingSequence && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/45 bg-primary/15 px-3 py-1 text-[11px] font-semibold text-highlight">
                <Sparkles className="w-3 h-3 animate-pulse text-primary" />
                Agent is placing milestones sequentially...
              </span>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* MAIN VISUAL MILESTONE PATH OR CLEAN EMPTY STATE                */}
        {/* ============================================================== */}
        {activeJourney.milestones.length === 0 ? (
          <div className="rounded-2xl border theme-panel p-8 sm:p-10 text-center backdrop-blur-xl">
            {/* Minimalist vertical path illustration */}
            <div
              className="mx-auto mb-6 flex flex-col items-center gap-2 select-none"
              aria-hidden="true"
            >
              <div className="h-3.5 w-3.5 rounded-full bg-emerald-400/80 shadow-[0_0_12px_rgba(52,211,153,0.6)]" />
              <div className="h-6 w-px bg-gradient-to-b from-emerald-400/70 to-primary/60" />
              <div className="h-5 w-5 rounded-full border-2 border-primary bg-primary/20 shadow-[0_0_18px_color-mix(in_srgb,var(--primary)_60%,transparent)] flex items-center justify-center">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              </div>
              <div className="h-6 w-px border-l border-dashed border-white/25" />
              <div className="h-3.5 w-3.5 rounded-full border border-white/30 bg-white/5" />
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Map the big milestones you want to accomplish
            </h2>
            <p className="mt-2 mx-auto max-w-md text-xs sm:text-sm text-white/60 leading-relaxed">
              Set milestones yourself or describe your vision to the{" "}
              <span className="text-highlight font-semibold">Journey Agent</span>{" "}
              on the right — it will place them onto your timeline one by one.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingMilestone(null);
                  setEditorOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-zinc-950 hover:opacity-90 transition-all shadow-lg"
              >
                <Flag className="w-3.5 h-3.5" />
                Set Your First Milestone
              </button>
              {hasApiKey && (
                <button
                  type="button"
                  onClick={() =>
                    handleSendAgentMessage(
                      "Help me build a clean 4-milestone personal & career roadmap for the next 12 months."
                    )
                  }
                  disabled={isThinking || isExecutingSequence}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-4 py-2.5 text-xs font-semibold text-white/90 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  Let Agent Draft Example Path
                </button>
              )}
            </div>
          </div>
        ) : visibleMilestones.length === 0 ? (
          <div className="rounded-2xl border theme-panel p-8 text-center backdrop-blur-xl">
            <p className="text-sm font-medium text-white/75">
              No milestones match this filter.
            </p>
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className="mt-3 rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
            >
              Show all milestones
            </button>
          </div>
        ) : (
          <div className="relative pb-6">
            {/* Continuous Background Vertical Spine Track (aligned to 40px node center = left-[19px]) */}
            <div
              className="pointer-events-none absolute left-[19px] top-9 bottom-12 w-[2px] rounded-full bg-white/12 overflow-hidden"
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
                className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-white/25 bg-black/45 text-white/60 hover:border-primary hover:text-primary hover:bg-primary/15 transition-all"
                title="Add next milestone"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingMilestone(null);
                  setEditorOpen(true);
                }}
                className="text-xs font-semibold text-white/50 hover:text-highlight transition-colors"
              >
                + Add next milestone to your journey
              </button>
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
