"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  ActionProposalPayload,
  SectionGroup,
  TaskItem,
  UserProfile,
} from "@/types/taskit";
import { DEFAULT_PROFILE, INITIAL_SEED_TASKS } from "@/utils/seedData";
import { createClient, isSupabaseConfigured } from "@/utils/supabase/client";
import { VideoBackground } from "@/components/background/VideoBackground";
import { TopNavBar } from "@/components/dashboard/TopNavBar";
import { CircularProgress } from "@/components/dashboard/CircularProgress";
import { TaskTable } from "@/components/tasks/TaskTable";
import { CopilotSidebar } from "@/components/ai/CopilotSidebar";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { QuickCreateTaskModal } from "@/components/tasks/QuickCreateTaskModal";
import { CheckCircle2, Sparkles } from "lucide-react";

const LOCAL_STORAGE_TASKS_KEY = "taskit_tasks_v1";
const LOCAL_STORAGE_PROFILE_KEY = "taskit_profile_v1";

export default function TaskItWorkspacePage() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [tasks, setTasks] = useState<TaskItem[]>(INITIAL_SEED_TASKS);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState<boolean>(false);
  const [newTaskDefaultSection, setNewTaskDefaultSection] =
    useState<SectionGroup>("TODAY");
  const [customVideoVersion, setCustomVideoVersion] = useState<number>(0);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isSyncingCanvas, setIsSyncingCanvas] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    const timer = setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3800);
    return () => clearTimeout(timer);
  }, []);

  // 1. Load saved local state + check Supabase session & Realtime channel
  useEffect(() => {
    try {
      const savedProfile = localStorage.getItem(LOCAL_STORAGE_PROFILE_KEY);
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        setProfile((prev) => ({ ...prev, ...parsed }));
      }
      const savedTasks = localStorage.getItem(LOCAL_STORAGE_TASKS_KEY);
      if (savedTasks) {
        const parsedTasks = JSON.parse(savedTasks);
        if (Array.isArray(parsedTasks) && parsedTasks.length > 0) {
          setTasks(parsedTasks);
        }
      }
    } catch {
      // Ignore storage parse errors
    }

    if (!isSupabaseConfigured()) return;

    const supabase = createClient();

    async function initSupabaseSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setIsAuthenticated(true);

      const { data: dbProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (dbProfile) {
        setProfile((prev) => ({ ...prev, ...dbProfile }));
      }

      const { data: dbTasks } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("order_index", { ascending: true });

      if (dbTasks && dbTasks.length > 0) {
        setTasks(dbTasks as TaskItem[]);
      }
    }

    initSupabaseSession();

    // Realtime subscription for instant task state updates
    const channel = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        async () => {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (!user) return;
          const { data: latest } = await supabase
            .from("tasks")
            .select("*")
            .eq("user_id", user.id)
            .order("order_index", { ascending: true });
          if (latest) {
            setTasks(latest as TaskItem[]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 2. Apply CSS theme variable attribute to <html> whenever profile.theme changes
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", profile.theme);
  }, [profile.theme]);

  // 3. Global Keyboard Shortcuts: Cmd+K (new task), Cmd+/ (toggle Copilot)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsNewTaskModalOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setIsCopilotOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Persist tasks helper
  const persistTasks = useCallback((nextTasks: TaskItem[]) => {
    setTasks(nextTasks);
    try {
      localStorage.setItem(LOCAL_STORAGE_TASKS_KEY, JSON.stringify(nextTasks));
    } catch {
      // Ignore quota errors
    }
  }, []);

  // Update Profile handler
  const handleUpdateProfile = useCallback(
    async (updates: Partial<UserProfile>) => {
      setProfile((prev) => {
        const next = { ...prev, ...updates };
        try {
          localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });

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

  // Create Task handler
  const handleCreateTask = useCallback(
    async (newTaskInput: Omit<TaskItem, "id" | "created_at" | "updated_at">) => {
      const nowISO = new Date().toISOString();
      const created: TaskItem = {
        ...newTaskInput,
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        created_at: nowISO,
        updated_at: nowISO,
      };

      const next = [created, ...tasks];
      persistTasks(next);
      showToast(`Created task: "${created.title}"`);

      if (isSupabaseConfigured() && isAuthenticated) {
        try {
          const supabase = createClient();
          await supabase.from("tasks").insert({
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
            section_group: created.section_group,
            order_index: created.order_index,
          });
        } catch {}
      }
    },
    [tasks, persistTasks, showToast, isAuthenticated, profile.id]
  );

  // Update Task handler
  const handleUpdateTask = useCallback(
    async (taskId: string, updates: Partial<TaskItem>) => {
      const nowISO = new Date().toISOString();
      const next = tasks.map((t) =>
        t.id === taskId ? { ...t, ...updates, updated_at: nowISO } : t
      );
      persistTasks(next);

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
    [tasks, persistTasks, isAuthenticated]
  );

  // Delete Task handler
  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      const target = tasks.find((t) => t.id === taskId);
      const next = tasks.filter((t) => t.id !== taskId);
      persistTasks(next);
      if (target) {
        showToast(`Deleted "${target.title}"`);
      }

      if (isSupabaseConfigured() && isAuthenticated) {
        try {
          const supabase = createClient();
          await supabase.from("tasks").delete().eq("id", taskId);
        } catch {}
      }
    },
    [tasks, persistTasks, showToast, isAuthenticated]
  );

  // Sync HCPSS Canvas iCal Feed
  const handleSyncCanvasTasks = useCallback(
    async (feedUrl: string) => {
      setIsSyncingCanvas(true);
      try {
        const res = await fetch("/api/sync/canvas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ canvasFeedUrl: feedUrl }),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || "Sync failed");
        }

        const incoming: Partial<TaskItem>[] = data.tasks || [];
        const nowISO = new Date().toISOString();

        // Merge & deduplicate by title
        const updatedList = [...tasks];
        let addedOrUpdatedCount = 0;

        for (const item of incoming) {
          const existingIdx = updatedList.findIndex(
            (t) =>
              t.title.toLowerCase() === (item.title || "").toLowerCase()
          );
          if (existingIdx !== -1) {
            updatedList[existingIdx] = {
              ...updatedList[existingIdx],
              due_date: item.due_date || updatedList[existingIdx].due_date,
              canvas_course_code:
                item.canvas_course_code ||
                updatedList[existingIdx].canvas_course_code,
              is_canvas_assignment: true,
              updated_at: nowISO,
            };
            addedOrUpdatedCount++;
          } else {
            updatedList.unshift({
              id: item.id || `canvas-${Date.now()}-${addedOrUpdatedCount}`,
              user_id: profile.id,
              title: item.title || "Canvas Assignment",
              content: item.content || "",
              status: "To Do",
              type: "School",
              priority: item.priority || "High",
              due_date: item.due_date || nowISO,
              estimated_minutes: item.estimated_minutes || 45,
              tags: item.tags || ["#Canvas"],
              notes: item.notes || "",
              is_canvas_assignment: true,
              canvas_course_code: item.canvas_course_code || "HCPSS",
              custom_properties: item.custom_properties || {},
              section_group: item.section_group || "TODAY",
              order_index: 0,
              completed_at: null,
              created_at: nowISO,
              updated_at: nowISO,
            });
            addedOrUpdatedCount++;
          }
        }

        persistTasks(updatedList);
        showToast(
          `Synced ${addedOrUpdatedCount} HCPSS Canvas assignments into your board!`
        );

        return {
          count: addedOrUpdatedCount,
          usedDemoFeed: Boolean(data.usedDemoFeed),
        };
      } finally {
        setIsSyncingCanvas(false);
      }
    },
    [tasks, profile.id, persistTasks, showToast]
  );

  // Strict Action Confirmation Card execution handler
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

        const next = tasks.map((t) => {
          if (targetIds.has(t.id) || targetTitles.has(t.title.toLowerCase())) {
            return {
              ...t,
              due_date: nextDue,
              section_group: "SOON" as SectionGroup,
              updated_at: nowISO,
            };
          }
          return t;
        });

        persistTasks(next);
        showToast(`Confirmed: ${proposal.description}`);
      } else if (proposal.actionType === "BATCH_CREATE") {
        const newItems: TaskItem[] = proposal.changes.map((c, idx) => ({
          id: `ai-task-${Date.now()}-${idx}`,
          user_id: profile.id,
          title: c.title,
          content: `<p>Generated via TaskIt Copilot Action Card (${proposal.description}).</p>`,
          status: "To Do",
          type: c.type || "School",
          priority: c.priority || "High",
          due_date: proposal.newDueDate || nowISO,
          estimated_minutes: c.estimated_minutes || 40,
          tags: ["#Copilot", "#Sprint"],
          notes: "Added via Copilot Batch Action",
          is_canvas_assignment: false,
          canvas_course_code: null,
          custom_properties: {},
          section_group: c.section_group || "TODAY",
          order_index: idx,
          completed_at: null,
          created_at: nowISO,
          updated_at: nowISO,
        }));

        persistTasks([...newItems, ...tasks]);
        showToast(`Confirmed: Added ${newItems.length} new tasks to board!`);
      } else if (proposal.actionType === "PRIORITIZE_AND_TAG") {
        const targetIds = new Set(
          proposal.changes.map((c) => c.id).filter(Boolean)
        );
        const next = tasks.map((t) =>
          targetIds.has(t.id)
            ? {
                ...t,
                priority: "Urgent" as const,
                tags: t.tags.includes("#HighROI")
                  ? t.tags
                  : [...t.tags, "#HighROI"],
                updated_at: nowISO,
              }
            : t
        );
        persistTasks(next);
        showToast(`Confirmed: ${proposal.description}`);
      }
    },
    [tasks, profile.id, persistTasks, showToast]
  );

  // Supabase Google OAuth Sign-In
  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured()) {
      showToast(
        "Demo Mode Active: Add NEXT_PUBLIC_SUPABASE_URL & ANON_KEY in .env.local for live Google OAuth."
      );
      setIsSettingsOpen(true);
      return;
    }

    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
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
    showToast("Signed out of Supabase session.");
  };

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* 1. Zero-Bandwidth Fullscreen Video & Procedural Glass Background */}
      <VideoBackground
        preset={profile.video_bg_preset}
        dim={profile.video_bg_dim}
        blur={profile.video_bg_blur}
        customVideoVersion={customVideoVersion}
      />

      {/* 2. Top Navigation Bar */}
      <TopNavBar
        profile={profile}
        isAuthenticated={isAuthenticated}
        isCopilotOpen={isCopilotOpen}
        isSyncingCanvas={isSyncingCanvas}
        onUpdateProfile={handleUpdateProfile}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleCopilot={() => setIsCopilotOpen((prev) => !prev)}
        onQuickSyncCanvas={() =>
          handleSyncCanvasTasks(profile.canvas_feed_url || "")
        }
        onGoogleSignIn={handleGoogleSignIn}
        onSignOut={handleSignOut}
      />

      {/* 3. Main Dashboard Workspace Container */}
      <main
        className={`flex-1 mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 py-6 space-y-6 transition-all duration-300 ${
          isCopilotOpen ? " lg:pr-[450px]" : ""
        }`}
      >
        {/* Motivational Header & Futuristic Radial Progress Ring */}
        <CircularProgress tasks={tasks} streakDays={14} />

        {/* Notion-Style Document Task Table with Section Dividers & Drag-and-Drop */}
        <TaskTable
          tasks={tasks}
          selectedTaskId={selectedTaskId}
          viewMode={profile.view_mode}
          onSelectTask={setSelectedTaskId}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
          onReorderTasks={persistTasks}
          onOpenNewTaskModal={(sec) => {
            setNewTaskDefaultSection(sec || "TODAY");
            setIsNewTaskModalOpen(true);
          }}
        />
      </main>

      {/* 4. AI Side-Agent ("TaskIt Copilot") with Action Confirmation Card Protocol */}
      <CopilotSidebar
        isOpen={isCopilotOpen}
        onToggle={() => setIsCopilotOpen((prev) => !prev)}
        tasks={tasks}
        aiTone={profile.ai_tone}
        customApiKey={profile.custom_ai_api_key}
        onChangeTone={(tone) => handleUpdateProfile({ ai_tone: tone })}
        onConfirmActionProposal={handleConfirmActionProposal}
      />

      {/* 5. User Settings & Customization Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        profile={profile}
        tasks={tasks}
        onUpdateProfile={handleUpdateProfile}
        onCustomVideoUploaded={() => setCustomVideoVersion((v) => v + 1)}
        onSyncCanvasTasks={handleSyncCanvasTasks}
      />

      {/* 6. Quick Create Task Modal (Cmd+K) */}
      <QuickCreateTaskModal
        isOpen={isNewTaskModalOpen}
        defaultSection={newTaskDefaultSection}
        onClose={() => setIsNewTaskModalOpen(false)}
        onCreateTask={handleCreateTask}
        userId={profile.id}
      />

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-2xl border border-primary/50 bg-[#051014]/95 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-neon backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

