"use client";

import React, { useMemo, useState } from "react";
import {
  SubTask,
  TaskItem,
  WorkspaceConfig,
  WorkspaceTab,
  computeSyllabusProgress,
} from "@/types/taskit";
import { computeJourneyProgress } from "@/types/journey";
import { getLocalDateYMD, isTaskDoneStatus } from "@/utils/myDayUtils";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Award,
  BarChart3,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock,
  Compass,
  Flame,
  Layers,
  ListChecks,
  Sparkles,
  Table2,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";

interface MyStatsViewProps {
  tasks: TaskItem[];
  workspaceConfig: WorkspaceConfig;
  onSelectTab: (tab: WorkspaceTab) => void;
}

type TimeframeKey = "7d" | "30d" | "all";

function formatDuration(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getTaskSubtasks(t: TaskItem): SubTask[] {
  if (Array.isArray(t.subtasks)) return t.subtasks;
  if (Array.isArray(t.custom_properties?.subtasks)) {
    return t.custom_properties.subtasks as SubTask[];
  }
  return [];
}

function toLocalYMD(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "";
  return getLocalDateYMD(d);
}

function getDateDaysAgo(daysAgo: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function formatShortDate(ymd: string): string {
  const parts = ymd.split("-").map(Number);
  if (parts.length !== 3) return ymd;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return formatShortDate(toLocalYMD(iso));
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const PRIORITY_ORDER = ["Urgent", "High", "Medium", "Low"];
const PRIORITY_COLORS: Record<string, string> = {
  Urgent: "#f43f5e",
  High: "#f97316",
  Medium: "#38bdf8",
  Low: "#94a3b8",
};

export const MyStatsView: React.FC<MyStatsViewProps> = React.memo(
  ({ tasks, workspaceConfig, onSelectTab }) => {
    const [timeframe, setTimeframe] = useState<TimeframeKey>("30d");
    const [hoveredDayIdx, setHoveredDayIdx] = useState<number | null>(null);
    const [hoveredHeatCell, setHoveredHeatCell] = useState<{
      ymd: string;
      count: number;
    } | null>(null);

    const analytics = useMemo(() => {
      const realTasks = tasks.filter((t) => !t.custom_properties?.is_header);
      const todayYmd = getLocalDateYMD();
      const nowMs = Date.now();
      const cutoffMs =
        timeframe === "7d"
          ? nowMs - 7 * 86400000
          : timeframe === "30d"
          ? nowMs - 30 * 86400000
          : 0;
      const prevWindowStartMs =
        timeframe === "7d"
          ? nowMs - 14 * 86400000
          : timeframe === "30d"
          ? nowMs - 60 * 86400000
          : 0;

      // Completed vs Active (all-time & in timeframe)
      const allCompleted = realTasks.filter((t) => isTaskDoneStatus(t));
      const allActive = realTasks.filter((t) => !isTaskDoneStatus(t));

      const getCompletionTimestamp = (t: TaskItem): number => {
        const ts = t.completed_at || t.updated_at || t.created_at;
        const parsed = new Date(ts).getTime();
        return Number.isNaN(parsed) ? 0 : parsed;
      };

      const completedInRange =
        timeframe === "all"
          ? allCompleted
          : allCompleted.filter((t) => getCompletionTimestamp(t) >= cutoffMs);

      const completedPrevRange =
        timeframe === "all"
          ? []
          : allCompleted.filter((t) => {
              const ms = getCompletionTimestamp(t);
              return ms >= prevWindowStartMs && ms < cutoffMs;
            });

      const tasksInRange =
        timeframe === "all"
          ? realTasks
          : realTasks.filter((t) => {
              const createdMs = new Date(t.created_at).getTime();
              const compMs = isTaskDoneStatus(t)
                ? getCompletionTimestamp(t)
                : 0;
              return createdMs >= cutoffMs || compMs >= cutoffMs || !isTaskDoneStatus(t);
            });

      const completionRate =
        tasksInRange.length > 0
          ? Math.round((completedInRange.length / tasksInRange.length) * 100)
          : 0;

      const velocityDelta =
        timeframe === "all"
          ? null
          : completedPrevRange.length > 0
          ? Math.round(
              ((completedInRange.length - completedPrevRange.length) /
                completedPrevRange.length) *
                100
            )
          : completedInRange.length > 0
          ? 100
          : 0;

      // Focus time banked vs remaining
      const completedMinutes = completedInRange.reduce(
        (sum, t) => sum + (t.estimated_minutes || 0),
        0
      );
      const remainingMinutes = allActive.reduce(
        (sum, t) => sum + (t.estimated_minutes || 0),
        0
      );
      const avgTaskMinutes =
        completedInRange.length > 0
          ? Math.round(completedMinutes / completedInRange.length)
          : 0;

      // Subtasks execution
      let totalSubtasks = 0;
      let completedSubtasks = 0;
      for (const t of realTasks) {
        const subs = getTaskSubtasks(t);
        totalSubtasks += subs.length;
        for (const s of subs) {
          if (s.completed) completedSubtasks++;
        }
      }
      const subtaskRate =
        totalSubtasks > 0
          ? Math.round((completedSubtasks / totalSubtasks) * 100)
          : 0;

      // On-time & Overdue metrics
      let dueCompletedTotal = 0;
      let dueCompletedOnTime = 0;
      for (const t of completedInRange) {
        if (t.due_date) {
          dueCompletedTotal++;
          const dueYmd = toLocalYMD(t.due_date);
          const compYmd = toLocalYMD(
            t.completed_at || t.updated_at || t.created_at
          );
          if (dueYmd && compYmd && compYmd <= dueYmd) {
            dueCompletedOnTime++;
          }
        }
      }
      const onTimeRate =
        dueCompletedTotal > 0
          ? Math.round((dueCompletedOnTime / dueCompletedTotal) * 100)
          : null;

      const overdueActiveCount = allActive.filter((t) => {
        if (!t.due_date) return false;
        const dueYmd = toLocalYMD(t.due_date);
        return Boolean(dueYmd && dueYmd < todayYmd);
      }).length;

      // Daily completion map (for streaks, 14-day chart, 90-day heatmap, day-of-week & time-of-day)
      const completedByDay = new Map<string, number>();
      const createdByDay = new Map<string, number>();
      const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0];
      const timeWindowCounts = {
        morning: 0, // 5am - 11:59am
        afternoon: 0, // 12pm - 4:59pm
        evening: 0, // 5pm - 9:59pm
        lateNight: 0, // 10pm - 4:59am
      };

      for (const t of realTasks) {
        const cYmd = toLocalYMD(t.created_at);
        if (cYmd) {
          createdByDay.set(cYmd, (createdByDay.get(cYmd) || 0) + 1);
        }
      }

      for (const t of allCompleted) {
        const iso = t.completed_at || t.updated_at || t.created_at;
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) continue;
        const ymd = getLocalDateYMD(d);
        completedByDay.set(ymd, (completedByDay.get(ymd) || 0) + 1);
        dayOfWeekCounts[d.getDay()]++;
        const hr = d.getHours();
        if (hr >= 5 && hr < 12) timeWindowCounts.morning++;
        else if (hr >= 12 && hr < 17) timeWindowCounts.afternoon++;
        else if (hr >= 17 && hr < 22) timeWindowCounts.evening++;
        else timeWindowCounts.lateNight++;
      }

      // Compute Current Streak & Longest Streak
      let currentStreak = 0;
      const hasToday = (completedByDay.get(todayYmd) || 0) > 0;
      let cursorOffset = hasToday ? 0 : 1;
      while (cursorOffset < 365) {
        const ymd = getLocalDateYMD(getDateDaysAgo(cursorOffset));
        if ((completedByDay.get(ymd) || 0) > 0) {
          currentStreak++;
          cursorOffset++;
        } else {
          break;
        }
      }

      let longestStreak = currentStreak;
      let runningStreak = 0;
      for (let i = 180; i >= 0; i--) {
        const ymd = getLocalDateYMD(getDateDaysAgo(i));
        if ((completedByDay.get(ymd) || 0) > 0) {
          runningStreak++;
          if (runningStreak > longestStreak) longestStreak = runningStreak;
        } else {
          runningStreak = 0;
        }
      }

      // 14-Day Velocity Series
      const velocity14d = Array.from({ length: 14 }, (_, idx) => {
        const daysAgo = 13 - idx;
        const d = getDateDaysAgo(daysAgo);
        const ymd = getLocalDateYMD(d);
        return {
          ymd,
          label: DAY_NAMES[d.getDay()],
          shortDate: formatShortDate(ymd),
          completed: completedByDay.get(ymd) || 0,
          created: createdByDay.get(ymd) || 0,
          isToday: daysAgo === 0,
        };
      });

      // 91-Day (13-Week) Consistency Heatmap
      const heatmap91d = Array.from({ length: 91 }, (_, idx) => {
        const daysAgo = 90 - idx;
        const d = getDateDaysAgo(daysAgo);
        const ymd = getLocalDateYMD(d);
        return {
          ymd,
          count: completedByDay.get(ymd) || 0,
          dayOfWeek: d.getDay(),
        };
      });
      const activeDaysLast90 = heatmap91d.filter((c) => c.count > 0).length;

      // Peak Focus Day & Peak Window
      let peakDayIdx = -1;
      let peakDayCount = 0;
      dayOfWeekCounts.forEach((c, idx) => {
        if (c > peakDayCount) {
          peakDayCount = c;
          peakDayIdx = idx;
        }
      });

      const windowEntries: Array<[string, number]> = [
        ["Morning (5am–12pm)", timeWindowCounts.morning],
        ["Afternoon (12pm–5pm)", timeWindowCounts.afternoon],
        ["Evening (5pm–10pm)", timeWindowCounts.evening],
        ["Late Night (10pm–5am)", timeWindowCounts.lateNight],
      ];
      windowEntries.sort((a, b) => b[1] - a[1]);
      const peakWindow =
        windowEntries[0][1] > 0 ? windowEntries[0][0] : "Not enough data yet";

      // Priority Breakdown
      const priorityMap = new Map<
        string,
        { label: string; completed: number; active: number; minutes: number }
      >();
      for (const p of PRIORITY_ORDER) {
        priorityMap.set(p, { label: p, completed: 0, active: 0, minutes: 0 });
      }
      for (const t of realTasks) {
        const p = t.priority || "Medium";
        const entry = priorityMap.get(p) || {
          label: p,
          completed: 0,
          active: 0,
          minutes: 0,
        };
        if (isTaskDoneStatus(t)) entry.completed++;
        else entry.active++;
        entry.minutes += t.estimated_minutes || 0;
        priorityMap.set(p, entry);
      }
      const priorityBreakdown = Array.from(priorityMap.values()).filter(
        (p) => p.completed + p.active > 0
      );

      const highUrgentTotal = realTasks.filter(
        (t) => t.priority === "High" || t.priority === "Urgent"
      ).length;
      const highUrgentDone = allCompleted.filter(
        (t) => t.priority === "High" || t.priority === "Urgent"
      ).length;
      const highPriorityRate =
        highUrgentTotal > 0
          ? Math.round((highUrgentDone / highUrgentTotal) * 100)
          : 0;

      // Category / Type Breakdown
      const typeMap = new Map<
        string,
        { label: string; completed: number; active: number; minutes: number }
      >();
      for (const t of realTasks) {
        const key = t.is_canvas_assignment
          ? "Canvas LMS"
          : t.type || "General";
        const entry = typeMap.get(key) || {
          label: key,
          completed: 0,
          active: 0,
          minutes: 0,
        };
        if (isTaskDoneStatus(t)) entry.completed++;
        else entry.active++;
        entry.minutes += t.estimated_minutes || 0;
        typeMap.set(key, entry);
      }
      const typeBreakdown = Array.from(typeMap.values())
        .sort((a, b) => b.completed + b.active - (a.completed + a.active))
        .slice(0, 6);

      // Cross-workspace pillars: my day, my journey, my flo
      const myDayBlocks = workspaceConfig.myDaySchedule?.blocks || [];
      const myDayDone = myDayBlocks.filter((b) => b.completed).length;
      const myDayPct =
        myDayBlocks.length > 0
          ? Math.round((myDayDone / myDayBlocks.length) * 100)
          : 0;

      const journeys = workspaceConfig.journeyState?.journeys || [];
      let journeyTotalMilestones = 0;
      let journeyCompletedMilestones = 0;
      for (const j of journeys) {
        const prog = computeJourneyProgress(j);
        journeyTotalMilestones += prog.total;
        journeyCompletedMilestones += prog.completed;
      }
      const journeyPct =
        journeyTotalMilestones > 0
          ? Math.round(
              (journeyCompletedMilestones / journeyTotalMilestones) * 100
            )
          : 0;

      const studyProgress = computeSyllabusProgress(
        workspaceConfig.studySession?.syllabus || null
      );
      const studyTopicsCount = studyProgress.totalActive;
      const studyMastered = studyProgress.masteredCount;
      const studyPct = studyProgress.percentage;

      // Composite Kite Productivity Score (0–100)
      const consistencyScore = Math.min(100, currentStreak * 15 + activeDaysLast90 * 2);
      const scoreParts: Array<{ weight: number; value: number }> = [
        { weight: 0.45, value: completionRate },
        { weight: 0.25, value: consistencyScore },
      ];
      if (totalSubtasks > 0) {
        scoreParts.push({ weight: 0.15, value: subtaskRate });
      }
      if (myDayBlocks.length > 0) {
        scoreParts.push({ weight: 0.15, value: myDayPct });
      }
      if (journeyTotalMilestones > 0) {
        scoreParts.push({ weight: 0.1, value: journeyPct });
      }
      const totalWeight = scoreParts.reduce((s, p) => s + p.weight, 0);
      const productivityScore =
        realTasks.length === 0 && journeyTotalMilestones === 0
          ? 0
          : Math.min(
              100,
              Math.round(
                scoreParts.reduce((s, p) => s + p.value * p.weight, 0) /
                  totalWeight
              )
            );

      const scoreTier =
        productivityScore >= 85
          ? { label: "Locked In", color: "text-emerald-300", bg: "bg-emerald-500/15 border-emerald-400/30" }
          : productivityScore >= 65
          ? { label: "In Flow", color: "text-sky-300", bg: "bg-sky-500/15 border-sky-400/30" }
          : productivityScore >= 40
          ? { label: "Building Momentum", color: "text-amber-300", bg: "bg-amber-500/15 border-amber-400/30" }
          : { label: "Warming Up", color: "text-white/80", bg: "bg-white/10 border-white/20" };

      // Smart Insights Generator
      const insights: Array<{
        id: string;
        tone: "positive" | "warning" | "info";
        title: string;
        detail: string;
        actionLabel?: string;
        actionTab?: WorkspaceTab;
      }> = [];

      if (currentStreak >= 3) {
        insights.push({
          id: "streak",
          tone: "positive",
          title: `${currentStreak}-day execution streak active`,
          detail:
            currentStreak >= longestStreak
              ? `You're matching your all-time record (${longestStreak} days). Finish 1 task today to extend it.`
              : `Your record is ${longestStreak} days — just ${
                  longestStreak - currentStreak + 1
                } more days to beat it.`,
        });
      }

      if (overdueActiveCount > 0) {
        insights.push({
          id: "overdue",
          tone: "warning",
          title: `${overdueActiveCount} overdue ${
            overdueActiveCount === 1 ? "task" : "tasks"
          } need triage`,
          detail:
            "Reschedule or break down past-due items so they stop dragging down your momentum.",
          actionLabel: "Open my tasks",
          actionTab: "tasks",
        });
      }

      if (highUrgentTotal > 0 && highPriorityRate >= 65) {
        insights.push({
          id: "high-prio",
          tone: "positive",
          title: `Strong high-priority focus (${highPriorityRate}%)`,
          detail: `You've knocked out ${highUrgentDone} of ${highUrgentTotal} Urgent/High priority tasks instead of just clearing easy wins.`,
        });
      } else if (highUrgentTotal - highUrgentDone >= 2) {
        insights.push({
          id: "high-prio-warn",
          tone: "info",
          title: `${
            highUrgentTotal - highUrgentDone
          } high-priority tasks waiting`,
          detail:
            "Schedule your top priority item into your peak focus block in my day.",
          actionLabel: "Plan my day",
          actionTab: "my_day",
        });
      }

      if (myDayBlocks.length === 0 && allActive.length > 0) {
        insights.push({
          id: "my-day-empty",
          tone: "info",
          title: "No time-blocks scheduled for today yet",
          detail: `You have ${allActive.length} active tasks (${formatDuration(
            remainingMinutes
          )} estimated). Time-blocking boosts completion rates dramatically.`,
          actionLabel: "Build my day",
          actionTab: "my_day",
        });
      } else if (myDayBlocks.length > 0) {
        insights.push({
          id: "my-day-progress",
          tone: myDayPct >= 70 ? "positive" : "info",
          title: `Today's schedule is ${myDayPct}% complete`,
          detail: `${myDayDone} of ${myDayBlocks.length} planned blocks checked off so far today.`,
          actionLabel: "Open my day",
          actionTab: "my_day",
        });
      }

      if (totalSubtasks > 0 && completedSubtasks < totalSubtasks) {
        insights.push({
          id: "subtasks",
          tone: "info",
          title: `${completedSubtasks}/${totalSubtasks} subtasks completed (${subtaskRate}%)`,
          detail:
            "Breaking big tasks into small subtasks keeps progress measurable and reduces friction.",
        });
      }

      if (insights.length < 3 && peakDayIdx !== -1) {
        insights.push({
          id: "peak-day",
          tone: "positive",
          title: `${FULL_DAY_NAMES[peakDayIdx]} is your strongest day`,
          detail: `You've completed ${peakDayCount} ${
            peakDayCount === 1 ? "task" : "tasks"
          } on ${FULL_DAY_NAMES[peakDayIdx]}s, peaking during ${peakWindow.toLowerCase()}.`,
        });
      }

      // Recent Wins (latest 6 completed tasks)
      const recentWins = [...allCompleted]
        .sort((a, b) => getCompletionTimestamp(b) - getCompletionTimestamp(a))
        .slice(0, 6);

      return {
        totalTasks: realTasks.length,
        completedCount: completedInRange.length,
        allCompletedCount: allCompleted.length,
        activeCount: allActive.length,
        completionRate,
        velocityDelta,
        completedMinutes,
        remainingMinutes,
        avgTaskMinutes,
        totalSubtasks,
        completedSubtasks,
        subtaskRate,
        onTimeRate,
        dueCompletedTotal,
        overdueActiveCount,
        currentStreak,
        longestStreak,
        activeDaysLast90,
        velocity14d,
        heatmap91d,
        peakDay: peakDayIdx !== -1 ? FULL_DAY_NAMES[peakDayIdx] : "—",
        peakWindow,
        priorityBreakdown,
        highPriorityRate,
        highUrgentDone,
        highUrgentTotal,
        typeBreakdown,
        myDayBlocksCount: myDayBlocks.length,
        myDayDone,
        myDayPct,
        journeyTotalMilestones,
        journeyCompletedMilestones,
        journeyPct,
        studyTopicsCount,
        studyMastered,
        studyPct,
        productivityScore,
        scoreTier,
        insights: insights.slice(0, 4),
        recentWins,
      };
    }, [tasks, workspaceConfig, timeframe]);

    // SVG Ring Geometry for Productivity Score
    const ringSize = 112;
    const ringStroke = 9;
    const ringRadius = (ringSize - ringStroke) / 2;
    const ringCircumference = 2 * Math.PI * ringRadius;
    const ringOffset =
      ringCircumference -
      (analytics.productivityScore / 100) * ringCircumference;

    // 14-day chart scale
    const maxVelocityVal = Math.max(
      3,
      ...analytics.velocity14d.map((d) => Math.max(d.completed, d.created))
    );

    // Heatmap max for intensity bucketing
    const maxHeatCount = Math.max(
      1,
      ...analytics.heatmap91d.map((c) => c.count)
    );

    const getHeatOpacity = (count: number) => {
      if (count === 0) return 0;
      const ratio = count / maxHeatCount;
      if (ratio <= 0.25) return 0.3;
      if (ratio <= 0.55) return 0.55;
      if (ratio <= 0.8) return 0.8;
      return 1;
    };

    return (
      <div className="space-y-5 pb-10">
        {/* Top Hero Banner: Title, Timeframe Toggle, Productivity Score Ring & Streaks */}
        <section className="rounded-3xl border theme-panel p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              {/* Productivity Score Gauge */}
              <div className="relative flex items-center justify-center shrink-0">
                <svg
                  width={ringSize}
                  height={ringSize}
                  className="-rotate-90"
                  aria-label={`Productivity score ${analytics.productivityScore} out of 100`}
                >
                  <circle
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={ringRadius}
                    fill="transparent"
                    stroke="rgba(255,255,255,0.09)"
                    strokeWidth={ringStroke}
                  />
                  <circle
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={ringRadius}
                    fill="transparent"
                    stroke="var(--primary)"
                    strokeWidth={ringStroke}
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-extrabold tracking-tight text-white">
                    {analytics.productivityScore}
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-white/50">
                    score
                  </span>
                </div>
              </div>

              <div className="space-y-2 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold text-highlight">
                    <BarChart3 className="w-3 h-3 text-primary" />
                    <span>my stats</span>
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${analytics.scoreTier.bg} ${analytics.scoreTier.color}`}
                  >
                    <Award className="w-3 h-3" />
                    <span>{analytics.scoreTier.label}</span>
                  </span>
                </div>

                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Progress, Growth &amp; Productivity Intelligence
                </h1>

                <div className="flex flex-wrap items-center gap-3 text-xs text-white/65">
                  <span className="inline-flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    <strong className="text-white">
                      {analytics.currentStreak}d
                    </strong>{" "}
                    current streak
                  </span>
                  <span className="text-white/25">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                    <strong className="text-white">
                      {analytics.longestStreak}d
                    </strong>{" "}
                    best streak
                  </span>
                  <span className="text-white/25">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-primary" />
                    <strong className="text-white">
                      {analytics.activeDaysLast90}
                    </strong>{" "}
                    active days (90d)
                  </span>
                </div>
              </div>
            </div>

            {/* Right Controls: Timeframe Switcher + Quick Nav */}
            <div className="flex flex-col sm:items-end gap-3 shrink-0">
              <div
                role="group"
                aria-label="Stats Timeframe"
                className="inline-flex items-center rounded-full border border-white/15 bg-black/40 p-1 self-start sm:self-end"
              >
                {(
                  [
                    { id: "7d", label: "7 Days" },
                    { id: "30d", label: "30 Days" },
                    { id: "all", label: "All Time" },
                  ] as Array<{ id: TimeframeKey; label: string }>
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTimeframe(opt.id)}
                    className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-colors ${
                      timeframe === opt.id
                        ? "bg-primary text-black shadow-sm"
                        : "text-white/65 hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onSelectTab("tasks")}
                  className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.05] hover:bg-white/[0.1] px-2.5 py-1 text-[11px] font-medium text-white/80 hover:text-white transition-colors"
                >
                  <Table2 className="w-3 h-3 text-primary" />
                  <span>my tasks</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTab("my_day")}
                  className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.05] hover:bg-white/[0.1] px-2.5 py-1 text-[11px] font-medium text-white/80 hover:text-white transition-colors"
                >
                  <CalendarClock className="w-3 h-3 text-primary" />
                  <span>my day</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTab("journey")}
                  className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.05] hover:bg-white/[0.1] px-2.5 py-1 text-[11px] font-medium text-white/80 hover:text-white transition-colors"
                >
                  <Compass className="w-3 h-3 text-primary" />
                  <span>my journey</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTab("study")}
                  className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.05] hover:bg-white/[0.1] px-2.5 py-1 text-[11px] font-medium text-white/80 hover:text-white transition-colors"
                >
                  <BookOpen className="w-3 h-3 text-primary" />
                  <span>my flo</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 4 Bento KPI Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* KPI 1: Tasks Completed */}
          <div className="rounded-2xl border theme-panel p-4 sm:p-5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/55">
                Tasks Completed
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-400/25 text-emerald-300">
                <CheckCircle2 className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2.5">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                {analytics.completedCount}
              </span>
              {analytics.velocityDelta !== null && (
                <span
                  className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    analytics.velocityDelta >= 0
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-rose-500/15 text-rose-300"
                  }`}
                >
                  {analytics.velocityDelta >= 0 ? "+" : ""}
                  {analytics.velocityDelta}% vs prior
                </span>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-white/60">
                <span>Completion rate</span>
                <span className="font-mono text-white/85">
                  {analytics.completionRate}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                  style={{ width: `${analytics.completionRate}%` }}
                />
              </div>
            </div>
          </div>

          {/* KPI 2: Focus Time Banked */}
          <div className="rounded-2xl border theme-panel p-4 sm:p-5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/55">
                Focus Time Banked
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/15 border border-sky-400/25 text-sky-300">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                {formatDuration(analytics.completedMinutes)}
              </span>
              {analytics.avgTaskMinutes > 0 && (
                <span className="text-xs text-white/55">
                  ~{analytics.avgTaskMinutes}m / task
                </span>
              )}
            </div>
            <p className="text-xs text-white/60">
              <strong className="text-white/90">
                {formatDuration(analytics.remainingMinutes)}
              </strong>{" "}
              remaining across{" "}
              <strong className="text-white/90">{analytics.activeCount}</strong>{" "}
              active {analytics.activeCount === 1 ? "task" : "tasks"}
            </p>
          </div>

          {/* KPI 3: Subtask Execution */}
          <div className="rounded-2xl border theme-panel p-4 sm:p-5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/55">
                Subtask Execution
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/15 border border-violet-400/25 text-violet-300">
                <ListChecks className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                {analytics.completedSubtasks}
                <span className="text-lg font-semibold text-white/45">
                  /{analytics.totalSubtasks}
                </span>
              </span>
              <span className="text-xs font-mono text-violet-300">
                {analytics.subtaskRate}%
              </span>
            </div>
            <div className="space-y-1">
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-violet-400 transition-all duration-500"
                  style={{ width: `${analytics.subtaskRate}%` }}
                />
              </div>
              <p className="text-[11px] text-white/55">
                {analytics.totalSubtasks === 0
                  ? "Add subtasks in my tasks to track micro-steps"
                  : `${
                      analytics.totalSubtasks - analytics.completedSubtasks
                    } subtasks left to check off`}
              </p>
            </div>
          </div>

          {/* KPI 4: Execution Quality */}
          <div className="rounded-2xl border theme-panel p-4 sm:p-5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/55">
                {analytics.onTimeRate !== null
                  ? "On-Time Delivery"
                  : "High-Priority Focus"}
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-400/25 text-amber-300">
                <Target className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                {analytics.onTimeRate !== null
                  ? `${analytics.onTimeRate}%`
                  : `${analytics.highPriorityRate}%`}
              </span>
              {analytics.overdueActiveCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
                  {analytics.overdueActiveCount} overdue
                </span>
              )}
            </div>
            <p className="text-xs text-white/60">
              {analytics.onTimeRate !== null
                ? `Based on ${analytics.dueCompletedTotal} completed tasks with due dates`
                : `${analytics.highUrgentDone}/${analytics.highUrgentTotal} Urgent & High priority tasks completed`}
            </p>
          </div>
        </section>

        {/* Row 2: 14-Day Velocity Chart + Smart Intelligence Insights */}
        <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* 14-Day Completion Velocity & Creation Chart */}
          <div className="xl:col-span-7 rounded-3xl border theme-panel p-5 sm:p-6 flex flex-col justify-between space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span>14-Day Completion Velocity</span>
                </h2>
                <p className="text-xs text-white/55 mt-0.5">
                  Daily tasks completed vs. newly added over the last two weeks
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-white/70">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: "var(--primary)" }}
                  />
                  Completed
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-white/25" />
                  Added
                </span>
              </div>
            </div>

            {/* Interactive SVG Bar Chart */}
            <div className="relative pt-2">
              <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1.5 sm:gap-2 items-end h-44 px-1">
                {analytics.velocity14d.map((day, idx) => {
                  const compPct = Math.round(
                    (day.completed / maxVelocityVal) * 100
                  );
                  const createdPct = Math.round(
                    (day.created / maxVelocityVal) * 100
                  );
                  const isHovered = hoveredDayIdx === idx;
                  return (
                    <div
                      key={day.ymd}
                      onMouseEnter={() => setHoveredDayIdx(idx)}
                      onMouseLeave={() => setHoveredDayIdx(null)}
                      className="relative flex flex-col items-center justify-end h-full group cursor-default"
                    >
                      {isHovered && (
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap rounded-lg border theme-popover px-2.5 py-1 text-[10px] text-white shadow-lg pointer-events-none">
                          <div className="font-semibold">{day.shortDate}</div>
                          <div className="text-white/75">
                            {day.completed} done • {day.created} added
                          </div>
                        </div>
                      )}
                      <div className="w-full flex items-end justify-center gap-0.5 h-32">
                        <div
                          className="w-1/2 max-w-[14px] rounded-t-md bg-white/20 transition-all duration-300"
                          style={{
                            height: `${Math.max(day.created > 0 ? 10 : 3, createdPct)}%`,
                          }}
                        />
                        <div
                          className="w-1/2 max-w-[14px] rounded-t-md transition-all duration-300"
                          style={{
                            backgroundColor:
                              day.completed > 0
                                ? "var(--primary)"
                                : "rgba(255,255,255,0.08)",
                            height: `${Math.max(day.completed > 0 ? 12 : 3, compPct)}%`,
                            opacity: isHovered ? 1 : 0.9,
                          }}
                        />
                      </div>
                      <span
                        className={`mt-2 text-[10px] font-mono ${
                          day.isToday
                            ? "text-highlight font-bold"
                            : "text-white/45"
                        }`}
                      >
                        {day.isToday ? "Today" : day.label.slice(0, 2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-white/10 text-xs">
              <div>
                <span className="text-white/50 block text-[11px]">
                  Peak Focus Day
                </span>
                <span className="font-semibold text-white">
                  {analytics.peakDay}
                </span>
              </div>
              <div>
                <span className="text-white/50 block text-[11px]">
                  Peak Focus Window
                </span>
                <span className="font-semibold text-white">
                  {analytics.peakWindow}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-white/50 block text-[11px]">
                  All-Time Completed
                </span>
                <span className="font-semibold text-white">
                  {analytics.allCompletedCount} tasks
                </span>
              </div>
            </div>
          </div>

          {/* Smart Intelligence & Actionable Insights */}
          <div className="xl:col-span-5 rounded-3xl border theme-panel p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span>Smart Insights</span>
              </h2>
              <span className="text-[11px] font-mono text-white/45">
                live analysis
              </span>
            </div>

            <div className="space-y-2.5">
              {analytics.insights.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center space-y-2">
                  <Sparkles className="w-6 h-6 text-primary mx-auto opacity-80" />
                  <p className="text-sm font-medium text-white">
                    Complete a few tasks to unlock personalized insights
                  </p>
                  <p className="text-xs text-white/55">
                    Kite automatically analyzes your streaks, peak focus hours,
                    and priority execution as you work.
                  </p>
                </div>
              ) : (
                analytics.insights.map((ins) => (
                  <div
                    key={ins.id}
                    className={`rounded-2xl border p-3.5 space-y-1.5 ${
                      ins.tone === "positive"
                        ? "border-emerald-400/25 bg-emerald-500/[0.08]"
                        : ins.tone === "warning"
                        ? "border-rose-400/25 bg-rose-500/[0.08]"
                        : "border-white/12 bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {ins.tone === "warning" ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                        ) : ins.tone === "positive" ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                        ) : (
                          <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
                        )}
                        <h3 className="text-xs sm:text-sm font-semibold text-white">
                          {ins.title}
                        </h3>
                      </div>
                      {ins.actionLabel && ins.actionTab && (
                        <button
                          type="button"
                          onClick={() => onSelectTab(ins.actionTab!)}
                          className="inline-flex items-center gap-0.5 rounded-full border border-white/15 bg-white/10 hover:bg-white/20 px-2 py-0.5 text-[10px] font-semibold text-white shrink-0 transition-colors"
                        >
                          <span>{ins.actionLabel}</span>
                          <ArrowUpRight className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-white/70 leading-relaxed pl-5">
                      {ins.detail}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Row 3: 90-Day Consistency Heatmap */}
        <section className="rounded-3xl border theme-panel p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-400" />
                <span>90-Day Consistency Heatmap</span>
              </h2>
              <p className="text-xs text-white/55 mt-0.5">
                {hoveredHeatCell
                  ? `${formatShortDate(hoveredHeatCell.ymd)}: ${
                      hoveredHeatCell.count
                    } ${
                      hoveredHeatCell.count === 1 ? "task" : "tasks"
                    } completed`
                  : "Every square is a day — hover to inspect daily completions"}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-white/55">
              <span>Less</span>
              {[0, 0.3, 0.55, 0.8, 1].map((op, i) => (
                <span
                  key={i}
                  className="h-3 w-3 rounded-[3px] border border-white/10"
                  style={{
                    backgroundColor:
                      op === 0 ? "rgba(255,255,255,0.06)" : "var(--primary)",
                    opacity: op === 0 ? 1 : op,
                  }}
                />
              ))}
              <span>More</span>
            </div>
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="grid grid-flow-col grid-rows-7 gap-1.5 w-max min-w-full">
              {analytics.heatmap91d.map((cell) => {
                const op = getHeatOpacity(cell.count);
                return (
                  <button
                    key={cell.ymd}
                    type="button"
                    onMouseEnter={() =>
                      setHoveredHeatCell({ ymd: cell.ymd, count: cell.count })
                    }
                    onMouseLeave={() => setHoveredHeatCell(null)}
                    aria-label={`${cell.ymd}: ${cell.count} tasks completed`}
                    className="h-4 w-4 sm:h-4.5 sm:w-4.5 rounded-[4px] border border-white/[0.08] transition-transform hover:scale-125 focus:outline-none focus:ring-1 focus:ring-primary"
                    style={{
                      backgroundColor:
                        op === 0 ? "rgba(255,255,255,0.06)" : "var(--primary)",
                      opacity: op === 0 ? 1 : op,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </section>

        {/* Row 4: 3 Deep Breakdown Cards (Priority, Category, Workspace Mastery) */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Breakdown 1: By Priority */}
          <div className="rounded-3xl border theme-panel p-5 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              <span>Execution by Priority</span>
            </h2>
            {analytics.priorityBreakdown.length === 0 ? (
              <p className="text-xs text-white/50 py-6 text-center">
                No tasks yet.
              </p>
            ) : (
              <div className="space-y-3">
                {analytics.priorityBreakdown.map((p) => {
                  const total = p.completed + p.active;
                  const pct = total > 0 ? Math.round((p.completed / total) * 100) : 0;
                  const barColor = PRIORITY_COLORS[p.label] || "var(--primary)";
                  return (
                    <div key={p.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-white/90">
                          {p.label}
                        </span>
                        <span className="font-mono text-white/65">
                          {p.completed}/{total} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: barColor,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Breakdown 2: By Category / Type */}
          <div className="rounded-3xl border theme-panel p-5 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              <span>Focus by Category</span>
            </h2>
            {analytics.typeBreakdown.length === 0 ? (
              <p className="text-xs text-white/50 py-6 text-center">
                No categories yet.
              </p>
            ) : (
              <div className="space-y-3">
                {analytics.typeBreakdown.map((cat) => {
                  const total = cat.completed + cat.active;
                  const pct = total > 0 ? Math.round((cat.completed / total) * 100) : 0;
                  return (
                    <div key={cat.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="font-medium text-white/90 truncate">
                          {cat.label}
                        </span>
                        <span className="font-mono text-white/65 shrink-0">
                          {cat.completed}/{total} • {formatDuration(cat.minutes)}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: "var(--primary)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Breakdown 3: Cross-Workspace Mastery */}
          <div className="rounded-3xl border theme-panel p-5 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" />
              <span>Workspace Pillars</span>
            </h2>
            <div className="space-y-3">
              {[
                {
                  label: "my tasks",
                  icon: <Table2 className="w-3.5 h-3.5 text-primary" />,
                  detail: `${analytics.allCompletedCount}/${analytics.totalTasks} done`,
                  pct:
                    analytics.totalTasks > 0
                      ? Math.round(
                          (analytics.allCompletedCount / analytics.totalTasks) *
                            100
                        )
                      : 0,
                  tab: "tasks" as WorkspaceTab,
                },
                {
                  label: "my day",
                  icon: <CalendarClock className="w-3.5 h-3.5 text-sky-300" />,
                  detail:
                    analytics.myDayBlocksCount > 0
                      ? `${analytics.myDayDone}/${analytics.myDayBlocksCount} blocks`
                      : "Not scheduled",
                  pct: analytics.myDayPct,
                  tab: "my_day" as WorkspaceTab,
                },
                {
                  label: "my journey",
                  icon: <Compass className="w-3.5 h-3.5 text-amber-300" />,
                  detail:
                    analytics.journeyTotalMilestones > 0
                      ? `${analytics.journeyCompletedMilestones}/${analytics.journeyTotalMilestones} milestones`
                      : "No milestones",
                  pct: analytics.journeyPct,
                  tab: "journey" as WorkspaceTab,
                },
                {
                  label: "my flo",
                  icon: <BookOpen className="w-3.5 h-3.5 text-emerald-300" />,
                  detail:
                    analytics.studyTopicsCount > 0
                      ? `${analytics.studyMastered}/${analytics.studyTopicsCount} mastered`
                      : "No active session",
                  pct: analytics.studyPct,
                  tab: "study" as WorkspaceTab,
                },
              ].map((pillar) => (
                <button
                  key={pillar.label}
                  type="button"
                  onClick={() => onSelectTab(pillar.tab)}
                  className="w-full text-left rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] p-2.5 space-y-1.5 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-white">
                      {pillar.icon}
                      {pillar.label}
                    </span>
                    <span className="font-mono text-[11px] text-white/65">
                      {pillar.detail}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pillar.pct}%`,
                        backgroundColor: "var(--primary)",
                      }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Row 5: Recent Wins Timeline */}
        <section className="rounded-3xl border theme-panel p-5 sm:p-6 space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Recent Wins</span>
            </h2>
            <span className="text-xs text-white/50">
              Latest completed tasks
            </span>
          </div>

          {analytics.recentWins.length === 0 ? (
            <p className="text-xs text-white/55 py-4 text-center">
              No completed tasks yet — knock out your first task in my tasks and
              it will show up here.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {analytics.recentWins.map((t) => (
                <div
                  key={t.id}
                  className="flex items-start gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-white truncate">
                      {t.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-white/55">
                      <span>{t.priority || "Medium"}</span>
                      {t.estimated_minutes > 0 && (
                        <>
                          <span>•</span>
                          <span>{formatDuration(t.estimated_minutes)}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>
                        {formatRelativeTime(
                          t.completed_at || t.updated_at || t.created_at
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }
);

MyStatsView.displayName = "MyStatsView";
