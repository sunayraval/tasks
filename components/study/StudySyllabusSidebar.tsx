"use client";

import React, { useState } from "react";
import {
  StudyModule,
  StudySubtopic,
  StudySubtopicState,
  StudySyllabus,
  computeSyllabusProgress,
} from "@/types/study";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FastForward,
  GripVertical,
  Lock,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";

interface StudySyllabusSidebarProps {
  syllabus: StudySyllabus;
  isBusy: boolean;
  onRenameModule: (moduleId: string, newTitle: string) => void;
  onDeleteModule: (moduleId: string) => void;
  onMoveModule: (moduleId: string, direction: "up" | "down") => void;
  onAddModule: (title: string) => void;
  onRenameSubtopic: (
    moduleId: string,
    subtopicId: string,
    newTitle: string
  ) => void;
  onDeleteSubtopic: (moduleId: string, subtopicId: string) => void;
  onMoveSubtopic: (
    moduleId: string,
    subtopicId: string,
    direction: "up" | "down"
  ) => void;
  onReorderSubtopicDrag: (
    moduleId: string,
    fromIndex: number,
    toIndex: number
  ) => void;
  onAddSubtopic: (moduleId: string, title: string) => void;
  onToggleSkipKnown: (subtopicId: string) => void;
  onSelectActiveSubtopic: (subtopicId: string) => void;
}

const STATE_BADGE_META: Record<
  StudySubtopicState,
  {
    label: string;
    shortLabel: string;
    classes: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  in_progress: {
    label: "Teaching Now",
    shortLabel: "Active",
    classes:
      "border-primary/60 bg-primary/20 text-highlight shadow-[0_0_12px_rgba(0,229,255,0.2)]",
    icon: Play,
  },
  mastered: {
    label: "Mastered",
    shortLabel: "Mastered",
    classes: "border-emerald-500/45 bg-emerald-500/15 text-emerald-300",
    icon: CheckCircle2,
  },
  skipped_known: {
    label: "Already Known",
    shortLabel: "Known",
    classes: "border-amber-400/45 bg-amber-500/15 text-amber-200",
    icon: FastForward,
  },
  locked: {
    label: "Upcoming",
    shortLabel: "Locked",
    classes: "border-white/15 bg-white/5 text-white/50",
    icon: Lock,
  },
};

