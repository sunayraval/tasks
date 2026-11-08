export type ThemeName =
  | "monochrome"
  | "cyber_ocean"
  | "warm_slate"
  | "electric_lavender"
  | "alpine_forest"
  | "mint_sunray"
  | "rose_nebula"
  | "custom";

export type VideoPresetName =
  | "aurora"
  | "cyber"
  | "lofi"
  | "particles"
  | "custom";

export function normalizeVideoPreset(raw: unknown): VideoPresetName {
  if (
    raw === "aurora" ||
    raw === "cyber" ||
    raw === "lofi" ||
    raw === "particles" ||
    raw === "custom"
  ) {
    return raw;
  }
  return "aurora";
}

export type AITone = "locked_in" | "chill_coach" | "hyper_drive" | "executive";

export type ViewMode = "slide_drawer" | "center_modal" | "inline";

export type TaskStatus = string;

export type TaskType = string;

export type TaskPriority = string;

export type SectionGroup = string;

export type BadgeColorKey =
  | "slate"
  | "zinc"
  | "red"
  | "orange"
  | "amber"
  | "emerald"
  | "teal"
  | "cyan"
  | "sky"
  | "blue"
  | "indigo"
  | "violet"
  | "purple"
  | "fuchsia"
  | "pink"
  | "rose";

export interface CustomOptionItem {
  id: string;
  label: string;
  color: BadgeColorKey;
}

export interface CustomSectionItem {
  id: string;
  label: string;
  badge: string;
}

export interface ColumnHeadersConfig {
  title: string;
  status: string;
  type: string;
  priority: string;
  due_date: string;
  estimated_minutes: string;
  tags: string;
  notes: string;
}

export interface ThemeColors {
  bgBase: string;
  surface: string;
  accent: string;
  primary: string;
  highlight: string;
}

export interface MyDayBlock {
  id: string;
  taskId: string | null;
  title: string;
  startTime: string; // "HH:mm" (24h format, e.g. "09:00", "14:30")
  endTime: string; // "HH:mm" (24h format)
  durationMinutes: number;
  category?: string;
  priority?: string;
  notes?: string;
  completed?: boolean;
  isBreak?: boolean;
}

export interface MyDaySchedule {
  date: string; // YYYY-MM-DD
  dayStartTime: string; // "HH:mm"
  dayEndTime: string; // "HH:mm"
  blocks: MyDayBlock[];
  autoCascadeTimes?: boolean;
  aiSummary?: string | null;
  updatedAt: string;
}

export type AIProvider = "groq" | "cerebras" | "gemini";

export interface WorkspaceConfig {
  workspaceTitle: string;
  workspaceSubtitle: string;
  brandName: string;
  brandBadge: string;
  showCompletedTasks?: boolean;
  aiProvider?: AIProvider;
  groqApiKey?: string | null;
  cerebrasApiKey?: string | null;
  geminiApiKey?: string | null;
  columnHeaders: ColumnHeadersConfig;
  sections: CustomSectionItem[];
  statuses: CustomOptionItem[];
  types: CustomOptionItem[];
  priorities: CustomOptionItem[];
  tags: CustomOptionItem[];
  customThemeColors?: ThemeColors | null;
  myDaySchedule?: MyDaySchedule | null;
}

export type WorkspaceTab = "chat" | "tasks" | "my_day";

export type AIModelChoice = "flash" | "pro";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  theme: ThemeName;
  custom_theme_json: Record<string, unknown> | null;
  video_bg_preset: VideoPresetName;
  video_bg_dim: number;
  video_bg_blur: number;
  ai_tone: AITone;
  custom_ai_api_key: string | null;
  view_mode: ViewMode;
  canvas_feed_url: string | null;
  created_at?: string;
}

