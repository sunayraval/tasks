"use client";

import React, { useState, useEffect } from "react";
import {
  JOURNEY_CATEGORY_META,
  JourneyCategory,
  JourneyCheckpoint,
  JourneyMilestone,
  JourneyMilestoneStatus,
} from "@/types/taskit";
import { Calendar, Check, Flag, Plus, Trash2, X } from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  Input,
  Text,
  Textarea,
  Title,
} from "@/components/tailus-ui";

interface MilestoneEditorModalProps {
  isOpen: boolean;
  initialMilestone: JourneyMilestone | null;
  onClose: () => void;
  onSave: (data: {
    id?: string;
    title: string;
    timeframe: string;
    category: JourneyCategory;
    status: JourneyMilestoneStatus;
    description: string;
    checkpoints: JourneyCheckpoint[];
  }) => void;
}

const TIMEFRAME_QUICK_CHIPS = [
  "Next Month",
  "Q1 2027",
  "Q2 2027",
  "Summer 2027",
  "Fall 2027",
  "End of Year",
  "2028",
];

const CATEGORY_KEYS: JourneyCategory[] = [
  "startup",
  "career",
  "academics",
  "health",
  "creative",
  "finance",
  "personal",
  "custom",
];

export const MilestoneEditorModal: React.FC<MilestoneEditorModalProps> = ({
  isOpen,
  initialMilestone,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState("");
  const [timeframe, setTimeframe] = useState("Q1 2027");
  const [category, setCategory] = useState<JourneyCategory>("personal");
  const [status, setStatus] = useState<JourneyMilestoneStatus>("upcoming");
  const [description, setDescription] = useState("");
  const [checkpoints, setCheckpoints] = useState<JourneyCheckpoint[]>([]);
  const [stepDraft, setStepDraft] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    if (initialMilestone) {
      setTitle(initialMilestone.title);
      setTimeframe(initialMilestone.timeframe || "Upcoming");
      setCategory(initialMilestone.category || "personal");
      setStatus(initialMilestone.status || "upcoming");
      setDescription(initialMilestone.description || "");
      setCheckpoints(
        initialMilestone.checkpoints.map((cp) => ({ ...cp }))
      );
    } else {
      setTitle("");
      setTimeframe("Q1 2027");
      setCategory("personal");
      setStatus("upcoming");
      setDescription("");
      setCheckpoints([]);
    }
    setStepDraft("");
  }, [isOpen, initialMilestone]);

  const handleAddStep = () => {
    const clean = stepDraft.trim();
    if (!clean) return;
    setCheckpoints((prev) => [
      ...prev,
      {
        id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: clean,
        completed: false,
      },
    ]);
    setStepDraft("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedTitle = title.trim();
    if (!cleanedTitle) return;

    const finalSteps = [...checkpoints];
    if (stepDraft.trim()) {
      finalSteps.push({
        id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: stepDraft.trim(),
        completed: false,
      });
    }

    onSave({
      id: initialMilestone?.id,
      title: cleanedTitle,
      timeframe: timeframe.trim() || "Upcoming",
      category,
      status,
      description: description.trim(),
      checkpoints: finalSteps,
    });
    onClose();
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content
          mixed
          className="max-w-lg max-h-[90vh] overflow-y-auto bg-[--ui-bg] backdrop-blur-2xl"
        >
          <div className="flex items-center justify-between gap-3 mb-4 pr-6">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-[--btn-radius] bg-primary-500/15 border border-primary-500/35 text-primary-400">
                <Flag className="size-4" />
              </div>
              <div>
                <Dialog.Title size="base" weight="bold">
                  {initialMilestone ? "Edit Milestone" : "Set New Milestone"}
                </Dialog.Title>
                <Dialog.Description size="sm" className="text-caption">
                  Define a big milestone on your journey timeline
                </Dialog.Description>
              </div>
            </div>
          </div>

          <Dialog.CloseButton aria-label="Close modal" onClick={onClose}>
            <X />
          </Dialog.CloseButton>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-caption mb-1.5">
                Milestone Title
              </label>
              <Input
                type="text"
                autoFocus
                required
                variant="outlined"
                size="md"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Launch v1 to First 100 Users, Hit 1550 SAT, Run a Half Marathon"
              />
            </div>

            {/* Timeframe + Quick Chips */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-caption mb-1.5">
                Target Timeframe
              </label>
              <div className="relative">
                <Calendar className="size-4 text-primary-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  type="text"
                  variant="outlined"
                  size="md"
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  placeholder="e.g. Jan 2027, Summer 2027, In 6 Months"
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {TIMEFRAME_QUICK_CHIPS.map((chip) => (
                  <Button.Root
                    key={chip}
                    variant={timeframe === chip ? "soft" : "outlined"}
                    intent={timeframe === chip ? "primary" : "gray"}
                    size="xs"
                    onClick={() => setTimeframe(chip)}
                    className="h-6 rounded-full px-2.5 text-[11px] font-mono"
                  >
                    <Button.Label>{chip}</Button.Label>
                  </Button.Root>
                ))}
              </div>
            </div>

            {/* Status Selector */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-caption mb-1.5">
                Status
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "upcoming", label: "Upcoming" },
                    { id: "in_progress", label: "In Progress" },
                    { id: "completed", label: "Reached" },
                  ] as const
                ).map((s) => (
                  <Button.Root
                    key={s.id}
                    variant={status === s.id ? "soft" : "outlined"}
                    intent={
                      status === s.id
                        ? s.id === "completed"
                          ? "success"
                          : "primary"
                        : "gray"
                    }
                    size="sm"
                    onClick={() => setStatus(s.id)}
                    className="text-xs font-semibold"
                  >
                    <Button.Label>{s.label}</Button.Label>
                  </Button.Root>
                ))}
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-caption mb-1.5">
                Category
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_KEYS.map((key) => {
                  const meta = JOURNEY_CATEGORY_META[key];
                  const selected = category === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCategory(key)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                        selected
                          ? "ring-1 ring-white/40"
                          : "opacity-75 hover:opacity-100"
                      }`}
                      style={{
                        backgroundColor: selected
                          ? meta.badgeBg
                          : "var(--ui-soft-bg)",
                        borderColor: selected
                          ? meta.badgeBorder
                          : "var(--ui-border-color)",
                        color: selected ? meta.badgeText : "var(--body-text-color)",
                      }}
                    >
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: meta.dotColor }}
                      />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Outcome / Description */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-caption mb-1.5">
                What Success Looks Like (Optional)
              </label>
              <Textarea
                rows={2}
                variant="outlined"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A crisp 1-sentence outcome or why this milestone matters..."
                className="resize-none"
              />
            </div>

            {/* Checkpoints / Key Steps */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-caption mb-1.5">
                Key Steps (Optional)
              </label>
              {checkpoints.length > 0 && (
                <ul className="space-y-1.5 mb-2">
                  {checkpoints.map((cp) => (
                    <li
                      key={cp.id}
                      className="flex items-center justify-between gap-2 rounded-[--btn-radius] border border-[--ui-border-color] bg-[--ui-soft-bg]/50 px-2.5 py-1.5 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setCheckpoints((prev) =>
                            prev.map((item) =>
                              item.id === cp.id
                                ? { ...item, completed: !item.completed }
                                : item
                            )
                          )
                        }
                        className="flex items-center gap-2 text-left flex-1 min-w-0"
                      >
                        <span
                          className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                            cp.completed
                              ? "border-success-400/70 bg-success-500/25 text-success-300"
                              : "border-[--ui-border-color] text-transparent"
                          }`}
                        >
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                        <span
                          className={
                            cp.completed
                              ? "text-caption line-through truncate"
                              : "text-title truncate"
                          }
                        >
                          {cp.title}
                        </span>
                      </button>
                      <Button.Root
                        variant="ghost"
                        intent="danger"
                        size="xs"
                        onClick={() =>
                          setCheckpoints((prev) =>
                            prev.filter((item) => item.id !== cp.id)
                          )
                        }
                      >
                        <Button.Icon type="only" size="xs">
                          <Trash2 />
                        </Button.Icon>
                      </Button.Root>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  variant="outlined"
                  size="sm"
                  value={stepDraft}
                  onChange={(e) => setStepDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddStep();
                    }
                  }}
                  placeholder="Add a concrete step & press Enter..."
                  className="flex-1"
                />
                <Button.Root
                  variant="soft"
                  intent="gray"
                  size="sm"
                  onClick={handleAddStep}
                  disabled={!stepDraft.trim()}
                >
                  <Button.Icon type="leading" size="xs">
                    <Plus />
                  </Button.Icon>
                  <Button.Label>Add</Button.Label>
                </Button.Root>
              </div>
            </div>

            {/* Footer Buttons */}
            <Dialog.Actions className="pt-2 border-t border-[--ui-border-color] mt-4">
              <Button.Root
                variant="outlined"
                intent="gray"
                size="sm"
                onClick={onClose}
              >
                <Button.Label>Cancel</Button.Label>
              </Button.Root>
              <Button.Root
                type="submit"
                variant="solid"
                intent="primary"
                size="sm"
                disabled={!title.trim()}
                className="font-semibold"
              >
                <Button.Label>
                  {initialMilestone ? "Save Changes" : "Add to Journey"}
                </Button.Label>
              </Button.Root>
            </Dialog.Actions>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
