"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from "@tanstack/react-table";
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
  TaskPriority,
  TaskStatus,
  TaskType,
  SectionGroup,
  ViewMode,
  WorkspaceConfig,
  ColumnHeadersConfig,
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
  ChevronRight,
  Filter,
  AlertCircle,
  Trash2,
  Pencil,
  Check,
  Tag,
  Settings2,
  FolderPlus,
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
  onInlineCreateTask: (sectionId?: SectionGroup) => string;
  onUpdateWorkspaceConfig: (updates: Partial<WorkspaceConfig>) => void;
  onOpenSettingsTab: (
    tab: "appearance" | "customize" | "view" | "ai" | "integrations"
  ) => void;
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

interface SortableTaskRowProps {
  task: TaskItem;
  children: React.ReactNode;
  isSelected: boolean;
}

const SortableTaskRow: React.FC<SortableTaskRowProps> = ({
  task,
  children,
  isSelected,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`group border-b border-white/10 transition-colors ${
        isSelected
          ? "bg-primary/15"
          : task.status === "Done"
          ? "bg-black/25 opacity-60 hover:opacity-95"
          : "theme-row-hover"
      }`}
    >
      <td className="w-8 pl-3 pr-1 py-2 align-middle">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-white/35 hover:text-white p-1 rounded"
          title="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      </td>
      {children}
    </tr>
  );
};

