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
import { Button, Card, Input, Title } from "@/components/tailus-ui";

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
    <Card
      variant="mixed"
      fancy
      aria-label="Study Syllabus"
      className="p-0 flex flex-col backdrop-blur-2xl overflow-hidden"
    >
      {/* Simple Header */}
      <div className="flex items-center justify-between border-b border-[--ui-border-color] px-4 py-3 bg-[--ui-soft-bg]/50">
        <div>
          <Title as="h3" size="base" weight="semibold" className="text-xs uppercase tracking-wider">
            Syllabus Outline
          </Title>
          <p className="text-[11px] text-caption">
            {progress.completedCount} of {progress.totalActive} completed
          </p>
        </div>
        <Button.Root
          variant="outlined"
          intent="gray"
          size="xs"
          onClick={() => setShowAddModule((v) => !v)}
          className="h-7 px-2.5 text-[11px]"
        >
          <Button.Icon type="leading" size="xs">
            <Plus className="text-primary-400" />
          </Button.Icon>
          <Button.Label>Add Section</Button.Label>
        </Button.Root>
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
          className="border-b border-[--ui-border-color] bg-[--ui-soft-bg]/50 p-3 flex items-center gap-2"
        >
          <Input
            type="text"
            variant="outlined"
            size="sm"
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            placeholder="New section title..."
            autoFocus
            className="flex-1"
          />
          <Button.Root
            type="submit"
            variant="solid"
            intent="primary"
            size="sm"
            className="font-semibold"
          >
            <Button.Label>Add</Button.Label>
          </Button.Root>
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
                    <Input
                      type="text"
                      variant="outlined"
                      size="sm"
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
                      className="h-7 text-xs font-semibold"
                    />
                    <Button.Root
                      variant="ghost"
                      intent="primary"
                      size="xs"
                      onClick={() => {
                        if (editingText.trim()) {
                          onRenameModule(mod.id, editingText.trim());
                        }
                        setEditingId(null);
                      }}
                    >
                      <Button.Icon type="only" size="xs">
                        <Check />
                      </Button.Icon>
                    </Button.Root>
                  </div>
                ) : (
                  <h4 className="text-xs font-semibold text-title truncate">
                    {mod.title}
                  </h4>
                )}

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => startEdit(mod.id, mod.title, e)}
                    className="rounded p-1 text-caption hover:text-title"
                    title="Rename section"
                  >
                    <Pencil className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingToModuleId(
                        addingToModuleId === mod.id ? null : mod.id
                      );
                      setNewSubtopicTitle("");
                    }}
                    className="rounded p-1 text-caption hover:text-primary-400"
                    title="Add topic to this section"
                  >
                    <Plus className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteModule(mod.id)}
                    className="rounded p-1 text-caption hover:text-danger-400"
                    title="Remove section"
                  >
                    <Trash2 className="size-3" />
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
                      className={`group flex items-center justify-between gap-2 rounded-[--btn-radius] border px-3 py-2 text-xs transition-all cursor-pointer ${
                        isActive
                          ? "border-primary-500/60 bg-primary-500/15 text-title font-semibold shadow-sm"
                          : isMastered
                          ? "border-success-500/25 bg-success-500/10 text-success-200"
                          : isKnown
                          ? "border-warning-500/25 bg-warning-500/5 text-caption line-through"
                          : "border-transparent bg-[--ui-soft-bg]/40 text-body hover:bg-[--ui-soft-bg] hover:text-title"
                      }`}
                    >
                      {/* Left Status Dot / Check + Title */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {isMastered ? (
                          <CheckCircle2 className="size-4 text-success-400 shrink-0" />
                        ) : isKnown ? (
                          <FastForward className="size-3.5 text-warning-300 shrink-0" />
                        ) : isActive ? (
                          <span
                            className="size-2.5 rounded-full shrink-0 animate-pulse"
                            style={{ backgroundColor: "var(--primary)" }}
                          />
                        ) : (
                          <span className="size-2 rounded-full border border-gray-500 shrink-0" />
                        )}

                        {isEditingSub ? (
                          <div
                            className="flex items-center gap-1 flex-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Input
                              type="text"
                              variant="outlined"
                              size="sm"
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
                              className="h-6 text-xs"
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
                              className="p-0.5 text-primary-400"
                            >
                              <Check className="size-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="truncate">{sub.title}</span>
                        )}
                      </div>

                      {/* Right Hover Actions */}
                      <div
                        className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => onToggleSkipKnown(sub.id)}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                            isKnown
                              ? "bg-warning-500/20 text-warning-200"
                              : "bg-[--ui-bg] text-caption hover:text-title"
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
                          className="rounded p-1 text-caption hover:text-title"
                          title="Rename"
                        >
                          <Pencil className="size-3" />
                        </button>

                        {sIdx > 0 && (
                          <button
                            type="button"
                            onClick={() => onMoveSubtopic(mod.id, sub.id, "up")}
                            className="rounded p-0.5 text-caption hover:text-title"
                            title="Move up"
                          >
                            <ArrowUp className="size-3" />
                          </button>
                        )}
                        {sIdx < mod.subtopics.length - 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              onMoveSubtopic(mod.id, sub.id, "down")
                            }
                            className="rounded p-0.5 text-caption hover:text-title"
                            title="Move down"
                          >
                            <ArrowDown className="size-3" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onDeleteSubtopic(mod.id, sub.id)}
                          className="rounded p-1 text-caption hover:text-danger-400"
                          title="Remove topic"
                        >
                          <X className="size-3.5" />
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
                    <Input
                      type="text"
                      variant="outlined"
                      size="sm"
                      value={newSubtopicTitle}
                      onChange={(e) => setNewSubtopicTitle(e.target.value)}
                      placeholder="New topic name..."
                      autoFocus
                      className="flex-1"
                    />
                    <Button.Root
                      type="submit"
                      variant="solid"
                      intent="primary"
                      size="sm"
                      className="font-semibold"
                    >
                      <Button.Label>Add</Button.Label>
                    </Button.Root>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
