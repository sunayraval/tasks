"use client";

import React, { useState, useEffect } from "react";
import {
  AIProvider,
  AITone,
  BADGE_COLOR_KEYS,
  BADGE_COLOR_MAP,
  BadgeColorKey,
  ColumnHeadersConfig,
  CustomOptionItem,
  DEFAULT_NVIDIA_MODEL,
  DEFAULT_WORKSPACE_CONFIG,
  getBadgeClasses,
  NVIDIA_MODEL_OPTIONS,
  THEME_OPTIONS,
  ThemeName,
  UserProfile,
  VideoPresetName,
  ViewMode,
  TaskItem,
  WorkspaceConfig,
  UserMemoryNote,
  MemoryNoteCategory,
} from "@/types/taskit";
import {
  saveCustomVideoToIDB,
  clearCustomVideoFromIDB,
} from "@/components/background/VideoBackground";
import { SharinganIcon } from "@/components/ui/SharinganIcon";
import { SakuraIcon } from "@/components/ui/SakuraIcon";
import {
  Badge,
  Button,
  Caption,
  Card,
  Code,
  Dialog,
  Input,
  Label,
  Switch,
  Text,
  Textarea,
  Title,
} from "@/components/tailus-ui";
import {
  AlertCircle,
  Bot,
  Brain,
  Calendar,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LayoutPanelLeft,
  Loader2,
  Palette,
  Plus,
  RefreshCw,
  Sliders,
  Sparkles,
  Tags,
  Trash2,
  Upload,
  User,
  Video,
  X,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";

export type SettingsTabId =
  | "customize"
  | "appearance"
  | "view"
  | "ai"
  | "memory"
  | "integrations";

interface SettingsModalProps {
  isOpen: boolean;
  initialTab?: SettingsTabId;
  onClose: () => void;
  profile: UserProfile;
  workspaceConfig: WorkspaceConfig;
  tasks: TaskItem[];
  aiTemporarilyDisabled: boolean;
  effectiveApiKey: string;
  onSetAiTemporarilyDisabled: (disabled: boolean) => void;
  onSaveApiKey: (
    key: string | null,
    provider?: AIProvider,
    nvidiaModel?: string
  ) => void;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onUpdateWorkspaceConfig: (updates: Partial<WorkspaceConfig>) => void;
  onCustomVideoUploaded: () => void;
  onOpenCanvasSync?: () => void;
  onSyncCanvasTasks?: (feedUrl: string) => Promise<{
    count: number;
    usedDemoFeed: boolean;
  }>;
}

// Reusable Option List Editor for Tags, Categories, Statuses, Priorities
const OptionGroupEditor: React.FC<{
  title: string;
  subtitle: string;
  items: CustomOptionItem[];
  prefixHash?: boolean;
  onChange: (nextItems: CustomOptionItem[]) => void;
}> = ({ title, subtitle, items, prefixHash = false, onChange }) => {
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState<BadgeColorKey>("cyan");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = newLabel.trim();
    if (!raw) return;
    const formatted =
      prefixHash && !raw.startsWith("#") ? `#${raw}` : raw;
    if (
      items.some(
        (i) => i.label.toLowerCase() === formatted.toLowerCase()
      )
    ) {
      setNewLabel("");
      return;
    }
    onChange([
      ...items,
      { id: formatted, label: formatted, color: newColor },
    ]);
    setNewLabel("");
  };

  const handleUpdateItem = (
    idx: number,
    updates: Partial<CustomOptionItem>
  ) => {
    const next = items.map((item, i) =>
      i === idx
        ? {
            ...item,
            ...updates,
            id: updates.label ? updates.label : item.id,
          }
        : item
    );
    onChange(next);
  };

  const handleDeleteItem = (idx: number) => {
    if (items.length <= 1) return;
    onChange(items.filter((_, i) => i !== idx));
  };

  return (
    <Card variant="soft" className="p-4 space-y-3">
      <div>
        <Title className="text-xs" size="base" weight="bold">
          {title}
        </Title>
        <Caption>{subtitle}</Caption>
      </div>

      {/* Existing items */}
      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {items.map((item, idx) => (
          <div
            key={`${item.id}-${idx}`}
            className="flex items-center gap-2 rounded-[--btn-radius] border border-[--ui-border-color] bg-[--ui-bg] px-2.5 py-1.5"
          >
            {/* Preview Badge */}
            <span
              className={`rounded border px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-medium shrink-0 min-w-[56px] sm:min-w-[70px] text-center ${getBadgeClasses(
                item.color
              )}`}
            >
              {item.label}
            </span>

            {/* Editable Label Input */}
            <Input
              type="text"
              variant="soft"
              size="sm"
              value={item.label}
              onChange={(e) =>
                handleUpdateItem(idx, { label: e.target.value })
              }
              className="flex-1 min-w-0 h-7 text-xs"
            />

            {/* Color Selector */}
            <select
              value={item.color}
              onChange={(e) =>
                handleUpdateItem(idx, {
                  color: e.target.value as BadgeColorKey,
                })
              }
              className="rounded-[--input-radius] border border-[--ui-border-color] bg-[--ui-soft-bg] px-1.5 sm:px-2 py-1 text-[11px] sm:text-xs text-title focus:border-primary-500 focus:outline-none shrink-0 w-20 sm:w-auto"
            >
              {BADGE_COLOR_KEYS.map((ck) => (
                <option key={ck} value={ck} className="bg-gray-900 text-white">
                  {BADGE_COLOR_MAP[ck].label}
                </option>
              ))}
            </select>

            {/* Delete */}
            <Button.Root
              type="button"
              variant="ghost"
              intent="danger"
              size="xs"
              disabled={items.length <= 1}
              onClick={() => handleDeleteItem(idx)}
              className="shrink-0"
              title="Delete option"
            >
              <Button.Icon type="only">
                <Trash2 className="w-3.5 h-3.5" />
              </Button.Icon>
            </Button.Root>
          </div>
        ))}
      </div>

      {/* Add new item form */}
      <form
        onSubmit={handleAdd}
        className="flex flex-wrap items-center gap-2 pt-2 border-t border-[--ui-border-color]"
      >
        <Input
          type="text"
          variant="soft"
          size="sm"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder={
            prefixHash ? "Add new #tag..." : "Add new option..."
          }
          className="flex-1 min-w-[120px] h-8 text-xs"
        />
        <select
          value={newColor}
          onChange={(e) => setNewColor(e.target.value as BadgeColorKey)}
          className="rounded-[--input-radius] border border-[--ui-border-color] bg-[--ui-bg] px-2.5 py-1.5 text-xs text-title focus:border-primary-500 focus:outline-none shrink-0"
        >
          {BADGE_COLOR_KEYS.map((ck) => (
            <option key={ck} value={ck} className="bg-gray-900 text-white">
              {BADGE_COLOR_MAP[ck].label}
            </option>
          ))}
        </select>
        <Button.Root
          type="submit"
          variant="solid"
          intent="primary"
          size="xs"
          className="shrink-0"
        >
          <Button.Icon type="leading">
            <Plus className="w-3.5 h-3.5" />
          </Button.Icon>
          <Button.Label>Add</Button.Label>
        </Button.Root>
      </form>
    </Card>
  );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  initialTab = "customize",
  onClose,
  profile,
  workspaceConfig,
  tasks,
  aiTemporarilyDisabled,
  effectiveApiKey,
  onSetAiTemporarilyDisabled,
  onSaveApiKey,
  onUpdateProfile,
  onUpdateWorkspaceConfig,
  onCustomVideoUploaded,
  onOpenCanvasSync,
  onSyncCanvasTasks,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [canvasSyncLoading, setCanvasSyncLoading] = useState(false);
  const [canvasSyncMessage, setCanvasSyncMessage] = useState<string>("");
  const [gcalSyncLoading, setGcalSyncLoading] = useState(false);
  const [gcalMessage, setGcalMessage] = useState<string>("");
  const [copiedIcs, setCopiedIcs] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [aiProvider, setAiProvider] = useState<AIProvider>(
    workspaceConfig.aiProvider ||
      (effectiveApiKey.startsWith("AIza") ? "gemini" : "nvidia")
  );
  const [apiKeyDraft, setApiKeyDraft] = useState<string>(effectiveApiKey || "");
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [verifyingApiKey, setVerifyingApiKey] = useState<boolean>(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [newMemoryContent, setNewMemoryContent] = useState("");
  const [newMemoryCategory, setNewMemoryCategory] =
    useState<MemoryNoteCategory>("life_event");
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editingMemoryContent, setEditingMemoryContent] = useState("");

  const handleAddMemoryNote = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newMemoryContent.trim();
    if (!text) return;
    const currentNotes = workspaceConfig.memoryNotes || [];
    const newNote: UserMemoryNote = {
      id:
        "mem_" +
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 6),
      category: newMemoryCategory,
      content: text,
      createdAt: new Date().toISOString(),
      source: "user",
    };
    onUpdateWorkspaceConfig({
      memoryNotes: [newNote, ...currentNotes],
    });
    setNewMemoryContent("");
  };

  const handleDeleteMemoryNote = (id: string) => {
    const currentNotes = workspaceConfig.memoryNotes || [];
    onUpdateWorkspaceConfig({
      memoryNotes: currentNotes.filter((n) => n.id !== id),
    });
  };

  const handleUpdateMemoryNote = (id: string) => {
    const text = editingMemoryContent.trim();
    if (!text) return;
    const currentNotes = workspaceConfig.memoryNotes || [];
    onUpdateWorkspaceConfig({
      memoryNotes: currentNotes.map((n) =>
        n.id === id
          ? { ...n, content: text, updatedAt: new Date().toISOString() }
          : n
      ),
    });
    setEditingMemoryId(null);
    setEditingMemoryContent("");
  };

  const handleClearAllMemory = () => {
    if (
      confirm(
        "Clear all AI memory notes? The agent will forget previously recorded life context."
      )
    ) {
      onUpdateWorkspaceConfig({ memoryNotes: [] });
    }
  };

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (isOpen) {
      const nextProvider: AIProvider =
        workspaceConfig.aiProvider ||
        (effectiveApiKey.startsWith("AIza") ? "gemini" : "nvidia");
      setAiProvider(nextProvider);
      const providerKey =
        nextProvider === "nvidia"
          ? workspaceConfig.nvidiaApiKey ||
            (effectiveApiKey.startsWith("nvapi-") ? effectiveApiKey : "")
          : workspaceConfig.geminiApiKey ||
            (effectiveApiKey.startsWith("AIza") ? effectiveApiKey : "");
      setApiKeyDraft(providerKey || effectiveApiKey || "");
      setApiKeyStatus(null);
    }
  }, [
    isOpen,
    effectiveApiKey,
    workspaceConfig.aiProvider,
    workspaceConfig.nvidiaApiKey,
    workspaceConfig.geminiApiKey,
  ]);

  if (!isOpen) return null;

  const hasSavedKey = effectiveApiKey.trim().length >= 15;

  const handleVerifyAndSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = apiKeyDraft.trim();
    if (!trimmed) {
      setApiKeyStatus({
        type: "error",
        text:
          aiProvider === "nvidia"
            ? "Please paste your NVIDIA NIM API key (nvapi-...) first."
            : "Please paste your Google Gemini API key (AIza...) first.",
      });
      return;
    }

    setVerifyingApiKey(true);
    setApiKeyStatus(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "verify",
          customApiKey: trimmed,
          aiProvider,
          nvidiaModel: workspaceConfig.nvidiaModel || DEFAULT_NVIDIA_MODEL,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setApiKeyStatus({
          type: "error",
          text:
            data.error ||
            (aiProvider === "nvidia"
              ? "NVIDIA NIM rejected this API key (starts with nvapi-...)."
              : "Google AI rejected this API key (starts with AIza...)."),
        });
        return;
      }

      onSaveApiKey(
        trimmed,
        aiProvider,
        workspaceConfig.nvidiaModel || DEFAULT_NVIDIA_MODEL
      );
      onSetAiTemporarilyDisabled(false);
      setApiKeyStatus({
        type: "success",
        text: `Verified & connected! Your ${
          aiProvider === "nvidia" ? "NVIDIA NIM" : "Google Gemini"
        } Agent is active.`,
      });
    } catch {
      setApiKeyStatus({
        type: "error",
        text: "Network error while verifying key. Please try again.",
      });
    } finally {
      setVerifyingApiKey(false);
    }
  };

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://tasks.sunayraval.com";
  const appleCalUrl = `${origin}/api/calendar/export?token=tk_${profile.id.slice(
    0,
    12
  )}`;

  const handleVideoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadStatus("Saving video blob to IndexedDB...");
      await saveCustomVideoToIDB(file);
      onUpdateProfile({ video_bg_preset: "custom" });
      onCustomVideoUploaded();
      setUploadStatus(`Saved "${file.name}" locally (0 bandwidth)!`);
    } catch (err) {
      console.error(err);
      setUploadStatus("Failed to store video in IndexedDB.");
    }
  };

  const handleCanvasSyncClick = async () => {
    if (onOpenCanvasSync) {
      onOpenCanvasSync();
      return;
    }
    if (!onSyncCanvasTasks) return;
    setCanvasSyncLoading(true);
    setCanvasSyncMessage("");
    try {
      const res = await onSyncCanvasTasks(profile.canvas_feed_url || "");
      setCanvasSyncMessage(
        res.usedDemoFeed
          ? `Synced ${res.count} assignments from built-in HCPSS Canvas sample feed!`
          : `Synced ${res.count} live assignments from HCPSS Canvas iCal!`
      );
    } catch {
      setCanvasSyncMessage("Error syncing Canvas feed. Verify your .ics URL.");
    } finally {
      setCanvasSyncLoading(false);
    }
  };

  const handleGoogleCalendarSync = async () => {
    setGcalSyncLoading(true);
    setGcalMessage("");
    try {
      const res = await fetch("/api/calendar/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks }),
      });
      const data = await res.json();
      setGcalMessage(data.message || "Synced with Google Calendar.");
    } catch {
      setGcalMessage("Unable to reach Google Calendar sync endpoint.");
    } finally {
      setGcalSyncLoading(false);
    }
  };

  const handleCopyIcs = () => {
    navigator.clipboard.writeText(appleCalUrl);
    setCopiedIcs(true);
    setTimeout(() => setCopiedIcs(false), 2500);
  };

  const activeThemeColors =
    workspaceConfig.customThemeColors ||
    THEME_OPTIONS.find((t) => t.id === profile.theme)?.colors ||
    THEME_OPTIONS[0].colors;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-black/75 backdrop-blur-md" />
        <Dialog.Content
          fancy
          className="w-[calc(100vw-1rem)] max-w-4xl max-h-[94vh] sm:max-h-[90vh] p-0 shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-[--ui-border-color] px-4 sm:px-6 py-3 sm:py-4 theme-header-bg shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <Sliders className="w-5 h-5 text-primary-400 shrink-0" />
              <div className="min-w-0">
                <Dialog.Title size="base" weight="bold">
                  Workspace Customization &amp; Settings
                </Dialog.Title>
                <Dialog.Description
                  size="sm"
                  className="text-caption line-clamp-1 sm:line-clamp-none"
                >
                  Customize tags, statuses, categories, table headers, themes &amp;
                  integrations
                </Dialog.Description>
              </div>
            </div>
            <Dialog.CloseButton
              type="button"
              onClick={onClose}
              className="static shrink-0"
              aria-label="Close settings"
            >
              <X className="w-5 h-5" />
            </Dialog.CloseButton>
          </div>

          {/* Navigation Tabs - Spacious Tactile Pill Buttons */}
          <div
            role="tablist"
            aria-label="Settings sections"
            className="flex items-center border-b border-[--ui-border-color] bg-[--ui-soft-bg] px-3 sm:px-6 py-2.5 gap-2 sm:gap-2.5 overflow-x-auto scroll-smooth no-scrollbar scroll-px-3 shrink-0"
          >
            {[
              {
                id: "customize",
                label: "1. Tags, Types & Headers",
                icon: Tags,
              },
              {
                id: "appearance",
                label: "2. Themes & Background",
                icon: Palette,
              },
              { id: "view", label: "3. Task View Mode", icon: LayoutPanelLeft },
              { id: "ai", label: "4. AI Agent & API Key", icon: Bot },
              { id: "memory", label: "5. Life Context & Memory", icon: Brain },
              {
                id: "integrations",
                label: "6. Canvas & Calendars",
                icon: Calendar,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <Button.Root
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  variant={isActive ? "soft" : "ghost"}
                  intent={isActive ? "primary" : "gray"}
                  size="sm"
                  onClick={() => setActiveTab(tab.id as SettingsTabId)}
                  className={`whitespace-nowrap shrink-0 cursor-pointer touch-manipulation select-none ${
                    isActive
                      ? "border border-primary-500/45 shadow-neon font-bold"
                      : "border border-transparent"
                  }`}
                >
                  <Button.Icon type="leading">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? "text-primary-400" : "text-caption"
                      }`}
                    />
                  </Button.Icon>
                  <Button.Label>{tab.label}</Button.Label>
                </Button.Root>
              );
            })}
          </div>

          {/* Tab Content Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6 text-title">
            {/* TAB 1: TAGS, TYPES, STATUSES, PRIORITIES & HEADERS */}
            {activeTab === "customize" && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Title className="text-sm" size="base" weight="bold">
                      Customize Tags, Categories, Statuses &amp; Table Headers
                    </Title>
                    <Caption>
                      Add, rename, recolor, or remove any option. Changes apply
                      instantly across your table dropdowns.
                    </Caption>
                  </div>
                  <Button.Root
                    type="button"
                    variant="soft"
                    intent="gray"
                    size="xs"
                    onClick={() =>
                      onUpdateWorkspaceConfig({
                        ...DEFAULT_WORKSPACE_CONFIG,
                        geminiApiKey: workspaceConfig.geminiApiKey,
                      })
                    }
                  >
                    <Button.Icon type="leading">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </Button.Icon>
                    <Button.Label>Reset to Defaults</Button.Label>
                  </Button.Root>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Tags Editor */}
                  <OptionGroupEditor
                    title="Tags (#Tags Dropdown)"
                    subtitle="Manage tags and their badge colors for the Tags dropdown."
                    items={workspaceConfig.tags}
                    prefixHash={true}
                    onChange={(tags) => onUpdateWorkspaceConfig({ tags })}
                  />

                  {/* Categories / Types Editor */}
                  <OptionGroupEditor
                    title={`${workspaceConfig.columnHeaders.type} Options`}
                    subtitle="Manage task categories/types (e.g. College, School, Work, Club)."
                    items={workspaceConfig.types}
                    onChange={(types) => onUpdateWorkspaceConfig({ types })}
                  />

                  {/* Statuses Editor */}
                  <OptionGroupEditor
                    title={`${workspaceConfig.columnHeaders.status} Options`}
                    subtitle="Manage workflow statuses (keep 'Done' for completion tracking)."
                    items={workspaceConfig.statuses}
                    onChange={(statuses) =>
                      onUpdateWorkspaceConfig({ statuses })
                    }
                  />

                  {/* Priorities Editor */}
                  <OptionGroupEditor
                    title={`${workspaceConfig.columnHeaders.priority} Levels`}
                    subtitle="Manage priority levels and their badge colors."
                    items={workspaceConfig.priorities}
                    onChange={(priorities) =>
                      onUpdateWorkspaceConfig({ priorities })
                    }
                  />
                </div>

                {/* Section Dividers Editor */}
                <Card variant="soft" className="p-4 space-y-3">
                  <div>
                    <Title className="text-xs" size="base" weight="bold">
                      Section Divider Headers
                    </Title>
                    <Caption>
                      Rename, reorder, add, or remove table section groups (you
                      can also click any section header directly in the table).
                    </Caption>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {workspaceConfig.sections.map((sec, idx) => (
                      <div
                        key={sec.id}
                        className="flex items-center gap-2 rounded-[--btn-radius] border border-[--ui-border-color] bg-[--ui-bg] px-2.5 py-1.5"
                      >
                        <span className="text-[10px] font-mono text-placeholder w-5">
                          #{idx + 1}
                        </span>
                        <Input
                          type="text"
                          variant="soft"
                          size="sm"
                          value={sec.label}
                          onChange={(e) => {
                            const next = workspaceConfig.sections.map((s, i) =>
                              i === idx ? { ...s, label: e.target.value } : s
                            );
                            onUpdateWorkspaceConfig({ sections: next });
                          }}
                          className="flex-1 h-7 text-xs"
                        />
                        <Button.Root
                          type="button"
                          variant="ghost"
                          intent="danger"
                          size="xs"
                          disabled={workspaceConfig.sections.length <= 1}
                          onClick={() =>
                            onUpdateWorkspaceConfig({
                              sections: workspaceConfig.sections.filter(
                                (_, i) => i !== idx
                              ),
                            })
                          }
                        >
                          <Button.Icon type="only">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button.Icon>
                        </Button.Root>
                      </div>
                    ))}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const cleaned = newSectionTitle.trim();
                      if (!cleaned) return;
                      const id = cleaned.toUpperCase().replace(/\s+/g, "_");
                      if (
                        !workspaceConfig.sections.some((s) => s.id === id)
                      ) {
                        onUpdateWorkspaceConfig({
                          sections: [
                            ...workspaceConfig.sections,
                            { id, label: cleaned, badge: "Custom" },
                          ],
                        });
                      }
                      setNewSectionTitle("");
                    }}
                    className="flex items-center gap-2 pt-2 border-t border-[--ui-border-color]"
                  >
                    <Input
                      type="text"
                      variant="soft"
                      size="sm"
                      value={newSectionTitle}
                      onChange={(e) => setNewSectionTitle(e.target.value)}
                      placeholder="New section header title (e.g. 🚀 PROJECTS)..."
                      className="flex-1"
                    />
                    <Button.Root
                      type="submit"
                      variant="solid"
                      intent="primary"
                      size="xs"
                    >
                      <Button.Icon type="leading">
                        <Plus className="w-3.5 h-3.5" />
                      </Button.Icon>
                      <Button.Label>Add Section</Button.Label>
                    </Button.Root>
                  </form>
                </Card>

                {/* Column Headers & Workspace Titles Editor */}
                <Card variant="soft" className="p-4 space-y-4">
                  <div>
                    <Title className="text-xs" size="base" weight="bold">
                      Table Column Headers &amp; Workspace Titles
                    </Title>
                    <Caption>
                      Edit any header label below, or simply click directly on any
                      header in the app to rename it inline.
                    </Caption>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label size="sm" className="text-caption">
                        Workspace Main Title
                      </Label>
                      <Input
                        type="text"
                        variant="soft"
                        size="sm"
                        value={workspaceConfig.workspaceTitle}
                        onChange={(e) =>
                          onUpdateWorkspaceConfig({
                            workspaceTitle: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label size="sm" className="text-caption">
                        Top Navbar Brand Name
                      </Label>
                      <Input
                        type="text"
                        variant="soft"
                        size="sm"
                        value={workspaceConfig.brandName}
                        onChange={(e) =>
                          onUpdateWorkspaceConfig({ brandName: e.target.value })
                        }
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <Label size="sm" className="text-caption">
                        Workspace Subtitle / Motto
                      </Label>
                      <Input
                        type="text"
                        variant="soft"
                        size="sm"
                        value={workspaceConfig.workspaceSubtitle}
                        onChange={(e) =>
                          onUpdateWorkspaceConfig({
                            workspaceSubtitle: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-[--ui-border-color]">
                    {(
                      Object.keys(
                        workspaceConfig.columnHeaders
                      ) as Array<keyof ColumnHeadersConfig>
                    ).map((colKey) => (
                      <div key={colKey} className="space-y-1">
                        <Label
                          size="sm"
                          className="text-[10px] uppercase tracking-wider text-caption block"
                        >
                          {colKey.replace("_", " ")} Column
                        </Label>
                        <Input
                          type="text"
                          variant="soft"
                          size="sm"
                          value={workspaceConfig.columnHeaders[colKey]}
                          onChange={(e) =>
                            onUpdateWorkspaceConfig({
                              columnHeaders: {
                                ...workspaceConfig.columnHeaders,
                                [colKey]: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* TAB 2: APPEARANCE & VIDEO ENGINE */}
            {activeTab === "appearance" && (
              <div className="space-y-6">
                <div>
                  <Title size="base" weight="bold" className="text-sm mb-1">
                    Full-Atmosphere Theme Palettes
                  </Title>
                  <Caption className="mb-3 block">
                    Themes transform the entire background aurora, glass panels,
                    table headers, section dividers, and accents.
                  </Caption>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {THEME_OPTIONS.map((t) => {
                      const selected =
                        profile.theme === t.id &&
                        !workspaceConfig.customThemeColors;
                      const isSharingan = t.id === "sharingan";
                      const isSakura = t.id === "sakura";
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            onUpdateWorkspaceConfig({ customThemeColors: null });
                            onUpdateProfile({
                              theme: t.id as ThemeName,
                              ...(t.id === "sharingan"
                                ? { ai_tone: "killer_bee" }
                                : {}),
                            });
                          }}
                          className={`flex items-center justify-between rounded-[--card-radius] border p-3.5 text-left transition-all ${
                            selected
                              ? isSharingan
                                ? "border-red-500 bg-red-950/25 shadow-[0_0_24px_rgba(255,31,56,0.35)]"
                                : isSakura
                                ? "border-pink-400 bg-pink-950/25 shadow-[0_0_24px_rgba(255,126,182,0.35)]"
                                : "border-primary-500 bg-primary-500/15 shadow-neon"
                              : isSharingan
                              ? "border-red-500/30 bg-red-950/10 hover:bg-red-950/20 hover:border-red-500/50"
                              : isSakura
                              ? "border-pink-400/30 bg-pink-950/10 hover:bg-pink-950/20 hover:border-pink-400/50"
                              : "border-[--ui-border-color] bg-[--ui-soft-bg] hover:border-primary-500/35"
                          }`}
                        >
                          <div className="pr-2 min-w-0">
                            <div className="text-xs font-bold text-title flex items-center gap-1.5 flex-wrap">
                              <span>{t.name}</span>
                              {isSharingan && (
                                <Badge
                                  variant="soft"
                                  intent="danger"
                                  size="xs"
                                  className="text-[9px] font-bold uppercase tracking-wider"
                                >
                                  Animated
                                </Badge>
                              )}
                              {isSakura && (
                                <Badge
                                  variant="soft"
                                  intent="accent"
                                  size="xs"
                                  className="text-[9px] font-bold uppercase tracking-wider"
                                >
                                  Animated
                                </Badge>
                              )}
                              {selected && (
                                <Check className="w-3.5 h-3.5 text-primary-400" />
                              )}
                            </div>
                            <div className="text-[11px] text-caption mt-0.5 line-clamp-1">
                              {t.subtitle}
                            </div>
                          </div>

                          {/* Swatches / Sharingan Eye / Sakura Blossom */}
                          <div className="flex items-center gap-2 shrink-0">
                            {isSharingan && (
                              <SharinganIcon
                                size={28}
                                animate
                                speed="normal"
                                glow={selected}
                                interactive
                              />
                            )}
                            {isSakura && (
                              <SakuraIcon size={28} animate glow={selected} />
                            )}
                            <div className="flex items-center -space-x-1.5 shrink-0">
                              {Object.values(t.colors).map((hex, i) => (
                                <span
                                  key={i}
                                  className="h-5 w-5 rounded-full border border-black/60"
                                  style={{ backgroundColor: hex }}
                                />
                              ))}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Color Palette Picker */}
                <Card variant="soft" className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Title className="text-xs" size="base" weight="bold">
                        Custom Color Palette Studio
                      </Title>
                      <Caption>
                        Fine-tune individual colors for Background, Surface,
                        Accent, Primary &amp; Highlight.
                      </Caption>
                    </div>
                    {workspaceConfig.customThemeColors && (
                      <Button.Root
                        type="button"
                        variant="ghost"
                        intent="primary"
                        size="xs"
                        onClick={() =>
                          onUpdateWorkspaceConfig({ customThemeColors: null })
                        }
                      >
                        <Button.Label>Reset to Preset Theme</Button.Label>
                      </Button.Root>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {(
                      [
                        { key: "bgBase", label: "Background" },
                        { key: "surface", label: "Surface / Panel" },
                        { key: "accent", label: "Aurora Accent" },
                        { key: "primary", label: "Primary Glow" },
                        { key: "highlight", label: "Text Highlight" },
                      ] as const
                    ).map((item) => (
                      <label
                        key={item.key}
                        className="flex flex-col gap-1.5 rounded-[--btn-radius] border border-[--ui-border-color] bg-[--ui-bg] p-2.5 cursor-pointer hover:border-primary-500/50 transition-colors"
                      >
                        <span className="text-[10px] font-semibold text-caption">
                          {item.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={activeThemeColors[item.key]}
                            onChange={(e) => {
                              onUpdateWorkspaceConfig({
                                customThemeColors: {
                                  ...activeThemeColors,
                                  [item.key]: e.target.value,
                                },
                              });
                            }}
                            className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent"
                          />
                          <span className="text-[11px] font-mono text-body">
                            {activeThemeColors[item.key]}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                </Card>

                {/* Video Background Preset & IndexedDB Custom Upload */}
                <div className="border-t border-[--ui-border-color] pt-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Title size="base" weight="bold" className="text-sm flex items-center gap-2">
                        <Video className="w-4 h-4 text-primary-400" />
                        Ambient Video &amp; Particle Background Engine
                      </Title>
                      <Caption>
                        Lower the Overlay Dimming slider below to make the
                        background colors and animations even more vivid!
                      </Caption>
                    </div>
                  </div>

                  {/* 4 Presets + Custom */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {(
                      [
                        { id: "aurora", label: "🌅 Clean Aurora" },
                        { id: "cyber", label: "🕸️ Neural Grid" },
                        { id: "lofi", label: "✨ Lofi Bokeh" },
                        { id: "particles", label: "🌌 Deep Particles" },
                        { id: "custom", label: "📁 Custom IDB" },
                      ] as Array<{ id: VideoPresetName; label: string }>
                    ).map((presetItem) => {
                      const active = profile.video_bg_preset === presetItem.id;
                      return (
                        <Button.Root
                          key={presetItem.id}
                          type="button"
                          variant={active ? "soft" : "outlined"}
                          intent={active ? "primary" : "gray"}
                          size="sm"
                          onClick={() =>
                            onUpdateProfile({ video_bg_preset: presetItem.id })
                          }
                          className={
                            active
                              ? "border-primary-500 shadow-neon font-bold"
                              : ""
                          }
                        >
                          <Button.Label>{presetItem.label}</Button.Label>
                        </Button.Root>
                      );
                    })}
                  </div>

                  {/* Local IndexedDB Upload Box */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[--card-radius] border border-dashed border-[--ui-border-color] bg-[--ui-soft-bg] p-4">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-title">
                        Upload Custom Loop Video (MP4 / WebM)
                      </div>
                      <Caption>
                        Stored in local browser IndexedDB — zero cloud bandwidth.
                      </Caption>
                      {uploadStatus && (
                        <div className="text-[11px] text-success-400 font-medium pt-1">
                          {uploadStatus}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-[--btn-radius] bg-primary-500 hover:bg-primary-600 px-3.5 py-2 text-xs font-bold text-white transition-all shadow-neon">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Choose Video</span>
                        <input
                          type="file"
                          accept="video/mp4,video/webm"
                          onChange={handleVideoFileChange}
                          className="hidden"
                        />
                      </label>
                      {profile.video_bg_preset === "custom" && (
                        <Button.Root
                          type="button"
                          variant="soft"
                          intent="gray"
                          size="xs"
                          onClick={async () => {
                            await clearCustomVideoFromIDB();
                            onUpdateProfile({ video_bg_preset: "aurora" });
                            setUploadStatus(
                              "Cleared custom video from IndexedDB."
                            );
                          }}
                        >
                          <Button.Label>Reset</Button.Label>
                        </Button.Root>
                      )}
                    </div>
                  </div>

                  {/* Dim & Glass Blur Sliders */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <Card variant="soft" className="p-4 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-body">
                          Overlay Dimming (10% – 85%)
                        </span>
                        <span className="font-mono text-primary-300">
                          {Math.round(profile.video_bg_dim * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={0.85}
                        step={0.05}
                        value={profile.video_bg_dim}
                        onChange={(e) =>
                          onUpdateProfile({
                            video_bg_dim: parseFloat(e.target.value),
                          })
                        }
                        className="w-full accent-[var(--primary)] cursor-pointer"
                      />
                    </Card>

                    <Card variant="soft" className="p-4 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-body">
                          Frosted Glass Blur (0px – 24px)
                        </span>
                        <span className="font-mono text-primary-300">
                          {profile.video_bg_blur}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={24}
                        step={2}
                        value={profile.video_bg_blur}
                        onChange={(e) =>
                          onUpdateProfile({
                            video_bg_blur: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full accent-[var(--primary)] cursor-pointer"
                      />
                    </Card>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: TASK DOCUMENT VIEW PREFERENCE */}
            {activeTab === "view" && (
              <div className="space-y-4">
                <div>
                  <Title size="base" weight="bold" className="text-sm mb-1">
                    Task Document Opening Behavior
                  </Title>
                  <Caption>
                    Choose how the TipTap rich-text document editor opens when you
                    click the &ldquo;Doc&rdquo; button on a task row.
                  </Caption>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(
                    [
                      {
                        id: "slide_drawer",
                        title: "Slide Drawer (Default)",
                        desc: "Notion-style right-hand sliding sheet that keeps your table visible on the left.",
                      },
                      {
                        id: "center_modal",
                        title: "Center Glass Modal",
                        desc: "Focused distraction-free modal dialog in the center of your viewport.",
                      },
                      {
                        id: "inline",
                        title: "Inline Row Expansion",
                        desc: "Expands the rich-text editor directly underneath the active table row.",
                      },
                    ] as Array<{ id: ViewMode; title: string; desc: string }>
                  ).map((mode) => {
                    const active = profile.view_mode === mode.id;
                    return (
                      <Card
                        key={mode.id}
                        variant={active ? "outlined" : "soft"}
                        onClick={() => onUpdateProfile({ view_mode: mode.id })}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onUpdateProfile({ view_mode: mode.id });
                          }
                        }}
                        className={`flex flex-col justify-between p-4 text-left cursor-pointer transition-all ${
                          active
                            ? "border-primary-500 bg-primary-500/15 shadow-neon"
                            : "hover:border-primary-500/35"
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-title">
                              {mode.title}
                            </span>
                            {active && (
                              <Check className="w-4 h-4 text-primary-400 shrink-0" />
                            )}
                          </div>
                          <Caption className="leading-relaxed block">
                            {mode.desc}
                          </Caption>
                        </div>
                      </Card>
                    );
                  })}
                </div>

                {/* Show Completed Tasks Preference */}
                <Card variant="soft" className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <Title
                        size="base"
                        weight="bold"
                        className="text-xs flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4 text-success-400" />
                        Show completed tasks
                      </Title>
                      <Caption className="block">
                        Display finished and checked-off tasks directly in the
                        document table. When turned off, checking off a task
                        automatically moves it to the Completed list.
                      </Caption>
                    </div>
                    <Switch.Root
                      checked={Boolean(workspaceConfig.showCompletedTasks)}
                      onCheckedChange={(checked) =>
                        onUpdateWorkspaceConfig({
                          showCompletedTasks: checked,
                        })
                      }
                      intent="primary"
                      fancy
                      aria-label="Show completed tasks"
                    >
                      <Switch.Thumb />
                    </Switch.Root>
                  </div>
                </Card>
              </div>
            )}

            {/* TAB 4: AI AGENT & API KEY */}
            {activeTab === "ai" && (
              <div className="space-y-6">
                {/* 1. Enable / Hide AI Workspace Agent Toggle */}
                <Card variant="soft" className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Sparkles className="w-4 h-4 text-primary-400" />
                        <Title className="text-xs" size="base" weight="bold">
                          Enable Gemini AI Workspace Agent
                        </Title>
                        <Badge
                          variant="soft"
                          intent={!aiTemporarilyDisabled ? "success" : "gray"}
                          size="xs"
                        >
                          {!aiTemporarilyDisabled
                            ? "Enabled"
                            : "Hidden for Session"}
                        </Badge>
                      </div>
                      <Caption className="block leading-relaxed">
                        When enabled, the hero homepage opens to your
                        Gemini-styled AI Agent with a{" "}
                        <span className="text-title font-medium">
                          Chat / Tasks
                        </span>{" "}
                        tab switcher. Turn off temporarily if you prefer a pure
                        task-table workspace with all AI chats hidden.
                      </Caption>
                    </div>

                    <Switch.Root
                      checked={!aiTemporarilyDisabled}
                      onCheckedChange={(checked) =>
                        onSetAiTemporarilyDisabled(!checked)
                      }
                      intent="primary"
                      fancy
                      aria-label="Enable Gemini AI Workspace Agent"
                    >
                      <Switch.Thumb />
                    </Switch.Root>
                  </div>
                </Card>

                {/* 1b. Cursing Mode (Unfiltered Comedy) Toggle */}
                <Card
                  variant="outlined"
                  className="border-danger-500/35 bg-danger-950/20 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm">🤬</span>
                        <Title className="text-xs" size="base" weight="bold">
                          Cursing Mode (Unfiltered Comedy)
                        </Title>
                        <Badge
                          variant="soft"
                          intent={workspaceConfig.cursingMode ? "danger" : "gray"}
                          size="xs"
                          className="font-semibold"
                        >
                          {workspaceConfig.cursingMode
                            ? "UNFILTERED ON"
                            : "Off"}
                        </Badge>
                      </div>
                      <Caption className="block leading-relaxed">
                        All fun and games! When enabled, all AI models (Chat &amp;{" "}
                        <strong className="text-title">flo</strong> Study Tutor)
                        openly curse, roast, and drop hilarious vulgar profanity
                        while still organizing your tasks and teaching you
                        accurately.
                      </Caption>
                    </div>

                    <Switch.Root
                      checked={Boolean(workspaceConfig.cursingMode)}
                      onCheckedChange={(checked) =>
                        onUpdateWorkspaceConfig({
                          cursingMode: checked,
                        })
                      }
                      intent="primary"
                      fancy
                      aria-label="Toggle Cursing Mode"
                    >
                      <Switch.Thumb />
                    </Switch.Root>
                  </div>
                </Card>

                {/* 2. AI Provider & API Key Setup */}
                <Card variant="soft" className="p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <Title
                        size="base"
                        weight="bold"
                        className="text-xs flex items-center gap-1.5"
                      >
                        <KeyRound className="w-4 h-4 text-primary-400" />
                        AI Provider &amp; Model Setup (NVIDIA NIM + Google
                        Gemini)
                      </Title>
                      <Caption className="mt-0.5 block">
                        Pair NVIDIA NIM (free inference on leading models at
                        build.nvidia.com) with Google Gemini for automatic
                        failover.
                      </Caption>
                    </div>

                    {hasSavedKey ? (
                      <Badge
                        variant="soft"
                        intent="success"
                        size="xs"
                        className="gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          Connected (
                          {aiProvider === "nvidia"
                            ? "NVIDIA NIM"
                            : "Google Gemini"}{" "}
                          • {effectiveApiKey.slice(0, 6)}••••
                          {effectiveApiKey.slice(-4)})
                        </span>
                      </Badge>
                    ) : (
                      <Badge
                        variant="soft"
                        intent="warning"
                        size="xs"
                        className="gap-1.5"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>No API Key Set</span>
                      </Badge>
                    )}
                  </div>

                  {/* Provider Selector Tabs */}
                  <div className="grid grid-cols-2 gap-2 rounded-[--card-radius] bg-[--ui-bg] p-1 border border-[--ui-border-color]">
                    <Button.Root
                      type="button"
                      variant={aiProvider === "nvidia" ? "solid" : "ghost"}
                      intent={aiProvider === "nvidia" ? "primary" : "gray"}
                      size="sm"
                      onClick={() => {
                        setAiProvider("nvidia");
                        onUpdateWorkspaceConfig({ aiProvider: "nvidia" });
                        setApiKeyDraft(
                          workspaceConfig.nvidiaApiKey ||
                            (effectiveApiKey.startsWith("nvapi-")
                              ? effectiveApiKey
                              : "")
                        );
                        if (apiKeyStatus) setApiKeyStatus(null);
                      }}
                      className="w-full"
                    >
                      <Button.Label className="flex items-center gap-1.5">
                        <span>NVIDIA NIM</span>
                        <Badge
                          variant="soft"
                          intent={aiProvider === "nvidia" ? "gray" : "success"}
                          size="xs"
                          className="text-[9px] font-bold uppercase tracking-wider"
                        >
                          Free Inference
                        </Badge>
                      </Button.Label>
                    </Button.Root>

                    <Button.Root
                      type="button"
                      variant={aiProvider === "gemini" ? "solid" : "ghost"}
                      intent={aiProvider === "gemini" ? "primary" : "gray"}
                      size="sm"
                      onClick={() => {
                        setAiProvider("gemini");
                        onUpdateWorkspaceConfig({ aiProvider: "gemini" });
                        setApiKeyDraft(
                          workspaceConfig.geminiApiKey ||
                            (effectiveApiKey.startsWith("AIza")
                              ? effectiveApiKey
                              : "")
                        );
                        if (apiKeyStatus) setApiKeyStatus(null);
                      }}
                      className="w-full"
                    >
                      <Button.Label className="flex items-center gap-1.5">
                        <span>Google Gemini</span>
                        <Badge
                          variant="soft"
                          intent="gray"
                          size="xs"
                          className="text-[9px] font-bold uppercase tracking-wider"
                        >
                          Paired
                        </Badge>
                      </Button.Label>
                    </Button.Root>
                  </div>

                  {/* NVIDIA NIM Model Selector */}
                  {aiProvider === "nvidia" && (
                    <div className="space-y-2 rounded-[--card-radius] border border-[--ui-border-color] bg-[--ui-bg] p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-title">
                          Active NVIDIA NIM Model
                        </span>
                        <span className="text-[10px] text-placeholder">
                          Also switchable anytime in the chat bar
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {NVIDIA_MODEL_OPTIONS.map((m) => {
                          const isSelected =
                            (workspaceConfig.nvidiaModel ||
                              DEFAULT_NVIDIA_MODEL) === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() =>
                                onUpdateWorkspaceConfig({
                                  nvidiaModel: m.id,
                                  aiProvider: "nvidia",
                                })
                              }
                              className={`flex flex-col items-start rounded-[--btn-radius] border px-2.5 py-2 text-left transition-all ${
                                isSelected
                                  ? "border-primary-500/60 bg-primary-500/15 text-title"
                                  : "border-[--ui-border-color] bg-[--ui-soft-bg] text-body hover:border-primary-500/35 hover:text-title"
                              }`}
                            >
                              <div className="flex w-full items-center justify-between gap-1.5">
                                <span className="text-[11px] font-bold truncate">
                                  {m.name}
                                </span>
                                <Badge
                                  variant={isSelected ? "solid" : "soft"}
                                  intent={isSelected ? "primary" : "gray"}
                                  size="xs"
                                  className="shrink-0 text-[9px]"
                                >
                                  {m.badge}
                                </Badge>
                              </div>
                              <span className="text-[10px] text-caption truncate w-full mt-0.5">
                                {m.provider} • {m.desc}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Dynamic 3-Step Instructions */}
                  {aiProvider === "nvidia" ? (
                    <div className="rounded-[--card-radius] border border-[--ui-border-color] bg-[--ui-bg] p-3.5 space-y-2 text-[11px] text-body">
                      <div className="font-semibold text-title">
                        How to get a free NVIDIA NIM API key (~30 seconds):
                      </div>
                      <ol className="list-decimal pl-4 space-y-1 text-caption">
                        <li>
                          Open{" "}
                          <a
                            href="https://build.nvidia.com/models"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary-300 underline underline-offset-2 hover:brightness-110 font-medium"
                          >
                            build.nvidia.com/models
                            <ExternalLink className="w-3 h-3" />
                          </a>{" "}
                          and sign in with your email, Google, or NVIDIA
                          account.
                        </li>
                        <li>
                          Click any model and click{" "}
                          <strong className="text-title">
                            &ldquo;Get API Key&rdquo;
                          </strong>{" "}
                          (or{" "}
                          <strong className="text-title">
                            &ldquo;Generate Key&rdquo;
                          </strong>
                          ) in the top right.
                        </li>
                        <li>
                          Copy the key (starts with{" "}
                          <Code>nvapi-...</Code>), paste it below, and click{" "}
                          <strong className="text-title">
                            Verify &amp; Save Key
                          </strong>
                          .
                        </li>
                      </ol>
                    </div>
                  ) : (
                    <div className="rounded-[--card-radius] border border-[--ui-border-color] bg-[--ui-bg] p-3.5 space-y-2 text-[11px] text-body">
                      <div className="font-semibold text-title">
                        How to get a free Google Gemini API key (~30 seconds):
                      </div>
                      <ol className="list-decimal pl-4 space-y-1 text-caption">
                        <li>
                          Open{" "}
                          <a
                            href="https://aistudio.google.com/app/apikey"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary-300 underline underline-offset-2 hover:brightness-110 font-medium"
                          >
                            Google AI Studio (aistudio.google.com/app/apikey)
                            <ExternalLink className="w-3 h-3" />
                          </a>{" "}
                          and sign in with your Google account.
                        </li>
                        <li>
                          Click{" "}
                          <strong className="text-title">
                            &ldquo;Create API key&rdquo;
                          </strong>{" "}
                          (free tier includes generous Gemini 3.8 Flash &amp;
                          Pro usage).
                        </li>
                        <li>
                          Copy the key (starts with{" "}
                          <Code>AIzaSy...</Code>), paste it below, and click{" "}
                          <strong className="text-title">
                            Verify &amp; Save Key
                          </strong>
                          .
                        </li>
                      </ol>
                    </div>
                  )}

                  {/* API Key Input & Verify Form */}
                  <form onSubmit={handleVerifyAndSaveKey} className="space-y-2.5">
                    <label
                      htmlFor="settings-gemini-api-key"
                      className="sr-only"
                    >
                      AI API Key
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="settings-gemini-api-key"
                          type={showApiKey ? "text" : "password"}
                          variant="soft"
                          size="md"
                          value={apiKeyDraft}
                          onChange={(e) => {
                            const val = e.target.value;
                            setApiKeyDraft(val);
                            if (val.startsWith("nvapi-"))
                              setAiProvider("nvidia");
                            if (val.startsWith("AIza")) setAiProvider("gemini");
                            if (apiKeyStatus) setApiKeyStatus(null);
                          }}
                          placeholder={
                            aiProvider === "nvidia"
                              ? "Paste NVIDIA NIM API key (nvapi-...)"
                              : "Paste Google AI API key (AIzaSy...)"
                          }
                          autoComplete="off"
                          spellCheck={false}
                          className="pr-10 font-mono text-xs"
                        />
                        <Button.Root
                          type="button"
                          variant="ghost"
                          intent="gray"
                          size="xs"
                          onClick={() => setShowApiKey((v) => !v)}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2"
                          title={showApiKey ? "Hide key" : "Show key"}
                        >
                          <Button.Icon type="only">
                            {showApiKey ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </Button.Icon>
                        </Button.Root>
                      </div>

                      <Button.Root
                        type="submit"
                        variant="solid"
                        intent="primary"
                        size="sm"
                        disabled={verifyingApiKey}
                        className="shrink-0 shadow-neon"
                      >
                        {verifyingApiKey ? (
                          <>
                            <Button.Icon type="leading">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            </Button.Icon>
                            <Button.Label>Verifying...</Button.Label>
                          </>
                        ) : (
                          <>
                            <Button.Icon type="leading">
                              <Check className="w-3.5 h-3.5" />
                            </Button.Icon>
                            <Button.Label>Verify &amp; Save Key</Button.Label>
                          </>
                        )}
                      </Button.Root>

                      {apiKeyDraft.trim() && (
                        <Button.Root
                          type="button"
                          variant="soft"
                          intent="danger"
                          size="sm"
                          onClick={() => {
                            setApiKeyDraft("");
                            onSaveApiKey(null, aiProvider);
                            setApiKeyStatus({
                              type: "success",
                              text: `Removed saved ${
                                aiProvider === "nvidia"
                                  ? "NVIDIA NIM"
                                  : "Google Gemini"
                              } API key.`,
                            });
                          }}
                          className="shrink-0"
                          title="Remove saved API key"
                        >
                          <Button.Icon type="leading">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button.Icon>
                          <Button.Label>Remove</Button.Label>
                        </Button.Root>
                      )}
                    </div>

                    {apiKeyStatus && (
                      <div
                        className={`flex items-center gap-1.5 text-xs font-medium ${
                          apiKeyStatus.type === "success"
                            ? "text-success-400"
                            : "text-danger-400"
                        }`}
                      >
                        {apiKeyStatus.type === "success" ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span>{apiKeyStatus.text}</span>
                      </div>
                    )}
                  </form>
                </Card>

                {/* 3. Agent Coaching Personality */}
                <div>
                  <Title size="base" weight="bold" className="text-sm mb-1">
                    Gemini Agent Personality &amp; Coaching Tone
                  </Title>
                  <Caption className="mb-3 block">
                    Configures how your workspace agent communicates,
                    prioritizes, and coaches you.
                  </Caption>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(
                      [
                        {
                          id: "locked_in",
                          name: "🎯 Locked In",
                          desc: "Direct, disciplined, high-focus productivity coach.",
                        },
                        {
                          id: "chill_coach",
                          name: "🌿 Chill Coach",
                          desc: "Empathetic, steady, mindful pacing with zero burnout.",
                        },
                        {
                          id: "hyper_drive",
                          name: "⚡ Hyper Drive",
                          desc: "High-energy, intense, deadline-driven execution.",
                        },
                        {
                          id: "executive",
                          name: "📊 Executive",
                          desc: "Analytical, strategic, prioritizing high-ROI deliverables.",
                        },
                        {
                          id: "killer_bee",
                          name: "🎤 Killer Bee",
                          desc: "Eight-Tails rap flow & rhymes. Bakayaro! Konoyaro!",
                        },
                        {
                          id: "naruto",
                          name: "🍥 Naruto Uzumaki",
                          desc: "Believe it! Dattebayo! Relentless Hokage spirit & fiery focus.",
                        },
                      ] as Array<{ id: AITone; name: string; desc: string }>
                    ).map((t) => {
                      const active = profile.ai_tone === t.id;
                      return (
                        <Card
                          key={t.id}
                          variant={active ? "outlined" : "soft"}
                          role="button"
                          tabIndex={0}
                          onClick={() => onUpdateProfile({ ai_tone: t.id })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onUpdateProfile({ ai_tone: t.id });
                            }
                          }}
                          className={`p-3.5 text-left cursor-pointer transition-all ${
                            active
                              ? "border-primary-500 bg-primary-500/15 shadow-neon"
                              : "hover:border-primary-500/35"
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-bold text-title">
                            <span>{t.name}</span>
                            {active && (
                              <Check className="w-4 h-4 text-primary-400" />
                            )}
                          </div>
                          <Caption className="mt-1 block">{t.desc}</Caption>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: LIFE CONTEXT & MEMORY */}
            {activeTab === "memory" && (
              <div className="space-y-6">
                {/* Header card */}
                <Card
                  variant="soft"
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Brain className="w-4 h-4 text-primary-400" />
                      <Title className="text-sm" size="base" weight="bold">
                        Life Context &amp; Agent Memory
                      </Title>
                      <Badge variant="soft" intent="primary" size="xs">
                        {(workspaceConfig.memoryNotes || []).length} Saved
                      </Badge>
                    </div>
                    <Caption className="block">
                      Important milestones, recurring exams, commitments, and
                      personal preferences remembered by your AI assistant across
                      sessions. The agent automatically learns these from
                      conversation or you can manually manage them below.
                    </Caption>
                  </div>
                  {(workspaceConfig.memoryNotes || []).length > 0 && (
                    <Button.Root
                      type="button"
                      variant="soft"
                      intent="danger"
                      size="xs"
                      onClick={handleClearAllMemory}
                      className="shrink-0 self-start sm:self-auto"
                    >
                      <Button.Icon type="leading">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button.Icon>
                      <Button.Label>Clear All</Button.Label>
                    </Button.Root>
                  )}
                </Card>

                {/* Add New Memory Note Form */}
                <Card variant="soft" className="p-4">
                  <form onSubmit={handleAddMemoryNote} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-title flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5 text-primary-400" />
                        <span>Add New Context Note</span>
                      </span>
                      <span className="text-[11px] text-placeholder">
                        Helps the agent plan your schedule realistically
                      </span>
                    </div>

                    <Textarea
                      variant="soft"
                      size="sm"
                      value={newMemoryContent}
                      onChange={(e) => setNewMemoryContent(e.target.value)}
                      placeholder="e.g. Taking Linear Algebra and FBLA this semester; prefer high-focus math blocks in the early afternoon; exams on Nov 18..."
                      rows={2}
                      className="resize-none"
                    />

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-caption shrink-0">
                          Category:
                        </span>
                        <select
                          value={newMemoryCategory}
                          onChange={(e) =>
                            setNewMemoryCategory(
                              e.target.value as MemoryNoteCategory
                            )
                          }
                          className="rounded-[--input-radius] border border-[--ui-border-color] bg-[--ui-bg] px-2.5 py-1.5 text-xs text-title focus:border-primary-500 focus:outline-none"
                        >
                          <option value="life_event" className="bg-gray-900 text-white">
                            🗓️ Life Event / Milestone
                          </option>
                          <option value="academics" className="bg-gray-900 text-white">
                            📚 Academics &amp; Classes
                          </option>
                          <option value="ongoing_goal" className="bg-gray-900 text-white">
                            🎯 Ongoing Goal / Project
                          </option>
                          <option value="preference" className="bg-gray-900 text-white">
                            ⚡ Preference &amp; Habit
                          </option>
                          <option value="general" className="bg-gray-900 text-white">
                            💡 General Context
                          </option>
                        </select>
                      </div>

                      <Button.Root
                        type="submit"
                        variant="solid"
                        intent="primary"
                        size="sm"
                        disabled={!newMemoryContent.trim()}
                      >
                        <Button.Icon type="leading">
                          <Plus className="w-3.5 h-3.5" />
                        </Button.Icon>
                        <Button.Label>Save Note</Button.Label>
                      </Button.Root>
                    </div>
                  </form>
                </Card>

                {/* Notes List */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-semibold text-body">
                      Active Context Memory Notes (
                      {(workspaceConfig.memoryNotes || []).length})
                    </span>
                    <span className="text-[10px] text-placeholder">
                      Auto-injected into AI conversation context
                    </span>
                  </div>

                  {(workspaceConfig.memoryNotes || []).length === 0 ? (
                    <Card
                      variant="outlined"
                      className="border-dashed p-8 text-center space-y-2"
                    >
                      <Brain className="w-8 h-8 text-placeholder mx-auto" />
                      <p className="text-xs font-semibold text-caption">
                        No memory notes recorded yet
                      </p>
                      <Caption className="max-w-md mx-auto block">
                        As you chat, the agent will automatically remember
                        milestones, course schedules, and life context. You can
                        also add notes above anytime!
                      </Caption>
                    </Card>
                  ) : (
                    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                      {(workspaceConfig.memoryNotes || []).map((note) => {
                        const isEditing = editingMemoryId === note.id;
                        const categoryIntent:
                          | "accent"
                          | "info"
                          | "success"
                          | "warning"
                          | "gray" =
                          note.category === "life_event"
                            ? "accent"
                            : note.category === "academics"
                            ? "info"
                            : note.category === "ongoing_goal"
                            ? "success"
                            : note.category === "preference"
                            ? "warning"
                            : "gray";

                        const categoryLabel =
                          note.category === "life_event"
                            ? "Life Event"
                            : note.category === "academics"
                            ? "Academics"
                            : note.category === "ongoing_goal"
                            ? "Goal"
                            : note.category === "preference"
                            ? "Preference"
                            : "General";

                        return (
                          <Card
                            key={note.id}
                            variant="soft"
                            className="p-3 hover:border-primary-500/35 transition-all space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                  variant="soft"
                                  intent={categoryIntent}
                                  size="xs"
                                  className="font-semibold"
                                >
                                  {categoryLabel}
                                </Badge>
                                <span className="flex items-center gap-1 text-[10px] text-caption">
                                  {note.source === "agent" ? (
                                    <>
                                      <Bot className="w-3 h-3 text-primary-400" />
                                      <span>Agent Memory</span>
                                    </>
                                  ) : (
                                    <>
                                      <User className="w-3 h-3 text-caption" />
                                      <span>You</span>
                                    </>
                                  )}
                                </span>
                                {note.createdAt && (
                                  <span className="text-[10px] text-placeholder">
                                    {new Date(
                                      note.createdAt
                                    ).toLocaleDateString(undefined, {
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                {!isEditing ? (
                                  <>
                                    <Button.Root
                                      type="button"
                                      variant="ghost"
                                      intent="gray"
                                      size="xs"
                                      onClick={() => {
                                        setEditingMemoryId(note.id);
                                        setEditingMemoryContent(note.content);
                                      }}
                                      title="Edit note"
                                    >
                                      <Button.Icon type="only">
                                        <Sliders className="w-3.5 h-3.5" />
                                      </Button.Icon>
                                    </Button.Root>
                                    <Button.Root
                                      type="button"
                                      variant="ghost"
                                      intent="danger"
                                      size="xs"
                                      onClick={() =>
                                        handleDeleteMemoryNote(note.id)
                                      }
                                      title="Delete note"
                                    >
                                      <Button.Icon type="only">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button.Icon>
                                    </Button.Root>
                                  </>
                                ) : (
                                  <Button.Root
                                    type="button"
                                    variant="ghost"
                                    intent="gray"
                                    size="xs"
                                    onClick={() => setEditingMemoryId(null)}
                                  >
                                    <Button.Label>Cancel</Button.Label>
                                  </Button.Root>
                                )}
                              </div>
                            </div>

                            {isEditing ? (
                              <div className="space-y-2 pt-1">
                                <Textarea
                                  variant="soft"
                                  size="sm"
                                  value={editingMemoryContent}
                                  onChange={(e) =>
                                    setEditingMemoryContent(e.target.value)
                                  }
                                  rows={2}
                                  className="resize-none"
                                />
                                <div className="flex justify-end gap-2">
                                  <Button.Root
                                    type="button"
                                    variant="solid"
                                    intent="primary"
                                    size="xs"
                                    onClick={() =>
                                      handleUpdateMemoryNote(note.id)
                                    }
                                  >
                                    <Button.Icon type="leading">
                                      <Check className="w-3 h-3" />
                                    </Button.Icon>
                                    <Button.Label>Save</Button.Label>
                                  </Button.Root>
                                </div>
                              </div>
                            ) : (
                              <Text size="sm" className="text-body leading-relaxed select-text">
                                {note.content}
                              </Text>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 6: INTEGRATIONS */}
            {activeTab === "integrations" && (
              <div className="space-y-6">
                {/* 1. HCPSS Canvas iCal Feed */}
                <Card variant="soft" className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <Title className="text-xs" size="base" weight="bold">
                        HCPSS Canvas LMS iCal Feed Sync
                      </Title>
                      <Caption>
                        Paste your private Canvas Calendar Feed URL (or leave
                        blank to test with the built-in sample feed).
                      </Caption>
                    </div>
                    <Badge variant="soft" intent="warning" size="xs">
                      node-ical
                    </Badge>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      type="url"
                      variant="soft"
                      size="sm"
                      value={profile.canvas_feed_url || ""}
                      onChange={(e) =>
                        onUpdateProfile({ canvas_feed_url: e.target.value })
                      }
                      placeholder="https://hcpss.instructure.com/feeds/calendars/user_xxxx.ics"
                      className="flex-1"
                    />
                    <Button.Root
                      type="button"
                      variant="solid"
                      intent="primary"
                      size="sm"
                      disabled={canvasSyncLoading}
                      onClick={handleCanvasSyncClick}
                      className="shrink-0"
                    >
                      <Button.Icon type="leading">
                        {canvasSyncLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                      </Button.Icon>
                      <Button.Label>Sync Now</Button.Label>
                    </Button.Root>
                  </div>

                  {canvasSyncMessage && (
                    <p className="text-xs text-success-400 font-medium">
                      {canvasSyncMessage}
                    </p>
                  )}
                </Card>

                {/* 2. Google Calendar Sync */}
                <Card
                  variant="soft"
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <Title className="text-xs" size="base" weight="bold">
                      Google Calendar Two-Way Deadline Sync
                    </Title>
                    <Caption className="block">
                      Push task due dates and time blocks directly to your
                      primary Google Calendar.
                    </Caption>
                    {gcalMessage && (
                      <p className="text-xs text-primary-300 font-medium pt-1">
                        {gcalMessage}
                      </p>
                    )}
                  </div>

                  <Button.Root
                    type="button"
                    variant="outlined"
                    intent="gray"
                    size="sm"
                    disabled={gcalSyncLoading}
                    onClick={handleGoogleCalendarSync}
                    className="shrink-0"
                  >
                    <Button.Icon type="leading">
                      {gcalSyncLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Calendar className="w-3.5 h-3.5 text-primary-400" />
                      )}
                    </Button.Icon>
                    <Button.Label>Sync Google Calendar</Button.Label>
                  </Button.Root>
                </Card>

                {/* 3. Apple Calendar / iOS .ics Subscription Feed */}
                <Card variant="soft" className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <Title className="text-xs" size="base" weight="bold">
                        Apple Calendar &amp; iOS Reminders Live .ics Feed
                      </Title>
                      <Caption>
                        Subscribe in Apple Calendar (File → New Calendar
                        Subscription) using your authenticated token URL.
                      </Caption>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      variant="soft"
                      size="sm"
                      readOnly
                      value={appleCalUrl}
                      className="flex-1 font-mono text-xs text-body"
                    />
                    <Button.Root
                      type="button"
                      variant="soft"
                      intent="gray"
                      size="sm"
                      onClick={handleCopyIcs}
                    >
                      {copiedIcs ? (
                        <>
                          <Button.Icon type="leading">
                            <Check className="w-3.5 h-3.5 text-success-400" />
                          </Button.Icon>
                          <Button.Label>Copied</Button.Label>
                        </>
                      ) : (
                        <>
                          <Button.Icon type="leading">
                            <Copy className="w-3.5 h-3.5" />
                          </Button.Icon>
                          <Button.Label>Copy URL</Button.Label>
                        </>
                      )}
                    </Button.Root>
                    <a
                      href={appleCalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-[--btn-radius] bg-primary-500/20 border border-primary-500/40 px-3 py-2 text-xs font-semibold text-primary-300 hover:bg-primary-500/30 transition-colors"
                      title="Download / Preview .ics Feed"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>.ics</span>
                    </a>
                  </div>
                </Card>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between border-t border-[--ui-border-color] theme-header-bg px-6 py-3.5 text-xs text-caption shrink-0">
            <span>All customizations auto-save &amp; sync to Supabase</span>
            <Button.Root
              type="button"
              variant="solid"
              intent="primary"
              size="sm"
              onClick={onClose}
              className="shadow-neon"
            >
              <Button.Label>Done</Button.Label>
            </Button.Root>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
