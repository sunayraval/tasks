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
  Filter,
  AlertCircle,
  Trash2,
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

export function formatRelativeDueDate(
  dueDateISO: string | null,
  status: TaskStatus
): {
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

// Clean Monochrome Badges with clear contrast
const STATUS_STYLES: Record<TaskStatus, string> = {
  "To Do": "bg-zinc-800 text-zinc-300 border-zinc-700",
  "In Progress": "bg-white/10 text-white border-white/20 font-medium",
  Blocked: "bg-red-950/40 text-red-300 border-red-800/50",
  Done: "bg-emerald-950/40 text-emerald-300 border-emerald-800/50",
};

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  Urgent: "bg-red-500/15 text-red-300 border-red-500/40",
  High: "bg-orange-500/15 text-orange-300 border-orange-500/40",
  Medium: "bg-zinc-800 text-zinc-300 border-zinc-700",
  Low: "bg-zinc-900 text-zinc-400 border-zinc-800",
};

const TYPE_STYLES: Record<TaskType, string> = {
  College: "bg-zinc-800 text-zinc-200 border-zinc-700",
  School: "bg-zinc-800 text-zinc-200 border-zinc-700",
  Personal: "bg-zinc-800 text-zinc-200 border-zinc-700",
  Club: "bg-zinc-800 text-zinc-200 border-zinc-700",
  Work: "bg-zinc-800 text-zinc-200 border-zinc-700",
  General: "bg-zinc-800 text-zinc-200 border-zinc-700",
};

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
      className={`group border-b border-zinc-800/80 transition-colors ${
        isSelected
          ? "bg-zinc-800/50"
          : task.status === "Done"
          ? "bg-black/20 opacity-60 hover:opacity-90"
          : "hover:bg-zinc-900/60"
      }`}
    >
      <td className="w-8 pl-3 pr-1 py-3 align-middle">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-zinc-600 hover:text-zinc-300 p-1 rounded"
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
            <div className="flex items-center gap-2.5 min-w-[240px] max-w-[420px]">
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
                className="shrink-0 text-zinc-500 hover:text-white transition-colors"
                title={isDone ? "Mark as To Do" : "Complete Task"}
              >
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Circle className="w-4 h-4 text-zinc-600 hover:text-white" />
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  onSelectTask(selectedTaskId === t.id ? null : t.id)
                }
                className="group/title flex items-center gap-2 text-left font-medium text-sm text-zinc-200 hover:text-white transition-colors truncate"
              >
                <span className={isDone ? "line-through text-zinc-500" : ""}>
                  {t.title}
                </span>
                <span className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800/80 px-1.5 py-0.5 text-[10px] text-zinc-400 opacity-60 group-hover/title:opacity-100 group-hover/title:text-white transition-all shrink-0">
                  <FileText className="w-3 h-3" />
                  Notes
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
              className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs transition-transform active:scale-95 ${
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
        header: "Category",
        cell: ({ row }) => {
          const t = row.original;
          return (
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs text-zinc-300 font-medium ${
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
              className={`inline-flex items-center gap-1 text-xs whitespace-nowrap ${
                isOverdue
                  ? "text-red-400 font-semibold"
                  : isToday
                  ? "text-white font-semibold"
                  : "text-zinc-400"
              }`}
            >
              {isOverdue && <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
              {label}
            </span>
          );
        },
      },
      {
        accessorKey: "estimated_minutes",
        header: "Est. Time",
        cell: ({ row }) => (
          <span className="text-xs font-mono text-zinc-400 whitespace-nowrap">
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
            <div className="flex flex-wrap items-center gap-1 min-w-[130px]">
              {t.is_canvas_assignment && t.canvas_course_code && (
                <span className="rounded border border-orange-500/30 bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-orange-300">
                  {t.canvas_course_code}
                </span>
              )}
              {t.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded border border-zinc-700 bg-zinc-800/80 px-1.5 py-0.5 text-[10px] text-zinc-300"
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
          <p className="text-xs text-zinc-400 truncate max-w-[160px]">
            {row.original.notes || "—"}
          </p>
        ),
      },
      // Direct Delete Action Column
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
                if (window.confirm(`Delete "${t.title}"?`)) {
                  onDeleteTask(t.id);
                }
              }}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
              title="Delete Task"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          );
        },
      },
    ],
    [onSelectTask, onUpdateTask, onDeleteTask, selectedTaskId]
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
      {/* Clean Monochrome Filter & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/80 p-3.5 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Search tasks, #tags, categories..."
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/90 pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-zinc-500 hidden sm:inline" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-300 focus:border-zinc-500 focus:outline-none"
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
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-300 focus:border-zinc-500 focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="College">College</option>
            <option value="School">School</option>
            <option value="Personal">Personal</option>
            <option value="Club">Club</option>
            <option value="Work">Work</option>
          </select>
        </div>

        {/* Right: Add Task Button */}
        <div className="flex items-center gap-2 self-end md:self-center">
          <button
            type="button"
            onClick={() => onOpenNewTaskModal("TODAY")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-zinc-200 transition-colors"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Task</span>
            <kbd className="hidden sm:inline-block rounded bg-zinc-200/80 px-1 py-0.5 text-[9px] font-mono text-zinc-800">
              ⌘K
            </kbd>
          </button>
        </div>
      </div>

      {/* Main Clean Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/90 overflow-hidden backdrop-blur-md">
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
                      className="border-b border-zinc-800 bg-zinc-900/60 text-[11px] font-semibold uppercase tracking-wider text-zinc-400"
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
                              <ArrowUpDown className="w-3 h-3 opacity-40" />
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
                        {/* Section Header Row */}
                        <tr className="border-y border-zinc-800 bg-zinc-900/40">
                          <td colSpan={10} className="px-4 py-2.5">
                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() =>
                                  setCollapsedSections((prev) => ({
                                    ...prev,
                                    [secId]: !prev[secId],
                                  }))
                                }
                                className="flex items-center gap-2 text-xs sm:text-sm font-semibold tracking-wider text-zinc-200 hover:text-white transition-colors"
                              >
                                {isCollapsed ? (
                                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                                )}
                                <span>{secMeta.label}</span>
                                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-normal text-zinc-400">
                                  {sectionRows.length}
                                </span>
                              </button>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onOpenNewTaskModal(secId)}
                                  className="rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                                >
                                  + New
                                </button>
                                <button
                                  type="button"
                                  disabled={secIndex === 0}
                                  onClick={() => moveSectionOrder(-1, secId)}
                                  className="rounded p-1 text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-20"
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
                                  className="rounded p-1 text-xs text-zinc-500 hover:text-zinc-200 disabled:opacity-20"
                                  title="Move section down"
                                >
                                  ↓
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Section Tasks */}
                        {!isCollapsed &&
                          (sectionRows.length === 0 ? (
                            <tr className="border-b border-zinc-900">
                              <td
                                colSpan={10}
                                className="px-6 py-3.5 text-center text-xs text-zinc-600 italic"
                              >
                                No tasks in {secId}. Click &ldquo;+ New&rdquo; to add your first item.
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
                                      className="px-3 py-2.5 align-middle"
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

      {/* Slide Drawer or Center Modal */}
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
