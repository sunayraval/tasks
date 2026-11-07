"use client";

import React, { useEffect, useState, useMemo } from "react";
import { MyDaySchedule, TaskItem, WorkspaceConfig } from "@/types/taskit";
import {
  computeMyDayLiveTelemetry,
  EnrichedMyDayBlock,
  formatDurationCompact,
  formatTime12h,
} from "@/utils/myDayUtils";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock,
  Coffee,
  Flame,
  Sparkles,
} from "lucide-react";

interface MyDayStatusBannerProps {
  schedule: MyDaySchedule | null | undefined;
  tasks: TaskItem[];
  workspaceConfig?: WorkspaceConfig;
  variant?: "hero" | "chat";
  onToggleBlockComplete?: (block: EnrichedMyDayBlock) => void;
  onOpenMyDay?: () => void;
}

export const MyDayStatusBanner: React.FC<MyDayStatusBannerProps> = ({
  schedule,
  tasks,
  variant = "hero",
  onToggleBlockComplete,
  onOpenMyDay,
}) => {
  // Hydrate live clock safely to prevent SSR/CSR mismatch
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const effectiveDate = useMemo(() => now ?? new Date(), [now]);

  const nowExactMinutes =
    effectiveDate.getHours() * 60 +
    effectiveDate.getMinutes() +
    effectiveDate.getSeconds() / 60;

  const telemetry = useMemo(
    () => computeMyDayLiveTelemetry(schedule, tasks, nowExactMinutes),
    [schedule, tasks, nowExactMinutes]
  );

  // Format live clock parts
  const hours24 = effectiveDate.getHours();
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minutesStr = String(effectiveDate.getMinutes()).padStart(2, "0");
  const secondsStr = String(effectiveDate.getSeconds()).padStart(2, "0");
  const ampm = hours24 >= 12 ? "PM" : "AM";
  const dateLabel = effectiveDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const phaseBadge = useMemo(() => {
    if (!telemetry.hasSchedule) {
      return {
        label: "No Schedule Built Yet",
        classes: "border-white/15 bg-white/5 text-white/65",
        dot: "bg-white/40",
      };
    }
    switch (telemetry.phase) {
      case "active_block":
        return {
          label: telemetry.currentBlock?.isBreak
            ? "Active Recharge Break"
            : "Live Focus Block",
          classes: "border-primary/45 bg-primary/15 text-highlight",
          dot: "bg-primary animate-pulse",
        };
      case "before_day":
        return {
          label: `Starts at ${formatTime12h(telemetry.dayStartTime)}`,
          classes: "border-sky-400/40 bg-sky-500/15 text-sky-200",
          dot: "bg-sky-400",
        };
      case "between_blocks":
        return {
          label: "Between Scheduled Blocks",
          classes: "border-amber-400/40 bg-amber-500/15 text-amber-200",
          dot: "bg-amber-400",
        };
      case "day_complete":
        return {
          label: "Day Schedule Window Finished",
          classes: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
          dot: "bg-emerald-400",
        };
      default:
        return {
          label: "Schedule Ready",
          classes: "border-white/15 bg-white/5 text-white/75",
          dot: "bg-white/50",
        };
    }
  }, [telemetry]);

  const currentPctRounded = Math.round(telemetry.currentTaskProgressPct);
  const dayPctRounded = Math.round(telemetry.dayScheduleProgressPct);

  // ---------------------------------------------------------------------------
  // VARIANT: COMPACT INTERACTIVE CHAT EMBED
  // ---------------------------------------------------------------------------
  if (variant === "chat") {
    return (
      <div className="rounded-2xl border border-white/15 bg-[#14161c]/95 p-4 sm:p-5 shadow-2xl space-y-4 backdrop-blur-2xl">
        {/* Top Row: Badge + Centered Live Time + Open Tab CTA */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="inline-flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${phaseBadge.classes}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${phaseBadge.dot}`} />
              <span>{phaseBadge.label}</span>
            </span>
          </div>

          <div className="flex items-baseline gap-1 font-mono">
            <Clock className="w-3.5 h-3.5 text-primary mr-1 self-center" />
            <span className="text-lg font-extrabold tracking-tight text-white">
              {now ? `${hours12}:${minutesStr}` : "--:--"}
            </span>
            <span className="text-xs font-semibold text-white/45">
              {now ? `:${secondsStr} ${ampm}` : ""}
            </span>
          </div>

          {onOpenMyDay && (
            <button
              type="button"
              onClick={onOpenMyDay}
              className="inline-flex items-center gap-1 rounded-xl border border-primary/35 bg-primary/15 hover:bg-primary/25 px-3 py-1 text-xs font-semibold text-highlight transition-colors"
            >
              <span>Open my day</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {!telemetry.hasSchedule ? (
          <div className="py-3 text-center text-xs text-white/60">
            Your my day schedule is currently empty. Ask me to auto-arrange your
            tasks for today or open the my day tab to build it manually!
          </div>
        ) : (
          <>
            {/* Status Bar 1: Current Task */}
            <div className="rounded-xl border border-white/10 bg-black/40 p-3.5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-primary">
                    {telemetry.currentBlock
                      ? "Current Scheduled Task"
                      : telemetry.nextBlock
                      ? "Up Next on Schedule"
                      : "Schedule Status"}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    {telemetry.currentBlock && onToggleBlockComplete && !telemetry.currentBlock.isBreak && (
                      <button
                        type="button"
                        onClick={() =>
                          onToggleBlockComplete(telemetry.currentBlock!)
                        }
                        className="text-primary hover:scale-110 transition-transform shrink-0"
                        title="Toggle task completion"
                      >
                        {telemetry.currentBlock.isCompleted ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Circle className="w-4 h-4 text-white/50 hover:text-primary" />
                        )}
                      </button>
                    )}
                    <span
                      className={`text-sm font-bold truncate ${
                        telemetry.currentBlock?.isCompleted
                          ? "line-through text-white/50"
                          : "text-white"
                      }`}
                    >
                      {telemetry.currentBlock
                        ? telemetry.currentBlock.title
                        : telemetry.nextBlock
                        ? `${telemetry.nextBlock.title} (in ${formatDurationCompact(
                            telemetry.minutesUntilNextBlock || 0
                          )})`
                        : "All scheduled time slots finished!"}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-extrabold font-mono text-highlight">
                    {currentPctRounded}%
                  </div>
                  <div className="text-[10px] text-white/50 font-mono">
                    {telemetry.currentBlock
                      ? `${formatTime12h(
                          telemetry.currentBlock.startTime
                        )} – ${formatTime12h(telemetry.currentBlock.endTime)}`
                      : telemetry.nextBlock
                      ? `Starts ${formatTime12h(telemetry.nextBlock.startTime)}`
                      : `${formatTime12h(telemetry.dayEndTime)}`}
                  </div>
                </div>
              </div>

              <progress
                className="taskit-progress w-full h-2.5 block"
                value={Math.min(100, Math.max(0, telemetry.currentTaskProgressPct))}
                max={100}
                aria-label="Current scheduled task progress"
              />

              {telemetry.currentBlock && (
                <div className="flex items-center justify-between text-[11px] text-white/55">
                  <span>
                    {formatDurationCompact(telemetry.currentTaskElapsedMinutes)}{" "}
                    elapsed
                  </span>
                  <span>
                    {formatDurationCompact(telemetry.currentTaskRemainingMinutes)}{" "}
                    remaining
                  </span>
                </div>
              )}
            </div>

            {/* Status Bar 2: Overall Day Schedule */}
            <div className="rounded-xl border border-white/10 bg-black/30 p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/55">
                    Entire Day Schedule Progress
                  </div>
                  <div className="text-xs text-white/80 mt-0.5">
                    <span className="font-semibold text-white">
                      {telemetry.completedTaskBlocks}/{telemetry.totalTaskBlocks}
                    </span>{" "}
                    tasks done •{" "}
                    <span className="text-white/65">
                      {formatTime12h(telemetry.dayStartTime)} –{" "}
                      {formatTime12h(telemetry.dayEndTime)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-extrabold font-mono text-primary">
                    {dayPctRounded}%
                  </span>
                  <div className="text-[10px] text-white/45">
                    {formatDurationCompact(telemetry.remainingScheduledMinutes)}{" "}
                    left
                  </div>
                </div>
              </div>

              <progress
                className="taskit-progress w-full h-2 block"
                value={Math.min(100, Math.max(0, telemetry.dayScheduleProgressPct))}
                max={100}
                aria-label="Overall day schedule progress"
              />
            </div>

            {/* Compact Plan Timeline List */}
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {telemetry.enrichedBlocks.map((b) => {
                const isActive = b.timeState === "active";
                return (
                  <div
                    key={b.id}
                    className={`flex items-center justify-between gap-2.5 rounded-xl border px-3 py-2 text-xs transition-colors ${
                      isActive
                        ? "border-primary/50 bg-primary/15 text-white"
                        : b.isCompleted
                        ? "border-emerald-500/25 bg-emerald-500/[0.07] text-white/65"
                        : "border-white/[0.07] bg-white/[0.02] text-white/80"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[11px] text-white/55 shrink-0 w-[122px]">
                        {formatTime12h(b.startTime)} – {formatTime12h(b.endTime)}
                      </span>
                      <span
                        className={`truncate font-medium ${
                          b.isCompleted ? "line-through text-white/45" : ""
                        }`}
                      >
                        {b.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono text-white/45">
                        {formatDurationCompact(b.durationMinutes)}
                      </span>
                      {isActive ? (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-extrabold uppercase text-black">
                          NOW
                        </span>
                      ) : b.isCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : b.timeState === "past" && !b.isBreak ? (
                        <span className="rounded-full bg-amber-500/20 border border-amber-400/35 px-1.5 py-0.5 text-[9px] font-semibold text-amber-200">
                          OVERDUE
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VARIANT: HERO CENTERPIECE ON "MY DAY" TAB
  // ---------------------------------------------------------------------------
  return (
    <section className="relative overflow-hidden rounded-3xl border theme-panel p-6 sm:p-8 shadow-2xl backdrop-blur-2xl">
      {/* Subtle Ambient Radial Glow Behind Center Clock */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[520px] rounded-full blur-[110px] opacity-20"
        style={{ backgroundColor: "var(--primary)" }}
      />

      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Live Phase Pill */}
        <div
          className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-xs font-semibold tracking-wide ${phaseBadge.classes}`}
          role="status"
          aria-live="polite"
        >
          <span className={`h-2 w-2 rounded-full ${phaseBadge.dot}`} />
          <span>{phaseBadge.label}</span>
        </div>

        {/* Centerpiece Live Clock */}
        <div className="mt-4 flex items-baseline justify-center gap-2 select-none font-mono">
          <span className="text-5xl sm:text-7xl font-black tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
            {now ? `${hours12}:${minutesStr}` : "--:--"}
          </span>
          <div className="flex flex-col items-start text-left">
            <span className="text-lg sm:text-2xl font-bold text-primary leading-none">
              {now ? ampm : ""}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-white/40 leading-tight mt-0.5">
              {now ? `:${secondsStr}` : ""}
            </span>
          </div>
        </div>

        <p className="mt-1.5 text-xs sm:text-sm font-medium text-white/55">
          {dateLabel}
          {telemetry.hasSchedule && (
            <span>
              {" "}
              • Planned Window:{" "}
              <strong className="text-white/80 font-mono">
                {formatTime12h(telemetry.dayStartTime)} –{" "}
                {formatTime12h(telemetry.dayEndTime)}
              </strong>
            </span>
          )}
        </p>

        {/* Dual Status Bars Container */}
        <div className="mt-7 w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-4 text-left">
          {/* STATUS BAR 1: CURRENT TASK PROGRESS */}
          <div className="rounded-2xl border border-white/15 bg-black/45 p-5 flex flex-col justify-between space-y-3.5 shadow-inner">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                  {telemetry.currentBlock?.isBreak ? (
                    <Coffee className="w-3.5 h-3.5" />
                  ) : (
                    <Flame className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {telemetry.currentBlock
                      ? "Current Task You Should Be Working On"
                      : telemetry.nextBlock
                      ? "Up Next in Schedule"
                      : "Current Task Status"}
                  </span>
                </div>

                {telemetry.currentBlock ? (
                  <div className="mt-1.5 space-y-1">
                    <h2
                      className={`text-base sm:text-lg font-bold leading-snug truncate ${
                        telemetry.currentBlock.isCompleted
                          ? "line-through text-white/50"
                          : "text-white"
                      }`}
                      title={telemetry.currentBlock.title}
                    >
                      {telemetry.currentBlock.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
                      <span className="font-mono text-highlight/90">
                        {formatTime12h(telemetry.currentBlock.startTime)} –{" "}
                        {formatTime12h(telemetry.currentBlock.endTime)}
                      </span>
                      <span>•</span>
                      <span>
                        {formatDurationCompact(
                          telemetry.currentBlock.durationMinutes
                        )}{" "}
                        slot
                      </span>
                      {telemetry.currentBlock.priority && (
                        <span className="rounded-md border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-white/80">
                          {telemetry.currentBlock.priority}
                        </span>
                      )}
                    </div>
                  </div>
                ) : telemetry.nextBlock ? (
                  <div className="mt-1.5 space-y-1">
                    <h2 className="text-base sm:text-lg font-bold text-white/90 truncate">
                      {telemetry.nextBlock.title}
                    </h2>
                    <p className="text-xs text-white/55">
                      Starts at{" "}
                      <span className="font-mono text-highlight">
                        {formatTime12h(telemetry.nextBlock.startTime)}
                      </span>{" "}
                      (in{" "}
                      {formatDurationCompact(
                        telemetry.minutesUntilNextBlock || 0
                      )}
                      )
                    </p>
                  </div>
                ) : telemetry.hasSchedule ? (
                  <div className="mt-1.5 space-y-1">
                    <h2 className="text-base sm:text-lg font-bold text-emerald-300">
                      Day&apos;s Scheduled Window Complete
                    </h2>
                    <p className="text-xs text-white/55">
                      Finished at {formatTime12h(telemetry.dayEndTime)}
                    </p>
                  </div>
                ) : (
                  <div className="mt-1.5 space-y-1">
                    <h2 className="text-base sm:text-lg font-semibold text-white/70">
                      No active block right now
                    </h2>
                    <p className="text-xs text-white/45">
                      Select tasks below via Manual Build or AI Auto-Arrange to
                      start tracking live progress.
                    </p>
                  </div>
                )}
              </div>

              {/* Percentage + Quick Complete Action */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className="text-2xl sm:text-3xl font-black font-mono text-highlight leading-none">
                  {currentPctRounded}%
                </span>
                {telemetry.currentBlock &&
                  !telemetry.currentBlock.isBreak &&
                  onToggleBlockComplete && (
                    <button
                      type="button"
                      onClick={() =>
                        onToggleBlockComplete(telemetry.currentBlock!)
                      }
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                        telemetry.currentBlock.isCompleted
                          ? "border-emerald-400/45 bg-emerald-500/20 text-emerald-200"
                          : "border-white/15 bg-white/10 hover:bg-primary hover:text-black hover:border-primary text-white"
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {telemetry.currentBlock.isCompleted
                          ? "Done"
                          : "Mark Done"}
                      </span>
                    </button>
                  )}
              </div>
            </div>

            {/* Progress Track for Current Task */}
            <div className="space-y-1.5">
              <progress
                className="taskit-progress w-full h-3 block"
                value={Math.min(100, Math.max(0, telemetry.currentTaskProgressPct))}
                max={100}
                aria-label="Current task timeframe completion"
              />
              <div className="flex items-center justify-between text-[11px] font-mono text-white/55">
                <span>
                  {telemetry.currentBlock
                    ? `${formatDurationCompact(
                        telemetry.currentTaskElapsedMinutes
                      )} done`
                    : "0m elapsed"}
                </span>
                <span>
                  {telemetry.currentBlock
                    ? `${formatDurationCompact(
                        telemetry.currentTaskRemainingMinutes
                      )} left in slot`
                    : telemetry.hasSchedule
                    ? `${telemetry.totalTaskBlocks} scheduled tasks`
                    : "Build schedule below"}
                </span>
              </div>
            </div>
          </div>

          {/* STATUS BAR 2: OVERALL DAY SCHEDULE PROGRESS */}
          <div className="rounded-2xl border border-white/15 bg-black/45 p-5 flex flex-col justify-between space-y-3.5 shadow-inner">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/65">
                  <CalendarClock className="w-3.5 h-3.5 text-primary" />
                  <span>Entire Day Schedule Progress</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {telemetry.hasSchedule ? (
                    <>
                      {telemetry.completedTaskBlocks} of{" "}
                      {telemetry.totalTaskBlocks} Tasks Completed
                    </>
                  ) : (
                    "0 Tasks Scheduled"
                  )}
                </h3>
                <p className="text-xs text-white/55">
                  {telemetry.hasSchedule ? (
                    <>
                      {formatDurationCompact(telemetry.elapsedScheduledMinutes)}{" "}
                      elapsed of{" "}
                      {formatDurationCompact(telemetry.totalScheduledMinutes)}{" "}
                      total scheduled work
                    </>
                  ) : (
                    "Add tasks or run AI Auto-Arrange to see your full day progress"
                  )}
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-2xl sm:text-3xl font-black font-mono text-primary leading-none">
                  {dayPctRounded}%
                </span>
                <div className="text-[11px] text-white/45 font-mono mt-1">
                  {telemetry.hasSchedule
                    ? `${telemetry.dayTaskCompletionPct}% checked off`
                    : "0% done"}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <progress
                className="taskit-progress w-full h-3 block"
                value={Math.min(100, Math.max(0, telemetry.dayScheduleProgressPct))}
                max={100}
                aria-label="Entire day schedule completion"
              />

              {/* Proportional Multi-Block Segmented Strip */}
              {telemetry.hasSchedule && telemetry.totalScheduledMinutes > 0 && (
                <div
                  className="flex w-full h-2 rounded-full overflow-hidden gap-0.5 bg-white/5"
                  title="Proportional breakdown of your scheduled blocks"
                >
                  {telemetry.enrichedBlocks.map((b) => {
                    const widthPct = Math.max(
                      3,
                      (b.durationMinutes / telemetry.totalScheduledMinutes) * 100
                    );
                    return (
                      <div
                        key={b.id}
                        style={{ width: `${widthPct}%` }}
                        title={`${b.title} (${formatTime12h(
                          b.startTime
                        )} – ${formatTime12h(b.endTime)})`}
                        className={`h-full transition-all ${
                          b.isCompleted
                            ? "bg-emerald-400"
                            : b.timeState === "active"
                            ? "bg-primary animate-pulse"
                            : b.timeState === "past"
                            ? "bg-amber-400/75"
                            : b.isBreak
                            ? "bg-white/20"
                            : "bg-white/15"
                        }`}
                      />
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-white/55">
                <span>
                  {telemetry.hasSchedule
                    ? `${formatDurationCompact(
                        telemetry.remainingScheduledMinutes
                      )} schedule time left`
                    : "Ready"}
                </span>
                {telemetry.overdueBlocks.length > 0 ? (
                  <span className="inline-flex items-center gap-1 text-amber-300 font-sans font-semibold">
                    <AlertTriangle className="w-3 h-3" />
                    {telemetry.overdueBlocks.length} past slot
                    {telemetry.overdueBlocks.length > 1 ? "s" : ""} unchecked
                  </span>
                ) : schedule?.aiSummary ? (
                  <span className="inline-flex items-center gap-1 text-highlight/80 font-sans truncate max-w-[230px]">
                    <Sparkles className="w-3 h-3 shrink-0" />
                    <span className="truncate">AI-arranged plan active</span>
                  </span>
                ) : (
                  <span>
                    {telemetry.freeBufferMinutes > 0
                      ? `${formatDurationCompact(
                          telemetry.freeBufferMinutes
                        )} buffer gaps`
                      : "Back-to-back flow"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
