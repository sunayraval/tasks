"use client";

import React, { useMemo, useState } from "react";
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
  SECTION_DIVIDERS,
  ViewMode,
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
  Sparkles,
  Filter,
  AlertCircle,
} from "lucide-react";
import { TaskDocumentEditor } from "@/components/editor/TaskDocumentEditor";

interface TaskTableProps {
  tasks: TaskItem[];
  selectedTaskId: string | null;
  viewMode: ViewMode;
  onSelectTask: (taskId: string | null) => void;
  onUpdateTask: (taskId: string, updates: Partial<TaskItem>) => void;
  onDeleteTask: (taskId: string) => void;
  onReorderTasks: (newTasks: TaskItem[]) => void;
  onOpenNewTaskModal: (defaultSection?: SectionGroup) => void;
}

export function formatRelativeDueDate(dueDateISO: string | null, status: TaskStatus): {
  label: string;
  isOverdue: boolean;
  isToday: boolean;
} {
  if (!dueDateISO) {
    return { label: "No Date", isOverdue: false, isToday: false };
  }
  const due = new Date(dueDateISO);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
    return { label: `In ${diffDays} days`, isOverdue: false, isToday: false };
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

const STATUS_STYLES: Record<TaskStatus, string> = {
  "To Do": "bg-slate-500/20 text-slate-200 border-slate-400/30",
  "In Progress": "bg-sky-500/20 text-sky-300 border-sky-400/40",
  Blocked: "bg-rose-500/25 text-rose-300 border-rose-400/40",
  Done: "bg-emerald-500/25 text-emerald-300 border-emerald-400/40",
};

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  Urgent: "bg-red-500/25 text-red-300 border-red-500/45",
  High: "bg-orange-500/25 text-orange-300 border-orange-500/45",
  Medium: "bg-yellow-500/20 text-yellow-200 border-yellow-400/40",
  Low: "bg-blue-500/20 text-blue-300 border-blue-400/40",
};

const TYPE_STYLES: Record<TaskType, string> = {
  College: "bg-purple-500/20 text-purple-200 border-purple-400/35",
  School: "bg-cyan-500/20 text-cyan-200 border-cyan-400/35",
  Personal: "bg-teal-500/20 text-teal-200 border-teal-400/35",
  Club: "bg-pink-500/20 text-pink-200 border-pink-400/35",
  Work: "bg-indigo-500/20 text-indigo-200 border-indigo-400/35",
  General: "bg-white/10 text-white/80 border-white/20",
};

const TAG_PALETTE = [
  "bg-cyan-500/15 text-cyan-200 border-cyan-400/30",
  "bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-400/30",
  "bg-amber-500/15 text-amber-200 border-amber-400/30",
  "bg-emerald-500/15 text-emerald-200 border-emerald-400/30",
  "bg-violet-500/15 text-violet-200 border-violet-400/30",
];

function getTagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length];
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
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`group border-b border-white/[0.06] transition-colors ${
        isSelected
          ? "bg-primary/15"
          : task.status === "Done"
          ? "bg-white/[0.01] opacity-65 hover:opacity-95"
          : "hover:bg-white/[0.05]"
      }`}
    >
      <td className="w-8 pl-3 pr-1 py-3 align-middle">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-white/25 hover:text-white/70 p-1 rounded"
          title="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      </td>
      {children}
    </tr>
  );
};

