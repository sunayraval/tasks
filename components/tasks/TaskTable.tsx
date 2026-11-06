"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  TaskItem,
  TaskStatus,
  ViewMode,
  WorkspaceConfig,
  ColumnHeadersConfig,
  CustomOptionItem,
  BadgeColorKey,
  BADGE_COLOR_KEYS,
  BADGE_COLOR_MAP,
  getBadgeClasses,
} from "@/types/taskit";
import {
  ArrowUpDown,
  CheckCircle2,
  Circle,
  FileText,
  GripVertical,
  Plus,
  Search,
  ChevronDown,
  Filter,
  AlertCircle,
  Trash2,
  Pencil,
  Check,
  Tag,
  Settings2,
  Heading,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { TaskDocumentEditor } from "@/components/editor/TaskDocumentEditor";

interface TaskTableProps {
  tasks: TaskItem[];
  selectedTaskId: string | null;
  viewMode: ViewMode;
  workspaceConfig: WorkspaceConfig;
  onSelectTask: (taskId: string | null) => void;
  onUpdateTask: (taskId: string, updates: Partial<TaskItem>) => void;
  onDeleteTask: (taskId: string) => void;
  onReorderTasks: (newTasks: TaskItem[]) => void;
  onInlineCreateTask: (afterRowId?: string) => string;
  onInlineCreateHeader: (afterRowId?: string, defaultTitle?: string) => string;
  onUpdateWorkspaceConfig: (updates: Partial<WorkspaceConfig>) => void;
  onOpenSettingsTab: (
    tab: "appearance" | "customize" | "view" | "ai" | "integrations"
  ) => void;
}

export function isTaskHeaderRow(task: TaskItem): boolean {
  return Boolean(task.custom_properties?.is_header);
}

export function isTaskCompleted(t: TaskItem): boolean {
  if (isTaskHeaderRow(t)) return false;
  const s = (t.status || "").toLowerCase().trim();
  return s === "done" || s === "completed" || Boolean(t.completed_at);
}

export function isTaskInProgress(t: TaskItem): boolean {
  if (isTaskHeaderRow(t)) return false;
  const s = (t.status || "").toLowerCase().trim();
  return (
    s === "in progress" ||
    s === "in_progress" ||
    s === "doing" ||
    s === "working"
  );
}

export function isTaskToDo(t: TaskItem): boolean {
  if (isTaskHeaderRow(t)) return false;
  const s = (t.status || "").toLowerCase().trim();
  return s === "to do" || s === "todo" || s === "backlog";
}

export function formatRelativeDueDate(
  dueDateISO: string | null,
  status: TaskStatus
): {
  label: string;
  isOverdue: boolean;
  isToday: boolean;
} {
  if (!dueDateISO) {
    return { label: "Set Date", isOverdue: false, isToday: false };
  }
  const due = new Date(dueDateISO);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  const diffDays = Math.round(
    (startOfDue.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) {
    return { label: "Today", isOverdue: false, isToday: true };
  }
  if (diffDays === 1) {
    return { label: "Tomorrow", isOverdue: false, isToday: false };
  }
  if (diffDays === -1) {
    return {
      label: status === "Done" ? "Yesterday" : "Overdue (1d)",
      isOverdue: status !== "Done",
      isToday: false,
    };
  }
  if (diffDays < -1) {
    return {
      label: status === "Done" ? `${Math.abs(diffDays)}d ago` : "Overdue",
      isOverdue: status !== "Done",
      isToday: false,
    };
  }
  if (diffDays <= 7) {
    return { label: `In ${diffDays}d`, isOverdue: false, isToday: false };
  }
  return {
    label: due.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    isOverdue: false,
    isToday: false,
  };
}

export function formatEstimatedTime(minutes: number): string {
  if (!minutes || minutes <= 0) return "30m";
  if (minutes < 60) return `${minutes}m`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

// Inline Editable Text Input (works like a document line)
const InlineTextCell: React.FC<{
  value: string;
  placeholder: string;
  isDone?: boolean;
  autoFocus?: boolean;
  onCommit: (val: string) => void;
  onEnterKey?: () => void;
  className?: string;
}> = ({
  value,
  placeholder,
  isDone,
  autoFocus,
  onCommit,
  onEnterKey,
  className = "",
}) => {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed !== value) {
      onCommit(trimmed);
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
          onEnterKey?.();
        }
        if (e.key === "Escape") {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
      className={`w-full rounded-md bg-transparent px-1.5 py-1 text-xs sm:text-sm focus:bg-black/60 focus:outline-none focus:ring-1 focus:ring-primary/70 transition-all ${
        isDone ? "line-through text-white/40" : "text-white"
      } placeholder-white/30 ${className}`}
    />
  );
};

// Custom Dark-Glass Popover Pill Dropdown (replaces native white <select>)
const PillPopoverDropdown: React.FC<{
  value: string;
  options: CustomOptionItem[];
  onSelect: (val: string) => void;
  onAddNewOption: (label: string, color: BadgeColorKey) => void;
  onOpenManage: () => void;
  placeholder?: string;
}> = ({
  value,
  options,
  onSelect,
  onAddNewOption,
  onOpenManage,
  placeholder = "Add option...",
}) => {
  const [open, setOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState<BadgeColorKey>("cyan");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const activeOpt = options.find(
    (o) =>
      o.label.toLowerCase() === (value || "").toLowerCase() ||
      o.id.toLowerCase() === (value || "").toLowerCase()
  );
  const badgeClasses = getBadgeClasses(activeOpt?.color || "slate");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newLabel.trim();
    if (!cleaned) return;
    onAddNewOption(cleaned, newColor);
    onSelect(cleaned);
    setNewLabel("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-all hover:brightness-110 ${badgeClasses}`}
      >
        <span>{value || options[0]?.label || "Select"}</span>
        <ChevronDown className="w-3 h-3 opacity-70" />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 w-56 rounded-xl border theme-popover p-2 z-50 space-y-2 backdrop-blur-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="max-h-44 overflow-y-auto space-y-1 pr-0.5">
            {options.map((opt) => {
              const isSelected =
                opt.label.toLowerCase() === (value || "").toLowerCase();
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onSelect(opt.label);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                    isSelected
                      ? "bg-white/15 text-white font-semibold"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span
                    className={`rounded border px-2 py-0.5 text-[11px] font-medium ${getBadgeClasses(
                      opt.color
                    )}`}
                  >
                    {opt.label}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                </button>
              );
            })}
          </div>

          {/* Quick Add New Option Inline */}
          <form
            onSubmit={handleCreate}
            className="border-t border-white/10 pt-2 space-y-1.5"
          >
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder={placeholder}
                className="flex-1 rounded-lg border border-white/15 bg-black/75 px-2 py-1 text-[11px] text-white placeholder-white/40 focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-primary px-2 py-1 text-[11px] font-bold text-black hover:brightness-110"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1 pt-0.5">
              {BADGE_COLOR_KEYS.slice(0, 10).map((ck) => (
                <button
                  key={ck}
                  type="button"
                  onClick={() => setNewColor(ck)}
                  className={`h-3.5 w-3.5 rounded-full border ${
                    newColor === ck
                      ? "ring-2 ring-white scale-110"
                      : "opacity-60 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: BADGE_COLOR_MAP[ck].dot }}
                  title={BADGE_COLOR_MAP[ck].label}
                />
              ))}
            </div>
          </form>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenManage();
            }}
            className="w-full flex items-center justify-center gap-1 border-t border-white/10 pt-1.5 text-[11px] text-primary hover:underline"
          >
            <Settings2 className="w-3 h-3" />
            <span>Edit Options in Settings</span>
          </button>
        </div>
      )}
    </div>
  );
};

// Custom Dark-Glass Duration Popover (replaces native white <select>)
const DurationPopoverCell: React.FC<{
  minutes: number;
  onChange: (mins: number) => void;
}> = ({ minutes, onChange }) => {
  const [open, setOpen] = useState(false);
  const [customMins, setCustomMins] = useState(String(minutes || 30));
  const containerRef = useRef<HTMLDivElement | null>(null);
  const presets = [15, 30, 45, 60, 90, 120, 180];

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-black/40 px-2 py-1 text-xs font-mono text-white/90 hover:border-primary/60 transition-colors"
      >
        <span>{formatEstimatedTime(minutes || 30)}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 w-44 rounded-xl border theme-popover p-2 z-50 space-y-2 backdrop-blur-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="grid grid-cols-2 gap-1">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  onChange(p);
                  setOpen(false);
                }}
                className={`rounded-lg px-2 py-1 text-xs font-mono text-center transition-colors ${
                  minutes === p
                    ? "bg-primary text-black font-bold"
                    : "bg-white/5 text-white/80 hover:bg-white/15 hover:text-white"
                }`}
              >
                {formatEstimatedTime(p)}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const val = Math.max(5, parseInt(customMins, 10) || 30);
              onChange(val);
              setOpen(false);
            }}
            className="flex items-center gap-1 border-t border-white/10 pt-1.5"
          >
            <input
              type="number"
              min={5}
              max={600}
              value={customMins}
              onChange={(e) => setCustomMins(e.target.value)}
              placeholder="Mins"
              className="w-full rounded border border-white/15 bg-black/75 px-2 py-1 text-xs text-white font-mono focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              className="rounded bg-primary px-2 py-1 text-[11px] font-bold text-black"
            >
              Set
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

// Custom Dark-Glass Filter Popover for Top Bar
const FilterDropdown: React.FC<{
  label: string;
  value: string;
  options: CustomOptionItem[];
  onChange: (val: string) => void;
}> = ({ label, value, options, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border theme-input px-2.5 py-1.5 text-xs text-white/90 hover:border-primary/50 transition-colors"
      >
        <Filter className="w-3 h-3 text-primary" />
        <span>{value === "ALL" ? `All ${label}` : value}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 w-48 rounded-xl border theme-popover p-1.5 z-50 space-y-1 backdrop-blur-2xl">
          <button
            type="button"
            onClick={() => {
              onChange("ALL");
              setOpen(false);
            }}
            className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
              value === "ALL"
                ? "bg-primary/20 text-highlight font-semibold"
                : "text-white/75 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span>All {label}</span>
            {value === "ALL" && <Check className="w-3.5 h-3.5 text-primary" />}
          </button>
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onChange(opt.label);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                value === opt.label
                  ? "bg-white/15 text-white font-semibold"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span
                className={`rounded border px-1.5 py-0.5 text-[10px] ${getBadgeClasses(
                  opt.color
                )}`}
              >
                {opt.label}
              </span>
              {value === opt.label && (
                <Check className="w-3.5 h-3.5 text-primary" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Sortable Wrapper for BOTH Header Divider Rows AND Task Rows
const SortableDocumentRow: React.FC<{
  item: TaskItem;
  isHeader: boolean;
  isSelected: boolean;
  children: (dragProps: {
    attributes: Record<string, any>;
    listeners: Record<string, any> | undefined;
  }) => React.ReactNode;
}> = ({ item, isHeader, isSelected, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 30 : undefined,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={
        isHeader
          ? "group border-y theme-section-bg transition-colors"
          : `group border-b border-white/10 transition-colors ${
              isSelected
                ? "bg-primary/15"
                : item.status === "Done"
                ? "bg-black/25 opacity-60 hover:opacity-95"
                : "theme-row-hover"
            }`
      }
    >
      {children({ attributes, listeners })}
    </tr>
  );
};

export const TaskTable: React.FC<TaskTableProps> = ({
  tasks,
  selectedTaskId,
  viewMode,
  workspaceConfig,
  onSelectTask,
  onUpdateTask,
  onDeleteTask,
  onReorderTasks,
  onInlineCreateTask,
  onInlineCreateHeader,
  onUpdateWorkspaceConfig,
  onOpenSettingsTab,
}) => {
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [newlyCreatedRowId, setNewlyCreatedRowId] = useState<string | null>(
    null
  );

  // Column header inline editing
  const [editingColKey, setEditingColKey] = useState<
    keyof ColumnHeadersConfig | null
  >(null);
  const [colHeaderDraft, setColHeaderDraft] = useState("");

  // Tags popover state
  const [openTagDropdownTaskId, setOpenTagDropdownTaskId] = useState<
    string | null
  >(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState<BadgeColorKey>("cyan");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Calculate task counts for segmented status filter bar
  const counts = useMemo(() => {
    let totalActive = 0;
    let totalTodo = 0;
    let totalInProgress = 0;
    let totalCompleted = 0;

    for (const t of tasks) {
      if (isTaskHeaderRow(t)) continue;
      if (isTaskCompleted(t)) {
        totalCompleted++;
      } else {
        totalActive++;
        if (isTaskInProgress(t)) {
          totalInProgress++;
        } else if (isTaskToDo(t)) {
          totalTodo++;
        }
      }
    }

    return {
      all: tasks.filter((t) => !isTaskHeaderRow(t)).length,
      active: totalActive,
      todo: totalTodo,
      inProgress: totalInProgress,
      completed: totalCompleted,
    };
  }, [tasks]);

  // Filter rows: Header rows stay visible unless searching/filtering hides them
  const visibleRows = useMemo(() => {
    let list = [...tasks];

    // Automatically filter out stale/past assignments (e.g. 10/31/2026 and earlier)
    const now = new Date();
    const startOfTodayTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();

    list = list.filter((t) => {
      if (isTaskHeaderRow(t)) return true;
      // Never drop completed tasks here so user can view them in the Completed list
      if (isTaskCompleted(t)) return true;
      if (t.due_date) {
        const dueTime = new Date(t.due_date).getTime();
        if (!isNaN(dueTime) && dueTime < startOfTodayTime) {
          return false;
        }
      }
      return true;
    });

    list = list.filter((t) => {
      if (isTaskHeaderRow(t)) return true;

      // Status filtering logic
      if (statusFilter === "ALL") {
        if (!workspaceConfig.showCompletedTasks && isTaskCompleted(t)) {
          return false;
        }
      } else if (statusFilter === "TODO") {
        if (!isTaskToDo(t)) return false;
      } else if (statusFilter === "IN_PROGRESS") {
        if (!isTaskInProgress(t)) return false;
      } else if (statusFilter === "COMPLETED") {
        if (!isTaskCompleted(t)) return false;
      } else {
        if (t.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      }

      // Category / Type filter
      if (typeFilter !== "ALL" && t.type !== typeFilter) return false;

      // Global text search
      if (globalFilter.trim()) {
        const q = globalFilter.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchNotes = (t.notes || "").toLowerCase().includes(q);
        const matchTags = t.tags.some((tag) =>
          tag.toLowerCase().includes(q)
        );
        return matchTitle || matchNotes || matchTags;
      }

      return true;
    });

    // When filtering by status, category, or search, prune empty headers
    if (
      statusFilter !== "ALL" ||
      typeFilter !== "ALL" ||
      globalFilter.trim() !== ""
    ) {
      const pruned: TaskItem[] = [];
      let pendingHeader: TaskItem | null = null;

      for (const item of list) {
        if (isTaskHeaderRow(item)) {
          if (
            globalFilter.trim() &&
            item.title.toLowerCase().includes(globalFilter.trim().toLowerCase())
          ) {
            pruned.push(item);
            pendingHeader = null;
          } else {
            pendingHeader = item;
          }
        } else {
          if (pendingHeader) {
            pruned.push(pendingHeader);
            pendingHeader = null;
          }
          pruned.push(item);
        }
      }
      list = pruned;
    }

    if (sortField) {
      list.sort((a, b) => {
        if (isTaskHeaderRow(a) || isTaskHeaderRow(b)) return 0;
        const valA = String((a as any)[sortField] || "");
        const valB = String((b as any)[sortField] || "");
        return sortAsc
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      });
    }

    return list;
  }, [
    tasks,
    statusFilter,
    typeFilter,
    globalFilter,
    sortField,
    sortAsc,
    workspaceConfig.showCompletedTasks,
  ]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const moved = arrayMove(tasks, oldIndex, newIndex).map((item, idx) => ({
        ...item,
        order_index: idx,
      }));
      onReorderTasks(moved);
    }
  };

  const moveRowStep = (rowId: string, dir: -1 | 1) => {
    const idx = tasks.findIndex((t) => t.id === rowId);
    const targetIdx = idx + dir;
    if (idx === -1 || targetIdx < 0 || targetIdx >= tasks.length) return;
    const moved = arrayMove(tasks, idx, targetIdx).map((item, i) => ({
      ...item,
      order_index: i,
    }));
    onReorderTasks(moved);
  };

  const handleCreateTaskClick = (afterRowId?: string) => {
    const newId = onInlineCreateTask(afterRowId);
    setNewlyCreatedRowId(newId);
  };

  const handleCreateHeaderClick = (afterRowId?: string) => {
    const newId = onInlineCreateHeader(afterRowId);
    setNewlyCreatedRowId(newId);
  };

  const commitColumnHeader = (colKey: keyof ColumnHeadersConfig) => {
    setEditingColKey(null);
    const cleaned =
      colHeaderDraft.trim() || workspaceConfig.columnHeaders[colKey];
    if (cleaned !== workspaceConfig.columnHeaders[colKey]) {
      onUpdateWorkspaceConfig({
        columnHeaders: {
          ...workspaceConfig.columnHeaders,
          [colKey]: cleaned,
        },
      });
    }
  };

  const getOptionColor = (
    list: CustomOptionItem[],
    value: string,
    fallback: BadgeColorKey = "slate"
  ): BadgeColorKey => {
    const found = list.find(
      (item) =>
        item.id.toLowerCase() === value.toLowerCase() ||
        item.label.toLowerCase() === value.toLowerCase()
    );
    return found ? found.color : fallback;
  };

  const selectedTaskObj = useMemo(
    () =>
      tasks.find((t) => t.id === selectedTaskId && !isTaskHeaderRow(t)) || null,
    [tasks, selectedTaskId]
  );

  const columnDefs: Array<{
    key: keyof ColumnHeadersConfig;
    sortable?: boolean;
  }> = [
    { key: "title", sortable: true },
    { key: "status", sortable: true },
    { key: "type", sortable: true },
    { key: "priority", sortable: true },
    { key: "due_date", sortable: true },
    { key: "estimated_minutes", sortable: false },
    { key: "tags", sortable: false },
    { key: "notes", sortable: false },
  ];

  return (
    <div className="space-y-4">
      {/* Top Filter & Quick Actions Bar */}
      <div className="flex flex-col gap-3 rounded-xl border theme-panel p-3.5 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="w-4 h-4 text-white/45 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder="Search tasks, #tags, notes..."
                className="w-full rounded-lg border theme-input pl-9 pr-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none"
              />
            </div>

            {/* Quick Status Segmented Filter Bar: All/Active | To Do | In Progress | Completed */}
            <div className="flex items-center gap-1 p-0.5 rounded-lg border border-white/10 bg-black/40 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all ${
                  statusFilter === "ALL"
                    ? "bg-primary text-black font-bold shadow-sm"
                    : "text-white/65 hover:text-white hover:bg-white/5"
                }`}
              >
                <span>
                  {workspaceConfig.showCompletedTasks ? "All" : "Active"}
                </span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    statusFilter === "ALL"
                      ? "bg-black/20 text-black font-bold"
                      : "bg-white/10 text-white/50"
                  }`}
                >
                  {workspaceConfig.showCompletedTasks
                    ? counts.all
                    : counts.active}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("TODO")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all ${
                  statusFilter === "TODO"
                    ? "bg-slate-200 text-slate-900 font-bold shadow-sm"
                    : "text-white/65 hover:text-white hover:bg-white/5"
                }`}
              >
                <span>To Do</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    statusFilter === "TODO"
                      ? "bg-slate-900/20 text-slate-900 font-bold"
                      : "bg-white/10 text-white/50"
                  }`}
                >
                  {counts.todo}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("IN_PROGRESS")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all ${
                  statusFilter === "IN_PROGRESS"
                    ? "bg-sky-400 text-sky-950 font-bold shadow-sm"
                    : "text-white/65 hover:text-white hover:bg-white/5"
                }`}
              >
                <span>In Progress</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    statusFilter === "IN_PROGRESS"
                      ? "bg-sky-950/20 text-sky-950 font-bold"
                      : "bg-white/10 text-white/50"
                  }`}
                >
                  {counts.inProgress}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter("COMPLETED")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all ${
                  statusFilter === "COMPLETED"
                    ? "bg-emerald-400 text-emerald-950 font-bold shadow-sm"
                    : "text-white/65 hover:text-white hover:bg-white/5"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Completed</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    statusFilter === "COMPLETED"
                      ? "bg-emerald-950/20 text-emerald-950 font-bold"
                      : "bg-emerald-400/15 text-emerald-300"
                  }`}
                >
                  {counts.completed}
                </span>
              </button>
            </div>

            {/* Show Completed Tasks Setting Toggle Button */}
            <button
              type="button"
              onClick={() =>
                onUpdateWorkspaceConfig({
                  showCompletedTasks: !workspaceConfig.showCompletedTasks,
                })
              }
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                workspaceConfig.showCompletedTasks
                  ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
                  : "border-white/10 bg-white/5 text-white/55 hover:text-white hover:bg-white/10"
              }`}
              title={
                workspaceConfig.showCompletedTasks
                  ? "Show completed tasks: ON (completed tasks stay visible in the table). Click to hide."
                  : "Show completed tasks: OFF (checked off tasks disappear into Completed). Click to show."
              }
            >
              <CheckCircle2
                className={`w-3.5 h-3.5 ${
                  workspaceConfig.showCompletedTasks
                    ? "text-emerald-400"
                    : "text-white/40"
                }`}
              />
              <span className="hidden sm:inline">Show completed</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  workspaceConfig.showCompletedTasks
                    ? "bg-emerald-400/20 text-emerald-200"
                    : "bg-white/10 text-white/45"
                }`}
              >
                {counts.completed}
              </span>
            </button>

            {/* Custom Dark-Glass Category Filter */}
            <FilterDropdown
              label={workspaceConfig.columnHeaders.type}
              value={typeFilter}
              options={workspaceConfig.types}
              onChange={setTypeFilter}
            />

            <button
              type="button"
              onClick={() => onOpenSettingsTab("customize")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-highlight hover:border-primary/50 hover:bg-primary/10 transition-colors"
              title="Edit tags, statuses, categories & colors in Settings"
            >
              <Settings2 className="w-3.5 h-3.5 text-primary" />
              <span>Customize</span>
            </button>
          </div>

        {/* Right: Quick Add Task or Header Buttons */}
        <div className="flex items-center gap-2 self-end md:self-center">
          <button
            type="button"
            onClick={() => handleCreateHeaderClick()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-semibold text-highlight hover:bg-primary/25 transition-all"
            title="Insert a movable header divider row"
          >
            <Heading className="w-3.5 h-3.5 text-primary" />
            <span>+ New Header</span>
          </button>

          <button
            type="button"
            onClick={() => handleCreateTaskClick()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-bold text-black shadow-neon hover:brightness-110 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ New Task</span>
          </button>
        </div>
      </div>
    </div>

      {/* Main Document-Style Table */}
      <div className="rounded-xl border theme-panel overflow-visible backdrop-blur-xl">
        <div className="overflow-x-auto overflow-y-visible">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={visibleRows.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <table className="w-full text-left border-collapse">
                {/* Editable Column Headers */}
                <thead>
                  <tr className="border-b theme-header-bg text-[11px] font-semibold uppercase tracking-wider text-highlight/90">
                    <th className="w-10 pl-3 pr-1 py-3" />
                    {columnDefs.map(({ key: colKey, sortable }) => {
                      const isEditingThisCol = editingColKey === colKey;
                      return (
                        <th key={colKey} className="px-3 py-3 select-none">
                          <div className="inline-flex items-center gap-1.5 group/col">
                            {isEditingThisCol ? (
                              <input
                                type="text"
                                autoFocus
                                value={colHeaderDraft}
                                onChange={(e) =>
                                  setColHeaderDraft(e.target.value)
                                }
                                onBlur={() => commitColumnHeader(colKey)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    commitColumnHeader(colKey);
                                  if (e.key === "Escape")
                                    setEditingColKey(null);
                                }}
                                className="w-28 rounded border border-primary bg-black/85 px-1.5 py-0.5 text-[11px] font-bold text-white focus:outline-none"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setColHeaderDraft(
                                    workspaceConfig.columnHeaders[colKey]
                                  );
                                  setEditingColKey(colKey);
                                }}
                                className="inline-flex items-center gap-1 hover:text-white transition-colors"
                                title="Click to rename column header"
                              >
                                <span>
                                  {workspaceConfig.columnHeaders[colKey]}
                                </span>
                                <Pencil className="w-2.5 h-2.5 opacity-0 group-hover/col:opacity-80 text-primary transition-opacity" />
                              </button>
                            )}

                            {sortable && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (sortField === colKey) {
                                    if (!sortAsc) {
                                      setSortField(null);
                                    } else {
                                      setSortAsc(false);
                                    }
                                  } else {
                                    setSortField(colKey);
                                    setSortAsc(true);
                                  }
                                }}
                                className={`p-0.5 rounded hover:bg-white/10 transition-colors ${
                                  sortField === colKey
                                    ? "text-primary"
                                    : "text-white/35 hover:text-white"
                                }`}
                                title="Sort by column"
                              >
                                <ArrowUpDown className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </th>
                      );
                    })}
                    <th className="w-24 px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>

                {/* Unified Document Body: Both Movable Headers & Task Rows */}
                <tbody>
                  {visibleRows.map((rowItem, rowIndex) => {
                    const isHeader = isTaskHeaderRow(rowItem);

                    if (isHeader) {
                      return (
                        <SortableDocumentRow
                          key={rowItem.id}
                          item={rowItem}
                          isHeader={true}
                          isSelected={false}
                        >
                          {({ attributes, listeners }) => (
                            <>
                              {/* Drag Handle for Header Row */}
                              <td className="w-10 pl-3 pr-1 py-2.5 align-middle">
                                <button
                                  type="button"
                                  {...attributes}
                                  {...listeners}
                                  className="cursor-grab active:cursor-grabbing text-primary/70 hover:text-white p-1 rounded"
                                  title="Drag header up or down anywhere in the table"
                                >
                                  <GripVertical className="w-4 h-4" />
                                </button>
                              </td>

                              {/* Inline Editable Header Title spanning across the table */}
                              <td colSpan={8} className="px-3 py-2 align-middle">
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 max-w-xl">
                                    <InlineTextCell
                                      value={rowItem.title}
                                      placeholder="Type header title (e.g. ——— 📅 TODAY 📅 ———)..."
                                      autoFocus={
                                        newlyCreatedRowId === rowItem.id
                                      }
                                      onCommit={(val) => {
                                        onUpdateTask(rowItem.id, {
                                          title:
                                            val || "——— NEW HEADER ———",
                                        });
                                        if (newlyCreatedRowId === rowItem.id) {
                                          setNewlyCreatedRowId(null);
                                        }
                                      }}
                                      className="font-bold tracking-wider text-highlight text-xs sm:text-sm"
                                    />
                                  </div>

                                  <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleCreateTaskClick(rowItem.id)
                                      }
                                      className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-highlight hover:bg-primary hover:text-black transition-all"
                                      title="Insert task directly below this header"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>Task Below</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleCreateHeaderClick(rowItem.id)
                                      }
                                      className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/75 hover:text-white hover:border-primary/50 transition-all"
                                      title="Insert another header below"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>Header</span>
                                    </button>
                                  </div>
                                </div>
                              </td>

                              {/* Move Up / Move Down / Delete Controls for Header Row */}
                              <td className="px-3 py-2 align-middle text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={rowIndex === 0}
                                    onClick={() =>
                                      moveRowStep(rowItem.id, -1)
                                    }
                                    className="p-1 rounded text-white/55 hover:text-white hover:bg-white/10 disabled:opacity-20"
                                    title="Move header up"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={
                                      rowIndex === visibleRows.length - 1
                                    }
                                    onClick={() =>
                                      moveRowStep(rowItem.id, 1)
                                    }
                                    className="p-1 rounded text-white/55 hover:text-white hover:bg-white/10 disabled:opacity-20"
                                    title="Move header down"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteTask(rowItem.id)}
                                    className="p-1 rounded text-white/45 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                                    title="Delete header row"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </SortableDocumentRow>
                      );
                    }

                    // Normal Task Row
                    const t = rowItem;
                    const isDone = isTaskCompleted(t);
                    const isTagMenuOpen = openTagDropdownTaskId === t.id;
                    const {
                      label: dueLabel,
                      isOverdue,
                      isToday,
                    } = formatRelativeDueDate(t.due_date, t.status);
                    const dateVal = t.due_date
                      ? new Date(t.due_date).toISOString().split("T")[0]
                      : "";

                    const toggleTagOnTask = (tagLabel: string) => {
                      const exists = t.tags.includes(tagLabel);
                      const nextTags = exists
                        ? t.tags.filter((tg) => tg !== tagLabel)
                        : [...t.tags, tagLabel];
                      onUpdateTask(t.id, { tags: nextTags });
                    };

                    const handleCreateNewTagInline = (e: React.FormEvent) => {
                      e.preventDefault();
                      const raw = newTagName.trim();
                      if (!raw) return;
                      const formatted = raw.startsWith("#") ? raw : `#${raw}`;
                      if (
                        !workspaceConfig.tags.some(
                          (tg) =>
                            tg.label.toLowerCase() === formatted.toLowerCase()
                        )
                      ) {
                        onUpdateWorkspaceConfig({
                          tags: [
                            ...workspaceConfig.tags,
                            {
                              id: formatted,
                              label: formatted,
                              color: newTagColor,
                            },
                          ],
                        });
                      }
                      if (!t.tags.includes(formatted)) {
                        onUpdateTask(t.id, { tags: [...t.tags, formatted] });
                      }
                      setNewTagName("");
                    };

                    return (
                      <React.Fragment key={t.id}>
                        <SortableDocumentRow
                          item={t}
                          isHeader={false}
                          isSelected={selectedTaskId === t.id}
                        >
                          {({ attributes, listeners }) => (
                            <>
                              {/* 0. Drag Handle */}
                              <td className="w-10 pl-3 pr-1 py-2 align-middle">
                                <button
                                  type="button"
                                  {...attributes}
                                  {...listeners}
                                  className="cursor-grab active:cursor-grabbing text-white/35 hover:text-white p-1 rounded"
                                  title="Drag row up or down"
                                >
                                  <GripVertical className="w-3.5 h-3.5" />
                                </button>
                              </td>

                              {/* 1. Task Title + Complete Toggle + Doc Drawer Button */}
                              <td className="px-3 py-2 align-middle">
                                <div className="flex items-center gap-2 min-w-[230px] max-w-[400px]">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const isCompleted = isTaskCompleted(t);
                                      const nextStatus: TaskStatus = isCompleted
                                        ? workspaceConfig.statuses[0]?.label ||
                                          "To Do"
                                        : "Done";
                                      onUpdateTask(t.id, {
                                        status: nextStatus,
                                        completed_at:
                                          nextStatus === "Done"
                                            ? new Date().toISOString()
                                            : null,
                                      });
                                    }}
                                    className="shrink-0 text-white/45 hover:text-primary transition-colors"
                                    title={
                                      isDone ? "Mark as To Do" : "Complete Task"
                                    }
                                  >
                                    {isDone ? (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                    ) : (
                                      <Circle className="w-4 h-4 hover:text-primary" />
                                    )}
                                  </button>

                                  <div className="flex-1 min-w-0">
                                    <InlineTextCell
                                      value={t.title}
                                      placeholder="Type task title..."
                                      isDone={isDone}
                                      autoFocus={newlyCreatedRowId === t.id}
                                      onCommit={(val) => {
                                        onUpdateTask(t.id, {
                                          title: val || "Untitled Task",
                                        });
                                        if (newlyCreatedRowId === t.id) {
                                          setNewlyCreatedRowId(null);
                                        }
                                      }}
                                      className="font-medium"
                                    />
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      onSelectTask(
                                        selectedTaskId === t.id ? null : t.id
                                      )
                                    }
                                    className="inline-flex items-center gap-1 rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/60 hover:border-primary/60 hover:text-highlight transition-all shrink-0"
                                    title="Open rich-text document"
                                  >
                                    <FileText className="w-3 h-3" />
                                    <span className="hidden sm:inline">
                                      Doc
                                    </span>
                                  </button>
                                </div>
                              </td>

                              {/* 2. Status Custom Dark Popover Dropdown */}
                              <td className="px-3 py-2 align-middle">
                                <PillPopoverDropdown
                                  value={t.status}
                                  options={workspaceConfig.statuses}
                                  placeholder="New status..."
                                  onSelect={(nextStatus) => {
                                    const isNowDone =
                                      nextStatus.toLowerCase() === "done" ||
                                      nextStatus.toLowerCase() === "completed";
                                    onUpdateTask(t.id, {
                                      status: nextStatus,
                                      completed_at: isNowDone
                                        ? new Date().toISOString()
                                        : null,
                                    });
                                  }}
                                  onAddNewOption={(label, color) =>
                                    onUpdateWorkspaceConfig({
                                      statuses: [
                                        ...workspaceConfig.statuses,
                                        { id: label, label, color },
                                      ],
                                    })
                                  }
                                  onOpenManage={() =>
                                    onOpenSettingsTab("customize")
                                  }
                                />
                              </td>

                              {/* 3. Category / Type Custom Dark Popover Dropdown */}
                              <td className="px-3 py-2 align-middle">
                                <PillPopoverDropdown
                                  value={t.type}
                                  options={workspaceConfig.types}
                                  placeholder="New category..."
                                  onSelect={(nextType) =>
                                    onUpdateTask(t.id, { type: nextType })
                                  }
                                  onAddNewOption={(label, color) =>
                                    onUpdateWorkspaceConfig({
                                      types: [
                                        ...workspaceConfig.types,
                                        { id: label, label, color },
                                      ],
                                    })
                                  }
                                  onOpenManage={() =>
                                    onOpenSettingsTab("customize")
                                  }
                                />
                              </td>

                              {/* 4. Priority Custom Dark Popover Dropdown */}
                              <td className="px-3 py-2 align-middle">
                                <PillPopoverDropdown
                                  value={t.priority}
                                  options={workspaceConfig.priorities}
                                  placeholder="New priority..."
                                  onSelect={(nextPriority) =>
                                    onUpdateTask(t.id, {
                                      priority: nextPriority,
                                    })
                                  }
                                  onAddNewOption={(label, color) =>
                                    onUpdateWorkspaceConfig({
                                      priorities: [
                                        ...workspaceConfig.priorities,
                                        { id: label, label, color },
                                      ],
                                    })
                                  }
                                  onOpenManage={() =>
                                    onOpenSettingsTab("customize")
                                  }
                                />
                              </td>

                              {/* 5. Due Date Inline Picker */}
                              <td className="px-3 py-2 align-middle">
                                <div className="inline-flex items-center gap-1.5">
                                  <input
                                    type="date"
                                    value={dateVal}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      onUpdateTask(t.id, {
                                        due_date: val
                                          ? new Date(
                                              `${val}T23:59:00`
                                            ).toISOString()
                                          : null,
                                      });
                                    }}
                                    className="cursor-pointer rounded-md border border-white/15 bg-black/45 px-2 py-1 text-xs text-white/90 hover:border-primary/50 focus:border-primary focus:outline-none"
                                    title={dueLabel}
                                  />
                                  {isOverdue && (
                                    <span title={dueLabel}>
                                      <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                    </span>
                                  )}
                                  {isToday && !isOverdue && (
                                    <span className="rounded bg-primary/20 border border-primary/40 px-1.5 py-0.5 text-[10px] font-semibold text-highlight">
                                      Today
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* 6. Est. Time Custom Dark Popover */}
                              <td className="px-3 py-2 align-middle">
                                <DurationPopoverCell
                                  minutes={t.estimated_minutes || 30}
                                  onChange={(mins) =>
                                    onUpdateTask(t.id, {
                                      estimated_minutes: mins,
                                    })
                                  }
                                />
                              </td>

                              {/* 7. Tags Custom Dark Multi-Select Popover */}
                              <td className="px-3 py-2 align-middle">
                                <div className="relative min-w-[140px]">
                                  <div
                                    onClick={() =>
                                      setOpenTagDropdownTaskId(
                                        isTagMenuOpen ? null : t.id
                                      )
                                    }
                                    className="cursor-pointer flex flex-wrap items-center gap-1 rounded-md border border-transparent hover:border-white/20 hover:bg-black/35 px-1.5 py-1 min-h-[28px] transition-colors"
                                    title="Click to select or add tags"
                                  >
                                    {t.is_canvas_assignment &&
                                      t.canvas_course_code && (
                                        <span className="rounded border border-orange-500/40 bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-orange-300">
                                          {t.canvas_course_code}
                                        </span>
                                      )}
                                    {t.tags.map((tag) => {
                                      const tagColor = getOptionColor(
                                        workspaceConfig.tags,
                                        tag,
                                        "cyan"
                                      );
                                      return (
                                        <span
                                          key={tag}
                                          className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${getBadgeClasses(
                                            tagColor
                                          )}`}
                                        >
                                          {tag}
                                        </span>
                                      );
                                    })}
                                    <span className="inline-flex items-center gap-0.5 rounded border border-dashed border-white/20 px-1.5 py-0.5 text-[10px] text-white/50 hover:text-white hover:border-primary/60">
                                      <Plus className="w-2.5 h-2.5" />
                                      {t.tags.length === 0 ? "Tags" : ""}
                                    </span>
                                  </div>

                                  {isTagMenuOpen && (
                                    <div
                                      className="absolute left-0 top-full mt-1.5 w-64 rounded-xl border theme-popover p-2.5 z-50 space-y-2.5 backdrop-blur-2xl"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                                        <span className="text-[11px] font-bold text-white flex items-center gap-1">
                                          <Tag className="w-3 h-3 text-primary" />
                                          Select or Create Tags
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setOpenTagDropdownTaskId(null)
                                          }
                                          className="text-[10px] text-white/60 hover:text-white"
                                        >
                                          Done
                                        </button>
                                      </div>

                                      <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                                        {workspaceConfig.tags.map((tagOpt) => {
                                          const active = t.tags.includes(
                                            tagOpt.label
                                          );
                                          return (
                                            <button
                                              key={tagOpt.id}
                                              type="button"
                                              onClick={() =>
                                                toggleTagOnTask(tagOpt.label)
                                              }
                                              className={`w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-xs transition-colors ${
                                                active
                                                  ? "bg-white/15 text-white font-semibold"
                                                  : "text-white/75 hover:bg-white/10 hover:text-white"
                                              }`}
                                            >
                                              <span
                                                className={`rounded border px-1.5 py-0.5 text-[10px] ${getBadgeClasses(
                                                  tagOpt.color
                                                )}`}
                                              >
                                                {tagOpt.label}
                                              </span>
                                              {active && (
                                                <Check className="w-3.5 h-3.5 text-primary" />
                                              )}
                                            </button>
                                          );
                                        })}
                                      </div>

                                      <form
                                        onSubmit={handleCreateNewTagInline}
                                        className="border-t border-white/10 pt-2 space-y-1.5"
                                      >
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="text"
                                            value={newTagName}
                                            onChange={(e) =>
                                              setNewTagName(e.target.value)
                                            }
                                            placeholder="New #tag name..."
                                            className="flex-1 rounded-lg border border-white/15 bg-black/75 px-2 py-1 text-[11px] text-white placeholder-white/40 focus:border-primary focus:outline-none"
                                          />
                                          <button
                                            type="submit"
                                            className="rounded-lg bg-primary px-2 py-1 text-[11px] font-bold text-black hover:brightness-110"
                                          >
                                            Add
                                          </button>
                                        </div>
                                        <div className="flex flex-wrap gap-1 pt-0.5">
                                          {BADGE_COLOR_KEYS.slice(0, 10).map(
                                            (ck) => (
                                              <button
                                                key={ck}
                                                type="button"
                                                onClick={() =>
                                                  setNewTagColor(ck)
                                                }
                                                className={`h-3.5 w-3.5 rounded-full border ${
                                                  newTagColor === ck
                                                    ? "ring-2 ring-white scale-110"
                                                    : "opacity-60 hover:opacity-100"
                                                }`}
                                                style={{
                                                  backgroundColor:
                                                    BADGE_COLOR_MAP[ck].dot,
                                                }}
                                                title={
                                                  BADGE_COLOR_MAP[ck].label
                                                }
                                              />
                                            )
                                          )}
                                        </div>
                                      </form>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenTagDropdownTaskId(null);
                                          onOpenSettingsTab("customize");
                                        }}
                                        className="w-full flex items-center justify-center gap-1 border-t border-white/10 pt-1.5 text-[11px] text-primary hover:underline"
                                      >
                                        <Settings2 className="w-3 h-3" />
                                        <span>Manage All Tags in Settings</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* 8. Notes Inline Text Cell */}
                              <td className="px-3 py-2 align-middle">
                                <div className="min-w-[140px] max-w-[220px]">
                                  <InlineTextCell
                                    value={t.notes || ""}
                                    placeholder="Add quick note..."
                                    onCommit={(val) =>
                                      onUpdateTask(t.id, { notes: val })
                                    }
                                    className="text-white/80"
                                  />
                                </div>
                              </td>

                              {/* 9. Row Actions: Move Up / Move Down / Insert Below / Delete */}
                              <td className="px-3 py-2 align-middle text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    disabled={rowIndex === 0}
                                    onClick={() => moveRowStep(t.id, -1)}
                                    className="p-1 rounded text-white/35 hover:text-white hover:bg-white/10 disabled:opacity-15"
                                    title="Move row up"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={
                                      rowIndex === visibleRows.length - 1
                                    }
                                    onClick={() => moveRowStep(t.id, 1)}
                                    className="p-1 rounded text-white/35 hover:text-white hover:bg-white/10 disabled:opacity-15"
                                    title="Move row down"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteTask(t.id);
                                    }}
                                    className="p-1 rounded text-white/40 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                                    title="Delete Task"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </SortableDocumentRow>

                        {/* Inline Rich-Text Editor if viewMode === inline */}
                        {viewMode === "inline" &&
                          selectedTaskId === t.id &&
                          selectedTaskObj && (
                            <tr>
                              <td colSpan={10} className="px-4 py-2">
                                <TaskDocumentEditor
                                  task={selectedTaskObj}
                                  viewMode="inline"
                                  workspaceConfig={workspaceConfig}
                                  onClose={() => onSelectTask(null)}
                                  onUpdateTask={onUpdateTask}
                                  onDeleteTask={onDeleteTask}
                                />
                              </td>
                            </tr>
                          )}
                      </React.Fragment>
                    );
                  })}

                  {/* Empty Filter State */}
                  {visibleRows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-2 text-white/50">
                          <CheckCircle2 className="w-8 h-8 text-white/20" />
                          <p className="text-xs font-medium">
                            {statusFilter === "COMPLETED"
                              ? "No completed tasks yet. Check off a task to move it here!"
                              : statusFilter === "IN_PROGRESS"
                              ? "No tasks currently in progress."
                              : statusFilter === "TODO"
                              ? "No tasks in To Do."
                              : "No tasks found matching your filter."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Bottom of Document Table: Click to Add New Task Row or New Header Row */}
                  <tr className="border-t border-white/15 bg-black/35">
                    <td colSpan={10} className="p-2.5">
                      <div className="flex flex-wrap items-center gap-2.5 px-2">
                        <button
                          type="button"
                          onClick={() => handleCreateTaskClick()}
                          className="flex-1 min-w-[200px] flex items-center gap-2 rounded-lg border border-dashed border-primary/50 bg-primary/10 hover:bg-primary/20 px-4 py-2.5 text-xs font-bold text-highlight transition-all text-left"
                        >
                          <Plus className="w-4 h-4 text-primary stroke-[2.5]" />
                          <span>
                            New Task — Click to add a row and start typing
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCreateHeaderClick()}
                          className="inline-flex items-center gap-2 rounded-lg border border-dashed border-white/25 bg-white/5 hover:bg-white/10 hover:border-primary/50 px-4 py-2.5 text-xs font-semibold text-white/85 hover:text-white transition-all"
                        >
                          <Heading className="w-4 h-4 text-primary" />
                          <span>+ Add Movable Header Row</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* Slide Drawer or Center Modal */}
      {viewMode !== "inline" && selectedTaskObj && (
        <TaskDocumentEditor
          task={selectedTaskObj}
          viewMode={viewMode}
          workspaceConfig={workspaceConfig}
          onClose={() => onSelectTask(null)}
          onUpdateTask={onUpdateTask}
          onDeleteTask={onDeleteTask}
        />
      )}
    </div>
  );
};
