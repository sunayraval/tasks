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
  Pencil,
  RefreshCw,
  Settings,
  Sparkles,
  Table2,
} from "lucide-react";

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
  onUpdateProfile,
  onUpdateWorkspaceConfig,
  onOpenSettings,
  onQuickSyncCanvas,
  onGoogleSignIn,
  onSignOut,
}) => {
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState(false);
  const [editingBadge, setEditingBadge] = useState(false);
  const [brandDraft, setBrandDraft] = useState(workspaceConfig.brandName);
  const [badgeDraft, setBadgeDraft] = useState(workspaceConfig.brandBadge);

  const activeThemeMeta =
    THEME_OPTIONS.find((t) => t.id === profile.theme) || THEME_OPTIONS[0];

  const commitBrand = () => {
    setEditingBrand(false);
    const cleaned = brandDraft.trim() || "TaskIt";
    setBrandDraft(cleaned);
    if (cleaned !== workspaceConfig.brandName) {
      onUpdateWorkspaceConfig({ brandName: cleaned });
    }
  };

  const commitBadge = () => {
    setEditingBadge(false);
    const cleaned = badgeDraft.trim();
    setBadgeDraft(cleaned);
    if (cleaned !== workspaceConfig.brandBadge) {
      onUpdateWorkspaceConfig({ brandBadge: cleaned });
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b theme-header-bg backdrop-blur-xl transition-colors duration-300">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
        {/* Left: Editable Brand Identity */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-extrabold text-sm shadow-neon transition-colors"
            style={{
              backgroundColor: "var(--primary)",
              color: "#09090b",
            }}
          >
            {(workspaceConfig.brandName || "T").charAt(0).toUpperCase()}
          </div>
          <div className="flex items-center gap-2 min-w-0">
            {editingBrand ? (
              <input
                type="text"
                autoFocus
                value={brandDraft}
                onChange={(e) => setBrandDraft(e.target.value)}
                onBlur={commitBrand}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitBrand();
                  if (e.key === "Escape") {
                    setBrandDraft(workspaceConfig.brandName);
                    setEditingBrand(false);
                  }
                }}
                className="rounded border border-primary bg-black/60 px-2 py-0.5 text-sm font-bold text-white focus:outline-none w-28 sm:w-32"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setBrandDraft(workspaceConfig.brandName);
                  setEditingBrand(true);
                }}
                className="group flex items-center gap-1 text-base font-bold tracking-tight text-white hover:text-highlight transition-colors truncate"
                title="Click to edit workspace brand title"
              >
                <span className="truncate">{workspaceConfig.brandName}</span>
                <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
              </button>
            )}

            {editingBadge ? (
              <input
                type="text"
                autoFocus
                value={badgeDraft}
                onChange={(e) => setBadgeDraft(e.target.value)}
                onBlur={commitBadge}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitBadge();
                  if (e.key === "Escape") {
                    setBadgeDraft(workspaceConfig.brandBadge);
                    setEditingBadge(false);
                  }
                }}
                className="rounded border border-primary bg-black/60 px-2 py-0.5 text-[10px] font-mono text-white focus:outline-none w-36"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setBadgeDraft(workspaceConfig.brandBadge);
                  setEditingBadge(true);
                }}
                className="hidden md:inline-flex items-center gap-1 rounded border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-mono text-highlight/80 hover:border-primary/50 hover:text-highlight transition-colors shrink-0"
                title="Click to edit subtitle badge"
              >
                <span>{workspaceConfig.brandBadge || "Edit badge"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Center: Workspace Mode Switcher (Chat hidden when user opts out of AI; Tasks & MY DAY always available) */}
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
                onClick={() => onSelectTab("chat")}
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
              <span>MY DAY</span>
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
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-white/90 hover:text-white hover:border-primary/50 transition-all"
              title="Switch theme"
            >
              <Palette className="w-3.5 h-3.5 text-primary" />
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
                          ? "bg-primary/20 text-highlight font-semibold border border-primary/40"
                          : "text-white/75 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center gap-2">
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
                        <span>{t.name}</span>
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
