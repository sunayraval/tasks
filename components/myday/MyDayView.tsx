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
  HelpCircle,
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
import {
  Badge,
  Button,
  Card,
  Input,
  Progress,
  Tabs,
  Text,
  Title,
} from "@/components/tailus-ui";

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
  onLaunchGuidedDayPlan?: () => void;
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
    <Card
      ref={setNodeRef}
      style={style}
      variant={isDragging ? "elevated" : "soft"}
      className={`group p-0 border transition-all ${
        isDragging
          ? "border-primary-500 shadow-2xl scale-[1.01] opacity-95"
          : isSwapSource
          ? "border-warning-400 bg-warning-500/10 ring-1 ring-warning-400/40"
          : isSwapCandidate
          ? "border-warning-400/45 bg-[--ui-soft-bg] hover:border-warning-300"
          : isActiveNow
          ? "border-primary-500/60 bg-primary-500/10 ring-1 ring-primary-500/30"
          : block.isCompleted
          ? "border-success-500/25 bg-success-500/5 opacity-80"
          : "border-[--ui-border-color] hover:border-gray-600"
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
            className="mt-1 cursor-grab active:cursor-grabbing rounded-[--btn-radius] p-1 text-caption hover:bg-[--ui-bg] hover:text-title transition-colors shrink-0"
            title="Drag to move in schedule"
          >
            <GripVertical className="size-4" />
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
                <CheckCircle2 className="size-5 text-success-400" />
              ) : (
                <Circle className="size-5 text-caption hover:text-primary-400" />
              )}
            </button>
          ) : (
            <div className="mt-1 flex size-5 items-center justify-center rounded-full bg-[--ui-bg] text-warning-400 shrink-0">
              <Coffee className="size-3" />
            </div>
          )}

          {/* Timeframe & Title Info */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Button.Root
                variant="outlined"
                intent="gray"
                size="xs"
                onClick={() => onStartEdit(block)}
                className="h-6 px-2 gap-1 font-mono text-xs"
                title="Click to edit timeframe"
              >
                <Button.Icon type="leading" size="xs">
                  <Clock className="text-primary-400" />
                </Button.Icon>
                <Button.Label>
                  {formatTime12h(block.startTime)} –{" "}
                  {formatTime12h(block.endTime)}
                </Button.Label>
              </Button.Root>

              <Badge variant="soft" intent="gray" size="xs" className="font-mono">
                {formatDurationCompact(block.durationMinutes)}
              </Badge>

              {isActiveNow && (
                <Badge
                  variant="solid"
                  intent="primary"
                  size="xs"
                  className="inline-flex items-center gap-1 rounded-full uppercase tracking-wide"
                >
                  <span className="size-1.5 rounded-full bg-white animate-ping" />
                  NOW • {Math.round(block.liveProgressPct)}%
                </Badge>
              )}

              {block.priority && !block.isBreak && (
                <Badge
                  variant="soft"
                  intent={
                    block.priority.toLowerCase() === "urgent"
                      ? "danger"
                      : block.priority.toLowerCase() === "high"
                      ? "warning"
                      : "gray"
                  }
                  size="xs"
                >
                  {block.priority}
                </Badge>
              )}

              {block.category && (
                <Badge variant="outlined" intent="gray" size="xs">
                  {block.category}
                </Badge>
              )}
            </div>

            <h4
              className={`mt-1.5 text-sm sm:text-[15px] font-semibold leading-snug ${
                block.isCompleted
                  ? "line-through text-caption"
                  : "text-title"
              }`}
            >
              {block.title}
            </h4>

            {block.notes && !isEditing && (
              <p className="mt-1 text-xs text-caption line-clamp-2">
                {block.notes}
              </p>
            )}

            {/* Live Mini Bar when Active */}
            {isActiveNow && (
              <div className="mt-2.5">
                <Progress.Root
                  value={Math.min(100, Math.max(0, block.liveProgressPct))}
                  size="xs"
                  variant="soft"
                  aria-label={`${block.title} progress`}
                >
                  <Progress.Indicator
                    intent="primary"
                    style={{
                      transform: `translateX(-${100 - Math.min(100, Math.max(0, block.liveProgressPct))}%)`,
                    }}
                  />
                </Progress.Root>
              </div>
            )}
          </div>

          {/* Right Action Controls: Swap, Move Up/Down, Edit, Delete */}
          <div className="flex items-center gap-1 shrink-0">
            {isSwapCandidate ? (
              <Button.Root
                variant="solid"
                intent="warning"
                size="xs"
                onClick={() => onCompleteSwap(block.id)}
                className="font-semibold"
              >
                <Button.Icon type="leading" size="xs">
                  <ArrowLeftRight />
                </Button.Icon>
                <Button.Label>Swap Here</Button.Label>
              </Button.Root>
            ) : isSwapSource ? (
              <Button.Root
                variant="soft"
                intent="warning"
                size="xs"
                onClick={onCancelSwap}
              >
                <Button.Icon type="leading" size="xs">
                  <X />
                </Button.Icon>
                <Button.Label>Cancel</Button.Label>
              </Button.Root>
            ) : (
              <>
                <Button.Root
                  variant="outlined"
                  intent="gray"
                  size="xs"
                  onClick={() => onStartSwap(block.id)}
                  disabled={totalBlocks < 2}
                  className="h-7 px-2 text-[11px]"
                  title="Swap position with another scheduled block"
                >
                  <Button.Icon type="leading" size="xs">
                    <ArrowLeftRight className="text-primary-400" />
                  </Button.Icon>
                  <Button.Label className="hidden sm:inline">Swap</Button.Label>
                </Button.Root>

                <Button.Root
                  variant="ghost"
                  intent="gray"
                  size="xs"
                  onClick={() => onMoveUp(block.index)}
                  disabled={block.index === 0}
                  aria-label="Move block earlier"
                  title="Move up"
                >
                  <Button.Icon type="only" size="xs">
                    <ArrowUp />
                  </Button.Icon>
                </Button.Root>

                <Button.Root
                  variant="ghost"
                  intent="gray"
                  size="xs"
                  onClick={() => onMoveDown(block.index)}
                  disabled={block.index === totalBlocks - 1}
                  aria-label="Move block later"
                  title="Move down"
                >
                  <Button.Icon type="only" size="xs">
                    <ArrowDown />
                  </Button.Icon>
                </Button.Root>

                <Button.Root
                  variant={isEditing ? "soft" : "ghost"}
                  intent={isEditing ? "primary" : "gray"}
                  size="xs"
                  onClick={() =>
                    isEditing ? onCancelEdit() : onStartEdit(block)
                  }
                  aria-label="Edit schedule block"
                  title="Edit timeframe & details"
                >
                  <Button.Icon type="only" size="xs">
                    <Pencil />
                  </Button.Icon>
                </Button.Root>

                <Button.Root
                  variant="ghost"
                  intent="danger"
                  size="xs"
                  onClick={() => onRemove(block.id)}
                  aria-label="Remove from schedule"
                  title="Remove from My Day schedule"
                >
                  <Button.Icon type="only" size="xs">
                    <Trash2 />
                  </Button.Icon>
                </Button.Root>
              </>
            )}
          </div>
        </div>

        {/* Inline Editor Drawer */}
        {isEditing && (
          <Card
            variant="outlined"
            className="mt-1 bg-[--ui-bg] p-3.5 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-caption mb-1">
                  Task / Block Title
                </label>
                <Input
                  type="text"
                  variant="outlined"
                  size="sm"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-caption mb-1">
                  Start Time
                </label>
                <Input
                  type="time"
                  variant="outlined"
                  size="sm"
                  value={editStart}
                  onChange={(e) => {
                    const nextStart = e.target.value;
                    const prevDur = computeDurationMinutes(editStart, editEnd);
                    setEditStart(nextStart);
                    setEditEnd(addMinutesToTime(nextStart, prevDur));
                  }}
                  className="font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-caption mb-1">
                  End Time ({formatDurationCompact(previewDuration)})
                </label>
                <Input
                  type="time"
                  variant="outlined"
                  size="sm"
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-caption mr-1">
                Quick Duration:
              </span>
              {[15, 30, 45, 60, 90, 120].map((m) => (
                <Button.Root
                  key={m}
                  variant={previewDuration === m ? "soft" : "outlined"}
                  intent={previewDuration === m ? "primary" : "gray"}
                  size="xs"
                  onClick={() => applyQuickEditDuration(m)}
                  className="h-6 px-2 text-[11px] font-mono"
                >
                  <Button.Label>{formatDurationCompact(m)}</Button.Label>
                </Button.Root>
              ))}
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-caption mb-1">
                Focus Note (Optional)
              </label>
              <Input
                type="text"
                variant="outlined"
                size="sm"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Goal or deliverable for this timeframe..."
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <label className="inline-flex items-center gap-2 text-xs text-body cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={cascadeEdit}
                  onChange={(e) => setCascadeEdit(e.target.checked)}
                  className="rounded accent-[var(--primary)]"
                />
                <span>Shift subsequent blocks automatically to avoid overlap</span>
              </label>

              <div className="flex items-center gap-2">
                <Button.Root
                  variant="outlined"
                  intent="gray"
                  size="xs"
                  onClick={onCancelEdit}
                >
                  <Button.Label>Cancel</Button.Label>
                </Button.Root>
                <Button.Root
                  variant="solid"
                  intent="primary"
                  size="xs"
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
                  className="font-semibold"
                >
                  <Button.Icon type="leading" size="xs">
                    <Check />
                  </Button.Icon>
                  <Button.Label>Save Changes</Button.Label>
                </Button.Root>
              </div>
            </div>
          </Card>
        )}
      </div>
    </Card>
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
  onLaunchGuidedDayPlan,
}) => {
  const schedule = workspaceConfig.myDaySchedule || null;
  const blocks = useMemo(() => schedule?.blocks || [], [schedule]);
  const autoCascadeTimes = schedule?.autoCascadeTimes ?? true;

  // Live tick so active block highlighting in timeline stays synced every 10s (pauses when tab is hidden)
  const [nowTick, setNowTick] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => {
      if (!document.hidden) {
        setNowTick(new Date());
      }
    }, 10000);
    const onVisibility = () => {
      if (!document.hidden) setNowTick(new Date());
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
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
        <Card
          variant="mixed"
          fancy
          className="xl:col-span-5 p-5 sm:p-6 backdrop-blur-2xl space-y-5"
        >
          {/* Mode Switcher Tabs */}
          <Tabs.Root
            value={builderMode}
            onValueChange={(v) => setBuilderMode(v as "manual" | "ai")}
          >
            <Tabs.List
              variant="soft"
              triggerVariant="softToSoft"
              size="md"
              intent="primary"
              className="grid grid-cols-2 w-full bg-[--ui-soft-bg]/90 border border-[--ui-border-color] p-1"
            >
              <Tabs.Trigger
                value="manual"
                className="justify-center gap-2 text-xs font-semibold data-[state=active]:bg-[--ui-bg] data-[state=active]:text-title data-[state=active]:shadow-sm"
              >
                <ListPlus className="size-4 text-primary-400" />
                <span>Manual Build</span>
              </Tabs.Trigger>

              <Tabs.Trigger
                value="ai"
                className="justify-center gap-2 text-xs font-semibold data-[state=active]:bg-[--ui-bg] data-[state=active]:text-title data-[state=active]:shadow-sm"
              >
                <Wand2 className="size-4 text-primary-400" />
                <span>AI Auto-Arrange</span>
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>

          {builderMode === "manual" ? (
            /* ---------------- MANUAL BUILD FORM ---------------- */
            <form onSubmit={handleManualAddBlock} className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <Title as="h3" className="text-sm" size="base" weight="semibold">
                    Manually Build Your Day
                  </Title>
                  <Text size="sm" className="text-caption">
                    Pick a task from your table and assign its timeframe.
                  </Text>
                </div>

                <Tabs.Root
                  value={manualSourceMode}
                  onValueChange={(v) =>
                    setManualSourceMode(v as "table" | "custom")
                  }
                >
                  <Tabs.List
                    variant="soft"
                    triggerVariant="softToSoft"
                    size="sm"
                    className="border border-[--ui-border-color] bg-[--ui-soft-bg] p-0.5 text-[11px]"
                  >
                    <Tabs.Trigger
                      value="table"
                      className="px-2.5 text-[11px] font-medium data-[state=active]:bg-[--ui-bg] data-[state=active]:text-title"
                    >
                      Table Task
                    </Tabs.Trigger>
                    <Tabs.Trigger
                      value="custom"
                      className="px-2.5 text-[11px] font-medium data-[state=active]:bg-[--ui-bg] data-[state=active]:text-title"
                    >
                      Custom / Break
                    </Tabs.Trigger>
                  </Tabs.List>
                </Tabs.Root>
              </div>

              {manualSourceMode === "table" ? (
                <div className="space-y-2.5">
                  <div className="relative">
                    <Search className="size-3.5 text-caption absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <Input
                      type="text"
                      variant="outlined"
                      size="sm"
                      value={manualSearch}
                      onChange={(e) => setManualSearch(e.target.value)}
                      placeholder="Filter tasks from your table..."
                      className="pl-8"
                    />
                  </div>

                  <Card
                    variant="outlined"
                    className="max-h-56 overflow-y-auto space-y-1.5 bg-[--ui-soft-bg]/30 p-2"
                  >
                    {filteredManualTasks.length === 0 ? (
                      <div className="py-5 px-3 text-center space-y-2.5 text-xs text-caption">
                        <div>
                          {tableTasks.length === 0
                            ? "Your my tasks list is currently empty."
                            : "No matching tasks found in my tasks."}
                        </div>
                        {activeTableTasks.length === 0 &&
                          !aiTemporarilyDisabled &&
                          onLaunchGuidedDayPlan && (
                            <Button.Root
                              variant="soft"
                              intent="primary"
                              size="xs"
                              onClick={onLaunchGuidedDayPlan}
                            >
                              <Button.Icon type="leading" size="xs">
                                <HelpCircle />
                              </Button.Icon>
                              <Button.Label>
                                Ask AI Q&amp;A to Plan My Day
                              </Button.Label>
                            </Button.Root>
                          )}
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
                            className={`w-full flex items-center justify-between gap-2.5 rounded-[--btn-radius] border px-3 py-2 text-left text-xs transition-all ${
                              isSelected
                                ? "border-primary-500/60 bg-primary-500/15 text-title shadow-sm"
                                : "border-transparent bg-[--ui-bg]/60 hover:bg-[--ui-soft-bg] text-body"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`font-semibold truncate ${
                                    isDone
                                      ? "line-through text-caption"
                                      : "text-title"
                                  }`}
                                >
                                  {t.title}
                                </span>
                                {alreadyScheduled && (
                                  <Badge
                                    variant="soft"
                                    intent="primary"
                                    size="xs"
                                    className="uppercase shrink-0"
                                  >
                                    In Plan
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[10px] text-caption mt-0.5">
                                {t.type} • {t.priority}
                                {t.section_group ? ` • ${t.section_group}` : ""}
                              </div>
                            </div>

                            <Badge
                              variant="outlined"
                              intent="gray"
                              size="xs"
                              className="font-mono shrink-0"
                            >
                              {t.estimated_minutes > 0
                                ? `${t.estimated_minutes}m est`
                                : `~${recMins}m`}
                            </Badge>
                          </button>
                        );
                      })
                    )}
                  </Card>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-caption mb-1">
                      Custom Block Title
                    </label>
                    <Input
                      type="text"
                      variant="outlined"
                      size="sm"
                      value={customBlockTitle}
                      onChange={(e) => setCustomBlockTitle(e.target.value)}
                      placeholder="e.g. Lunch Break, Gym, Review Lecture Notes..."
                    />
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs text-body cursor-pointer select-none">
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
              <Card
                variant="soft"
                className="border border-[--ui-border-color] p-3.5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-caption">
                    Timeframe ({formatDurationCompact(manualDurationPreview)})
                  </span>
                  <Button.Root
                    variant="ghost"
                    intent="primary"
                    size="xs"
                    onClick={() => {
                      const nowStr = minutesToTimeString(
                        new Date().getHours() * 60 + new Date().getMinutes()
                      );
                      setManualStart(nowStr);
                      setManualEnd(
                        addMinutesToTime(nowStr, manualDurationPreview)
                      );
                    }}
                    className="h-6 px-2 text-[11px]"
                  >
                    <Button.Label>Set Start to Right Now</Button.Label>
                  </Button.Root>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-caption mb-1">
                      Start Time
                    </label>
                    <Input
                      type="time"
                      variant="outlined"
                      size="sm"
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
                      className="font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-caption mb-1">
                      End Time
                    </label>
                    <Input
                      type="time"
                      variant="outlined"
                      size="sm"
                      value={manualEnd}
                      onChange={(e) => setManualEnd(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {[15, 25, 30, 45, 60, 90, 120].map((mins) => (
                    <Button.Root
                      key={mins}
                      variant={
                        manualDurationPreview === mins ? "soft" : "outlined"
                      }
                      intent={
                        manualDurationPreview === mins ? "primary" : "gray"
                      }
                      size="xs"
                      onClick={() =>
                        setManualEnd(addMinutesToTime(manualStart, mins))
                      }
                      className="h-6 px-2 text-[11px] font-mono"
                    >
                      <Button.Label>
                        {formatDurationCompact(mins)}
                      </Button.Label>
                    </Button.Root>
                  ))}
                </div>
              </Card>

              <div>
                <Input
                  type="text"
                  variant="outlined"
                  size="sm"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="Optional focus note for this time block..."
                />
              </div>

              <Button.Root
                type="submit"
                variant="solid"
                intent="primary"
                size="md"
                className="w-full font-semibold"
              >
                <Button.Icon type="leading" size="sm">
                  <Plus className="stroke-[2.5]" />
                </Button.Icon>
                <Button.Label>Add to My Day Schedule</Button.Label>
              </Button.Root>
            </form>
          ) : (
            /* ---------------- AI AUTO-ARRANGE FORM ---------------- */
            <div className="space-y-4">
              <div>
                <Title as="h3" size="base" weight="semibold" className="text-sm flex items-center gap-1.5">
                  <Sparkles className="size-4 text-primary-400" />
                  <span>AI Auto-Arrange Schedule</span>
                </Title>
                <Text size="sm" className="text-caption mt-0.5">
                  Choose your start &amp; planned end time plus the tasks you
                  want to accomplish—AI fits each task using its time
                  recommendations, priority, and due date.
                </Text>
              </div>

              {/* Start & Planned End Time */}
              <Card
                variant="soft"
                className="border border-[--ui-border-color] p-3.5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-caption">
                    Available Window ({formatDurationCompact(aiWindowMinutes)})
                  </span>
                  <Button.Root
                    variant="ghost"
                    intent="primary"
                    size="xs"
                    onClick={() => {
                      const nowStr = minutesToTimeString(
                        new Date().getHours() * 60 + new Date().getMinutes()
                      );
                      setAiStartTime(nowStr);
                      setAiEndTime(addMinutesToTime(nowStr, 240));
                    }}
                    className="h-6 px-2 text-[11px]"
                  >
                    <Button.Label>Start Right Now (+4h)</Button.Label>
                  </Button.Root>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-caption mb-1">
                      Start Time
                    </label>
                    <Input
                      type="time"
                      variant="outlined"
                      size="sm"
                      value={aiStartTime}
                      onChange={(e) => setAiStartTime(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-caption mb-1">
                      Planned End Time
                    </label>
                    <Input
                      type="time"
                      variant="outlined"
                      size="sm"
                      value={aiEndTime}
                      onChange={(e) => setAiEndTime(e.target.value)}
                      className="font-mono"
                    />
                  </div>
                </div>
              </Card>

              {/* Task Multi-Select + Add All */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-body">
                    Tasks to Accomplish ({aiSelectedIds.size} selected • ~
                    {formatDurationCompact(aiSelectedTotalRecMinutes)} est.)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button.Root
                      variant="soft"
                      intent="primary"
                      size="xs"
                      onClick={() =>
                        setAiSelectedIds(
                          new Set(activeTableTasks.map((t) => t.id))
                        )
                      }
                      className="h-6 px-2.5 text-[11px]"
                    >
                      <Button.Label>
                        Add All Active ({activeTableTasks.length})
                      </Button.Label>
                    </Button.Root>
                    <Button.Root
                      variant="outlined"
                      intent="gray"
                      size="xs"
                      onClick={() => setAiSelectedIds(new Set())}
                      className="h-6 px-2 text-[11px]"
                    >
                      <Button.Label>Clear</Button.Label>
                    </Button.Root>
                  </div>
                </div>

                <div className="relative">
                  <Search className="size-3.5 text-caption absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    type="text"
                    variant="outlined"
                    size="sm"
                    value={aiSearchFilter}
                    onChange={(e) => setAiSearchFilter(e.target.value)}
                    placeholder="Search tasks to include..."
                    className="pl-8"
                  />
                </div>

                <Card
                  variant="outlined"
                  className="max-h-52 overflow-y-auto space-y-1 bg-[--ui-soft-bg]/30 p-2"
                >
                  {filteredAiTasks.length === 0 ? (
                    <div className="py-5 px-3 text-center space-y-2.5 text-xs text-caption">
                      <div>
                        {tableTasks.length === 0
                          ? "No tasks on your list yet."
                          : "No matching tasks found."}
                      </div>
                      {activeTableTasks.length === 0 &&
                        !aiTemporarilyDisabled &&
                        onLaunchGuidedDayPlan && (
                          <Button.Root
                            variant="soft"
                            intent="primary"
                            size="xs"
                            onClick={onLaunchGuidedDayPlan}
                          >
                            <Button.Icon type="leading" size="xs">
                              <HelpCircle />
                            </Button.Icon>
                            <Button.Label>
                              Let AI Ask Questions &amp; Build My Day
                            </Button.Label>
                          </Button.Root>
                        )}
                    </div>
                  ) : (
                    filteredAiTasks.map((t) => {
                      const checked = aiSelectedIds.has(t.id);
                      const recMins = recommendTaskMinutes(t);
                      const done = isTaskDoneStatus(t);

                      return (
                        <label
                          key={t.id}
                          className={`flex items-center justify-between gap-2.5 rounded-[--btn-radius] border px-3 py-2 text-xs cursor-pointer transition-colors ${
                            checked
                              ? "border-primary-500/45 bg-primary-500/15 text-title"
                              : "border-transparent bg-[--ui-bg]/50 hover:bg-[--ui-soft-bg] text-body"
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
                                  done
                                    ? "line-through text-caption"
                                    : "text-title"
                                }`}
                              >
                                {t.title}
                              </div>
                              <div className="text-[10px] text-caption">
                                {t.priority} • {t.type}
                              </div>
                            </div>
                          </div>

                          <Badge
                            variant="outlined"
                            intent="gray"
                            size="xs"
                            className="font-mono shrink-0"
                          >
                            {t.estimated_minutes > 0
                              ? `${t.estimated_minutes}m rec`
                              : `~${recMins}m`}
                          </Badge>
                        </label>
                      );
                    })
                  )}
                </Card>
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-body cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={aiIncludeBreaks}
                  onChange={(e) => setAiIncludeBreaks(e.target.checked)}
                  className="rounded accent-[var(--primary)]"
                />
                <span>Insert short recharge breaks between deep work blocks</span>
              </label>

              {!hasApiKey && !aiTemporarilyDisabled && (
                <Card
                  variant="outlined"
                  className="border-warning-500/35 bg-warning-500/10 p-3 flex items-center justify-between gap-2 text-xs text-warning-200"
                >
                  <span>
                    Add your Google AI key for Gemini reasoning, or run Smart
                    Auto-Arrange directly.
                  </span>
                  <Button.Root
                    variant="soft"
                    intent="warning"
                    size="xs"
                    onClick={onOpenApiKeySetup}
                    className="shrink-0"
                  >
                    <Button.Icon type="leading" size="xs">
                      <KeyRound />
                    </Button.Icon>
                    <Button.Label>Add Key</Button.Label>
                  </Button.Root>
                </Card>
              )}

              <Button.Root
                variant="solid"
                intent="primary"
                size="md"
                disabled={isAiArranging || aiSelectedIds.size === 0}
                onClick={handleAiAutoArrange}
                className="w-full font-semibold"
              >
                <Button.Icon type="leading" size="sm">
                  {isAiArranging ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Wand2 />
                  )}
                </Button.Icon>
                <Button.Label>
                  {isAiArranging
                    ? "Gemini Arranging Your Optimal Schedule..."
                    : hasApiKey && !aiTemporarilyDisabled
                    ? "Auto-Arrange My Day with AI"
                    : "Smart Auto-Arrange Selected Tasks"}
                </Button.Label>
              </Button.Root>
            </div>
          )}
        </Card>

        {/* RIGHT COLUMN: INTERACTIVE SWAPPABLE, MOVABLE, EDITABLE SCHEDULE */}
        <Card
          variant="mixed"
          fancy
          className="xl:col-span-7 p-5 sm:p-6 backdrop-blur-2xl space-y-4"
        >
          {/* Header & Logistics Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[--ui-border-color] pb-4">
            <div>
              <Title as="h3" size="lg" weight="bold" className="flex items-center gap-2">
                <CalendarClock className="size-5 text-primary-400" />
                <span>Today&apos;s Interactive Schedule</span>
                {blocks.length > 0 && (
                  <Badge variant="soft" intent="primary" size="xs" className="font-mono">
                    {blocks.length} {blocks.length === 1 ? "slot" : "slots"}
                  </Badge>
                )}
              </Title>
              <Text size="sm" className="text-caption mt-0.5">
                Drag to reorder, click Swap to trade slots, or click any
                timeframe to edit.
              </Text>
            </div>

            {blocks.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Button.Root
                  variant="soft"
                  intent="primary"
                  size="xs"
                  onClick={handleAlignStartToNow}
                  title="Shift entire schedule so the first block begins right now"
                >
                  <Button.Icon type="leading" size="xs">
                    <Play className="fill-current" />
                  </Button.Icon>
                  <Button.Label>Start Now</Button.Label>
                </Button.Root>
                <Button.Root
                  variant="outlined"
                  intent="gray"
                  size="xs"
                  onClick={() => handleShiftAll(-15)}
                  className="font-mono"
                  title="Shift all blocks 15 minutes earlier"
                >
                  <Button.Label>-15m</Button.Label>
                </Button.Root>
                <Button.Root
                  variant="outlined"
                  intent="gray"
                  size="xs"
                  onClick={() => handleShiftAll(15)}
                  className="font-mono"
                  title="Push all blocks 15 minutes later"
                >
                  <Button.Label>+15m</Button.Label>
                </Button.Root>
                <Button.Root
                  variant="soft"
                  intent="danger"
                  size="xs"
                  onClick={() => {
                    saveSchedule([], { aiSummary: null });
                    onShowToast("Cleared My Day schedule.");
                  }}
                >
                  <Button.Label>Clear Day</Button.Label>
                </Button.Root>
              </div>
            )}
          </div>

          {/* Reorder Reflow Toggle + AI Strategy Note */}
          {blocks.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <label className="inline-flex items-center gap-2 text-body cursor-pointer select-none">
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

              <span className="font-mono text-[11px] text-caption">
                Total:{" "}
                {formatDurationCompact(telemetry.totalScheduledMinutes)}
              </span>
            </div>
          )}

          {schedule?.aiSummary && blocks.length > 0 && (
            <Card
              variant="soft"
              className="border border-primary-500/30 bg-primary-500/10 px-4 py-3 flex items-start gap-2.5 text-xs text-title"
            >
              <Sparkles className="size-4 text-primary-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{schedule.aiSummary}</div>
            </Card>
          )}

          {swapSourceId && (
            <Card
              variant="outlined"
              className="border-warning-500/45 bg-warning-500/10 px-4 py-2.5 flex items-center justify-between gap-2 text-xs text-warning-200"
            >
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="size-4 text-warning-300" />
                <span>
                  Select <strong>&ldquo;Swap Here&rdquo;</strong> on another
                  schedule component to swap positions.
                </span>
              </div>
              <Button.Root
                variant="outlined"
                intent="warning"
                size="xs"
                onClick={() => setSwapSourceId(null)}
              >
                <Button.Label>Cancel</Button.Label>
              </Button.Root>
            </Card>
          )}

          {/* Sortable Schedule Blocks List */}
          {telemetry.enrichedBlocks.length === 0 ? (
            <Card
              variant="soft"
              className="border border-dashed border-[--ui-border-color] py-16 px-6 text-center space-y-3"
            >
              <div className="mx-auto flex size-12 items-center justify-center rounded-[--card-radius] border border-primary-500/30 bg-primary-500/10 text-primary-400">
                <CalendarClock className="size-6" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <Title as="h4" size="base" weight="semibold" align="center">
                  Your my day schedule is open
                </Title>
                <Text size="sm" align="center" className="text-caption leading-relaxed">
                  {activeTableTasks.length === 0
                    ? "Don't have tasks on your list yet? Let kite ask you a few quick questions to populate both your Tasks list and your my day schedule."
                    : "Use Manual Build on the left to pick tasks with custom timeframes, or switch to AI Auto-Arrange to automatically fit your tasks between your start and end time."}
                </Text>
              </div>
              <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                {activeTableTasks.length === 0 &&
                !aiTemporarilyDisabled &&
                onLaunchGuidedDayPlan ? (
                  <Button.Root
                    variant="solid"
                    intent="primary"
                    size="sm"
                    onClick={onLaunchGuidedDayPlan}
                    className="font-semibold"
                  >
                    <Button.Icon type="leading" size="xs">
                      <HelpCircle />
                    </Button.Icon>
                    <Button.Label>Plan My Day via Guided Q&amp;A</Button.Label>
                  </Button.Root>
                ) : (
                  <Button.Root
                    variant="soft"
                    intent="primary"
                    size="sm"
                    onClick={() => setBuilderMode("ai")}
                  >
                    <Button.Icon type="leading" size="xs">
                      <Wand2 />
                    </Button.Icon>
                    <Button.Label>Try AI Auto-Arrange</Button.Label>
                  </Button.Root>
                )}
              </div>
            </Card>
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
        </Card>
      </div>
    </div>
  );
};
