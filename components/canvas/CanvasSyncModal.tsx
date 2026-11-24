"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { TaskItem } from "@/types/taskit";
import {
  Badge,
  Button,
  Caption,
  Card,
  Dialog,
  Input,
} from "@/components/tailus-ui";
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

  const getPriorityBadgeIntent = (
    priority: string
  ): "danger" | "warning" | "gray" => {
    const p = priority.toLowerCase();
    if (p === "urgent") return "danger";
    if (p === "high" || p === "medium") return "warning";
    return "gray";
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="z-[60] bg-black/80 backdrop-blur-md" />
        <Dialog.Content
          fancy
          className="z-[60] w-[calc(100vw-1rem)] max-w-2xl p-0 shadow-[0_25px_80px_rgba(0,0,0,0.85)] flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden backdrop-blur-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-[--ui-border-color] bg-[--ui-soft-bg]">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-[--card-radius] bg-primary-500/20 text-primary-400 border border-primary-500/40 shadow-neon">
                <GraduationCap className="w-5 h-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <Dialog.Title size="base" weight="bold" className="tracking-wide">
                    Sync Canvas Assignments
                  </Dialog.Title>
                  <Badge
                    variant="soft"
                    intent={usedDemoFeed ? "warning" : "success"}
                    size="xs"
                    className="font-semibold"
                  >
                    {usedDemoFeed ? "Sample Feed" : "Live Feed"}
                  </Badge>
                </div>
                <Dialog.Description size="sm" className="mt-0.5 text-caption">
                  Select which upcoming assignments you want to add to your
                  workspace.
                </Dialog.Description>
              </div>
            </div>

            <Dialog.CloseButton
              type="button"
              onClick={onClose}
              className="static"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </Dialog.CloseButton>
          </div>

          {/* Toolbar: Search & Select All */}
          {!loading && !error && fetchedTasks.length > 0 && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 px-4 sm:px-6 py-3 border-b border-[--ui-border-color] bg-[--ui-bg]">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-placeholder pointer-events-none z-10" />
                <Input
                  type="text"
                  variant="soft"
                  size="sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by course or title..."
                  className="pl-8 pr-7"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-placeholder hover:text-title"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Select All Toggle */}
              <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                <Button.Root
                  type="button"
                  variant="soft"
                  intent="gray"
                  size="xs"
                  onClick={handleSelectAll}
                >
                  <Button.Icon type="leading">
                    <CheckCheck className="w-3.5 h-3.5 text-primary-400" />
                  </Button.Icon>
                  <Button.Label>
                    {selectedIds.size === filteredTasks.length &&
                    filteredTasks.length > 0
                      ? "Deselect All"
                      : "Select All"}
                  </Button.Label>
                </Button.Root>

                <Button.Root
                  type="button"
                  variant="soft"
                  intent="gray"
                  size="xs"
                  onClick={fetchPreview}
                  title="Refresh feed"
                >
                  <Button.Icon type="only">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button.Icon>
                </Button.Root>
              </div>
            </div>
          )}

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
                <Caption>
                  Fetching upcoming assignments from Canvas LMS...
                </Caption>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center space-y-3">
                <AlertCircle className="w-8 h-8 text-danger-400" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-danger-300">
                    Failed to fetch Canvas feed
                  </p>
                  <Caption className="max-w-sm block">{error}</Caption>
                </div>
                <Button.Root
                  type="button"
                  variant="soft"
                  intent="gray"
                  size="xs"
                  onClick={fetchPreview}
                >
                  <Button.Icon type="leading">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button.Icon>
                  <Button.Label>Retry</Button.Label>
                </Button.Root>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center space-y-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[--ui-soft-bg] border border-[--ui-border-color] text-placeholder">
                  <GraduationCap className="w-6 h-6" />
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-title">
                    {searchQuery
                      ? "No matching assignments"
                      : "No upcoming Canvas assignments"}
                  </p>
                  <Caption className="max-w-md block">
                    {searchQuery
                      ? `No assignments match "${searchQuery}". Clear filter to view all.`
                      : "No active class assignments due today, tomorrow, or the day after were found in your feed."}
                  </Caption>
                </div>
                {searchQuery && (
                  <Button.Root
                    type="button"
                    variant="ghost"
                    intent="primary"
                    size="xs"
                    onClick={() => setSearchQuery("")}
                  >
                    <Button.Label>Clear filter</Button.Label>
                  </Button.Root>
                )}
              </div>
            ) : (
              filteredTasks.map((task) => {
                const isSelected = selectedIds.has(task.id);
                const onBoard = isAlreadyOnBoard(task);

                return (
                  <Card
                    key={task.id}
                    variant={isSelected ? "outlined" : "soft"}
                    onClick={() => toggleSelect(task.id)}
                    className={`group relative flex items-start gap-3 p-3 sm:p-3.5 cursor-pointer transition-all select-none ${
                      isSelected
                        ? "border-primary-500/50 bg-primary-500/10 shadow-[0_0_15px_rgba(var(--colors-primary-500),0.12)]"
                        : "hover:border-primary-500/30"
                    }`}
                  >
                    {/* Custom Styled Checkbox */}
                    <div className="pt-0.5 shrink-0">
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-lg border transition-all ${
                          isSelected
                            ? "border-primary-500 bg-primary-500 text-white"
                            : "border-[--ui-border-color] bg-[--ui-bg] group-hover:border-primary-500/50"
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
                          <Badge
                            variant="soft"
                            intent="info"
                            size="xs"
                            className="font-bold uppercase tracking-wider"
                          >
                            {task.canvas_course_code}
                          </Badge>
                        )}

                        {/* Section destination pill */}
                        {task.section_group && (
                          <Badge variant="outlined" intent="gray" size="xs">
                            → {task.section_group}
                          </Badge>
                        )}

                        {/* Priority Tag */}
                        <Badge
                          variant="soft"
                          intent={getPriorityBadgeIntent(task.priority)}
                          size="xs"
                          className="font-semibold"
                        >
                          {task.priority}
                        </Badge>

                        {/* Already on board indicator */}
                        {onBoard && (
                          <Badge
                            variant="soft"
                            intent="success"
                            size="xs"
                            className="gap-1 font-semibold"
                          >
                            <Check className="w-2.5 h-2.5" />
                            <span>Already on board</span>
                          </Badge>
                        )}
                      </div>

                      {/* Title */}
                      <h4 className="text-xs sm:text-sm font-semibold text-title leading-snug break-words">
                        {task.title}
                      </h4>

                      {/* Meta info: Due date & duration */}
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-caption pt-0.5">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-placeholder" />
                          <span>{formatDueDate(task.due_date)}</span>
                        </span>

                        {task.estimated_minutes ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-placeholder" />
                            <span>{task.estimated_minutes}m</span>
                          </span>
                        ) : null}

                        {onBoard && (
                          <span className="text-[10px] text-placeholder italic">
                            {isSelected ? "Will update existing" : "Skipped"}
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>

          {/* Sticky Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-t border-[--ui-border-color] bg-[--ui-bg]/95 backdrop-blur-md">
            <div className="text-xs text-caption text-center sm:text-left">
              {!loading && !error && (
                <span>
                  <strong className="text-title font-semibold">
                    {selectedIds.size}
                  </strong>{" "}
                  of {filteredTasks.length} assignments selected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button.Root
                type="button"
                variant="soft"
                intent="gray"
                size="sm"
                onClick={onClose}
                disabled={isCommitting}
                className="flex-1 sm:flex-none"
              >
                <Button.Label>Cancel</Button.Label>
              </Button.Root>

              <Button.Root
                type="button"
                variant="solid"
                intent="primary"
                size="sm"
                disabled={selectedIds.size === 0 || isCommitting || loading}
                onClick={handleConfirm}
                className="flex-1 sm:flex-none shadow-neon"
              >
                {isCommitting ? (
                  <>
                    <Button.Icon type="leading">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    </Button.Icon>
                    <Button.Label>Adding...</Button.Label>
                  </>
                ) : (
                  <>
                    <Button.Icon type="leading">
                      <Layers className="w-3.5 h-3.5" />
                    </Button.Icon>
                    <Button.Label>
                      Add Selected ({selectedIds.size})
                    </Button.Label>
                  </>
                )}
              </Button.Root>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