export interface TaskItem {
  id: string;
  user_id: string;
  title: string;
  content: string;
  status: TaskStatus;
  type: TaskType;
  priority: TaskPriority;
  due_date: string | null;
  estimated_minutes: number;
  tags: string[];
  notes: string;
  is_canvas_assignment: boolean;
  canvas_course_code: string | null;
  custom_properties: Record<string, unknown>;
  section_group: SectionGroup;
  order_index: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActionChangeItem {
  id?: string;
  title: string;
  from?: string;
  to: string;
  priority?: TaskPriority;
  type?: TaskType;
  section_group?: SectionGroup;
  estimated_minutes?: number;
}

export interface ActionProposalPayload {
  actionType: "BATCH_RESCHEDULE" | "BATCH_CREATE" | "PRIORITIZE_AND_TAG";
  description: string;
  changes: ActionChangeItem[];
  newDueDate?: string;
}

export interface AgentExecutedAction {
  id: string;
  category:
    | "create"
    | "update"
    | "delete"
    | "move"
    | "header"
    | "theme"
    | "settings"
    | "sync"
    | "schedule";
  summary: string;
  detail?: string;
}

export interface AgentTasksMutation {
  updatedTasks: TaskItem[];
  addedTasks: TaskItem[];
  modifiedTasks: TaskItem[];
  deletedTaskIds: string[];
  reordered: boolean;
}

export type QAQuestionInputType =
  | "textarea"
  | "text"
  | "single_choice"
  | "multi_choice"
  | "timeframe";

export interface QAQuestionItem {
  id: string;
  question: string;
  helperText?: string;
  inputType: QAQuestionInputType;
  options?: string[];
  placeholder?: string;
  quickChips?: string[];
  required?: boolean;
  defaultStartTime?: string;
  defaultEndTime?: string;
}

export type QAPromptPurpose =
  | "plan_day"
  | "project_breakdown"
  | "workspace_setup"
  | "general";

export type QAPromptStatus =
  | "consent"
  | "answering"
  | "submitted"
  | "dismissed";

export interface QASubmissionAnswer {
  questionId: string;
  question: string;
  answer: string;
}

export interface QASubmissionPayload {
  promptId: string;
  purpose: QAPromptPurpose;
  originalRequest: string;
  answers: QASubmissionAnswer[];
  startTime?: string;
  endTime?: string;
}

export interface AgentQAPrompt {
  id: string;
  purpose: QAPromptPurpose;
  originalRequest: string;
  consentTitle: string;
  consentSubtitle: string;
  submitLabel?: string;
  questions: QAQuestionItem[];
  status?: QAPromptStatus;
  submittedAnswers?: QASubmissionAnswer[];
}

export interface AgentWorkspaceMutationPayload {
  executedActions: AgentExecutedAction[];
  tasksMutation?: AgentTasksMutation | null;
  profileUpdates?: Partial<UserProfile> | null;
  workspaceConfigUpdates?: Partial<WorkspaceConfig> | null;
  triggerCanvasSync?: boolean;
  switchTab?: WorkspaceTab | null;
  showMyDayCard?: boolean;
  qaPrompt?: AgentQAPrompt | null;
}

export interface AgentUndoSnapshot {
  tasks: TaskItem[];
  profile: UserProfile;
  workspaceConfig: WorkspaceConfig;
  addedTaskIds: string[];
  deletedTasks: TaskItem[];
  modifiedBefore: TaskItem[];
}

export interface HeroChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  modelUsed?: string;
  executedActions?: AgentExecutedAction[];
  undoSnapshot?: AgentUndoSnapshot | null;
  undone?: boolean;
  isError?: boolean;
  showMyDayCard?: boolean;
  qaPrompt?: AgentQAPrompt | null;
}

export const BADGE_COLOR_MAP: Record<
  BadgeColorKey,
  { bg: string; text: string; border: string; dot: string; label: string }
> = {
  slate: {
    bg: "bg-slate-500/20",
    text: "text-slate-200",
    border: "border-slate-400/40",
    dot: "#94a3b8",
    label: "Slate",
  },
  zinc: {
    bg: "bg-zinc-500/20",
    text: "text-zinc-200",
    border: "border-zinc-400/40",
    dot: "#a1a1aa",
    label: "Zinc",
  },
  red: {
    bg: "bg-red-500/20",
    text: "text-red-300",
    border: "border-red-400/45",
    dot: "#f87171",
    label: "Red",
  },
  orange: {
    bg: "bg-orange-500/20",
    text: "text-orange-300",
    border: "border-orange-400/45",
    dot: "#fb923c",
    label: "Orange",
  },
  amber: {
    bg: "bg-amber-500/20",
    text: "text-amber-200",
    border: "border-amber-400/45",
    dot: "#fbbf24",
    label: "Amber",
  },
  emerald: {
    bg: "bg-emerald-500/20",
    text: "text-emerald-300",
    border: "border-emerald-400/45",
    dot: "#34d399",
    label: "Emerald",
  },
  teal: {
    bg: "bg-teal-500/20",
    text: "text-teal-200",
    border: "border-teal-400/45",
    dot: "#2dd4bf",
    label: "Teal",
  },
  cyan: {
    bg: "bg-cyan-500/20",
    text: "text-cyan-200",
    border: "border-cyan-400/45",
    dot: "#22d3ee",
    label: "Cyan",
  },
  sky: {
    bg: "bg-sky-500/20",
    text: "text-sky-200",
    border: "border-sky-400/45",
    dot: "#38bdf8",
    label: "Sky",
  },
  blue: {
    bg: "bg-blue-500/20",
    text: "text-blue-200",
    border: "border-blue-400/45",
    dot: "#60a5fa",
    label: "Blue",
  },
  indigo: {
    bg: "bg-indigo-500/20",
    text: "text-indigo-200",
    border: "border-indigo-400/45",
    dot: "#818cf8",
    label: "Indigo",
  },
  violet: {
    bg: "bg-violet-500/20",
    text: "text-violet-200",
    border: "border-violet-400/45",
    dot: "#a78bfa",
    label: "Violet",
  },
  purple: {
    bg: "bg-purple-500/20",
    text: "text-purple-200",
    border: "border-purple-400/45",
    dot: "#c084fc",
    label: "Purple",
  },
  fuchsia: {
    bg: "bg-fuchsia-500/20",
    text: "text-fuchsia-200",
    border: "border-fuchsia-400/45",
    dot: "#e879f9",
    label: "Fuchsia",
  },
  pink: {
    bg: "bg-pink-500/20",
    text: "text-pink-200",
    border: "border-pink-400/45",
    dot: "#f472b6",
    label: "Pink",
  },
  rose: {
    bg: "bg-rose-500/20",
    text: "text-rose-200",
    border: "border-rose-400/45",
    dot: "#fb7185",
    label: "Rose",
  },
};

