export type ThemeName =
  | "monochrome"
  | "cyber_ocean"
  | "warm_slate"
  | "electric_lavender"
  | "alpine_forest"
  | "mint_sunray";

export type VideoPresetName = "rain" | "cyber" | "lofi" | "particles" | "custom";

export type AITone = "locked_in" | "chill_coach" | "hyper_drive" | "executive";

export type ViewMode = "slide_drawer" | "center_modal" | "inline";

export type TaskStatus = "To Do" | "In Progress" | "Blocked" | "Done";

export type TaskType = "College" | "School" | "Personal" | "Club" | "Work" | "General";

export type TaskPriority = "Urgent" | "High" | "Medium" | "Low";

export type SectionGroup = "COLLEGE" | "TODAY" | "TMR" | "SOON" | "REMEMBER";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  theme: ThemeName;
  custom_theme_json: Record<string, string> | null;
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

export const THEME_OPTIONS: Array<{
  id: ThemeName;
  name: string;
  subtitle: string;
  colors: {
    bgBase: string;
    surface: string;
    accent: string;
    primary: string;
    highlight: string;
  };
}> = [
  {
    id: "monochrome",
    name: "Minimal Monochrome",
    subtitle: "High contrast pure black & white, distraction-free",
    colors: {
      bgBase: "#09090b",
      surface: "#18181b",
      accent: "#27272a",
      primary: "#ffffff",
      highlight: "#f4f4f5",
    },
  },
  {
    id: "cyber_ocean",
    name: "Cyber Ocean",
    subtitle: "Deep abyssal teal & neon cyan glow",
    colors: {
      bgBase: "#003135",
      surface: "#024950",
      accent: "#964734",
      primary: "#0FA4AF",
      highlight: "#AFDDE5",
    },
  },
  {
    id: "warm_slate",
    name: "Warm Slate / Terracotta",
    subtitle: "Charcoal slate with warm terracotta & amber",
    colors: {
      bgBase: "#2C3531",
      surface: "#116466",
      accent: "#D9B08C",
      primary: "#FFCB9A",
      highlight: "#D1E8E2",
    },
  },
  {
    id: "electric_lavender",
    name: "Electric Sky / Lavender",
    subtitle: "Midnight indigo with electric sky & violet",
    colors: {
      bgBase: "#1E2342",
      surface: "#5680E9",
      accent: "#8860D0",
      primary: "#5AB9EA",
      highlight: "#C1C8E4",
    },
  },
  {
    id: "alpine_forest",
    name: "Alpine Forest / Slate",
    subtitle: "Nordic pine, coastal slate & crisp ice",
    colors: {
      bgBase: "#1C2522",
      surface: "#31708E",
      accent: "#687864",
      primary: "#5085A5",
      highlight: "#8FC1E3",
    },
  },
  {
    id: "mint_sunray",
    name: "Mint Sunray",
    subtitle: "Emerald depths with solar gold & mint",
    colors: {
      bgBase: "#023035",
      surface: "#026670",
      accent: "#FCE181",
      primary: "#9FEDD7",
      highlight: "#FEF9C7",
    },
  },
];

export const SECTION_DIVIDERS: Array<{
  id: SectionGroup;
  label: string;
  badge: string;
}> = [
  { id: "COLLEGE", label: "——— COLLEGE ———", badge: "Applications & Deadlines" },
  { id: "TODAY", label: "——— 📅 TODAY 📅 ———", badge: "Immediate Focus" },
  { id: "TMR", label: "——— 📅 TMR 📅 ———", badge: "Tomorrow" },
  { id: "SOON", label: "——— ⏰ SOON ⏰ ———", badge: "Upcoming" },
  { id: "REMEMBER", label: "——— 🔔 REMEMBER 🔔 ———", badge: "Notes & Reminders" },
];
