"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItemExtension from "@tiptap/extension-task-item";
import CodeBlock from "@tiptap/extension-code-block";
import Placeholder from "@tiptap/extension-placeholder";
import {
  TaskItem,
  TaskPriority,
  TaskStatus,
  TaskType,
  SectionGroup,
  ViewMode,
  WorkspaceConfig,
  DEFAULT_WORKSPACE_CONFIG,
  getBadgeClasses,
} from "@/types/taskit";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  Heading1,
  Heading2,
  Quote,
  X,
  Clock,
  Calendar,
  Tag,
  Trash2,
  Check,
  BookOpen,
} from "lucide-react";

interface TaskDocumentEditorProps {
  task: TaskItem | null;
  viewMode: ViewMode;
  workspaceConfig?: WorkspaceConfig;
  onClose: () => void;
  onUpdateTask: (taskId: string, updates: Partial<TaskItem>) => void;
  onDeleteTask: (taskId: string) => void;
}

export const TaskDocumentEditor: React.FC<TaskDocumentEditorProps> = ({
  task,
  viewMode,
  workspaceConfig = DEFAULT_WORKSPACE_CONFIG,
  onClose,
  onUpdateTask,
  onDeleteTask,
}) => {
  const [title, setTitle] = useState(task?.title || "");
  const [notes, setNotes] = useState(task?.notes || "");
  const [newTag, setNewTag] = useState("");
  const [saveIndicator, setSaveIndicator] = useState<"saved" | "saving">(
    "saved"
  );

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setNotes(task.notes || "");
    }
  }, [task]);

  const debouncedSaveContent = useCallback(
    (taskId: string, html: string) => {
      setSaveIndicator("saving");
      const timer = setTimeout(() => {
        onUpdateTask(taskId, {
          content: html,
          updated_at: new Date().toISOString(),
        });
        setSaveIndicator("saved");
      }, 450);
      return () => clearTimeout(timer);
    },
    [onUpdateTask]
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      TaskList,
      TaskItemExtension.configure({
        nested: true,
      }),
      CodeBlock,
      Placeholder.configure({
        placeholder:
          "Write rich notes, checklists, code snippets, or lecture takeaways...",
      }),
    ],
    content: task?.content || "",
    onUpdate: ({ editor: ed }) => {
      if (task) {
        debouncedSaveContent(task.id, ed.getHTML());
      }
    },
  });

  useEffect(() => {
    if (editor && task) {
      const currentHTML = editor.getHTML();
      if (currentHTML !== (task.content || "")) {
        editor.commands.setContent(task.content || "", false);
      }
    }
  }, [task?.id, editor, task]);

  if (!task) return null;

  const handleTitleBlur = () => {
    if (title.trim() && title !== task.title) {
      onUpdateTask(task.id, { title: title.trim() });
    }
  };

  const handleNotesBlur = () => {
    if (notes !== task.notes) {
      onUpdateTask(task.id, { notes });
    }
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newTag.trim();
    if (!cleaned) return;
    const formatted = cleaned.startsWith("#") ? cleaned : `#${cleaned}`;
    if (!task.tags.includes(formatted)) {
      onUpdateTask(task.id, { tags: [...task.tags, formatted] });
    }
    setNewTag("");
  };

  const handleToggleTag = (tagLabel: string) => {
    if (task.tags.includes(tagLabel)) {
      onUpdateTask(task.id, {
        tags: task.tags.filter((t) => t !== tagLabel),
      });
    } else {
      onUpdateTask(task.id, {
        tags: [...task.tags, tagLabel],
      });
    }
  };

  const innerContent = (
    <div className="flex flex-col h-full text-white">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 theme-header-bg">
        <div className="flex items-center gap-2.5 text-xs text-white/60">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="uppercase tracking-wider font-semibold text-highlight">
            {task.section_group}
          </span>
          {task.is_canvas_assignment && (
            <span className="rounded-full bg-orange-500/20 border border-orange-400/40 px-2.5 py-0.5 text-[11px] font-medium text-orange-300">
              Canvas • {task.canvas_course_code || "HCPSS"}
            </span>
          )}
          <span className="ml-2 flex items-center gap-1 text-[11px] text-emerald-400/90">
            <Check className="w-3 h-3" />
            {saveIndicator === "saving" ? "Syncing..." : "Auto-saved"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onDeleteTask(task.id);
              onClose();
            }}
            className="rounded-lg p-1.5 text-white/50 hover:bg-red-500/20 hover:text-red-300 transition-colors"
            title="Delete Task"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
            title="Close Document"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable Document Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Editable Title */}
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="Task title..."
            className="w-full bg-transparent text-xl sm:text-2xl font-bold text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-primary/50 rounded-lg px-2 py-1 -mx-2"
          />
        </div>

        {/* Notion-Style Property Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs">
          {/* Status */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-white/50 font-medium">
              {workspaceConfig.columnHeaders.status}
            </span>
            <select
              value={task.status}
              onChange={(e) =>
                onUpdateTask(task.id, {
                  status: e.target.value as TaskStatus,
                  completed_at:
                    e.target.value === "Done" ? new Date().toISOString() : null,
                })
              }
              className="rounded-lg border border-white/15 bg-black/60 px-2.5 py-1.5 text-xs font-medium text-white focus:border-primary focus:outline-none"
            >
              {workspaceConfig.statuses.map((s) => (
                <option key={s.id} value={s.label}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-white/50 font-medium">
              {workspaceConfig.columnHeaders.priority}
            </span>
            <select
              value={task.priority}
              onChange={(e) =>
                onUpdateTask(task.id, {
                  priority: e.target.value as TaskPriority,
                })
              }
              className="rounded-lg border border-white/15 bg-black/60 px-2.5 py-1.5 text-xs font-medium text-white focus:border-primary focus:outline-none"
            >
              {workspaceConfig.priorities.map((p) => (
                <option key={p.id} value={p.label}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Type / Category */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-white/50 font-medium">
              {workspaceConfig.columnHeaders.type}
            </span>
            <select
              value={task.type}
              onChange={(e) =>
                onUpdateTask(task.id, { type: e.target.value as TaskType })
              }
              className="rounded-lg border border-white/15 bg-black/60 px-2.5 py-1.5 text-xs font-medium text-white focus:border-primary focus:outline-none"
            >
              {workspaceConfig.types.map((t) => (
                <option key={t.id} value={t.label}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Section Group */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-white/50 font-medium">Section Divider</span>
            <select
              value={task.section_group}
              onChange={(e) =>
                onUpdateTask(task.id, {
                  section_group: e.target.value as SectionGroup,
                })
              }
              className="rounded-lg border border-white/15 bg-black/60 px-2.5 py-1.5 text-xs font-medium text-white focus:border-primary focus:outline-none"
            >
              {workspaceConfig.sections.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.label}
                </option>
              ))}
            </select>
          </div>

          {/* Due Date */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-white/50 font-medium flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />{" "}
              {workspaceConfig.columnHeaders.due_date}
            </span>
            <input
              type="date"
              value={
                task.due_date
                  ? new Date(task.due_date).toISOString().split("T")[0]
                  : ""
              }
              onChange={(e) => {
                const val = e.target.value;
                onUpdateTask(task.id, {
                  due_date: val
                    ? new Date(`${val}T23:59:00`).toISOString()
                    : null,
                });
              }}
              className="rounded-lg border border-white/15 bg-black/60 px-2.5 py-1 text-xs text-white focus:border-primary focus:outline-none"
            />
          </div>

          {/* Estimated Time */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-white/50 font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />{" "}
              {workspaceConfig.columnHeaders.estimated_minutes}
            </span>
            <input
              type="number"
              min={5}
              max={600}
              step={5}
              value={task.estimated_minutes || 30}
              onChange={(e) =>
                onUpdateTask(task.id, {
                  estimated_minutes: Math.max(
                    5,
                    parseInt(e.target.value) || 30
                  ),
                })
              }
              className="w-24 rounded-lg border border-white/15 bg-black/60 px-2.5 py-1 text-xs text-right text-white focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Tags Bar with Dropdown Selection */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-white/50 flex items-center gap-1 mr-1">
              <Tag className="w-3.5 h-3.5" />{" "}
              {workspaceConfig.columnHeaders.tags}:
            </span>
            {workspaceConfig.tags.map((tagOpt) => {
              const isSelected = task.tags.includes(tagOpt.label);
              return (
                <button
                  key={tagOpt.id}
                  type="button"
                  onClick={() => handleToggleTag(tagOpt.label)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all ${
                    isSelected
                      ? `${getBadgeClasses(tagOpt.color)} ring-1 ring-white/40`
                      : "border-white/10 bg-white/5 text-white/45 hover:text-white/80"
                  }`}
                >
                  {tagOpt.label}
                  {isSelected && <Check className="w-3 h-3" />}
                </button>
              );
            })}
            <form onSubmit={handleAddTag} className="inline-flex">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="+ Custom tag..."
                className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs text-white placeholder-white/40 focus:border-primary focus:outline-none w-28"
              />
            </form>
          </div>

          {/* Quick Preview Note */}
          <div>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Quick summary note (displayed in table row)..."
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/85 placeholder-white/35 focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {/* TipTap Formatting Toolbar */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-black/50 p-1.5">
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleBold().run()}
              className={`p-1.5 rounded-lg transition-colors ${
                editor?.isActive("bold")
                  ? "bg-primary/30 text-highlight"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
              title="Bold"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded-lg transition-colors ${
                editor?.isActive("italic")
                  ? "bg-primary/30 text-highlight"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
              title="Italic"
            >
              <Italic className="w-4 h-4" />
            </button>
            <div className="h-4 w-[1px] bg-white/10 mx-1" />
            <button
              type="button"
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 1 }).run()
              }
              className={`p-1.5 rounded-lg transition-colors ${
                editor?.isActive("heading", { level: 1 })
                  ? "bg-primary/30 text-highlight"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
              title="Heading 1"
            >
              <Heading1 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                editor?.chain().focus().toggleHeading({ level: 2 }).run()
              }
              className={`p-1.5 rounded-lg transition-colors ${
                editor?.isActive("heading", { level: 2 })
                  ? "bg-primary/30 text-highlight"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
              title="Heading 2"
            >
              <Heading2 className="w-4 h-4" />
            </button>
            <div className="h-4 w-[1px] bg-white/10 mx-1" />
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              className={`p-1.5 rounded-lg transition-colors ${
                editor?.isActive("bulletList")
                  ? "bg-primary/30 text-highlight"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
              title="Bullet List"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              className={`p-1.5 rounded-lg transition-colors ${
                editor?.isActive("orderedList")
                  ? "bg-primary/30 text-highlight"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
              title="Numbered List"
            >
              <ListOrdered className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleTaskList().run()}
              className={`p-1.5 rounded-lg transition-colors ${
                editor?.isActive("taskList")
                  ? "bg-primary/30 text-highlight"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
              title="Interactive Checklist"
            >
              <CheckSquare className="w-4 h-4" />
            </button>
            <div className="h-4 w-[1px] bg-white/10 mx-1" />
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
              className={`p-1.5 rounded-lg transition-colors ${
                editor?.isActive("codeBlock")
                  ? "bg-primary/30 text-highlight"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
              title="Code Block"
            >
              <Code className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
              className={`p-1.5 rounded-lg transition-colors ${
                editor?.isActive("blockquote")
                  ? "bg-primary/30 text-highlight"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
              title="Quote"
            >
              <Quote className="w-4 h-4" />
            </button>
          </div>

          {/* TipTap Rich Text Surface */}
          <div className="tiptap-editor rounded-xl border border-white/10 bg-black/40 p-4 min-h-[280px] focus-within:border-primary/60 transition-colors">
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </div>
  );

  if (viewMode === "inline") {
    return (
      <div className="my-2 rounded-2xl border border-primary/40 theme-panel backdrop-blur-2xl shadow-neon overflow-hidden">
        {innerContent}
      </div>
    );
  }

  if (viewMode === "center_modal") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div
          className="relative w-full max-w-3xl max-h-[88vh] rounded-2xl border theme-panel backdrop-blur-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {innerContent}
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl lg:max-w-2xl h-full border-l theme-panel backdrop-blur-2xl shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {innerContent}
      </div>
    </div>
  );
};
