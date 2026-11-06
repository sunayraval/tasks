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
import { CheckCircle2, LogIn, ShieldAlert, Sparkles } from "lucide-react";

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
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [isSyncingCanvas, setIsSyncingCanvas] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    const timer = setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  // 1. Check Supabase session & fetch user data
  useEffect(() => {
    // Check if redirected with an auth error
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const authError = urlParams.get("auth_error");
      if (authError) {
        showToast(`Sign in error: ${authError}`);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
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
            setProfile((prev) => ({ ...prev, ...dbProfile }));
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

          if (dbTasks) {
            setTasks(dbTasks as TaskItem[]);
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

    // Listen to Auth State Changes
    const {
      data: { subscription: authListener },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setIsAuthenticated(true);
        const { data: dbTasks } = await supabase
          .from("tasks")
          .select("*")
          .eq("user_id", session.user.id)
          .order("order_index", { ascending: true });
        if (dbTasks) setTasks(dbTasks as TaskItem[]);
      } else {
        setIsAuthenticated(false);
        setTasks([]);
      }
    });

    // Realtime channel for tasks
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
          if (latest) setTasks(latest as TaskItem[]);
        }
      )
      .subscribe();

    return () => {
      authListener.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  // 2. Set theme data-theme on html
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", profile.theme);
  }, [profile.theme]);

  // 3. Keyboard shortcuts: Cmd+K (new task)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        if (!isAuthenticated) return;
        e.preventDefault();
        setIsNewTaskModalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAuthenticated]);

  // Update Profile
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

  // Create Task
  const handleCreateTask = useCallback(
    async (newTaskInput: Omit<TaskItem, "id" | "created_at" | "updated_at">) => {
      const nowISO = new Date().toISOString();
      const tempId = `task-${Date.now()}`;
      const created: TaskItem = {
        ...newTaskInput,
        id: tempId,
        created_at: nowISO,
        updated_at: nowISO,
      };

      setTasks((prev) => [created, ...prev]);
      showToast(`Created: "${created.title}"`);

      if (isSupabaseConfigured() && isAuthenticated) {
        try {
          const supabase = createClient();
          const { data } = await supabase
            .from("tasks")
            .insert({
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
            })
            .select()
            .single();

          if (data?.id) {
            setTasks((prev) =>
              prev.map((t) => (t.id === tempId ? (data as TaskItem) : t))
            );
          }
        } catch (err) {
          console.error("Create task error:", err);
        }
      }
    },
    [showToast, isAuthenticated, profile.id]
  );

  // Update Task
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

  // Delete Task
  const handleDeleteTask = useCallback(
    async (taskId: string) => {
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
          await supabase.from("tasks").delete().eq("id", taskId);
        } catch (err) {
          console.error("Delete task error:", err);
        }
      }
    },
    [tasks, selectedTaskId, showToast, isAuthenticated]
  );

  // Reorder Tasks
  const handleReorderTasks = useCallback(
    (newTasks: TaskItem[]) => {
      setTasks(newTasks);
    },
    []
  );

  // Sync Canvas
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
        const updatedList = [...tasks];
        let addedCount = 0;

        for (const item of incoming) {
          const existingIdx = updatedList.findIndex(
            (t) => t.title.toLowerCase() === (item.title || "").toLowerCase()
          );
          if (existingIdx === -1) {
            const newItem: TaskItem = {
              id: item.id || `canvas-${Date.now()}-${addedCount}`,
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
            };
            updatedList.unshift(newItem);
            addedCount++;
          }
        }

        setTasks(updatedList);
        showToast(`Synced ${addedCount} Canvas assignments into your workspace.`);
        return { count: addedCount, usedDemoFeed: Boolean(data.usedDemoFeed) };
      } finally {
        setIsSyncingCanvas(false);
      }
    },
    [tasks, profile.id, showToast]
  );

  // Confirm Copilot Proposals
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
            if (targetIds.has(t.id) || targetTitles.has(t.title.toLowerCase())) {
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
        showToast(`Rescheduled tasks to ${proposal.newDueDate ? "selected date" : "Saturday"}`);
      } else if (proposal.actionType === "BATCH_CREATE") {
        const newItems: TaskItem[] = proposal.changes.map((c, idx) => ({
          id: `ai-${Date.now()}-${idx}`,
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
          order_index: idx,
          completed_at: null,
          created_at: nowISO,
          updated_at: nowISO,
        }));

        setTasks((prev) => [...newItems, ...prev]);
        showToast(`Added ${newItems.length} tasks!`);
      }
    },
    [profile.id, isAuthenticated, showToast]
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
    <div className="relative min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      {/* Background (Controlled dimming) */}
      <VideoBackground
        preset={profile.video_bg_preset}
        dim={profile.video_bg_dim}
        blur={profile.video_bg_blur}
        customVideoVersion={customVideoVersion}
      />

      {/* Top Navbar */}
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

      {/* Main Content Area */}
      <main
        className={`flex-1 mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8 py-6 space-y-5 transition-all duration-300 ${
          isCopilotOpen ? " lg:pr-[440px]" : ""
        }`}
      >
        {!isAuthenticated && authChecked ? (
          /* Sign-In Gate: Clean Minimal Wall */
          <div className="my-12 mx-auto max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/90 p-8 text-center shadow-2xl backdrop-blur-xl space-y-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-black font-extrabold text-2xl shadow-sm">
              T
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-white">
                Welcome to TaskIt
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Your private AI productivity workspace and Notion-style task database.
                Sign in with Google to create and sync your personal tasks.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-white py-3 px-4 text-sm font-semibold text-black hover:bg-zinc-200 transition-colors shadow-sm"
              >
                <LogIn className="w-4 h-4" />
                <span>Continue with Google</span>
              </button>
            </div>

            <div className="pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-500">
              Personal Supabase PostgreSQL database with Row Level Security.
            </div>
          </div>
        ) : (
          /* Authenticated Workspace */
          <>
            {/* Header Telemetry */}
            <CircularProgress tasks={tasks} streakDays={1} />

            {/* Task Table */}
            <TaskTable
              tasks={tasks}
              selectedTaskId={selectedTaskId}
              viewMode={profile.view_mode}
              onSelectTask={setSelectedTaskId}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onReorderTasks={handleReorderTasks}
              onOpenNewTaskModal={(sec) => {
                setNewTaskDefaultSection(sec || "TODAY");
                setIsNewTaskModalOpen(true);
              }}
            />
          </>
        )}
      </main>

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

      {/* Settings Modal */}
      {isAuthenticated && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          profile={profile}
          tasks={tasks}
          onUpdateProfile={handleUpdateProfile}
          onCustomVideoUploaded={() => setCustomVideoVersion((v) => v + 1)}
          onSyncCanvasTasks={handleSyncCanvasTasks}
        />
      )}

      {/* Quick Create Task Modal (Cmd+K) */}
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
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-medium text-white shadow-xl">
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
