"use client";

import React, { useState, useMemo, useEffect } from "react";
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
  MyDayBlock,
  MyDaySchedule,
  TaskItem,
  UserProfile,
  WorkspaceConfig,
} from "@/types/taskit";
import {
  addMinutesToTime,
  cascadeFromBlockIndex,
  computeDurationMinutes,
  computeMyDayLiveTelemetry,
  EnrichedMyDayBlock,
  formatDurationCompact,
  formatTime12h,
  getLocalDateYMD,
  getRoundedNowTime,
  isTaskDoneStatus,
  makeBlockId,
  minutesToTimeString,
  parseTimeToMinutes,
  recommendTaskMinutes,
  reorderScheduleBlocks,
  shiftScheduleBlocks,
  smartHeuristicArrange,
  swapScheduleBlocks,
} from "@/utils/myDayUtils";
import { MyDayStatusBanner } from "./MyDayStatusBanner";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  CalendarClock,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Coffee,
  GripVertical,
  KeyRound,
  ListPlus,
  Loader2,
  Pencil,
  Play,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";

interface MyDayViewProps {
  tasks: TaskItem[];
  profile: UserProfile;
  workspaceConfig: WorkspaceConfig;
  hasApiKey: boolean;
  effectiveApiKey: string;
  aiTemporarilyDisabled: boolean;
  onUpdateWorkspaceConfig: (updates: Partial<WorkspaceConfig>) => void;
  onUpdateTask: (taskId: string, updates: Partial<TaskItem>) => void;
  onOpenApiKeySetup: () => void;
  onShowToast: (msg: string) => void;
}

interface SortableBlockCardProps {
  block: EnrichedMyDayBlock;
  totalBlocks: number;
  swapSourceId: string | null;
  isEditing: boolean;
  onStartSwap: (id: string) => void;
  onCompleteSwap: (targetId: string) => void;
  onCancelSwap: () => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onStartEdit: (block: EnrichedMyDayBlock) => void;
  onCancelEdit: () => void;
  onSaveEdit: (
    blockId: string,
    updates: {
      title: string;
      startTime: string;
      endTime: string;
      notes: string;
    },
    cascadeFollowing: boolean
  ) => void;
  onToggleComplete: (block: EnrichedMyDayBlock) => void;
  onRemove: (blockId: string) => void;
}

