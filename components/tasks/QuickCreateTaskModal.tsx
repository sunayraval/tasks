"use client";

import React, { useState, useEffect } from "react";
import {
  SectionGroup,
  SECTION_DIVIDERS,
  TaskItem,
  TaskPriority,
  TaskType,
} from "@/types/taskit";
import { Command, Plus, X } from "lucide-react";

interface QuickCreateTaskModalProps {
  isOpen: boolean;
  defaultSection?: SectionGroup;
  onClose: () => void;
  onCreateTask: (newTask: Omit<TaskItem, "id" | "created_at" | "updated_at">) => void;
  userId: string;
}

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

  if (!isOpen) return null;

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
    });

    setTitle("");
    setNotes("");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2.5 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-primary/40 bg-[#061217]/95 backdrop-blur-2xl p-4 sm:p-6 max-h-[94vh] overflow-y-auto shadow-neon animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-highlight">
            <Command className="w-4 h-4 text-primary" />
            <span>Quick Command • New Task (⌘K)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/50 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <input
              type="text"
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to get done? (e.g. Complete Calc III Problem Set)"
              className="w-full rounded-xl border border-white/15 bg-white/[0.05] px-4 py-3 text-sm font-medium text-white placeholder-white/35 focus:border-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-white/50 mb-1">Section</label>
              <select
                value={sectionGroup}
                onChange={(e) =>
                  setSectionGroup(e.target.value as SectionGroup)
                }
                className="w-full rounded-xl border border-white/15 bg-black/70 px-3 py-2 text-white focus:border-primary focus:outline-none"
              >
                {SECTION_DIVIDERS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-white/50 mb-1">Category</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TaskType)}
                className="w-full rounded-xl border border-white/15 bg-black/70 px-3 py-2 text-white focus:border-primary focus:outline-none"
              >
                <option value="College">College</option>
                <option value="School">School</option>
                <option value="Personal">Personal</option>
                <option value="Club">Club</option>
                <option value="Work">Work</option>
                <option value="General">General</option>
              </select>
            </div>

            <div>
              <label className="block text-white/50 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full rounded-xl border border-white/15 bg-black/70 px-3 py-2 text-white focus:border-primary focus:outline-none"
              >
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-white/50 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/70 px-3 py-2 text-white focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-white/50 mb-1">
                Est. Time (Minutes)
              </label>
              <input
                type="number"
                min={5}
                max={480}
                step={5}
                value={estimatedMinutes}
                onChange={(e) =>
                  setEstimatedMinutes(parseInt(e.target.value, 10) || 30)
                }
                className="w-full rounded-xl border border-white/15 bg-black/70 px-3 py-2 text-white focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-white/50 mb-1">Tags</label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="#LinearAlgebra #FBLA"
                className="w-full rounded-xl border border-white/15 bg-black/70 px-3 py-2 text-white placeholder-white/30 focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-white/50 mb-1">Quick Note</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Chapter 4 problems 1-15..."
                className="w-full rounded-xl border border-white/15 bg-black/70 px-3 py-2 text-white placeholder-white/30 focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/75 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-black shadow-neon hover:brightness-110 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Create Task</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

