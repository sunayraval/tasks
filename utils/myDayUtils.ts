import { MyDayBlock, MyDaySchedule, TaskItem } from "@/types/taskit";

export interface EnrichedMyDayBlock extends MyDayBlock {
  index: number;
  startAbs: number;
  endAbs: number;
  isCompleted: boolean;
  timeState: "past" | "active" | "upcoming";
  liveProgressPct: number;
  linkedTask: TaskItem | null;
}

export interface MyDayLiveTelemetry {
  hasSchedule: boolean;
  phase:
    | "empty"
    | "before_day"
    | "active_block"
    | "between_blocks"
    | "day_complete";
  currentBlock: EnrichedMyDayBlock | null;
  currentBlockIndex: number;
  currentTaskProgressPct: number;
  currentTaskElapsedMinutes: number;
  currentTaskRemainingMinutes: number;
  nextBlock: EnrichedMyDayBlock | null;
  minutesUntilNextBlock: number | null;
  dayStartTime: string;
  dayEndTime: string;
  dayScheduleProgressPct: number;
  dayTaskCompletionPct: number;
  totalTaskBlocks: number;
  completedTaskBlocks: number;
  remainingTaskBlocks: number;
  overdueBlocks: EnrichedMyDayBlock[];
  totalScheduledMinutes: number;
  elapsedScheduledMinutes: number;
  remainingScheduledMinutes: number;
  completedTaskMinutes: number;
  freeBufferMinutes: number;
  enrichedBlocks: EnrichedMyDayBlock[];
}

