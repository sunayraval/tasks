export type JourneyMilestoneStatus = "upcoming" | "in_progress" | "completed";

export type JourneyCategory =
  | "career"
  | "academics"
  | "startup"
  | "health"
  | "creative"
  | "finance"
  | "personal"
  | "custom";

export interface JourneyCheckpoint {
  id: string;
  title: string;
  completed: boolean;
}

export interface JourneyMilestone {
  id: string;
  title: string;
  description?: string;
  timeframe: string; // e.g. "Dec 2026", "Q1 2027", "Summer 2027"
  category: JourneyCategory;
  status: JourneyMilestoneStatus;
  checkpoints: JourneyCheckpoint[];
  orderIndex: number;
  createdAt: string;
  completedAt?: string | null;
}

export interface JourneyRoadmap {
  id: string;
  title: string;
  vision: string;
  milestones: JourneyMilestone[];
  createdAt: string;
  updatedAt: string;
}

export type JourneyAgentStepStatus = "pending" | "running" | "done";

export type JourneyAgentOperation =
  | {
      type: "set_journey_meta";
      label?: string;
      detail?: string;
      title?: string;
      vision?: string;
    }
  | {
      type: "clear_milestones";
      label?: string;
      detail?: string;
    }
  | {
      type: "add_milestone";
      label?: string;
      detail?: string;
      milestone: {
        id?: string;
        title: string;
        description?: string;
        timeframe: string;
        category?: JourneyCategory;
        status?: JourneyMilestoneStatus;
        checkpoints?: string[];
        insertAtIndex?: number;
      };
    }
  | {
      type: "update_milestone";
      label?: string;
      detail?: string;
      targetIdOrTitle: string;
      updates: {
        title?: string;
        description?: string;
        timeframe?: string;
        category?: JourneyCategory;
        status?: JourneyMilestoneStatus;
        addCheckpoints?: string[];
        replaceCheckpoints?: Array<{ title: string; completed?: boolean }>;
        toggleCheckpointTitle?: string;
      };
    }
  | {
      type: "delete_milestone";
      label?: string;
      detail?: string;
      targetIdOrTitle: string;
    }
  | {
      type: "reorder_milestones";
      label?: string;
      detail?: string;
      orderedIdsOrTitles: string[];
    };

export interface JourneyAgentTraceItem {
  id: string;
  actionType: JourneyAgentOperation["type"];
  label: string;
  detail?: string;
  status: JourneyAgentStepStatus;
  milestoneId?: string;
}

export interface JourneyChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  trace?: JourneyAgentTraceItem[];
  modelUsed?: string;
}

export interface JourneyWorkspaceState {
  activeJourneyId: string;
  journeys: JourneyRoadmap[];
  chatMessages?: JourneyChatMessage[];
  updatedAt: string;
}

export interface JourneyProgressMetrics {
  total: number;
  completed: number;
  inProgress: number;
  upcoming: number;
  percentage: number;
}

export const JOURNEY_CATEGORY_META: Record<
  JourneyCategory,
  {
    label: string;
    dotColor: string;
    badgeBg: string;
    badgeBorder: string;
    badgeText: string;
  }
> = {
  career: {
    label: "Career",
    dotColor: "#38bdf8",
    badgeBg: "rgba(56, 189, 248, 0.14)",
    badgeBorder: "rgba(56, 189, 248, 0.34)",
    badgeText: "#bae6fd",
  },
  academics: {
    label: "Academics",
    dotColor: "#a78bfa",
    badgeBg: "rgba(167, 139, 250, 0.14)",
    badgeBorder: "rgba(167, 139, 250, 0.34)",
    badgeText: "#ddd6fe",
  },
  startup: {
    label: "Build / Startup",
    dotColor: "#f59e0b",
    badgeBg: "rgba(245, 158, 11, 0.14)",
    badgeBorder: "rgba(245, 158, 11, 0.34)",
    badgeText: "#fde68a",
  },
  health: {
    label: "Health & Fitness",
    dotColor: "#34d399",
    badgeBg: "rgba(52, 211, 153, 0.14)",
    badgeBorder: "rgba(52, 211, 153, 0.34)",
    badgeText: "#a7f3d0",
  },
  creative: {
    label: "Creative",
    dotColor: "#f472b6",
    badgeBg: "rgba(244, 114, 182, 0.14)",
    badgeBorder: "rgba(244, 114, 182, 0.34)",
    badgeText: "#fbcfe8",
  },
  finance: {
    label: "Finance",
    dotColor: "#2dd4bf",
    badgeBg: "rgba(45, 212, 191, 0.14)",
    badgeBorder: "rgba(45, 212, 191, 0.34)",
    badgeText: "#99f6e4",
  },
  personal: {
    label: "Personal",
    dotColor: "#fb7185",
    badgeBg: "rgba(251, 113, 133, 0.14)",
    badgeBorder: "rgba(251, 113, 133, 0.34)",
    badgeText: "#fecdd3",
  },
  custom: {
    label: "Milestone",
    dotColor: "#94a3b8",
    badgeBg: "rgba(148, 163, 184, 0.14)",
    badgeBorder: "rgba(148, 163, 184, 0.34)",
    badgeText: "#e2e8f0",
  },
};

export function normalizeJourneyCategory(raw?: string): JourneyCategory {
  const c = (raw || "").trim().toLowerCase();
  if (c === "career" || c === "work" || c === "job") return "career";
  if (
    c === "academics" ||
    c === "school" ||
    c === "college" ||
    c === "education" ||
    c === "study"
  ) {
    return "academics";
  }
  if (
    c === "startup" ||
    c === "build" ||
    c === "project" ||
    c === "business" ||
    c === "product"
  ) {
    return "startup";
  }
  if (
    c === "health" ||
    c === "fitness" ||
    c === "wellness" ||
    c === "athletics"
  ) {
    return "health";
  }
  if (c === "creative" || c === "art" || c === "content" || c === "music") {
    return "creative";
  }
  if (c === "finance" || c === "money" || c === "investing") return "finance";
  if (c === "personal" || c === "life" || c === "travel" || c === "growth") {
    return "personal";
  }
  return "custom";
}

export function normalizeJourneyStatus(raw?: string): JourneyMilestoneStatus {
  const s = (raw || "").trim().toLowerCase();
  if (s === "completed" || s === "done" || s === "reached" || s === "finished") {
    return "completed";
  }
  if (
    s === "in_progress" ||
    s === "in progress" ||
    s === "active" ||
    s === "current"
  ) {
    return "in_progress";
  }
  return "upcoming";
}

export function computeJourneyProgress(
  journey: JourneyRoadmap | null | undefined
): JourneyProgressMetrics {
  const milestones = journey?.milestones || [];
  const total = milestones.length;
  if (total === 0) {
    return { total: 0, completed: 0, inProgress: 0, upcoming: 0, percentage: 0 };
  }
  const completed = milestones.filter((m) => m.status === "completed").length;
  const inProgress = milestones.filter((m) => m.status === "in_progress").length;
  const upcoming = Math.max(0, total - completed - inProgress);
  const percentage = Math.round((completed / total) * 100);
  return { total, completed, inProgress, upcoming, percentage };
}

export function createDefaultJourneyRoadmap(
  title = "My Journey",
  vision = "The big milestones I'm building toward over time."
): JourneyRoadmap {
  const nowISO = new Date().toISOString();
  return {
    id: `jrn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    vision,
    milestones: [],
    createdAt: nowISO,
    updatedAt: nowISO,
  };
}