export const StudySyllabusSidebar: React.FC<StudySyllabusSidebarProps> = ({
  syllabus,
  isBusy,
  onRenameModule,
  onDeleteModule,
  onMoveModule,
  onAddModule,
  onRenameSubtopic,
  onDeleteSubtopic,
  onMoveSubtopic,
  onReorderSubtopicDrag,
  onAddSubtopic,
  onToggleSkipKnown,
  onSelectActiveSubtopic,
}) => {
  const [collapsedModules, setCollapsedModules] = useState<
    Record<string, boolean>
  >({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");

  const [addingSubtopicForModule, setAddingSubtopicForModule] = useState<
    string | null
  >(null);
  const [newSubtopicTitle, setNewSubtopicTitle] = useState<string>("");

  const [isAddingModule, setIsAddingModule] = useState<boolean>(false);
  const [newModuleTitle, setNewModuleTitle] = useState<string>("");

  const [dragState, setDragState] = useState<{
    moduleId: string;
    index: number;
  } | null>(null);

  const progress = computeSyllabusProgress(syllabus);

  const toggleModuleCollapse = (modId: string) => {
    setCollapsedModules((prev) => ({ ...prev, [modId]: !prev[modId] }));
  };

  const startEdit = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditingText(currentTitle);
  };

  const commitModuleRename = (modId: string) => {
    if (editingText.trim()) {
      onRenameModule(modId, editingText.trim());
    }
    setEditingId(null);
  };

  const commitSubtopicRename = (modId: string, subId: string) => {
    if (editingText.trim()) {
      onRenameSubtopic(modId, subId, editingText.trim());
    }
    setEditingId(null);
  };

  const handleCreateSubtopic = (modId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtopicTitle.trim()) return;
    onAddSubtopic(modId, newSubtopicTitle.trim());
    setNewSubtopicTitle("");
    setAddingSubtopicForModule(null);
  };

  const handleCreateModule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleTitle.trim()) return;
    onAddModule(newModuleTitle.trim());
    setNewModuleTitle("");
    setIsAddingModule(false);
  };

  return (
    <aside
      aria-label="Master Study Syllabus"
      className="flex flex-col h-full rounded-2xl border theme-panel backdrop-blur-2xl overflow-hidden"
    >
      {/* Sidebar Header */}
      <div className="border-b border-white/10 bg-white/[0.03] px-4 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/20 border border-primary/40">
              <BookOpen className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-white truncate">
                Master Syllabus
              </h3>
              <p className="text-[11px] text-white/55 truncate">
                Click to edit, skip, reorder, or prune
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAddingModule((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-highlight hover:bg-primary/25 transition-colors shrink-0"
            title="Add a new module to the curriculum"
          >
            <Plus className="h-3 w-3" />
            <span>Module</span>
          </button>
        </div>

        {/* Status Legend Pills */}
        <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[10px] font-mono">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-1 text-emerald-300">
            <span className="font-bold">{progress.masteredCount}</span> Done
          </div>
          <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-1.5 py-1 text-amber-200">
            <span className="font-bold">{progress.skippedKnownCount}</span>{" "}
            Known
          </div>
          <div className="rounded-lg border border-primary/35 bg-primary/15 px-1.5 py-1 text-highlight">
            <span className="font-bold">{progress.inProgressCount}</span> Active
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-1.5 py-1 text-white/60">
            <span className="font-bold">{progress.lockedCount}</span> Left
          </div>
        </div>

        {/* Add Module Inline Form */}
        {isAddingModule && (
          <form onSubmit={handleCreateModule} className="mt-3 space-y-2">
            <input
              type="text"
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
              placeholder="New module title..."
              autoFocus
              className="w-full rounded-lg border border-white/20 bg-black/50 px-2.5 py-1.5 text-xs text-white placeholder:text-white/35 focus:border-primary focus:outline-none"
            />
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setIsAddingModule(false)}
                className="rounded-lg px-2 py-1 text-[11px] text-white/60 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-black"
              >
                Add Module
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Scrollable Modules & Subtopics List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {syllabus.modules.map((mod: StudyModule, mIdx: number) => {
          const isCollapsed = Boolean(collapsedModules[mod.id]);
          const isEditingMod = editingId === mod.id;
          const modCompleted = mod.subtopics.filter(
            (s) => s.state === "mastered" || s.state === "skipped_known"
          ).length;

          return (
            <div
              key={mod.id}
              className="rounded-xl border border-white/12 bg-black/35 overflow-hidden"
            >
              {/* Module Header */}
              <div className="flex items-center justify-between gap-1.5 border-b border-white/10 bg-white/[0.04] px-3 py-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => toggleModuleCollapse(mod.id)}
                    className="rounded p-0.5 text-white/60 hover:text-white shrink-0"
                    title={isCollapsed ? "Expand module" : "Collapse module"}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>

                  {isEditingMod ? (
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitModuleRename(mod.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        autoFocus
                        className="w-full rounded border border-primary bg-black/70 px-2 py-0.5 text-xs font-semibold text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => commitModuleRename(mod.id)}
                        className="rounded bg-primary/20 p-1 text-primary hover:bg-primary/30"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleModuleCollapse(mod.id)}
                      className="text-left text-xs font-bold text-white hover:text-highlight truncate flex-1"
                      title={mod.title}
                    >
                      {mod.title}
                    </button>
                  )}
                </div>

                {/* Module Controls */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <span className="mr-1 rounded-full bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/65">
                    {modCompleted}/{mod.subtopics.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(mod.id, mod.title)}
                    className="rounded p-1 text-white/45 hover:bg-white/10 hover:text-white transition-colors"
                    title="Rename module"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    disabled={mIdx === 0}
                    onClick={() => onMoveModule(mod.id, "up")}
                    className="rounded p-1 text-white/45 hover:bg-white/10 hover:text-white disabled:opacity-25 transition-colors"
                    title="Move module up"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    disabled={mIdx === syllabus.modules.length - 1}
                    onClick={() => onMoveModule(mod.id, "down")}
                    className="rounded p-1 text-white/45 hover:bg-white/10 hover:text-white disabled:opacity-25 transition-colors"
                    title="Move module down"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteModule(mod.id)}
                    className="rounded p-1 text-white/45 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
                    title="Don't want to learn this module (Delete)"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Subtopics List */}
              {!isCollapsed && (
                <div className="divide-y divide-white/5 p-1.5 space-y-1">
                  {mod.subtopics.map((sub: StudySubtopic, sIdx: number) => {
                    const meta = STATE_BADGE_META[sub.state];
                    const StateIcon = meta.icon;
                    const isEditingSub = editingId === sub.id;
                    const isActive = sub.state === "in_progress";

                    return (
                      <div
                        key={sub.id}
                        draggable={!isEditingSub}
                        onDragStart={() =>
                          setDragState({ moduleId: mod.id, index: sIdx })
                        }
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (
                            dragState &&
                            dragState.moduleId === mod.id &&
                            dragState.index !== sIdx
                          ) {
                            onReorderSubtopicDrag(
                              mod.id,
                              dragState.index,
                              sIdx
                            );
                          }
                          setDragState(null);
                        }}
                        className={`group rounded-xl border p-2.5 transition-all ${
                          isActive
                            ? "border-primary/55 bg-primary/[0.12] shadow-sm"
                            : sub.state === "mastered"
                            ? "border-emerald-500/25 bg-emerald-500/[0.05]"
                            : sub.state === "skipped_known"
                            ? "border-amber-400/25 bg-amber-500/[0.05] opacity-85"
                            : "border-transparent bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className="mt-1 cursor-grab text-white/25 hover:text-white/60 shrink-0"
                            title="Drag to reorder"
                          >
                            <GripVertical className="h-3.5 w-3.5" />
                          </span>

                          {/* Subtopic Title or Inline Rename Input */}
                          <div className="flex-1 min-w-0">
                            {isEditingSub ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editingText}
                                  onChange={(e) =>
                                    setEditingText(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      commitSubtopicRename(mod.id, sub.id);
                                    if (e.key === "Escape") setEditingId(null);
                                  }}
                                  autoFocus
                                  className="w-full rounded border border-primary bg-black/80 px-2 py-1 text-xs text-white focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    commitSubtopicRename(mod.id, sub.id)
                                  }
                                  className="rounded bg-primary/25 p-1 text-primary"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="rounded bg-white/10 p-1 text-white/60"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => onSelectActiveSubtopic(sub.id)}
                                className="w-full text-left group/title"
                                title="Click to study this subtopic now"
                              >
                                <div
                                  className={`text-xs font-semibold leading-snug ${
                                    sub.state === "skipped_known"
                                      ? "line-through text-amber-200/80"
                                      : sub.state === "mastered"
                                      ? "text-emerald-200"
                                      : isActive
                                      ? "text-white"
                                      : "text-zinc-200 group-hover/title:text-white"
                                  }`}
                                >
                                  {sub.title}
                                </div>
                              </button>
                            )}

                            {/* Subtopic Status Pill & Quick Actions Row */}
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono font-semibold ${meta.classes}`}
                              >
                                <StateIcon className="h-2.5 w-2.5" />
                                {meta.shortLabel}
                              </span>

                              {/* Quick Action Controls: Already Known, Rename, Move Up/Down, Delete */}
                              <div className="flex items-center gap-0.5">
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => onToggleSkipKnown(sub.id)}
                                  className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                                    sub.state === "skipped_known"
                                      ? "border-amber-400/50 bg-amber-500/20 text-amber-200"
                                      : "border-white/10 bg-white/5 text-white/60 hover:text-white hover:border-amber-400/40"
                                  }`}
                                  title={
                                    sub.state === "skipped_known"
                                      ? "Unmark as already known"
                                      : "I already know this (skip & count toward progress)"
                                  }
                                >
                                  <FastForward className="h-2.5 w-2.5" />
                                  <span>
                                    {sub.state === "skipped_known"
                                      ? "Known ✓"
                                      : "Know it"}
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => startEdit(sub.id, sub.title)}
                                  className="rounded p-1 text-white/45 hover:bg-white/10 hover:text-white transition-colors"
                                  title="Rename subtopic"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>

                                <button
                                  type="button"
                                  disabled={sIdx === 0}
                                  onClick={() =>
                                    onMoveSubtopic(mod.id, sub.id, "up")
                                  }
                                  className="rounded p-1 text-white/45 hover:bg-white/10 hover:text-white disabled:opacity-25 transition-colors"
                                  title="Move subtopic up"
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </button>

                                <button
                                  type="button"
                                  disabled={sIdx === mod.subtopics.length - 1}
                                  onClick={() =>
                                    onMoveSubtopic(mod.id, sub.id, "down")
                                  }
                                  className="rounded p-1 text-white/45 hover:bg-white/10 hover:text-white disabled:opacity-25 transition-colors"
                                  title="Move subtopic down"
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    onDeleteSubtopic(mod.id, sub.id)
                                  }
                                  className="rounded p-1 text-white/45 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
                                  title="Don't want to learn this subtopic (Remove from curriculum)"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add Custom Subtopic Button / Inline Form */}
                  {addingSubtopicForModule === mod.id ? (
                    <form
                      onSubmit={(e) => handleCreateSubtopic(mod.id, e)}
                      className="p-2 space-y-2 rounded-xl border border-primary/30 bg-black/50"
                    >
                      <input
                        type="text"
                        value={newSubtopicTitle}
                        onChange={(e) => setNewSubtopicTitle(e.target.value)}
                        placeholder="Add custom subtopic title..."
                        autoFocus
                        className="w-full rounded-lg border border-white/20 bg-black/70 px-2.5 py-1.5 text-xs text-white placeholder:text-white/35 focus:border-primary focus:outline-none"
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setAddingSubtopicForModule(null)}
                          className="rounded-lg px-2 py-1 text-[11px] text-white/60 hover:text-white"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-black"
                        >
                          Add Subtopic
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAddingSubtopicForModule(mod.id);
                        setNewSubtopicTitle("");
                      }}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 py-1.5 text-[11px] font-medium text-white/55 hover:border-primary/45 hover:text-highlight transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Subtopic</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
