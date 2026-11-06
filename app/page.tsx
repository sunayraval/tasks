"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  ActionProposalPayload,
  DEFAULT_WORKSPACE_CONFIG,
  getWorkspaceConfig,
  SectionGroup,
  TaskItem,
  UserProfile,
  WorkspaceConfig,
} from "@/types/taskit";
import { DEFAULT_PROFILE, INITIAL_SEED_TASKS } from "@/utils/seedData";
import { createClient, isSupabaseConfigured } from "@/utils/supabase/client";
import { VideoBackground } from "@/components/background/VideoBackground";
import { TopNavBar } from "@/components/dashboard/TopNavBar";
import { CircularProgress } from "@/components/dashboard/CircularProgress";
import { TaskTable } from "@/components/tasks/TaskTable";
import { CopilotSidebar } from "@/components/ai/CopilotSidebar";
import {
  SettingsModal,
  SettingsTabId,
} from "@/components/settings/SettingsModal";
import { QuickCreateTaskModal } from "@/components/tasks/QuickCreateTaskModal";
import { CheckCircle2, LogIn } from "lucide-react";

const LOCAL_STORAGE_CONFIG_KEY = "taskit_workspace_config_v1";
const HEADERS_SEEDED_STORAGE_KEY = "taskit_doc_headers_seeded_v1";

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

