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
import {
  Badge,
  Button,
  Card,
  Input,
  Progress,
  Text,
  Title,
} from "@/components/tailus-ui";

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

      {/* Semantic Milestone Card */}
      <Card
        variant="mixed"
        fancy
        className={`journey-milestone-card relative flex-1 min-w-0 backdrop-blur-md transition-colors duration-200 ${
          isHighlighted
            ? "border-primary-500/80 ring-1 ring-primary-500/40"
            : isDone
            ? "border-success-500/25 opacity-90 hover:opacity-100"
            : isActive
            ? "border-primary-500/45 shadow-lg"
            : ""
        }`}
      >
        {/* Top Metadata & Quick Actions Header */}
        <header className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Target Timeframe Pill */}
            <Badge
              variant="outlined"
              intent="gray"
              size="xs"
              className="inline-flex items-center gap-1.5 rounded-full font-mono font-semibold"
            >
              <Calendar className="size-3 text-primary-400 shrink-0" />
              <span>{milestone.timeframe || "Upcoming"}</span>
            </Badge>

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
                className="size-1.5 rounded-full shrink-0"
                style={{ backgroundColor: catMeta.dotColor }}
              />
              {catMeta.label}
            </span>

            {/* Clickable Status Pill */}
            <Button.Root
              variant="soft"
              intent={isDone ? "success" : isActive ? "primary" : "gray"}
              size="xs"
              onClick={() => onCycleStatus(milestone.id)}
              className="h-5 rounded-full px-2 text-[10px] font-semibold uppercase tracking-wider"
              title="Click to cycle milestone status"
            >
              <Button.Label>
                {isDone ? "Reached" : isActive ? "In Progress" : "Upcoming"}
              </Button.Label>
            </Button.Root>

            {/* Agent Just-Added/Updated Highlight Badge */}
            <AnimatePresence>
              {isHighlighted && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                >
                  <Badge
                    variant="soft"
                    intent="primary"
                    size="xs"
                    className="inline-flex items-center gap-1 rounded-full"
                  >
                    <Sparkles className="size-2.5" />
                    {highlightLabel || "Added by Agent"}
                  </Badge>
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Hover-revealed clean action toolbar */}
          <div className="flex items-center gap-0.5 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <Button.Root
              variant="ghost"
              intent="gray"
              size="xs"
              disabled={index === 0}
              onClick={() => onMove(milestone.id, "up")}
              title="Move earlier"
            >
              <Button.Icon type="only" size="xs">
                <ArrowUp />
              </Button.Icon>
            </Button.Root>
            <Button.Root
              variant="ghost"
              intent="gray"
              size="xs"
              disabled={index === totalCount - 1}
              onClick={() => onMove(milestone.id, "down")}
              title="Move later"
            >
              <Button.Icon type="only" size="xs">
                <ArrowDown />
              </Button.Icon>
            </Button.Root>
            {onSendToTasks && !isDone && (
              <Button.Root
                variant="ghost"
                intent="primary"
                size="xs"
                onClick={() => onSendToTasks(milestone)}
                title="Add to my tasks"
              >
                <Button.Icon type="only" size="xs">
                  <ListPlus />
                </Button.Icon>
              </Button.Root>
            )}
            <Button.Root
              variant="ghost"
              intent="gray"
              size="xs"
              onClick={() => onEdit(milestone)}
              title="Edit milestone"
            >
              <Button.Icon type="only" size="xs">
                <Pencil />
              </Button.Icon>
            </Button.Root>
            <Button.Root
              variant="ghost"
              intent="danger"
              size="xs"
              onClick={() => onDelete(milestone.id)}
              title="Delete milestone"
            >
              <Button.Icon type="only" size="xs">
                <Trash2 />
              </Button.Icon>
            </Button.Root>
          </div>
        </header>

        {/* Primary Milestone Title & Outcome */}
        <div className="space-y-1.5">
          <Title
            as="h3"
            size="lg"
            weight="semibold"
            className={`tracking-tight leading-snug ${
              isDone
                ? "text-caption line-through decoration-success-400/60"
                : ""
            }`}
          >
            {milestone.title}
          </Title>
          {milestone.description && (
            <Text size="sm" className="text-body leading-relaxed">
              {milestone.description}
            </Text>
          )}
        </div>

        {/* Sub-Steps / Checkpoints Section */}
        {(totalSteps > 0 || addingStep) && (
          <div className="mt-3.5 pt-3 border-t border-[--ui-border-color]">
            <div className="flex items-center justify-between gap-2 mb-2">
              <button
                type="button"
                onClick={() => setStepsExpanded((v) => !v)}
                aria-expanded={stepsExpanded}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-caption hover:text-title transition-colors"
              >
                {stepsExpanded ? (
                  <ChevronUp className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
                <span>
                  Key steps ({completedSteps}/{totalSteps})
                </span>
              </button>

              {totalSteps > 0 && (
                <div className="flex items-center gap-2">
                  <Progress.Root
                    value={stepPct}
                    size="xs"
                    variant="soft"
                    className="w-20"
                  >
                    <Progress.Indicator
                      intent={stepPct === 100 ? "success" : "primary"}
                      style={{ transform: `translateX(-${100 - stepPct}%)` }}
                    />
                  </Progress.Root>
                  <span className="text-[10px] font-mono text-caption w-7 text-right">
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
                        className="group/step flex items-center justify-between gap-2 rounded-[--btn-radius] px-2 py-1 hover:bg-[--ui-soft-bg]/60 transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            onToggleCheckpoint(milestone.id, cp.id)
                          }
                          className="flex items-center gap-2.5 text-left flex-1 min-w-0"
                        >
                          <span
                            className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                              cp.completed
                                ? "border-success-400/70 bg-success-500/25 text-success-300"
                                : "border-[--ui-border-color] bg-[--ui-bg] text-transparent hover:border-primary-500/60"
                            }`}
                          >
                            <Check className="size-3" strokeWidth={3} />
                          </span>
                          <span
                            className={`text-xs sm:text-[13px] leading-snug truncate ${
                              cp.completed
                                ? "text-caption line-through"
                                : "text-title"
                            }`}
                          >
                            {cp.title}
                          </span>
                        </button>
                        <Button.Root
                          variant="ghost"
                          intent="danger"
                          size="xs"
                          onClick={() =>
                            onDeleteCheckpoint(milestone.id, cp.id)
                          }
                          title="Remove step"
                          className="opacity-0 group-hover/step:opacity-100 h-6 w-6"
                        >
                          <Button.Icon type="only" size="xs">
                            <X />
                          </Button.Icon>
                        </Button.Root>
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
              <Input
                type="text"
                autoFocus
                variant="outlined"
                size="sm"
                value={newStepText}
                onChange={(e) => setNewStepText(e.target.value)}
                placeholder="Add a concrete step toward this milestone..."
                className="flex-1"
              />
              <Button.Root
                type="submit"
                variant="soft"
                intent="primary"
                size="sm"
                disabled={!newStepText.trim()}
              >
                <Button.Label>Add</Button.Label>
              </Button.Root>
              <Button.Root
                variant="ghost"
                intent="gray"
                size="sm"
                onClick={() => {
                  setAddingStep(false);
                  setNewStepText("");
                }}
              >
                <Button.Icon type="only" size="xs">
                  <X />
                </Button.Icon>
              </Button.Root>
            </form>
          ) : (
            <Button.Root
              variant="ghost"
              intent="gray"
              size="xs"
              onClick={() => {
                setStepsExpanded(true);
                setAddingStep(true);
              }}
              className="h-6 px-1.5 text-[11px] text-caption hover:text-primary-300"
            >
              <Button.Icon type="leading" size="xs">
                <Plus />
              </Button.Icon>
              <Button.Label>Add step</Button.Label>
            </Button.Root>
          )}
        </div>
      </Card>
    </motion.div>
  );
});

JourneyMilestoneCard.displayName = "JourneyMilestoneCard";
