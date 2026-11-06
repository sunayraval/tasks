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
  Sparkles,
  User,
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

  const activeThemeMeta =
    THEME_OPTIONS.find((t) => t.id === profile.theme) || THEME_OPTIONS[0];

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-black font-extrabold text-sm shadow-sm">
            T
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold tracking-tight text-white">
              TaskIt
            </span>
            <span className="hidden sm:inline-block rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] font-mono text-zinc-400">
              tasks.sunayraval.com
            </span>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          {/* Theme Switcher */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setThemeDropdownOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-xs text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors"
              title="Switch theme"
            >
              <Palette className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline">{activeThemeMeta.name}</span>
              <ChevronDown className="w-3 h-3 text-zinc-500" />
            </button>

            {themeDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-xl border border-zinc-800 bg-zinc-900 p-1.5 shadow-xl backdrop-blur-xl z-50"
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
                      className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                        isSelected
                          ? "bg-zinc-800 text-white font-semibold"
                          : "text-zinc-400 hover:text-white hover:bg-zinc-800/60"
                      }`}
                    >
                      <span>{t.name}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-xs text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors"
              title="Sync Canvas Assignments"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncingCanvas ? "animate-spin text-white" : "text-zinc-400"}`}
              />
              <span className="hidden md:inline">Sync Canvas</span>
            </button>
          )}

          {/* Copilot Sidebar Toggle */}
          {isAuthenticated && (
            <button
              type="button"
              onClick={onToggleCopilot}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                isCopilotOpen
                  ? "border-white bg-white text-black font-semibold"
                  : "border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:text-white"
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
              className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-1.5 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {/* Google Auth Status */}
          {isAuthenticated ? (
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 py-1.5 text-xs text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors"
              title="Sign Out"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="hidden sm:inline max-w-[120px] truncate">
                {profile.full_name || profile.email}
              </span>
              <LogOut className="w-3.5 h-3.5 text-zinc-500" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onGoogleSignIn}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-zinc-200 transition-colors shadow-sm"
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
