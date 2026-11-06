"use client";

import React, { useState } from "react";
import {
  THEME_OPTIONS,
  ThemeName,
  UserProfile,
} from "@/types/taskit";
import {
  Bot,
  Check,
  ChevronDown,
  LogIn,
  LogOut,
  Palette,
  RefreshCw,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Video,
} from "lucide-react";

interface TopNavBarProps {
  profile: UserProfile;
  isAuthenticated: boolean;
  isCopilotOpen: boolean;
  isSyncingCanvas: boolean;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onOpenSettings: () => void;
  onToggleCopilot: () => void;
  onQuickSyncCanvas: () => void;
  onGoogleSignIn: () => void;
  onSignOut: () => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  profile,
  isAuthenticated,
  isCopilotOpen,
  isSyncingCanvas,
  onUpdateProfile,
  onOpenSettings,
  onToggleCopilot,
  onQuickSyncCanvas,
  onGoogleSignIn,
  onSignOut,
}) => {
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [videoControlOpen, setVideoControlOpen] = useState(false);

  const activeThemeMeta =
    THEME_OPTIONS.find((t) => t.id === profile.theme) || THEME_OPTIONS[0];

  return (
    <header className="sticky top-0 z-30 border-b border-white/15 bg-black/50 backdrop-blur-xl">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-surface border border-highlight/40 shadow-neon">
            <Sparkles className="w-5 h-5 text-black fill-black/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight text-white">
                TaskIt
              </span>
              <span className="hidden sm:inline-flex items-center rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-highlight">
                v2.4 • AI Workspace
              </span>
            </div>
            <p className="text-[11px] text-white/50 hidden sm:block">
              tasks.sunayraval.com • Notion-Style Telemetry &amp; Copilot
            </p>
          </div>
        </div>

        {/* Right: Interactive Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* 1. Instant Theme Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setThemeDropdownOpen((v) => !v);
                setVideoControlOpen(false);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-medium text-white hover:bg-white/10 transition-colors"
              title="Switch Theme"
            >
              <Palette className="w-3.5 h-3.5 text-primary" />
              <span className="hidden md:inline">{activeThemeMeta.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-white/50" />
            </button>

            {themeDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-64 rounded-2xl border border-white/20 bg-[#051014]/95 p-2 shadow-2xl backdrop-blur-2xl z-50"
                onMouseLeave={() => setThemeDropdownOpen(false)}
              >
                <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/45">
                  Select Color Theme
                </div>
                {THEME_OPTIONS.map((t) => {
                  const isSelected = profile.theme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        onUpdateProfile({ theme: t.id as ThemeName });
                        setThemeDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                        isSelected
                          ? "bg-primary/20 text-highlight font-bold"
                          : "text-white/80 hover:bg-white/10"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-primary" />
                        )}
                        {t.name}
                      </span>
                      <span className="flex items-center -space-x-1">
                        {Object.values(t.colors)
                          .slice(0, 4)
                          .map((hex, idx) => (
                            <span
                              key={idx}
                              className="h-3.5 w-3.5 rounded-full border border-black"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Quick Video Overlay Controls (Dim & Blur Sliders) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setVideoControlOpen((v) => !v);
                setThemeDropdownOpen(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-medium text-white hover:bg-white/10 transition-colors"
              title="Video Background Dim & Glass Blur Controls"
            >
              <Video className="w-3.5 h-3.5 text-primary" />
              <span className="hidden lg:inline">BG Glass</span>
            </button>

            {videoControlOpen && (
              <div
                className="absolute right-0 mt-2 w-72 rounded-2xl border border-white/20 bg-[#051014]/95 p-4 shadow-2xl backdrop-blur-2xl z-50 space-y-3"
                onMouseLeave={() => setVideoControlOpen(false)}
              >
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <span className="flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                    Video Overlay Controls
                  </span>
                  <span className="text-[10px] uppercase text-highlight font-mono">
                    {profile.video_bg_preset}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-white/70">
                    <span>Dim Overlay</span>
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

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-white/70">
                    <span>Frosted Glass Blur</span>
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
            )}
          </div>

          {/* 3. HCPSS Canvas Quick Sync Button */}
          <button
            type="button"
            disabled={isSyncingCanvas}
            onClick={onQuickSyncCanvas}
            className="inline-flex items-center gap-1.5 rounded-xl border border-orange-400/35 bg-orange-500/15 px-3 py-2 text-xs font-semibold text-orange-200 hover:bg-orange-500/25 transition-colors"
            title="Sync HCPSS Canvas iCal Assignments"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isSyncingCanvas ? "animate-spin" : ""}`}
            />
            <span className="hidden md:inline">Sync Canvas</span>
          </button>

          {/* 4. Copilot Sidebar Toggle */}
          <button
            type="button"
            onClick={onToggleCopilot}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
              isCopilotOpen
                ? "border-primary bg-primary text-black shadow-neon"
                : "border-primary/40 bg-primary/15 text-highlight hover:bg-primary/25"
            }`}
          >
            <Bot className="w-4 h-4" />
            <span className="hidden sm:inline">Copilot</span>
          </button>

          {/* 5. Settings Modal Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded-xl border border-white/15 bg-white/[0.06] p-2 text-white/80 hover:bg-white/15 hover:text-white transition-colors"
            title="Open Workspace Settings"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* 6. Google OAuth Sign In / Profile Pill */}
          {isAuthenticated ? (
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs text-white hover:bg-white/10"
              title="Sign Out"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="hidden xl:inline truncate max-w-[110px]">
                {profile.full_name || profile.email}
              </span>
              <LogOut className="w-3.5 h-3.5 text-white/50" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onGoogleSignIn}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
              title="Sign in with Google OAuth (Supabase)"
            >
              <LogIn className="w-3.5 h-3.5 text-primary" />
              <span className="hidden xl:inline">Google Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

