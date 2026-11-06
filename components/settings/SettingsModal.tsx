"use client";

import React, { useState } from "react";
import {
  AITone,
  THEME_OPTIONS,
  ThemeName,
  UserProfile,
  VideoPresetName,
  ViewMode,
  TaskItem,
} from "@/types/taskit";
import {
  saveCustomVideoToIDB,
  clearCustomVideoFromIDB,
} from "@/components/background/VideoBackground";
import {
  Bot,
  Calendar,
  Check,
  Copy,
  Eye,
  KeyRound,
  LayoutPanelLeft,
  Loader2,
  Palette,
  RefreshCw,
  Sliders,
  Upload,
  Video,
  X,
  ExternalLink,
} from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  tasks: TaskItem[];
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onCustomVideoUploaded: () => void;
  onSyncCanvasTasks: (feedUrl: string) => Promise<{
    count: number;
    usedDemoFeed: boolean;
  }>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  tasks,
  onUpdateProfile,
  onCustomVideoUploaded,
  onSyncCanvasTasks,
}) => {
  const [activeTab, setActiveTab] = useState<
    "appearance" | "view" | "ai" | "integrations"
  >("appearance");
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [canvasSyncLoading, setCanvasSyncLoading] = useState(false);
  const [canvasSyncMessage, setCanvasSyncMessage] = useState<string>("");
  const [gcalSyncLoading, setGcalSyncLoading] = useState(false);
  const [gcalMessage, setGcalMessage] = useState<string>("");
  const [copiedIcs, setCopiedIcs] = useState(false);

  if (!isOpen) return null;

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[88vh] rounded-2xl border border-white/20 bg-[#051014]/95 backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-black/40">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-base font-bold text-white">
                TaskIt Workspace Settings
              </h2>
              <p className="text-xs text-white/50">
                Customize themes, zero-bandwidth video backgrounds, AI Copilot &
                HCPSS Canvas sync
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
        <div className="flex border-b border-white/10 bg-white/[0.02] px-6 gap-2 overflow-x-auto">
          {[
            { id: "appearance", label: "1. Appearance & Video", icon: Palette },
            { id: "view", label: "2. Task View Mode", icon: LayoutPanelLeft },
            { id: "ai", label: "3. AI Copilot & BYOK", icon: Bot },
            { id: "integrations", label: "4. Canvas & Calendars", icon: Calendar },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() =>
                  setActiveTab(
                    tab.id as "appearance" | "view" | "ai" | "integrations"
                  )
                }
                className={`flex items-center gap-2 border-b-2 py-3 px-2 text-xs font-semibold whitespace-nowrap transition-colors ${
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
          {/* TAB 1: APPEARANCE & VIDEO ENGINE */}
          {activeTab === "appearance" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  Color Theme Palette (Instant Variable Switching)
                </h3>
                <p className="text-xs text-white/55 mb-3">
                  Select one of the 5 curated high-contrast productivity themes.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {THEME_OPTIONS.map((t) => {
                    const selected = profile.theme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() =>
                          onUpdateProfile({ theme: t.id as ThemeName })
                        }
                        className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition-all ${
                          selected
                            ? "border-primary bg-primary/15 shadow-neon"
                            : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            {t.name}
                            {selected && (
                              <Check className="w-3.5 h-3.5 text-primary" />
                            )}
                          </div>
                          <div className="text-[11px] text-white/50 mt-0.5">
                            {t.subtitle}
                          </div>
                        </div>

                        {/* Swatches */}
                        <div className="flex items-center -space-x-1.5 shrink-0">
                          {Object.values(t.colors).map((hex, i) => (
                            <span
                              key={i}
                              className="h-5 w-5 rounded-full border border-black/60"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Video Background Preset & IndexedDB Custom Upload */}
              <div className="border-t border-white/10 pt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Video className="w-4 h-4 text-primary" />
                      Ambient Video Background Engine
                    </h3>
                    <p className="text-xs text-white/55">
                      Custom MP4/WebM uploads are stored in browser IndexedDB (
                      <code>idb-keyval</code>) with zero cloud bandwidth cost.
                    </p>
                  </div>
                </div>

                {/* 4 Presets + Custom */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {(
                    [
                      { id: "rain", label: "🌧️ Cyber Rain" },
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
                      Stored via <code>set(&apos;custom_video_bg&apos;, fileBlob)</code>{" "}
                      — never uploaded to Supabase or Vercel.
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
                          onUpdateProfile({ video_bg_preset: "rain" });
                          setUploadStatus("Cleared custom video from IndexedDB.");
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
                        Overlay Dimming (20% – 85%)
                      </span>
                      <span className="font-mono text-highlight">
                        {Math.round(profile.video_bg_dim * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.2}
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

          {/* TAB 2: TASK DOCUMENT VIEW PREFERENCE */}
          {activeTab === "view" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  Task Document Opening Behavior
                </h3>
                <p className="text-xs text-white/55">
                  Choose how the TipTap rich-text document editor opens when you
                  click a task title.
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
            </div>
          )}

          {/* TAB 3: AI PREFERENCES & BYOK */}
          {activeTab === "ai" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  TaskIt Copilot Personality & Coaching Tone
                </h3>
                <p className="text-xs text-white/55 mb-3">
                  Configures the system prompt for Gemini 1.5 Flash tool calls &
                  briefings.
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

              <div className="border-t border-white/10 pt-5 space-y-2">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-primary" />
                  Bring Your Own Key (BYOK — Google Gemini or OpenRouter Free Tier)
                </label>
                <p className="text-[11px] text-white/50">
                  Optional. Stored in your private profile preferences and sent
                  only to <code>/api/chat</code>.
                </p>
                <input
                  type="password"
                  value={profile.custom_ai_api_key || ""}
                  onChange={(e) =>
                    onUpdateProfile({
                      custom_ai_api_key: e.target.value || null,
                    })
                  }
                  placeholder="AIzaSy... or sk-or-v1-..."
                  className="w-full rounded-xl border border-white/15 bg-black/60 px-3.5 py-2.5 text-xs text-white placeholder-white/30 focus:border-primary focus:outline-none font-mono"
                />
              </div>
            </div>
          )}

          {/* TAB 4: INTEGRATIONS (CANVAS iCAL, GOOGLE CALENDAR, APPLE ICS) */}
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
                      blank to test with the built-in HCPSS AP Bio / Linear
                      Algebra demo feed).
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
        <div className="flex items-center justify-between border-t border-white/10 bg-black/40 px-6 py-3.5 text-xs text-white/50">
          <span>All preferences auto-save locally &amp; sync to Supabase</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-primary px-4 py-1.5 font-bold text-black hover:brightness-110 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

