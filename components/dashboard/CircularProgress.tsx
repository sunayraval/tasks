"use client";

import React, { useMemo, useState } from "react";
import { TaskItem, WorkspaceConfig } from "@/types/taskit";
import { CheckCircle2, Clock, Flame, Pencil } from "lucide-react";
import { Badge, Card, Input, Progress, Text, Title } from "@/components/tailus-ui";

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
    const isCompleted = (t: TaskItem) => {
      const s = (t.status || "").toLowerCase().trim();
      return s === "done" || s === "completed" || Boolean(t.completed_at);
    };
    const done = realTasks.filter(isCompleted).length;
    const remaining = Math.max(0, total - done);
    const percentage = total > 0 ? Math.round((done / total) * 100) : 0;

    const totalRemainingMinutes = realTasks
      .filter((t) => !isCompleted(t))
      .reduce((acc, t) => acc + (t.estimated_minutes || 30), 0);

    return {
      total,
      done,
      remaining,
      percentage,
      totalRemainingMinutes,
    };
  }, [tasks]);

  const size = 104;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (stats.percentage / 100) * circumference;

  return (
    <Card
      variant="mixed"
      fancy
      className="backdrop-blur-xl transition-all duration-300"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        {/* Left: Editable Heading & Telemetry */}
        <div className="space-y-3.5 flex-1">
          <div>
            {editingTitle ? (
              <Input
                type="text"
                autoFocus
                variant="outlined"
                size="lg"
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
                className="max-w-md font-bold text-xl"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTitleDraft(workspaceConfig.workspaceTitle);
                  setEditingTitle(true);
                }}
                className="group flex items-center gap-2 text-left transition-colors"
                title="Click to edit workspace title"
              >
                <Title
                  as="h1"
                  size="2xl"
                  weight="bold"
                  className="tracking-tight group-hover:text-primary-300 transition-colors"
                >
                  {workspaceConfig.workspaceTitle}
                </Title>
                <Pencil className="size-3.5 text-primary-400 opacity-0 group-hover:opacity-90 transition-opacity" />
              </button>
            )}

            <div className="mt-1">
              {editingSubtitle ? (
                <Input
                  type="text"
                  autoFocus
                  variant="outlined"
                  size="sm"
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
                  className="max-w-2xl"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setSubtitleDraft(workspaceConfig.workspaceSubtitle);
                    setEditingSubtitle(true);
                  }}
                  className="group flex items-center gap-1.5 text-left"
                  title="Click to edit workspace motto / subtitle"
                >
                  <Text
                    as="span"
                    size="sm"
                    className="text-caption group-hover:text-body transition-colors"
                  >
                    {workspaceConfig.workspaceSubtitle ||
                      "Click to add a workspace motto..."}
                  </Text>
                  <Pencil className="size-3 text-primary-400 opacity-0 group-hover:opacity-90 transition-opacity shrink-0" />
                </button>
              )}
            </div>
          </div>

          {/* Quick telemetry chips styled with Tailus Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outlined"
              intent="gray"
              size="sm"
              className="inline-flex items-center gap-1.5 py-1 px-2.5 font-normal"
            >
              <CheckCircle2 className="size-3.5 text-success-400 shrink-0" />
              <span className="text-caption">Completed:</span>
              <span className="font-semibold text-title">
                {stats.done} / {stats.total}
              </span>
            </Badge>

            <Badge
              variant="outlined"
              intent="gray"
              size="sm"
              className="inline-flex items-center gap-1.5 py-1 px-2.5 font-normal"
            >
              <Clock className="size-3.5 text-primary-400 shrink-0" />
              <span className="text-caption">Remaining:</span>
              <span className="font-semibold text-title">
                {stats.remaining}
              </span>
              {stats.totalRemainingMinutes > 0 && (
                <span className="text-[11px] text-primary-300 font-mono">
                  ({Math.floor(stats.totalRemainingMinutes / 60)}h{" "}
                  {stats.totalRemainingMinutes % 60}m)
                </span>
              )}
            </Badge>

            <Badge
              variant="outlined"
              intent="gray"
              size="sm"
              className="inline-flex items-center gap-1.5 py-1 px-2.5 font-normal"
            >
              <Flame className="size-3.5 text-warning-400 shrink-0" />
              <span className="text-caption">Streak:</span>
              <span className="font-semibold text-title">
                {streakDays} {streakDays === 1 ? "day" : "days"}
              </span>
            </Badge>
          </div>

          <Progress.Root
            value={stats.percentage}
            size="xs"
            variant="soft"
            className="max-w-sm"
          >
            <Progress.Indicator
              intent="primary"
              style={{
                transform: `translateX(-${100 - stats.percentage}%)`,
              }}
            />
          </Progress.Root>
        </div>

        {/* Right: Tailus-Accented SVG Progress Ring */}
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
                stroke="currentColor"
                className="text-gray-800/80"
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
              <span className="text-lg font-bold tracking-tight text-title">
                {stats.percentage}%
              </span>
              <span className="text-[9px] uppercase tracking-wider text-caption font-semibold">
                Progress
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
