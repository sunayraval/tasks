"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import {
  AIProvider,
  AgentUndoSnapshot,
  AgentWorkspaceMutationPayload,
  DEFAULT_NVIDIA_MODEL,
  DEFAULT_WORKSPACE_CONFIG,
  getWorkspaceConfig,
  HeroChatMessage,
  JourneyMilestone,
  normalizeVideoPreset,
  SectionGroup,
  SubTask,
  TaskItem,
  UserProfile,
  WorkspaceConfig,
  WorkspaceTab,
} from "@/types/taskit";
import { DEFAULT_PROFILE, INITIAL_SEED_TASKS } from "@/utils/seedData";
import { createClient, isSupabaseConfigured } from "@/utils/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { VideoBackground } from "@/components/background/VideoBackground";
import { TopNavBar } from "@/components/dashboard/TopNavBar";
import { LeftSidebarNav } from "@/components/dashboard/LeftSidebarNav";
import { GeminiHeroChat } from "@/components/ai/GeminiHeroChat";
import {
  EnrichedMyDayBlock,
  getLocalDateYMD,
  isTaskDoneStatus,
  pruneAndSyncMyDaySchedule,
  syncTasksWithHeadersAndFilter,
} from "@/utils/myDayUtils";
import { KiteFlyingLoader } from "@/components/ui/KiteBrand";
import type { SettingsTabId } from "@/components/settings/SettingsModal";
import { CheckCircle2 } from "lucide-react";

const TabLoader = () => (
  <div className="flex-1 flex items-center justify-center py-20">
    <KiteFlyingLoader label="loading view" compact />
  </div>
);

const CircularProgress = dynamic(
  () =>
    import("@/components/dashboard/CircularProgress").then(
      (m) => m.CircularProgress
    ),
  { ssr: false }
);

const TaskTable = dynamic(
  () => import("@/components/tasks/TaskTable").then((m) => m.TaskTable),
  { ssr: false, loading: TabLoader }
);

const MyDayView = dynamic(
  () => import("@/components/myday/MyDayView").then((m) => m.MyDayView),
  { ssr: false, loading: TabLoader }
);

const MyJourneyView = dynamic(
  () =>
    import("@/components/journey/MyJourneyView").then((m) => m.MyJourneyView),
  { ssr: false, loading: TabLoader }
);

const MyStatsView = dynamic(
  () => import("@/components/stats/MyStatsView").then((m) => m.MyStatsView),
  { ssr: false, loading: TabLoader }
);

const StudyModeView = dynamic(
  () =>
    import("@/components/study/StudyModeView").then((m) => m.StudyModeView),
  { ssr: false, loading: TabLoader }
);

const KiteMarketingPage = dynamic(
  () =>
    import("@/components/marketing/KiteMarketingPage").then(
      (m) => m.KiteMarketingPage
    ),
  { ssr: false, loading: TabLoader }
);

const GeminiSetupModal = dynamic(
  () =>
    import("@/components/ai/GeminiSetupModal").then((m) => m.GeminiSetupModal),
  { ssr: false }
);

const SettingsModal = dynamic(
  () =>
    import("@/components/settings/SettingsModal").then((m) => m.SettingsModal),
  { ssr: false }
);

const QuickCreateTaskModal = dynamic(
  () =>
    import("@/components/tasks/QuickCreateTaskModal").then(
      (m) => m.QuickCreateTaskModal
    ),
  { ssr: false }
);

const CanvasSyncModal = dynamic(
  () =>
    import("@/components/canvas/CanvasSyncModal").then(
      (m) => m.CanvasSyncModal
    ),
  { ssr: false }
);

