"use client";

import React, { useState } from "react";
import {
  THEME_OPTIONS,
  ThemeName,
  UserProfile,
  WorkspaceConfig,
  WorkspaceTab,
} from "@/types/taskit";
import {
  CalendarClock,
  Check,
  ChevronDown,
  LogIn,
  LogOut,
  Palette,
  RefreshCw,
  Settings,
  Sparkles,
  Table2,
} from "lucide-react";
import { KiteLogoMark } from "@/components/ui/KiteBrand";
import { SharinganIcon } from "@/components/ui/SharinganIcon";

interface TopNavBarProps {
  profile: UserProfile;
  workspaceConfig: WorkspaceConfig;
  isAuthenticated: boolean;
  canAccessWorkspace: boolean;
  activeTab: WorkspaceTab;
  aiTemporarilyDisabled: boolean;
  hasGeminiApiKey: boolean;
  activeTaskCount: number;
  isSyncingCanvas: boolean;
  onSelectTab: (tab: WorkspaceTab) => void;
  onResetChatToHero?: () => void;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onUpdateWorkspaceConfig: (updates: Partial<WorkspaceConfig>) => void;
  onOpenSettings: () => void;
  onQuickSyncCanvas: () => void;
  onGoogleSignIn: () => void;
  onSignOut: () => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  profile,
  workspaceConfig,
  isAuthenticated,
  canAccessWorkspace,
  activeTab,
  aiTemporarilyDisabled,
  hasGeminiApiKey,
  activeTaskCount,
  isSyncingCanvas,
  onSelectTab,
  onResetChatToHero,
  onUpdateProfile,
  onUpdateWorkspaceConfig,
  onOpenSettings,
  onQuickSyncCanvas,
  onGoogleSignIn,
  onSignOut,
}) => {
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);

  const activeThemeMeta =
    THEME_OPTIONS.find((t) => t.id === profile.theme) || THEME_OPTIONS[0];

  return (
    <header className="sticky top-0 z-30 border-b theme-header-bg backdrop-blur-xl transition-colors duration-300">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
        {/* Left: Brand Identity matching user screenshot, strictly non-editable */}
        <div className="flex items-center gap-2.5 shrink-0 select-none">
          {profile.theme === "sharingan" ? (
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#140305] border border-red-500/50 shadow-[0_0_24px_rgba(255,31,56,0.65)] transition-all cursor-pointer"
              title="Uchiha Clan Sharingan Eye (Spinning 3-Tomoe)"
            >
              <SharinganIcon size={24} animate speed="normal" glow interactive />
            </div>
          ) : (
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-[0_0_24px_rgba(250,204,21,0.55)] transition-transform"
              style={{
                backgroundColor: "#facc15",
                color: "#09090b",
              }}
            >
              <KiteLogoMark className="w-5 h-5 text-black" strokeWidth={2.4} />
            </div>
          )}
          <span className="text-xl font-extrabold tracking-tight text-white leading-none">
            kite
          </span>
          {profile.theme === "sharingan" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/60 bg-red-950/40 px-2.5 py-0.5 text-xs font-mono font-bold text-red-400 shadow-[0_0_12px_rgba(255,31,56,0.45)] leading-none">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
              UCHIHA 2.0
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-white px-2.5 py-0.5 text-xs font-mono font-medium text-yellow-300 leading-none">
              2.0
            </span>
          )}
        </div>

        {/* Center: Workspace Mode Switcher (Chat hidden when user opts out of AI; Tasks & my day always available) */}
        {canAccessWorkspace && (
          <div
            role="tablist"
            aria-label="Workspace View Switcher"
            className="inline-flex items-center rounded-full border border-white/15 bg-black/45 p-1 backdrop-blur-xl shadow-inner"
          >
            {!aiTemporarilyDisabled && (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "chat"}
                onClick={() => {
                  onSelectTab("chat");
                  onResetChatToHero?.();
                }}
                className={`relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                  activeTab === "chat"
                    ? "bg-white/15 text-white shadow-sm border border-white/15"
                    : "text-white/60 hover:text-white border border-transparent"
                }`}
              >
                <Sparkles
                  className={`w-3.5 h-3.5 ${
                    activeTab === "chat" ? "text-primary" : "text-white/50"
                  }`}
                />
                <span>Chat</span>
                {!hasGeminiApiKey && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-amber-400"
                    title="Google AI API key required"
                  />
                )}
              </button>
            )}

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "tasks"}
              onClick={() => onSelectTab("tasks")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                activeTab === "tasks"
                  ? "bg-white/15 text-white shadow-sm border border-white/15"
                  : "text-white/60 hover:text-white border border-transparent"
              }`}
            >
              <Table2
                className={`w-3.5 h-3.5 ${
                  activeTab === "tasks" ? "text-primary" : "text-white/50"
                }`}
              />
              <span>Tasks</span>
              {activeTaskCount > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                    activeTab === "tasks"
                      ? "bg-primary/25 text-highlight"
                      : "bg-white/10 text-white/65"
                  }`}
                >
                  {activeTaskCount}
                </span>
              )}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "my_day"}
              onClick={() => onSelectTab("my_day")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                activeTab === "my_day"
                  ? "bg-white/15 text-white shadow-sm border border-white/15"
                  : "text-white/60 hover:text-white border border-transparent"
              }`}
            >
              <CalendarClock
                className={`w-3.5 h-3.5 ${
                  activeTab === "my_day" ? "text-primary" : "text-white/50"
                }`}
              />
              <span>my day</span>
              {(workspaceConfig.myDaySchedule?.blocks.length || 0) > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                    activeTab === "my_day"
                      ? "bg-primary/25 text-highlight"
                      : "bg-white/10 text-white/65"
                  }`}
                >
                  {workspaceConfig.myDaySchedule?.blocks.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Right: Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Theme Switcher */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setThemeDropdownOpen((v) => !v)}
              className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-all ${
                profile.theme === "sharingan"
                  ? "border-red-500/50 bg-red-950/30 text-red-200 hover:border-red-400 shadow-[0_0_12px_rgba(255,31,56,0.3)]"
                  : "border-white/15 bg-white/5 text-white/90 hover:text-white hover:border-primary/50"
              }`}
              title="Switch theme"
            >
              {profile.theme === "sharingan" ? (
                <SharinganIcon size={16} animate speed="fast" glow={false} />
              ) : (
                <Palette className="w-3.5 h-3.5 text-primary" />
              )}
              <span className="hidden xl:inline font-medium">
                {profile.theme === "custom" ? "Custom Theme" : activeThemeMeta.name}
              </span>
              <div className="flex items-center -space-x-1">
                <span
                  className="h-2.5 w-2.5 rounded-full border border-black/50"
                  style={{ backgroundColor: "var(--primary)" }}
                />
                <span
                  className="h-2.5 w-2.5 rounded-full border border-black/50"
                  style={{ backgroundColor: "var(--surface)" }}
                />
              </div>
              <ChevronDown className="w-3 h-3 text-white/50" />
            </button>

            {themeDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-64 rounded-xl border theme-panel p-1.5 shadow-2xl backdrop-blur-2xl z-50"
                onMouseLeave={() => setThemeDropdownOpen(false)}
              >
                {THEME_OPTIONS.map((t) => {
                  const isSelected = profile.theme === t.id;
                  const isSharingan = t.id === "sharingan";
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        onUpdateProfile({ theme: t.id as ThemeName });
                        setThemeDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                        isSelected
                          ? "bg-primary/20 text-highlight font-semibold border border-primary/40 shadow-sm"
                          : isSharingan
                          ? "text-red-300 hover:text-white hover:bg-red-500/15"
                          : "text-white/75 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {isSharingan ? (
                          <SharinganIcon size={18} animate speed="normal" glow={false} />
                        ) : (
                          <div className="flex -space-x-1">
                            <span
                              className="h-3.5 w-3.5 rounded-full border border-black/60"
                              style={{ backgroundColor: t.colors.bgBase }}
                            />
                            <span
                              className="h-3.5 w-3.5 rounded-full border border-black/60"
                              style={{ backgroundColor: t.colors.surface }}
                            />
                            <span
                              className="h-3.5 w-3.5 rounded-full border border-black/60"
                              style={{ backgroundColor: t.colors.primary }}
                            />
                          </div>
                        )}
                        <span className="flex items-center gap-1.5">
                          {t.name}
                          {isSharingan && (
                            <span className="rounded bg-red-500/25 border border-red-500/40 px-1.5 py-0.2 text-[9px] font-bold text-red-300 uppercase tracking-wider">
                              Special
                            </span>
                          )}
                        </span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sync Canvas */}
          {canAccessWorkspace && (
            <button
              type="button"
              disabled={isSyncingCanvas}
              onClick={onQuickSyncCanvas}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-white/85 hover:text-white hover:border-primary/50 transition-colors"
              title="Sync Canvas Assignments"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isSyncingCanvas ? "animate-spin text-primary" : "text-primary/80"
                }`}
              />
              <span className="hidden lg:inline">Sync Canvas</span>
            </button>
          )}

          {/* Settings */}
          {canAccessWorkspace && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-white/85 hover:text-white hover:border-primary/50 transition-colors"
              title="Customize Tags, Categories, Themes, AI & Settings"
            >
              <Settings className="w-3.5 h-3.5 text-primary" />
              <span className="hidden lg:inline">Customize</span>
            </button>
          )}

          {/* Google Auth Status */}
          {isAuthenticated ? (
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-white/85 hover:text-white hover:border-red-400/50 transition-colors"
              title="Sign Out"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="hidden sm:inline max-w-[110px] truncate">
                {profile.full_name || profile.email}
              </span>
              <LogOut className="w-3.5 h-3.5 text-white/50" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onGoogleSignIn}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-black hover:brightness-110 transition-all shadow-neon"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign in with Google</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
