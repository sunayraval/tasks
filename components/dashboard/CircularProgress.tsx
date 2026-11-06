"use client";

import React, { useMemo } from "react";
import { TaskItem } from "@/types/taskit";
import { CheckCircle2, Clock, Flame, Zap } from "lucide-react";

interface CircularProgressProps {
  tasks: TaskItem[];
  streakDays?: number;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  tasks,
  streakDays = 1,
}) => {
  const stats = useMemo(() => {
    const todayDateStr = new Date().toDateString();

    const todayPool = tasks.filter((t) => {
      if (t.section_group === "TODAY" || t.section_group === "COLLEGE") {
        return true;
      }
      if (t.completed_at && new Date(t.completed_at).toDateString() === todayDateStr) {
        return true;
      }
      if (t.due_date) {
        const due = new Date(t.due_date);
        const now = new Date();
        return (
          due.toDateString() === todayDateStr ||
          (due < now && t.status !== "Done")
        );
      }
      return false;
    });

    const pool = todayPool.length > 0 ? todayPool : tasks;
    const total = pool.length;
    const done = pool.filter((t) => t.status === "Done").length;
    const remaining = Math.max(0, total - done);
    const percentage = total > 0 ? Math.round((done / total) * 100) : 0;

    const totalRemainingMinutes = pool
      .filter((t) => t.status !== "Done")
      .reduce((acc, t) => acc + (t.estimated_minutes || 30), 0);

    return {
      total,
      done,
      remaining,
      percentage,
      totalRemainingMinutes,
    };
  }, [tasks]);

  const size = 110;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (stats.percentage / 100) * circumference;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-5 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        {/* Left: Clean Heading & Stats */}
        <div className="space-y-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Daily Workspace
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              &ldquo;Lock in. You can’t change others, but you can change yourself. Work hard, play hard, and enjoy life.&rdquo;
            </p>
          </div>

          {/* Quick telemetry chips */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-zinc-400">Done Today:</span>
              <span className="font-semibold text-white">
                {stats.done} / {stats.total}
              </span>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-zinc-400">Remaining:</span>
              <span className="font-semibold text-white">
                {stats.remaining}
              </span>
              {stats.totalRemainingMinutes > 0 && (
                <span className="text-[11px] text-zinc-500 font-mono">
                  ({Math.floor(stats.totalRemainingMinutes / 60)}h {stats.totalRemainingMinutes % 60}m)
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-zinc-400">Streak:</span>
              <span className="font-semibold text-white">
                {streakDays} {streakDays === 1 ? "day" : "days"}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Minimal SVG Progress Ring */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="relative flex items-center justify-center">
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="-rotate-90 transform"
            >
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth={strokeWidth}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="#ffffff"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xl font-bold tracking-tight text-white">
                {stats.percentage}%
              </span>
              <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold">
                Progress
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