const SortableScheduleBlockCard: React.FC<SortableBlockCardProps> = ({
  block,
  totalBlocks,
  swapSourceId,
  isEditing,
  onStartSwap,
  onCompleteSwap,
  onCancelSwap,
  onMoveUp,
  onMoveDown,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onToggleComplete,
  onRemove,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 40 : undefined,
  };

  const [editTitle, setEditTitle] = useState(block.title);
  const [editStart, setEditStart] = useState(block.startTime);
  const [editEnd, setEditEnd] = useState(block.endTime);
  const [editNotes, setEditNotes] = useState(block.notes || "");
  const [cascadeEdit, setCascadeEdit] = useState(true);

  useEffect(() => {
    if (isEditing) {
      setEditTitle(block.title);
      setEditStart(block.startTime);
      setEditEnd(block.endTime);
      setEditNotes(block.notes || "");
    }
  }, [isEditing, block]);

  const isSwapSource = swapSourceId === block.id;
  const isSwapCandidate = Boolean(swapSourceId && swapSourceId !== block.id);
  const isActiveNow = block.timeState === "active";

  const previewDuration = computeDurationMinutes(editStart, editEnd);

  const applyQuickEditDuration = (mins: number) => {
    setEditEnd(addMinutesToTime(editStart, mins));
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group rounded-2xl border transition-all ${
        isDragging
          ? "border-primary bg-[#1c2029] shadow-2xl scale-[1.01] opacity-95"
          : isSwapSource
          ? "border-amber-400 bg-amber-500/10 ring-1 ring-amber-400/40"
          : isSwapCandidate
          ? "border-amber-400/45 bg-black/55 hover:border-amber-300"
          : isActiveNow
          ? "border-primary/65 bg-primary/[0.11] shadow-[0_0_30px_rgba(0,0,0,0.45)] ring-1 ring-primary/35"
          : block.isCompleted
          ? "border-emerald-500/25 bg-emerald-500/[0.05] opacity-80"
          : "border-white/12 bg-black/40 hover:border-white/25"
      }`}
    >
      <div className="p-3.5 sm:p-4 flex flex-col gap-3">
        <div className="flex items-start gap-2.5 sm:gap-3">
          {/* Drag Handle */}
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder schedule block"
            className="mt-1 cursor-grab active:cursor-grabbing rounded-lg p-1 text-white/35 hover:bg-white/10 hover:text-white/80 transition-colors shrink-0"
            title="Drag to move in schedule"
          >
            <GripVertical className="w-4 h-4" />
          </button>

          {/* Check-off Button */}
          {!block.isBreak ? (
            <button
              type="button"
              onClick={() => onToggleComplete(block)}
              aria-label={
                block.isCompleted ? "Mark task incomplete" : "Mark task done"
              }
              className="mt-1 shrink-0 transition-transform hover:scale-110"
              title={
                block.isCompleted
                  ? "Completed (synced with Tasks table)"
                  : "Check off task"
              }
            >
              {block.isCompleted ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <Circle className="w-5 h-5 text-white/40 hover:text-primary" />
              )}
            </button>
          ) : (
            <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-amber-300 shrink-0">
              <Coffee className="w-3 h-3" />
            </div>
          )}

          {/* Timeframe & Title Info */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onStartEdit(block)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.06] hover:border-primary/50 px-2.5 py-0.5 font-mono text-xs font-bold text-highlight transition-colors"
                title="Click to edit timeframe"
              >
                <Clock className="w-3 h-3 text-primary" />
                <span>
                  {formatTime12h(block.startTime)} –{" "}
                  {formatTime12h(block.endTime)}
                </span>
              </button>

              <span className="rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-[11px] text-white/60">
                {formatDurationCompact(block.durationMinutes)}
              </span>

              {isActiveNow && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-black">
                  <span className="h-1.5 w-1.5 rounded-full bg-black animate-ping" />
                  NOW • {Math.round(block.liveProgressPct)}%
                </span>
              )}

              {block.priority && !block.isBreak && (
                <span
                  className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                    block.priority.toLowerCase() === "urgent"
                      ? "border-red-400/40 bg-red-500/15 text-red-200"
                      : block.priority.toLowerCase() === "high"
                      ? "border-orange-400/40 bg-orange-500/15 text-orange-200"
                      : "border-white/10 bg-white/5 text-white/65"
                  }`}
                >
                  {block.priority}
                </span>
              )}

              {block.category && (
                <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/55">
                  {block.category}
                </span>
              )}
            </div>

            <h4
              className={`mt-1.5 text-sm sm:text-[15px] font-semibold leading-snug ${
                block.isCompleted
                  ? "line-through text-white/45"
                  : "text-white/95"
              }`}
            >
              {block.title}
            </h4>

            {block.notes && !isEditing && (
              <p className="mt-1 text-xs text-white/50 line-clamp-2">
                {block.notes}
              </p>
            )}

            {/* Live Mini Bar when Active */}
            {isActiveNow && (
              <div className="mt-2.5">
                <progress
                  className="taskit-progress w-full h-1.5 block"
                  value={Math.min(100, Math.max(0, block.liveProgressPct))}
                  max={100}
                  aria-label={`${block.title} progress`}
                />
              </div>
            )}
          </div>

          {/* Right Action Controls: Swap, Move Up/Down, Edit, Delete */}
          <div className="flex items-center gap-1 shrink-0">
            {isSwapCandidate ? (
              <button
                type="button"
                onClick={() => onCompleteSwap(block.id)}
                className="inline-flex items-center gap-1 rounded-xl bg-amber-400 px-3 py-1.5 text-xs font-extrabold text-black shadow-lg hover:brightness-110 transition-all"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Swap Here</span>
              </button>
            ) : isSwapSource ? (
              <button
                type="button"
                onClick={onCancelSwap}
                className="inline-flex items-center gap-1 rounded-xl border border-amber-400/50 bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/30 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onStartSwap(block.id)}
                  disabled={totalBlocks < 2}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/10 hover:border-white/25 disabled:opacity-30 px-2 py-1 text-[11px] font-medium text-white/75 hover:text-white transition-colors"
                  title="Swap position with another scheduled block"
                >
                  <ArrowLeftRight className="w-3 h-3 text-primary" />
                  <span className="hidden sm:inline">Swap</span>
                </button>

                <button
                  type="button"
                  onClick={() => onMoveUp(block.index)}
                  disabled={block.index === 0}
                  aria-label="Move block earlier"
                  className="rounded-lg p-1.5 text-white/55 hover:bg-white/10 hover:text-white disabled:opacity-25 transition-colors"
                  title="Move up"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => onMoveDown(block.index)}
                  disabled={block.index === totalBlocks - 1}
                  aria-label="Move block later"
                  className="rounded-lg p-1.5 text-white/55 hover:bg-white/10 hover:text-white disabled:opacity-25 transition-colors"
                  title="Move down"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    isEditing ? onCancelEdit() : onStartEdit(block)
                  }
                  aria-label="Edit schedule block"
                  className={`rounded-lg p-1.5 transition-colors ${
                    isEditing
                      ? "bg-primary/20 text-highlight"
                      : "text-white/55 hover:bg-white/10 hover:text-white"
                  }`}
                  title="Edit timeframe & details"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => onRemove(block.id)}
                  aria-label="Remove from schedule"
                  className="rounded-lg p-1.5 text-white/45 hover:bg-red-500/15 hover:text-red-300 transition-colors"
                  title="Remove from My Day schedule"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Inline Editor Drawer */}
        {isEditing && (
          <div className="mt-1 rounded-xl border border-white/15 bg-[#12141a]/95 p-3.5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1">
                  Task / Block Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-1.5 text-xs text-white focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={editStart}
                  onChange={(e) => {
                    const nextStart = e.target.value;
                    const prevDur = computeDurationMinutes(editStart, editEnd);
                    setEditStart(nextStart);
                    setEditEnd(addMinutesToTime(nextStart, prevDur));
                  }}
                  className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-1.5 text-xs font-mono text-white focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1">
                  End Time ({formatDurationCompact(previewDuration)})
                </label>
                <input
                  type="time"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-1.5 text-xs font-mono text-white focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-white/45 mr-1">
                Quick Duration:
              </span>
              {[15, 30, 45, 60, 90, 120].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => applyQuickEditDuration(m)}
                  className={`rounded-lg border px-2 py-0.5 text-[11px] font-mono transition-colors ${
                    previewDuration === m
                      ? "border-primary bg-primary/20 text-highlight font-bold"
                      : "border-white/10 bg-white/5 text-white/65 hover:text-white"
                  }`}
                >
                  {formatDurationCompact(m)}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-white/50 mb-1">
                Focus Note (Optional)
              </label>
              <input
                type="text"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Goal or deliverable for this timeframe..."
                className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-1.5 text-xs text-white placeholder-white/30 focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <label className="inline-flex items-center gap-2 text-xs text-white/70 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={cascadeEdit}
                  onChange={(e) => setCascadeEdit(e.target.checked)}
                  className="rounded accent-[var(--primary)]"
                />
                <span>Shift subsequent blocks automatically to avoid overlap</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-3 py-1.5 text-xs font-medium text-white/75"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onSaveEdit(
                      block.id,
                      {
                        title: editTitle.trim() || block.title,
                        startTime: editStart,
                        endTime: editEnd,
                        notes: editNotes.trim(),
                      },
                      cascadeEdit
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-black hover:brightness-110 shadow-neon"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const MyDayView: React.FC<MyDayViewProps> = ({
  tasks,
  profile,
  workspaceConfig,
  hasApiKey,
  effectiveApiKey,
  aiTemporarilyDisabled,
  onUpdateWorkspaceConfig,
  onUpdateTask,
  onOpenApiKeySetup,
  onShowToast,
}) => {
  const schedule = workspaceConfig.myDaySchedule || null;
  const blocks = useMemo(() => schedule?.blocks || [], [schedule]);
  const autoCascadeTimes = schedule?.autoCascadeTimes ?? true;

  // Live tick so active block highlighting in timeline stays synced every 15s
  const [nowTick, setNowTick] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNowTick(new Date()), 10000);
    return () => clearInterval(id);
  }, []);

  const tableTasks = useMemo(
    () => tasks.filter((t) => !t.custom_properties?.is_header),
    [tasks]
  );

  const activeTableTasks = useMemo(
    () => tableTasks.filter((t) => !isTaskDoneStatus(t)),
    [tableTasks]
  );

  const scheduledTaskIdSet = useMemo(
    () => new Set(blocks.map((b) => b.taskId).filter(Boolean) as string[]),
    [blocks]
  );

  // Builder Tab Mode: "manual" | "ai"
  const [builderMode, setBuilderMode] = useState<"manual" | "ai">("manual");

  // --- MANUAL BUILDER STATE ---
  const [manualSourceMode, setManualSourceMode] = useState<"table" | "custom">(
    "table"
  );
  const [manualSearch, setManualSearch] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [customBlockTitle, setCustomBlockTitle] = useState("");
  const [customIsBreak, setCustomIsBreak] = useState(false);
  const [manualStart, setManualStart] = useState<string>(() =>
    getRoundedNowTime(new Date(), 15)
  );
  const [manualEnd, setManualEnd] = useState<string>(() =>
    addMinutesToTime(getRoundedNowTime(new Date(), 15), 45)
  );
  const [manualNotes, setManualNotes] = useState("");

  // Keep default Manual Start synced with end of last block when blocks change
  useEffect(() => {
    if (blocks.length > 0) {
      const lastEnd = blocks[blocks.length - 1].endTime;
      setManualStart(lastEnd);
      const chosen = tableTasks.find((t) => t.id === selectedTaskId);
      const dur = chosen ? recommendTaskMinutes(chosen) : 30;
      setManualEnd(addMinutesToTime(lastEnd, dur));
    }
  }, [blocks.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select first unscheduled active task for convenience
  useEffect(() => {
    if (!selectedTaskId && activeTableTasks.length > 0) {
      const firstUnscheduled =
        activeTableTasks.find((t) => !scheduledTaskIdSet.has(t.id)) ||
        activeTableTasks[0];
      if (firstUnscheduled) {
        setSelectedTaskId(firstUnscheduled.id);
        const rec = recommendTaskMinutes(firstUnscheduled);
        setManualEnd(addMinutesToTime(manualStart, rec));
      }
    }
  }, [activeTableTasks, selectedTaskId, scheduledTaskIdSet, manualStart]);

  const filteredManualTasks = useMemo(() => {
    const q = manualSearch.trim().toLowerCase();
    if (!q) return tableTasks;
    return tableTasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.type || "").toLowerCase().includes(q) ||
        (t.section_group || "").toLowerCase().includes(q)
    );
  }, [tableTasks, manualSearch]);

  // --- AI AUTO-ARRANGE STATE ---
  const [aiStartTime, setAiStartTime] = useState<string>(() =>
    getRoundedNowTime(new Date(), 15)
  );
  const [aiEndTime, setAiEndTime] = useState<string>(() =>
    addMinutesToTime(getRoundedNowTime(new Date(), 15), 240)
  );
  const [aiSelectedIds, setAiSelectedIds] = useState<Set<string>>(() => {
    return new Set(
      tasks
        .filter((t) => !t.custom_properties?.is_header && !isTaskDoneStatus(t))
        .map((t) => t.id)
    );
  });
  const [aiIncludeBreaks, setAiIncludeBreaks] = useState(true);
  const [isAiArranging, setIsAiArranging] = useState(false);
  const [aiSearchFilter, setAiSearchFilter] = useState("");

  // --- TIMELINE INTERACTION STATE ---
  const [swapSourceId, setSwapSourceId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const nowMinutes =
    nowTick.getHours() * 60 +
    nowTick.getMinutes() +
    nowTick.getSeconds() / 60;

  const telemetry = useMemo(
    () => computeMyDayLiveTelemetry(schedule, tasks, nowMinutes),
    [schedule, tasks, nowMinutes]
  );

  const saveSchedule = (
    nextBlocks: MyDayBlock[],
    overrides?: Partial<MyDaySchedule>
  ) => {
    const dayStart =
      overrides?.dayStartTime ||
      (nextBlocks.length > 0
        ? nextBlocks[0].startTime
        : schedule?.dayStartTime || aiStartTime);
    const dayEnd =
      overrides?.dayEndTime ||
      (nextBlocks.length > 0
        ? nextBlocks[nextBlocks.length - 1].endTime
        : schedule?.dayEndTime || aiEndTime);

    const updated: MyDaySchedule = {
      date: getLocalDateYMD(new Date()),
      dayStartTime: dayStart,
      dayEndTime: dayEnd,
      blocks: nextBlocks,
      autoCascadeTimes:
        overrides?.autoCascadeTimes !== undefined
          ? overrides.autoCascadeTimes
          : autoCascadeTimes,
      aiSummary:
        overrides?.aiSummary !== undefined
          ? overrides.aiSummary
          : schedule?.aiSummary || null,
      updatedAt: new Date().toISOString(),
    };

    onUpdateWorkspaceConfig({ myDaySchedule: updated });
  };

  // --- MANUAL ADD HANDLER ---
  const handleManualAddBlock = (e: React.FormEvent) => {
    e.preventDefault();
    const dur = computeDurationMinutes(manualStart, manualEnd);

    if (manualSourceMode === "table") {
      const task = tableTasks.find((t) => t.id === selectedTaskId);
      if (!task) {
        onShowToast("Select a task from your table first.");
        return;
      }

      const newBlock: MyDayBlock = {
        id: makeBlockId(),
        taskId: task.id,
        title: task.title,
        startTime: manualStart,
        endTime: manualEnd,
        durationMinutes: dur,
        category: task.type || "General",
        priority: task.priority || "Medium",
        notes: manualNotes.trim() || task.notes || "",
        completed: isTaskDoneStatus(task),
        isBreak: false,
      };

      const combined = [...blocks, newBlock];
      saveSchedule(combined, { aiSummary: null });
      onShowToast(
        `Scheduled "${task.title}" (${formatTime12h(
          manualStart
        )} – ${formatTime12h(manualEnd)})`
      );

      // Advance start time to this block's end time & preselect next unscheduled task
      const nextStart = manualEnd;
      setManualStart(nextStart);
      setManualNotes("");
      const nextCandidate = activeTableTasks.find(
        (t) => t.id !== task.id && !scheduledTaskIdSet.has(t.id)
      );
      if (nextCandidate) {
        setSelectedTaskId(nextCandidate.id);
        setManualEnd(
          addMinutesToTime(nextStart, recommendTaskMinutes(nextCandidate))
        );
      } else {
        setManualEnd(addMinutesToTime(nextStart, 30));
      }
    } else {
      const cleanTitle = customBlockTitle.trim();
      if (!cleanTitle) {
        onShowToast("Enter a title for the schedule block.");
        return;
      }

      const newBlock: MyDayBlock = {
        id: makeBlockId(),
        taskId: null,
        title: cleanTitle,
        startTime: manualStart,
        endTime: manualEnd,
        durationMinutes: dur,
        category: customIsBreak ? "Break" : "Focus Block",
        priority: customIsBreak ? "Low" : "Medium",
        notes: manualNotes.trim(),
        completed: false,
        isBreak: customIsBreak,
      };

      saveSchedule([...blocks, newBlock], { aiSummary: null });
      onShowToast(
        `Added "${cleanTitle}" (${formatTime12h(manualStart)} – ${formatTime12h(
          manualEnd
        )})`
      );
      setCustomBlockTitle("");
      setManualNotes("");
      setManualStart(manualEnd);
      setManualEnd(addMinutesToTime(manualEnd, 30));
    }
  };

  // --- AI AUTO-ARRANGE HANDLER ---
  const runHeuristicArrange = () => {
    const selectedTasks = tableTasks.filter((t) => aiSelectedIds.has(t.id));
    if (selectedTasks.length === 0) {
      onShowToast("Select at least one task to arrange.");
      return;
    }
    const { blocks: arranged, summary } = smartHeuristicArrange({
      tasks: selectedTasks,
      startTime: aiStartTime,
      endTime: aiEndTime,
      includeBreaks: aiIncludeBreaks,
    });
    saveSchedule(arranged, {
      dayStartTime: aiStartTime,
      dayEndTime: aiEndTime,
      aiSummary: summary,
    });
    onShowToast(`Arranged ${arranged.length} blocks into your day!`);
  };

  const handleAiAutoArrange = async () => {
    const selectedTasks = tableTasks.filter((t) => aiSelectedIds.has(t.id));
    if (selectedTasks.length === 0) {
      onShowToast("Select at least one task (or click Add All Active).");
      return;
    }

    if (!hasApiKey || aiTemporarilyDisabled) {
      runHeuristicArrange();
      return;
    }

    setIsAiArranging(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "auto_arrange_day",
          customApiKey: effectiveApiKey,
          startTime: aiStartTime,
          endTime: aiEndTime,
          tasks: selectedTasks,
          includeBreaks: aiIncludeBreaks,
          tone: profile.ai_tone,
          clientLocalDateReadable: new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
        }),
      });

      const data = await res.json();
      if (!res.ok || !Array.isArray(data.blocks)) {
        // Fallback smoothly to smart priority arranger if quota/network error
        runHeuristicArrange();
        return;
      }

      saveSchedule(data.blocks, {
        dayStartTime: aiStartTime,
        dayEndTime: aiEndTime,
        aiSummary: data.summary || "Auto-arranged by Gemini AI",
      });
      onShowToast("Gemini AI arranged your day schedule!");
    } catch {
      runHeuristicArrange();
    } finally {
      setIsAiArranging(false);
    }
  };

  // --- REORDER / MOVE / SWAP / EDIT HANDLERS ---
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const moved = arrayMove(blocks, oldIndex, newIndex);
    const reflowed = reorderScheduleBlocks(blocks, moved, autoCascadeTimes);
    saveSchedule(reflowed);
  };

  const handleMoveBlock = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= blocks.length) return;
    const moved = arrayMove(blocks, index, targetIdx);
    const reflowed = reorderScheduleBlocks(blocks, moved, autoCascadeTimes);
    saveSchedule(reflowed);
  };

  const handleCompleteSwap = (targetId: string) => {
    if (!swapSourceId) return;
    const idxA = blocks.findIndex((b) => b.id === swapSourceId);
    const idxB = blocks.findIndex((b) => b.id === targetId);
    setSwapSourceId(null);
    if (idxA === -1 || idxB === -1 || idxA === idxB) return;

    const swapped = swapScheduleBlocks(blocks, idxA, idxB, autoCascadeTimes);
    saveSchedule(swapped);
    onShowToast(
      `Swapped "${blocks[idxA].title}" and "${blocks[idxB].title}"`
    );
  };

  const handleSaveBlockEdit = (
    blockId: string,
    updates: {
      title: string;
      startTime: string;
      endTime: string;
      notes: string;
    },
    cascadeFollowing: boolean
  ) => {
    const idx = blocks.findIndex((b) => b.id === blockId);
    if (idx === -1) return;
    const dur = computeDurationMinutes(updates.startTime, updates.endTime);

    let nextBlocks = blocks.map((b, i) =>
      i === idx
        ? {
            ...b,
            title: updates.title,
            startTime: updates.startTime,
            endTime: updates.endTime,
            durationMinutes: dur,
            notes: updates.notes,
          }
        : b
    );

    if (cascadeFollowing) {
      nextBlocks = cascadeFromBlockIndex(nextBlocks, idx);
    }

    // Also keep linked task title synced if edited
    const editedBlock = nextBlocks[idx];
    if (editedBlock.taskId && updates.title !== blocks[idx].title) {
      onUpdateTask(editedBlock.taskId, { title: updates.title });
    }

    setEditingBlockId(null);
    saveSchedule(nextBlocks);
    onShowToast("Updated schedule block.");
  };

  const handleToggleBlockComplete = (block: EnrichedMyDayBlock) => {
    const nextDone = !block.isCompleted;
    if (block.taskId) {
      onUpdateTask(block.taskId, {
        status: nextDone ? "Done" : "To Do",
        completed_at: nextDone ? new Date().toISOString() : null,
      });
    }
    const nextBlocks = blocks.map((b) =>
      b.id === block.id ? { ...b, completed: nextDone } : b
    );
    saveSchedule(nextBlocks);
  };

  const handleRemoveBlock = (blockId: string) => {
    const nextBlocks = blocks.filter((b) => b.id !== blockId);
    if (swapSourceId === blockId) setSwapSourceId(null);
    if (editingBlockId === blockId) setEditingBlockId(null);
    saveSchedule(nextBlocks);
  };

  const handleAlignStartToNow = () => {
    if (blocks.length === 0) return;
    const nowNow = new Date();
    const currentMin = nowNow.getHours() * 60 + nowNow.getMinutes();
    const firstMin = parseTimeToMinutes(blocks[0].startTime);
    const delta = currentMin - firstMin;
    const shifted = shiftScheduleBlocks(blocks, delta);
    saveSchedule(shifted);
    onShowToast("Aligned schedule start to right now!");
  };

  const handleShiftAll = (deltaMins: number) => {
    if (blocks.length === 0) return;
    const shifted = shiftScheduleBlocks(blocks, deltaMins);
    saveSchedule(shifted);
    onShowToast(
      `Shifted schedule ${deltaMins > 0 ? `+${deltaMins}m` : `${deltaMins}m`}`
    );
  };

  const aiWindowMinutes = computeDurationMinutes(aiStartTime, aiEndTime);
  const aiSelectedTasksList = useMemo(
    () => tableTasks.filter((t) => aiSelectedIds.has(t.id)),
    [tableTasks, aiSelectedIds]
  );
  const aiSelectedTotalRecMinutes = useMemo(
    () =>
      aiSelectedTasksList.reduce((acc, t) => acc + recommendTaskMinutes(t), 0),
    [aiSelectedTasksList]
  );

  const filteredAiTasks = useMemo(() => {
    const q = aiSearchFilter.trim().toLowerCase();
    if (!q) return tableTasks;
    return tableTasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.type || "").toLowerCase().includes(q)
    );
  }, [tableTasks, aiSearchFilter]);

  const manualDurationPreview = computeDurationMinutes(manualStart, manualEnd);

  return (
    <div className="space-y-6 pb-12">
      {/* 1. HERO CENTERPIECE: LIVE TIME IN CENTER + CURRENT TASK BAR + OVERALL DAY BAR */}
      <MyDayStatusBanner
        schedule={schedule}
        tasks={tasks}
        workspaceConfig={workspaceConfig}
        variant="hero"
        onToggleBlockComplete={handleToggleBlockComplete}
      />

      {/* 2. WORKSPACE GRID: BUILDER PANEL (LEFT) + SWAPPABLE/EDITABLE TIMELINE (RIGHT) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: MANUAL BUILD & AI AUTO-ARRANGE */}
        <div className="xl:col-span-5 rounded-3xl border theme-panel p-5 sm:p-6 shadow-2xl backdrop-blur-2xl space-y-5">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-white/12 bg-black/45 p-1">
            <button
              type="button"
              onClick={() => setBuilderMode("manual")}
              className={`inline-flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition-all ${
                builderMode === "manual"
                  ? "bg-primary text-black shadow-neon"
                  : "text-white/65 hover:text-white hover:bg-white/5"
              }`}
            >
              <ListPlus className="w-4 h-4" />
              <span>Manual Build</span>
            </button>

            <button
              type="button"
              onClick={() => setBuilderMode("ai")}
              className={`inline-flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition-all ${
                builderMode === "ai"
                  ? "bg-primary text-black shadow-neon"
                  : "text-white/65 hover:text-white hover:bg-white/5"
              }`}
            >
              <Wand2 className="w-4 h-4" />
              <span>AI Auto-Arrange</span>
            </button>
          </div>

          {builderMode === "manual" ? (
            /* ---------------- MANUAL BUILD FORM ---------------- */
            <form onSubmit={handleManualAddBlock} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Manually Build Your Day
                  </h3>
                  <p className="text-xs text-white/55">
                    Pick a task from your table and assign its timeframe.
                  </p>
                </div>

                <div className="inline-flex rounded-xl border border-white/10 bg-black/40 p-0.5 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setManualSourceMode("table")}
                    className={`rounded-lg px-2.5 py-1 font-semibold transition-colors ${
                      manualSourceMode === "table"
                        ? "bg-white/15 text-white"
                        : "text-white/55 hover:text-white"
                    }`}
                  >
                    Table Task
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualSourceMode("custom")}
                    className={`rounded-lg px-2.5 py-1 font-semibold transition-colors ${
                      manualSourceMode === "custom"
                        ? "bg-white/15 text-white"
                        : "text-white/55 hover:text-white"
                    }`}
                  >
                    Custom / Break
                  </button>
                </div>
              </div>

              {manualSourceMode === "table" ? (
                <div className="space-y-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={manualSearch}
                      onChange={(e) => setManualSearch(e.target.value)}
                      placeholder="Filter tasks from your table..."
                      className="w-full rounded-xl border border-white/12 bg-black/50 pl-8 pr-3 py-2 text-xs text-white placeholder-white/35 focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-1.5 rounded-2xl border border-white/10 bg-black/35 p-2">
                    {filteredManualTasks.length === 0 ? (
                      <div className="py-6 text-center text-xs text-white/45">
                        No matching tasks found in your Tasks table.
                      </div>
                    ) : (
                      filteredManualTasks.map((t) => {
                        const isSelected = selectedTaskId === t.id;
                        const alreadyScheduled = scheduledTaskIdSet.has(t.id);
                        const isDone = isTaskDoneStatus(t);
                        const recMins = recommendTaskMinutes(t);

                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setSelectedTaskId(t.id);
                              setManualEnd(
                                addMinutesToTime(manualStart, recMins)
                              );
                            }}
                            className={`w-full flex items-center justify-between gap-2.5 rounded-xl border px-3 py-2 text-left text-xs transition-all ${
                              isSelected
                                ? "border-primary bg-primary/20 text-white shadow-sm"
                                : "border-transparent bg-white/[0.03] hover:bg-white/[0.08] text-white/80"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`font-semibold truncate ${
                                    isDone ? "line-through text-white/45" : ""
                                  }`}
                                >
                                  {t.title}
                                </span>
                                {alreadyScheduled && (
                                  <span className="rounded bg-primary/25 px-1.5 py-0.2 text-[9px] font-bold uppercase text-highlight shrink-0">
                                    In Plan
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-white/45 mt-0.5">
                                {t.type} • {t.priority}
                                {t.section_group ? ` • ${t.section_group}` : ""}
                              </div>
                            </div>

                            <span className="rounded-lg border border-white/10 bg-black/40 px-2 py-0.5 font-mono text-[10px] text-highlight shrink-0">
                              {t.estimated_minutes > 0
                                ? `${t.estimated_minutes}m est`
                                : `~${recMins}m`}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-white/65 mb-1">
                      Custom Block Title
                    </label>
                    <input
                      type="text"
                      value={customBlockTitle}
                      onChange={(e) => setCustomBlockTitle(e.target.value)}
                      placeholder="e.g. Lunch Break, Gym, Review Lecture Notes..."
                      className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-xs text-white placeholder-white/35 focus:border-primary focus:outline-none"
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs text-white/70 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={customIsBreak}
                      onChange={(e) => setCustomIsBreak(e.target.checked)}
                      className="rounded accent-[var(--primary)]"
                    />
                    <span>Mark as recharge / break block</span>
                  </label>
                </div>
              )}

              {/* Timeframe Inputs */}
              <div className="rounded-2xl border border-white/12 bg-black/40 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
                    Timeframe ({formatDurationCompact(manualDurationPreview)})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const nowStr = minutesToTimeString(
                        new Date().getHours() * 60 + new Date().getMinutes()
                      );
                      setManualStart(nowStr);
                      setManualEnd(
                        addMinutesToTime(nowStr, manualDurationPreview)
                      );
                    }}
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    Set Start to Right Now
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-white/50 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={manualStart}
                      onChange={(e) => {
                        const nextS = e.target.value;
                        const curDur = computeDurationMinutes(
                          manualStart,
                          manualEnd
                        );
                        setManualStart(nextS);
                        setManualEnd(addMinutesToTime(nextS, curDur));
                      }}
                      className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-xs font-mono text-white focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-white/50 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={manualEnd}
                      onChange={(e) => setManualEnd(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-xs font-mono text-white focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {[15, 25, 30, 45, 60, 90, 120].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() =>
                        setManualEnd(addMinutesToTime(manualStart, mins))
                      }
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-mono transition-colors ${
                        manualDurationPreview === mins
                          ? "border-primary bg-primary/20 text-highlight font-bold"
                          : "border-white/10 bg-white/5 text-white/60 hover:text-white"
                      }`}
                    >
                      {formatDurationCompact(mins)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <input
                  type="text"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Optional focus note for this time block..."
                  className="w-full rounded-xl border border-white/12 bg-black/45 px-3 py-2 text-xs text-white placeholder-white/35 focus:border-primary focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 px-4 text-xs sm:text-sm font-extrabold text-black shadow-neon hover:brightness-110 transition-all"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Add to My Day Schedule</span>
              </button>
            </form>
          ) : (
            /* ---------------- AI AUTO-ARRANGE FORM ---------------- */
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span>AI Auto-Arrange Schedule</span>
                </h3>
                <p className="text-xs text-white/55 mt-0.5">
                  Choose your start &amp; planned end time plus the tasks you
                  want to accomplish—AI fits each task using its time
                  recommendations, priority, and due date.
                </p>
              </div>

              {/* Start & Planned End Time */}
              <div className="rounded-2xl border border-white/12 bg-black/40 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
                    Available Window ({formatDurationCompact(aiWindowMinutes)})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const nowStr = minutesToTimeString(
                        new Date().getHours() * 60 + new Date().getMinutes()
                      );
                      setAiStartTime(nowStr);
                      setAiEndTime(addMinutesToTime(nowStr, 240));
                    }}
                    className="text-[11px] font-semibold text-primary hover:underline"
                  >
                    Start Right Now (+4h)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-white/50 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={aiStartTime}
                      onChange={(e) => setAiStartTime(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-xs font-mono text-white focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-white/50 mb-1">
                      Planned End Time
                    </label>
                    <input
                      type="time"
                      value={aiEndTime}
                      onChange={(e) => setAiEndTime(e.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-xs font-mono text-white focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Task Multi-Select + Add All */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-white/80">
                    Tasks to Accomplish ({aiSelectedIds.size} selected • ~
                    {formatDurationCompact(aiSelectedTotalRecMinutes)} est.)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setAiSelectedIds(
                          new Set(activeTableTasks.map((t) => t.id))
                        )
                      }
                      className="rounded-lg border border-primary/40 bg-primary/15 hover:bg-primary/25 px-2.5 py-1 text-[11px] font-semibold text-highlight transition-colors"
                    >
                      Add All Active ({activeTableTasks.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiSelectedIds(new Set())}
                      className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-2 py-1 text-[11px] text-white/60 hover:text-white transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={aiSearchFilter}
                    onChange={(e) => setAiSearchFilter(e.target.value)}
                    placeholder="Search tasks to include..."
                    className="w-full rounded-xl border border-white/12 bg-black/50 pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/35 focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="max-h-52 overflow-y-auto space-y-1 rounded-2xl border border-white/10 bg-black/35 p-2">
                  {filteredAiTasks.map((t) => {
                    const checked = aiSelectedIds.has(t.id);
                    const recMins = recommendTaskMinutes(t);
                    const done = isTaskDoneStatus(t);

                    return (
                      <label
                        key={t.id}
                        className={`flex items-center justify-between gap-2.5 rounded-xl border px-3 py-2 text-xs cursor-pointer transition-colors ${
                          checked
                            ? "border-primary/45 bg-primary/15 text-white"
                            : "border-transparent bg-white/[0.02] hover:bg-white/[0.06] text-white/70"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setAiSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(t.id)) next.delete(t.id);
                                else next.add(t.id);
                                return next;
                              });
                            }}
                            className="rounded accent-[var(--primary)] shrink-0"
                          />
                          <div className="min-w-0">
                            <div
                              className={`font-medium truncate ${
                                done ? "line-through text-white/45" : ""
                              }`}
                            >
                              {t.title}
                            </div>
                            <div className="text-[10px] text-white/45">
                              {t.priority} • {t.type}
                            </div>
                          </div>
                        </div>

                        <span className="rounded-md border border-white/10 bg-black/40 px-2 py-0.5 font-mono text-[10px] text-highlight shrink-0">
                          {t.estimated_minutes > 0
                            ? `${t.estimated_minutes}m rec`
                            : `~${recMins}m`}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-white/75 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={aiIncludeBreaks}
                  onChange={(e) => setAiIncludeBreaks(e.target.checked)}
                  className="rounded accent-[var(--primary)]"
                />
                <span>Insert short recharge breaks between deep work blocks</span>
              </label>

              {!hasApiKey && !aiTemporarilyDisabled && (
                <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 flex items-center justify-between gap-2 text-xs text-amber-100">
                  <span>
                    Add your Google AI key for Gemini reasoning, or run Smart
                    Auto-Arrange directly.
                  </span>
                  <button
                    type="button"
                    onClick={onOpenApiKeySetup}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-300/40 bg-amber-400/20 px-2.5 py-1 font-semibold text-amber-100 hover:bg-amber-400/30 shrink-0"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>Add Key</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                disabled={isAiArranging || aiSelectedIds.size === 0}
                onClick={handleAiAutoArrange}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary py-3 px-4 text-xs sm:text-sm font-extrabold text-black shadow-neon hover:brightness-110 disabled:opacity-45 transition-all"
              >
                {isAiArranging ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Gemini Arranging Your Optimal Schedule...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    <span>
                      {hasApiKey && !aiTemporarilyDisabled
                        ? "Auto-Arrange My Day with AI"
                        : "Smart Auto-Arrange Selected Tasks"}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: INTERACTIVE SWAPPABLE, MOVABLE, EDITABLE SCHEDULE */}
        <div className="xl:col-span-7 rounded-3xl border theme-panel p-5 sm:p-6 shadow-2xl backdrop-blur-2xl space-y-4">
          {/* Header & Logistics Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-primary" />
                <span>Today&apos;s Interactive Schedule</span>
                {blocks.length > 0 && (
                  <span className="rounded-full bg-primary/20 border border-primary/35 px-2.5 py-0.5 text-xs font-mono text-highlight">
                    {blocks.length} {blocks.length === 1 ? "slot" : "slots"}
                  </span>
                )}
              </h3>
              <p className="text-xs text-white/55 mt-0.5">
                Drag to reorder, click Swap to trade slots, or click any
                timeframe to edit.
              </p>
            </div>

            {blocks.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleAlignStartToNow}
                  className="inline-flex items-center gap-1 rounded-xl border border-primary/40 bg-primary/15 hover:bg-primary/25 px-2.5 py-1.5 text-xs font-semibold text-highlight transition-colors"
                  title="Shift entire schedule so the first block begins right now"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Start Now</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleShiftAll(-15)}
                  className="rounded-xl border border-white/12 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 text-xs font-mono text-white/75 hover:text-white transition-colors"
                  title="Shift all blocks 15 minutes earlier"
                >
                  -15m
                </button>
                <button
                  type="button"
                  onClick={() => handleShiftAll(15)}
                  className="rounded-xl border border-white/12 bg-white/5 hover:bg-white/10 px-2.5 py-1.5 text-xs font-mono text-white/75 hover:text-white transition-colors"
                  title="Push all blocks 15 minutes later"
                >
                  +15m
                </button>
                <button
                  type="button"
                  onClick={() => {
                    saveSchedule([], { aiSummary: null });
                    onShowToast("Cleared My Day schedule.");
                  }}
                  className="rounded-xl border border-red-400/25 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1.5 text-xs font-medium text-red-200 transition-colors"
                >
                  Clear Day
                </button>
              </div>
            )}
          </div>

          {/* Reorder Reflow Toggle + AI Strategy Note */}
          {blocks.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <label className="inline-flex items-center gap-2 text-white/70 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoCascadeTimes}
                  onChange={(e) =>
                    saveSchedule(blocks, {
                      autoCascadeTimes: e.target.checked,
                    })
                  }
                  className="rounded accent-[var(--primary)]"
                />
                <span>
                  Auto-reflow start &amp; end times when swapping or reordering
                </span>
              </label>

              <span className="font-mono text-[11px] text-white/50">
                Total:{" "}
                {formatDurationCompact(telemetry.totalScheduledMinutes)}
              </span>
            </div>
          )}

          {schedule?.aiSummary && blocks.length > 0 && (
            <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 flex items-start gap-2.5 text-xs text-white/90">
              <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="leading-relaxed">{schedule.aiSummary}</div>
            </div>
          )}

          {swapSourceId && (
            <div className="rounded-2xl border border-amber-400/50 bg-amber-500/15 px-4 py-2.5 flex items-center justify-between gap-2 text-xs text-amber-100">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-amber-300" />
                <span>
                  Select <strong>&ldquo;Swap Here&rdquo;</strong> on another
                  schedule component to swap positions.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSwapSourceId(null)}
                className="rounded-lg border border-amber-300/40 px-2.5 py-1 font-semibold hover:bg-amber-400/20"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Sortable Schedule Blocks List */}
          {telemetry.enrichedBlocks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-black/25 py-16 px-6 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
                <CalendarClock className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h4 className="text-base font-bold text-white">
                  Your MY DAY schedule is open
                </h4>
                <p className="text-xs text-white/55 leading-relaxed">
                  Use <strong>Manual Build</strong> on the left to pick tasks
                  with custom timeframes, or switch to{" "}
                  <strong>AI Auto-Arrange</strong> to automatically fit your
                  tasks between your start and end time.
                </p>
              </div>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setBuilderMode("ai")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/15 hover:bg-primary/25 px-4 py-2 text-xs font-bold text-highlight transition-colors"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  <span>Try AI Auto-Arrange</span>
                </button>
              </div>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={telemetry.enrichedBlocks.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2.5">
                  {telemetry.enrichedBlocks.map((b) => (
                    <SortableScheduleBlockCard
                      key={b.id}
                      block={b}
                      totalBlocks={telemetry.enrichedBlocks.length}
                      swapSourceId={swapSourceId}
                      isEditing={editingBlockId === b.id}
                      onStartSwap={(id) => setSwapSourceId(id)}
                      onCompleteSwap={handleCompleteSwap}
                      onCancelSwap={() => setSwapSourceId(null)}
                      onMoveUp={(idx) => handleMoveBlock(idx, -1)}
                      onMoveDown={(idx) => handleMoveBlock(idx, 1)}
                      onStartEdit={(blk) => setEditingBlockId(blk.id)}
                      onCancelEdit={() => setEditingBlockId(null)}
                      onSaveEdit={handleSaveBlockEdit}
                      onToggleComplete={handleToggleBlockComplete}
                      onRemove={handleRemoveBlock}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  );
};
