"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  THEME_OPTIONS,
  ThemeName,
  UserProfile,
  VideoPresetName,
} from "@/types/taskit";
import {
  HeroSoaringKite,
  KiteFlyingLoader,
  KiteLogoMark,
} from "@/components/ui/KiteBrand";
import {
  Badge,
  Button,
  Caption,
  Card,
  Display,
  Progress,
  Tabs,
  Text,
  Title,
} from "@/components/tailus-ui";
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  CalendarClock,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Columns,
  FileText,
  GraduationCap,
  Layers,
  Lock,
  LogIn,
  Mic,
  Palette,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Table2,
  Wand2,
  Zap,
} from "lucide-react";

interface KiteMarketingPageProps {
  profile: UserProfile;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onGoogleSignIn: () => void;
}

/**
 * Lightweight IntersectionObserver scroll-reveal wrapper using compositor-only
 * opacity + translate3d transitions and honoring prefers-reduced-motion.
 */
const RevealSection: React.FC<{
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}> = ({ children, className = "", delayMs = 0 }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      setVisible(true);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={`transition-all duration-700 ease-out will-change-[transform,opacity] ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      } ${className}`}
    >
      {children}
    </div>
  );
};

interface DemoScheduleBlock {
  id: string;
  title: string;
  time: string;
  duration: string;
  tag: string;
  priority: "Urgent" | "High" | "Medium" | "Break";
  done: boolean;
  active?: boolean;
}

const INITIAL_DEMO_SCHEDULE: DemoScheduleBlock[] = [
  {
    id: "d1",
    title: "Common App Personal Essay Final Polish",
    time: "4:00 PM – 4:45 PM",
    duration: "45m",
    tag: "College",
    priority: "Urgent",
    done: true,
  },
  {
    id: "d2",
    title: "AP Calculus BC — Taylor Series Problem Set",
    time: "4:45 PM – 5:45 PM",
    duration: "1h",
    tag: "School",
    priority: "High",
    done: false,
    active: true,
  },
  {
    id: "d3",
    title: "Recharge Walk & Espresso Break",
    time: "5:45 PM – 6:00 PM",
    duration: "15m",
    tag: "Break",
    priority: "Break",
    done: false,
  },
  {
    id: "d4",
    title: "CS Club Hackathon Pitch Deck Slides",
    time: "6:00 PM – 6:45 PM",
    duration: "45m",
    tag: "Club",
    priority: "Medium",
    done: false,
  },
  {
    id: "d5",
    title: "AP Physics C Rotational Dynamics Lab",
    time: "6:45 PM – 7:30 PM",
    duration: "45m",
    tag: "Canvas",
    priority: "High",
    done: false,
  },
];

const DEMO_CHAT_SCENARIOS = [
  {
    id: "arrange",
    chip: "Auto-arrange 4pm – 8pm",
    prompt:
      "Auto-arrange all my active tasks from 4:00 PM to 8:00 PM based on their time recs and show my live status bar.",
    actions: [
      {
        title: "AI Auto-Arranged 5 blocks into MY DAY (4:00 PM – 7:30 PM)",
        sub: "Prioritized Common App Essay & AP Calc BC + inserted 15m recharge break",
      },
      {
        title: "Rendered Live MY DAY Status & Logistics Card",
        sub: "30m free buffer preserved before 8:00 PM target",
      },
    ],
    reply:
      "Your evening flight plan is locked in! I placed your **Urgent** and **High** priority deep-work blocks first while your energy is sharpest, added a 15-minute recharge break at 5:45 PM, and kept a 30-minute buffer before 8:00 PM.",
    showStatusCard: true,
  },
  {
    id: "canvas",
    chip: "Sync Canvas & sort board",
    prompt:
      "Sync my Canvas LMS assignments and organize everything cleanly under TODAY and TOMORROW by priority.",
    actions: [
      {
        title: "Synced 4 upcoming assignments from Canvas iCal feed",
        sub: "AP Calc BC, AP Physics C, AP Lit Seminar",
      },
      {
        title: "Sorted 7 tasks by Priority under TODAY & TOMORROW headers",
        sub: "Urgent → High → Medium",
      },
    ],
    reply:
      "Pulled **4 upcoming assignments** from Canvas, tagged their course codes automatically, and sorted every section from highest to lowest priority.",
    showStatusCard: false,
  },
  {
    id: "theme",
    chip: "Switch vibe to Sakura Night",
    prompt:
      "Switch my workspace theme to Sakura Night with Lofi Bokeh ambiance.",
    themeToApply: "sakura_night" as ThemeName,
    videoToApply: "lofi" as VideoPresetName,
    actions: [
      {
        title: 'Switched workspace theme to "Sakura Night"',
        sub: "Rose-quartz neon accents + Lofi Bokeh backdrop applied live",
      },
    ],
    reply:
      "Switched your atmosphere to **Sakura Night** with soft **Lofi Bokeh** lighting—notice how the entire page just transformed live!",
    showStatusCard: false,
  },
];

