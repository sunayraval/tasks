"use client";

import React, { useEffect, useState } from "react";
import {
  THEME_OPTIONS,
  ThemeName,
  UserProfile,
  WorkspaceConfig,
  WorkspaceTab,
  computeJourneyProgress,
  computeSyllabusProgress,
} from "@/types/taskit";
import {
  BarChart3,
  CalendarClock,
  Check,
  ChevronRight,
  Compass,
  GraduationCap,
  LogIn,
  LogOut,
  Menu,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Table2,
  X,
} from "lucide-react";
import { KiteLogoMark } from "@/components/ui/KiteBrand";
import { SharinganIcon } from "@/components/ui/SharinganIcon";
import { SakuraIcon } from "@/components/ui/SakuraIcon";

interface LeftSidebarNavProps {
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

const TAB_LABELS: Record<WorkspaceTab, string> = {
  chat: "my chat",
  tasks: "my tasks",
  my_day: "my day",
  journey: "my journey",
  stats: "my stats",
  study: "my flo",
};

export const LeftSidebarNav: React.FC<LeftSidebarNavProps> = React.memo(
  ({
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
    onOpenSettings,
    onQuickSyncCanvas,
    onGoogleSignIn,
    onSignOut,
  }) => {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [themeMenuOpen, setThemeMenuOpen] = useState(false);

    useEffect(() => {
      if (!mobileOpen) return;
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") setMobileOpen(false);
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }, [mobileOpen]);

    const activeThemeMeta =
      THEME_OPTIONS.find((t) => t.id === profile.theme) || THEME_OPTIONS[0];

    const myDayCount = workspaceConfig.myDaySchedule?.blocks.length || 0;
    const jState = workspaceConfig.journeyState;
    const activeJourney =
      jState?.journeys?.find((j) => j.id === jState.activeJourneyId) ||
      jState?.journeys?.[0];
    const journeyProg = computeJourneyProgress(activeJourney);
    const studyPct = workspaceConfig.studySession?.syllabus
      ? computeSyllabusProgress(workspaceConfig.studySession.syllabus).percentage
      : null;

    const handleNavSelect = (tab: WorkspaceTab, resetChat = false) => {
      onSelectTab(tab);
      if (resetChat) onResetChatToHero?.();
      setMobileOpen(false);
    };

    const renderBrandMark = () => {
      if (profile.theme === "sharingan") {
        return (
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-950/70 border border-red-500/40"
            title="Sharingan Eye"
          >
            <SharinganIcon size={22} animate speed="normal" glow={false} />
          </div>
        );
      }
      if (profile.theme === "sakura") {
        return (
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-pink-950/60 border border-pink-400/40"
            title="Sakura Blossom"
          >
            <SakuraIcon size={20} animate glow={false} />
          </div>
        );
      }
      return (
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-[0_0_16px_rgba(250,204,21,0.4)]"
          style={{ backgroundColor: "#facc15", color: "#09090b" }}
        >
          <KiteLogoMark className="w-4 h-4 text-black" strokeWidth={2.5} />
        </div>
      );
    };

    const renderSidebarInner = (isMobileDrawer: boolean) => {
      const isCompact = !isMobileDrawer && collapsed;

      return (
        <div className="flex h-full flex-col justify-between select-none">
          {/* Top Section: Brand + Collapse + New Chat + Nav Groups */}
          <div className="flex flex-col min-h-0 flex-1">
            {/* Brand Header */}
            <div
              className={`flex items-center ${
                isCompact ? "justify-center px-2" : "justify-between px-3.5"
              } pt-3.5 pb-2.5`}
            >
              {!isCompact && (
                <div className="flex items-center gap-2.5 min-w-0">
                  {renderBrandMark()}
                  <div className="flex flex-col min-w-0">
                    <span className="text-lg font-extrabold tracking-tight text-white leading-none">
                      kite
                    </span>
                    <a
                      href="https://sunayraval.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 text-[10px] font-mono text-white/55 hover:text-white transition-colors truncate"
                    >
                      by sunayraval
                    </a>
                  </div>
                </div>
              )}

              {isMobileDrawer ? (
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                  aria-label="Close navigation"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setCollapsed((c) => !c);
                    setThemeMenuOpen(false);
                  }}
                  className="rounded-lg p-1.5 text-white/55 hover:bg-white/10 hover:text-white transition-colors"
                  title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  {collapsed ? (
                    <PanelLeftOpen className="w-4 h-4" />
                  ) : (
                    <PanelLeftClose className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>

            {/* Claude-style Primary "New chat" Action */}
            {canAccessWorkspace && !aiTemporarilyDisabled && (
              <div className={isCompact ? "px-2 pt-1 pb-2" : "px-3 pt-1 pb-3"}>
                <button
                  type="button"
                  onClick={() => handleNavSelect("chat", true)}
                  title="New chat"
                  className={`w-full flex items-center ${
                    isCompact ? "justify-center px-0 py-2" : "gap-2.5 px-3 py-2"
                  } rounded-xl border border-primary/35 bg-primary/15 hover:bg-primary/25 text-highlight text-xs font-semibold transition-colors`}
                >
                  <Plus className="w-4 h-4 text-primary shrink-0" />
                  {!isCompact && <span>New chat</span>}
                </button>
              </div>
            )}

            {/* Organized Navigation Groups */}
            {canAccessWorkspace && (
              <nav
                aria-label="Workspace Navigation"
                className="flex-1 overflow-y-auto px-2.5 py-1 space-y-5"
              >
                {/* Group 1: Workspace */}
                <div className="space-y-1">
                  {!isCompact && (
                    <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">
                      Workspace
                    </div>
                  )}

                  {!aiTemporarilyDisabled && (
                    <button
                      type="button"
                      onClick={() => handleNavSelect("chat", true)}
                      title={isCompact ? "my chat" : undefined}
                      className={`w-full flex items-center ${
                        isCompact
                          ? "justify-center px-0 py-2.5"
                          : "justify-between px-2.5 py-2"
                      } rounded-xl text-[13px] font-medium transition-colors ${
                        activeTab === "chat"
                          ? "bg-white/[0.13] text-white font-semibold border border-white/[0.14]"
                          : "text-white/70 hover:text-white hover:bg-white/[0.06] border border-transparent"
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <Sparkles
                          className={`w-4 h-4 shrink-0 ${
                            activeTab === "chat"
                              ? "text-primary"
                              : "text-white/50"
                          }`}
                        />
                        {!isCompact && <span className="truncate">my chat</span>}
                      </span>
                      {!isCompact && !hasGeminiApiKey && (
                        <span
                          className="h-2 w-2 rounded-full bg-amber-400 shrink-0"
                          title="AI API key required"
                        />
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleNavSelect("tasks")}
                    title={isCompact ? "my tasks" : undefined}
                    className={`w-full flex items-center ${
                      isCompact
                        ? "justify-center px-0 py-2.5"
                        : "justify-between px-2.5 py-2"
                    } rounded-xl text-[13px] font-medium transition-colors ${
                      activeTab === "tasks"
                        ? "bg-white/[0.13] text-white font-semibold border border-white/[0.14]"
                        : "text-white/70 hover:text-white hover:bg-white/[0.06] border border-transparent"
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Table2
                        className={`w-4 h-4 shrink-0 ${
                          activeTab === "tasks"
                            ? "text-primary"
                            : "text-white/50"
                        }`}
                      />
                      {!isCompact && <span className="truncate">my tasks</span>}
                    </span>
                    {!isCompact && activeTaskCount > 0 && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-mono leading-none ${
                          activeTab === "tasks"
                            ? "bg-primary/25 text-highlight"
                            : "bg-white/10 text-white/60"
                        }`}
                      >
                        {activeTaskCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNavSelect("my_day")}
                    title={isCompact ? "my day" : undefined}
                    className={`w-full flex items-center ${
                      isCompact
                        ? "justify-center px-0 py-2.5"
                        : "justify-between px-2.5 py-2"
                    } rounded-xl text-[13px] font-medium transition-colors ${
                      activeTab === "my_day"
                        ? "bg-white/[0.13] text-white font-semibold border border-white/[0.14]"
                        : "text-white/70 hover:text-white hover:bg-white/[0.06] border border-transparent"
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <CalendarClock
                        className={`w-4 h-4 shrink-0 ${
                          activeTab === "my_day"
                            ? "text-primary"
                            : "text-white/50"
                        }`}
                      />
                      {!isCompact && <span className="truncate">my day</span>}
                    </span>
                    {!isCompact && myDayCount > 0 && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-mono leading-none ${
                          activeTab === "my_day"
                            ? "bg-primary/25 text-highlight"
                            : "bg-white/10 text-white/60"
                        }`}
                      >
                        {myDayCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Group 2: Growth & Learning */}
                <div className="space-y-1">
                  {!isCompact && (
                    <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">
                      Growth &amp; Learning
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleNavSelect("journey")}
                    title={isCompact ? "my journey" : undefined}
                    className={`w-full flex items-center ${
                      isCompact
                        ? "justify-center px-0 py-2.5"
                        : "justify-between px-2.5 py-2"
                    } rounded-xl text-[13px] font-medium transition-colors ${
                      activeTab === "journey"
                        ? "bg-white/[0.13] text-white font-semibold border border-white/[0.14]"
                        : "text-white/70 hover:text-white hover:bg-white/[0.06] border border-transparent"
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Compass
                        className={`w-4 h-4 shrink-0 ${
                          activeTab === "journey"
                            ? "text-primary"
                            : "text-white/50"
                        }`}
                      />
                      {!isCompact && (
                        <span className="truncate">my journey</span>
                      )}
                    </span>
                    {!isCompact && journeyProg.total > 0 && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-mono leading-none ${
                          activeTab === "journey"
                            ? "bg-primary/25 text-highlight"
                            : "bg-white/10 text-white/60"
                        }`}
                      >
                        {journeyProg.completed}/{journeyProg.total}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNavSelect("stats")}
                    title={isCompact ? "my stats" : undefined}
                    className={`w-full flex items-center ${
                      isCompact
                        ? "justify-center px-0 py-2.5"
                        : "justify-between px-2.5 py-2"
                    } rounded-xl text-[13px] font-medium transition-colors ${
                      activeTab === "stats"
                        ? "bg-white/[0.13] text-white font-semibold border border-white/[0.14]"
                        : "text-white/70 hover:text-white hover:bg-white/[0.06] border border-transparent"
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <BarChart3
                        className={`w-4 h-4 shrink-0 ${
                          activeTab === "stats"
                            ? "text-primary"
                            : "text-white/50"
                        }`}
                      />
                      {!isCompact && <span className="truncate">my stats</span>}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNavSelect("study")}
                    title={isCompact ? "my flo" : undefined}
                    className={`w-full flex items-center ${
                      isCompact
                        ? "justify-center px-0 py-2.5"
                        : "justify-between px-2.5 py-2"
                    } rounded-xl text-[13px] font-medium transition-colors ${
                      activeTab === "study"
                        ? "bg-white/[0.13] text-white font-semibold border border-white/[0.14]"
                        : "text-white/70 hover:text-white hover:bg-white/[0.06] border border-transparent"
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <GraduationCap
                        className={`w-4 h-4 shrink-0 ${
                          activeTab === "study"
                            ? "text-primary"
                            : "text-white/50"
                        }`}
                      />
                      {!isCompact && <span className="truncate">my flo</span>}
                    </span>
                    {!isCompact && studyPct !== null && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-mono leading-none ${
                          activeTab === "study"
                            ? "bg-primary/25 text-highlight"
                            : "bg-white/10 text-white/60"
                        }`}
                      >
                        {studyPct}%
                      </span>
                    )}
                  </button>
                </div>
              </nav>
            )}
          </div>

          {/* Bottom Utility Dock (Claude-style footer controls & profile) */}
          <div className="border-t border-white/10 px-2.5 py-2.5 space-y-1">
            {/* Theme Picker */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setThemeMenuOpen((v) => !v)}
                title="Switch theme"
                className={`w-full flex items-center ${
                  isCompact ? "justify-center px-0 py-2" : "justify-between px-2.5 py-2"
                } rounded-xl text-xs text-white/75 hover:text-white hover:bg-white/[0.06] transition-colors`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  {profile.theme === "sharingan" ? (
                    <SharinganIcon size={16} animate speed="fast" glow={false} />
                  ) : profile.theme === "sakura" ? (
                    <SakuraIcon size={16} animate glow={false} />
                  ) : (
                    <Palette className="w-4 h-4 text-primary shrink-0" />
                  )}
                  {!isCompact && (
                    <span className="truncate">
                      {profile.theme === "custom"
                        ? "Custom Theme"
                        : activeThemeMeta.name}
                    </span>
                  )}
                </span>
                {!isCompact && (
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="h-2.5 w-2.5 rounded-full border border-black/50"
                      style={{ backgroundColor: "var(--primary)" }}
                    />
                    <ChevronRight className="w-3.5 h-3.5 text-white/40" />
                  </span>
                )}
              </button>

              {themeMenuOpen && (
                <div
                  className={`absolute ${
                    isMobileDrawer
                      ? "bottom-full left-0 mb-2 w-60"
                      : "bottom-0 left-full ml-2 w-64"
                  } rounded-2xl border theme-popover p-1.5 shadow-2xl z-50 max-h-[75vh] overflow-y-auto`}
                  onMouseLeave={() => setThemeMenuOpen(false)}
                >
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/45">
                    Workspace Theme
                  </div>
                  {THEME_OPTIONS.map((t) => {
                    const isSelected = profile.theme === t.id;
                    const isSharingan = t.id === "sharingan";
                    const isSakura = t.id === "sakura";
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          onUpdateProfile({
                            theme: t.id as ThemeName,
                            ...(isSharingan ? { ai_tone: "killer_bee" } : {}),
                          });
                          setThemeMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                          isSelected
                            ? "bg-primary/20 text-highlight font-semibold border border-primary/40"
                            : "text-white/75 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {isSharingan ? (
                            <SharinganIcon
                              size={16}
                              animate
                              speed="normal"
                              glow={false}
                            />
                          ) : isSakura ? (
                            <SakuraIcon size={16} animate glow={false} />
                          ) : (
                            <div className="flex -space-x-1">
                              <span
                                className="h-3 w-3 rounded-full border border-black/60"
                                style={{ backgroundColor: t.colors.bgBase }}
                              />
                              <span
                                className="h-3 w-3 rounded-full border border-black/60"
                                style={{ backgroundColor: t.colors.primary }}
                              />
                            </div>
                          )}
                          <span>{t.name}</span>
                        </div>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-primary" />
                        )}
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
                onClick={() => {
                  onQuickSyncCanvas();
                  setMobileOpen(false);
                }}
                title="Sync Canvas Assignments"
                className={`w-full flex items-center ${
                  isCompact ? "justify-center px-0 py-2" : "gap-2.5 px-2.5 py-2"
                } rounded-xl text-xs text-white/75 hover:text-white hover:bg-white/[0.06] transition-colors`}
              >
                <RefreshCw
                  className={`w-4 h-4 shrink-0 ${
                    isSyncingCanvas
                      ? "animate-spin text-primary"
                      : "text-primary/80"
                  }`}
                />
                {!isCompact && <span>Sync Canvas</span>}
              </button>
            )}

            {/* Settings / Customize */}
            {canAccessWorkspace && (
              <button
                type="button"
                onClick={() => {
                  onOpenSettings();
                  setMobileOpen(false);
                }}
                title="Settings & Customize Layout"
                className={`w-full flex items-center ${
                  isCompact ? "justify-center px-0 py-2" : "gap-2.5 px-2.5 py-2"
                } rounded-xl text-xs text-white/75 hover:text-white hover:bg-white/[0.06] transition-colors`}
              >
                <Settings className="w-4 h-4 text-primary shrink-0" />
                {!isCompact && <span>Settings</span>}
              </button>
            )}

            {/* Account Row */}
            <div className="pt-1 mt-1 border-t border-white/[0.08]">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={onSignOut}
                  title="Sign Out"
                  className={`w-full flex items-center ${
                    isCompact
                      ? "justify-center px-0 py-2"
                      : "justify-between px-2.5 py-2"
                  } rounded-xl text-xs text-white/80 hover:text-white hover:bg-white/[0.06] transition-colors`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 border border-primary/35 text-[10px] font-bold text-highlight uppercase">
                      {(profile.full_name || profile.email || "U").charAt(0)}
                    </span>
                    {!isCompact && (
                      <span className="truncate max-w-[130px] font-medium">
                        {profile.full_name || profile.email}
                      </span>
                    )}
                  </span>
                  {!isCompact && (
                    <LogOut className="w-3.5 h-3.5 text-white/45 shrink-0" />
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onGoogleSignIn}
                  title="Sign in with Google"
                  className={`w-full flex items-center ${
                    isCompact ? "justify-center px-0 py-2" : "gap-2 px-2.5 py-2"
                  } rounded-xl bg-primary/20 border border-primary/40 text-xs font-semibold text-highlight hover:bg-primary/30 transition-colors`}
                >
                  <LogIn className="w-3.5 h-3.5 shrink-0" />
                  {!isCompact && <span>Sign in with Google</span>}
                </button>
              )}
            </div>
          </div>
        </div>
      );
    };

    return (
      <>
        {/* Desktop Persistent Left Rail */}
        <aside
          className={`hidden lg:flex flex-col sticky top-0 h-screen shrink-0 border-r theme-header-bg z-30 transition-[width] duration-200 ease-out ${
            collapsed ? "w-[64px]" : "w-[244px]"
          }`}
        >
          {renderSidebarInner(false)}
        </aside>

        {/* Mobile Compact Top Header Bar */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-3 py-2.5 border-b theme-header-bg">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            {renderBrandMark()}
            <span className="text-base font-extrabold tracking-tight text-white">
              kite
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/85">
              {TAB_LABELS[activeTab]}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {canAccessWorkspace && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="rounded-lg border border-white/15 bg-white/5 p-1.5 text-white/80 hover:text-white"
                aria-label="Open settings"
              >
                <Settings className="w-4 h-4 text-primary" />
              </button>
            )}
          </div>
        </header>

        {/* Mobile Slide-Over Drawer */}
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div
              className="fixed inset-0 bg-black/65"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <aside className="relative z-10 w-[264px] max-w-[82vw] h-full border-r theme-header-bg shadow-2xl animate-in slide-in-from-left duration-200">
              {renderSidebarInner(true)}
            </aside>
          </div>
        )}
      </>
    );
  }
);

LeftSidebarNav.displayName = "LeftSidebarNav";