const LOCAL_STORAGE_CONFIG_KEY = "taskit_workspace_config_v1";
const LOCAL_STORAGE_PROFILE_PREFS_KEY = "kite_profile_prefs_v1";
const HEADERS_SEEDED_STORAGE_KEY = "taskit_doc_headers_seeded_v1";
const GEMINI_API_KEY_STORAGE_KEY = "taskit_gemini_api_key_v1";
const AI_TEMP_DISABLED_SESSION_KEY = "taskit_ai_temp_disabled_v1";
const HERO_CHAT_MESSAGES_SESSION_KEY = "taskit_hero_chat_msgs_v1";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function generateUUID(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function buildDefaultHeaderRowsForTasks(
  userId: string,
  existingTasks: TaskItem[],
  sections = DEFAULT_WORKSPACE_CONFIG.sections
): { combined: TaskItem[]; createdHeaders: TaskItem[] } {
  const nowISO = new Date().toISOString();
  const combined: TaskItem[] = [];
  const createdHeaders: TaskItem[] = [];
  const placedTaskIds = new Set<string>();

  sections.forEach((sec) => {
    const headerItem: TaskItem = {
      id: generateUUID(),
      user_id: userId,
      title: `——— ${sec.label} ———`,
      content: "",
      status: "To Do",
      type: "General",
      priority: "Medium",
      due_date: null,
      estimated_minutes: 0,
      tags: [],
      notes: "",
      is_canvas_assignment: false,
      canvas_course_code: null,
      custom_properties: { is_header: true },
      section_group: sec.id,
      order_index: 0,
      completed_at: null,
      created_at: nowISO,
      updated_at: nowISO,
    };
    createdHeaders.push(headerItem);
    combined.push(headerItem);

    for (const t of existingTasks) {
      if (!placedTaskIds.has(t.id) && t.section_group === sec.id) {
        combined.push(t);
        placedTaskIds.add(t.id);
      }
    }
  });

  for (const t of existingTasks) {
    if (!placedTaskIds.has(t.id)) {
      combined.push(t);
      placedTaskIds.add(t.id);
    }
  }

  const indexed = combined.map((item, i) => ({
    ...item,
    order_index: i,
  }));

  const indexedHeaders = indexed.filter((item) =>
    Boolean(item.custom_properties?.is_header)
  );

  return { combined: indexed, createdHeaders: indexedHeaders };
}

export default function KiteWorkspacePage() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_SEED_TASKS);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("chat");
  const [heroResetNonce, setHeroResetNonce] = useState<number>(0);
  const [queuedChatPrompt, setQueuedChatPrompt] = useState<{
    nonce: number;
    text: string;
  } | null>(null);
  const [localApiKey, setLocalApiKey] = useState<string>("");
  const [aiTemporarilyDisabled, setAiTemporarilyDisabled] =
    useState<boolean>(false);
  const [isGeminiSetupOpen, setIsGeminiSetupOpen] = useState<boolean>(false);
  const [heroMessages, setHeroMessages] = useState<HeroChatMessage[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTabId>("customize");
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState<boolean>(false);
  const [newTaskDefaultSection] = useState<SectionGroup>("TODAY");
  const [customVideoVersion, setCustomVideoVersion] = useState<number>(0);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [isSyncingCanvas, setIsSyncingCanvas] = useState<boolean>(false);
  const [isCanvasSyncModalOpen, setIsCanvasSyncModalOpen] =
    useState<boolean>(false);
  const [isCommittingCanvas, setIsCommittingCanvas] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Persistent tracking of deleted task IDs to eliminate any re-query flicker
  const deletedTaskIdsRef = useRef<Set<string>>(new Set());
  const hasAutoPromptedSetupRef = useRef<boolean>(false);
  const chatHydratedRef = useRef<boolean>(false);
  const lastLocalProfileWriteRef = useRef<number>(0);
  const authUserIdRef = useRef<string | null>(null);
  const authUserEmailRef = useRef<string>("");
  const profileRef = useRef<UserProfile>(profile);
  profileRef.current = profile;
  const tasksRef = useRef<TaskItem[]>(tasks);
  tasksRef.current = tasks;
  const workspaceConfigSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const pendingWorkspaceConfigJsonRef = useRef<Record<string, unknown> | null>(
    null
  );

  const workspaceConfig = useMemo(() => getWorkspaceConfig(profile), [profile]);

  const supabaseEnabled = isSupabaseConfigured();
  const canAccessWorkspace = isAuthenticated || !supabaseEnabled;

  const effectiveApiKey = useMemo(() => {
    const isNvKey = (k?: string | null): k is string =>
      Boolean(k && k.trim().startsWith("nvapi-") && k.trim().length >= 15);
    const isGemKey = (k?: string | null): k is string =>
      Boolean(k && k.trim().startsWith("AIza") && k.trim().length >= 15);

    const provider: AIProvider = workspaceConfig.aiProvider || "nvidia";
    const nvKey =
      (isNvKey(workspaceConfig.nvidiaApiKey)
        ? workspaceConfig.nvidiaApiKey
        : null) ||
      (profile.custom_ai_api_key?.startsWith("nvapi-")
        ? profile.custom_ai_api_key
        : null) ||
      (localApiKey?.startsWith("nvapi-") ? localApiKey : null) ||
      "";

    const gemKey =
      (isGemKey(workspaceConfig.geminiApiKey)
        ? workspaceConfig.geminiApiKey
        : null) ||
      (profile.custom_ai_api_key?.startsWith("AIza")
        ? profile.custom_ai_api_key
        : null) ||
      (localApiKey?.startsWith("AIza") ? localApiKey : null) ||
      "";

    if (provider === "nvidia") {
      return nvKey.trim();
    }
    return gemKey.trim();
  }, [
    workspaceConfig.aiProvider,
    workspaceConfig.nvidiaApiKey,
    workspaceConfig.geminiApiKey,
    profile.custom_ai_api_key,
    localApiKey,
  ]);

  const hasGeminiApiKey = effectiveApiKey.length >= 15;

  // Master synced task list: filters out stale past-due uncompleted tasks (matching TaskTable)
  // and recomputes section_group from the movable header rows above each task
  const syncedTasks = useMemo(
    () =>
      syncTasksWithHeadersAndFilter(tasks, {
        filterPastDue: true,
        hideCompleted: false,
        defaultSectionGroup: workspaceConfig.sections[0]?.id || "TODAY",
      }),
    [tasks, workspaceConfig.sections]
  );

  // Exact visible task list on the active board (passed to AI Chat & MyDayView so they 100% match the Task Table)
  const visibleBoardTasks = useMemo(
    () =>
      syncTasksWithHeadersAndFilter(tasks, {
        filterPastDue: true,
        hideCompleted: !workspaceConfig.showCompletedTasks,
        defaultSectionGroup: workspaceConfig.sections[0]?.id || "TODAY",
      }),
    [tasks, workspaceConfig.showCompletedTasks, workspaceConfig.sections]
  );

  const activeTaskCount = useMemo(
    () =>
      syncedTasks.filter((t) => {
        if (t.custom_properties?.is_header) return false;
        return !isTaskDoneStatus(t);
      }).length,
    [syncedTasks]
  );

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    const timer = setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  // Persist chat conversation in sessionStorage across tab switches & reloads
  useEffect(() => {
    if (!chatHydratedRef.current || typeof window === "undefined") return;
    try {
      const compact = heroMessages.slice(-40).map((m) => ({
        ...m,
        undoSnapshot: undefined,
      }));
      sessionStorage.setItem(
        HERO_CHAT_MESSAGES_SESSION_KEY,
        JSON.stringify(compact)
      );
    } catch {}
  }, [heroMessages]);

  // Auto-open Google AI API key setup prompt if user doesn't have a key set up and hasn't opted out
  useEffect(() => {
    if (!authChecked || !canAccessWorkspace) return;
    if (hasAutoPromptedSetupRef.current) return;
    hasAutoPromptedSetupRef.current = true;

    if (!hasGeminiApiKey && !aiTemporarilyDisabled) {
      setIsGeminiSetupOpen(true);
    }
  }, [authChecked, canAccessWorkspace, hasGeminiApiKey, aiTemporarilyDisabled]);

  // 1. Check Supabase session & fetch user data
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const authError = urlParams.get("auth_error");
      if (authError) {
        showToast(`Sign in error: ${authError}`);
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
      }

      // Hydrate API key, temporary AI opt-out, and session chat history
      try {
        const savedKey = localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY);
        if (savedKey) {
          setLocalApiKey(savedKey);
        }
      } catch {}

      try {
        const tempDisabled =
          sessionStorage.getItem(AI_TEMP_DISABLED_SESSION_KEY) === "true";
        if (tempDisabled) {
          setAiTemporarilyDisabled(true);
          setActiveTab("tasks");
        }
      } catch {}

      try {
        const savedMsgs = sessionStorage.getItem(HERO_CHAT_MESSAGES_SESSION_KEY);
        if (savedMsgs) {
          const parsedMsgs = JSON.parse(savedMsgs);
          if (Array.isArray(parsedMsgs)) {
            setHeroMessages(parsedMsgs);
          }
        }
      } catch {}
      chatHydratedRef.current = true;

      // Load cached customization & theme prefs from localStorage as immediate fallback
      try {
        const cached = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
        const cachedPrefsRaw = localStorage.getItem(LOCAL_STORAGE_PROFILE_PREFS_KEY);
        const cachedPrefs = cachedPrefsRaw ? JSON.parse(cachedPrefsRaw) : null;
        if (cached || cachedPrefs) {
          const parsedConfig = cached ? JSON.parse(cached) : {};
          setProfile((prev) => ({
            ...prev,
            ...(cachedPrefs || {}),
            custom_theme_json: {
              ...(prev.custom_theme_json || {}),
              ...parsedConfig,
            },
          }));
        }
      } catch {}
    }

    if (!isSupabaseConfigured()) {
      setAuthChecked(true);
      return;
    }

    const supabase = createClient();
    let realtimeChannel: RealtimeChannel | null = null;
    let lastRefetchTimestamp = 0;

    async function initSession(isRefetch = false) {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          authUserIdRef.current = user.id;
          authUserEmailRef.current = user.email || "";
          setIsAuthenticated(true);

          // 1. Fetch Profile
          const { data: dbProfile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

          const hasRecentLocalWrite =
            Date.now() - lastLocalProfileWriteRef.current < 4000;

          if (dbProfile && !hasRecentLocalWrite) {
            setProfile((prev) => ({
              ...prev,
              ...dbProfile,
              video_bg_preset: normalizeVideoPreset(dbProfile.video_bg_preset),
              custom_theme_json:
                dbProfile.custom_theme_json || prev.custom_theme_json,
            }));
            if (typeof window !== "undefined") {
              try {
                if (dbProfile.custom_theme_json) {
                  localStorage.setItem(
                    LOCAL_STORAGE_CONFIG_KEY,
                    JSON.stringify(dbProfile.custom_theme_json)
                  );
                }
                localStorage.setItem(
                  LOCAL_STORAGE_PROFILE_PREFS_KEY,
                  JSON.stringify({
                    theme: dbProfile.theme,
                    ai_tone: dbProfile.ai_tone,
                    video_bg_preset: normalizeVideoPreset(dbProfile.video_bg_preset),
                    video_bg_dim: dbProfile.video_bg_dim,
                    video_bg_blur: dbProfile.video_bg_blur,
                    view_mode: dbProfile.view_mode,
                  })
                );
              } catch {}
            }
          } else if (!dbProfile) {
            const initialProfile = {
              id: user.id,
              email: user.email || "",
              full_name:
                user.user_metadata?.full_name ||
                user.user_metadata?.name ||
                null,
              avatar_url: user.user_metadata?.avatar_url || null,
              custom_theme_json:
                DEFAULT_WORKSPACE_CONFIG as unknown as Record<string, unknown>,
            };
            supabase.from("profiles").upsert(initialProfile).then();
            setProfile((prev) => ({
              ...prev,
              ...initialProfile,
            }));
          }

          // 2. Fetch Tasks & synchronize with movable section headers + filter stale past-due items
          const { data: dbTasks } = await supabase
            .from("tasks")
            .select("*")
            .eq("user_id", user.id)
            .order("order_index", { ascending: true });

          const rawLoadedTasks = ((dbTasks || []) as TaskItem[])
            .map((t) => ({
              ...t,
              subtasks: Array.isArray(t.subtasks)
                ? t.subtasks
                : Array.isArray(t.custom_properties?.subtasks)
                ? (t.custom_properties.subtasks as SubTask[])
                : [],
            }))
            .filter((t) => {
              if (deletedTaskIdsRef.current.has(t.id)) return false;
              return true;
            });

          const now = new Date();
          const startOfTodayMs = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
          ).getTime();

          // Identify stale past-due uncompleted tasks that TaskTable hides so we purge them cleanly
          const stalePastIds: string[] = [];
          for (const t of rawLoadedTasks) {
            if (
              !t.custom_properties?.is_header &&
              !isTaskDoneStatus(t) &&
              t.due_date
            ) {
              const dueTime = new Date(t.due_date).getTime();
              if (!isNaN(dueTime) && dueTime < startOfTodayMs) {
                stalePastIds.push(t.id);
                deletedTaskIdsRef.current.add(t.id);
              }
            }
          }
          if (stalePastIds.length > 0) {
            const uuidStale = stalePastIds.filter((id) => UUID_REGEX.test(id));
            if (uuidStale.length > 0) {
              supabase.from("tasks").delete().in("id", uuidStale).then();
            }
          }

          const activeSections =
            getWorkspaceConfig(dbProfile || DEFAULT_PROFILE).sections ||
            DEFAULT_WORKSPACE_CONFIG.sections;

          const loadedTasks = syncTasksWithHeadersAndFilter(rawLoadedTasks, {
            filterPastDue: true,
            hideCompleted: false,
            startOfTodayMs,
            defaultSectionGroup: activeSections[0]?.id || "TODAY",
          });

          const hasAnyHeaderRow = loadedTasks.some((t) =>
            Boolean(t.custom_properties?.is_header)
          );
          const alreadySeeded =
            typeof window !== "undefined" &&
            localStorage.getItem(`${HEADERS_SEEDED_STORAGE_KEY}_${user.id}`) ===
              "true";

          if (!hasAnyHeaderRow && !alreadySeeded && !isRefetch) {
            if (typeof window !== "undefined") {
              localStorage.setItem(
                `${HEADERS_SEEDED_STORAGE_KEY}_${user.id}`,
                "true"
              );
            }

            const { combined, createdHeaders } = buildDefaultHeaderRowsForTasks(
              user.id,
              loadedTasks,
              activeSections
            );
            setTasks(combined);

            if (createdHeaders.length > 0) {
              const payload = createdHeaders.map((h) => ({
                id: h.id,
                user_id: user.id,
                title: h.title,
                content: "",
                status: h.status,
                type: h.type,
                priority: h.priority,
                due_date: null,
                estimated_minutes: 0,
                tags: [],
                notes: "",
                is_canvas_assignment: false,
                canvas_course_code: null,
                custom_properties: { is_header: true },
                section_group: h.section_group,
                order_index: h.order_index,
              }));

              await supabase.from("tasks").insert(payload);

              for (const item of combined) {
                if (!createdHeaders.some((h) => h.id === item.id)) {
                  supabase
                    .from("tasks")
                    .update({
                      order_index: item.order_index,
                      section_group: item.section_group,
                    })
                    .eq("id", item.id)
                    .then();
                }
              }
            }
          } else {
            setTasks(loadedTasks);
            if (hasAnyHeaderRow && typeof window !== "undefined") {
              localStorage.setItem(
                `${HEADERS_SEEDED_STORAGE_KEY}_${user.id}`,
                "true"
              );
            }
          }

          // 3. Setup Supabase Realtime Multi-Device Sync Channel
          if (!realtimeChannel) {
            realtimeChannel = supabase
              .channel(`kite-cross-device-${user.id}`)
              .on(
                "postgres_changes",
                {
                  event: "*",
                  schema: "public",
                  table: "tasks",
                  filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                  if (payload.eventType === "INSERT") {
                    const rawNew = payload.new as TaskItem;
                    if (deletedTaskIdsRef.current.has(rawNew.id)) return;
                    const newTask: TaskItem = {
                      ...rawNew,
                      subtasks: Array.isArray(rawNew.subtasks)
                        ? rawNew.subtasks
                        : Array.isArray(rawNew.custom_properties?.subtasks)
                        ? (rawNew.custom_properties.subtasks as SubTask[])
                        : [],
                    };
                    setTasks((prev) => {
                      if (prev.some((t) => t.id === newTask.id)) return prev;
                      const next = [...prev, newTask];
                      return next.sort(
                        (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
                      );
                    });
                  } else if (payload.eventType === "UPDATE") {
                    const rawUpdated = payload.new as TaskItem;
                    if (deletedTaskIdsRef.current.has(rawUpdated.id)) return;
                    const normalizedSubtasks = Array.isArray(rawUpdated.subtasks)
                      ? rawUpdated.subtasks
                      : Array.isArray(rawUpdated.custom_properties?.subtasks)
                      ? (rawUpdated.custom_properties.subtasks as SubTask[])
                      : undefined;
                    setTasks((prev) => {
                      const exists = prev.some((t) => t.id === rawUpdated.id);
                      if (!exists) {
                        return [
                          ...prev,
                          {
                            ...rawUpdated,
                            subtasks: normalizedSubtasks ?? [],
                          },
                        ].sort(
                          (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
                        );
                      }
                      return prev.map((t) =>
                        t.id === rawUpdated.id
                          ? {
                              ...t,
                              ...rawUpdated,
                              subtasks:
                                normalizedSubtasks !== undefined
                                  ? normalizedSubtasks
                                  : t.subtasks || [],
                            }
                          : t
                      );
                    });
                  } else if (payload.eventType === "DELETE") {
                    const delId = (payload.old as { id?: string })?.id;
                    if (delId) {
                      deletedTaskIdsRef.current.add(delId);
                      setTasks((prev) => prev.filter((t) => t.id !== delId));
                    }
                  }
                }
              )
              .on(
                "postgres_changes",
                {
                  event: "UPDATE",
                  schema: "public",
                  table: "profiles",
                  filter: `id=eq.${user.id}`,
                },
                (payload) => {
                  const updatedProfile = payload.new as UserProfile;
                  if (updatedProfile) {
                    setProfile((prev) => ({
                      ...prev,
                      ...updatedProfile,
                      video_bg_preset: normalizeVideoPreset(
                        updatedProfile.video_bg_preset
                      ),
                      custom_theme_json:
                        updatedProfile.custom_theme_json ||
                        prev.custom_theme_json,
                    }));
                    if (
                      updatedProfile.custom_theme_json &&
                      typeof window !== "undefined"
                    ) {
                      try {
                        localStorage.setItem(
                          LOCAL_STORAGE_CONFIG_KEY,
                          JSON.stringify(updatedProfile.custom_theme_json)
                        );
                      } catch {}
                    }
                  }
                }
              )
              .subscribe();
          }
        } else {
          setIsAuthenticated(false);
          setTasks([]);
        }
      } catch (err) {
        console.error("Auth init / sync error:", err);
      } finally {
        setAuthChecked(true);
      }
    }

    initSession(false);

    // 4. Tab Visibility & Window Focus Auto-Resync (fallback behind Supabase Realtime)
    const handleVisibilityOrFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      const now = Date.now();
      // Throttle full DB re-queries to at most once every 60 seconds (Realtime handles live sync)
      if (now - lastRefetchTimestamp < 60000) return;
      lastRefetchTimestamp = now;
      initSession(true);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleVisibilityOrFocus);
      document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    }

    // 5. Auth State Listener
    const {
      data: { subscription: authListener },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setIsAuthenticated(true);
        if (event === "SIGNED_IN" || event === "USER_UPDATED") {
          initSession(true);
        }
      } else {
        setIsAuthenticated(false);
        setTasks([]);
      }
    });

    return () => {
      authListener.unsubscribe();
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", handleVisibilityOrFocus);
        document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      }
    };
  }, []);

  // 2. Apply theme & custom colors to html element
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", profile.theme);

    const customColors = workspaceConfig.customThemeColors;
    if (customColors) {
      root.style.setProperty("--bg-base", customColors.bgBase);
      root.style.setProperty("--surface", customColors.surface);
      root.style.setProperty("--accent", customColors.accent);
      root.style.setProperty("--primary", customColors.primary);
      root.style.setProperty("--highlight", customColors.highlight);
    } else {
      root.style.removeProperty("--bg-base");
      root.style.removeProperty("--surface");
      root.style.removeProperty("--accent");
      root.style.removeProperty("--primary");
      root.style.removeProperty("--highlight");
    }
  }, [profile.theme, workspaceConfig.customThemeColors]);

  // 3. Update Profile
  const handleUpdateProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      const finalUpdates: Partial<UserProfile> = { ...updates };
      if (finalUpdates.theme === "sharingan" && !finalUpdates.ai_tone) {
        finalUpdates.ai_tone = "killer_bee";
      }

      lastLocalProfileWriteRef.current = Date.now();

      setProfile((prev) => {
        const nextProfile = { ...prev, ...finalUpdates };
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(
              LOCAL_STORAGE_PROFILE_PREFS_KEY,
              JSON.stringify({
                theme: nextProfile.theme,
                ai_tone: nextProfile.ai_tone,
                video_bg_preset: normalizeVideoPreset(
                  nextProfile.video_bg_preset
                ),
                video_bg_dim: nextProfile.video_bg_dim,
                video_bg_blur: nextProfile.video_bg_blur,
                view_mode: nextProfile.view_mode,
              })
            );
          } catch {}
        }
        return nextProfile;
      });

      if (isSupabaseConfigured() && isAuthenticated) {
        try {
          const supabase = createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          const targetId =
            user?.id || (profile.id !== "user-default" ? profile.id : null);
          if (targetId) {
            const { data: updatedRows, error: updateErr } = await supabase
              .from("profiles")
              .update(finalUpdates)
              .eq("id", targetId)
              .select("id");

            if (updateErr || !updatedRows || updatedRows.length === 0) {
              await supabase.from("profiles").upsert({
                id: targetId,
                email: user?.email || profile.email || "",
                ...finalUpdates,
              });
            }
          }
        } catch (err) {
          console.warn("Profile update error:", err);
        }
      }

      if (updates.theme === "sharingan") {
        showToast(
          "Switched to Sharingan Eye — Killer Bee has entered the chat! Bakayaro! Konoyaro!"
        );
      }
    },
    [isAuthenticated, profile.id, profile.email, showToast]
  );

  // 4. Update Workspace Customization Config (persisted in localStorage + debounced Supabase write)
  const handleUpdateWorkspaceConfig = useCallback(
    async (updates: Partial<WorkspaceConfig>) => {
      lastLocalProfileWriteRef.current = Date.now();
      const prevProfile = profileRef.current;
      const currentConfig = getWorkspaceConfig(prevProfile);
      const mergedConfig: WorkspaceConfig = {
        ...currentConfig,
        ...updates,
        columnHeaders: {
          ...currentConfig.columnHeaders,
          ...(updates.columnHeaders || {}),
        },
      };

      const nextJsonSnapshot = mergedConfig as unknown as Record<string, unknown>;
      const fallbackProfileId =
        prevProfile.id !== "user-default" ? prevProfile.id : null;
      const fallbackEmail = prevProfile.email || "";

      const nextProfile: UserProfile = {
        ...prevProfile,
        custom_theme_json: nextJsonSnapshot,
      };
      profileRef.current = nextProfile;
      setProfile(nextProfile);

      pendingWorkspaceConfigJsonRef.current = nextJsonSnapshot;

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            LOCAL_STORAGE_CONFIG_KEY,
            JSON.stringify(nextJsonSnapshot)
          );
        } catch {}
      }

      if (isSupabaseConfigured() && isAuthenticated) {
        if (workspaceConfigSaveTimerRef.current) {
          clearTimeout(workspaceConfigSaveTimerRef.current);
        }
        workspaceConfigSaveTimerRef.current = setTimeout(async () => {
          const payloadJson = pendingWorkspaceConfigJsonRef.current;
          if (!payloadJson) return;
          try {
            const supabase = createClient();
            let targetId = authUserIdRef.current || fallbackProfileId;
            let email = authUserEmailRef.current || fallbackEmail;
            if (!targetId) {
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (user) {
                authUserIdRef.current = user.id;
                authUserEmailRef.current = user.email || "";
                targetId = user.id;
                email = user.email || email;
              }
            }
            if (targetId) {
              const { data: updatedRows, error: updateErr } = await supabase
                .from("profiles")
                .update({ custom_theme_json: payloadJson })
                .eq("id", targetId)
                .select("id");

              if (updateErr || !updatedRows || updatedRows.length === 0) {
                await supabase.from("profiles").upsert({
                  id: targetId,
                  email,
                  custom_theme_json: payloadJson,
                });
              }
            }
          } catch (err) {
            console.warn("Debounced workspace config save error:", err);
          }
        }, 800);
      }
    },
    [isAuthenticated]
  );

  // 5. Create Task (from Modal, Journey, or Copilot) with real UUID
  const handleCreateTask = useCallback(
    async (newTaskInput: Omit<TaskItem, "id" | "created_at" | "updated_at">) => {
      const nowISO = new Date().toISOString();
      const newUuid = generateUUID();
      const created: TaskItem = {
        ...newTaskInput,
        id: newUuid,
        created_at: nowISO,
        updated_at: nowISO,
      };

      const targetSection = (created.section_group || "TODAY").toUpperCase();
      let insertedList: TaskItem[] = [];
      let syncedCreated: TaskItem = created;

      setTasks((prev) => {
        const copy = [...prev];
        const headerIdx = copy.findIndex(
          (t) =>
            Boolean(t.custom_properties?.is_header) &&
            (t.section_group || "").toUpperCase() === targetSection
        );
        if (headerIdx !== -1) {
          let insertIdx = copy.length;
          for (let i = headerIdx + 1; i < copy.length; i++) {
            if (copy[i].custom_properties?.is_header) {
              insertIdx = i;
              break;
            }
          }
          copy.splice(insertIdx, 0, created);
        } else {
          copy.push(created);
        }
        insertedList = syncTasksWithHeadersAndFilter(copy, {
          filterPastDue: true,
          hideCompleted: false,
          defaultSectionGroup: workspaceConfig.sections[0]?.id || "TODAY",
        });
        syncedCreated =
          insertedList.find((t) => t.id === newUuid) || created;
        return insertedList;
      });

      showToast(`Added to my tasks: "${created.title}"`);

      if (isSupabaseConfigured() && isAuthenticated) {
        try {
          const supabase = createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          const targetUserId =
            user?.id || (profile.id !== "user-default" ? profile.id : null);
          if (targetUserId) {
            const insertCustomProps: Record<string, unknown> = {
              ...(syncedCreated.custom_properties || {}),
              ...(syncedCreated.subtasks?.length
                ? { subtasks: syncedCreated.subtasks }
                : {}),
            };
            await supabase.from("tasks").insert({
              id: newUuid,
              user_id: targetUserId,
              title: syncedCreated.title,
              content: syncedCreated.content,
              status: syncedCreated.status,
              type: syncedCreated.type,
              priority: syncedCreated.priority,
              due_date: syncedCreated.due_date,
              estimated_minutes: syncedCreated.estimated_minutes,
              tags: syncedCreated.tags,
              notes: syncedCreated.notes,
              is_canvas_assignment: syncedCreated.is_canvas_assignment,
              canvas_course_code: syncedCreated.canvas_course_code,
              custom_properties: insertCustomProps,
              section_group: syncedCreated.section_group,
              order_index: syncedCreated.order_index,
            });
          }
        } catch (err) {
          console.error("Create task error:", err);
        }
      }
    },
    [showToast, isAuthenticated, profile.id, workspaceConfig.sections]
  );

  // 6a. Inline Create Task Row directly in Table (at bottom or right after a specific row/header)
  const handleInlineCreateTask = useCallback(
    (afterRowId?: string): string => {
      const nowISO = new Date().toISOString();
      const newUuid = generateUUID();
      const defaultStatus = workspaceConfig.statuses[0]?.label || "To Do";
      const defaultType = workspaceConfig.types[0]?.label || "General";
      const defaultPriority = workspaceConfig.priorities[2]?.label || "Medium";

      let insertOrderIndex = tasks.length;
      const afterIdx = afterRowId
        ? tasks.findIndex((t) => t.id === afterRowId)
        : -1;
      if (afterIdx !== -1) {
        insertOrderIndex = afterIdx + 1;
      }

      const created: TaskItem = {
        id: newUuid,
        user_id: profile.id,
        title: "New Task",
        content: "",
        status: defaultStatus,
        type: defaultType,
        priority: defaultPriority,
        due_date: nowISO,
        estimated_minutes: 30,
        tags: [],
        notes: "",
        is_canvas_assignment: false,
        canvas_course_code: null,
        custom_properties: {},
        section_group: "TODAY",
        order_index: insertOrderIndex,
        completed_at: null,
        created_at: nowISO,
        updated_at: nowISO,
        subtasks: [],
      };

      const rawCopy = [...tasks];
      if (afterIdx !== -1) {
        rawCopy.splice(afterIdx + 1, 0, created);
      } else {
        rawCopy.push(created);
      }

      const nextList = syncTasksWithHeadersAndFilter(rawCopy, {
        filterPastDue: true,
        hideCompleted: false,
        defaultSectionGroup: workspaceConfig.sections[0]?.id || "TODAY",
      });

      const syncedCreated =
        nextList.find((item) => item.id === newUuid) || created;

      setTasks(nextList);

      if (isSupabaseConfigured() && isAuthenticated) {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data: { user } }) => {
          const targetUserId =
            user?.id || (profile.id !== "user-default" ? profile.id : null);
          if (targetUserId) {
            supabase
              .from("tasks")
              .insert({
                id: newUuid,
                user_id: targetUserId,
                title: syncedCreated.title,
                content: syncedCreated.content,
                status: syncedCreated.status,
                type: syncedCreated.type,
                priority: syncedCreated.priority,
                due_date: syncedCreated.due_date,
                estimated_minutes: syncedCreated.estimated_minutes,
                tags: syncedCreated.tags,
                notes: syncedCreated.notes,
                is_canvas_assignment: syncedCreated.is_canvas_assignment,
                canvas_course_code: syncedCreated.canvas_course_code,
                custom_properties: {},
                section_group: syncedCreated.section_group,
                order_index: syncedCreated.order_index,
              })
              .then();
          }
        });
      }

      return newUuid;
    },
    [workspaceConfig, profile.id, tasks, isAuthenticated]
  );

  // 6b. Inline Create Movable Header Row directly in Table
  const handleInlineCreateHeader = useCallback(
    (afterRowId?: string, defaultTitle?: string): string => {
      const nowISO = new Date().toISOString();
      const newUuid = generateUUID();
      const headerTitle = defaultTitle || "——— ✨ NEW HEADER ✨ ———";

      let insertOrderIndex = tasks.length;
      const afterIdx = afterRowId
        ? tasks.findIndex((t) => t.id === afterRowId)
        : -1;
      if (afterIdx !== -1) {
        insertOrderIndex = afterIdx + 1;
      }

      const createdHeader: TaskItem = {
        id: newUuid,
        user_id: profile.id,
        title: headerTitle,
        content: "",
        status: "To Do",
        type: "General",
        priority: "Medium",
        due_date: null,
        estimated_minutes: 0,
        tags: [],
        notes: "",
        is_canvas_assignment: false,
        canvas_course_code: null,
        custom_properties: { is_header: true },
        section_group: "TODAY",
        order_index: insertOrderIndex,
        completed_at: null,
        created_at: nowISO,
        updated_at: nowISO,
        subtasks: [],
      };

      const rawCopy = [...tasks];
      if (afterIdx !== -1) {
        rawCopy.splice(afterIdx + 1, 0, createdHeader);
      } else {
        rawCopy.push(createdHeader);
      }

      const nextList = syncTasksWithHeadersAndFilter(rawCopy, {
        filterPastDue: true,
        hideCompleted: false,
        defaultSectionGroup: workspaceConfig.sections[0]?.id || "TODAY",
      });

      const syncedHeader =
        nextList.find((item) => item.id === newUuid) || createdHeader;

      setTasks(nextList);

      if (isSupabaseConfigured() && isAuthenticated) {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data: { user } }) => {
          const targetUserId =
            user?.id || (profile.id !== "user-default" ? profile.id : null);
          if (targetUserId) {
            supabase
              .from("tasks")
              .insert({
                id: newUuid,
                user_id: targetUserId,
                title: syncedHeader.title,
                content: "",
                status: syncedHeader.status,
                type: syncedHeader.type,
                priority: syncedHeader.priority,
                due_date: null,
                estimated_minutes: 0,
                tags: [],
                notes: "",
                is_canvas_assignment: false,
                canvas_course_code: null,
                custom_properties: { is_header: true },
                section_group: syncedHeader.section_group,
                order_index: syncedHeader.order_index,
              })
              .then();
          }
        });
      }

      return newUuid;
    },
    [profile.id, tasks, isAuthenticated, workspaceConfig.sections]
  );

  // 7. Update Task or Header Row (and keep myDaySchedule synced!)
  const handleUpdateTask = useCallback(
    async (taskId: string, updates: Partial<TaskItem>) => {
      // Do not update or resurrect a deleted row
      if (deletedTaskIdsRef.current.has(taskId)) return;

      const nowISO = new Date().toISOString();
      let updatedSnapshot: TaskItem[] = [];
      setTasks((prev) => {
        const mapped = prev.map((t) =>
          t.id === taskId ? { ...t, ...updates, updated_at: nowISO } : t
        );
        updatedSnapshot = syncTasksWithHeadersAndFilter(mapped, {
          filterPastDue: true,
          hideCompleted: false,
          defaultSectionGroup: workspaceConfig.sections[0]?.id || "TODAY",
        });
        return updatedSnapshot;
      });

      // Keep myDaySchedule blocks synchronized whenever a task's title, priority, type, or status changes
      if (workspaceConfig.myDaySchedule?.blocks?.length) {
        const activeVisible = updatedSnapshot.filter(
          (t) =>
            !t.custom_properties?.is_header &&
            (workspaceConfig.showCompletedTasks || !isTaskDoneStatus(t))
        );
        const syncedSched = pruneAndSyncMyDaySchedule(
          workspaceConfig.myDaySchedule,
          activeVisible,
          getLocalDateYMD()
        );
        if (syncedSched) {
          handleUpdateWorkspaceConfig({
            myDaySchedule: {
              ...syncedSched,
              updatedAt: nowISO,
            },
          });
        }
      }

      if (isSupabaseConfigured() && isAuthenticated) {
        try {
          const supabase = createClient();
          const { subtasks: updatedSubtasks, ...restUpdates } = updates;
          const dbPayload: Record<string, unknown> = {
            ...restUpdates,
            updated_at: nowISO,
          };
          if (
            updatedSubtasks !== undefined ||
            updates.custom_properties !== undefined
          ) {
            const curr = tasksRef.current.find((t) => t.id === taskId);
            dbPayload.custom_properties = {
              ...(curr?.custom_properties || {}),
              ...(updates.custom_properties || {}),
              ...(updatedSubtasks !== undefined
                ? { subtasks: updatedSubtasks }
                : {}),
            };
          }
          const { error: updateErr } = await supabase
            .from("tasks")
            .update(dbPayload)
            .eq("id", taskId);
          if (updateErr) {
            console.warn("Task update error:", updateErr.message);
          }
        } catch (err) {
          console.warn("Task update exception:", err);
        }
      }
    },
    [
      isAuthenticated,
      workspaceConfig.sections,
      workspaceConfig.myDaySchedule,
      workspaceConfig.showCompletedTasks,
      handleUpdateWorkspaceConfig,
    ]
  );

  // 8. Delete Task or Header Row - flicker-free, permanent, and synced with myDaySchedule
  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      // Instantly track in deleted set so no real-time or sync payload brings it back
      deletedTaskIdsRef.current.add(taskId);

      const target = tasks.find((t) => t.id === taskId);
      const remaining = syncTasksWithHeadersAndFilter(
        tasks.filter((t) => t.id !== taskId),
        {
          filterPastDue: true,
          hideCompleted: false,
          defaultSectionGroup: workspaceConfig.sections[0]?.id || "TODAY",
        }
      );
      setTasks(remaining);

      if (selectedTaskId === taskId) {
        setSelectedTaskId(null);
      }
      if (target) {
        showToast(`Deleted "${target.title}"`);
      }

      // Immediately prune deleted task from myDaySchedule so it never lingers
      if (workspaceConfig.myDaySchedule?.blocks?.length) {
        const activeRemaining = remaining.filter(
          (t) =>
            !t.custom_properties?.is_header &&
            (workspaceConfig.showCompletedTasks || !isTaskDoneStatus(t))
        );
        const syncedSched = pruneAndSyncMyDaySchedule(
          workspaceConfig.myDaySchedule,
          activeRemaining,
          getLocalDateYMD()
        );
        if (
          syncedSched &&
          syncedSched.blocks.length !==
            workspaceConfig.myDaySchedule.blocks.length
        ) {
          handleUpdateWorkspaceConfig({
            myDaySchedule: {
              ...syncedSched,
              updatedAt: new Date().toISOString(),
            },
          });
        }
      }

      if (isSupabaseConfigured() && isAuthenticated) {
        try {
          const supabase = createClient();
          const isUuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              taskId
            );

          if (isUuid) {
            await supabase.from("tasks").delete().eq("id", taskId);
          }
          if (target?.title) {
            // Also ensure any duplicate or legacy rows with matching title/user are cleaned
            await supabase
              .from("tasks")
              .delete()
              .eq("user_id", profile.id)
              .eq("title", target.title);
          }
        } catch (err) {
          console.error("Delete task error:", err);
        }
      }
    },
    [
      tasks,
      selectedTaskId,
      showToast,
      isAuthenticated,
      profile.id,
      workspaceConfig.sections,
      workspaceConfig.myDaySchedule,
      workspaceConfig.showCompletedTasks,
      handleUpdateWorkspaceConfig,
    ]
  );

  // 9. Reorder Tasks & Movable Headers (persists ONLY changed rows to Supabase)
  const handleReorderTasks = useCallback(
    (newTasks: TaskItem[]) => {
      const prevById = new Map(tasksRef.current.map((t) => [t.id, t]));
      const indexed = syncTasksWithHeadersAndFilter(newTasks, {
        filterPastDue: true,
        hideCompleted: false,
        defaultSectionGroup: workspaceConfig.sections[0]?.id || "TODAY",
      });
      setTasks(indexed);

      if (isSupabaseConfigured() && isAuthenticated) {
        const supabase = createClient();
        for (const item of indexed) {
          const prev = prevById.get(item.id);
          if (
            prev &&
            prev.order_index === item.order_index &&
            prev.section_group === item.section_group
          ) {
            continue;
          }
          if (UUID_REGEX.test(item.id)) {
            supabase
              .from("tasks")
              .update({
                order_index: item.order_index,
                section_group: item.section_group,
              })
              .eq("id", item.id)
              .then();
          }
        }
      }
    },
    [isAuthenticated, workspaceConfig.sections]
  );

  // 10. Canvas Assignment Sync with User Selection Modal
  const handleOpenCanvasSyncModal = useCallback(() => {
    setIsCanvasSyncModalOpen(true);
  }, []);

  const handleCloseCanvasSyncModal = useCallback(() => {
    setIsCanvasSyncModalOpen(false);
  }, []);

  const handleCommitCanvasSelected = useCallback(
    async (selectedTasks: TaskItem[]) => {
      if (!selectedTasks || selectedTasks.length === 0) return;
      setIsCommittingCanvas(true);
      try {
        const clientDate = new Date().toISOString();

        // 1. Commit to Supabase / Backend via /api/sync/canvas
        const res = await fetch("/api/sync/canvas", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "commit",
            canvasFeedUrl: profile.canvas_feed_url || "",
            selectedTasks,
            clientDate,
          }),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || "Failed to commit Canvas assignments");
        }

        const savedTasks: TaskItem[] =
          Array.isArray(data.tasks) && data.tasks.length > 0
            ? data.tasks
            : selectedTasks;

        // 2. Update React tasks state (add new or update existing in place)
        setTasks((prev) => {
          const toUpdateMap = new Map<string, TaskItem>();
          const toAdd: TaskItem[] = [];

          for (const item of savedTasks) {
            const itemUid = item.custom_properties?.canvas_uid;
            const normTitle = item.title.trim().toLowerCase();

            const existing = prev.find(
              (t) =>
                t.id === item.id ||
                (itemUid && t.custom_properties?.canvas_uid === itemUid) ||
                t.title.trim().toLowerCase() === normTitle
            );

            if (existing) {
              toUpdateMap.set(existing.id, {
                ...existing,
                ...item,
                id: existing.id,
              });
            } else {
              toAdd.push(item);
            }
          }

          const updated = prev.map((t) =>
            toUpdateMap.has(t.id) ? toUpdateMap.get(t.id)! : t
          );
          return [...updated, ...toAdd];
        });

        showToast(
          `Added ${selectedTasks.length} Canvas assignment${
            selectedTasks.length > 1 ? "s" : ""
          } to your board!`
        );
        setIsCanvasSyncModalOpen(false);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Sync error";
        showToast(`Canvas commit error: ${msg}`);
      } finally {
        setIsCommittingCanvas(false);
      }
    },
    [profile.canvas_feed_url, showToast]
  );

  const handleSyncCanvasTasks = useCallback(
    async (_feedUrl?: string) => {
      handleOpenCanvasSyncModal();
      return { count: 0, usedDemoFeed: false };
    },
    [handleOpenCanvasSyncModal]
  );

  // 11a. Toggle temporary session-scoped AI opt-out (always switchable in Settings -> AI)
  const handleSetAiTemporarilyDisabled = useCallback(
    (disabled: boolean) => {
      setAiTemporarilyDisabled(disabled);
      if (typeof window !== "undefined") {
        try {
          if (disabled) {
            sessionStorage.setItem(AI_TEMP_DISABLED_SESSION_KEY, "true");
          } else {
            sessionStorage.removeItem(AI_TEMP_DISABLED_SESSION_KEY);
          }
        } catch {}
      }

      if (disabled) {
        setIsGeminiSetupOpen(false);
        setActiveTab((prev) => (prev === "chat" ? "tasks" : prev));
        showToast(
          "AI features hidden for this session. Switch back anytime in Customize → AI."
        );
      } else {
        setActiveTab("chat");
        showToast("Gemini AI Workspace Agent enabled!");
      }
    },
    [showToast]
  );

  // 11b. Save or clear AI API key across localStorage, profile, and workspaceConfig
  const handleSaveApiKey = useCallback(
    (key: string | null, provider?: AIProvider, nvidiaModel?: string) => {
      const cleaned = key ? key.trim() : null;
      setLocalApiKey(cleaned || "");

      if (typeof window !== "undefined") {
        try {
          if (cleaned) {
            localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, cleaned);
          } else {
            localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
          }
        } catch {}
      }

      const detectedProvider: AIProvider =
        provider ||
        (cleaned?.startsWith("nvapi-")
          ? "nvidia"
          : cleaned?.startsWith("AIza")
          ? "gemini"
          : workspaceConfig.aiProvider || "nvidia");

      handleUpdateProfile({ custom_ai_api_key: cleaned });
      handleUpdateWorkspaceConfig({
        aiProvider: detectedProvider,
        ...(nvidiaModel ? { nvidiaModel } : {}),
        ...(detectedProvider === "nvidia"
          ? { nvidiaApiKey: cleaned }
          : { geminiApiKey: cleaned }),
      });

      if (cleaned) {
        setAiTemporarilyDisabled(false);
        if (typeof window !== "undefined") {
          try {
            sessionStorage.removeItem(AI_TEMP_DISABLED_SESSION_KEY);
          } catch {}
        }
        setIsGeminiSetupOpen(false);
        setActiveTab("chat");
        showToast(
          detectedProvider === "nvidia"
            ? "NVIDIA NIM connected (Free Inference on Leading Models)!"
            : "Google Gemini connected!"
        );
      } else {
        showToast("Removed saved AI API key.");
      }
    },
    [
      handleUpdateProfile,
      handleUpdateWorkspaceConfig,
      showToast,
      workspaceConfig.aiProvider,
    ]
  );

  // 11c. Apply live mutations executed by the Gemini Workspace Agent & persist to Supabase
  const handleApplyAgentMutation = useCallback(
    (mutation: AgentWorkspaceMutationPayload): AgentUndoSnapshot => {
      const tm = mutation.tasksMutation;
      const currentTasks = tasksRef.current;

      const snapshotTasks = currentTasks.map((t) => ({
        ...t,
        tags: [...(t.tags || [])],
        custom_properties: { ...(t.custom_properties || {}) },
      }));
      const snapshotConfig: WorkspaceConfig = JSON.parse(
        JSON.stringify(workspaceConfig)
      );
      const snapshotProfile: UserProfile = {
        ...profile,
        custom_theme_json: snapshotConfig as unknown as Record<string, unknown>,
      };

      const deletedSet = new Set(tm?.deletedTaskIds || []);
      const modifiedById = new Map(
        (tm?.modifiedTasks || []).map((m) => [m.id, m])
      );
      const addedById = new Map((tm?.addedTasks || []).map((a) => [a.id, a]));
      const updatedOrderById = new Map(
        (tm?.updatedTasks || []).map((u) => [u.id, u])
      );

      const undoSnapshot: AgentUndoSnapshot = {
        tasks: snapshotTasks,
        profile: snapshotProfile,
        workspaceConfig: snapshotConfig,
        addedTaskIds: (tm?.addedTasks || []).map((a) => a.id),
        deletedTasks: snapshotTasks.filter((t) => deletedSet.has(t.id)),
        modifiedBefore: snapshotTasks.filter((t) => modifiedById.has(t.id)),
      };

      if (tm) {
        for (const delId of tm.deletedTaskIds) {
          deletedTaskIdsRef.current.add(delId);
          if (selectedTaskId === delId) {
            setSelectedTaskId(null);
          }
        }

        // Non-destructive merge: apply deletions, modifications, additions, and order updates
        // while preserving any completed/hidden tasks that weren't in the filtered chat view.
        setTasks((prev) => {
          const merged: TaskItem[] = [];
          const seenIds = new Set<string>();

          for (const existing of prev) {
            if (deletedSet.has(existing.id)) continue;
            const mod = modifiedById.get(existing.id);
            const ord = updatedOrderById.get(existing.id);
            if (mod) {
              merged.push({
                ...existing,
                ...mod,
                subtasks: mod.subtasks ?? existing.subtasks ?? [],
                custom_properties: {
                  ...(existing.custom_properties || {}),
                  ...(mod.custom_properties || {}),
                  ...((mod.subtasks ?? existing.subtasks)
                    ? { subtasks: mod.subtasks ?? existing.subtasks }
                    : {}),
                },
              });
            } else if (ord) {
              merged.push({
                ...existing,
                order_index: ord.order_index,
                section_group: ord.section_group,
              });
            } else {
              merged.push(existing);
            }
            seenIds.add(existing.id);
          }

          for (const added of tm.addedTasks) {
            if (!seenIds.has(added.id) && !deletedSet.has(added.id)) {
              merged.push(added);
              seenIds.add(added.id);
            }
          }

          merged.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
          return merged;
        });

        if (isSupabaseConfigured() && isAuthenticated) {
          const supabase = createClient();

          // 1) Persist deletions
          if (tm.deletedTaskIds.length > 0) {
            const uuidDeletes = tm.deletedTaskIds.filter((id) =>
              UUID_REGEX.test(id)
            );
            if (uuidDeletes.length > 0) {
              supabase
                .from("tasks")
                .delete()
                .in("id", uuidDeletes)
                .then(({ error }) => {
                  if (error) console.warn("Agent delete error:", error.message);
                });
            }
          }

          // 2) Persist newly added tasks & headers
          if (tm.addedTasks.length > 0) {
            const persistAdded = async () => {
              let targetUserId =
                authUserIdRef.current ||
                (profile.id !== "user-default" ? profile.id : null);
              if (!targetUserId) {
                const {
                  data: { user },
                } = await supabase.auth.getUser();
                targetUserId = user?.id || null;
              }
              if (targetUserId) {
                const insertPayload = tm.addedTasks.map((created) => ({
                  id: created.id,
                  user_id: targetUserId,
                  title: created.title,
                  content: created.content,
                  status: created.status,
                  type: created.type,
                  priority: created.priority,
                  due_date: created.due_date,
                  estimated_minutes: created.estimated_minutes,
                  tags: created.tags,
                  notes: created.notes,
                  is_canvas_assignment: created.is_canvas_assignment,
                  canvas_course_code: created.canvas_course_code,
                  custom_properties: {
                    ...(created.custom_properties || {}),
                    ...(created.subtasks?.length
                      ? { subtasks: created.subtasks }
                      : {}),
                  },
                  section_group: created.section_group,
                  order_index: created.order_index,
                }));
                const { error } = await supabase
                  .from("tasks")
                  .insert(insertPayload);
                if (error) console.warn("Agent insert error:", error.message);
              }
            };
            persistAdded();
          }

          // 3) Persist modified tasks & headers
          const updatedOrderHandled = new Set<string>();
          for (const mod of tm.modifiedTasks) {
            if (UUID_REGEX.test(mod.id)) {
              updatedOrderHandled.add(mod.id);
              const existing = currentTasks.find((t) => t.id === mod.id);
              const mergedCustomProps = {
                ...(existing?.custom_properties || {}),
                ...(mod.custom_properties || {}),
                ...((mod.subtasks ?? existing?.subtasks)
                  ? { subtasks: mod.subtasks ?? existing?.subtasks }
                  : {}),
              };
              supabase
                .from("tasks")
                .update({
                  title: mod.title,
                  content: mod.content,
                  status: mod.status,
                  type: mod.type,
                  priority: mod.priority,
                  due_date: mod.due_date,
                  estimated_minutes: mod.estimated_minutes,
                  tags: mod.tags,
                  notes: mod.notes,
                  custom_properties: mergedCustomProps,
                  section_group: mod.section_group,
                  order_index: mod.order_index,
                  completed_at: mod.completed_at,
                  updated_at: mod.updated_at,
                })
                .eq("id", mod.id)
                .then(({ error }) => {
                  if (error) console.warn("Agent update error:", error.message);
                });
            }
          }

          // 4) Persist order_index changes from move/reorder operations
          if (tm.reordered) {
            for (const item of tm.updatedTasks) {
              if (
                UUID_REGEX.test(item.id) &&
                !addedById.has(item.id) &&
                !updatedOrderHandled.has(item.id)
              ) {
                supabase
                  .from("tasks")
                  .update({
                    order_index: item.order_index,
                    section_group: item.section_group,
                  })
                  .eq("id", item.id)
                  .then();
              }
            }
          }
        }
      }

      if (mutation.profileUpdates) {
        handleUpdateProfile(mutation.profileUpdates);
      }

      if (mutation.workspaceConfigUpdates) {
        handleUpdateWorkspaceConfig(mutation.workspaceConfigUpdates);
      }

      if (mutation.triggerCanvasSync) {
        handleSyncCanvasTasks(profile.canvas_feed_url || "").catch(() => {});
      }

      if (mutation.switchTab && !aiTemporarilyDisabled) {
        setActiveTab(mutation.switchTab);
      }

      if (mutation.executedActions.length > 0) {
        showToast(
          mutation.executedActions.length === 1
            ? mutation.executedActions[0].summary
            : `Agent completed ${mutation.executedActions.length} workspace actions`
        );
      }

      return undoSnapshot;
    },
    [
      tasks,
      workspaceConfig,
      profile,
      selectedTaskId,
      isAuthenticated,
      aiTemporarilyDisabled,
      handleUpdateProfile,
      handleUpdateWorkspaceConfig,
      handleSyncCanvasTasks,
      showToast,
    ]
  );

  // 11d. One-click Undo for any Gemini Agent turn
  const handleUndoAgentMessage = useCallback(
    (messageId: string) => {
      const targetMsg = heroMessages.find((m) => m.id === messageId);
      if (!targetMsg?.undoSnapshot || targetMsg.undone) return;

      const snap = targetMsg.undoSnapshot;

      for (const restored of snap.deletedTasks) {
        deletedTaskIdsRef.current.delete(restored.id);
      }
      for (const addedId of snap.addedTaskIds) {
        deletedTaskIdsRef.current.add(addedId);
      }

      setTasks(snap.tasks);
      setProfile(snap.profile);

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            LOCAL_STORAGE_CONFIG_KEY,
            JSON.stringify(snap.workspaceConfig)
          );
        } catch {}
      }

      if (isSupabaseConfigured() && isAuthenticated) {
        const supabase = createClient();

        const uuidAdded = snap.addedTaskIds.filter((id) =>
          UUID_REGEX.test(id)
        );
        if (uuidAdded.length > 0) {
          supabase.from("tasks").delete().in("id", uuidAdded).then();
        }

        if (snap.deletedTasks.length > 0) {
          const restorePayload = snap.deletedTasks
            .filter((t) => UUID_REGEX.test(t.id))
            .map((t) => ({
              id: t.id,
              user_id: profile.id,
              title: t.title,
              content: t.content,
              status: t.status,
              type: t.type,
              priority: t.priority,
              due_date: t.due_date,
              estimated_minutes: t.estimated_minutes,
              tags: t.tags,
              notes: t.notes,
              is_canvas_assignment: t.is_canvas_assignment,
              canvas_course_code: t.canvas_course_code,
              custom_properties: t.custom_properties || {},
              section_group: t.section_group,
              order_index: t.order_index,
            }));
          if (restorePayload.length > 0) {
            supabase.from("tasks").insert(restorePayload).then();
          }
        }

        for (const prevItem of snap.tasks) {
          if (UUID_REGEX.test(prevItem.id)) {
            supabase
              .from("tasks")
              .update({
                title: prevItem.title,
                content: prevItem.content,
                status: prevItem.status,
                type: prevItem.type,
                priority: prevItem.priority,
                due_date: prevItem.due_date,
                estimated_minutes: prevItem.estimated_minutes,
                tags: prevItem.tags,
                notes: prevItem.notes,
                custom_properties: prevItem.custom_properties || {},
                section_group: prevItem.section_group,
                order_index: prevItem.order_index,
                completed_at: prevItem.completed_at,
              })
              .eq("id", prevItem.id)
              .then();
          }
        }

        supabase
          .from("profiles")
          .update({
            theme: snap.profile.theme,
            video_bg_preset: snap.profile.video_bg_preset,
            video_bg_dim: snap.profile.video_bg_dim,
            video_bg_blur: snap.profile.video_bg_blur,
            ai_tone: snap.profile.ai_tone,
            view_mode: snap.profile.view_mode,
            custom_theme_json:
              snap.workspaceConfig as unknown as Record<string, unknown>,
          })
          .eq("id", profile.id)
          .then();
      }

      setHeroMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, undone: true } : m))
      );
      showToast("Reverted agent changes.");
    },
    [heroMessages, isAuthenticated, profile.id, showToast]
  );

  // Google OAuth Sign In
  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured()) {
      showToast("Supabase is not configured yet.");
      return;
    }
    const supabase = createClient();
    const origin = window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
  };

  const handleSignOut = async () => {
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    setIsAuthenticated(false);
    setTasks([]);
    showToast("Signed out.");
  };

  const handleToggleMyDayBlockComplete = useCallback(
    (block: EnrichedMyDayBlock) => {
      const nextDone = !block.isCompleted;
      if (block.taskId) {
        handleUpdateTask(block.taskId, {
          status: nextDone ? "Done" : "To Do",
          completed_at: nextDone ? new Date().toISOString() : null,
        });
      }
      const currentSchedule = workspaceConfig.myDaySchedule;
      if (currentSchedule) {
        const nextBlocks = currentSchedule.blocks.map((b) =>
          b.id === block.id ? { ...b, completed: nextDone } : b
        );
        handleUpdateWorkspaceConfig({
          myDaySchedule: {
            ...currentSchedule,
            blocks: nextBlocks,
            updatedAt: new Date().toISOString(),
          },
        });
      }
    },
    [
      workspaceConfig.myDaySchedule,
      handleUpdateTask,
      handleUpdateWorkspaceConfig,
    ]
  );

  const handlePushMilestoneToTasks = useCallback(
    (milestone: JourneyMilestone) => {
      const nextStep = milestone.checkpoints.find((c) => !c.completed);
      const taskTitle = nextStep
        ? `${milestone.title}: ${nextStep.title}`
        : milestone.title;
      const nowISO = new Date().toISOString();

      handleCreateTask({
        user_id: profile.id,
        title: taskTitle,
        content: milestone.description ? `<p>${milestone.description}</p>` : "",
        status: workspaceConfig.statuses[0]?.label || "To Do",
        type:
          milestone.category === "academics"
            ? "School"
            : milestone.category === "career" || milestone.category === "startup"
            ? "Work"
            : "Personal",
        priority: milestone.status === "in_progress" ? "High" : "Medium",
        due_date: nowISO,
        estimated_minutes: 45,
        tags: ["#Journey"],
        notes: `Milestone (${milestone.timeframe})`,
        is_canvas_assignment: false,
        canvas_course_code: null,
        custom_properties: {},
        section_group: "TODAY",
        order_index: tasks.length,
        completed_at: null,
      });
    },
    [handleCreateTask, profile.id, workspaceConfig.statuses, tasks.length]
  );

  const handleResetChatToHero = useCallback(() => {
    setHeroResetNonce((n) => n + 1);
  }, []);

  const handleOpenCustomizeSettings = useCallback(() => {
    setSettingsTab("view");
    setIsSettingsOpen(true);
  }, []);

  const handleOpenApiKeySetup = useCallback(() => {
    setIsGeminiSetupOpen(true);
  }, []);

  const effectiveTab: WorkspaceTab =
    aiTemporarilyDisabled && activeTab === "chat" ? "tasks" : activeTab;

  return (
    <div className="relative min-h-screen flex flex-col text-zinc-100">
      {/* Ambient Theme & Video Background */}
      <VideoBackground
        preset={profile.video_bg_preset}
        theme={profile.theme}
        dim={profile.video_bg_dim}
        blur={profile.video_bg_blur}
        customVideoVersion={customVideoVersion}
      />

      {/* Foreground Content Layer */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {supabaseEnabled && !authChecked ? (
          <div className="flex-1 flex items-center justify-center py-24">
            <KiteFlyingLoader label="launching kite" compact />
          </div>
        ) : supabaseEnabled && !isAuthenticated ? (
          /* Immersive Animated Marketing Landing Page for Unauthenticated Visitors */
          <KiteMarketingPage
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            onGoogleSignIn={handleGoogleSignIn}
          />
        ) : (
          <div
            className={`flex flex-1 min-h-screen w-full ${
              (workspaceConfig.navPosition || "left") === "left"
                ? "flex-col lg:flex-row"
                : "flex-col"
            }`}
          >
            {(workspaceConfig.navPosition || "left") === "left" ? (
              <LeftSidebarNav
                profile={profile}
                workspaceConfig={workspaceConfig}
                isAuthenticated={isAuthenticated}
                canAccessWorkspace={canAccessWorkspace}
                activeTab={effectiveTab}
                aiTemporarilyDisabled={aiTemporarilyDisabled}
                hasGeminiApiKey={hasGeminiApiKey}
                activeTaskCount={activeTaskCount}
                isSyncingCanvas={isSyncingCanvas}
                onSelectTab={setActiveTab}
                onResetChatToHero={handleResetChatToHero}
                onUpdateProfile={handleUpdateProfile}
                onUpdateWorkspaceConfig={handleUpdateWorkspaceConfig}
                onOpenSettings={handleOpenCustomizeSettings}
                onQuickSyncCanvas={handleOpenCanvasSyncModal}
                onGoogleSignIn={handleGoogleSignIn}
                onSignOut={handleSignOut}
              />
            ) : (
              <TopNavBar
                profile={profile}
                workspaceConfig={workspaceConfig}
                isAuthenticated={isAuthenticated}
                canAccessWorkspace={canAccessWorkspace}
                activeTab={effectiveTab}
                aiTemporarilyDisabled={aiTemporarilyDisabled}
                hasGeminiApiKey={hasGeminiApiKey}
                activeTaskCount={activeTaskCount}
                isSyncingCanvas={isSyncingCanvas}
                onSelectTab={setActiveTab}
                onResetChatToHero={handleResetChatToHero}
                onUpdateProfile={handleUpdateProfile}
                onUpdateWorkspaceConfig={handleUpdateWorkspaceConfig}
                onOpenSettings={handleOpenCustomizeSettings}
                onQuickSyncCanvas={handleOpenCanvasSyncModal}
                onGoogleSignIn={handleGoogleSignIn}
                onSignOut={handleSignOut}
              />
            )}

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 flex flex-col mx-auto w-full max-w-[1600px] px-2.5 sm:px-6 lg:px-8 py-3.5 sm:py-6">
              {effectiveTab === "chat" ? (
                /* my chat: Hero Homepage + Autonomous Workspace Agent */
                <GeminiHeroChat
                  tasks={visibleBoardTasks}
                  profile={profile}
                  workspaceConfig={workspaceConfig}
                  messages={heroMessages}
                  setMessages={setHeroMessages}
                  hasApiKey={hasGeminiApiKey}
                  effectiveApiKey={effectiveApiKey}
                  activeTab={effectiveTab}
                  heroResetNonce={heroResetNonce}
                  queuedPrompt={queuedChatPrompt}
                  onConsumeQueuedPrompt={() => setQueuedChatPrompt(null)}
                  onSelectTab={setActiveTab}
                  onSaveApiKey={(key, provider, nvidiaModel) =>
                    handleSaveApiKey(key, provider, nvidiaModel)
                  }
                  onUpdateWorkspaceConfig={handleUpdateWorkspaceConfig}
                  onOpenApiKeySetup={handleOpenApiKeySetup}
                  onOptOutTemporary={() => handleSetAiTemporarilyDisabled(true)}
                  onChangeTone={(tone) => handleUpdateProfile({ ai_tone: tone })}
                  onOpenSettings={() => {
                    setSettingsTab("ai");
                    setIsSettingsOpen(true);
                  }}
                  onQuickSyncCanvas={handleOpenCanvasSyncModal}
                  onApplyAgentMutation={handleApplyAgentMutation}
                  onUndoAgentMessage={handleUndoAgentMessage}
                  onToggleMyDayBlockComplete={handleToggleMyDayBlockComplete}
                />
              ) : effectiveTab === "my_day" ? (
                /* my day: Live Centered Clock + Dual Status Bars + Manual & AI Auto-Arrange Builder */
                <MyDayView
                  tasks={visibleBoardTasks}
                  profile={profile}
                  workspaceConfig={workspaceConfig}
                  hasApiKey={hasGeminiApiKey}
                  effectiveApiKey={effectiveApiKey}
                  aiTemporarilyDisabled={aiTemporarilyDisabled}
                  onUpdateWorkspaceConfig={handleUpdateWorkspaceConfig}
                  onUpdateTask={handleUpdateTask}
                  onOpenApiKeySetup={handleOpenApiKeySetup}
                  onShowToast={showToast}
                  onLaunchGuidedDayPlan={() => {
                    setActiveTab("chat");
                    setQueuedChatPrompt({
                      nonce: Date.now(),
                      text: "Help me plan my day",
                    });
                  }}
                />
              ) : effectiveTab === "journey" ? (
                /* my journey: Visual Milestone Roadmap + Sequential Journey AI Agent */
                <MyJourneyView
                  profile={profile}
                  workspaceConfig={workspaceConfig}
                  hasApiKey={hasGeminiApiKey}
                  effectiveApiKey={effectiveApiKey}
                  onUpdateWorkspaceConfig={handleUpdateWorkspaceConfig}
                  onOpenApiKeySetup={handleOpenApiKeySetup}
                  onShowToast={showToast}
                  onPushMilestoneToTasks={handlePushMilestoneToTasks}
                />
              ) : effectiveTab === "stats" ? (
                /* my stats: Full Progress, Growth & Productivity Intelligence Dashboard */
                <MyStatsView
                  tasks={tasks}
                  workspaceConfig={workspaceConfig}
                  onSelectTab={setActiveTab}
                />
              ) : effectiveTab === "study" ? (
                /* my flo: Editable Curriculum + Bite-Sized Teaching + Visuals + Checkpoints */
                <StudyModeView
                  profile={profile}
                  workspaceConfig={workspaceConfig}
                  hasApiKey={hasGeminiApiKey}
                  effectiveApiKey={effectiveApiKey}
                  onUpdateWorkspaceConfig={handleUpdateWorkspaceConfig}
                  onOpenApiKeySetup={handleOpenApiKeySetup}
                  onShowToast={showToast}
                />
              ) : (
                /* my tasks: Telemetry Header + Document-Style Resizable Task Table */
                <div className="space-y-5">
                  <CircularProgress
                    tasks={syncedTasks}
                    workspaceConfig={workspaceConfig}
                    onUpdateWorkspaceConfig={handleUpdateWorkspaceConfig}
                    streakDays={1}
                  />

                  <TaskTable
                    tasks={syncedTasks}
                    selectedTaskId={selectedTaskId}
                    viewMode={profile.view_mode}
                    workspaceConfig={workspaceConfig}
                    onSelectTask={setSelectedTaskId}
                    onUpdateTask={handleUpdateTask}
                    onDeleteTask={handleDeleteTask}
                    onReorderTasks={handleReorderTasks}
                    onInlineCreateTask={handleInlineCreateTask}
                    onInlineCreateHeader={handleInlineCreateHeader}
                    onUpdateWorkspaceConfig={handleUpdateWorkspaceConfig}
                    onOpenSettingsTab={(tab) => {
                      setSettingsTab(tab);
                      setIsSettingsOpen(true);
                    }}
                  />
                </div>
              )}
            </main>
          </div>
        )}
      </div>

      {/* Lazily mounted modals — chunks only load when actually opened */}
      {canAccessWorkspace && isGeminiSetupOpen && (
        <GeminiSetupModal
          isOpen={isGeminiSetupOpen}
          initialKey={effectiveApiKey}
          initialProvider={workspaceConfig.aiProvider || "nvidia"}
          initialNvidiaModel={
            workspaceConfig.nvidiaModel || DEFAULT_NVIDIA_MODEL
          }
          onSaveApiKey={(key, provider, nvidiaModel) =>
            handleSaveApiKey(key, provider, nvidiaModel)
          }
          onOptOutTemporary={() => handleSetAiTemporarilyDisabled(true)}
          onClose={() => setIsGeminiSetupOpen(false)}
        />
      )}

      {canAccessWorkspace && isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          initialTab={settingsTab}
          onClose={() => setIsSettingsOpen(false)}
          profile={profile}
          workspaceConfig={workspaceConfig}
          tasks={syncedTasks}
          aiTemporarilyDisabled={aiTemporarilyDisabled}
          effectiveApiKey={effectiveApiKey}
          onSetAiTemporarilyDisabled={handleSetAiTemporarilyDisabled}
          onSaveApiKey={handleSaveApiKey}
          onUpdateProfile={handleUpdateProfile}
          onUpdateWorkspaceConfig={handleUpdateWorkspaceConfig}
          onCustomVideoUploaded={() => setCustomVideoVersion((v) => v + 1)}
          onOpenCanvasSync={handleOpenCanvasSyncModal}
          onSyncCanvasTasks={handleSyncCanvasTasks}
        />
      )}

      {isCanvasSyncModalOpen && (
        <CanvasSyncModal
          isOpen={isCanvasSyncModalOpen}
          onClose={handleCloseCanvasSyncModal}
          feedUrl={profile.canvas_feed_url || ""}
          existingTasks={syncedTasks}
          onCommitSelected={handleCommitCanvasSelected}
          isCommitting={isCommittingCanvas}
        />
      )}

      {canAccessWorkspace && isNewTaskModalOpen && (
        <QuickCreateTaskModal
          isOpen={isNewTaskModalOpen}
          defaultSection={newTaskDefaultSection}
          onClose={() => setIsNewTaskModalOpen(false)}
          onCreateTask={handleCreateTask}
          userId={profile.id}
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl border border-primary/40 theme-panel px-4 py-2 text-xs font-medium text-white shadow-2xl">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
