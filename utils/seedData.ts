import { DEFAULT_WORKSPACE_CONFIG, TaskItem, UserProfile } from "@/types/taskit";

export const DEFAULT_PROFILE: UserProfile = {
  id: "user-default",
  email: "",
  full_name: null,
  avatar_url: null,
  theme: "cyber_ocean",
  custom_theme_json: DEFAULT_WORKSPACE_CONFIG as unknown as Record<string, unknown>,
  video_bg_preset: "aurora",
  video_bg_dim: 0.45,
  video_bg_blur: 6,
  ai_tone: "locked_in",
  custom_ai_api_key: null,
  view_mode: "slide_drawer",
  canvas_feed_url: "",
};

// Clean, fresh starter list (user can easily delete or add their own)
export const INITIAL_SEED_TASKS: TaskItem[] = [];