export const TaskTable: React.FC<TaskTableProps> = ({
  tasks,
  selectedTaskId,
  viewMode,
  onSelectTask,
  onUpdateTask,
  onDeleteTask,
  onReorderTasks,
  onOpenNewTaskModal,
}) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});
  const [sectionOrder, setSectionOrder] = useState<SectionGroup[]>(
    SECTION_DIVIDERS.map((s) => s.id)
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const columns = useMemo<ColumnDef<TaskItem>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Task",
        cell: ({ row }) => {
          const t = row.original;
          const isDone = t.status === "Done";
          return (
            <div className="flex items-center gap-2.5 min-w-[230px] max-w-[380px]">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const nextStatus: TaskStatus = isDone ? "To Do" : "Done";
                  onUpdateTask(t.id, {
                    status: nextStatus,
                    completed_at:
                      nextStatus === "Done" ? new Date().toISOString() : null,
                  });
                }}
                className="shrink-0 text-white/60 hover:text-primary transition-colors"
                title={isDone ? "Mark as To Do" : "Complete Task"}
              >
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Circle className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  onSelectTask(selectedTaskId === t.id ? null : t.id)
                }
                className="group/title flex items-center gap-2 text-left font-medium text-sm text-white hover:text-highlight transition-colors truncate"
              >
                <span className={isDone ? "line-through text-white/45" : ""}>
                  {t.title}
                </span>
                <span className="inline-flex items-center gap-1 rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/60 opacity-75 group-hover/title:opacity-100 group-hover/title:border-primary/50 group-hover/title:text-highlight transition-all shrink-0">
                  <FileText className="w-3 h-3" />
                  Open
                </span>
              </button>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const t = row.original;
          const statuses: TaskStatus[] = [
            "To Do",
            "In Progress",
            "Blocked",
            "Done",
          ];
          return (
            <button
              type="button"
              onClick={() => {
                const nextIdx =
                  (statuses.indexOf(t.status) + 1) % statuses.length;
                const nextStatus = statuses[nextIdx];
                onUpdateTask(t.id, {
                  status: nextStatus,
                  completed_at:
                    nextStatus === "Done" ? new Date().toISOString() : null,
                });
              }}
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-transform active:scale-95 ${
                STATUS_STYLES[t.status]
              }`}
              title="Click to cycle status"
            >
              {t.status}
            </button>
          );
        },
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => {
          const t = row.original;
          return (
            <span
              className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${
                TYPE_STYLES[t.type] || TYPE_STYLES.General
              }`}
            >
              {t.type}
            </span>
          );
        },
      },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ row }) => {
          const t = row.original;
          const priorities: TaskPriority[] = [
            "Urgent",
            "High",
            "Medium",
            "Low",
          ];
          return (
            <button
              type="button"
              onClick={() => {
                const nextIdx =
                  (priorities.indexOf(t.priority) + 1) % priorities.length;
                onUpdateTask(t.id, { priority: priorities[nextIdx] });
              }}
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${
                PRIORITY_STYLES[t.priority]
              }`}
              title="Click to cycle priority"
            >
              {t.priority}
            </button>
          );
        },
      },
      {
        accessorKey: "due_date",
        header: "Due Date",
        cell: ({ row }) => {
          const t = row.original;
          const { label, isOverdue, isToday } = formatRelativeDueDate(
            t.due_date,
            t.status
          );
          return (
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap ${
                isOverdue
                  ? "text-rose-400 font-semibold"
                  : isToday
                  ? "text-amber-300 font-semibold"
                  : "text-white/70"
              }`}
            >
              {isOverdue && <AlertCircle className="w-3.5 h-3.5 text-rose-400" />}
              {label}
            </span>
          );
        },
      },
      {
        accessorKey: "estimated_minutes",
        header: "Estimated Time",
        cell: ({ row }) => (
          <span className="text-xs font-mono text-white/70 whitespace-nowrap">
            {formatEstimatedTime(row.original.estimated_minutes)}
          </span>
        ),
      },
      {
        accessorKey: "tags",
        header: "Tags",
        cell: ({ row }) => {
          const t = row.original;
          return (
            <div className="flex flex-wrap items-center gap-1 min-w-[140px]">
              {t.is_canvas_assignment && t.canvas_course_code && (
                <span className="rounded-full border border-orange-400/40 bg-orange-500/20 px-2 py-0.5 text-[10px] font-semibold text-orange-200">
                  {t.canvas_course_code}
                </span>
              )}
              {t.tags.map((tag) => (
                <span
                  key={tag}
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${getTagColor(
                    tag
                  )}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          );
        },
      },
      {
        accessorKey: "notes",
        header: "Notes",
        cell: ({ row }) => (
          <p className="text-xs text-white/55 truncate max-w-[200px]">
            {row.original.notes || "—"}
          </p>
        ),
      },
    ],
    [onSelectTask, onUpdateTask, selectedTaskId]
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

  const moveSectionOrder = (dir: -1 | 1, sectionId: SectionGroup) => {
    const idx = sectionOrder.indexOf(sectionId);
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= sectionOrder.length) return;
    setSectionOrder(arrayMove(sectionOrder, idx, targetIdx));
  };

  const allSortedRows = table.getRowModel().rows;
  const selectedTaskObj = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );

  return (
    <div className="space-y-4">
      {/* Table Controls & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border border-white/15 bg-black/40 backdrop-blur-xl p-4 shadow-glass">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Filter tasks, #tags, courses..."
              className="w-full rounded-xl border border-white/15 bg-white/[0.05] pl-9 pr-3 py-2 text-xs sm:text-sm text-white placeholder-white/40 focus:border-primary focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-white/45 hidden sm:inline" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-xs text-white focus:border-primary focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="To Do">To Do</option>
              <option value="In Progress">In Progress</option>
              <option value="Blocked">Blocked</option>
              <option value="Done">Done</option>
            </select>
          </div>

          {/* Category Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-xs text-white focus:border-primary focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="College">College</option>
            <option value="School">School</option>
            <option value="Personal">Personal</option>
            <option value="Club">Club</option>
            <option value="Work">Work</option>
          </select>
        </div>

        {/* Right: Quick Add Button with Cmd+K hint */}
        <div className="flex items-center gap-2 self-end md:self-center">
          <button
            type="button"
            onClick={() => onOpenNewTaskModal("TODAY")}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs sm:text-sm font-semibold text-black shadow-neon hover:brightness-110 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Task</span>
            <kbd className="hidden sm:inline-block rounded bg-black/25 px-1.5 py-0.5 text-[10px] font-mono text-black/80">
              ⌘K
            </kbd>
          </button>
        </div>
      </div>

      {/* Main Notion-Style Document Table */}
      <div className="rounded-2xl border border-white/15 bg-black/45 backdrop-blur-xl shadow-glass overflow-hidden">
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
                      className="border-b border-white/15 bg-white/[0.04] text-[11px] font-semibold uppercase tracking-wider text-white/60"
                    >
                      <th className="w-8 pl-3 pr-1 py-3" />
                      {headerGroup.headers.map((header) => (
                        <th key={header.id} className="px-3 py-3 select-none">
                          {header.isPlaceholder ? null : (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="inline-flex items-center gap-1 hover:text-white transition-colors"
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                              <ArrowUpDown className="w-3 h-3 opacity-50" />
                            </button>
                          )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>

                <tbody>
                  {sectionOrder.map((secId, secIndex) => {
                    const secMeta = SECTION_DIVIDERS.find(
                      (s) => s.id === secId
                    )!;
                    const sectionRows = allSortedRows.filter(
                      (r) => r.original.section_group === secId
                    );
                    const isCollapsed = Boolean(collapsedSections[secId]);

                    return (
                      <React.Fragment key={secId}>
                        {/* Styled Section Divider Row */}
                        <tr className="border-y border-white/15 bg-gradient-to-r from-surface/55 via-black/60 to-surface/55">
                          <td colSpan={9} className="px-4 py-2.5">
                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() =>
                                  setCollapsedSections((prev) => ({
                                    ...prev,
                                    [secId]: !prev[secId],
                                  }))
                                }
                                className="flex items-center gap-3 text-xs sm:text-sm font-bold tracking-widest text-highlight hover:text-white transition-colors"
                              >
                                {isCollapsed ? (
                                  <ChevronRight className="w-4 h-4 text-primary" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-primary" />
                                )}
                                <span>{secMeta.label}</span>
                                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium tracking-normal text-white/75">
                                  {sectionRows.length}
                                </span>
                                <span className="hidden md:inline text-[11px] font-normal tracking-normal text-white/45">
                                  {secMeta.badge}
                                </span>
                              </button>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onOpenNewTaskModal(secId)}
                                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70 hover:bg-primary/20 hover:text-highlight transition-colors"
                                >
                                  + Add Here
                                </button>
                                <button
                                  type="button"
                                  disabled={secIndex === 0}
                                  onClick={() => moveSectionOrder(-1, secId)}
                                  className="rounded p-1 text-xs text-white/40 hover:text-white disabled:opacity-20"
                                  title="Move section up"
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  disabled={
                                    secIndex === sectionOrder.length - 1
                                  }
                                  onClick={() => moveSectionOrder(1, secId)}
                                  className="rounded p-1 text-xs text-white/40 hover:text-white disabled:opacity-20"
                                  title="Move section down"
                                >
                                  ↓
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Tasks inside this section */}
                        {!isCollapsed &&
                          (sectionRows.length === 0 ? (
                            <tr className="border-b border-white/5">
                              <td
                                colSpan={9}
                                className="px-6 py-4 text-center text-xs text-white/35 italic"
                              >
                                No tasks in {secId}. Click &ldquo;+ Add Here&rdquo;
                                or drag a task row into this section.
                              </td>
                            </tr>
                          ) : (
                            sectionRows.map((row) => (
                              <React.Fragment key={row.id}>
                                <SortableTaskRow
                                  task={row.original}
                                  isSelected={selectedTaskId === row.original.id}
                                >
                                  {row.getVisibleCells().map((cell) => (
                                    <td
                                      key={cell.id}
                                      className="px-3 py-3 align-middle"
                                    >
                                      {flexRender(
                                        cell.column.columnDef.cell,
                                        cell.getContext()
                                      )}
                                    </td>
                                  ))}
                                </SortableTaskRow>

                                {/* If View Mode is Inline and this row is selected, expand editor inline */}
                                {viewMode === "inline" &&
                                  selectedTaskId === row.original.id &&
                                  selectedTaskObj && (
                                    <tr>
                                      <td colSpan={9} className="px-4 py-2">
                                        <TaskDocumentEditor
                                          task={selectedTaskObj}
                                          viewMode="inline"
                                          onClose={() => onSelectTask(null)}
                                          onUpdateTask={onUpdateTask}
                                          onDeleteTask={onDeleteTask}
                                        />
                                      </td>
                                    </tr>
                                  )}
                              </React.Fragment>
                            ))
                          ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </SortableContext>
          </DndContext>
        </div>
      </div>

      {/* Render Slide Drawer or Center Modal when viewMode !== 'inline' */}
      {viewMode !== "inline" && selectedTaskObj && (
        <TaskDocumentEditor
          task={selectedTaskObj}
          viewMode={viewMode}
          onClose={() => onSelectTask(null)}
          onUpdateTask={onUpdateTask}
          onDeleteTask={onDeleteTask}
        />
      )}
    </div>
  );
};

