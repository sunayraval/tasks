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
} from "@/types/taskit";
import {
  saveCustomVideoToIDB,
  clearCustomVideoFromIDB,
} from "@/components/background/VideoBackground";
import { SharinganIcon } from "@/components/ui/SharinganIcon";
import {
  AlertCircle,
  Bot,
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
  onSyncCanvasTasks: (feedUrl: string) => Promise<{
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
    <div className="rounded-xl border border-white/15 bg-black/30 p-4 space-y-3">
      <div>
        <h4 className="text-xs font-bold text-white">{title}</h4>
        <p className="text-[11px] text-white/55">{subtitle}</p>
      </div>

      {/* Existing items */}
      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {items.map((item, idx) => (
          <div
            key={`${item.id}-${idx}`}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5"
          >
            {/* Preview Badge */}
            <span
              className={`rounded border px-2 py-0.5 text-[11px] font-medium shrink-0 min-w-[70px] text-center ${getBadgeClasses(
                item.color
              )}`}
            >
              {item.label}
            </span>

            {/* Editable Label Input */}
            <input
              type="text"
              value={item.label}
              onChange={(e) =>
                handleUpdateItem(idx, { label: e.target.value })
              }
              className="flex-1 rounded border border-white/10 bg-black/50 px-2 py-1 text-xs text-white focus:border-primary focus:outline-none"
            />

            {/* Color Selector */}
            <select
              value={item.color}
              onChange={(e) =>
                handleUpdateItem(idx, {
                  color: e.target.value as BadgeColorKey,
                })
              }
              className="rounded border border-white/15 bg-black/70 px-2 py-1 text-xs text-white focus:border-primary focus:outline-none"
            >
              {BADGE_COLOR_KEYS.map((ck) => (
                <option key={ck} value={ck} className="bg-zinc-900 text-white">
                  {BADGE_COLOR_MAP[ck].label}
                </option>
              ))}
            </select>

            {/* Delete */}
            <button
              type="button"
              disabled={items.length <= 1}
              onClick={() => handleDeleteItem(idx)}
              className="p-1 rounded text-white/40 hover:text-red-400 disabled:opacity-20 transition-colors"
              title="Delete option"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add new item form */}
      <form
        onSubmit={handleAdd}
        className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10"
      >
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder={
            prefixHash ? "Add new #tag..." : "Add new option..."
          }
          className="flex-1 min-w-[140px] rounded-lg border border-white/15 bg-black/60 px-2.5 py-1.5 text-xs text-white placeholder-white/35 focus:border-primary focus:outline-none"
        />
        <select
          value={newColor}
          onChange={(e) => setNewColor(e.target.value as BadgeColorKey)}
          className="rounded-lg border border-white/15 bg-black/70 px-2.5 py-1.5 text-xs text-white focus:border-primary focus:outline-none"
        >
          {BADGE_COLOR_KEYS.map((ck) => (
            <option key={ck} value={ck} className="bg-zinc-900 text-white">
              {BADGE_COLOR_MAP[ck].label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-black hover:brightness-110 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
        </button>
      </form>
    </div>
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] rounded-2xl border theme-panel backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 theme-header-bg">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-base font-bold text-white">
                Workspace Customization &amp; Settings
              </h2>
              <p className="text-xs text-white/60">
                Customize tags, statuses, categories, table headers, themes &amp;
                integrations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-white/10 bg-black/30 px-6 gap-2 overflow-x-auto">
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
            {
              id: "integrations",
              label: "5. Canvas & Calendars",
              icon: Calendar,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as SettingsTabId)}
                className={`flex items-center gap-2 border-b-2 py-3 px-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-primary text-highlight"
                    : "border-transparent text-white/55 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-white">
          {/* TAB 1: TAGS, TYPES, STATUSES, PRIORITIES & HEADERS */}
          {activeTab === "customize" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Customize Tags, Categories, Statuses &amp; Table Headers
                  </h3>
                  <p className="text-xs text-white/55">
                    Add, rename, recolor, or remove any option. Changes apply
                    instantly across your table dropdowns.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateWorkspaceConfig({
                      ...DEFAULT_WORKSPACE_CONFIG,
                      geminiApiKey: workspaceConfig.geminiApiKey,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:text-white hover:border-white/30 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Defaults</span>
                </button>
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
              <div className="rounded-xl border border-white/15 bg-black/30 p-4 space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-white">
                    Section Divider Headers
                  </h4>
                  <p className="text-[11px] text-white/55">
                    Rename, reorder, add, or remove table section groups (you
                    can also click any section header directly in the table).
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {workspaceConfig.sections.map((sec, idx) => (
                    <div
                      key={sec.id}
                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5"
                    >
                      <span className="text-[10px] font-mono text-white/40 w-5">
                        #{idx + 1}
                      </span>
                      <input
                        type="text"
                        value={sec.label}
                        onChange={(e) => {
                          const next = workspaceConfig.sections.map((s, i) =>
                            i === idx ? { ...s, label: e.target.value } : s
                          );
                          onUpdateWorkspaceConfig({ sections: next });
                        }}
                        className="flex-1 rounded border border-white/10 bg-black/50 px-2 py-1 text-xs text-white focus:border-primary focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={workspaceConfig.sections.length <= 1}
                        onClick={() =>
                          onUpdateWorkspaceConfig({
                            sections: workspaceConfig.sections.filter(
                              (_, i) => i !== idx
                            ),
                          })
                        }
                        className="p-1 text-white/40 hover:text-red-400 disabled:opacity-20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
                  className="flex items-center gap-2 pt-2 border-t border-white/10"
                >
                  <input
                    type="text"
                    value={newSectionTitle}
                    onChange={(e) => setNewSectionTitle(e.target.value)}
                    placeholder="New section header title (e.g. 🚀 PROJECTS)..."
                    className="flex-1 rounded-lg border border-white/15 bg-black/60 px-2.5 py-1.5 text-xs text-white placeholder-white/35 focus:border-primary focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-black hover:brightness-110"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Section</span>
                  </button>
                </form>
              </div>

              {/* Column Headers & Workspace Titles Editor */}
              <div className="rounded-xl border border-white/15 bg-black/30 p-4 space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-white">
                    Table Column Headers &amp; Workspace Titles
                  </h4>
                  <p className="text-[11px] text-white/55">
                    Edit any header label below, or simply click directly on any
                    header in the app to rename it inline.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-white/50 mb-1">
                      Workspace Main Title
                    </label>
                    <input
                      type="text"
                      value={workspaceConfig.workspaceTitle}
                      onChange={(e) =>
                        onUpdateWorkspaceConfig({
                          workspaceTitle: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-white/15 bg-black/60 px-2.5 py-1.5 text-xs text-white focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-white/50 mb-1">
                      Top Navbar Brand Name
                    </label>
                    <input
                      type="text"
                      value={workspaceConfig.brandName}
                      onChange={(e) =>
                        onUpdateWorkspaceConfig({ brandName: e.target.value })
                      }
                      className="w-full rounded-lg border border-white/15 bg-black/60 px-2.5 py-1.5 text-xs text-white focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-white/50 mb-1">
                      Workspace Subtitle / Motto
                    </label>
                    <input
                      type="text"
                      value={workspaceConfig.workspaceSubtitle}
                      onChange={(e) =>
                        onUpdateWorkspaceConfig({
                          workspaceSubtitle: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-white/15 bg-black/60 px-2.5 py-1.5 text-xs text-white focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-white/10">
                  {(
                    Object.keys(
                      workspaceConfig.columnHeaders
                    ) as Array<keyof ColumnHeadersConfig>
                  ).map((colKey) => (
                    <div key={colKey}>
                      <label className="block text-[10px] uppercase tracking-wider text-white/45 mb-1">
                        {colKey.replace("_", " ")} Column
                      </label>
                      <input
                        type="text"
                        value={workspaceConfig.columnHeaders[colKey]}
                        onChange={(e) =>
                          onUpdateWorkspaceConfig({
                            columnHeaders: {
                              ...workspaceConfig.columnHeaders,
                              [colKey]: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded-lg border border-white/15 bg-black/60 px-2.5 py-1.5 text-xs text-white focus:border-primary focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: APPEARANCE & VIDEO ENGINE */}
          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  Full-Atmosphere Theme Palettes
                </h3>
                <p className="text-xs text-white/55 mb-3">
                  Themes transform the entire background aurora, glass panels,
                  table headers, section dividers, and accents.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {THEME_OPTIONS.map((t) => {
                    const selected =
                      profile.theme === t.id &&
                      !workspaceConfig.customThemeColors;
                    const isSharingan = t.id === "sharingan";
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          onUpdateWorkspaceConfig({ customThemeColors: null });
                          onUpdateProfile({ theme: t.id as ThemeName });
                        }}
                        className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition-all ${
                          selected
                            ? isSharingan
                              ? "border-red-500 bg-red-950/25 shadow-[0_0_24px_rgba(255,31,56,0.35)]"
                              : "border-primary bg-primary/15 shadow-neon"
                            : isSharingan
                            ? "border-red-500/30 bg-red-950/10 hover:bg-red-950/20 hover:border-red-500/50"
                            : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
                        }`}
                      >
                        <div className="pr-2 min-w-0">
                          <div className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                            <span>{t.name}</span>
                            {isSharingan && (
                              <span className="rounded bg-red-500/25 border border-red-500/40 px-1.5 py-0.2 text-[9px] font-bold text-red-300 uppercase tracking-wider">
                                Animated
                              </span>
                            )}
                            {selected && (
                              <Check className="w-3.5 h-3.5 text-primary" />
                            )}
                          </div>
                          <div className="text-[11px] text-white/50 mt-0.5 line-clamp-1">
                            {t.subtitle}
                          </div>
                        </div>

                        {/* Swatches / Sharingan Eye */}
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
              <div className="rounded-xl border border-white/15 bg-black/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">
                      Custom Color Palette Studio
                    </h4>
                    <p className="text-[11px] text-white/55">
                      Fine-tune individual colors for Background, Surface,
                      Accent, Primary &amp; Highlight.
                    </p>
                  </div>
                  {workspaceConfig.customThemeColors && (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateWorkspaceConfig({ customThemeColors: null })
                      }
                      className="text-xs text-primary hover:underline"
                    >
                      Reset to Preset Theme
                    </button>
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
                      className="flex flex-col gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] p-2.5 cursor-pointer hover:border-primary/50"
                    >
                      <span className="text-[10px] font-semibold text-white/70">
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
                        <span className="text-[11px] font-mono text-white/80">
                          {activeThemeColors[item.key]}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Video Background Preset & IndexedDB Custom Upload */}
              <div className="border-t border-white/10 pt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Video className="w-4 h-4 text-primary" />
                      Ambient Video &amp; Particle Background Engine
                    </h3>
                    <p className="text-xs text-white/55">
                      Lower the Overlay Dimming slider below to make the
                      background colors and animations even more vivid!
                    </p>
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
                  ).map((presetItem) => (
                    <button
                      key={presetItem.id}
                      type="button"
                      onClick={() =>
                        onUpdateProfile({ video_bg_preset: presetItem.id })
                      }
                      className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all ${
                        profile.video_bg_preset === presetItem.id
                          ? "border-primary bg-primary/20 text-highlight shadow-neon"
                          : "border-white/10 bg-white/5 text-white/70 hover:text-white"
                      }`}
                    >
                      {presetItem.label}
                    </button>
                  ))}
                </div>

                {/* Local IndexedDB Upload Box */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-4">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-white">
                      Upload Custom Loop Video (MP4 / WebM)
                    </div>
                    <div className="text-[11px] text-white/50">
                      Stored in local browser IndexedDB — zero cloud bandwidth.
                    </div>
                    {uploadStatus && (
                      <div className="text-[11px] text-emerald-400 font-medium pt-1">
                        {uploadStatus}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-black hover:brightness-110 transition-all">
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
                      <button
                        type="button"
                        onClick={async () => {
                          await clearCustomVideoFromIDB();
                          onUpdateProfile({ video_bg_preset: "aurora" });
                          setUploadStatus(
                            "Cleared custom video from IndexedDB."
                          );
                        }}
                        className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/70 hover:text-white"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Dim & Glass Blur Sliders */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-white/80">
                        Overlay Dimming (10% – 85%)
                      </span>
                      <span className="font-mono text-highlight">
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
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-white/80">
                        Frosted Glass Blur (0px – 24px)
                      </span>
                      <span className="font-mono text-highlight">
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
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TASK DOCUMENT VIEW PREFERENCE */}
          {activeTab === "view" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  Task Document Opening Behavior
                </h3>
                <p className="text-xs text-white/55">
                  Choose how the TipTap rich-text document editor opens when you
                  click the &ldquo;Doc&rdquo; button on a task row.
                </p>
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
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => onUpdateProfile({ view_mode: mode.id })}
                      className={`flex flex-col justify-between rounded-xl border p-4 text-left transition-all ${
                        active
                          ? "border-primary bg-primary/15 shadow-neon"
                          : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">
                            {mode.title}
                          </span>
                          {active && (
                            <Check className="w-4 h-4 text-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-white/55 leading-relaxed">
                          {mode.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Show Completed Tasks Preference */}
              <div className="rounded-xl border border-white/15 bg-black/40 p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      Show completed tasks
                    </h4>
                    <p className="text-[11px] text-white/55">
                      Display finished and checked-off tasks directly in the document table. When turned off, checking off a task automatically moves it to the Completed list.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateWorkspaceConfig({
                        showCompletedTasks: !workspaceConfig.showCompletedTasks,
                      })
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      workspaceConfig.showCompletedTasks
                        ? "bg-primary"
                        : "bg-white/20"
                    }`}
                    role="switch"
                    aria-checked={Boolean(workspaceConfig.showCompletedTasks)}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
                        workspaceConfig.showCompletedTasks
                          ? "translate-x-5 bg-black"
                          : "translate-x-0 bg-white"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: AI AGENT & API KEY */}
          {activeTab === "ai" && (
            <div className="space-y-6">
              {/* 1. Enable / Hide AI Workspace Agent Toggle */}
              <div className="rounded-xl border border-white/15 bg-black/40 p-4 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <h4 className="text-xs font-bold text-white">
                        Enable Gemini AI Workspace Agent
                      </h4>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          !aiTemporarilyDisabled
                            ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
                            : "border-zinc-400/30 bg-zinc-500/15 text-zinc-300"
                        }`}
                      >
                        {!aiTemporarilyDisabled ? "Enabled" : "Hidden for Session"}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/55 leading-relaxed">
                      When enabled, the hero homepage opens to your Gemini-styled AI Agent with a{" "}
                      <span className="text-white/80 font-medium">Chat / Tasks</span> tab switcher.
                      Turn off temporarily if you prefer a pure task-table workspace with all AI chats hidden.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onSetAiTemporarilyDisabled(!aiTemporarilyDisabled)
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      !aiTemporarilyDisabled ? "bg-primary" : "bg-white/20"
                    }`}
                    role="switch"
                    aria-checked={!aiTemporarilyDisabled}
                    aria-label="Enable Gemini AI Workspace Agent"
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
                        !aiTemporarilyDisabled
                          ? "translate-x-5 bg-black"
                          : "translate-x-0 bg-white"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* 2. AI Provider & API Key Setup */}
              <div className="rounded-xl border border-white/15 bg-black/35 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-primary" />
                      AI Provider &amp; Model Setup (NVIDIA NIM + Google Gemini)
                    </h4>
                    <p className="text-[11px] text-white/55 mt-0.5">
                      Pair NVIDIA NIM (free inference on leading models at build.nvidia.com) with Google Gemini for automatic failover.
                    </p>
                  </div>

                  {hasSavedKey ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Connected (
                      {aiProvider === "nvidia" ? "NVIDIA NIM" : "Google Gemini"}{" "}
                      • {effectiveApiKey.slice(0, 6)}••••
                      {effectiveApiKey.slice(-4)})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold text-amber-200">
                      <AlertCircle className="w-3.5 h-3.5" />
                      No API Key Set
                    </span>
                  )}
                </div>

                {/* Provider Selector Tabs */}
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/[0.04] p-1 border border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setAiProvider("nvidia");
                      onUpdateWorkspaceConfig({ aiProvider: "nvidia" });
                      setApiKeyDraft(
                        workspaceConfig.nvidiaApiKey ||
                          (effectiveApiKey.startsWith("nvapi-") ? effectiveApiKey : "")
                      );
                      if (apiKeyStatus) setApiKeyStatus(null);
                    }}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-xs font-bold transition-all ${
                      aiProvider === "nvidia"
                        ? "bg-primary text-black shadow-neon"
                        : "text-white/70 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <span>NVIDIA NIM</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider ${
                        aiProvider === "nvidia"
                          ? "bg-black/20 text-black"
                          : "bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      Free Inference
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAiProvider("gemini");
                      onUpdateWorkspaceConfig({ aiProvider: "gemini" });
                      setApiKeyDraft(
                        workspaceConfig.geminiApiKey ||
                          (effectiveApiKey.startsWith("AIza") ? effectiveApiKey : "")
                      );
                      if (apiKeyStatus) setApiKeyStatus(null);
                    }}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 px-2 text-xs font-bold transition-all ${
                      aiProvider === "gemini"
                        ? "bg-primary text-black shadow-neon"
                        : "text-white/70 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <span>Google Gemini</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider ${
                        aiProvider === "gemini"
                          ? "bg-black/20 text-black"
                          : "bg-white/10 text-white/60"
                      }`}
                    >
                      Paired
                    </span>
                  </button>
                </div>

                {/* NVIDIA NIM Model Selector */}
                {aiProvider === "nvidia" && (
                  <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-white/90">
                        Active NVIDIA NIM Model
                      </label>
                      <span className="text-[10px] text-white/45">
                        Also switchable anytime in the chat bar
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {NVIDIA_MODEL_OPTIONS.map((m) => {
                        const isSelected =
                          (workspaceConfig.nvidiaModel || DEFAULT_NVIDIA_MODEL) ===
                          m.id;
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
                            className={`flex flex-col items-start rounded-lg border px-2.5 py-2 text-left transition-all ${
                              isSelected
                                ? "border-primary/60 bg-primary/15 text-white"
                                : "border-white/10 bg-black/30 text-white/70 hover:border-white/25 hover:text-white"
                            }`}
                          >
                            <div className="flex w-full items-center justify-between gap-1.5">
                              <span className="text-[11px] font-bold truncate">
                                {m.name}
                              </span>
                              <span
                                className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                                  isSelected
                                    ? "bg-primary text-black"
                                    : "bg-white/10 text-white/65"
                                }`}
                              >
                                {m.badge}
                              </span>
                            </div>
                            <span className="text-[10px] text-white/45 truncate w-full mt-0.5">
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
                  <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3.5 space-y-2 text-[11px] text-white/75">
                    <div className="font-semibold text-white/90">
                      How to get a free NVIDIA NIM API key (~30 seconds):
                    </div>
                    <ol className="list-decimal pl-4 space-y-1 text-white/65">
                      <li>
                        Open{" "}
                        <a
                          href="https://build.nvidia.com/models"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-highlight underline underline-offset-2 hover:brightness-110 font-medium"
                        >
                          build.nvidia.com/models
                          <ExternalLink className="w-3 h-3" />
                        </a>{" "}
                        and sign in with your email, Google, or NVIDIA account.
                      </li>
                      <li>
                        Click any model and click{" "}
                        <strong className="text-white/90">&ldquo;Get API Key&rdquo;</strong>{" "}
                        (or <strong className="text-white/90">&ldquo;Generate Key&rdquo;</strong>) in the top right.
                      </li>
                      <li>
                        Copy the key (starts with <code className="text-highlight">nvapi-...</code>),
                        paste it below, and click <strong className="text-white/90">Verify &amp; Save Key</strong>.
                      </li>
                    </ol>
                  </div>
                ) : (
                  <div className="rounded-lg border border-white/10 bg-white/[0.025] p-3.5 space-y-2 text-[11px] text-white/75">
                    <div className="font-semibold text-white/90">
                      How to get a free Google Gemini API key (~30 seconds):
                    </div>
                    <ol className="list-decimal pl-4 space-y-1 text-white/65">
                      <li>
                        Open{" "}
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-highlight underline underline-offset-2 hover:brightness-110 font-medium"
                        >
                          Google AI Studio (aistudio.google.com/app/apikey)
                          <ExternalLink className="w-3 h-3" />
                        </a>{" "}
                        and sign in with your Google account.
                      </li>
                      <li>
                        Click <strong className="text-white/90">&ldquo;Create API key&rdquo;</strong>{" "}
                        (free tier includes generous Gemini 3.8 Flash &amp; Pro usage).
                      </li>
                      <li>
                        Copy the key (starts with <code className="text-highlight">AIzaSy...</code>),
                        paste it below, and click <strong className="text-white/90">Verify &amp; Save Key</strong>.
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
                      <input
                        id="settings-gemini-api-key"
                        type={showApiKey ? "text" : "password"}
                        value={apiKeyDraft}
                        onChange={(e) => {
                          const val = e.target.value;
                          setApiKeyDraft(val);
                          if (val.startsWith("nvapi-")) setAiProvider("nvidia");
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
                        className="w-full rounded-xl border border-white/15 bg-black/60 pl-3.5 pr-10 py-2.5 text-xs text-white placeholder-white/30 focus:border-primary focus:outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-white/45 hover:text-white transition-colors"
                        title={showApiKey ? "Hide key" : "Show key"}
                      >
                        {showApiKey ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={verifyingApiKey}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-black hover:brightness-110 disabled:opacity-50 transition-all shrink-0 shadow-neon"
                    >
                      {verifyingApiKey ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Verifying...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Verify &amp; Save Key</span>
                        </>
                      )}
                    </button>

                    {apiKeyDraft.trim() && (
                      <button
                        type="button"
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
                        className="inline-flex items-center justify-center gap-1 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 transition-colors shrink-0"
                        title="Remove saved API key"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  {apiKeyStatus && (
                    <div
                      className={`flex items-center gap-1.5 text-xs font-medium ${
                        apiKeyStatus.type === "success"
                          ? "text-emerald-400"
                          : "text-rose-400"
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
              </div>

              {/* 3. Agent Coaching Personality */}
              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  Gemini Agent Personality &amp; Coaching Tone
                </h3>
                <p className="text-xs text-white/55 mb-3">
                  Configures how your workspace agent communicates, prioritizes, and coaches you.
                </p>

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
                    ] as Array<{ id: AITone; name: string; desc: string }>
                  ).map((t) => {
                    const active = profile.ai_tone === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onUpdateProfile({ ai_tone: t.id })}
                        className={`rounded-xl border p-3.5 text-left transition-all ${
                          active
                            ? "border-primary bg-primary/15 shadow-neon"
                            : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold text-white">
                          <span>{t.name}</span>
                          {active && <Check className="w-4 h-4 text-primary" />}
                        </div>
                        <p className="text-[11px] text-white/55 mt-1">
                          {t.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: INTEGRATIONS */}
          {activeTab === "integrations" && (
            <div className="space-y-6">
              {/* 1. HCPSS Canvas iCal Feed */}
              <div className="rounded-xl border border-white/15 bg-white/[0.03] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">
                      HCPSS Canvas LMS iCal Feed Sync
                    </h4>
                    <p className="text-[11px] text-white/55">
                      Paste your private Canvas Calendar Feed URL (or leave
                      blank to test with the built-in sample feed).
                    </p>
                  </div>
                  <span className="rounded-full bg-orange-500/20 border border-orange-400/40 px-2.5 py-0.5 text-[10px] font-semibold text-orange-300">
                    node-ical
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={profile.canvas_feed_url || ""}
                    onChange={(e) =>
                      onUpdateProfile({ canvas_feed_url: e.target.value })
                    }
                    placeholder="https://hcpss.instructure.com/feeds/calendars/user_xxxx.ics"
                    className="flex-1 rounded-xl border border-white/15 bg-black/60 px-3.5 py-2 text-xs text-white placeholder-white/30 focus:border-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={canvasSyncLoading}
                    onClick={handleCanvasSyncClick}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-black hover:brightness-110 disabled:opacity-50 transition-all shrink-0"
                  >
                    {canvasSyncLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>Sync Now</span>
                  </button>
                </div>

                {canvasSyncMessage && (
                  <p className="text-xs text-emerald-400 font-medium">
                    {canvasSyncMessage}
                  </p>
                )}
              </div>

              {/* 2. Google Calendar Sync */}
              <div className="rounded-xl border border-white/15 bg-white/[0.03] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white">
                    Google Calendar Two-Way Deadline Sync
                  </h4>
                  <p className="text-[11px] text-white/55">
                    Push task due dates and time blocks directly to your primary
                    Google Calendar.
                  </p>
                  {gcalMessage && (
                    <p className="text-xs text-highlight font-medium pt-1">
                      {gcalMessage}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  disabled={gcalSyncLoading}
                  onClick={handleGoogleCalendarSync}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15 transition-colors shrink-0"
                >
                  {gcalSyncLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                  )}
                  <span>Sync Google Calendar</span>
                </button>
              </div>

              {/* 3. Apple Calendar / iOS .ics Subscription Feed */}
              <div className="rounded-xl border border-white/15 bg-white/[0.03] p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">
                      Apple Calendar &amp; iOS Reminders Live .ics Feed
                    </h4>
                    <p className="text-[11px] text-white/55">
                      Subscribe in Apple Calendar (File → New Calendar
                      Subscription) using your authenticated token URL.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={appleCalUrl}
                    className="flex-1 rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-xs text-white/80 font-mono focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyIcs}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
                  >
                    {copiedIcs ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>
                  <a
                    href={appleCalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-xl bg-primary/20 border border-primary/40 px-3 py-2 text-xs font-semibold text-highlight hover:bg-primary/30 transition-colors"
                    title="Download / Preview .ics Feed"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>.ics</span>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-white/10 theme-header-bg px-6 py-3.5 text-xs text-white/60">
          <span>All customizations auto-save &amp; sync to Supabase</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-primary px-4 py-1.5 font-bold text-black hover:brightness-110 transition-all shadow-neon"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
