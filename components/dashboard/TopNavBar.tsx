"use client";

import React from "react";
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
  CalendarClock,
  Check,
  ChevronDown,
  Compass,
  GraduationCap,
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
import { SakuraIcon } from "@/components/ui/SakuraIcon";
import {
  Badge,
  Button,
  DropdownMenu,
  Tabs,
} from "@/components/tailus-ui";

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

export const TopNavBar: React.FC<TopNavBarProps> = React.memo(({
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
  const activeThemeMeta =
    THEME_OPTIONS.find((t) => t.id === profile.theme) || THEME_OPTIONS[0];

  const jState = workspaceConfig.journeyState;
  const activeJ =
    jState?.journeys?.find((j) => j.id === jState.activeJourneyId) ||
    jState?.journeys?.[0];
  const jProg = computeJourneyProgress(activeJ);

  return (
    <header className="sticky top-0 z-30 border-b border-[--ui-border-color] bg-[--ui-bg]/85 backdrop-blur-xl transition-colors duration-300">
      <div className="mx-auto max-w-[1600px] px-3 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 select-none">
          {profile.theme === "sharingan" ? (
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[--btn-radius] bg-[#140305] border border-danger-500/50 shadow-[0_0_20px_rgba(255,31,56,0.5)] transition-all cursor-pointer"
              title="Uchiha Clan Sharingan Eye (Spinning 3-Tomoe)"
            >
              <SharinganIcon size={20} animate speed="normal" glow interactive />
            </div>
          ) : profile.theme === "sakura" ? (
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[--btn-radius] bg-[#240b18] border border-primary-400/50 shadow-[0_0_20px_rgba(255,126,182,0.45)] transition-all cursor-pointer"
              title="Sakura Blossom"
            >
              <SakuraIcon size={20} animate glow />
            </div>
          ) : (
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[--btn-radius] shadow-sm transition-transform"
              style={{
                backgroundColor: "#facc15",
                color: "#09090b",
              }}
            >
              <KiteLogoMark className="w-4 h-4 text-black" strokeWidth={2.4} />
            </div>
          )}
          <span className="text-lg font-bold tracking-tight text-title leading-none">
            kite
          </span>
          <a
            href="https://sunayraval.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center rounded-full border border-[--ui-border-color] bg-[--ui-soft-bg] px-2.5 py-0.5 text-[11px] font-mono font-medium text-[--body-text-color] hover:text-title hover:border-primary-500/50 transition-colors leading-none"
          >
            by sunayraval
          </a>
        </div>

        {/* Center: Tailus Tabs Workspace Mode Switcher — consistent "my <feature>" naming */}
        {canAccessWorkspace && (
          <Tabs.Root
            value={activeTab}
            onValueChange={(val) => {
              const next = val as WorkspaceTab;
              onSelectTab(next);
              if (next === "chat") {
                onResetChatToHero?.();
              }
            }}
            className="shrink-0 overflow-x-auto max-w-full"
          >
            <Tabs.List
              aria-label="Workspace View Switcher"
              variant="soft"
              triggerVariant="softToSoft"
              size="sm"
              intent="primary"
              className="bg-[--ui-soft-bg]/90 border border-[--ui-border-color] p-1 gap-0.5"
            >
              {!aiTemporarilyDisabled && (
                <Tabs.Trigger
                  value="chat"
                  onClick={() => {
                    if (activeTab === "chat") {
                      onResetChatToHero?.();
                    }
                  }}
                  className="gap-1.5 text-xs font-medium px-2.5 sm:px-3 data-[state=active]:bg-[--ui-bg] data-[state=active]:text-title data-[state=active]:shadow-sm"
                >
                  <Sparkles
                    className={`size-3.5 ${
                      activeTab === "chat"
                        ? "text-primary-400"
                        : "text-caption"
                    }`}
                  />
                  <span className="whitespace-nowrap">my chat</span>
                  {!hasGeminiApiKey && (
                    <span
                      className="size-1.5 rounded-full bg-warning-400"
                      title="AI API key required"
                    />
                  )}
                </Tabs.Trigger>
              )}

              <Tabs.Trigger
                value="tasks"
                className="gap-1.5 text-xs font-medium px-2.5 sm:px-3 data-[state=active]:bg-[--ui-bg] data-[state=active]:text-title data-[state=active]:shadow-sm"
              >
                <Table2
                  className={`size-3.5 ${
                    activeTab === "tasks" ? "text-primary-400" : "text-caption"
                  }`}
                />
                <span className="whitespace-nowrap">my tasks</span>
                {activeTaskCount > 0 && (
                  <Badge
                    variant="soft"
                    intent={activeTab === "tasks" ? "primary" : "gray"}
                    size="xs"
                    className="px-1.5 py-0 text-[10px] font-mono leading-4"
                  >
                    {activeTaskCount}
                  </Badge>
                )}
              </Tabs.Trigger>

              <Tabs.Trigger
                value="my_day"
                className="gap-1.5 text-xs font-medium px-2.5 sm:px-3 data-[state=active]:bg-[--ui-bg] data-[state=active]:text-title data-[state=active]:shadow-sm"
              >
                <CalendarClock
                  className={`size-3.5 ${
                    activeTab === "my_day" ? "text-primary-400" : "text-caption"
                  }`}
                />
                <span className="whitespace-nowrap">my day</span>
                {(workspaceConfig.myDaySchedule?.blocks.length || 0) > 0 && (
                  <Badge
                    variant="soft"
                    intent={activeTab === "my_day" ? "primary" : "gray"}
                    size="xs"
                    className="px-1.5 py-0 text-[10px] font-mono leading-4"
                  >
                    {workspaceConfig.myDaySchedule?.blocks.length}
                  </Badge>
                )}
              </Tabs.Trigger>

              <Tabs.Trigger
                value="journey"
                className="gap-1.5 text-xs font-medium px-2.5 sm:px-3 data-[state=active]:bg-[--ui-bg] data-[state=active]:text-title data-[state=active]:shadow-sm"
              >
                <Compass
                  className={`size-3.5 ${
                    activeTab === "journey"
                      ? "text-primary-400"
                      : "text-caption"
                  }`}
                />
                <span className="whitespace-nowrap">my journey</span>
                {jProg.total > 0 && (
                  <Badge
                    variant="soft"
                    intent={activeTab === "journey" ? "primary" : "gray"}
                    size="xs"
                    className="px-1.5 py-0 text-[10px] font-mono leading-4"
                  >
                    {jProg.completed}/{jProg.total}
                  </Badge>
                )}
              </Tabs.Trigger>

              <Tabs.Trigger
                value="study"
                className="gap-1.5 text-xs font-medium px-2.5 sm:px-3 data-[state=active]:bg-[--ui-bg] data-[state=active]:text-title data-[state=active]:shadow-sm"
              >
                <GraduationCap
                  className={`size-3.5 ${
                    activeTab === "study" ? "text-primary-400" : "text-caption"
                  }`}
                />
                <span className="whitespace-nowrap">my flo</span>
                {workspaceConfig.studySession?.syllabus && (
                  <Badge
                    variant="soft"
                    intent={activeTab === "study" ? "primary" : "gray"}
                    size="xs"
                    className="px-1.5 py-0 text-[10px] font-mono leading-4"
                  >
                    {
                      computeSyllabusProgress(
                        workspaceConfig.studySession.syllabus
                      ).percentage
                    }
                    %
                  </Badge>
                )}
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>
        )}

        {/* Right: Tailus Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Theme Switcher via Tailus DropdownMenu */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button.Root
                variant="outlined"
                intent={profile.theme === "sharingan" ? "danger" : "gray"}
                size="xs"
                className="gap-1.5 px-2.5 text-xs"
                title="Switch theme"
              >
                {profile.theme === "sharingan" ? (
                  <SharinganIcon size={15} animate speed="fast" glow={false} />
                ) : profile.theme === "sakura" ? (
                  <SakuraIcon size={15} animate glow={false} />
                ) : (
                  <Palette className="size-3.5 text-primary-400" />
                )}
                <span className="hidden xl:inline font-medium text-title">
                  {profile.theme === "custom"
                    ? "Custom Theme"
                    : activeThemeMeta.name}
                </span>
                <span className="flex items-center -space-x-1">
                  <span
                    className="size-2.5 rounded-full border border-gray-950/60"
                    style={{ backgroundColor: "var(--primary)" }}
                  />
                  <span
                    className="size-2.5 rounded-full border border-gray-950/60"
                    style={{ backgroundColor: "var(--surface)" }}
                  />
                </span>
                <ChevronDown className="size-3 text-caption" />
              </Button.Root>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                mixed
                className="w-64 p-1.5 backdrop-blur-2xl"
              >
                {THEME_OPTIONS.map((t) => {
                  const isSelected = profile.theme === t.id;
                  const isSharingan = t.id === "sharingan";
                  const isSakura = t.id === "sakura";
                  return (
                    <DropdownMenu.Item
                      key={t.id}
                      onSelect={() => {
                        onUpdateProfile({
                          theme: t.id as ThemeName,
                          ...(isSharingan ? { ai_tone: "killer_bee" } : {}),
                        });
                      }}
                      className={`justify-between px-2.5 py-2 text-xs cursor-pointer ${
                        isSelected
                          ? "bg-primary-500/15 text-primary-300 font-semibold"
                          : isSharingan
                          ? "text-danger-300"
                          : isSakura
                          ? "text-primary-200"
                          : ""
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
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
                          <span className="flex -space-x-1">
                            <span
                              className="size-3 rounded-full border border-gray-950/70"
                              style={{ backgroundColor: t.colors.bgBase }}
                            />
                            <span
                              className="size-3 rounded-full border border-gray-950/70"
                              style={{ backgroundColor: t.colors.surface }}
                            />
                            <span
                              className="size-3 rounded-full border border-gray-950/70"
                              style={{ backgroundColor: t.colors.primary }}
                            />
                          </span>
                        )}
                        <span className="flex items-center gap-1.5">
                          {t.name}
                          {isSharingan && (
                            <Badge variant="soft" intent="danger" size="xs">
                              Special
                            </Badge>
                          )}
                          {isSakura && (
                            <Badge variant="soft" intent="primary" size="xs">
                              Animated
                            </Badge>
                          )}
                        </span>
                      </span>
                      {isSelected && (
                        <Check className="size-3.5 text-primary-400" />
                      )}
                    </DropdownMenu.Item>
                  );
                })}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Sync Canvas */}
          {canAccessWorkspace && (
            <Button.Root
              variant="outlined"
              intent="gray"
              size="xs"
              disabled={isSyncingCanvas}
              onClick={onQuickSyncCanvas}
              className="px-2.5 text-xs"
              title="Sync Canvas Assignments"
            >
              <Button.Icon type="leading" size="xs">
                <RefreshCw
                  className={
                    isSyncingCanvas
                      ? "animate-spin text-primary-400"
                      : "text-primary-400"
                  }
                />
              </Button.Icon>
              <Button.Label className="hidden lg:inline">
                Sync Canvas
              </Button.Label>
            </Button.Root>
          )}

          {/* Settings / Customize */}
          {canAccessWorkspace && (
            <Button.Root
              variant="outlined"
              intent="gray"
              size="xs"
              onClick={onOpenSettings}
              className="px-2.5 text-xs"
              title="Customize Tags, Categories, Themes, AI & Settings"
            >
              <Button.Icon type="leading" size="xs">
                <Settings className="text-primary-400" />
              </Button.Icon>
              <Button.Label className="hidden lg:inline">
                Customize
              </Button.Label>
            </Button.Root>
          )}

          {/* Google Auth Status */}
          {isAuthenticated ? (
            <Button.Root
              variant="outlined"
              intent="gray"
              size="xs"
              onClick={onSignOut}
              className="px-2.5 text-xs"
              title="Sign Out"
            >
              <span className="size-2 rounded-full bg-success-400 shrink-0" />
              <Button.Label className="hidden sm:inline max-w-[110px] truncate">
                {profile.full_name || profile.email}
              </Button.Label>
              <Button.Icon type="trailing" size="xs">
                <LogOut className="text-caption" />
              </Button.Icon>
            </Button.Root>
          ) : (
            <Button.Root
              variant="solid"
              intent="primary"
              size="xs"
              onClick={onGoogleSignIn}
              className="px-3 text-xs font-semibold"
            >
              <Button.Icon type="leading" size="xs">
                <LogIn />
              </Button.Icon>
              <Button.Label>
                <span>Sign in</span>
                <span className="hidden sm:inline">&nbsp;with Google</span>
              </Button.Label>
            </Button.Root>
          )}
        </div>
      </div>
    </header>
  );
});

TopNavBar.displayName = "TopNavBar";

