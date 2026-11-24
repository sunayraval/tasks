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
import { Badge, Button, Card, Progress, Text, Title } from "@/components/tailus-ui";

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
  // Hydrate live clock safely & pause 1s timer when tab is backgrounded
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    let intervalId: number | null = null;

    const startTimer = () => {
      if (intervalId !== null) return;
      intervalId = window.setInterval(() => {
        if (!document.hidden) {
          setNow(new Date());
        }
      }, 1000);
    };

    const stopTimer = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        stopTimer();
      } else {
        setNow(new Date());
        startTimer();
      }
    };

    if (!document.hidden) startTimer();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopTimer();
      document.removeEventListener("visibilitychange", onVisibility);
    };
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
        intent: "gray" as const,
        dot: "bg-gray-400",
      };
    }
    switch (telemetry.phase) {
      case "active_block":
        return {
          label: telemetry.currentBlock?.isBreak
            ? "Active Recharge Break"
            : "Live Focus Block",
          intent: "primary" as const,
          dot: "bg-primary-400 animate-pulse",
        };
      case "before_day":
        return {
          label: `Starts at ${formatTime12h(telemetry.dayStartTime)}`,
          intent: "info" as const,
          dot: "bg-info-400",
        };
      case "between_blocks":
        return {
          label: "Between Scheduled Blocks",
          intent: "warning" as const,
          dot: "bg-warning-400",
        };
      case "day_complete":
        return {
          label: "Day Schedule Window Finished",
          intent: "success" as const,
          dot: "bg-success-400",
        };
      default:
        return {
          label: "Schedule Ready",
          intent: "gray" as const,
          dot: "bg-gray-400",
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
      <Card
        variant="mixed"
        fancy
        className="p-4 sm:p-5 space-y-4 backdrop-blur-2xl"
      >
        {/* Top Row: Badge + Centered Live Time + Open Tab CTA */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[--ui-border-color] pb-3">
          <Badge
            variant="soft"
            intent={phaseBadge.intent}
            size="sm"
            className="inline-flex items-center gap-1.5 rounded-full"
          >
            <span className={`size-1.5 rounded-full ${phaseBadge.dot}`} />
            <span>{phaseBadge.label}</span>
          </Badge>

          <div className="flex items-baseline gap-1 font-mono">
            <Clock className="size-3.5 text-primary-400 mr-1 self-center" />
            <span className="text-lg font-bold tracking-tight text-title">
              {now ? `${hours12}:${minutesStr}` : "--:--"}
            </span>
            <span className="text-xs font-medium text-caption">
              {now ? `:${secondsStr} ${ampm}` : ""}
            </span>
          </div>

          {onOpenMyDay && (
            <Button.Root
              variant="soft"
              intent="primary"
              size="xs"
              onClick={onOpenMyDay}
            >
              <Button.Label>Open my day</Button.Label>
              <Button.Icon type="trailing" size="xs">
                <ArrowRight />
              </Button.Icon>
            </Button.Root>
          )}
        </div>

        {!telemetry.hasSchedule ? (
          <div className="py-3 text-center text-xs text-caption">
            Your my day schedule is currently empty. Ask me to auto-arrange your
            tasks for today or open the my day tab to build it manually!
          </div>
        ) : (
          <>
            {/* Status Bar 1: Current Task */}
            <Card variant="soft" className="border border-[--ui-border-color] p-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-primary-400">
                    {telemetry.currentBlock
                      ? "Current Scheduled Task"
                      : telemetry.nextBlock
                      ? "Up Next on Schedule"
                      : "Schedule Status"}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    {telemetry.currentBlock &&
                      onToggleBlockComplete &&
                      !telemetry.currentBlock.isBreak && (
                        <button
                          type="button"
                          onClick={() =>
                            onToggleBlockComplete(telemetry.currentBlock!)
                          }
                          className="text-primary-400 hover:scale-110 transition-transform shrink-0"
                          title="Toggle task completion"
                        >
                          {telemetry.currentBlock.isCompleted ? (
                            <CheckCircle2 className="size-4 text-success-400" />
                          ) : (
                            <Circle className="size-4 text-caption hover:text-primary-400" />
                          )}
                        </button>
                      )}
                    <span
                      className={`text-sm font-semibold truncate ${
                        telemetry.currentBlock?.isCompleted
                          ? "line-through text-caption"
                          : "text-title"
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
                  <div className="text-sm font-bold font-mono text-primary-300">
                    {currentPctRounded}%
                  </div>
                  <div className="text-[10px] text-caption font-mono">
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

              <Progress.Root
                value={currentPctRounded}
                size="sm"
                variant="soft"
                aria-label="Current scheduled task progress"
              >
                <Progress.Indicator
                  intent="primary"
                  style={{
                    transform: `translateX(-${100 - Math.min(100, Math.max(0, currentPctRounded))}%)`,
                  }}
                />
              </Progress.Root>

              {telemetry.currentBlock && (
                <div className="flex items-center justify-between text-[11px] text-caption">
                  <span>
                    {formatDurationCompact(telemetry.currentTaskElapsedMinutes)}{" "}
                    elapsed
                  </span>
                  <span>
                    {formatDurationCompact(
                      telemetry.currentTaskRemainingMinutes
                    )}{" "}
                    remaining
                  </span>
                </div>
              )}
            </Card>

            {/* Status Bar 2: Overall Day Schedule */}
            <Card variant="soft" className="border border-[--ui-border-color] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-caption">
                    Entire Day Schedule Progress
                  </div>
                  <div className="text-xs text-body mt-0.5">
                    <span className="font-semibold text-title">
                      {telemetry.completedTaskBlocks}/{telemetry.totalTaskBlocks}
                    </span>{" "}
                    tasks done •{" "}
                    <span className="text-caption">
                      {formatTime12h(telemetry.dayStartTime)} –{" "}
                      {formatTime12h(telemetry.dayEndTime)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold font-mono text-primary-400">
                    {dayPctRounded}%
                  </span>
                  <div className="text-[10px] text-caption">
                    {formatDurationCompact(telemetry.remainingScheduledMinutes)}{" "}
                    left
                  </div>
                </div>
              </div>

              <Progress.Root
                value={dayPctRounded}
                size="sm"
                variant="soft"
                aria-label="Overall day schedule progress"
              >
                <Progress.Indicator
                  intent="primary"
                  complete="success"
                  style={{
                    transform: `translateX(-${100 - Math.min(100, Math.max(0, dayPctRounded))}%)`,
                  }}
                />
              </Progress.Root>
            </Card>

            {/* Compact Plan Timeline List */}
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {telemetry.enrichedBlocks.map((b) => {
                const isActive = b.timeState === "active";
                return (
                  <div
                    key={b.id}
                    className={`flex items-center justify-between gap-2.5 rounded-[--btn-radius] border px-3 py-2 text-xs transition-colors ${
                      isActive
                        ? "border-primary-500/50 bg-primary-500/15 text-title"
                        : b.isCompleted
                        ? "border-success-500/25 bg-success-500/10 text-caption"
                        : "border-[--ui-border-color] bg-[--ui-soft-bg]/30 text-body"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[11px] text-caption shrink-0 w-[122px]">
                        {formatTime12h(b.startTime)} – {formatTime12h(b.endTime)}
                      </span>
                      <span
                        className={`truncate font-medium ${
                          b.isCompleted ? "line-through text-caption" : ""
                        }`}
                      >
                        {b.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono text-caption">
                        {formatDurationCompact(b.durationMinutes)}
                      </span>
                      {isActive ? (
                        <Badge variant="solid" intent="primary" size="xs">
                          NOW
                        </Badge>
                      ) : b.isCompleted ? (
                        <CheckCircle2 className="size-3.5 text-success-400" />
                      ) : b.timeState === "past" && !b.isBreak ? (
                        <Badge variant="soft" intent="warning" size="xs">
                          OVERDUE
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>
    );
  }

  // ---------------------------------------------------------------------------
  // VARIANT: HERO CENTERPIECE ON "MY DAY" TAB
  // ---------------------------------------------------------------------------
  return (
    <Card
      variant="mixed"
      fancy
      className="relative overflow-hidden p-5 sm:p-8 backdrop-blur-2xl"
    >
      {/* Subtle Ambient Radial Glow Behind Center Clock */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[520px] rounded-full blur-[110px] opacity-20"
        style={{ backgroundColor: "var(--primary)" }}
      />

      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Live Phase Pill */}
        <Badge
          variant="soft"
          intent={phaseBadge.intent}
          size="md"
          className="inline-flex items-center gap-2 rounded-full font-semibold tracking-wide"
          role="status"
          aria-live="polite"
        >
          <span className={`size-2 rounded-full ${phaseBadge.dot}`} />
          <span>{phaseBadge.label}</span>
        </Badge>

        {/* Centerpiece Live Clock */}
        <div className="mt-4 flex items-baseline justify-center gap-2 select-none font-mono">
          <span className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-title drop-shadow-md">
            {now ? `${hours12}:${minutesStr}` : "--:--"}
          </span>
          <div className="flex flex-col items-start text-left">
            <span className="text-lg sm:text-2xl font-bold text-primary-400 leading-none">
              {now ? ampm : ""}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-caption leading-tight mt-0.5">
              {now ? `:${secondsStr}` : ""}
            </span>
          </div>
        </div>

        <Text size="sm" className="mt-1.5 text-caption">
          {dateLabel}
          {telemetry.hasSchedule && (
            <span>
              {" "}
              • Planned Window:{" "}
              <strong className="text-title font-mono">
                {formatTime12h(telemetry.dayStartTime)} –{" "}
                {formatTime12h(telemetry.dayEndTime)}
              </strong>
            </span>
          )}
        </Text>

        {/* Dual Status Bars Container */}
        <div className="mt-7 w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-4 text-left">
          {/* STATUS BAR 1: CURRENT TASK PROGRESS */}
          <Card
            variant="soft"
            className="border border-[--ui-border-color] p-4 sm:p-5 flex flex-col justify-between space-y-3.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-400">
                  {telemetry.currentBlock?.isBreak ? (
                    <Coffee className="size-3.5" />
                  ) : (
                    <Flame className="size-3.5" />
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
                    <Title
                      as="h2"
                      size="lg"
                      weight="bold"
                      className={`truncate ${
                        telemetry.currentBlock.isCompleted
                          ? "line-through text-caption"
                          : ""
                      }`}
                      title={telemetry.currentBlock.title}
                    >
                      {telemetry.currentBlock.title}
                    </Title>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-caption">
                      <span className="font-mono text-primary-300">
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
                        <Badge variant="outlined" intent="gray" size="xs">
                          {telemetry.currentBlock.priority}
                        </Badge>
                      )}
                    </div>
                  </div>
                ) : telemetry.nextBlock ? (
                  <div className="mt-1.5 space-y-1">
                    <Title as="h2" size="lg" weight="bold" className="truncate">
                      {telemetry.nextBlock.title}
                    </Title>
                    <Text size="sm" className="text-caption">
                      Starts at{" "}
                      <span className="font-mono text-primary-300">
                        {formatTime12h(telemetry.nextBlock.startTime)}
                      </span>{" "}
                      (in{" "}
                      {formatDurationCompact(
                        telemetry.minutesUntilNextBlock || 0
                      )}
                      )
                    </Text>
                  </div>
                ) : telemetry.hasSchedule ? (
                  <div className="mt-1.5 space-y-1">
                    <Title
                      as="h2"
                      size="lg"
                      weight="bold"
                      className="text-success-300"
                    >
                      Day&apos;s Scheduled Window Complete
                    </Title>
                    <Text size="sm" className="text-caption">
                      Finished at {formatTime12h(telemetry.dayEndTime)}
                    </Text>
                  </div>
                ) : (
                  <div className="mt-1.5 space-y-1">
                    <Title
                      as="h2"
                      size="lg"
                      weight="semibold"
                      className="text-body"
                    >
                      No active block right now
                    </Title>
                    <Text size="sm" className="text-caption">
                      Select tasks below via Manual Build or AI Auto-Arrange to
                      start tracking live progress.
                    </Text>
                  </div>
                )}
              </div>

              {/* Percentage + Quick Complete Action */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className="text-2xl sm:text-3xl font-black font-mono text-primary-300 leading-none">
                  {currentPctRounded}%
                </span>
                {telemetry.currentBlock &&
                  !telemetry.currentBlock.isBreak &&
                  onToggleBlockComplete && (
                    <Button.Root
                      variant={
                        telemetry.currentBlock.isCompleted ? "soft" : "outlined"
                      }
                      intent={
                        telemetry.currentBlock.isCompleted
                          ? "success"
                          : "gray"
                      }
                      size="xs"
                      onClick={() =>
                        onToggleBlockComplete(telemetry.currentBlock!)
                      }
                    >
                      <Button.Icon type="leading" size="xs">
                        <CheckCircle2 />
                      </Button.Icon>
                      <Button.Label>
                        {telemetry.currentBlock.isCompleted
                          ? "Done"
                          : "Mark Done"}
                      </Button.Label>
                    </Button.Root>
                  )}
              </div>
            </div>

            {/* Tailus Progress Track for Current Task */}
            <div className="space-y-1.5">
              <Progress.Root
                value={currentPctRounded}
                size="md"
                variant="fancy"
                aria-label="Current task timeframe completion"
              >
                <Progress.Indicator
                  intent="primary"
                  withHighlight
                  style={{
                    transform: `translateX(-${100 - Math.min(100, Math.max(0, currentPctRounded))}%)`,
                  }}
                />
              </Progress.Root>
              <div className="flex items-center justify-between text-[11px] font-mono text-caption">
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
          </Card>

          {/* STATUS BAR 2: OVERALL DAY SCHEDULE PROGRESS */}
          <Card
            variant="soft"
            className="border border-[--ui-border-color] p-4 sm:p-5 flex flex-col justify-between space-y-3.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-caption">
                  <CalendarClock className="size-3.5 text-primary-400" />
                  <span>Entire Day Schedule Progress</span>
                </div>
                <Title as="h3" size="lg" weight="bold">
                  {telemetry.hasSchedule ? (
                    <>
                      {telemetry.completedTaskBlocks} of{" "}
                      {telemetry.totalTaskBlocks} Tasks Completed
                    </>
                  ) : (
                    "0 Tasks Scheduled"
                  )}
                </Title>
                <Text size="sm" className="text-caption">
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
                </Text>
              </div>

              <div className="text-right shrink-0">
                <span className="text-2xl sm:text-3xl font-black font-mono text-primary-400 leading-none">
                  {dayPctRounded}%
                </span>
                <div className="text-[11px] text-caption font-mono mt-1">
                  {telemetry.hasSchedule
                    ? `${telemetry.dayTaskCompletionPct}% checked off`
                    : "0% done"}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Progress.Root
                value={dayPctRounded}
                size="md"
                variant="fancy"
                aria-label="Entire day schedule completion"
              >
                <Progress.Indicator
                  intent="primary"
                  complete="success"
                  style={{
                    transform: `translateX(-${100 - Math.min(100, Math.max(0, dayPctRounded))}%)`,
                  }}
                />
              </Progress.Root>

              {/* Proportional Multi-Block Segmented Strip */}
              {telemetry.hasSchedule && telemetry.totalScheduledMinutes > 0 && (
                <div
                  className="flex w-full h-2 rounded-full overflow-hidden gap-0.5 bg-gray-800/70"
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
                            ? "bg-success-400"
                            : b.timeState === "active"
                            ? "bg-primary-400 animate-pulse"
                            : b.timeState === "past"
                            ? "bg-warning-400/75"
                            : b.isBreak
                            ? "bg-gray-600"
                            : "bg-gray-700"
                        }`}
                      />
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-caption">
                <span>
                  {telemetry.hasSchedule
                    ? `${formatDurationCompact(
                        telemetry.remainingScheduledMinutes
                      )} schedule time left`
                    : "Ready"}
                </span>
                {telemetry.overdueBlocks.length > 0 ? (
                  <span className="inline-flex items-center gap-1 text-warning-300 font-sans font-semibold">
                    <AlertTriangle className="size-3" />
                    {telemetry.overdueBlocks.length} past slot
                    {telemetry.overdueBlocks.length > 1 ? "s" : ""} unchecked
                  </span>
                ) : schedule?.aiSummary ? (
                  <span className="inline-flex items-center gap-1 text-primary-300 font-sans truncate max-w-[230px]">
                    <Sparkles className="size-3 shrink-0" />
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
          </Card>
        </div>
      </div>
    </Card>
  );
};
