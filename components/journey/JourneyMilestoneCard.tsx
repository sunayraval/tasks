"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  JOURNEY_CATEGORY_META,
  JourneyMilestone,
  JourneyMilestoneStatus,
} from "@/types/taskit";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Flag,
  ListPlus,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

interface JourneyMilestoneCardProps {
  milestone: JourneyMilestone;
  index: number;
  totalCount: number;
  isHighlighted?: boolean;
  highlightLabel?: string;
  onCycleStatus: (id: string) => void;
  onSetStatus: (id: string, status: JourneyMilestoneStatus) => void;
  onEdit: (milestone: JourneyMilestone) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onToggleCheckpoint: (milestoneId: string, checkpointId: string) => void;
  onAddCheckpoint: (milestoneId: string, title: string) => void;
  onDeleteCheckpoint: (milestoneId: string, checkpointId: string) => void;
  onSendToTasks?: (milestone: JourneyMilestone) => void;
}

export const JourneyMilestoneCard: React.FC<JourneyMilestoneCardProps> = React.memo(({
  milestone,
  index,
  totalCount,
  isHighlighted = false,
  highlightLabel,
  onCycleStatus,
  onEdit,
  onDelete,
  onMove,
  onToggleCheckpoint,
  onAddCheckpoint,
  onDeleteCheckpoint,
  onSendToTasks,
}) => {
  const [stepsExpanded, setStepsExpanded] = useState<boolean>(
    milestone.status === "in_progress" || milestone.checkpoints.length <= 3
  );
  const [addingStep, setAddingStep] = useState(false);
  const [newStepText, setNewStepText] = useState("");

  const catMeta =
    JOURNEY_CATEGORY_META[milestone.category] || JOURNEY_CATEGORY_META.custom;

  const completedSteps = milestone.checkpoints.filter((c) => c.completed).length;
  const totalSteps = milestone.checkpoints.length;
  const stepPct =
    totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  const isDone = milestone.status === "completed";
  const isActive = milestone.status === "in_progress";
  const stepNumber = String(index + 1).padStart(2, "0");

  const handleSubmitStep = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newStepText.trim();
    if (!cleaned) return;
    onAddCheckpoint(milestone.id, cleaned);
    setNewStepText("");
    setAddingStep(false);
    setStepsExpanded(true);
  };

  return (
    <motion.div
      id={`journey-milestone-${milestone.id}`}
      layout="position"
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.97 }}
      transition={{
        type: "spring",
        stiffness: 340,
        damping: 28,
        mass: 0.85,
      }}
      className={`relative flex items-start gap-4 sm:gap-5 group ${
        index >= 4 ? "perf-offscreen-card" : ""
      }`}
    >
      {/* Timeline Waypoint Node anchored on the vertical journey spine */}
      <div className="relative z-10 flex flex-col items-center pt-5 shrink-0">
        <button
          type="button"
          onClick={() => onCycleStatus(milestone.id)}
          title={
            isDone
              ? "Reached — click to reset"
              : isActive
              ? "In Progress — click to mark reached"
              : "Upcoming — click to start"
          }
          aria-label={`Milestone ${index + 1}: ${milestone.title} (${milestone.status}). Click to cycle status.`}
          className={`relative flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
            isDone
              ? "border-emerald-400/70 bg-emerald-500 text-zinc-950 shadow-[0_0_20px_rgba(16,185,129,0.45)]"
              : isActive
              ? "border-primary bg-black/70 text-primary shadow-[0_0_24px_color-mix(in_srgb,var(--primary)_55%,transparent)]"
              : "border-white/20 bg-black/60 text-white/75 hover:border-primary/60 hover:text-white"
          }`}
        >
          {isActive && (
            <span
              className="pointer-events-none absolute inset-0 rounded-full border-2 border-primary animate-journey-beacon"
              aria-hidden="true"
            />
          )}
          {isDone ? (
            <Check className="w-5 h-5" strokeWidth={2.8} />
          ) : isActive ? (
            <Flag className="w-4 h-4 fill-current" />
          ) : (
            <span className="font-mono text-xs font-bold tracking-tight">
              {stepNumber}
            </span>
          )}
        </button>
      </div>

      {/* Subtle Horizontal Branch Connector */}
      <div
        className={`hidden sm:block mt-[39px] -ml-4 w-5 h-px shrink-0 transition-colors duration-300 ${
          isDone
            ? "bg-emerald-400/50"
            : isActive || isHighlighted
            ? "bg-primary/65"
            : "bg-white/15 group-hover:bg-white/30"
        }`}
        aria-hidden="true"
      />

      {/* Semantic Milestone Card (<article>) */}
      <article
        className={`journey-milestone-card relative flex-1 min-w-0 rounded-2xl border p-4 sm:p-5 transition-colors duration-200 ${
          isHighlighted
            ? "theme-panel border-primary/80 shadow-[0_0_32px_-4px_color-mix(in_srgb,var(--primary)_55%,transparent)]"
            : isDone
            ? "theme-panel border-emerald-400/25 opacity-90 hover:opacity-100"
            : isActive
            ? "theme-panel border-primary/45 shadow-[0_12px_36px_-8px_rgba(0,0,0,0.5),0_0_22px_-6px_color-mix(in_srgb,var(--primary)_32%,transparent)]"
            : "theme-panel hover:border-white/25"
        }`}
      >
        {/* Top Metadata & Quick Actions Header */}
        <header className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Target Timeframe Pill */}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/35 px-2.5 py-0.5 text-[11px] font-mono font-semibold text-highlight">
              <Calendar className="w-3 h-3 text-primary/90 shrink-0" />
              <span>{milestone.timeframe || "Upcoming"}</span>
            </span>

            {/* Category Pill */}
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: catMeta.badgeBg,
                borderColor: catMeta.badgeBorder,
                color: catMeta.badgeText,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: catMeta.dotColor }}
              />
              {catMeta.label}
            </span>

            {/* Clickable Status Pill */}
            <button
              type="button"
              onClick={() => onCycleStatus(milestone.id)}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                isDone
                  ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                  : isActive
                  ? "border-primary/50 bg-primary/15 text-highlight hover:bg-primary/25"
                  : "border-white/12 bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
              }`}
              title="Click to cycle milestone status"
            >
              {isDone ? "Reached" : isActive ? "In Progress" : "Upcoming"}
            </button>

            {/* Agent Just-Added/Updated Highlight Badge */}
            <AnimatePresence>
              {isHighlighted && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/25 border border-primary/60 px-2 py-0.5 text-[10px] font-semibold text-highlight"
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  {highlightLabel || "Added by Agent"}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Hover-revealed clean action toolbar */}
          <div className="flex items-center gap-0.5 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => onMove(milestone.id, "up")}
              title="Move earlier"
              className="rounded-lg p-1.5 text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-25 disabled:pointer-events-none transition-colors"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={index === totalCount - 1}
              onClick={() => onMove(milestone.id, "down")}
              title="Move later"
              className="rounded-lg p-1.5 text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-25 disabled:pointer-events-none transition-colors"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            {onSendToTasks && !isDone && (
              <button
                type="button"
                onClick={() => onSendToTasks(milestone)}
                title="Add to my tasks"
                className="rounded-lg p-1.5 text-white/50 hover:text-primary hover:bg-white/10 transition-colors"
              >
                <ListPlus className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onEdit(milestone)}
              title="Edit milestone"
              className="rounded-lg p-1.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(milestone.id)}
              title="Delete milestone"
              className="rounded-lg p-1.5 text-white/50 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Primary Milestone Title & Outcome */}
        <div className="space-y-1.5">
          <h3
            className={`text-base sm:text-[17px] font-bold tracking-tight leading-snug ${
              isDone ? "text-white/75 line-through decoration-emerald-400/60" : "text-white"
            }`}
          >
            {milestone.title}
          </h3>
          {milestone.description && (
            <p className="text-xs sm:text-[13.5px] text-white/70 leading-relaxed">
              {milestone.description}
            </p>
          )}
        </div>

        {/* Sub-Steps / Checkpoints Section */}
        {(totalSteps > 0 || addingStep) && (
          <div className="mt-3.5 pt-3 border-t border-white/10">
            <div className="flex items-center justify-between gap-2 mb-2">
              <button
                type="button"
                onClick={() => setStepsExpanded((v) => !v)}
                aria-expanded={stepsExpanded}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/65 hover:text-white transition-colors"
              >
                {stepsExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-white/50" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-white/50" />
                )}
                <span>
                  Key steps ({completedSteps}/{totalSteps})
                </span>
              </button>

              {totalSteps > 0 && (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${stepPct}%`,
                        backgroundColor:
                          stepPct === 100 ? "#34d399" : "var(--primary)",
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-white/55 w-7 text-right">
                    {stepPct}%
                  </span>
                </div>
              )}
            </div>

            <AnimatePresence initial={false}>
              {stepsExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <ul className="space-y-1.5 mt-1.5">
                    {milestone.checkpoints.map((cp) => (
                      <li
                        key={cp.id}
                        className="group/step flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-white/[0.05] transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            onToggleCheckpoint(milestone.id, cp.id)
                          }
                          className="flex items-center gap-2.5 text-left flex-1 min-w-0"
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                              cp.completed
                                ? "border-emerald-400/70 bg-emerald-500/25 text-emerald-300"
                                : "border-white/25 bg-black/30 text-transparent hover:border-primary/60"
                            }`}
                          >
                            <Check className="w-3 h-3" strokeWidth={3} />
                          </span>
                          <span
                            className={`text-xs sm:text-[13px] leading-snug truncate ${
                              cp.completed
                                ? "text-white/45 line-through"
                                : "text-white/85"
                            }`}
                          >
                            {cp.title}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onDeleteCheckpoint(milestone.id, cp.id)
                          }
                          title="Remove step"
                          className="opacity-0 group-hover/step:opacity-100 rounded p-0.5 text-white/35 hover:text-rose-400 transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Compact inline "+ Add step" trigger / form */}
        <div className="mt-2.5 flex items-center justify-between">
          {addingStep ? (
            <form
              onSubmit={handleSubmitStep}
              className="flex items-center gap-2 w-full"
            >
              <input
                type="text"
                autoFocus
                value={newStepText}
                onChange={(e) => setNewStepText(e.target.value)}
                placeholder="Add a concrete step toward this milestone..."
                className="flex-1 rounded-lg border theme-input px-2.5 py-1.5 text-xs placeholder:text-white/35 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!newStepText.trim()}
                className="rounded-lg bg-primary/25 border border-primary/50 px-2.5 py-1.5 text-xs font-semibold text-highlight hover:bg-primary/35 disabled:opacity-40 transition-colors"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingStep(false);
                  setNewStepText("");
                }}
                className="rounded-lg p-1.5 text-white/45 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setStepsExpanded(true);
                setAddingStep(true);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-white/40 hover:text-highlight transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>Add step</span>
            </button>
          )}
        </div>
      </article>
    </motion.div>
  );
});

JourneyMilestoneCard.displayName = "JourneyMilestoneCard";