export const BADGE_COLOR_KEYS = Object.keys(BADGE_COLOR_MAP) as BadgeColorKey[];

export function getBadgeClasses(color?: BadgeColorKey): string {
  const c = color && BADGE_COLOR_MAP[color] ? BADGE_COLOR_MAP[color] : BADGE_COLOR_MAP.slate;
  return `${c.bg} ${c.text} ${c.border}`;
}

export const THEME_OPTIONS: Array<{
  id: ThemeName;
  name: string;
  subtitle: string;
  colors: ThemeColors;
}> = [
  {
    id: "cyber_ocean",
    name: "Cyber Ocean",
    subtitle: "Deep abyssal teal, bioluminescent cyan & coral accents",
    colors: {
      bgBase: "#041f24",
      surface: "#0a3c44",
      accent: "#136f7a",
      primary: "#00e5ff",
      highlight: "#a8f9ff",
    },
  },
  {
    id: "electric_lavender",
    name: "Electric Lavender",
    subtitle: "Midnight cosmic indigo, neon violet & electric sky",
    colors: {
      bgBase: "#120e29",
      surface: "#241b4b",
      accent: "#4a358c",
      primary: "#a855f7",
      highlight: "#e9d5ff",
    },
  },
  {
    id: "warm_slate",
    name: "Terracotta Ember",
    subtitle: "Warm espresso slate, sunset terracotta & golden amber",
    colors: {
      bgBase: "#1f1410",
      surface: "#38241d",
      accent: "#6e4230",
      primary: "#f97316",
      highlight: "#fed7aa",
    },
  },
  {
    id: "alpine_forest",
    name: "Alpine Emerald",
    subtitle: "Nordic pine forest, lush emerald & crisp glacial mint",
    colors: {
      bgBase: "#071f18",
      surface: "#103b2e",
      accent: "#1d634d",
      primary: "#10b981",
      highlight: "#a7f3d0",
    },
  },
  {
    id: "mint_sunray",
    name: "Solaris Gold & Teal",
    subtitle: "Rich oceanic emerald with solar gold & sunlit mint",
    colors: {
      bgBase: "#072227",
      surface: "#11464f",
      accent: "#246a73",
      primary: "#facc15",
      highlight: "#fef08a",
    },
  },
  {
    id: "rose_nebula",
    name: "Crimson Nebula",
    subtitle: "Deep velvet plum with neon rose & magenta glow",
    colors: {
      bgBase: "#210918",
      surface: "#3d122d",
      accent: "#701d51",
      primary: "#f43f5e",
      highlight: "#fecdd3",
    },
  },
  {
    id: "monochrome",
    name: "Minimal Monochrome",
    subtitle: "High contrast pure obsidian & crisp white",
    colors: {
      bgBase: "#09090b",
      surface: "#18181b",
      accent: "#27272a",
      primary: "#ffffff",
      highlight: "#f4f4f5",
    },
  },
];

export const SECTION_DIVIDERS: CustomSectionItem[] = [
  { id: "COLLEGE", label: "COLLEGE", badge: "Applications & Deadlines" },
  { id: "TODAY", label: "📅 TODAY", badge: "Immediate Focus" },
  { id: "TMR", label: "📅 TOMORROW", badge: "Tomorrow" },
  { id: "SOON", label: "⏰ SOON", badge: "Upcoming" },
  { id: "REMEMBER", label: "🔔 REMEMBER", badge: "Notes & Reminders" },
];