// Inline Title & Notes Input Cell
const InlineTextCell: React.FC<{
  value: string;
  placeholder: string;
  isDone?: boolean;
  autoFocus?: boolean;
  onCommit: (val: string) => void;
  className?: string;
}> = ({ value, placeholder, isDone, autoFocus, onCommit, className = "" }) => {
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
        }
        if (e.key === "Escape") {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
      className={`w-full rounded-md bg-transparent px-1.5 py-1 text-xs sm:text-sm focus:bg-black/50 focus:outline-none focus:ring-1 focus:ring-primary/70 transition-all ${
        isDone ? "line-through text-white/40" : "text-white"
      } placeholder-white/30 ${className}`}
    />
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
  onUpdateWorkspaceConfig,
  onOpenSettingsTab,
}) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});
  const [newlyCreatedTaskId, setNewlyCreatedTaskId] = useState<string | null>(
    null
  );

  // Header inline editing state
  const [editingColKey, setEditingColKey] = useState<
    keyof ColumnHeadersConfig | null
  >(null);
  const [colHeaderDraft, setColHeaderDraft] = useState("");

  // Section header inline editing state
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionLabelDraft, setSectionLabelDraft] = useState("");

  // New section creation inline state
  const [addingNewSection, setAddingNewSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");

  // Open Tag Popover row ID
  const [openTagDropdownTaskId, setOpenTagDropdownTaskId] = useState<
    string | null
  >(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState<BadgeColorKey>("cyan");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const sections = workspaceConfig.sections;

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && t.type !== typeFilter) return false;
      if (globalFilter.trim()) {
        const q = globalFilter.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchNotes = (t.notes || "").toLowerCase().includes(q);
        const matchTags = t.tags.some((tag) => tag.toLowerCase().includes(q));
        const matchCourse = (t.canvas_course_code || "")
          .toLowerCase()
          .includes(q);
        return matchTitle || matchNotes || matchTags || matchCourse;
      }
      return true;
    });
  }, [tasks, statusFilter, typeFilter, globalFilter]);

  const handleTriggerNewRow = (secId?: SectionGroup) => {
    const targetSection = secId || sections[0]?.id || "TODAY";
    setCollapsedSections((prev) => ({ ...prev, [targetSection]: false }));
    const createdId = onInlineCreateTask(targetSection);
    setNewlyCreatedTaskId(createdId);
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

  const commitSectionLabel = (secId: string) => {
    setEditingSectionId(null);
    const cleaned = sectionLabelDraft.trim();
    if (!cleaned) return;
    const updatedSections = sections.map((s) =>
      s.id === secId ? { ...s, label: cleaned } : s
    );
    onUpdateWorkspaceConfig({ sections: updatedSections });
  };

  const handleAddNewSection = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newSectionName.trim();
    if (!cleaned) return;
    const id = cleaned.toUpperCase().replace(/\s+/g, "_");
    if (!sections.some((s) => s.id === id)) {
      onUpdateWorkspaceConfig({
        sections: [...sections, { id, label: cleaned, badge: "Custom Section" }],
      });
    }
    setNewSectionName("");
    setAddingNewSection(false);
  };

  const handleDeleteSection = (secId: string) => {
    if (sections.length <= 1) return;
    const fallbackSec = sections.find((s) => s.id !== secId)?.id || "TODAY";
    tasks.forEach((t) => {
      if (t.section_group === secId) {
        onUpdateTask(t.id, { section_group: fallbackSec });
      }
    });
    onUpdateWorkspaceConfig({
      sections: sections.filter((s) => s.id !== secId),
    });
  };

  const moveSectionOrder = (dir: -1 | 1, sectionId: SectionGroup) => {
    const idx = sections.findIndex((s) => s.id === sectionId);
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= sections.length) return;
    onUpdateWorkspaceConfig({
      sections: arrayMove(sections, idx, targetIdx),
    });
  };

  const getOptionColor = (
    list: Array<{ id: string; label: string; color: BadgeColorKey }>,
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

  const columns = useMemo<ColumnDef<TaskItem>[]>(
    () => [
      {
        accessorKey: "title",
        header: workspaceConfig.columnHeaders.title,
        cell: ({ row }) => {
          const t = row.original;
          const isDone = t.status === "Done";
          return (
            <div className="flex items-center gap-2 min-w-[230px] max-w-[400px]">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const nextStatus: TaskStatus = isDone
                    ? workspaceConfig.statuses[0]?.label || "To Do"
                    : "Done";
                  onUpdateTask(t.id, {
                    status: nextStatus,
                    completed_at:
                      nextStatus === "Done" ? new Date().toISOString() : null,
                  });
                }}
                className="shrink-0 text-white/45 hover:text-primary transition-colors"
                title={isDone ? "Mark as To Do" : "Complete Task"}
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
                  placeholder="Type task name..."
                  isDone={isDone}
                  autoFocus={newlyCreatedTaskId === t.id}
                  onCommit={(val) => {
                    onUpdateTask(t.id, { title: val || "Untitled Task" });
                    if (newlyCreatedTaskId === t.id) {
                      setNewlyCreatedTaskId(null);
                    }
                  }}
                  className="font-medium"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  onSelectTask(selectedTaskId === t.id ? null : t.id)
                }
                className="inline-flex items-center gap-1 rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/60 hover:border-primary/60 hover:text-highlight transition-all shrink-0"
                title="Open rich-text document & details"
              >
                <FileText className="w-3 h-3" />
                <span className="hidden sm:inline">Doc</span>
              </button>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: workspaceConfig.columnHeaders.status,
        cell: ({ row }) => {
          const t = row.original;
          const colorKey = getOptionColor(
            workspaceConfig.statuses,
            t.status,
            "slate"
          );
          const badgeCls = getBadgeClasses(colorKey);
          const allStatuses = workspaceConfig.statuses.some(
            (s) => s.label === t.status
          )
            ? workspaceConfig.statuses
            : [
                ...workspaceConfig.statuses,
                { id: t.status, label: t.status, color: "slate" as BadgeColorKey },
              ];

          return (
            <select
              value={t.status}
              onChange={(e) => {
                if (e.target.value === "__MANAGE__") {
                  onOpenSettingsTab("customize");
                  return;
                }
                const nextStatus = e.target.value;
                onUpdateTask(t.id, {
                  status: nextStatus,
                  completed_at:
                    nextStatus === "Done" ? new Date().toISOString() : null,
                });
              }}
              className={`cursor-pointer rounded-md border px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${badgeCls}`}
            >
              {allStatuses.map((s) => (
                <option
                  key={s.id}
                  value={s.label}
                  className="bg-zinc-900 text-white"
                >
                  {s.label}
                </option>
              ))}
              <option value="__MANAGE__" className="bg-zinc-900 text-primary">
                ⚙️ Edit Statuses...
              </option>
            </select>
          );
        },
      },
      {
        accessorKey: "type",
        header: workspaceConfig.columnHeaders.type,
        cell: ({ row }) => {
          const t = row.original;
          const colorKey = getOptionColor(
            workspaceConfig.types,
            t.type,
            "violet"
          );
          const badgeCls = getBadgeClasses(colorKey);
          const allTypes = workspaceConfig.types.some((item) => item.label === t.type)
            ? workspaceConfig.types
            : [
                ...workspaceConfig.types,
                { id: t.type, label: t.type, color: "slate" as BadgeColorKey },
              ];

          return (
            <select
              value={t.type}
              onChange={(e) => {
                if (e.target.value === "__MANAGE__") {
                  onOpenSettingsTab("customize");
                  return;
                }
                onUpdateTask(t.id, { type: e.target.value });
              }}
              className={`cursor-pointer rounded-md border px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${badgeCls}`}
            >
              {allTypes.map((item) => (
                <option
                  key={item.id}
                  value={item.label}
                  className="bg-zinc-900 text-white"
                >
                  {item.label}
                </option>
              ))}
              <option value="__MANAGE__" className="bg-zinc-900 text-primary">
                ⚙️ Edit Categories...
              </option>
            </select>
          );
        },
      },
      {
        accessorKey: "priority",
        header: workspaceConfig.columnHeaders.priority,
        cell: ({ row }) => {
          const t = row.original;
          const colorKey = getOptionColor(
            workspaceConfig.priorities,
            t.priority,
            "amber"
          );
          const badgeCls = getBadgeClasses(colorKey);
          const allPriorities = workspaceConfig.priorities.some(
            (p) => p.label === t.priority
          )
            ? workspaceConfig.priorities
            : [
                ...workspaceConfig.priorities,
                {
                  id: t.priority,
                  label: t.priority,
                  color: "slate" as BadgeColorKey,
                },
              ];

          return (
            <select
              value={t.priority}
              onChange={(e) => {
                if (e.target.value === "__MANAGE__") {
                  onOpenSettingsTab("customize");
                  return;
                }
                onUpdateTask(t.id, { priority: e.target.value });
              }}
              className={`cursor-pointer rounded-md border px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${badgeCls}`}
            >
              {allPriorities.map((p) => (
                <option
                  key={p.id}
                  value={p.label}
                  className="bg-zinc-900 text-white"
                >
                  {p.label}
                </option>
              ))}
              <option value="__MANAGE__" className="bg-zinc-900 text-primary">
                ⚙️ Edit Priorities...
              </option>
            </select>
          );
        },
      },
      {
        accessorKey: "due_date",
        header: workspaceConfig.columnHeaders.due_date,
        cell: ({ row }) => {
          const t = row.original;
          const { label, isOverdue, isToday } = formatRelativeDueDate(
            t.due_date,
            t.status
          );
          const dateVal = t.due_date
            ? new Date(t.due_date).toISOString().split("T")[0]
            : "";

          return (
            <div className="relative inline-flex items-center gap-1.5 group/date">
              <input
                type="date"
                value={dateVal}
                onChange={(e) => {
                  const val = e.target.value;
                  onUpdateTask(t.id, {
                    due_date: val
                      ? new Date(`${val}T23:59:00`).toISOString()
                      : null,
                  });
                }}
                className="cursor-pointer rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-white/90 hover:border-primary/50 focus:border-primary focus:outline-none"
                title={label}
              />
              {isOverdue && (
                <span title={label}>
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                </span>
              )}
              {isToday && !isOverdue && (
                <span className="rounded bg-primary/20 border border-primary/40 px-1.5 py-0.5 text-[10px] font-semibold text-highlight">
                  Today
                </span>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "estimated_minutes",
        header: workspaceConfig.columnHeaders.estimated_minutes,
        cell: ({ row }) => {
          const t = row.original;
          const presets = [15, 30, 45, 60, 90, 120, 180];
          const currentMins = t.estimated_minutes || 30;
          const options = presets.includes(currentMins)
            ? presets
            : [...presets, currentMins].sort((a, b) => a - b);

          return (
            <select
              value={currentMins}
              onChange={(e) =>
                onUpdateTask(t.id, {
                  estimated_minutes: parseInt(e.target.value, 10) || 30,
                })
              }
              className="cursor-pointer rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs font-mono text-white/85 hover:border-primary/50 focus:border-primary focus:outline-none"
            >
              {options.map((mins) => (
                <option
                  key={mins}
                  value={mins}
                  className="bg-zinc-900 text-white"
                >
                  {formatEstimatedTime(mins)}
                </option>
              ))}
            </select>
          );
        },
      },
      {
        accessorKey: "tags",
        header: workspaceConfig.columnHeaders.tags,
        cell: ({ row }) => {
          const t = row.original;
          const isDropdownOpen = openTagDropdownTaskId === t.id;

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
                (tg) => tg.label.toLowerCase() === formatted.toLowerCase()
              )
            ) {
              onUpdateWorkspaceConfig({
                tags: [
                  ...workspaceConfig.tags,
                  { id: formatted, label: formatted, color: newTagColor },
                ],
              });
            }
            if (!t.tags.includes(formatted)) {
              onUpdateTask(t.id, { tags: [...t.tags, formatted] });
            }
            setNewTagName("");
          };

          return (
            <div className="relative min-w-[150px]">
              <div
                onClick={() =>
                  setOpenTagDropdownTaskId(isDropdownOpen ? null : t.id)
                }
                className="cursor-pointer flex flex-wrap items-center gap-1 rounded-md border border-transparent hover:border-white/20 hover:bg-black/30 px-1.5 py-1 min-h-[28px] transition-colors"
                title="Click to select or edit tags"
              >
                {t.is_canvas_assignment && t.canvas_course_code && (
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

              {isDropdownOpen && (
                <div
                  className="absolute left-0 top-full mt-1 w-64 rounded-xl border theme-panel p-2.5 shadow-2xl backdrop-blur-2xl z-50 space-y-2.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                    <span className="text-[11px] font-bold text-white flex items-center gap-1">
                      <Tag className="w-3 h-3 text-primary" />
                      Select Tags
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpenTagDropdownTaskId(null)}
                      className="text-[10px] text-white/50 hover:text-white"
                    >
                      Done
                    </button>
                  </div>

                  {/* Tag Options List */}
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {workspaceConfig.tags.map((tagOpt) => {
                      const active = t.tags.includes(tagOpt.label);
                      return (
                        <button
                          key={tagOpt.id}
                          type="button"
                          onClick={() => toggleTagOnTask(tagOpt.label)}
                          className={`w-full flex items-center justify-between rounded-lg px-2 py-1 text-xs transition-colors ${
                            active
                              ? "bg-white/15 text-white font-semibold"
                              : "text-white/70 hover:bg-white/10 hover:text-white"
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

                  {/* Quick Create New Tag Inline */}
                  <form
                    onSubmit={handleCreateNewTagInline}
                    className="border-t border-white/10 pt-2 space-y-1.5"
                  >
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="New #tag name..."
                        className="flex-1 rounded-lg border border-white/15 bg-black/60 px-2 py-1 text-[11px] text-white placeholder-white/35 focus:border-primary focus:outline-none"
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
                          onClick={() => setNewTagColor(ck)}
                          className={`h-3.5 w-3.5 rounded-full border ${
                            newTagColor === ck
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
                      setOpenTagDropdownTaskId(null);
                      onOpenSettingsTab("customize");
                    }}
                    className="w-full flex items-center justify-center gap-1 border-t border-white/10 pt-2 text-[11px] text-primary hover:underline"
                  >
                    <Settings2 className="w-3 h-3" />
                    <span>Manage All Tags in Settings</span>
                  </button>
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "notes",
        header: workspaceConfig.columnHeaders.notes,
        cell: ({ row }) => {
          const t = row.original;
          return (
            <div className="min-w-[150px] max-w-[220px]">
              <InlineTextCell
                value={t.notes || ""}
                placeholder="Add quick note..."
                onCommit={(val) => onUpdateTask(t.id, { notes: val })}
                className="text-white/75"
              />
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const t = row.original;
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteTask(t.id);
              }}
              className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-950/30 transition-colors"
              title="Delete Task"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          );
        },
      },
    ],
    [
      workspaceConfig,
      newlyCreatedTaskId,
      selectedTaskId,
      openTagDropdownTaskId,
      newTagName,
      newTagColor,
      onSelectTask,
      onUpdateTask,
      onDeleteTask,
      onUpdateWorkspaceConfig,
      onOpenSettingsTab,
    ]
  );

  const table = useReactTable({
    data: filteredTasks,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const targetTask = tasks[newIndex];
      const moved = arrayMove(tasks, oldIndex, newIndex).map((item, idx) =>
        item.id === active.id
          ? {
              ...item,
              section_group: targetTask.section_group,
              order_index: idx,
            }
          : { ...item, order_index: idx }
      );
      onReorderTasks(moved);
    }
  };

  const allSortedRows = table.getRowModel().rows;
  const selectedTaskObj = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );

  const headerKeyMap: Record<string, keyof ColumnHeadersConfig> = {
    title: "title",
    status: "status",
    type: "type",
    priority: "priority",
    due_date: "due_date",
    estimated_minutes: "estimated_minutes",
    tags: "tags",
    notes: "notes",
  };

  return (
    <div className="space-y-4">
      {/* Filter & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border theme-panel p-3.5 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-white/45 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Search tasks, #tags, categories..."
              className="w-full rounded-lg border theme-input pl-9 pr-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-primary hidden sm:inline" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border theme-input px-2.5 py-1.5 text-xs text-white/90 focus:outline-none"
            >
              <option value="ALL" className="bg-zinc-900">
                All {workspaceConfig.columnHeaders.status}es
              </option>
              {workspaceConfig.statuses.map((s) => (
                <option key={s.id} value={s.label} className="bg-zinc-900">
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border theme-input px-2.5 py-1.5 text-xs text-white/90 focus:outline-none"
          >
            <option value="ALL" className="bg-zinc-900">
              All {workspaceConfig.columnHeaders.type}s
            </option>
            {workspaceConfig.types.map((t) => (
              <option key={t.id} value={t.label} className="bg-zinc-900">
                {t.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => onOpenSettingsTab("customize")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-highlight hover:border-primary/50 hover:bg-primary/10 transition-colors"
            title="Customize tags, categories, statuses & headers"
          >
            <Settings2 className="w-3.5 h-3.5 text-primary" />
            <span>Edit Tags &amp; Options</span>
          </button>
        </div>

        {/* Right: Quick Add Row Button */}
        <div className="flex items-center gap-2 self-end md:self-center">
          <button
            type="button"
            onClick={() => handleTriggerNewRow(sections[0]?.id || "TODAY")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-bold text-black shadow-neon hover:brightness-110 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Task Row</span>
          </button>
        </div>
      </div>

      {/* Main Customizable Table */}
      <div className="rounded-xl border theme-panel overflow-visible backdrop-blur-xl">
        <div className="overflow-x-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredTasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <table className="w-full text-left border-collapse">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr
                      key={headerGroup.id}
                      className="border-b theme-header-bg text-[11px] font-semibold uppercase tracking-wider text-highlight/90"
                    >
                      <th className="w-8 pl-3 pr-1 py-3" />
                      {headerGroup.headers.map((header) => {
                        const colKey = headerKeyMap[header.column.id];
                        const isEditingThisCol =
                          colKey && editingColKey === colKey;

                        return (
                          <th key={header.id} className="px-3 py-3 select-none">
                            {header.isPlaceholder ? null : colKey ? (
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
                                    className="w-28 rounded border border-primary bg-black/80 px-1.5 py-0.5 text-[11px] font-bold text-white focus:outline-none"
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
                                    <Pencil className="w-2.5 h-2.5 opacity-0 group-hover/col:opacity-70 text-primary transition-opacity" />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={header.column.getToggleSortingHandler()}
                                  className="p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                                  title="Sort by column"
                                >
                                  <ArrowUpDown className="w-3 h-3" />
                                </button>
                              </div>
                            ) : null}
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>

                <tbody>
                  {sections.map((secMeta, secIndex) => {
                    const secId = secMeta.id;
                    const sectionRows = allSortedRows.filter(
                      (r) => r.original.section_group === secId
                    );
                    const isCollapsed = Boolean(collapsedSections[secId]);
                    const isEditingSec = editingSectionId === secId;

                    return (
                      <React.Fragment key={secId}>
                        {/* Editable Section Header Row */}
                        <tr className="border-y theme-section-bg">
                          <td colSpan={10} className="px-4 py-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCollapsedSections((prev) => ({
                                      ...prev,
                                      [secId]: !prev[secId],
                                    }))
                                  }
                                  className="p-0.5 text-primary hover:text-white transition-colors"
                                >
                                  {isCollapsed ? (
                                    <ChevronRight className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </button>

                                {isEditingSec ? (
                                  <input
                                    type="text"
                                    autoFocus
                                    value={sectionLabelDraft}
                                    onChange={(e) =>
                                      setSectionLabelDraft(e.target.value)
                                    }
                                    onBlur={() => commitSectionLabel(secId)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter")
                                        commitSectionLabel(secId);
                                      if (e.key === "Escape")
                                        setEditingSectionId(null);
                                    }}
                                    className="rounded border border-primary bg-black/70 px-2 py-0.5 text-xs sm:text-sm font-bold text-white focus:outline-none"
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSectionLabelDraft(secMeta.label);
                                      setEditingSectionId(secId);
                                    }}
                                    className="group/sec flex items-center gap-1.5 text-xs sm:text-sm font-bold tracking-wider text-highlight hover:text-white transition-colors"
                                    title="Click to rename section header"
                                  >
                                    <span>{secMeta.label}</span>
                                    <Pencil className="w-3 h-3 opacity-0 group-hover/sec:opacity-80 text-primary transition-opacity" />
                                  </button>
                                )}

                                <span className="rounded-full bg-black/40 border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
                                  {sectionRows.length}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleTriggerNewRow(secId)}
                                  className="rounded-lg border border-primary/40 bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold text-highlight hover:bg-primary hover:text-black transition-all"
                                >
                                  + New Task
                                </button>
                                <button
                                  type="button"
                                  disabled={secIndex === 0}
                                  onClick={() => moveSectionOrder(-1, secId)}
                                  className="rounded p-1 text-xs text-white/50 hover:text-white disabled:opacity-20"
                                  title="Move section up"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  disabled={secIndex === sections.length - 1}
                                  onClick={() => moveSectionOrder(1, secId)}
                                  className="rounded p-1 text-xs text-white/50 hover:text-white disabled:opacity-20"
                                  title="Move section down"
                                >
                                  ↓
                                </button>
                                {sections.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSection(secId)}
                                    className="rounded p-1 text-xs text-white/35 hover:text-red-400 transition-colors"
                                    title="Remove section"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Section Tasks */}
                        {!isCollapsed && (
                          <>
                            {sectionRows.map((row) => (
                              <React.Fragment key={row.id}>
                                <SortableTaskRow
                                  task={row.original}
                                  isSelected={
                                    selectedTaskId === row.original.id
                                  }
                                >
                                  {row.getVisibleCells().map((cell) => (
                                    <td
                                      key={cell.id}
                                      className="px-3 py-2 align-middle"
                                    >
                                      {flexRender(
                                        cell.column.columnDef.cell,
                                        cell.getContext()
                                      )}
                                    </td>
                                  ))}
                                </SortableTaskRow>

                                {/* Inline Editor if viewMode === inline */}
                                {viewMode === "inline" &&
                                  selectedTaskId === row.original.id &&
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
                            ))}

                            {/* Notion-Style Bottom-of-Section "+ New task" Row */}
                            <tr className="border-b border-white/5 hover:bg-white/[0.04] transition-colors">
                              <td colSpan={10} className="p-0">
                                <button
                                  type="button"
                                  onClick={() => handleTriggerNewRow(secId)}
                                  className="w-full flex items-center gap-2 px-10 py-2 text-xs text-white/45 hover:text-highlight transition-colors text-left"
                                >
                                  <Plus className="w-3.5 h-3.5 text-primary" />
                                  <span>
                                    New task in{" "}
                                    <strong className="font-semibold">
                                      {secMeta.label}
                                    </strong>
                                  </span>
                                </button>
                              </td>
                            </tr>
                          </>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* Bottom of Table: Prominent "+ New Task" & "+ Add Section" Bar */}
                  <tr className="border-t border-white/15 bg-black/30">
                    <td colSpan={10} className="p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 px-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleTriggerNewRow(sections[0]?.id || "TODAY")
                          }
                          className="inline-flex items-center gap-2 rounded-lg bg-primary/20 border border-primary/50 px-4 py-2 text-xs font-bold text-highlight hover:bg-primary hover:text-black transition-all shadow-sm"
                        >
                          <Plus className="w-4 h-4 stroke-[2.5]" />
                          <span>
                            + Click to Add New Task Row
                          </span>
                        </button>

                        {addingNewSection ? (
                          <form
                            onSubmit={handleAddNewSection}
                            className="inline-flex items-center gap-1.5"
                          >
                            <input
                              type="text"
                              autoFocus
                              value={newSectionName}
                              onChange={(e) =>
                                setNewSectionName(e.target.value)
                              }
                              placeholder="Section title (e.g. EXAMS)..."
                              className="rounded-lg border border-primary bg-black/70 px-2.5 py-1.5 text-xs text-white focus:outline-none"
                            />
                            <button
                              type="submit"
                              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-black"
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={() => setAddingNewSection(false)}
                              className="rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-white/60 hover:text-white"
                            >
                              Cancel
                            </button>
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAddingNewSection(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/75 hover:text-white hover:border-primary/50 transition-colors"
                          >
                            <FolderPlus className="w-3.5 h-3.5 text-primary" />
                            <span>+ Add Section Header</span>
                          </button>
                        )}
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