export const KiteMarketingPage: React.FC<KiteMarketingPageProps> = ({
  profile,
  onUpdateProfile,
  onGoogleSignIn,
}) => {
  // Interactive Product Showcase state
  const [demoTab, setDemoTab] = useState<"chat" | "my_day" | "tasks">("chat");
  const [activeScenarioIdx, setActiveScenarioIdx] = useState<number | null>(
    null
  );
  const [demoSimulatingFlight, setDemoSimulatingFlight] = useState(false);
  const [demoUndone, setDemoUndone] = useState(false);

  // Interactive MY DAY & Tasks state
  const [demoBlocks, setDemoBlocks] = useState<DemoScheduleBlock[]>(
    INITIAL_DEMO_SCHEDULE
  );
  const [liveClock, setLiveClock] = useState<Date | null>(null);

  useEffect(() => {
    setLiveClock(new Date());
    const t = setInterval(() => setLiveClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const triggerDemoScenario = (idx: number) => {
    setDemoUndone(false);
    setActiveScenarioIdx(idx);
    setDemoSimulatingFlight(true);
    const chosen = DEMO_CHAT_SCENARIOS[idx];
    setTimeout(() => {
      setDemoSimulatingFlight(false);
      if (chosen.themeToApply) {
        onUpdateProfile({
          theme: chosen.themeToApply,
          ...(chosen.videoToApply
            ? { video_bg_preset: chosen.videoToApply }
            : {}),
        });
      }
    }, 1050);
  };

  const handleSwapDemoBlocks = () => {
    setDemoBlocks((prev) => {
      if (prev.length < 4) return prev;
      const copy = [...prev];
      const b1 = copy[1];
      const b3 = copy[3];
      copy[1] = { ...b3, time: b1.time, active: true };
      copy[3] = { ...b1, time: b3.time, active: false };
      return copy;
    });
  };

  const handleToggleDemoTask = (id: string) => {
    setDemoBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, done: !b.done } : b))
    );
  };

  const completedDemoCount = demoBlocks.filter(
    (b) => b.priority !== "Break" && b.done
  ).length;
  const totalDemoTaskCount = demoBlocks.filter(
    (b) => b.priority !== "Break"
  ).length;
  const demoDayPct = Math.round(
    (completedDemoCount / Math.max(1, totalDemoTaskCount)) * 60 + 35
  );

  const formattedClock = liveClock
    ? liveClock.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })
    : "4:58 PM";
  const formattedSeconds = liveClock
    ? String(liveClock.getSeconds()).padStart(2, "0")
    : "24";

  const activeScenario =
    activeScenarioIdx !== null ? DEMO_CHAT_SCENARIOS[activeScenarioIdx] : null;

  return (
    <div className="relative min-h-screen w-full text-title selection:bg-primary-500 selection:text-white overflow-x-clip">
      {/* =====================================================================
          1. STICKY GLASS MARKETING NAVBAR
         ===================================================================== */}
      <header className="sticky top-0 z-40 border-b border-[--ui-border-color] bg-[--ui-bg]/80 backdrop-blur-2xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <a
            href="#top"
            className="flex items-center gap-2.5 group focus:outline-none"
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-[--btn-radius] shadow-[0_0_24px_rgba(250,204,21,0.55)] transition-transform duration-300 group-hover:scale-105"
              style={{
                backgroundColor: "#facc15",
                color: "#09090b",
              }}
            >
              <KiteLogoMark className="w-5 h-5 text-black" strokeWidth={2.4} />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-title leading-none">
              kite
            </span>
            <Badge
              variant="outlined"
              intent="warning"
              size="xs"
              className="font-mono font-medium rounded-full px-2.5"
            >
              2.0
            </Badge>
          </a>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-caption">
            <a
              href="#interactive-demo"
              className="hover:text-title transition-colors"
            >
              Interactive Demo
            </a>
            <a
              href="#superpowers"
              className="hover:text-title transition-colors"
            >
              Features
            </a>
            <a
              href="#my-day-showcase"
              className="hover:text-title transition-colors"
            >
              my day Engine
            </a>
            <a
              href="#atmospheres"
              className="hover:text-title transition-colors"
            >
              Live Themes
            </a>
          </nav>

          {/* Right: Live Theme Dots + Sign-In CTA */}
          <div className="flex items-center gap-2.5">
            <div
              className="hidden lg:flex items-center gap-1.5 rounded-full border border-[--ui-border-color] bg-[--ui-soft-bg] px-2.5 py-1.5"
              title="Click any swatch to preview kite themes live"
            >
              {THEME_OPTIONS.map((t) => {
                const active = profile.theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-label={`Preview ${t.name} theme`}
                    onClick={() => onUpdateProfile({ theme: t.id })}
                    className={`h-3.5 w-3.5 rounded-full transition-transform ${
                      active
                        ? "scale-125 ring-2 ring-white ring-offset-1 ring-offset-black"
                        : "opacity-65 hover:opacity-100 hover:scale-110"
                    }`}
                    style={{ backgroundColor: t.colors.primary }}
                  />
                );
              })}
            </div>

            <Button.Root
              type="button"
              variant="soft"
              intent="gray"
              size="sm"
              onClick={onGoogleSignIn}
              className="hidden sm:inline-flex rounded-full px-4"
            >
              <Button.Label>Sign in</Button.Label>
            </Button.Root>

            <Button.Root
              type="button"
              variant="solid"
              intent="primary"
              size="sm"
              onClick={onGoogleSignIn}
              className="rounded-full px-4 sm:px-5 shadow-neon font-extrabold"
            >
              <Button.Label>Launch kite Free</Button.Label>
              <Button.Icon type="trailing">
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </Button.Icon>
            </Button.Root>
          </div>
        </div>
      </header>

      {/* =====================================================================
          2. IMMERSIVE HERO SECTION
         ===================================================================== */}
      <section
        id="top"
        className="relative pt-14 sm:pt-20 pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden"
      >
        {/* Ambient Radial Sky Spotlights */}
        <div
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-[420px] w-[820px] rounded-full blur-[150px] opacity-25"
          style={{ backgroundColor: "var(--primary)" }}
        />
        <div
          className="pointer-events-none absolute top-32 right-[8%] hidden lg:block opacity-90"
          aria-hidden="true"
        >
          <HeroSoaringKite className="w-72 h-60 xl:w-80 xl:h-64" />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl text-center space-y-7">
          {/* Announcement Eyebrow Pill */}
          <Badge
            variant="soft"
            intent="primary"
            size="md"
            className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary-500/35 px-4 py-1.5 text-xs font-semibold shadow-neon backdrop-blur-xl"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary-400" />
            <span>
              Powered by Gemini 3.8 Flash • Conversational AI + Live Day
              Architect
            </span>
          </Badge>

          {/* Main Display Headline */}
          <Display
            as="h1"
            size="4xl"
            weight="bold"
            align="center"
            className="sm:text-6xl lg:text-[72px] font-extrabold tracking-[-0.035em] leading-[1.04]"
          >
            Stop wrestling your to-do list.
            <span
              className="block mt-1.5 bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(95deg, #ffffff 0%, var(--highlight) 48%, var(--primary) 100%)",
              }}
            >
              Let your day take flight.
            </span>
          </Display>

          {/* High-Clarity Value Prop */}
          <Text
            size="lg"
            align="center"
            className="mx-auto max-w-2xl text-sm sm:text-lg text-body leading-relaxed"
          >
            <strong className="text-title font-semibold">kite</strong> unites an
            autonomous AI workspace agent, a live down-to-the-second{" "}
            <strong className="text-primary-300 font-semibold">my day</strong>{" "}
            time-blocker, a resizable Notion-style task database, and 1-click
            Canvas LMS sync—wrapped in cinema-grade ambient themes.
          </Text>

          {/* Primary Conversion CTA Row */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Button.Root
              type="button"
              variant="solid"
              intent="primary"
              size="xl"
              onClick={onGoogleSignIn}
              className="group relative overflow-hidden w-full sm:w-auto px-8 py-4 h-auto text-sm sm:text-base font-extrabold shadow-neon hover:scale-[1.02] active:scale-[0.99]"
            >
              {/* Subtle Compositor Shine Sweep */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 w-16 bg-white/35 blur-sm kite-cta-shine"
              />
              <Button.Icon type="leading">
                <LogIn className="w-4 h-4 stroke-[2.5]" />
              </Button.Icon>
              <Button.Label>
                Continue with Google — It&apos;s Free
              </Button.Label>
              <Button.Icon type="trailing">
                <ArrowRight className="w-4 h-4 stroke-[2.5] transition-transform group-hover:translate-x-1" />
              </Button.Icon>
            </Button.Root>

            <a
              href="#interactive-demo"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-[--btn-radius] border border-[--ui-border-color] bg-[--ui-soft-bg] hover:bg-[--ui-bg] px-7 py-4 text-sm sm:text-base font-semibold text-title backdrop-blur-xl transition-all"
            >
              <Wand2 className="w-4 h-4 text-primary-400" />
              <span>Try Interactive Live Demo</span>
            </a>
          </div>

          {/* Micro-Trust Conversion Signals */}
          <div className="pt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-caption">
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-primary-400" />
              <span>100% free — no credit card</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-primary-400" />
              <span>Bring your free Gemini Studio key (or run AI-free)</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-primary-400" />
              <span>Automatic Canvas LMS iCal sync</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-primary-400" />
              <span>Row-Level Security cloud sync</span>
            </span>
          </div>
        </div>

        {/* ===================================================================
            3. LIVE INTERACTIVE 3-MODE WORKSPACE SANDBOX
           =================================================================== */}
        <RevealSection delayMs={100} className="mt-14 sm:mt-16 mx-auto max-w-6xl">
          <Card
            id="interactive-demo"
            variant="mixed"
            fancy
            className="scroll-mt-24 p-0 shadow-[0_30px_100px_rgba(0,0,0,0.8)] backdrop-blur-2xl overflow-hidden"
          >
            {/* Top Glowing Accent Hairline */}
            <div
              className="h-1 w-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent, var(--primary), var(--highlight), transparent)",
              }}
            />

            {/* Mock App Top Bar with Real Interactive Tab Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[--ui-border-color] bg-[--ui-soft-bg] px-4 sm:px-6 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-danger-500/75" />
                  <span className="h-3 w-3 rounded-full bg-warning-400/75" />
                  <span className="h-3 w-3 rounded-full bg-success-400/75" />
                </div>
                <div className="h-4 w-px bg-[--ui-border-color] mx-1" />
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-md text-black font-bold"
                    style={{ backgroundColor: "var(--primary)" }}
                  >
                    <KiteLogoMark className="w-3.5 h-3.5" strokeWidth={2.3} />
                  </div>
                  <span className="text-xs font-bold text-title">kite</span>
                  <Badge
                    variant="outlined"
                    intent="primary"
                    size="xs"
                    className="hidden sm:inline-flex font-mono"
                  >
                    Interactive Preview
                  </Badge>
                </div>
              </div>

              {/* Interactive Demo Mode Switcher */}
              <Tabs.Root
                value={demoTab}
                onValueChange={(v) =>
                  setDemoTab(v as "chat" | "my_day" | "tasks")
                }
              >
                <Tabs.List
                  variant="soft"
                  triggerVariant="softToSolid"
                  intent="primary"
                  size="sm"
                  className="rounded-full"
                >
                  <Tabs.Trigger
                    value="chat"
                    className="inline-flex items-center gap-1.5 rounded-full text-xs font-semibold"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Chat Agent</span>
                  </Tabs.Trigger>
                  <Tabs.Trigger
                    value="my_day"
                    className="inline-flex items-center gap-1.5 rounded-full text-xs font-semibold"
                  >
                    <CalendarClock className="w-3.5 h-3.5" />
                    <span>my day Live</span>
                  </Tabs.Trigger>
                  <Tabs.Trigger
                    value="tasks"
                    className="inline-flex items-center gap-1.5 rounded-full text-xs font-semibold"
                  >
                    <Table2 className="w-3.5 h-3.5" />
                    <span>Tasks Table</span>
                  </Tabs.Trigger>
                </Tabs.List>
              </Tabs.Root>

              <Button.Root
                type="button"
                variant="soft"
                intent="primary"
                size="xs"
                onClick={onGoogleSignIn}
                className="hidden sm:inline-flex"
              >
                <Button.Label>Use with your tasks</Button.Label>
                <Button.Icon type="trailing">
                  <ArrowRight className="w-3 h-3" />
                </Button.Icon>
              </Button.Root>
            </div>

            {/* SANDBOX BODY */}
            <div className="p-5 sm:p-8 min-h-[440px] flex flex-col justify-center">
              {demoTab === "chat" ? (
                /* --- DEMO TAB 1: "What's on your mind?" + Live Kite Flight Simulation --- */
                activeScenario === null ? (
                  <div className="mx-auto w-full max-w-2xl py-6 text-center space-y-6">
                    <Badge
                      variant="outlined"
                      intent="gray"
                      size="sm"
                      className="inline-flex items-center gap-2 rounded-full"
                    >
                      <KiteLogoMark className="w-3.5 h-3.5 text-primary-400" />
                      <span>Always opens to a calm, zero-clutter mindspace</span>
                    </Badge>

                    <Title
                      as="h3"
                      size="3xl"
                      weight="medium"
                      align="center"
                      className="sm:text-4xl tracking-tight"
                    >
                      What&apos;s on your mind?
                    </Title>

                    {/* Simulated Stadium Input Bar */}
                    <Card
                      variant="soft"
                      className="flex items-center justify-between gap-2 rounded-[28px] px-4 py-3 text-left shadow-2xl"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[--ui-bg] text-caption border border-[--ui-border-color]">
                          <Plus className="w-4 h-4" />
                        </span>
                        <span className="text-xs sm:text-sm text-placeholder truncate">
                          Click any prompt below to watch kite act in real
                          time...
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant="soft"
                          intent="gray"
                          size="xs"
                          className="rounded-full px-2.5"
                        >
                          Flash ▾
                        </Badge>
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[--ui-bg] text-caption border border-[--ui-border-color]">
                          <Mic className="w-3.5 h-3.5" />
                        </span>
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500 text-white shadow-neon">
                          <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                        </span>
                      </div>
                    </Card>

                    {/* Clickable Live Demo Scenario Chips */}
                    <div className="space-y-2.5 pt-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-primary-400">
                        ↓ Click a live command to test kite right now
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2.5">
                        {DEMO_CHAT_SCENARIOS.map((sc, idx) => (
                          <Button.Root
                            key={sc.id}
                            type="button"
                            variant="soft"
                            intent="primary"
                            size="sm"
                            onClick={() => triggerDemoScenario(idx)}
                            className="rounded-full hover:scale-[1.03]"
                          >
                            <Button.Icon type="leading">
                              <Sparkles className="w-3.5 h-3.5" />
                            </Button.Icon>
                            <Button.Label>{sc.chip}</Button.Label>
                          </Button.Root>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto w-full max-w-2xl space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[--ui-border-color] pb-2.5">
                      <Button.Root
                        type="button"
                        variant="soft"
                        intent="gray"
                        size="xs"
                        onClick={() => setActiveScenarioIdx(null)}
                        className="rounded-full"
                      >
                        <Button.Label>
                          ← Back to &ldquo;What&apos;s on your mind?&rdquo;
                        </Button.Label>
                      </Button.Root>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {DEMO_CHAT_SCENARIOS.map((sc, idx) => (
                          <Button.Root
                            key={sc.id}
                            type="button"
                            variant={
                              activeScenarioIdx === idx ? "soft" : "ghost"
                            }
                            intent={
                              activeScenarioIdx === idx ? "primary" : "gray"
                            }
                            size="xs"
                            onClick={() => triggerDemoScenario(idx)}
                            className="rounded-full"
                          >
                            <Button.Label>{sc.chip}</Button.Label>
                          </Button.Root>
                        ))}
                      </div>
                    </div>

                    {/* User Prompt Bubble */}
                    <div className="flex justify-end">
                      <Card
                        variant="soft"
                        className="max-w-[85%] rounded-3xl rounded-br-md px-5 py-3 text-sm text-title"
                      >
                        {activeScenario.prompt}
                      </Card>
                    </div>

                    {/* Minimalistic Kite Flying Loader OR Completed Agent Response */}
                    {demoSimulatingFlight ? (
                      <div className="flex items-start gap-3.5 py-2">
                        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary-500/40 bg-primary-500/15 text-primary-400 shadow-neon">
                          <KiteLogoMark className="w-4 h-4" />
                        </div>
                        <KiteFlyingLoader elapsedSeconds={1} />
                      </div>
                    ) : (
                      <div className="flex items-start gap-3.5 animate-in fade-in duration-300">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary-500/40 bg-primary-500/15 text-primary-400 shadow-neon">
                          <KiteLogoMark className="w-4 h-4" />
                        </div>
                        <div className="flex-1 space-y-3">
                          {/* Executed Actions Card */}
                          <Card variant="soft" className="p-3.5 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary-300">
                                <Zap className="w-3.5 h-3.5 text-primary-400" />
                                <span>
                                  {activeScenario.actions.length} Workspace{" "}
                                  {activeScenario.actions.length === 1
                                    ? "Action"
                                    : "Actions"}{" "}
                                  Applied
                                </span>
                              </span>
                              <Button.Root
                                type="button"
                                variant="soft"
                                intent="gray"
                                size="xs"
                                onClick={() => setDemoUndone((v) => !v)}
                              >
                                <Button.Icon type="leading">
                                  <RotateCcw className="w-3 h-3" />
                                </Button.Icon>
                                <Button.Label>
                                  {demoUndone ? "Reverted" : "1-Click Undo"}
                                </Button.Label>
                              </Button.Root>
                            </div>
                            {activeScenario.actions.map((a) => (
                              <div
                                key={a.title}
                                className="rounded-[--btn-radius] border border-[--ui-border-color] bg-[--ui-bg] px-3 py-2 text-xs"
                              >
                                <div className="font-semibold text-title">
                                  {a.title}
                                </div>
                                <Caption>{a.sub}</Caption>
                              </div>
                            ))}
                          </Card>

                          {/* Embedded Live Status Bar Preview when schedule scenario active */}
                          {activeScenario.showStatusCard && (
                            <Card
                              variant="outlined"
                              className="border-primary-500/35 bg-primary-500/5 p-4 space-y-3"
                            >
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-primary-300 flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-primary-400" />
                                  <span>
                                    NOW: AP Calculus BC — Taylor Series
                                  </span>
                                </span>
                                <span className="font-mono font-bold text-primary-400">
                                  68% • 19m left
                                </span>
                              </div>
                              <Progress.Root
                                value={68}
                                size="sm"
                                variant="soft"
                                aria-label="Demo current task progress"
                              >
                                <Progress.Indicator
                                  intent="primary"
                                  style={{
                                    transform: "translateX(-32%)",
                                  }}
                                />
                              </Progress.Root>
                              <div className="flex items-center justify-between text-[11px] text-caption pt-1">
                                <span>
                                  Entire Day Schedule (4:00 PM – 7:30 PM)
                                </span>
                                <span className="font-mono text-body">
                                  {demoDayPct}% of day done
                                </span>
                              </div>
                              <Progress.Root
                                value={demoDayPct}
                                size="xs"
                                variant="soft"
                                aria-label="Demo full day progress"
                              >
                                <Progress.Indicator
                                  intent="primary"
                                  style={{
                                    transform: `translateX(-${
                                      100 - demoDayPct
                                    }%)`,
                                  }}
                                />
                              </Progress.Root>
                            </Card>
                          )}

                          <Text size="sm" className="text-body leading-relaxed">
                            {activeScenario.reply}
                          </Text>
                        </div>
                      </div>
                    )}
                  </div>
                )
              ) : demoTab === "my_day" ? (
                /* --- DEMO TAB 2: Interactive MY DAY Centered Clock + Dual Status Bars + Swap --- */
                <div className="space-y-5">
                  <div className="text-center space-y-1">
                    <Badge
                      variant="soft"
                      intent="primary"
                      size="xs"
                      className="inline-flex items-center gap-1.5 rounded-full"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-primary-400 animate-pulse" />
                      <span>Live Focus Block Active</span>
                    </Badge>
                    <div className="font-mono text-4xl sm:text-5xl font-extrabold tracking-tight text-title">
                      {formattedClock}
                      <span className="text-lg text-placeholder ml-1">
                        :{formattedSeconds}
                      </span>
                    </div>
                  </div>

                  {/* Dual Status Bars */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card
                      variant="outlined"
                      className="border-primary-500/35 bg-primary-500/5 p-4 space-y-2.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold uppercase tracking-wider text-primary-400">
                          Current Task Progress
                        </span>
                        <span className="font-mono font-extrabold text-primary-300">
                          68%
                        </span>
                      </div>
                      <div className="text-sm font-bold text-title truncate">
                        {demoBlocks.find((b) => b.active)?.title ||
                          demoBlocks[1].title}
                      </div>
                      <Progress.Root
                        value={68}
                        size="sm"
                        variant="soft"
                        aria-label="Current task timeframe progress"
                      >
                        <Progress.Indicator
                          intent="primary"
                          style={{ transform: "translateX(-32%)" }}
                        />
                      </Progress.Root>
                      <div className="flex justify-between text-[11px] text-caption">
                        <span>41m elapsed</span>
                        <span>19m remaining in block</span>
                      </div>
                    </Card>

                    <Card variant="soft" className="p-4 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold uppercase tracking-wider text-caption">
                          Entire Day Schedule
                        </span>
                        <span className="font-mono font-extrabold text-primary-400">
                          {demoDayPct}%
                        </span>
                      </div>
                      <div className="text-sm font-bold text-title">
                        {completedDemoCount}/{totalDemoTaskCount} tasks
                        completed • 4:00 PM – 7:30 PM
                      </div>
                      <Progress.Root
                        value={demoDayPct}
                        size="sm"
                        variant="soft"
                        aria-label="Entire day schedule progress"
                      >
                        <Progress.Indicator
                          intent="primary"
                          style={{
                            transform: `translateX(-${100 - demoDayPct}%)`,
                          }}
                        />
                      </Progress.Root>
                      <div className="flex justify-between text-[11px] text-caption">
                        <span>Check off blocks below to test</span>
                        <span>1h 45m scheduled left</span>
                      </div>
                    </Card>
                  </div>

                  {/* Interactive Swappable Schedule Strip */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Caption className="font-semibold">
                        Interactive Timeline (Click checkboxes or Swap!)
                      </Caption>
                      <Button.Root
                        type="button"
                        variant="soft"
                        intent="primary"
                        size="xs"
                        onClick={handleSwapDemoBlocks}
                      >
                        <Button.Icon type="leading">
                          <ArrowLeftRight className="w-3.5 h-3.5" />
                        </Button.Icon>
                        <Button.Label>Swap Blocks #2 &amp; #4</Button.Label>
                      </Button.Root>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                      {demoBlocks.map((blk) => (
                        <Card
                          key={blk.id}
                          variant={blk.active ? "outlined" : "soft"}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleToggleDemoTask(blk.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleToggleDemoTask(blk.id);
                            }
                          }}
                          className={`text-left p-3 cursor-pointer transition-all ${
                            blk.active
                              ? "border-primary-500 bg-primary-500/15 shadow-neon"
                              : blk.done
                              ? "border-success-500/35 bg-success-500/10 opacity-75"
                              : "hover:border-primary-500/35"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-caption">
                            <span>{blk.time.split("–")[0]}</span>
                            <span>{blk.duration}</span>
                          </div>
                          <div className="mt-1.5 flex items-start gap-1.5">
                            {blk.done ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-success-400 shrink-0 mt-0.5" />
                            ) : (
                              <Circle className="w-3.5 h-3.5 text-placeholder shrink-0 mt-0.5" />
                            )}
                            <span
                              className={`text-xs font-semibold line-clamp-2 ${
                                blk.done
                                  ? "line-through text-placeholder"
                                  : "text-title"
                              }`}
                            >
                              {blk.title}
                            </span>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* --- DEMO TAB 3: Resizable Notion-Style Task Table --- */
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Title className="text-sm" size="base" weight="bold">
                        Document-Style Task Database
                      </Title>
                      <Badge variant="soft" intent="success" size="xs">
                        {completedDemoCount}/{totalDemoTaskCount} Completed
                      </Badge>
                    </div>
                    <Caption>
                      Stretchable columns • Horizontal scroll • Rich TipTap docs
                    </Caption>
                  </div>

                  <Card variant="soft" className="overflow-x-auto p-0">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[--ui-border-color] bg-[--ui-bg] text-[11px] uppercase tracking-wider text-caption">
                          <th className="py-2.5 px-3 w-10">Done</th>
                          <th className="py-2.5 px-3">Task</th>
                          <th className="py-2.5 px-3">Category</th>
                          <th className="py-2.5 px-3">Priority</th>
                          <th className="py-2.5 px-3">Est. Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[--ui-border-color]">
                        <tr className="theme-section-bg">
                          <td
                            colSpan={5}
                            className="py-2 px-3 font-mono text-[11px] font-bold text-primary-300"
                          >
                            📅 TODAY — IMMEDIATE FOCUS
                          </td>
                        </tr>
                        {demoBlocks
                          .filter((b) => b.priority !== "Break")
                          .map((row) => (
                            <tr
                              key={row.id}
                              onClick={() => handleToggleDemoTask(row.id)}
                              className="hover:bg-[--ui-bg] cursor-pointer transition-colors"
                            >
                              <td className="py-2.5 px-3">
                                {row.done ? (
                                  <CheckCircle2 className="w-4 h-4 text-success-400" />
                                ) : (
                                  <Circle className="w-4 h-4 text-placeholder" />
                                )}
                              </td>
                              <td
                                className={`py-2.5 px-3 font-semibold ${
                                  row.done
                                    ? "line-through text-placeholder"
                                    : "text-title"
                                }`}
                              >
                                {row.title}
                              </td>
                              <td className="py-2.5 px-3">
                                <Badge variant="outlined" intent="gray" size="xs">
                                  {row.tag}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3">
                                <Badge
                                  variant="soft"
                                  intent={
                                    row.priority === "Urgent"
                                      ? "danger"
                                      : row.priority === "High"
                                      ? "warning"
                                      : "info"
                                  }
                                  size="xs"
                                  className="font-semibold"
                                >
                                  {row.priority}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-caption">
                                {row.duration}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </Card>
                </div>
              )}
            </div>
          </Card>
        </RevealSection>
      </section>

      {/* =====================================================================
          4. BENTO GRID OF SUPERPOWERS
         ===================================================================== */}
      <section
        id="superpowers"
        className="scroll-mt-20 py-20 px-4 sm:px-6 lg:px-8 mx-auto max-w-7xl space-y-12"
      >
        <RevealSection className="text-center max-w-3xl mx-auto space-y-3">
          <Badge
            variant="soft"
            intent="primary"
            size="sm"
            className="mx-auto inline-flex items-center gap-2 rounded-full"
          >
            <Zap className="w-3.5 h-3.5 text-primary-400" />
            <span>Built for Deep Focus &amp; Zero Friction</span>
          </Badge>
          <Title
            as="h2"
            size="3xl"
            weight="bold"
            align="center"
            className="text-3xl sm:text-5xl font-extrabold tracking-tight"
          >
            Every tool you need to own your day.{" "}
            <span className="text-caption">Zero bloat.</span>
          </Title>
          <Text size="base" align="center" className="text-body">
            Traditional to-do apps are passive graveyards of checkboxes.{" "}
            <strong className="text-title">kite</strong> actively plans,
            organizes, and paces your execution from first thought to finished
            check-off.
          </Text>
        </RevealSection>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-5">
          {/* Bento 1 (Wide 4 cols): Full-Access Gemini Agent */}
          <RevealSection delayMs={50} className="md:col-span-4">
            <Card
              variant="mixed"
              className="h-full p-6 sm:p-8 backdrop-blur-2xl flex flex-col justify-between space-y-6 hover:border-primary-500/45 transition-colors"
            >
              <div className="space-y-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-primary-500/35 bg-primary-500/15 text-primary-400 shadow-neon">
                  <Sparkles className="w-5 h-5" />
                </div>
                <Title size="2xl" weight="bold">
                  Conversational Agent with Full Workspace Control
                </Title>
                <Text size="sm" className="text-body leading-relaxed max-w-2xl">
                  Start every session on a calm{" "}
                  <span className="text-title font-medium">
                    &ldquo;What&apos;s on your mind?&rdquo;
                  </span>{" "}
                  canvas. Type or dictate naturally—your agent adds tasks, writes
                  rich study guides inside task docs, sorts sections, switches
                  themes, builds your schedule, and supports{" "}
                  <span className="text-primary-300 font-medium">
                    1-Click Undo
                  </span>{" "}
                  on every action.
                </Text>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  "@My Day Schedule",
                  "@Daily Briefing",
                  "@Organize Board",
                  "@Canvas Sync",
                  "@Theme Studio",
                  "Voice Dictation",
                  "1-Click Undo",
                ].map((pill) => (
                  <Badge
                    key={pill}
                    variant="outlined"
                    intent="gray"
                    size="xs"
                    className="rounded-full px-3 py-1 font-mono text-primary-300"
                  >
                    {pill}
                  </Badge>
                ))}
              </div>
            </Card>
          </RevealSection>

          {/* Bento 2 (2 cols): Canvas LMS Auto-Sync */}
          <RevealSection delayMs={120} className="md:col-span-2">
            <Card
              variant="mixed"
              className="h-full p-6 sm:p-8 backdrop-blur-2xl flex flex-col justify-between space-y-5 hover:border-primary-500/45 transition-colors"
            >
              <div className="space-y-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-info-500/35 bg-info-500/15 text-info-300">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <Title size="xl" weight="bold">
                  1-Click Canvas LMS Sync
                </Title>
                <Text size="sm" className="text-body leading-relaxed">
                  Paste your Canvas Calendar iCal link once.{" "}
                  <strong className="text-title">kite</strong> automatically
                  imports upcoming class assignments, extracts course codes, sets
                  smart priorities, and prunes past clutter.
                </Text>
              </div>

              <Card
                variant="soft"
                className="p-3.5 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 text-primary-400" />
                  <span className="text-title font-medium">
                    Auto-synced on launch
                  </span>
                </div>
                <Badge
                  variant="soft"
                  intent="success"
                  size="xs"
                  className="font-mono"
                >
                  LIVE .ICS
                </Badge>
              </Card>
            </Card>
          </RevealSection>

          {/* Bento 3 (3 cols): MY DAY Live Time Engine */}
          <RevealSection delayMs={80} className="md:col-span-3">
            <Card
              variant="mixed"
              className="h-full p-6 sm:p-8 backdrop-blur-2xl space-y-4 hover:border-primary-500/45 transition-colors"
            >
              <div
                id="my-day-showcase"
                className="scroll-mt-24 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-primary-500/35 bg-primary-500/15 text-primary-400 shadow-neon"
              >
                <CalendarClock className="w-5 h-5" />
              </div>
              <Title size="xl" weight="bold">
                my day: Live Centered Clock, Dual Status Bars &amp; AI
                Auto-Arrange
              </Title>
              <Text size="sm" className="text-body leading-relaxed">
                Build your schedule manually from your table tasks or give
                Gemini your start &amp; end window to auto-arrange everything
                based on time recommendations. Drag to reorder, swap any two
                blocks with auto-cascading times, and pull live schedule
                logistics right inside chat.
              </Text>
            </Card>
          </RevealSection>

          {/* Bento 4 (3 cols): Resizable Notion-Style Table + TipTap Docs */}
          <RevealSection delayMs={150} className="md:col-span-3">
            <Card
              variant="mixed"
              className="h-full p-6 sm:p-8 backdrop-blur-2xl space-y-4 hover:border-primary-500/45 transition-colors"
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-accent-500/35 bg-accent-500/15 text-accent-300">
                <Columns className="w-5 h-5" />
              </div>
              <Title size="xl" weight="bold">
                Stretchable Notion-Style Table &amp; Rich Task Documents
              </Title>
              <Text size="sm" className="text-body leading-relaxed">
                Resize any column like a native spreadsheet, scroll wide tables
                effortlessly, group tasks under movable section dividers, filter
                completed vs. in-progress work, and click any task to open a
                full TipTap rich-text document editor (slide drawer, modal, or
                inline).
              </Text>
            </Card>
          </RevealSection>

          {/* Bento 5 (3 cols): Privacy & BYO Free Key */}
          <RevealSection delayMs={100} className="md:col-span-3">
            <Card
              variant="mixed"
              className="h-full p-6 sm:p-8 backdrop-blur-2xl space-y-3 hover:border-primary-500/45 transition-colors"
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-success-500/35 bg-success-500/15 text-success-300">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <Title size="xl" weight="bold">
                Zero Subscriptions. Your Key &amp; Your Private Database.
              </Title>
              <Text size="sm" className="text-body leading-relaxed">
                Connect a free Google AI Studio key in 30 seconds for unlimited
                high-speed Gemini 3.8 Flash power—or toggle AI off anytime for a
                pure manual workspace. Every task is protected by PostgreSQL
                Row-Level Security.
              </Text>
            </Card>
          </RevealSection>

          {/* Bento 6 (3 cols): Rich Document Modes */}
          <RevealSection delayMs={170} className="md:col-span-3">
            <Card
              variant="mixed"
              className="h-full p-6 sm:p-8 backdrop-blur-2xl space-y-3 hover:border-primary-500/45 transition-colors"
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-warning-500/35 bg-warning-500/15 text-warning-300">
                <Layers className="w-5 h-5" />
              </div>
              <Title size="xl" weight="bold">
                100% Customizable Statuses, Tags, Columns &amp; Coaching Tones
              </Title>
              <Text size="sm" className="text-body leading-relaxed">
                Tailor custom color-coded categories, priorities, table headers,
                and 4 distinct AI coaching personalities (
                <span className="text-title">
                  Locked In, Chill Coach, Hyper Drive, Executive
                </span>
                ) to match how your brain works best.
              </Text>
            </Card>
          </RevealSection>
        </div>
      </section>

      {/* =====================================================================
          5. LIVE ATMOSPHERE & THEME PLAYGROUND
         ===================================================================== */}
      <section
        id="atmospheres"
        className="scroll-mt-20 py-16 px-4 sm:px-6 lg:px-8 mx-auto max-w-7xl"
      >
        <RevealSection>
          <Card
            variant="mixed"
            fancy
            className="p-6 sm:p-10 lg:p-12 backdrop-blur-2xl space-y-8"
          >
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary-400">
                  <Palette className="w-4 h-4" />
                  <span>Live Interactive Atmosphere Studio</span>
                </div>
                <Title
                  as="h2"
                  size="3xl"
                  weight="bold"
                  className="text-2xl sm:text-4xl font-extrabold tracking-tight"
                >
                  A workspace you actually want to keep open all day.
                </Title>
                <Text size="sm" className="text-body">
                  Click any neon palette or ambient backdrop below to transform
                  this page in real time—plus upload custom 4K video loops
                  stored locally in IndexedDB with zero bandwidth lag once you
                  sign in.
                </Text>
              </div>

              <Button.Root
                type="button"
                variant="solid"
                intent="primary"
                size="md"
                onClick={onGoogleSignIn}
                className="self-start lg:self-auto px-5 py-3 h-auto text-xs sm:text-sm font-extrabold shadow-neon"
              >
                <Button.Label>Save This Vibe &amp; Sign In</Button.Label>
                <Button.Icon type="trailing">
                  <ArrowRight className="w-4 h-4" />
                </Button.Icon>
              </Button.Root>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Theme Swatches */}
              <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {THEME_OPTIONS.map((t) => {
                  const isSelected = profile.theme === t.id;
                  return (
                    <Card
                      key={t.id}
                      variant={isSelected ? "outlined" : "soft"}
                      role="button"
                      tabIndex={0}
                      onClick={() => onUpdateProfile({ theme: t.id })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onUpdateProfile({ theme: t.id });
                        }
                      }}
                      className={`group p-4 text-left cursor-pointer transition-all ${
                        isSelected
                          ? "border-primary-500 bg-primary-500/15 shadow-neon"
                          : "hover:border-primary-500/35"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex -space-x-1.5">
                          <span
                            className="h-5 w-5 rounded-full border border-black/50"
                            style={{ backgroundColor: t.colors.primary }}
                          />
                          <span
                            className="h-5 w-5 rounded-full border border-black/50"
                            style={{ backgroundColor: t.colors.highlight }}
                          />
                          <span
                            className="h-5 w-5 rounded-full border border-black/50"
                            style={{ backgroundColor: t.colors.surface }}
                          />
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-primary-400" />
                        )}
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-title">
                        {t.name}
                      </div>
                      <Caption className="mt-0.5 block">
                        {isSelected ? "Active live preview" : "Click to preview"}
                      </Caption>
                    </Card>
                  );
                })}
              </div>

              {/* 4 Ambient Motion Backdrops */}
              <Card
                variant="soft"
                className="lg:col-span-4 p-4 flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-caption mb-2.5">
                    Ambient Motion Backdrop
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: "aurora", label: "Clean Aurora" },
                        { id: "cyber", label: "Cyber Horizon" },
                        { id: "lofi", label: "Lofi Bokeh" },
                        { id: "particles", label: "Starlight Drift" },
                      ] as const
                    ).map((bg) => {
                      const active = profile.video_bg_preset === bg.id;
                      return (
                        <Button.Root
                          key={bg.id}
                          type="button"
                          variant={active ? "soft" : "outlined"}
                          intent={active ? "primary" : "gray"}
                          size="sm"
                          onClick={() =>
                            onUpdateProfile({ video_bg_preset: bg.id })
                          }
                          className={
                            active ? "border-primary-500 font-semibold" : ""
                          }
                        >
                          <Button.Label>{bg.label}</Button.Label>
                        </Button.Root>
                      );
                    })}
                  </div>
                </div>

                <Caption className="border-t border-[--ui-border-color] pt-3 block">
                  Plus custom `.mp4` / `.webm` background uploads with adjustable
                  dim &amp; glass blur inside Settings.
                </Caption>
              </Card>
            </div>
          </Card>
        </RevealSection>
      </section>

      {/* =====================================================================
          6. 3-STEP WORKFLOW + OLD VS. KITE COMPARISON
         ===================================================================== */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 mx-auto max-w-7xl space-y-16">
        {/* 3 Steps */}
        <RevealSection className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              step: "01",
              title: "Sign in with Google in 1 Click",
              desc: "Your personal cloud-synced board, custom themes, and Row-Level Security vault spin up instantaneously.",
              icon: Lock,
            },
            {
              step: "02",
              title: "Dump Your Mind or Sync Canvas",
              desc: "Tell kite what's on your plate in plain English or connect your Canvas iCal URL to pull assignments automatically.",
              icon: FileText,
            },
            {
              step: "03",
              title: "Auto-Arrange my day & Fly",
              desc: "Let Gemini slot every task into your ideal window and follow the live centered clock & progress bars to 100%.",
              icon: CalendarClock,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.step}
                variant="soft"
                className="p-6 sm:p-7 backdrop-blur-xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <Badge
                    variant="soft"
                    intent="primary"
                    size="xs"
                    className="font-mono font-extrabold"
                  >
                    STEP {item.step}
                  </Badge>
                  <Icon className="w-5 h-5 text-placeholder" />
                </div>
                <Title size="lg" weight="bold">
                  {item.title}
                </Title>
                <Text size="sm" className="text-caption leading-relaxed">
                  {item.desc}
                </Text>
              </Card>
            );
          })}
        </RevealSection>

        {/* Final High-Converting Call to Action Card */}
        <RevealSection>
          <Card
            variant="mixed"
            fancy
            className="relative overflow-hidden rounded-[32px] border-primary-500/40 p-8 sm:p-14 text-center shadow-[0_30px_90px_rgba(0,0,0,0.75)] backdrop-blur-2xl"
          >
            <div
              className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[520px] rounded-full blur-[130px] opacity-30"
              style={{ backgroundColor: "var(--primary)" }}
            />

            <div className="pointer-events-none absolute -right-6 -bottom-8 opacity-35 hidden sm:block">
              <HeroSoaringKite className="w-56 h-48" />
            </div>

            <div className="relative z-10 max-w-2xl mx-auto space-y-6">
              <div
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl shadow-neon"
                style={{
                  backgroundColor: "var(--primary)",
                  color: "#09090b",
                }}
              >
                <KiteLogoMark className="w-8 h-8" strokeWidth={2.2} />
              </div>

              <Display
                as="h2"
                size="4xl"
                weight="bold"
                align="center"
                className="text-3xl sm:text-5xl font-extrabold tracking-tight"
              >
                Ready to let your day take flight?
              </Display>
              <Text
                size="base"
                align="center"
                className="text-body leading-relaxed"
              >
                Join ambitious students, builders, and creators running their
                tasks, schedules, and focus sessions inside{" "}
                <strong className="text-title">kite</strong>.
              </Text>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button.Root
                  type="button"
                  variant="solid"
                  intent="primary"
                  size="xl"
                  onClick={onGoogleSignIn}
                  className="group relative overflow-hidden w-full sm:w-auto px-9 py-4 h-auto text-sm sm:text-base font-extrabold shadow-neon hover:scale-[1.02]"
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 w-16 bg-white/35 blur-sm kite-cta-shine"
                  />
                  <Button.Icon type="leading">
                    <LogIn className="w-4 h-4 stroke-[2.5]" />
                  </Button.Icon>
                  <Button.Label>Continue with Google — Launch kite</Button.Label>
                  <Button.Icon type="trailing">
                    <ArrowRight className="w-4 h-4 stroke-[2.5] transition-transform group-hover:translate-x-1" />
                  </Button.Icon>
                </Button.Root>
              </div>

              <Caption className="block">
                Instant setup • Personal Supabase PostgreSQL with Row-Level
                Security • Free forever
              </Caption>
            </div>
          </Card>
        </RevealSection>
      </section>

      {/* =====================================================================
          7. MINIMAL FOOTER
         ===================================================================== */}
      <footer className="border-t border-[--ui-border-color] bg-[--ui-bg]/80 backdrop-blur-xl py-8 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-caption">
          <div className="flex items-center gap-2">
            <KiteLogoMark className="w-4 h-4 text-primary-400" />
            <span className="font-bold text-title">kite</span>
            <span>— Autonomous AI Workspace &amp; Day Architect</span>
          </div>
          <div className="flex items-center gap-5">
            <a
              href="#interactive-demo"
              className="hover:text-title transition-colors"
            >
              Demo
            </a>
            <a
              href="#superpowers"
              className="hover:text-title transition-colors"
            >
              Features
            </a>
            <a
              href="#atmospheres"
              className="hover:text-title transition-colors"
            >
              Themes
            </a>
            <Button.Root
              type="button"
              variant="ghost"
              intent="primary"
              size="xs"
              onClick={onGoogleSignIn}
            >
              <Button.Label>Sign in with Google →</Button.Label>
            </Button.Root>
          </div>
        </div>
      </footer>
    </div>
  );
};
