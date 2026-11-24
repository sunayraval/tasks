"use client";

import React, { useState, useEffect } from "react";
import {
  SectionGroup,
  SECTION_DIVIDERS,
  TaskItem,
  TaskPriority,
  TaskType,
} from "@/types/taskit";
import {
  Button,
  Dialog,
  Input,
  Label,
} from "@/components/tailus-ui";
import { Command, Plus, X } from "lucide-react";

interface QuickCreateTaskModalProps {
  isOpen: boolean;
  defaultSection?: SectionGroup;
  onClose: () => void;
  onCreateTask: (newTask: Omit<TaskItem, "id" | "created_at" | "updated_at">) => void;
  userId: string;
}

const SELECT_CLS =
  "w-full rounded-[--input-radius] border border-[--ui-border-color] bg-[--ui-soft-bg] px-3 py-2 text-xs text-title focus:border-primary-500 focus:outline-none";

export const QuickCreateTaskModal: React.FC<QuickCreateTaskModalProps> = ({
  isOpen,
  defaultSection = "TODAY",
  onClose,
  onCreateTask,
  userId,
}) => {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TaskType>("School");
  const [priority, setPriority] = useState<TaskPriority>("High");
  const [sectionGroup, setSectionGroup] =
    useState<SectionGroup>(defaultSection);
  const [dueDate, setDueDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(45);
  const [tagsInput, setTagsInput] = useState<string>("#Focus");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    setSectionGroup(defaultSection);
  }, [defaultSection]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const parsedTags = tagsInput
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => (t.startsWith("#") ? t : `#${t}`));

    onCreateTask({
      user_id: userId,
      title: title.trim(),
      content: `<p>${notes || "Created via Quick Command Modal (⌘K)."}</p>`,
      status: "To Do",
      type,
      priority,
      due_date: dueDate ? new Date(`${dueDate}T23:59:00`).toISOString() : null,
      estimated_minutes: estimatedMinutes || 30,
      tags: parsedTags,
      notes: notes.trim(),
      is_canvas_assignment: false,
      canvas_course_code: null,
      custom_properties: {},
      section_group: sectionGroup,
      order_index: 0,
      completed_at: null,
      subtasks: [],
    });

    setTitle("");
    setNotes("");
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          fancy
          className="w-[calc(100vw-1.25rem)] max-w-lg max-h-[94vh] overflow-y-auto p-4 sm:p-6 shadow-neon backdrop-blur-2xl"
        >
          <div className="flex items-center justify-between pb-4 border-b border-[--ui-border-color]">
            <Dialog.Title className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary-300">
              <Command className="w-4 h-4 text-primary-400" />
              <span>Quick Command • New Task (⌘K)</span>
            </Dialog.Title>
            <Dialog.CloseButton
              type="button"
              onClick={onClose}
              className="static"
              aria-label="Close quick create modal"
            >
              <X className="w-4 h-4" />
            </Dialog.CloseButton>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <Input
                type="text"
                autoFocus
                required
                variant="soft"
                size="md"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to get done? (e.g. Complete Calc III Problem Set)"
                className="font-medium"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="space-y-1">
                <Label size="sm" className="text-caption">
                  Section
                </Label>
                <select
                  value={sectionGroup}
                  onChange={(e) =>
                    setSectionGroup(e.target.value as SectionGroup)
                  }
                  className={SELECT_CLS}
                >
                  {SECTION_DIVIDERS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label size="sm" className="text-caption">
                  Category
                </Label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as TaskType)}
                  className={SELECT_CLS}
                >
                  <option value="College">College</option>
                  <option value="School">School</option>
                  <option value="Personal">Personal</option>
                  <option value="Club">Club</option>
                  <option value="Work">Work</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label size="sm" className="text-caption">
                  Priority
                </Label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className={SELECT_CLS}
                >
                  <option value="Urgent">Urgent</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <Label size="sm" className="text-caption">
                  Due Date
                </Label>
                <Input
                  type="date"
                  variant="soft"
                  size="sm"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label size="sm" className="text-caption">
                  Est. Time (Minutes)
                </Label>
                <Input
                  type="number"
                  variant="soft"
                  size="sm"
                  min={5}
                  max={480}
                  step={5}
                  value={estimatedMinutes}
                  onChange={(e) =>
                    setEstimatedMinutes(parseInt(e.target.value, 10) || 30)
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <Label size="sm" className="text-caption">
                  Tags
                </Label>
                <Input
                  type="text"
                  variant="soft"
                  size="sm"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="#LinearAlgebra #FBLA"
                />
              </div>
              <div className="space-y-1">
                <Label size="sm" className="text-caption">
                  Quick Note
                </Label>
                <Input
                  type="text"
                  variant="soft"
                  size="sm"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Chapter 4 problems 1-15..."
                />
              </div>
            </div>

            <Dialog.Actions className="pt-3 border-t border-[--ui-border-color] flex items-center justify-end gap-2">
              <Button.Root
                type="button"
                variant="soft"
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
                className="shadow-neon"
              >
                <Button.Icon type="leading">
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </Button.Icon>
                <Button.Label>Create Task</Button.Label>
              </Button.Root>
            </Dialog.Actions>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