export function makeBlockId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `blk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Parses flexible time strings ("09:30", "14:15", "2:30 PM", "9am") into minutes since midnight (0..1439).
 */
export function parseTimeToMinutes(raw: string | undefined | null): number {
  if (!raw) return 9 * 60;
  const trimmed = raw.trim();

  // Check 12-hour format e.g. "2:30 PM", "9am", "12:15 am"
  const ampmMatch = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i.exec(trimmed);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const mins = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const period = ampmMatch[3].toLowerCase();
    if (period === "pm" && hours < 12) hours += 12;
    if (period === "am" && hours === 12) hours = 0;
    return (((hours * 60 + mins) % 1440) + 1440) % 1440;
  }

  // Standard 24-hour format "HH:mm"
  const hhmmMatch = /^(\d{1,2}):(\d{2})/.exec(trimmed);
  if (hhmmMatch) {
    const hours = parseInt(hhmmMatch[1], 10);
    const mins = parseInt(hhmmMatch[2], 10);
    if (!isNaN(hours) && !isNaN(mins)) {
      return (((hours * 60 + mins) % 1440) + 1440) % 1440;
    }
  }

  return 9 * 60;
}

export function minutesToTimeString(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function normalizeTimeString(
  raw: string | undefined | null,
  fallback = "09:00"
): string {
  if (!raw || !raw.trim()) return fallback;
  return minutesToTimeString(parseTimeToMinutes(raw));
}

export function formatTime12h(hhmm: string): string {
  const mins = parseTimeToMinutes(hhmm);
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatDurationCompact(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) return `${rounded}m`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function computeDurationMinutes(
  startTime: string,
  endTime: string
): number {
  const s = parseTimeToMinutes(startTime);
  const e = parseTimeToMinutes(endTime);
  if (e > s) return e - s;
  if (e < s) return e + 1440 - s;
  return 15;
}

export function addMinutesToTime(hhmm: string, deltaMinutes: number): string {
  return minutesToTimeString(parseTimeToMinutes(hhmm) + deltaMinutes);
}

export function getRoundedNowTime(date = new Date(), stepMinutes = 15): string {
  const total = date.getHours() * 60 + date.getMinutes();
  const rounded = Math.ceil(total / stepMinutes) * stepMinutes;
  return minutesToTimeString(rounded);
}

export function getLocalDateYMD(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isTaskDoneStatus(task: TaskItem | null | undefined): boolean {
  if (!task) return false;
  const s = (task.status || "").trim().toLowerCase();
  return s === "done" || s === "completed" || Boolean(task.completed_at);
}

export function isScheduleBlockCompleted(
  block: MyDayBlock,
  tasks: TaskItem[]
): boolean {
  if (block.taskId) {
    const linked = tasks.find((t) => t.id === block.taskId);
    if (linked) {
      return isTaskDoneStatus(linked);
    }
  }
  return Boolean(block.completed);
}

/**
 * Maps sequential blocks onto a monotonic minute axis so schedules crossing midnight
 * (e.g. 10:30 PM -> 1:30 AM) work seamlessly alongside normal daytime schedules.
 */
function buildMonotonicBlockAxis(blocks: MyDayBlock[]): Array<{
  block: MyDayBlock;
  startAbs: number;
  endAbs: number;
}> {
  if (blocks.length === 0) return [];
  let dayOffset = 0;
  let prevStartRaw = parseTimeToMinutes(blocks[0].startTime);

  return blocks.map((block, idx) => {
    const startRaw = parseTimeToMinutes(block.startTime);
    if (idx > 0 && startRaw < prevStartRaw - 360) {
      dayOffset += 1440;
    }
    prevStartRaw = startRaw;
    const startAbs = startRaw + dayOffset;
    const dur =
      block.durationMinutes > 0
        ? block.durationMinutes
        : computeDurationMinutes(block.startTime, block.endTime);
    const endAbs = startAbs + Math.max(5, dur);
    return { block, startAbs, endAbs };
  });
}

/**
 * Reorders blocks while optionally reflowing start/end times sequentially
 * so swapped or dragged components inherit chronological timeframes cleanly.
 */
export function reorderScheduleBlocks(
  originalBlocks: MyDayBlock[],
  reorderedBlocks: MyDayBlock[],
  autoCascadeTimes = true
): MyDayBlock[] {
  if (reorderedBlocks.length === 0) return [];
  if (!autoCascadeTimes || originalBlocks.length === 0) {
    return reorderedBlocks.map((b) => ({
      ...b,
      durationMinutes: computeDurationMinutes(b.startTime, b.endTime),
    }));
  }

  const origAxis = buildMonotonicBlockAxis(originalBlocks);
  const anchorStart = origAxis[0].startAbs;

  // Preserve intentional gaps between consecutive slots
  const slotGaps: number[] = [];
  for (let i = 0; i < origAxis.length - 1; i++) {
    const gap = Math.max(0, origAxis[i + 1].startAbs - origAxis[i].endAbs);
    slotGaps.push(gap);
  }

  let cursor = anchorStart;
  return reorderedBlocks.map((b, idx) => {
    const dur = Math.max(
      5,
      b.durationMinutes > 0
        ? b.durationMinutes
        : computeDurationMinutes(b.startTime, b.endTime)
    );
    const newStart = minutesToTimeString(cursor);
    const newEnd = minutesToTimeString(cursor + dur);
    cursor = cursor + dur + (slotGaps[idx] ?? 0);
    return {
      ...b,
      startTime: newStart,
      endTime: newEnd,
      durationMinutes: dur,
    };
  });
}

export function swapScheduleBlocks(
  blocks: MyDayBlock[],
  indexA: number,
  indexB: number,
  autoCascadeTimes = true
): MyDayBlock[] {
  if (
    indexA < 0 ||
    indexB < 0 ||
    indexA >= blocks.length ||
    indexB >= blocks.length ||
    indexA === indexB
  ) {
    return blocks;
  }
  const next = [...blocks];
  if (autoCascadeTimes) {
    const temp = next[indexA];
    next[indexA] = next[indexB];
    next[indexB] = temp;
    return reorderScheduleBlocks(blocks, next, true);
  } else {
    // Swap positions AND swap start times while keeping each task's own duration
    const blockA = next[indexA];
    const blockB = next[indexB];
    const durA =
      blockA.durationMinutes ||
      computeDurationMinutes(blockA.startTime, blockA.endTime);
    const durB =
      blockB.durationMinutes ||
      computeDurationMinutes(blockB.startTime, blockB.endTime);

    next[indexA] = {
      ...blockB,
      startTime: blockA.startTime,
      endTime: addMinutesToTime(blockA.startTime, durB),
      durationMinutes: durB,
    };
    next[indexB] = {
      ...blockA,
      startTime: blockB.startTime,
      endTime: addMinutesToTime(blockB.startTime, durA),
      durationMinutes: durA,
    };
    return next;
  }
}

export function shiftScheduleBlocks(
  blocks: MyDayBlock[],
  deltaMinutes: number
): MyDayBlock[] {
  return blocks.map((b) => {
    const dur =
      b.durationMinutes || computeDurationMinutes(b.startTime, b.endTime);
    const nextStart = addMinutesToTime(b.startTime, deltaMinutes);
    const nextEnd = addMinutesToTime(nextStart, dur);
    return {
      ...b,
      startTime: nextStart,
      endTime: nextEnd,
      durationMinutes: dur,
    };
  });
}

export function cascadeFromBlockIndex(
  blocks: MyDayBlock[],
  changedIndex: number
): MyDayBlock[] {
  if (changedIndex < 0 || changedIndex >= blocks.length) return blocks;
  const result = blocks.map((b) => ({ ...b }));
  let cursor =
    parseTimeToMinutes(result[changedIndex].startTime) +
    Math.max(
      5,
      computeDurationMinutes(
        result[changedIndex].startTime,
        result[changedIndex].endTime
      )
    );
  result[changedIndex].durationMinutes = computeDurationMinutes(
    result[changedIndex].startTime,
    result[changedIndex].endTime
  );

  for (let i = changedIndex + 1; i < result.length; i++) {
    const dur = Math.max(
      5,
      result[i].durationMinutes ||
        computeDurationMinutes(result[i].startTime, result[i].endTime)
    );
    result[i].startTime = minutesToTimeString(cursor);
    result[i].endTime = minutesToTimeString(cursor + dur);
    result[i].durationMinutes = dur;
    cursor += dur;
  }
  return result;
}

function getPriorityRank(priority: string | undefined): number {
  const p = (priority || "").toLowerCase();
  if (p === "urgent") return 0;
  if (p === "high") return 1;
  if (p === "medium") return 2;
  if (p === "low") return 3;
  return 2;
}

export function recommendTaskMinutes(task: TaskItem): number {
  if (task.estimated_minutes && task.estimated_minutes > 0) {
    return Math.min(240, Math.max(10, Math.round(task.estimated_minutes)));
  }
  const p = (task.priority || "").toLowerCase();
  const titleLower = task.title.toLowerCase();
  if (
    titleLower.includes("essay") ||
    titleLower.includes("exam") ||
    titleLower.includes("project") ||
    titleLower.includes("lab")
  ) {
    return 60;
  }
  if (p === "urgent" || p === "high") return 45;
  if (p === "low") return 20;
  return 30;
}

/**
 * Smart priority + time-recommendation scheduler (serves as deterministic fallback
 * and baseline if AI key is missing or network times out).
 */
export function smartHeuristicArrange(params: {
  tasks: TaskItem[];
  startTime: string;
  endTime: string;
  includeBreaks?: boolean;
}): { blocks: MyDayBlock[]; summary: string } {
  const { tasks, startTime, endTime, includeBreaks = true } = params;
  const cleanTasks = tasks.filter((t) => !t.custom_properties?.is_header);
  if (cleanTasks.length === 0) {
    return { blocks: [], summary: "No tasks selected to schedule." };
  }

  const windowMinutes = computeDurationMinutes(startTime, endTime);
  const sorted = [...cleanTasks].sort((a, b) => {
    const pr = getPriorityRank(a.priority) - getPriorityRank(b.priority);
    if (pr !== 0) return pr;
    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return (a.order_index ?? 0) - (b.order_index ?? 0);
  });

  const rawDurations = sorted.map((t) => recommendTaskMinutes(t));
  const totalRaw = rawDurations.reduce((acc, v) => acc + v, 0);

  // Scale durations cleanly if total task minutes exceed available window
  const scale =
    totalRaw > windowMinutes && totalRaw > 0
      ? Math.max(0.35, windowMinutes / totalRaw)
      : 1;

  const blocks: MyDayBlock[] = [];
  let cursor = parseTimeToMinutes(startTime);
  let continuousWork = 0;

  sorted.forEach((task, idx) => {
    const rawMin = rawDurations[idx];
    const scaledMin =
      scale < 1
        ? Math.max(10, Math.round((rawMin * scale) / 5) * 5)
        : rawMin;

    // Insert a 10m recharge break after >= 85m of continuous focus if room permits
    if (
      includeBreaks &&
      scale === 1 &&
      continuousWork >= 85 &&
      idx < sorted.length &&
      totalRaw + 15 <= windowMinutes
    ) {
      const bStart = minutesToTimeString(cursor);
      const bEnd = minutesToTimeString(cursor + 10);
      blocks.push({
        id: makeBlockId(),
        taskId: null,
        title: "Short Recharge Break",
        startTime: bStart,
        endTime: bEnd,
        durationMinutes: 10,
        category: "Break",
        priority: "Low",
        notes: "Step away, hydrate, reset focus",
        completed: false,
        isBreak: true,
      });
      cursor += 10;
      continuousWork = 0;
    }

    const sTime = minutesToTimeString(cursor);
    const eTime = minutesToTimeString(cursor + scaledMin);
    blocks.push({
      id: makeBlockId(),
      taskId: task.id,
      title: task.title,
      startTime: sTime,
      endTime: eTime,
      durationMinutes: scaledMin,
      category: task.type || "General",
      priority: task.priority || "Medium",
      notes: task.notes || "",
      completed: isTaskDoneStatus(task),
      isBreak: false,
    });

    cursor += scaledMin;
    continuousWork += scaledMin;
  });

  const summary =
    scale < 1
      ? `Arranged ${sorted.length} tasks between ${formatTime12h(startTime)} and ${formatTime12h(minutesToTimeString(cursor))} (proportioned to fit your ${formatDurationCompact(windowMinutes)} window, prioritizing Urgent & High items first).`
      : `Arranged ${sorted.length} tasks starting at ${formatTime12h(startTime)} based on priority, deadlines, and estimated durations.`;

  return { blocks, summary };
}

/**
 * Computes real-time clock telemetry, Current Task status bar %, Overall Day Schedule %,
 * and rich logistics for both the MY DAY hero centerpiece and the Gemini Chat tool.
 */
export function computeMyDayLiveTelemetry(
  schedule: MyDaySchedule | null | undefined,
  tasks: TaskItem[],
  nowMinutesOfDay: number
): MyDayLiveTelemetry {
  const rawBlocks = schedule?.blocks || [];
  if (rawBlocks.length === 0) {
    return {
      hasSchedule: false,
      phase: "empty",
      currentBlock: null,
      currentBlockIndex: -1,
      currentTaskProgressPct: 0,
      currentTaskElapsedMinutes: 0,
      currentTaskRemainingMinutes: 0,
      nextBlock: null,
      minutesUntilNextBlock: null,
      dayStartTime: schedule?.dayStartTime || "09:00",
      dayEndTime: schedule?.dayEndTime || "17:00",
      dayScheduleProgressPct: 0,
      dayTaskCompletionPct: 0,
      totalTaskBlocks: 0,
      completedTaskBlocks: 0,
      remainingTaskBlocks: 0,
      overdueBlocks: [],
      totalScheduledMinutes: 0,
      elapsedScheduledMinutes: 0,
      remainingScheduledMinutes: 0,
      completedTaskMinutes: 0,
      freeBufferMinutes: 0,
      enrichedBlocks: [],
    };
  }

  const axis = buildMonotonicBlockAxis(rawBlocks);
  const firstStartAbs = axis[0].startAbs;
  const lastEndAbs = axis[axis.length - 1].endAbs;

  // Align nowMinutesOfDay with monotonic axis if schedule crosses midnight
  let nowAbs = nowMinutesOfDay;
  if (lastEndAbs >= 1440 && nowMinutesOfDay < firstStartAbs - 360) {
    nowAbs = nowMinutesOfDay + 1440;
  }

  const enrichedBlocks: EnrichedMyDayBlock[] = axis.map(
    ({ block, startAbs, endAbs }, index) => {
      const linkedTask = block.taskId
        ? tasks.find((t) => t.id === block.taskId) || null
        : null;
      const isCompleted = isScheduleBlockCompleted(block, tasks);
      const dur = Math.max(1, endAbs - startAbs);

      let timeState: "past" | "active" | "upcoming" = "upcoming";
      let liveProgressPct = 0;

      if (nowAbs >= endAbs) {
        timeState = "past";
        liveProgressPct = 100;
      } else if (nowAbs >= startAbs && nowAbs < endAbs) {
        timeState = "active";
        liveProgressPct = Math.min(
          100,
          Math.max(0, ((nowAbs - startAbs) / dur) * 100)
        );
      } else {
        timeState = "upcoming";
        liveProgressPct = 0;
      }

      return {
        ...block,
        title: linkedTask ? linkedTask.title : block.title,
        category: linkedTask ? linkedTask.type : block.category,
        priority: linkedTask ? linkedTask.priority : block.priority,
        durationMinutes: dur,
        index,
        startAbs,
        endAbs,
        isCompleted,
        timeState,
        liveProgressPct,
        linkedTask,
      };
    }
  );

  const currentBlockIndex = enrichedBlocks.findIndex(
    (b) => b.timeState === "active"
  );
  const currentBlock =
    currentBlockIndex >= 0 ? enrichedBlocks[currentBlockIndex] : null;

  const nextBlock =
    enrichedBlocks.find((b) => b.startAbs > nowAbs) || null;
  const minutesUntilNextBlock = nextBlock
    ? Math.max(0, Math.ceil(nextBlock.startAbs - nowAbs))
    : null;

  let phase: MyDayLiveTelemetry["phase"] = "active_block";
  if (nowAbs < firstStartAbs) {
    phase = "before_day";
  } else if (nowAbs >= lastEndAbs) {
    phase = "day_complete";
  } else if (currentBlock) {
    phase = "active_block";
  } else {
    phase = "between_blocks";
  }

  const currentTaskProgressPct = currentBlock
    ? currentBlock.liveProgressPct
    : phase === "day_complete"
    ? 100
    : 0;

  const currentTaskElapsedMinutes = currentBlock
    ? Math.max(0, Math.floor(nowAbs - currentBlock.startAbs))
    : 0;

  const currentTaskRemainingMinutes = currentBlock
    ? Math.max(0, Math.ceil(currentBlock.endAbs - nowAbs))
    : 0;

  // Compute total scheduled minutes & how much of the scheduled day has elapsed
  let totalScheduledMinutes = 0;
  let elapsedScheduledMinutes = 0;
  let completedTaskMinutes = 0;

  for (const b of enrichedBlocks) {
    totalScheduledMinutes += b.durationMinutes;
    if (nowAbs >= b.endAbs) {
      elapsedScheduledMinutes += b.durationMinutes;
    } else if (nowAbs > b.startAbs) {
      elapsedScheduledMinutes += nowAbs - b.startAbs;
    }
    if (!b.isBreak && b.isCompleted) {
      completedTaskMinutes += b.durationMinutes;
    }
  }

  const dayScheduleProgressPct =
    totalScheduledMinutes > 0
      ? Math.min(
          100,
          Math.max(0, (elapsedScheduledMinutes / totalScheduledMinutes) * 100)
        )
      : 0;

  const taskOnlyBlocks = enrichedBlocks.filter((b) => !b.isBreak);
  const totalTaskBlocks = taskOnlyBlocks.length;
  const completedTaskBlocks = taskOnlyBlocks.filter((b) => b.isCompleted).length;
  const remainingTaskBlocks = Math.max(0, totalTaskBlocks - completedTaskBlocks);

  const dayTaskCompletionPct =
    totalTaskBlocks > 0
      ? Math.round((completedTaskBlocks / totalTaskBlocks) * 100)
      : 0;

  const overdueBlocks = taskOnlyBlocks.filter(
    (b) => b.timeState === "past" && !b.isCompleted
  );

  const spanMinutes = Math.max(0, lastEndAbs - firstStartAbs);
  const freeBufferMinutes = Math.max(0, spanMinutes - totalScheduledMinutes);
  const remainingScheduledMinutes = Math.max(
    0,
    Math.round(totalScheduledMinutes - elapsedScheduledMinutes)
  );

  return {
    hasSchedule: true,
    phase,
    currentBlock,
    currentBlockIndex,
    currentTaskProgressPct,
    currentTaskElapsedMinutes,
    currentTaskRemainingMinutes,
    nextBlock,
    minutesUntilNextBlock,
    dayStartTime: enrichedBlocks[0].startTime,
    dayEndTime: enrichedBlocks[enrichedBlocks.length - 1].endTime,
    dayScheduleProgressPct,
    dayTaskCompletionPct,
    totalTaskBlocks,
    completedTaskBlocks,
    remainingTaskBlocks,
    overdueBlocks,
    totalScheduledMinutes,
    elapsedScheduledMinutes: Math.round(elapsedScheduledMinutes),
    remainingScheduledMinutes,
    completedTaskMinutes,
    freeBufferMinutes,
    enrichedBlocks,
  };
}