export default function TaskItWorkspacePage() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_SEED_TASKS);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTabId>("customize");
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState<boolean>(false);
  const [newTaskDefaultSection, setNewTaskDefaultSection] =
    useState<SectionGroup>("TODAY");
  const [customVideoVersion, setCustomVideoVersion] = useState<number>(0);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [isSyncingCanvas, setIsSyncingCanvas] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Persistent tracking of deleted task IDs to eliminate any re-query flicker
  const deletedTaskIdsRef = useRef<Set<string>>(new Set());

  // Ref to trigger canvas sync in parallel from auth initialization without circular dependency
  const syncCanvasParallelRef = useRef<
    (feedUrl: string, isAutoSync?: boolean) => Promise<unknown>
  >(async () => {});

  const workspaceConfig = useMemo(() => getWorkspaceConfig(profile), [profile]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    const timer = setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

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

      // Load cached customization from localStorage as immediate fallback
      try {
        const cached = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          setProfile((prev) => ({
            ...prev,
            custom_theme_json: {
              ...(prev.custom_theme_json || {}),
              ...parsed,
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

    async function initSession() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setIsAuthenticated(true);

          const { data: dbProfile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

          if (dbProfile) {
            setProfile((prev) => ({
              ...prev,
              ...dbProfile,
              custom_theme_json:
                dbProfile.custom_theme_json || prev.custom_theme_json,
            }));
          } else {
            setProfile((prev) => ({
              ...prev,
              id: user.id,
              email: user.email || "",
              full_name:
                user.user_metadata?.full_name ||
                user.user_metadata?.name ||
                null,
            }));
          }

          const { data: dbTasks } = await supabase
            .from("tasks")
            .select("*")
            .eq("user_id", user.id)
            .order("order_index", { ascending: true });

          const loadedTasks = ((dbTasks || []) as TaskItem[]).filter(
            (t) => !deletedTaskIdsRef.current.has(t.id)
          );

          const hasAnyHeaderRow = loadedTasks.some((t) =>
            Boolean(t.custom_properties?.is_header)
          );
          const alreadySeeded =
            typeof window !== "undefined" &&
            localStorage.getItem(`${HEADERS_SEEDED_STORAGE_KEY}_${user.id}`) ===
              "true";

          if (!hasAnyHeaderRow && !alreadySeeded) {
            if (typeof window !== "undefined") {
              localStorage.setItem(
                `${HEADERS_SEEDED_STORAGE_KEY}_${user.id}`,
                "true"
              );
            }

            const activeSections =
              getWorkspaceConfig(dbProfile || DEFAULT_PROFILE).sections ||
              DEFAULT_WORKSPACE_CONFIG.sections;

            const { combined, createdHeaders } = buildDefaultHeaderRowsForTasks(
              user.id,
              loadedTasks,
              activeSections
            );
            setTasks(combined);

            // Insert movable header rows into Supabase tasks table with exact UUIDs
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

              // Also persist updated order_index for existing tasks
              for (const item of combined) {
                if (!createdHeaders.some((h) => h.id === item.id)) {
                  supabase
                    .from("tasks")
                    .update({ order_index: item.order_index })
                    .eq("id", item.id)
                    .then();
                }
              }
            }
          } else {
            setTasks(loadedTasks);
          }

          // Auto-sync Canvas in parallel in background if it hasn't synced already this session
          const autoSyncKey = `canvas_autosynced_${user.id}`;
          const alreadyAutoSynced =
            typeof window !== "undefined" &&
            sessionStorage.getItem(autoSyncKey) === "true";

          if (!alreadyAutoSynced) {
            if (typeof window !== "undefined") {
              sessionStorage.setItem(autoSyncKey, "true");
            }
            // Trigger in parallel without awaiting to keep page load instant
            const feedUrl =
              dbProfile?.canvas_feed_url || profile.canvas_feed_url || "";
            syncCanvasParallelRef.current(feedUrl, true).catch(() => {});
          }
        } else {
          setIsAuthenticated(false);
          setTasks([]);
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        setAuthChecked(true);
      }
    }

    initSession();

    const {
      data: { subscription: authListener },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setIsAuthenticated(true);
        const { data: dbTasks } = await supabase
          .from("tasks")
          .select("*")
          .eq("user_id", session.user.id)
          .order("order_index", { ascending: true });
        if (dbTasks) {
          setTasks(
            (dbTasks as TaskItem[]).filter(
              (t) => !deletedTaskIdsRef.current.has(t.id)
            )
          );
        }
      } else {
        setIsAuthenticated(false);
        setTasks([]);
      }
    });

    // Granular Real-time Subscription: avoids full-table refetches that cause flicker/resurrection
    const channel = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id?: string })?.id;
            if (deletedId) {
              deletedTaskIdsRef.current.add(deletedId);
              setTasks((prev) => prev.filter((t) => t.id !== deletedId));
            }
            return;
          }

          if (payload.eventType === "INSERT") {
            const newItem = payload.new as TaskItem;
            if (
              !newItem?.id ||
              deletedTaskIdsRef.current.has(newItem.id)
            ) {
              return;
            }
            setTasks((prev) => {
              if (prev.some((t) => t.id === newItem.id)) return prev;
              return [...prev, newItem];
            });
            return;
          }

          if (payload.eventType === "UPDATE") {
            const updatedItem = payload.new as TaskItem;
            if (
              !updatedItem?.id ||
              deletedTaskIdsRef.current.has(updatedItem.id)
            ) {
              return;
            }
            setTasks((prev) =>
              prev.map((t) =>
                t.id === updatedItem.id ? { ...t, ...updatedItem } : t
              )
            );
            return;
          }
        }
      )
      .subscribe();

    return () => {
      authListener.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [showToast, profile.canvas_feed_url]);

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
      setProfile((prev) => ({ ...prev, ...updates }));

      if (isSupabaseConfigured() && isAuthenticated) {
        try {
          const supabase = createClient();
          await supabase
            .from("profiles")
            .update(updates)
            .eq("id", profile.id);
        } catch {}
      }
    },
    [isAuthenticated, profile.id]
  );

  // 4. Update Workspace Customization Config (persisted in custom_theme_json & localStorage)
  const handleUpdateWorkspaceConfig = useCallback(
    async (updates: Partial<WorkspaceConfig>) => {
      setProfile((prev) => {
        const currentConfig = getWorkspaceConfig(prev);
        const mergedConfig: WorkspaceConfig = {
          ...currentConfig,
          ...updates,
          columnHeaders: {
            ...currentConfig.columnHeaders,
            ...(updates.columnHeaders || {}),
          },
        };

        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(
              LOCAL_STORAGE_CONFIG_KEY,
              JSON.stringify(mergedConfig)
            );
          } catch {}
        }

        const nextJson = mergedConfig as unknown as Record<string, unknown>;

        if (isSupabaseConfigured() && isAuthenticated) {
          const supabase = createClient();
          supabase
            .from("profiles")
            .update({ custom_theme_json: nextJson })
            .eq("id", prev.id)
            .then();
        }

        return {
          ...prev,
          custom_theme_json: nextJson,
        };
      });
    },
    [isAuthenticated]
  );

  // 5. Create Task (from Modal or Copilot) with real UUID
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

      setTasks((prev) => [...prev, created]);
      showToast(`Created: "${created.title}"`);

      if (isSupabaseConfigured() && isAuthenticated) {
        try {
          const supabase = createClient();
          await supabase.from("tasks").insert({
            id: newUuid,
            user_id: profile.id,
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
            custom_properties: created.custom_properties || {},
            section_group: created.section_group,
            order_index: created.order_index,
          });
        } catch (err) {
          console.error("Create task error:", err);
        }
      }
    },
    [showToast, isAuthenticated, profile.id]
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
      };

      let nextList: TaskItem[] = [];
      if (afterIdx !== -1) {
        const copy = [...tasks];
        copy.splice(afterIdx + 1, 0, created);
        nextList = copy.map((item, idx) => ({ ...item, order_index: idx }));
      } else {
        nextList = [...tasks, created].map((item, idx) => ({
          ...item,
          order_index: idx,
        }));
      }

      setTasks(nextList);

      if (isSupabaseConfigured() && isAuthenticated) {
        const supabase = createClient();
        supabase
          .from("tasks")
          .insert({
            id: newUuid,
            user_id: profile.id,
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
            custom_properties: {},
            section_group: created.section_group,
            order_index: insertOrderIndex,
          })
          .then();
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
      };

      let nextList: TaskItem[] = [];
      if (afterIdx !== -1) {
        const copy = [...tasks];
        copy.splice(afterIdx + 1, 0, createdHeader);
        nextList = copy.map((item, idx) => ({ ...item, order_index: idx }));
      } else {
        nextList = [...tasks, createdHeader].map((item, idx) => ({
          ...item,
          order_index: idx,
        }));
      }

      setTasks(nextList);

      if (isSupabaseConfigured() && isAuthenticated) {
        const supabase = createClient();
        supabase
          .from("tasks")
          .insert({
            id: newUuid,
            user_id: profile.id,
            title: createdHeader.title,
            content: "",
            status: createdHeader.status,
            type: createdHeader.type,
            priority: createdHeader.priority,
            due_date: null,
            estimated_minutes: 0,
            tags: [],
            notes: "",
            is_canvas_assignment: false,
            canvas_course_code: null,
            custom_properties: { is_header: true },
            section_group: createdHeader.section_group,
            order_index: insertOrderIndex,
          })
          .then();
      }

      return newUuid;
    },
    [profile.id, tasks, isAuthenticated]
  );

  // 7. Update Task or Header Row
  const handleUpdateTask = useCallback(
    async (taskId: string, updates: Partial<TaskItem>) => {
      const nowISO = new Date().toISOString();
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, ...updates, updated_at: nowISO } : t
        )
      );

      if (isSupabaseConfigured() && isAuthenticated) {
        try {
          const supabase = createClient();
          await supabase
            .from("tasks")
            .update({ ...updates, updated_at: nowISO })
            .eq("id", taskId);
        } catch {}
      }
    },
    [isAuthenticated]
  );

  // 8. Delete Task or Header Row - flicker-free and permanent
  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      // Instantly track in deleted set so no real-time or sync payload brings it back
      deletedTaskIdsRef.current.add(taskId);

      const target = tasks.find((t) => t.id === taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      if (selectedTaskId === taskId) {
        setSelectedTaskId(null);
      }
      if (target) {
        showToast(`Deleted "${target.title}"`);
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
          } else if (target) {
            // Delete legacy non-UUID items by title
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
    [tasks, selectedTaskId, showToast, isAuthenticated, profile.id]
  );

  // 9. Reorder Tasks & Movable Headers (persists order_index to Supabase)
  const handleReorderTasks = useCallback(
    (newTasks: TaskItem[]) => {
      const indexed = newTasks.map((item, idx) => ({
        ...item,
        order_index: idx,
      }));
      setTasks(indexed);

      if (isSupabaseConfigured() && isAuthenticated) {
        const supabase = createClient();
        for (const item of indexed) {
          const isUuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              item.id
            );
          if (isUuid) {
            supabase
              .from("tasks")
              .update({ order_index: item.order_index })
              .eq("id", item.id)
              .then();
          }
        }
      }
    },
    [isAuthenticated]
  );

  // 10. Sync Canvas (autofills due date, priority, tags, section_group; filters today/tmr/day-after)
  const handleSyncCanvasTasks = useCallback(
    async (feedUrl: string, isAutoSync: boolean = false) => {
      setIsSyncingCanvas(true);
      try {
        const clientDate = new Date().toISOString();
        const res = await fetch("/api/sync/canvas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            canvasFeedUrl: feedUrl,
            clientDate,
          }),
        });
        const data = await res.json();
        if (!data.success) {
          if (!isAutoSync) throw new Error(data.error || "Sync failed");
          return;
        }

        const incoming: TaskItem[] = data.tasks || [];
        if (incoming.length === 0) {
          if (!isAutoSync) {
            showToast(
              "Canvas feed up to date (no items due today, tomorrow, or day after)."
            );
          }
          return { count: 0, usedDemoFeed: Boolean(data.usedDemoFeed) };
        }

        let addedCount = 0;
        setTasks((prev) => {
          const updatedList = [...prev];
          for (const item of incoming) {
            // If already deleted in this session, never restore
            if (deletedTaskIdsRef.current.has(item.id)) continue;

            const existingIdx = updatedList.findIndex(
              (t) =>
                t.id === item.id ||
                (t.is_canvas_assignment &&
                  t.title.toLowerCase() === item.title.toLowerCase())
            );

            if (existingIdx !== -1) {
              updatedList[existingIdx] = {
                ...updatedList[existingIdx],
                due_date: item.due_date,
                priority: item.priority,
                estimated_minutes: item.estimated_minutes,
                section_group: item.section_group,
                canvas_course_code: item.canvas_course_code,
                tags: Array.from(
                  new Set([...updatedList[existingIdx].tags, ...item.tags])
                ),
              };
            } else {
              updatedList.push(item);
              addedCount++;
            }
          }
          return updatedList;
        });

        if (addedCount > 0 || !isAutoSync) {
          showToast(
            addedCount > 0
              ? `Synced ${addedCount} Canvas assignment${
                  addedCount > 1 ? "s" : ""
                } due soon!`
              : "Canvas assignments up to date."
          );
        }

        return { count: addedCount, usedDemoFeed: Boolean(data.usedDemoFeed) };
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Sync error";
        if (!isAutoSync) {
          showToast(`Canvas sync error: ${errMsg}`);
        }
      } finally {
        setIsSyncingCanvas(false);
      }
    },
    [showToast]
  );

  // Keep ref up to date for parallel autosync invocation
  useEffect(() => {
    syncCanvasParallelRef.current = handleSyncCanvasTasks;
  }, [handleSyncCanvasTasks]);

  // 11. Confirm Copilot Proposals
  const handleConfirmActionProposal = useCallback(
    async (proposal: ActionProposalPayload) => {
      const nowISO = new Date().toISOString();

      if (proposal.actionType === "BATCH_RESCHEDULE") {
        const targetIds = new Set(
          proposal.changes.map((c) => c.id).filter(Boolean)
        );
        const targetTitles = new Set(
          proposal.changes.map((c) => c.title.toLowerCase())
        );
        const nextDue =
          proposal.newDueDate ||
          new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

        setTasks((prev) =>
          prev.map((t) => {
            if (
              targetIds.has(t.id) ||
              targetTitles.has(t.title.toLowerCase())
            ) {
              const updated = {
                ...t,
                due_date: nextDue,
                section_group: "SOON" as SectionGroup,
                updated_at: nowISO,
              };
              if (isAuthenticated) {
                createClient()
                  .from("tasks")
                  .update({ due_date: nextDue, section_group: "SOON" })
                  .eq("id", t.id)
                  .then();
              }
              return updated;
            }
            return t;
          })
        );
        showToast(
          `Rescheduled tasks to ${
            proposal.newDueDate ? "selected date" : "Saturday"
          }`
        );
      } else if (proposal.actionType === "BATCH_CREATE") {
        const newItems: TaskItem[] = proposal.changes.map((c, idx) => ({
          id: generateUUID(),
          user_id: profile.id,
          title: c.title,
          content: "<p>Created via Copilot.</p>",
          status: "To Do",
          type: c.type || "School",
          priority: c.priority || "High",
          due_date: proposal.newDueDate || nowISO,
          estimated_minutes: c.estimated_minutes || 30,
          tags: ["#Copilot"],
          notes: "",
          is_canvas_assignment: false,
          canvas_course_code: null,
          custom_properties: {},
          section_group: c.section_group || "TODAY",
          order_index: tasks.length + idx,
          completed_at: null,
          created_at: nowISO,
          updated_at: nowISO,
        }));

        setTasks((prev) => [...prev, ...newItems]);
        showToast(`Added ${newItems.length} tasks!`);
      }
    },
    [profile.id, isAuthenticated, showToast, tasks.length]
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

  return (
    <div className="relative min-h-screen flex flex-col text-zinc-100">
      {/* Ambient Theme & Video Background */}
      <VideoBackground
        preset={profile.video_bg_preset}
        dim={profile.video_bg_dim}
        blur={profile.video_bg_blur}
        customVideoVersion={customVideoVersion}
      />

      {/* Foreground Content Layer */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top Navbar */}
        <TopNavBar
          profile={profile}
          workspaceConfig={workspaceConfig}
          isAuthenticated={isAuthenticated}
          isCopilotOpen={isCopilotOpen}
          isSyncingCanvas={isSyncingCanvas}
          onUpdateProfile={handleUpdateProfile}
          onUpdateWorkspaceConfig={handleUpdateWorkspaceConfig}
          onOpenSettings={() => {
            setSettingsTab("customize");
            setIsSettingsOpen(true);
          }}
          onToggleCopilot={() => setIsCopilotOpen((prev) => !prev)}
          onQuickSyncCanvas={() =>
            handleSyncCanvasTasks(profile.canvas_feed_url || "")
          }
          onGoogleSignIn={handleGoogleSignIn}
          onSignOut={handleSignOut}
        />

        {/* Main Content Area */}
        <main
          className={`flex-1 mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 py-6 space-y-5 transition-all duration-300 ${
            isCopilotOpen ? " lg:pr-[440px]" : ""
          }`}
        >
          {!isAuthenticated && authChecked ? (
            /* Sign-In Gate */
            <div className="my-12 mx-auto max-w-md rounded-2xl border theme-panel p-8 text-center shadow-2xl backdrop-blur-2xl space-y-6">
              <div
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl font-extrabold text-2xl shadow-neon"
                style={{
                  backgroundColor: "var(--primary)",
                  color: "#09090b",
                }}
              >
                {(workspaceConfig.brandName || "T").charAt(0).toUpperCase()}
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  Welcome to {workspaceConfig.brandName}
                </h2>
                <p className="text-xs text-white/65 leading-relaxed">
                  Your ultra-customizable AI productivity workspace and
                  Notion-style task database. Sign in with Google to sync your
                  tasks and custom themes.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-primary py-3 px-4 text-sm font-bold text-black hover:brightness-110 transition-all shadow-neon"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Continue with Google</span>
                </button>
              </div>

              <div className="pt-2 border-t border-white/10 text-[11px] text-white/45">
                Personal Supabase PostgreSQL database with Row Level Security.
              </div>
            </div>
          ) : (
            /* Authenticated Workspace */
            <>
              {/* Header Telemetry (Editable Title & Motto) */}
              <CircularProgress
                tasks={tasks}
                workspaceConfig={workspaceConfig}
                onUpdateWorkspaceConfig={handleUpdateWorkspaceConfig}
                streakDays={1}
              />

              {/* Customizable Document-Style Task Table */}
              <TaskTable
                tasks={tasks}
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
            </>
          )}
        </main>
      </div>

      {/* AI Copilot Side Drawer */}
      {isAuthenticated && (
        <CopilotSidebar
          isOpen={isCopilotOpen}
          onToggle={() => setIsCopilotOpen((prev) => !prev)}
          tasks={tasks}
          aiTone={profile.ai_tone}
          customApiKey={profile.custom_ai_api_key}
          onChangeTone={(tone) => handleUpdateProfile({ ai_tone: tone })}
          onConfirmActionProposal={handleConfirmActionProposal}
        />
      )}

      {/* Settings & Customization Modal */}
      {isAuthenticated && (
        <SettingsModal
          isOpen={isSettingsOpen}
          initialTab={settingsTab}
          onClose={() => setIsSettingsOpen(false)}
          profile={profile}
          workspaceConfig={workspaceConfig}
          tasks={tasks}
          onUpdateProfile={handleUpdateProfile}
          onUpdateWorkspaceConfig={handleUpdateWorkspaceConfig}
          onCustomVideoUploaded={() => setCustomVideoVersion((v) => v + 1)}
          onSyncCanvasTasks={handleSyncCanvasTasks}
        />
      )}

      {/* Quick Create Task Modal */}
      {isAuthenticated && (
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl border border-primary/40 theme-panel px-4 py-2 text-xs font-medium text-white shadow-2xl backdrop-blur-xl">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
