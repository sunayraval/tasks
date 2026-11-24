"use client";

import React, { useState } from "react";
import { ActionChangeItem } from "@/types/taskit";
import {
  ArrowRight,
  CalendarClock,
  Check,
  Layers,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";

export interface ActionConfirmationCardProps {
  actionType: "BATCH_RESCHEDULE" | "BATCH_CREATE" | "PRIORITIZE_AND_TAG";
  description: string;
  changes: ActionChangeItem[];
  newDueDate?: string;
  onConfirm: () => Promise<void> | void;
  onDismiss: () => void;
}

export const ActionConfirmationCard: React.FC<ActionConfirmationCardProps> = ({
  actionType,
  description,
  changes,
  onConfirm,
  onDismiss,
}) => {
  const [status, setStatus] = useState<
    "pending" | "executing" | "confirmed" | "dismissed"
  >("pending");

  const handleConfirmClick = async () => {
    setStatus("executing");
    await onConfirm();
    setStatus("confirmed");
  };

  const handleDismissClick = () => {
    setStatus("dismissed");
    onDismiss();
  };

  return (
    <div className="my-2.5 rounded-2xl border border-primary/50 bg-black/75 p-4 shadow-neon backdrop-blur-xl transition-all">
      {/* Header Badge */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/25 text-highlight">
            {actionType === "BATCH_RESCHEDULE" ? (
              <CalendarClock className="w-3.5 h-3.5" />
            ) : actionType === "BATCH_CREATE" ? (
              <Layers className="w-3.5 h-3.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
          </span>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-primary">
              Action Proposal • {actionType.replace(/_/g, " ")}
            </div>
            <div className="text-xs font-semibold text-white">{description}</div>
          </div>
        </div>

        <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300 flex items-center gap-1 shrink-0">
          <ShieldAlert className="w-3 h-3" />
          Strict Guard
        </span>
      </div>

      {/* Proposed Diff List */}
      <div className="my-3 space-y-2 max-h-48 overflow-y-auto pr-1">
        {changes.map((change, idx) => (
          <div
            key={change.id || idx}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs"
          >
            <div className="font-medium text-white truncate">
              {change.title}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] shrink-0">
              {change.from && (
                <>
                  <span className="rounded bg-rose-500/20 border border-rose-400/30 px-1.5 py-0.5 text-rose-300">
                    {change.from}
                  </span>
                  <ArrowRight className="w-3 h-3 text-white/40" />
                </>
              )}
              <span className="rounded bg-emerald-500/20 border border-emerald-400/30 px-1.5 py-0.5 text-emerald-300 font-semibold">
                {change.to}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation Buttons */}
      {status === "pending" || status === "executing" ? (
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
          <button
            type="button"
            disabled={status === "executing"}
            onClick={handleDismissClick}
            className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/75 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Dismiss
          </button>
          <button
            type="button"
            disabled={status === "executing"}
            onClick={handleConfirmClick}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-black shadow-neon hover:brightness-110 transition-all"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            {status === "executing" ? "Applying..." : "Confirm Changes"}
          </button>
        </div>
      ) : status === "confirmed" ? (
        <div className="flex items-center gap-1.5 pt-2 border-t border-white/10 text-xs font-semibold text-emerald-400">
          <Check className="w-4 h-4" />
          <span>Changes confirmed and synced to workspace.</span>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 pt-2 border-t border-white/10 text-xs text-white/45 italic">
          <X className="w-4 h-4" />
          <span>Action proposal dismissed — no tasks modified.</span>
        </div>
      )}
    </div>
  );
};

