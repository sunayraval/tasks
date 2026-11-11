"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { TaskItem } from "@/types/taskit";
import {
  Calendar,
  Check,
  CheckCheck,
  Clock,
  GraduationCap,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  X,
  AlertCircle,
  Tag,
} from "lucide-react";

export interface CanvasSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  feedUrl: string;
  existingTasks: TaskItem[];
  onCommitSelected: (selectedTasks: TaskItem[]) => Promise<void> | void;
  isCommitting?: boolean;
}

export const CanvasSyncModal: React.FC<CanvasSyncModalProps> = ({
  isOpen,
  onClose,
  feedUrl,
  existingTasks,
  onCommitSelected,
  isCommitting = false,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedTasks, setFetchedTasks] = useState<TaskItem[]>([]);
  const [usedDemoFeed, setUsedDemoFeed] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Map of existing tasks for quick lookup by normalized title or canvas_uid
  const existingLookup = useMemo(() => {
    const titleSet = new Set<string>();
    const uidSet = new Set<string>();
    for (const t of existingTasks) {
      if (t.title) {
        titleSet.add(t.title.trim().toLowerCase());
      }
      if (t.custom_properties?.canvas_uid) {
        uidSet.add(String(t.custom_properties.canvas_uid));
      }
    }
    return { titleSet, uidSet };
  }, [existingTasks]);

  const isAlreadyOnBoard = useCallback(
    (task: TaskItem): boolean => {
      const normTitle = task.title.trim().toLowerCase();
      if (existingLookup.titleSet.has(normTitle)) return true;
      const uid = task.custom_properties?.canvas_uid;
      if (uid && existingLookup.uidSet.has(String(uid))) return true;
      return false;
    },
    [existingLookup]
  );

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const clientDate = new Date().toISOString();
      const res = await fetch("/api/sync/canvas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify({
          canvasFeedUrl: feedUrl,
          clientDate,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to load Canvas feed");
      }

      const incoming: TaskItem[] = data.tasks || [];
      setFetchedTasks(incoming);
      setUsedDemoFeed(Boolean(data.usedDemoFeed));

      // Intelligent pre-selection:
      // Auto-select tasks that are NOT yet on the user's board
      const initialSelected = new Set<string>();
      let hasNewTasks = false;

      for (const t of incoming) {
        const normTitle = t.title.trim().toLowerCase();
        const uid = t.custom_properties?.canvas_uid;
        const alreadyExists =
          existingLookup.titleSet.has(normTitle) ||
          (uid && existingLookup.uidSet.has(String(uid)));

        if (!alreadyExists) {
          initialSelected.add(t.id);
          hasNewTasks = true;
        }
      }

      // If all tasks are already on board, leave them unselected by default
      // so the user doesn't accidentally duplicate or re-write without intent
      setSelectedIds(initialSelected);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error syncing Canvas";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [feedUrl, existingLookup]);

  useEffect(() => {
    if (isOpen) {
      fetchPreview();
      setSearchQuery("");
    }
  }, [isOpen, fetchPreview]);

  // Filter tasks by query
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return fetchedTasks;
    const q = searchQuery.toLowerCase();
    return fetchedTasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.canvas_course_code &&
          t.canvas_course_code.toLowerCase().includes(q)) ||
        (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(q)))
    );
  }, [fetchedTasks, searchQuery]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredTasks.length && filteredTasks.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredTasks.map((t) => t.id)));
    }
  };

  const handleConfirm = async () => {
    const selected = fetchedTasks.filter((t) => selectedIds.has(t.id));
    if (selected.length === 0) return;
    await onCommitSelected(selected);
  };

  const formatDueDate = (iso: string | null) => {
    if (!iso) return "No due date";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "No due date";

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round(
      (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    const timeStr = d.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

    if (diffDays === 0) return `Today at ${timeStr}`;
    if (diffDays === 1) return `Tomorrow at ${timeStr}`;
    if (diffDays === 2) return `Day after tomorrow at ${timeStr}`;

    return `${d.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
    })} at ${timeStr}`;
  };

  const getPriorityBadge = (priority: string) => {
    const p = priority.toLowerCase();
    if (p === "urgent") {
      return "border-red-500/40 bg-red-500/15 text-red-300";
    }
    if (p === "high") {
      return "border-orange-500/40 bg-orange-500/15 text-orange-300";
    }
    if (p === "low") {
      return "border-slate-500/40 bg-slate-500/15 text-slate-300";
    }
    return "border-amber-500/40 bg-amber-500/15 text-amber-300";
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl sm:rounded-3xl border border-white/20 bg-[#0d1017]/95 backdrop-blur-2xl shadow-[0_25px_80px_rgba(0,0,0,0.85)] flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-primary/20 text-primary border border-primary/40 shadow-neon">
              <GraduationCap className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  Sync Canvas Assignments
                </h3>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    usedDemoFeed
                      ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                      : "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                  }`}
                >
                  {usedDemoFeed ? "Sample Feed" : "Live Feed"}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-white/55 mt-0.5">
                Select which upcoming assignments you want to add to your workspace.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Search & Select All */}
        {!loading && !error && fetchedTasks.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 px-4 sm:px-6 py-3 border-b border-white/10 bg-black/40">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by course or title..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-white/15 bg-white/[0.05] text-xs text-white placeholder-white/40 focus:border-primary focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Select All Toggle */}
            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSelectAll}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 text-[11px] font-medium text-white/80 hover:text-white transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5 text-primary" />
                <span>
                  {selectedIds.size === filteredTasks.length &&
                  filteredTasks.length > 0
                    ? "Deselect All"
                    : "Select All"}
                </span>
              </button>

              <button
                type="button"
                onClick={fetchPreview}
                title="Refresh feed"
                className="rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 p-1.5 text-white/70 hover:text-white transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs text-white/60">
                Fetching upcoming assignments from Canvas LMS...
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-red-300">
                  Failed to fetch Canvas feed
                </p>
                <p className="text-[11px] text-white/50 max-w-sm">{error}</p>
              </div>
              <button
                type="button"
                onClick={fetchPreview}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs font-medium text-white transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-white/40">
                <GraduationCap className="w-6 h-6" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">
                  {searchQuery
                    ? "No matching assignments"
                    : "No upcoming Canvas assignments"}
                </p>
                <p className="text-xs text-white/50 max-w-md">
                  {searchQuery
                    ? `No assignments match "${searchQuery}". Clear filter to view all.`
                    : "No active class assignments due today, tomorrow, or the day after were found in your feed."}
                </p>
              </div>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-xs text-primary hover:underline"
                >
                  Clear filter
                </button>
              )}
            </div>
          ) : (
            filteredTasks.map((task) => {
              const isSelected = selectedIds.has(task.id);
              const onBoard = isAlreadyOnBoard(task);

              return (
                <div
                  key={task.id}
                  onClick={() => toggleSelect(task.id)}
                  className={`group relative flex items-start gap-3 rounded-2xl border p-3 sm:p-3.5 cursor-pointer transition-all select-none ${
                    isSelected
                      ? "border-primary/50 bg-primary/[0.08] shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)]"
                      : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]"
                  }`}
                >
                  {/* Custom Styled Checkbox */}
                  <div className="pt-0.5 shrink-0">
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-lg border transition-all ${
                        isSelected
                          ? "border-primary bg-primary text-black"
                          : "border-white/30 bg-black/40 group-hover:border-white/50"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>

                  {/* Task Content */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Course Code Tag */}
                      {task.canvas_course_code && (
                        <span className="inline-flex items-center rounded-md border border-cyan-400/40 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                          {task.canvas_course_code}
                        </span>
                      )}

                      {/* Section destination pill */}
                      {task.section_group && (
                        <span className="inline-flex items-center rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/70">
                          → {task.section_group}
                        </span>
                      )}

                      {/* Priority Tag */}
                      <span
                        className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${getPriorityBadge(
                          task.priority
                        )}`}
                      >
                        {task.priority}
                      </span>

                      {/* Already on board indicator */}
                      {onBoard && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                          <Check className="w-2.5 h-2.5" />
                          <span>Already on board</span>
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h4 className="text-xs sm:text-sm font-semibold text-white leading-snug break-words">
                      {task.title}
                    </h4>

                    {/* Meta info: Due date & duration */}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/50 pt-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-white/40" />
                        <span>{formatDueDate(task.due_date)}</span>
                      </span>

                      {task.estimated_minutes ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-white/40" />
                          <span>{task.estimated_minutes}m</span>
                        </span>
                      ) : null}

                      {onBoard && (
                        <span className="text-[10px] text-white/40 italic">
                          {isSelected ? "Will update existing" : "Skipped"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sticky Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-t border-white/10 bg-[#07090e]/95 backdrop-blur-md">
          <div className="text-xs text-white/60 text-center sm:text-left">
            {!loading && !error && (
              <span>
                <strong className="text-white font-semibold">
                  {selectedIds.size}
                </strong>{" "}
                of {filteredTasks.length} assignments selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isCommitting}
              className="flex-1 sm:flex-none rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={selectedIds.size === 0 || isCommitting || loading}
              onClick={handleConfirm}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-black hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-neon"
            >
              {isCommitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <Layers className="w-3.5 h-3.5" />
                  <span>
                    Add Selected ({selectedIds.size})
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
