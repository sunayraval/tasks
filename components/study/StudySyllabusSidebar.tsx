"use client";

import React, { useState } from "react";
import {
  StudyModule,
  StudySubtopic,
  StudySyllabus,
  computeSyllabusProgress,
} from "@/types/study";
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  FastForward,
  Pencil,
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

export const StudySyllabusSidebar: React.FC<StudySyllabusSidebarProps> = ({
  syllabus,
  isBusy,
  onRenameModule,
  onDeleteModule,
  onAddModule,
  onRenameSubtopic,
  onDeleteSubtopic,
  onMoveSubtopic,
  onAddSubtopic,
  onToggleSkipKnown,
  onSelectActiveSubtopic,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");
  const [addingToModuleId, setAddingToModuleId] = useState<string | null>(null);
  const [newSubtopicTitle, setNewSubtopicTitle] = useState<string>("");
  const [newModuleTitle, setNewModuleTitle] = useState<string>("");
  const [showAddModule, setShowAddModule] = useState<boolean>(false);

  const progress = computeSyllabusProgress(syllabus);

  const startEdit = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditingText(title);
  };

  return (
    <aside
      aria-label="Study Syllabus"
      className="flex flex-col rounded-2xl border theme-panel overflow-hidden"
    >
      {/* Simple Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            Syllabus Outline
          </h3>
          <p className="text-[11px] text-white/50">
            {progress.completedCount} of {progress.totalActive} completed
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModule((v) => !v)}
          className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/80 hover:text-white hover:border-primary/40 transition-colors"
        >
          <Plus className="h-3 w-3 text-primary" />
          <span>Add Section</span>
        </button>
      </div>

      {showAddModule && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newModuleTitle.trim()) return;
            onAddModule(newModuleTitle.trim());
            setNewModuleTitle("");
            setShowAddModule(false);
          }}
          className="border-b border-white/10 bg-black/40 p-3 flex items-center gap-2"
        >
          <input
            type="text"
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            placeholder="New section title..."
            autoFocus
            className="flex-1 rounded-lg border border-white/15 bg-black/60 px-2.5 py-1.5 text-xs text-white focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-black"
          >
            Add
          </button>
        </form>
      )}

      {/* Clean Modules & Subtopics List */}
      <div className="max-h-[calc(100vh-12rem)] overflow-y-auto p-3 space-y-4">
        {syllabus.modules.map((mod: StudyModule) => {
          const isEditingMod = editingId === mod.id;

          return (
            <div key={mod.id} className="space-y-1.5">
              {/* Module Title Row */}
              <div className="group flex items-center justify-between gap-2 px-1">
                {isEditingMod ? (
                  <div className="flex items-center gap-1 flex-1">
                    <input
                      type="text"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          if (editingText.trim()) {
                            onRenameModule(mod.id, editingText.trim());
                          }
                          setEditingId(null);
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                      className="w-full rounded border border-primary bg-black/80 px-2 py-0.5 text-xs font-bold text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (editingText.trim()) {
                          onRenameModule(mod.id, editingText.trim());
                        }
                        setEditingId(null);
                      }}
                      className="p-1 text-primary"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <h4 className="text-xs font-bold text-white/85 truncate">
                    {mod.title}
                  </h4>
                )}

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => startEdit(mod.id, mod.title, e)}
                    className="rounded p-1 text-white/40 hover:text-white"
                    title="Rename section"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingToModuleId(
                        addingToModuleId === mod.id ? null : mod.id
                      );
                      setNewSubtopicTitle("");
                    }}
                    className="rounded p-1 text-white/40 hover:text-primary"
                    title="Add topic to this section"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteModule(mod.id)}
                    className="rounded p-1 text-white/40 hover:text-rose-400"
                    title="Remove section"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Subtopic Items */}
              <div className="space-y-1">
                {mod.subtopics.map((sub: StudySubtopic, sIdx: number) => {
                  const isActive = sub.state === "in_progress";
                  const isMastered = sub.state === "mastered";
                  const isKnown = sub.state === "skipped_known";
                  const isEditingSub = editingId === sub.id;

                  return (
                    <div
                      key={sub.id}
                      onClick={() => {
                        if (!isEditingSub && !isBusy) {
                          onSelectActiveSubtopic(sub.id);
                        }
                      }}
                      className={`group flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs transition-all cursor-pointer ${
                        isActive
                          ? "border-primary/60 bg-primary/15 text-white font-semibold shadow-sm"
                          : isMastered
                          ? "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-200"
                          : isKnown
                          ? "border-amber-400/25 bg-amber-500/[0.05] text-white/50 line-through"
                          : "border-transparent bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07] hover:text-white"
                      }`}
                    >
                      {/* Left Status Dot / Check + Title */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {isMastered ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        ) : isKnown ? (
                          <FastForward className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                        ) : isActive ? (
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0 animate-pulse"
                            style={{ backgroundColor: "var(--primary)" }}
                          />
                        ) : (
                          <span className="h-2 w-2 rounded-full border border-white/30 shrink-0" />
                        )}

                        {isEditingSub ? (
                          <div
                            className="flex items-center gap-1 flex-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  if (editingText.trim()) {
                                    onRenameSubtopic(
                                      mod.id,
                                      sub.id,
                                      editingText.trim()
                                    );
                                  }
                                  setEditingId(null);
                                }
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              autoFocus
                              className="w-full rounded border border-primary bg-black/80 px-2 py-0.5 text-xs text-white focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (editingText.trim()) {
                                  onRenameSubtopic(
                                    mod.id,
                                    sub.id,
                                    editingText.trim()
                                  );
                                }
                                setEditingId(null);
                              }}
                              className="p-0.5 text-primary"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="truncate">{sub.title}</span>
                        )}
                      </div>

                      {/* Right Hover Actions: Skip (Know it), Edit, Move, Remove */}
                      <div
                        className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => onToggleSkipKnown(sub.id)}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                            isKnown
                              ? "bg-amber-500/20 text-amber-200"
                              : "bg-white/10 text-white/70 hover:text-white"
                          }`}
                          title={
                            isKnown
                              ? "Restore topic"
                              : "I already know this (skip)"
                          }
                        >
                          {isKnown ? "Undo" : "Skip"}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => startEdit(sub.id, sub.title, e)}
                          className="rounded p-1 text-white/45 hover:text-white"
                          title="Rename"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>

                        {sIdx > 0 && (
                          <button
                            type="button"
                            onClick={() => onMoveSubtopic(mod.id, sub.id, "up")}
                            className="rounded p-0.5 text-white/45 hover:text-white"
                            title="Move up"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                        )}
                        {sIdx < mod.subtopics.length - 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              onMoveSubtopic(mod.id, sub.id, "down")
                            }
                            className="rounded p-0.5 text-white/45 hover:text-white"
                            title="Move down"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onDeleteSubtopic(mod.id, sub.id)}
                          className="rounded p-1 text-white/45 hover:text-rose-400"
                          title="Remove topic"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Inline Add Topic Input */}
                {addingToModuleId === mod.id && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newSubtopicTitle.trim()) return;
                      onAddSubtopic(mod.id, newSubtopicTitle.trim());
                      setNewSubtopicTitle("");
                      setAddingToModuleId(null);
                    }}
                    className="flex items-center gap-1.5 pt-1"
                  >
                    <input
                      type="text"
                      value={newSubtopicTitle}
                      onChange={(e) => setNewSubtopicTitle(e.target.value)}
                      placeholder="New topic name..."
                      autoFocus
                      className="flex-1 rounded-lg border border-white/15 bg-black/60 px-2.5 py-1.5 text-xs text-white focus:border-primary focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-black"
                    >
                      Add
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
