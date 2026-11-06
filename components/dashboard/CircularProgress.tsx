"use client";

import React, { useMemo, useState } from "react";
import { TaskItem, WorkspaceConfig } from "@/types/taskit";
import { CheckCircle2, Clock, Flame, Pencil } from "lucide-react";

interface CircularProgressProps {
  tasks: TaskItem[];
  workspaceConfig: WorkspaceConfig;
  onUpdateWorkspaceConfig: (updates: Partial<WorkspaceConfig>) => void;
  streakDays?: number;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  tasks,
  workspaceConfig,
  onUpdateWorkspaceConfig,
  streakDays = 1,
}) => {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingSubtitle, setEditingSubtitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(workspaceConfig.workspaceTitle);
  const [subtitleDraft, setSubtitleDraft] = useState(
    workspaceConfig.workspaceSubtitle
  );

  const commitTitle = () => {
    setEditingTitle(false);
    const cleaned = titleDraft.trim() || "Daily Workspace";
    setTitleDraft(cleaned);
    if (cleaned !== workspaceConfig.workspaceTitle) {
      onUpdateWorkspaceConfig({ workspaceTitle: cleaned });
    }
  };

  const commitSubtitle = () => {
    setEditingSubtitle(false);
    const cleaned = subtitleDraft.trim();
    setSubtitleDraft(cleaned);
    if (cleaned !== workspaceConfig.workspaceSubtitle) {
      onUpdateWorkspaceConfig({ workspaceSubtitle: cleaned });
    }
  };

  const stats = useMemo(() => {
    // Exclude movable header divider rows from task statistics
    const realTasks = tasks.filter((t) => !t.custom_properties?.is_header);
    const total = realTasks.length;
    const done = realTasks.filter((t) => t.status === "Done").length;
    const remaining = Math.max(0, total - done);
    const percentage = total > 0 ? Math.round((done / total) * 100) : 0;

    const totalRemainingMinutes = realTasks
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
    <div className="rounded-xl border theme-panel p-5 backdrop-blur-xl transition-all duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        {/* Left: Editable Heading & Stats */}
        <div className="space-y-3 flex-1">
          <div>
            {editingTitle ? (
              <input
                type="text"
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitTitle();
                  if (e.key === "Escape") {
                    setTitleDraft(workspaceConfig.workspaceTitle);
                    setEditingTitle(false);
                  }
                }}
                className="w-full max-w-md rounded-lg border border-primary bg-black/75 px-2.5 py-1 text-xl sm:text-2xl font-bold text-white focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTitleDraft(workspaceConfig.workspaceTitle);
                  setEditingTitle(true);
                }}
                className="group flex items-center gap-2 text-left text-xl sm:text-2xl font-bold tracking-tight text-white hover:text-highlight transition-colors"
                title="Click to edit workspace title"
              >
                <span>{workspaceConfig.workspaceTitle}</span>
                <Pencil className="w-3.5 h-3.5 text-primary opacity-0 group-hover:opacity-80 transition-opacity" />
              </button>
            )}

            <div className="mt-1">
              {editingSubtitle ? (
                <input
                  type="text"
                  autoFocus
                  value={subtitleDraft}
                  onChange={(e) => setSubtitleDraft(e.target.value)}
                  onBlur={commitSubtitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitSubtitle();
                    if (e.key === "Escape") {
                      setSubtitleDraft(workspaceConfig.workspaceSubtitle);
                      setEditingSubtitle(false);
                    }
                  }}
                  className="w-full max-w-2xl rounded-lg border border-primary bg-black/75 px-2.5 py-1 text-xs text-white focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSubtitleDraft(workspaceConfig.workspaceSubtitle);
                    setEditingSubtitle(true);
                  }}
                  className="group flex items-center gap-1.5 text-left text-xs text-white/65 hover:text-white transition-colors"
                  title="Click to edit workspace motto / subtitle"
                >
                  <span>
                    {workspaceConfig.workspaceSubtitle ||
                      "Click to add a workspace motto..."}
                  </span>
                  <Pencil className="w-3 h-3 text-primary opacity-0 group-hover:opacity-80 transition-opacity shrink-0" />
                </button>
              )}
            </div>
          </div>

          {/* Quick telemetry chips */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-white/60">Completed:</span>
              <span className="font-semibold text-white">
                {stats.done} / {stats.total}
              </span>
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-xs">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span className="text-white/60">Remaining:</span>
              <span className="font-semibold text-white">
                {stats.remaining}
              </span>
              {stats.totalRemainingMinutes > 0 && (
                <span className="text-[11px] text-highlight/80 font-mono">
                  ({Math.floor(stats.totalRemainingMinutes / 60)}h{" "}
                  {stats.totalRemainingMinutes % 60}m)
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-xs">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-white/60">Streak:</span>
              <span className="font-semibold text-white">
                {streakDays} {streakDays === 1 ? "day" : "days"}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Theme-Colored SVG Progress Ring */}
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
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth={strokeWidth}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="var(--primary)"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xl font-bold tracking-tight text-highlight">
                {stats.percentage}%
              </span>
              <span className="text-[9px] uppercase tracking-wider text-white/50 font-semibold">
                Progress
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
