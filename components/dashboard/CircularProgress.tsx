"use client";

import React, { useMemo } from "react";
import { TaskItem } from "@/types/taskit";
import { CheckCircle2, Clock, Flame, Sparkles, Zap } from "lucide-react";

interface CircularProgressProps {
  tasks: TaskItem[];
  streakDays?: number;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  tasks,
  streakDays = 14,
}) => {
  const stats = useMemo(() => {
    const todayDateStr = new Date().toDateString();

    // Tasks relevant to today's focus: either in TODAY/COLLEGE section, due today/overdue, or completed today
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

  const size = 128;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (stats.percentage / 100) * circumference;

  return (
    <div className="relative rounded-2xl border border-white/15 bg-black/40 backdrop-blur-xl p-5 sm:p-6 shadow-glass overflow-hidden">
      {/* Subtle top neon accent bar */}
      <div
        className="absolute inset-x-0 top-0 h-[2px] opacity-80"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--primary), var(--highlight), transparent)",
        }}
      />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left: Motivational Header & Quote */}
        <div className="space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium tracking-wide text-highlight">
            <Zap className="w-3.5 h-3.5 text-primary fill-primary/30" />
            <span>DAILY EXECUTION TELEMETRY</span>
          </div>

          <blockquote className="text-lg sm:text-xl md:text-2xl font-semibold tracking-tight text-white leading-snug">
            &ldquo;Lock in. You can’t change others, but you can change yourself.
            So, work hard, play hard, and enjoy life.&rdquo;
          </blockquote>

          {/* Real-time Stat Chips */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2 text-xs sm:text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-white/60">Done Today:</span>
              <span className="font-bold text-white">
                {stats.done} / {stats.total} tasks
              </span>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2 text-xs sm:text-sm">
              <Clock className="w-4 h-4 text-sky-400 shrink-0" />
              <span className="text-white/60">Remaining:</span>
              <span className="font-bold text-white">
                {stats.remaining} tasks
              </span>
              {stats.totalRemainingMinutes > 0 && (
                <span className="text-xs text-white/45">
                  (~{Math.floor(stats.totalRemainingMinutes / 60)}h{" "}
                  {stats.totalRemainingMinutes % 60}m)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs sm:text-sm">
              <Flame className="w-4 h-4 text-amber-400 fill-amber-400/30 shrink-0" />
              <span className="text-amber-200/80">Current Streak:</span>
              <span className="font-bold text-amber-300">
                🔥 {streakDays} days
              </span>
            </div>
          </div>
        </div>

        {/* Right: Futuristic SVG Circular Progress Ring */}
        <div className="flex items-center gap-5 self-start lg:self-center shrink-0">
          <div className="relative flex items-center justify-center">
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="-rotate-90 transform drop-shadow-[0_0_14px_var(--primary)]"
            >
              <defs>
                <linearGradient
                  id="taskitRadialGradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="var(--primary)" />
                  <stop offset="100%" stopColor="var(--highlight)" />
                </linearGradient>
                <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Background Track Circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth={strokeWidth}
              />

              {/* Animated Progress Circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="url(#taskitRadialGradient)"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                filter="url(#neonGlow)"
                className="transition-all duration-700 ease-out"
              />
            </svg>

            {/* Center Telemetry Readout */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-extrabold tracking-tight text-white">
                {stats.percentage}%
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-highlight/80">
                Locked In
              </span>
            </div>
          </div>

          <div className="hidden sm:flex flex-col space-y-1.5 text-xs text-white/70">
            <div className="font-semibold text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Daily Velocity</span>
            </div>
            <p className="text-white/55 max-w-[150px] leading-relaxed">
              {stats.percentage === 100
                ? "All targeted tasks crushed today. Outstanding discipline!"
                : stats.percentage >= 50
                ? "Past the halfway mark. Keep momentum high."
                : "Check off tasks to charge your daily progress ring."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

