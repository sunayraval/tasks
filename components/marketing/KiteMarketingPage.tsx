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
    <div className="relative min-h-screen w-full text-zinc-100 selection:bg-primary selection:text-black overflow-x-clip">
      {/* =====================================================================
          1. STICKY GLASS MARKETING NAVBAR
         ===================================================================== */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-black/45 backdrop-blur-2xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <a
            href="#top"
            className="flex items-center gap-2.5 group focus:outline-none"
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl shadow-[0_0_24px_rgba(250,204,21,0.55)] transition-transform duration-300 group-hover:scale-105"
              style={{
                backgroundColor: "#facc15",
                color: "#09090b",
              }}
            >
              <KiteLogoMark className="w-5 h-5 text-black" strokeWidth={2.4} />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-white leading-none">
              kite
            </span>
            <span className="inline-flex items-center rounded-full border border-white px-2.5 py-0.5 text-xs font-mono font-medium text-yellow-300 leading-none">
              2.0
            </span>
          </a>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-white/65">
            <a
              href="#interactive-demo"
              className="hover:text-white transition-colors"
            >
              Interactive Demo
            </a>
            <a
              href="#superpowers"
              className="hover:text-white transition-colors"
            >
              Features
            </a>
            <a
              href="#my-day-showcase"
              className="hover:text-white transition-colors"
            >
              my day Engine
            </a>
            <a
              href="#atmospheres"
              className="hover:text-white transition-colors"
            >
              Live Themes
            </a>
          </nav>

          {/* Right: Live Theme Dots + Sign-In CTA */}
          <div className="flex items-center gap-2.5">
            <div
              className="hidden lg:flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1.5"
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

            <button
              type="button"
              onClick={onGoogleSignIn}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] hover:bg-white/[0.12] px-4 py-2 text-xs font-semibold text-white transition-all"
            >
              <span>Sign in</span>
            </button>

            <button
              type="button"
              onClick={onGoogleSignIn}
              className="relative overflow-hidden inline-flex items-center gap-1.5 rounded-full bg-primary px-4 sm:px-5 py-2 text-xs font-extrabold text-black shadow-neon hover:brightness-110 hover:scale-[1.02] active:scale-[0.99] transition-all"
            >
              <span>Launch kite Free</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
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
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-highlight shadow-neon backdrop-blur-xl">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>
              Powered by Gemini 3.8 Flash • Conversational AI + Live Day
              Architect
            </span>
          </div>

          {/* Main Display Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-[72px] font-extrabold tracking-[-0.035em] leading-[1.04] text-white">
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
          </h1>

          {/* High-Clarity Value Prop */}
          <p className="mx-auto max-w-2xl text-sm sm:text-lg text-white/70 leading-relaxed">
            <strong className="text-white font-semibold">kite</strong> unites an
            autonomous AI workspace agent, a live down-to-the-second{" "}
            <strong className="text-highlight font-semibold">my day</strong>{" "}
            time-blocker, a resizable Notion-style task database, and 1-click
            Canvas LMS sync—wrapped in cinema-grade ambient themes.
          </p>

          {/* Primary Conversion CTA Row */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              type="button"
              onClick={onGoogleSignIn}
              className="group relative overflow-hidden w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-2xl bg-primary px-8 py-4 text-sm sm:text-base font-extrabold text-black shadow-neon hover:brightness-110 hover:scale-[1.02] active:scale-[0.99] transition-all"
            >
              {/* Subtle Compositor Shine Sweep */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 w-16 bg-white/35 blur-sm kite-cta-shine"
              />
              <LogIn className="w-4 h-4 stroke-[2.5]" />
              <span>Continue with Google — It&apos;s Free</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5] transition-transform group-hover:translate-x-1" />
            </button>

            <a
              href="#interactive-demo"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] px-7 py-4 text-sm sm:text-base font-semibold text-white backdrop-blur-xl transition-all"
            >
              <Wand2 className="w-4 h-4 text-primary" />
              <span>Try Interactive Live Demo</span>
            </a>
          </div>

          {/* Micro-Trust Conversion Signals */}
          <div className="pt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/55">
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-primary" />
              <span>100% free — no credit card</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-primary" />
              <span>Bring your free Gemini Studio key (or run AI-free)</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-primary" />
              <span>Automatic Canvas LMS iCal sync</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-primary" />
              <span>Row-Level Security cloud sync</span>
            </span>
          </div>
        </div>

        {/* ===================================================================
            3. LIVE INTERACTIVE 3-MODE WORKSPACE SANDBOX
           =================================================================== */}
        <RevealSection delayMs={100} className="mt-14 sm:mt-16 mx-auto max-w-6xl">
          <div
            id="interactive-demo"
            className="scroll-mt-24 rounded-3xl border border-white/15 bg-[#0e1016]/90 shadow-[0_30px_100px_rgba(0,0,0,0.8)] backdrop-blur-2xl overflow-hidden"
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/45 px-4 sm:px-6 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-rose-500/75" />
                  <span className="h-3 w-3 rounded-full bg-amber-400/75" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400/75" />
                </div>
                <div className="h-4 w-px bg-white/10 mx-1" />
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-md text-black font-bold"
                    style={{ backgroundColor: "var(--primary)" }}
                  >
                    <KiteLogoMark className="w-3.5 h-3.5" strokeWidth={2.3} />
                  </div>
                  <span className="text-xs font-bold text-white">kite</span>
                  <span className="hidden sm:inline-block rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-mono text-highlight">
                    Interactive Preview
                  </span>
                </div>
              </div>

              {/* Interactive Demo Mode Switcher */}
              <div className="inline-flex items-center rounded-full border border-white/15 bg-black/60 p-1">
                <button
                  type="button"
                  onClick={() => setDemoTab("chat")}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                    demoTab === "chat"
                      ? "bg-primary text-black shadow-neon"
                      : "text-white/65 hover:text-white"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Chat Agent</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDemoTab("my_day")}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                    demoTab === "my_day"
                      ? "bg-primary text-black shadow-neon"
                      : "text-white/65 hover:text-white"
                  }`}
                >
                  <CalendarClock className="w-3.5 h-3.5" />
                  <span>my day Live</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDemoTab("tasks")}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold transition-all ${
                    demoTab === "tasks"
                      ? "bg-primary text-black shadow-neon"
                      : "text-white/65 hover:text-white"
                  }`}
                >
                  <Table2 className="w-3.5 h-3.5" />
                  <span>Tasks Table</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onGoogleSignIn}
                className="hidden sm:inline-flex items-center gap-1 rounded-xl border border-primary/40 bg-primary/15 hover:bg-primary/25 px-3 py-1.5 text-xs font-semibold text-highlight transition-colors"
              >
                <span>Use with your tasks</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* SANDBOX BODY */}
            <div className="p-5 sm:p-8 min-h-[440px] flex flex-col justify-center">
              {demoTab === "chat" ? (
                /* --- DEMO TAB 1: "What's on your mind?" + Live Kite Flight Simulation --- */
                activeScenario === null ? (
                  <div className="mx-auto w-full max-w-2xl py-6 text-center space-y-6">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/60">
                      <KiteLogoMark className="w-3.5 h-3.5 text-primary" />
                      <span>Always opens to a calm, zero-clutter mindspace</span>
                    </div>

                    <h3 className="text-3xl sm:text-4xl font-normal tracking-tight text-white/95">
                      What&apos;s on your mind?
                    </h3>

                    {/* Simulated Stadium Input Bar */}
                    <div className="flex items-center justify-between gap-2 rounded-[28px] border border-white/15 bg-[#1c1d22] px-4 py-3 text-left shadow-2xl">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/65">
                          <Plus className="w-4 h-4" />
                        </span>
                        <span className="text-xs sm:text-sm text-white/45 truncate">
                          Click any prompt below to watch kite act in real
                          time...
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-white/70">
                          Flash ▾
                        </span>
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/60">
                          <Mic className="w-3.5 h-3.5" />
                        </span>
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-black shadow-neon">
                          <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                        </span>
                      </div>
                    </div>

                    {/* Clickable Live Demo Scenario Chips */}
                    <div className="space-y-2.5 pt-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                        ↓ Click a live command to test kite right now
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2.5">
                        {DEMO_CHAT_SCENARIOS.map((sc, idx) => (
                          <button
                            key={sc.id}
                            type="button"
                            onClick={() => triggerDemoScenario(idx)}
                            className="inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 hover:bg-primary/25 px-4 py-2 text-xs font-semibold text-highlight transition-all hover:scale-[1.03]"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-primary" />
                            <span>{sc.chip}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mx-auto w-full max-w-2xl space-y-5">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                      <button
                        type="button"
                        onClick={() => setActiveScenarioIdx(null)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 px-3 py-1 text-xs text-white/80"
                      >
                        <span>← Back to &ldquo;What&apos;s on your mind?&rdquo;</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        {DEMO_CHAT_SCENARIOS.map((sc, idx) => (
                          <button
                            key={sc.id}
                            type="button"
                            onClick={() => triggerDemoScenario(idx)}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                              activeScenarioIdx === idx
                                ? "bg-primary/25 text-highlight border border-primary/40"
                                : "bg-white/5 text-white/55 hover:text-white"
                            }`}
                          >
                            {sc.chip}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* User Prompt Bubble */}
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-3xl rounded-br-md border border-white/15 bg-[#26282e] px-5 py-3 text-sm text-white">
                        {activeScenario.prompt}
                      </div>
                    </div>

                    {/* Minimalistic Kite Flying Loader OR Completed Agent Response */}
                    {demoSimulatingFlight ? (
                      <div className="flex items-start gap-3.5 py-2">
                        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/15 text-primary shadow-neon">
                          <KiteLogoMark className="w-4 h-4" />
                        </div>
                        <KiteFlyingLoader elapsedSeconds={1} />
                      </div>
                    ) : (
                      <div className="flex items-start gap-3.5 animate-in fade-in duration-300">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/15 text-primary shadow-neon">
                          <KiteLogoMark className="w-4 h-4" />
                        </div>
                        <div className="flex-1 space-y-3">
                          {/* Executed Actions Card */}
                          <div className="rounded-2xl border border-white/15 bg-[#16181e] p-3.5 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-highlight">
                                <Zap className="w-3.5 h-3.5 text-primary" />
                                <span>
                                  {activeScenario.actions.length} Workspace{" "}
                                  {activeScenario.actions.length === 1
                                    ? "Action"
                                    : "Actions"}{" "}
                                  Applied
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setDemoUndone((v) => !v)}
                                className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-2.5 py-1 text-[11px] text-white/80"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>{demoUndone ? "Reverted" : "1-Click Undo"}</span>
                              </button>
                            </div>
                            {activeScenario.actions.map((a) => (
                              <div
                                key={a.title}
                                className="rounded-xl border border-white/[0.07] bg-black/40 px-3 py-2 text-xs"
                              >
                                <div className="font-semibold text-white">
                                  {a.title}
                                </div>
                                <div className="text-[11px] text-white/50">
                                  {a.sub}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Embedded Live Status Bar Preview when schedule scenario active */}
                          {activeScenario.showStatusCard && (
                            <div className="rounded-2xl border border-primary/30 bg-black/55 p-4 space-y-3">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-highlight flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-primary" />
                                  <span>
                                    NOW: AP Calculus BC — Taylor Series
                                  </span>
                                </span>
                                <span className="font-mono font-bold text-primary">
                                  68% • 19m left
                                </span>
                              </div>
                              <progress
                                className="taskit-progress w-full h-2.5 block"
                                value={68}
                                max={100}
                                aria-label="Demo current task progress"
                              />
                              <div className="flex items-center justify-between text-[11px] text-white/60 pt-1">
                                <span>Entire Day Schedule (4:00 PM – 7:30 PM)</span>
                                <span className="font-mono text-white/80">
                                  {demoDayPct}% of day done
                                </span>
                              </div>
                              <progress
                                className="taskit-progress w-full h-2 block"
                                value={demoDayPct}
                                max={100}
                                aria-label="Demo full day progress"
                              />
                            </div>
                          )}

                          <p className="text-sm text-white/85 leading-relaxed">
                            {activeScenario.reply}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              ) : demoTab === "my_day" ? (
                /* --- DEMO TAB 2: Interactive MY DAY Centered Clock + Dual Status Bars + Swap --- */
                <div className="space-y-5">
                  <div className="text-center space-y-1">
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-3 py-0.5 text-[11px] font-semibold text-highlight">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                      <span>Live Focus Block Active</span>
                    </div>
                    <div className="font-mono text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
                      {formattedClock}
                      <span className="text-lg text-white/40 ml-1">
                        :{formattedSeconds}
                      </span>
                    </div>
                  </div>

                  {/* Dual Status Bars */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-primary/35 bg-black/50 p-4 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold uppercase tracking-wider text-primary">
                          Current Task Progress
                        </span>
                        <span className="font-mono font-extrabold text-highlight">
                          68%
                        </span>
                      </div>
                      <div className="text-sm font-bold text-white truncate">
                        {demoBlocks.find((b) => b.active)?.title ||
                          demoBlocks[1].title}
                      </div>
                      <progress
                        className="taskit-progress w-full h-2.5 block"
                        value={68}
                        max={100}
                        aria-label="Current task timeframe progress"
                      />
                      <div className="flex justify-between text-[11px] text-white/50">
                        <span>41m elapsed</span>
                        <span>19m remaining in block</span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/12 bg-black/50 p-4 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold uppercase tracking-wider text-white/60">
                          Entire Day Schedule
                        </span>
                        <span className="font-mono font-extrabold text-primary">
                          {demoDayPct}%
                        </span>
                      </div>
                      <div className="text-sm font-bold text-white">
                        {completedDemoCount}/{totalDemoTaskCount} tasks
                        completed • 4:00 PM – 7:30 PM
                      </div>
                      <progress
                        className="taskit-progress w-full h-2.5 block"
                        value={demoDayPct}
                        max={100}
                        aria-label="Entire day schedule progress"
                      />
                      <div className="flex justify-between text-[11px] text-white/50">
                        <span>Check off blocks below to test</span>
                        <span>1h 45m scheduled left</span>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Swappable Schedule Strip */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white/65">
                        Interactive Timeline (Click checkboxes or Swap!)
                      </span>
                      <button
                        type="button"
                        onClick={handleSwapDemoBlocks}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/15 hover:bg-primary/25 px-3 py-1.5 text-xs font-semibold text-highlight transition-colors"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        <span>Swap Blocks #2 &amp; #4</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                      {demoBlocks.map((blk) => (
                        <button
                          key={blk.id}
                          type="button"
                          onClick={() => handleToggleDemoTask(blk.id)}
                          className={`text-left rounded-2xl border p-3 transition-all ${
                            blk.active
                              ? "border-primary bg-primary/15 shadow-neon"
                              : blk.done
                              ? "border-emerald-500/30 bg-emerald-500/10 opacity-75"
                              : "border-white/10 bg-white/[0.03] hover:bg-white/[0.07]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-white/55">
                            <span>{blk.time.split("–")[0]}</span>
                            <span>{blk.duration}</span>
                          </div>
                          <div className="mt-1.5 flex items-start gap-1.5">
                            {blk.done ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            ) : (
                              <Circle className="w-3.5 h-3.5 text-white/40 shrink-0 mt-0.5" />
                            )}
                            <span
                              className={`text-xs font-semibold line-clamp-2 ${
                                blk.done
                                  ? "line-through text-white/45"
                                  : "text-white"
                              }`}
                            >
                              {blk.title}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* --- DEMO TAB 3: Resizable Notion-Style Task Table --- */
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">
                        Document-Style Task Database
                      </span>
                      <span className="rounded-full bg-emerald-500/15 border border-emerald-400/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                        {completedDemoCount}/{totalDemoTaskCount} Completed
                      </span>
                    </div>
                    <span className="text-xs text-white/50">
                      Stretchable columns • Horizontal scroll • Rich TipTap docs
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-white/12 bg-black/45">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/[0.03] text-[11px] uppercase tracking-wider text-white/50">
                          <th className="py-2.5 px-3 w-10">Done</th>
                          <th className="py-2.5 px-3">Task</th>
                          <th className="py-2.5 px-3">Category</th>
                          <th className="py-2.5 px-3">Priority</th>
                          <th className="py-2.5 px-3">Est. Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.07]">
                        <tr className="theme-section-bg">
                          <td
                            colSpan={5}
                            className="py-2 px-3 font-mono text-[11px] font-bold text-highlight"
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
                              className="hover:bg-white/[0.04] cursor-pointer transition-colors"
                            >
                              <td className="py-2.5 px-3">
                                {row.done ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <Circle className="w-4 h-4 text-white/40" />
                                )}
                              </td>
                              <td
                                className={`py-2.5 px-3 font-semibold ${
                                  row.done
                                    ? "line-through text-white/40"
                                    : "text-white"
                                }`}
                              >
                                {row.title}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/80">
                                  {row.tag}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                    row.priority === "Urgent"
                                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                      : row.priority === "High"
                                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                      : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                                  }`}
                                >
                                  {row.priority}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-white/65">
                                {row.duration}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
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
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1 text-xs font-semibold text-highlight">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span>Built for Deep Focus &amp; Zero Friction</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
            Every tool you need to own your day.{" "}
            <span className="text-white/50">Zero bloat.</span>
          </h2>
          <p className="text-sm sm:text-base text-white/65">
            Traditional to-do apps are passive graveyards of checkboxes.{" "}
            <strong className="text-white">kite</strong> actively plans,
            organizes, and paces your execution from first thought to finished
            check-off.
          </p>
        </RevealSection>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-5">
          {/* Bento 1 (Wide 4 cols): Full-Access Gemini Agent */}
          <RevealSection
            delayMs={50}
            className="md:col-span-4 rounded-3xl border border-white/12 theme-panel p-6 sm:p-8 backdrop-blur-2xl flex flex-col justify-between space-y-6 hover:border-primary/45 transition-colors"
          >
            <div className="space-y-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/35 bg-primary/15 text-primary shadow-neon">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white">
                Conversational Agent with Full Workspace Control
              </h3>
              <p className="text-sm text-white/65 leading-relaxed max-w-2xl">
                Start every session on a calm{" "}
                <span className="text-white font-medium">
                  &ldquo;What&apos;s on your mind?&rdquo;
                </span>{" "}
                canvas. Type or dictate naturally—your agent adds tasks, writes
                rich study guides inside task docs, sorts sections, switches
                themes, builds your schedule, and supports{" "}
                <span className="text-highlight font-medium">
                  1-Click Undo
                </span>{" "}
                on every action.
              </p>
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
                <span
                  key={pill}
                  className="rounded-full border border-white/10 bg-black/45 px-3 py-1 text-xs font-mono text-highlight/90"
                >
                  {pill}
                </span>
              ))}
            </div>
          </RevealSection>

          {/* Bento 2 (2 cols): Canvas LMS Auto-Sync */}
          <RevealSection
            delayMs={120}
            className="md:col-span-2 rounded-3xl border border-white/12 theme-panel p-6 sm:p-8 backdrop-blur-2xl flex flex-col justify-between space-y-5 hover:border-primary/45 transition-colors"
          >
            <div className="space-y-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/35 bg-cyan-500/15 text-cyan-300">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-white">
                1-Click Canvas LMS Sync
              </h3>
              <p className="text-sm text-white/65 leading-relaxed">
                Paste your Canvas Calendar iCal link once.{" "}
                <strong className="text-white">kite</strong> automatically
                imports upcoming class assignments, extracts course codes, sets
                smart priorities, and prunes past clutter.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/45 p-3.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-primary" />
                <span className="text-white/85 font-medium">
                  Auto-synced on launch
                </span>
              </div>
              <span className="font-mono text-[11px] text-emerald-400">
                LIVE .ICS
              </span>
            </div>
          </RevealSection>

          {/* Bento 3 (3 cols): MY DAY Live Time Engine */}
          <RevealSection
            delayMs={80}
            className="md:col-span-3 rounded-3xl border border-white/12 theme-panel p-6 sm:p-8 backdrop-blur-2xl space-y-4 hover:border-primary/45 transition-colors"
          >
            <div
              id="my-day-showcase"
              className="scroll-mt-24 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/35 bg-primary/15 text-primary shadow-neon"
            >
              <CalendarClock className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-white">
              my day: Live Centered Clock, Dual Status Bars &amp; AI
              Auto-Arrange
            </h3>
            <p className="text-sm text-white/65 leading-relaxed">
              Build your schedule manually from your table tasks or give Gemini
              your start &amp; end window to auto-arrange everything based on
              time recommendations. Drag to reorder, swap any two blocks with
              auto-cascading times, and pull live schedule logistics right
              inside chat.
            </p>
          </RevealSection>

          {/* Bento 4 (3 cols): Resizable Notion-Style Table + TipTap Docs */}
          <RevealSection
            delayMs={150}
            className="md:col-span-3 rounded-3xl border border-white/12 theme-panel p-6 sm:p-8 backdrop-blur-2xl space-y-4 hover:border-primary/45 transition-colors"
          >
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-400/35 bg-violet-500/15 text-violet-300">
              <Columns className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-white">
              Stretchable Notion-Style Table &amp; Rich Task Documents
            </h3>
            <p className="text-sm text-white/65 leading-relaxed">
              Resize any column like a native spreadsheet, scroll wide tables
              effortlessly, group tasks under movable section dividers, filter
              completed vs. in-progress work, and click any task to open a full
              TipTap rich-text document editor (slide drawer, modal, or inline).
            </p>
          </RevealSection>

          {/* Bento 5 (3 cols): Privacy & BYO Free Key */}
          <RevealSection
            delayMs={100}
            className="md:col-span-3 rounded-3xl border border-white/12 theme-panel p-6 sm:p-8 backdrop-blur-2xl space-y-3 hover:border-primary/45 transition-colors"
          >
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/35 bg-emerald-500/15 text-emerald-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-white">
              Zero Subscriptions. Your Key &amp; Your Private Database.
            </h3>
            <p className="text-sm text-white/65 leading-relaxed">
              Connect a free Google AI Studio key in 30 seconds for unlimited
              high-speed Gemini 3.8 Flash power—or toggle AI off anytime for a
              pure manual workspace. Every task is protected by PostgreSQL
              Row-Level Security.
            </p>
          </RevealSection>

          {/* Bento 6 (3 cols):Rich Document Modes */}
          <RevealSection
            delayMs={170}
            className="md:col-span-3 rounded-3xl border border-white/12 theme-panel p-6 sm:p-8 backdrop-blur-2xl space-y-3 hover:border-primary/45 transition-colors"
          >
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/35 bg-amber-500/15 text-amber-300">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-white">
              100% Customizable Statuses, Tags, Columns &amp; Coaching Tones
            </h3>
            <p className="text-sm text-white/65 leading-relaxed">
              Tailor custom color-coded categories, priorities, table headers,
              and 4 distinct AI coaching personalities (
              <span className="text-white/85">
                Locked In, Chill Coach, Hyper Drive, Executive
              </span>
              ) to match how your brain works best.
            </p>
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
        <RevealSection className="rounded-3xl border border-white/15 theme-panel p-6 sm:p-10 lg:p-12 backdrop-blur-2xl space-y-8">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                <Palette className="w-4 h-4" />
                <span>Live Interactive Atmosphere Studio</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                A workspace you actually want to keep open all day.
              </h2>
              <p className="text-sm text-white/65">
                Click any neon palette or ambient backdrop below to transform
                this page in real time—plus upload custom 4K video loops stored
                locally in IndexedDB with zero bandwidth lag once you sign in.
              </p>
            </div>

            <button
              type="button"
              onClick={onGoogleSignIn}
              className="self-start lg:self-auto inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-xs sm:text-sm font-extrabold text-black shadow-neon hover:brightness-110 transition-all"
            >
              <span>Save This Vibe &amp; Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* 6 Curated Neon Themes */}
            <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {THEME_OPTIONS.map((t) => {
                const isSelected = profile.theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onUpdateProfile({ theme: t.id })}
                    className={`group rounded-2xl border p-4 text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/15 shadow-neon"
                        : "border-white/10 bg-black/40 hover:bg-white/[0.06]"
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
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-white">
                      {t.name}
                    </div>
                    <div className="text-[11px] text-white/50 mt-0.5">
                      {isSelected ? "Active live preview" : "Click to preview"}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 4 Ambient Motion Backdrops */}
            <div className="lg:col-span-4 rounded-2xl border border-white/10 bg-black/45 p-4 flex flex-col justify-between space-y-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-white/60 mb-2.5">
                  Ambient Motion Backdrop
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: "cyber", label: "Cyber Horizon" },
                      { id: "rain", label: "Midnight Rain" },
                      { id: "lofi", label: "Lofi Bokeh" },
                      { id: "particles", label: "Starlight Drift" },
                    ] as const
                  ).map((bg) => {
                    const active = profile.video_bg_preset === bg.id;
                    return (
                      <button
                        key={bg.id}
                        type="button"
                        onClick={() =>
                          onUpdateProfile({ video_bg_preset: bg.id })
                        }
                        className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all ${
                          active
                            ? "border-primary bg-primary/20 text-highlight"
                            : "border-white/10 bg-white/[0.03] text-white/65 hover:text-white"
                        }`}
                      >
                        {bg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="text-[11px] text-white/50 border-t border-white/10 pt-3">
                Plus custom `.mp4` / `.webm` background uploads with adjustable
                dim &amp; glass blur inside Settings.
              </div>
            </div>
          </div>
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
              <div
                key={item.step}
                className="rounded-3xl border border-white/10 bg-black/40 p-6 sm:p-7 backdrop-blur-xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-extrabold text-primary bg-primary/15 border border-primary/30 rounded-lg px-2.5 py-1">
                    STEP {item.step}
                  </span>
                  <Icon className="w-5 h-5 text-white/40" />
                </div>
                <h3 className="text-lg font-bold text-white">{item.title}</h3>
                <p className="text-xs sm:text-sm text-white/60 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </RevealSection>

        {/* Final High-Converting Call to Action Card */}
        <RevealSection>
          <div className="relative overflow-hidden rounded-[32px] border border-primary/40 theme-panel p-8 sm:p-14 text-center shadow-[0_30px_90px_rgba(0,0,0,0.75)] backdrop-blur-2xl">
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

              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
                Ready to let your day take flight?
              </h2>
              <p className="text-sm sm:text-base text-white/70 leading-relaxed">
                Join ambitious students, builders, and creators running their
                tasks, schedules, and focus sessions inside{" "}
                <strong className="text-white">kite</strong>.
              </p>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onGoogleSignIn}
                  className="group relative overflow-hidden w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-2xl bg-primary px-9 py-4 text-sm sm:text-base font-extrabold text-black shadow-neon hover:brightness-110 hover:scale-[1.02] transition-all"
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 w-16 bg-white/35 blur-sm kite-cta-shine"
                  />
                  <LogIn className="w-4 h-4 stroke-[2.5]" />
                  <span>Continue with Google — Launch kite</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5] transition-transform group-hover:translate-x-1" />
                </button>
              </div>

              <p className="text-[11px] text-white/45">
                Instant setup • Personal Supabase PostgreSQL with Row-Level
                Security • Free forever
              </p>
            </div>
          </div>
        </RevealSection>
      </section>

      {/* =====================================================================
          7. MINIMAL FOOTER
         ===================================================================== */}
      <footer className="border-t border-white/[0.08] bg-black/40 py-8 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/45">
          <div className="flex items-center gap-2">
            <KiteLogoMark className="w-4 h-4 text-primary" />
            <span className="font-bold text-white/80">kite</span>
            <span>— Autonomous AI Workspace &amp; Day Architect</span>
          </div>
          <div className="flex items-center gap-5">
            <a
              href="#interactive-demo"
              className="hover:text-white transition-colors"
            >
              Demo
            </a>
            <a
              href="#superpowers"
              className="hover:text-white transition-colors"
            >
              Features
            </a>
            <a
              href="#atmospheres"
              className="hover:text-white transition-colors"
            >
              Themes
            </a>
            <button
              type="button"
              onClick={onGoogleSignIn}
              className="text-highlight font-semibold hover:underline"
            >
              Sign in with Google →
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