export const DEFAULT_WORKSPACE_CONFIG: WorkspaceConfig = {
  workspaceTitle: "Daily Workspace",
  workspaceSubtitle:
    "Lock in. You can’t change others, but you can change yourself. Work hard, play hard, and enjoy life.",
  brandName: "kite",
  brandBadge: "Workspace",
  columnHeaders: {
    title: "Task",
    status: "Status",
    type: "Category",
    priority: "Priority",
    due_date: "Due Date",
    estimated_minutes: "Est. Time",
    tags: "Tags",
    notes: "Notes",
  },
  sections: SECTION_DIVIDERS,
  statuses: [
    { id: "To Do", label: "To Do", color: "slate" },
    { id: "In Progress", label: "In Progress", color: "sky" },
    { id: "Blocked", label: "Blocked", color: "red" },
    { id: "Done", label: "Done", color: "emerald" },
  ],
  types: [
    { id: "College", label: "College", color: "violet" },
    { id: "School", label: "School", color: "blue" },
    { id: "Personal", label: "Personal", color: "emerald" },
    { id: "Club", label: "Club", color: "amber" },
    { id: "Work", label: "Work", color: "cyan" },
    { id: "General", label: "General", color: "slate" },
  ],
  priorities: [
    { id: "Urgent", label: "Urgent", color: "red" },
    { id: "High", label: "High", color: "orange" },
    { id: "Medium", label: "Medium", color: "amber" },
    { id: "Low", label: "Low", color: "slate" },
  ],
  tags: [
    { id: "#Focus", label: "#Focus", color: "cyan" },
    { id: "#Urgent", label: "#Urgent", color: "red" },
    { id: "#Exam", label: "#Exam", color: "rose" },
    { id: "#Project", label: "#Project", color: "violet" },
    { id: "#Homework", label: "#Homework", color: "blue" },
    { id: "#Essay", label: "#Essay", color: "amber" },
    { id: "#Lab", label: "#Lab", color: "emerald" },
  ],
  showCompletedTasks: false,
  aiProvider: "groq",
  groqApiKey: null,
  cerebrasApiKey: null,
  geminiApiKey: null,
  customThemeColors: null,
  myDaySchedule: null,
};

export function getWorkspaceConfig(profile: UserProfile): WorkspaceConfig {
  const raw = (profile.custom_theme_json || {}) as Partial<WorkspaceConfig>;
  const rawBrand =
    typeof raw.brandName === "string" ? raw.brandName.trim() : "";
  const normalizedBrand =
    !rawBrand || rawBrand.toLowerCase() === "taskit" ? "kite" : rawBrand;

  return {
    workspaceTitle:
      typeof raw.workspaceTitle === "string"
        ? raw.workspaceTitle
        : DEFAULT_WORKSPACE_CONFIG.workspaceTitle,
    workspaceSubtitle:
      typeof raw.workspaceSubtitle === "string"
        ? raw.workspaceSubtitle
        : DEFAULT_WORKSPACE_CONFIG.workspaceSubtitle,
    brandName: normalizedBrand,
    brandBadge:
      typeof raw.brandBadge === "string"
        ? raw.brandBadge
        : DEFAULT_WORKSPACE_CONFIG.brandBadge,
    showCompletedTasks:
      typeof raw.showCompletedTasks === "boolean"
        ? raw.showCompletedTasks
        : false,
    aiProvider:
      raw.aiProvider === "gemini"
        ? "gemini"
        : raw.aiProvider === "cerebras"
        ? "cerebras"
        : "groq",
    groqApiKey:
      typeof raw.groqApiKey === "string" ? raw.groqApiKey : null,
    cerebrasApiKey:
      typeof raw.cerebrasApiKey === "string" ? raw.cerebrasApiKey : null,
    geminiApiKey:
      typeof raw.geminiApiKey === "string" ? raw.geminiApiKey : null,
    columnHeaders: {
      ...DEFAULT_WORKSPACE_CONFIG.columnHeaders,
      ...(raw.columnHeaders || {}),
    },
    sections:
      Array.isArray(raw.sections) && raw.sections.length > 0
        ? raw.sections
        : DEFAULT_WORKSPACE_CONFIG.sections,
    statuses:
      Array.isArray(raw.statuses) && raw.statuses.length > 0
        ? raw.statuses
        : DEFAULT_WORKSPACE_CONFIG.statuses,
    types:
      Array.isArray(raw.types) && raw.types.length > 0
        ? raw.types
        : DEFAULT_WORKSPACE_CONFIG.types,
    priorities:
      Array.isArray(raw.priorities) && raw.priorities.length > 0
        ? raw.priorities
        : DEFAULT_WORKSPACE_CONFIG.priorities,
    tags:
      Array.isArray(raw.tags) && raw.tags.length > 0
        ? raw.tags
        : DEFAULT_WORKSPACE_CONFIG.tags,
    customThemeColors: raw.customThemeColors || null,
    myDaySchedule:
      raw.myDaySchedule && Array.isArray(raw.myDaySchedule.blocks)
        ? raw.myDaySchedule
        : null,
  };
}
