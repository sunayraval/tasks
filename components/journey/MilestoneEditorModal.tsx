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

  if (!isOpen) return null;

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

    // Also include pending stepDraft if user forgot to click +
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="milestone-modal-title"
        className="w-full max-w-lg rounded-2xl border theme-popover p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/20 border border-primary/40 text-primary">
              <Flag className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="milestone-modal-title"
                className="text-base font-bold text-white leading-tight"
              >
                {initialMilestone ? "Edit Milestone" : "Set New Milestone"}
              </h2>
              <p className="text-[11px] text-white/55">
                Define a big milestone on your journey timeline
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/65 mb-1.5">
              Milestone Title
            </label>
            <input
              type="text"
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Launch v1 to First 100 Users, Hit 1550 SAT, Run a Half Marathon"
              className="w-full rounded-xl border theme-input px-3.5 py-2.5 text-sm placeholder:text-white/35 focus:outline-none"
            />
          </div>

          {/* Timeframe + Quick Chips */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/65 mb-1.5">
              Target Timeframe
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-primary/80 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                placeholder="e.g. Jan 2027, Summer 2027, In 6 Months"
                className="w-full rounded-xl border theme-input pl-9 pr-3.5 py-2 text-sm placeholder:text-white/35 focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {TIMEFRAME_QUICK_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setTimeframe(chip)}
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-mono transition-colors ${
                    timeframe === chip
                      ? "border-primary/60 bg-primary/20 text-highlight"
                      : "border-white/12 bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Status Selector */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/65 mb-1.5">
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
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStatus(s.id)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                    status === s.id
                      ? s.id === "completed"
                        ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
                        : "border-primary/60 bg-primary/20 text-highlight"
                      : "border-white/12 bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/65 mb-1.5">
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
                        : "opacity-70 hover:opacity-100"
                    }`}
                    style={{
                      backgroundColor: selected
                        ? meta.badgeBg
                        : "rgba(255,255,255,0.04)",
                      borderColor: selected
                        ? meta.badgeBorder
                        : "rgba(255,255,255,0.12)",
                      color: selected ? meta.badgeText : "rgba(255,255,255,0.7)",
                    }}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
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
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/65 mb-1.5">
              What Success Looks Like (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A crisp 1-sentence outcome or why this milestone matters..."
              className="w-full rounded-xl border theme-input px-3.5 py-2 text-sm placeholder:text-white/35 focus:outline-none resize-none"
            />
          </div>

          {/* Checkpoints / Key Steps */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-white/65 mb-1.5">
              Key Steps (Optional)
            </label>
            {checkpoints.length > 0 && (
              <ul className="space-y-1.5 mb-2">
                {checkpoints.map((cp) => (
                  <li
                    key={cp.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs"
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
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          cp.completed
                            ? "border-emerald-400/70 bg-emerald-500/25 text-emerald-300"
                            : "border-white/25 text-transparent"
                        }`}
                      >
                        <Check className="w-3 h-3" strokeWidth={3} />
                      </span>
                      <span
                        className={
                          cp.completed
                            ? "text-white/45 line-through truncate"
                            : "text-white/85 truncate"
                        }
                      >
                        {cp.title}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCheckpoints((prev) =>
                          prev.filter((item) => item.id !== cp.id)
                        )
                      }
                      className="text-white/40 hover:text-rose-400 p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={stepDraft}
                onChange={(e) => setStepDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddStep();
                  }
                }}
                placeholder="Add a concrete step & press Enter..."
                className="flex-1 rounded-xl border theme-input px-3 py-2 text-xs placeholder:text-white/35 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddStep}
                disabled={!stepDraft.trim()}
                className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15 disabled:opacity-40 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/12 bg-white/5 px-4 py-2 text-xs font-semibold text-white/75 hover:text-white hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-zinc-950 hover:opacity-90 disabled:opacity-40 transition-all shadow-lg"
            >
              {initialMilestone ? "Save Changes" : "Add to Journey"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
