"use client";

import React, { useState } from "react";
import {
  THEME_OPTIONS,
  ThemeName,
  UserProfile,
  WorkspaceConfig,
} from "@/types/taskit";
import {
  Bot,
  Check,
  ChevronDown,
  LogIn,
  LogOut,
  Palette,
  Pencil,
  RefreshCw,
  Settings,
} from "lucide-react";

interface TopNavBarProps {
  profile: UserProfile;
  workspaceConfig: WorkspaceConfig;
  isAuthenticated: boolean;
  isCopilotOpen: boolean;
  isSyncingCanvas: boolean;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onUpdateWorkspaceConfig: (updates: Partial<WorkspaceConfig>) => void;
  onOpenSettings: () => void;
  onToggleCopilot: () => void;
  onQuickSyncCanvas: () => void;
  onGoogleSignIn: () => void;
  onSignOut: () => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  profile,
  workspaceConfig,
  isAuthenticated,
  isCopilotOpen,
  isSyncingCanvas,
  onUpdateProfile,
  onUpdateWorkspaceConfig,
  onOpenSettings,
  onToggleCopilot,
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
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        {/* Left: Editable Brand Identity */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg font-extrabold text-sm shadow-neon transition-colors"
            style={{
              backgroundColor: "var(--primary)",
              color: "#09090b",
            }}
          >
            {(workspaceConfig.brandName || "T").charAt(0).toUpperCase()}
          </div>
          <div className="flex items-center gap-2">
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
                className="rounded border border-primary bg-black/60 px-2 py-0.5 text-sm font-bold text-white focus:outline-none w-32"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setBrandDraft(workspaceConfig.brandName);
                  setEditingBrand(true);
                }}
                className="group flex items-center gap-1 text-base font-bold tracking-tight text-white hover:text-highlight transition-colors"
                title="Click to edit workspace brand title"
              >
                <span>{workspaceConfig.brandName}</span>
                <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
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
                className="hidden sm:inline-flex items-center gap-1 rounded border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-mono text-highlight/80 hover:border-primary/50 hover:text-highlight transition-colors"
                title="Click to edit subtitle badge"
              >
                <span>{workspaceConfig.brandBadge || "Edit badge"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          {/* Theme Switcher */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setThemeDropdownOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-white/90 hover:text-white hover:border-primary/50 transition-all"
              title="Switch theme"
            >
              <Palette className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline font-medium">
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
          {isAuthenticated && (
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
              <span className="hidden md:inline">Sync Canvas</span>
            </button>
          )}

          {/* Copilot Sidebar Toggle */}
          {isAuthenticated && (
            <button
              type="button"
              onClick={onToggleCopilot}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                isCopilotOpen
                  ? "border-primary bg-primary text-black font-bold shadow-neon"
                  : "border-white/15 bg-white/5 text-white/85 hover:text-white hover:border-primary/50"
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Copilot</span>
            </button>
          )}

          {/* Settings */}
          {isAuthenticated && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-white/85 hover:text-white hover:border-primary/50 transition-colors"
              title="Customize Tags, Categories, Themes & Settings"
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
              <span className="hidden sm:inline max-w-[120px] truncate">
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
