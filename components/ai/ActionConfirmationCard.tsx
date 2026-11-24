"use client";

import React, { useState } from "react";
import { ActionChangeItem } from "@/types/taskit";
import { Badge, Button, Caption, Card, Text, Title } from "@/components/tailus-ui";
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

  const ActionIcon =
    actionType === "BATCH_RESCHEDULE"
      ? CalendarClock
      : actionType === "BATCH_CREATE"
        ? Layers
        : Sparkles;

  return (
    <Card variant="mixed" fancy className="my-2.5 p-3.5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[--ui-border-color]">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="soft" intent="primary" size="xs" className="h-6 w-6 p-0 flex items-center justify-center shrink-0">
            <ActionIcon className="w-3.5 h-3.5" />
          </Badge>
          <div className="min-w-0">
            <Caption className="block text-[10px] font-bold uppercase tracking-widest text-primary-600 dark:text-primary-400">
              Action Proposal • {actionType.replace(/_/g, " ")}
            </Caption>
            <Title as="h4" size="base" weight="semibold" className="truncate text-xs">
              {description}
            </Title>
          </div>
        </div>

        <Badge variant="soft" intent="warning" size="xs" className="flex items-center gap-1 shrink-0">
          <ShieldAlert className="w-3 h-3" />
          Strict Guard
        </Badge>
      </div>

      {/* Proposed Diff List */}
      <div className="my-3 space-y-2 max-h-48 overflow-y-auto pr-1">
        {changes.map((change, idx) => (
          <Card
            key={change.id || idx}
            variant="soft"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 px-3 py-2"
          >
            <Text size="sm" weight="medium" className="truncate my-0">
              {change.title}
            </Text>
            <div className="flex items-center gap-1.5 shrink-0">
              {change.from && (
                <>
                  <Badge variant="soft" intent="danger" size="xs">
                    {change.from}
                  </Badge>
                  <ArrowRight className="w-3 h-3 text-caption" />
                </>
              )}
              <Badge variant="soft" intent="success" size="xs" className="font-semibold">
                {change.to}
              </Badge>
            </div>
          </Card>
        ))}
      </div>

      {/* Confirmation Footer */}
      <div className="pt-2 border-t border-[--ui-border-color]">
        {status === "pending" || status === "executing" ? (
          <div className="flex items-center justify-end gap-2">
            <Button.Root
              type="button"
              variant="ghost"
              intent="gray"
              size="xs"
              disabled={status === "executing"}
              onClick={handleDismissClick}
            >
              <Button.Icon type="leading" size="xs">
                <X />
              </Button.Icon>
              <Button.Label>Dismiss</Button.Label>
            </Button.Root>
            <Button.Root
              type="button"
              variant="solid"
              intent="primary"
              size="xs"
              disabled={status === "executing"}
              onClick={handleConfirmClick}
            >
              <Button.Icon type="leading" size="xs">
                <Check />
              </Button.Icon>
              <Button.Label>
                {status === "executing" ? "Applying..." : "Confirm Changes"}
              </Button.Label>
            </Button.Root>
          </div>
        ) : status === "confirmed" ? (
          <Badge variant="soft" intent="success" size="sm" className="inline-flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            Changes confirmed and synced to workspace.
          </Badge>
        ) : (
          <Caption className="flex items-center gap-1.5 italic">
            <X className="w-3.5 h-3.5" />
            Action proposal dismissed — no tasks modified.
          </Caption>
        )}
      </div>
    </Card>
  );
};
