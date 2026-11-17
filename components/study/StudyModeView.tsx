"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  AIProvider,
  DEFAULT_NVIDIA_MODEL,
  NVIDIA_MODEL_OPTIONS,
  SavedStudyCourse,
  StudyAcademicLevel,
  StudyCheckpoint,
  StudyLessonTurn,
  StudyMCQOption,
  StudyModeStyle,
  StudySessionState,
  StudySyllabus,
  UserProfile,
  WorkspaceConfig,
  computeSyllabusProgress,
  normalizeSyllabusStates,
} from "@/types/taskit";
import { StudySyllabusSidebar } from "@/components/study/StudySyllabusSidebar";
import { StudyMarkdown } from "@/components/study/StudyMarkdown";
import { StudyVisualRenderer } from "@/components/study/StudyVisualRenderer";
import { StudyCheckpointCard } from "@/components/study/StudyCheckpointCard";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  FastForward,
  FileText,
  Folder,
  GraduationCap,
  HelpCircle,
  KeyRound,
  LayoutGrid,
  Loader2,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Play,
  Plus,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Trash2,
  Trophy,
  X,
  Zap,
} from "lucide-react";

const LOCAL_STUDY_SESSION_KEY = "flo_study_session_v1";

function makeLocalId(prefix = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const ACADEMIC_LEVELS: StudyAcademicLevel[] = [
  "College level",
  "High School / AP",
  "Graduate level",
  "Beginner friendly",
];

const STUDY_STYLE_TABS: Array<{
  id: StudyModeStyle;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "syllabus", label: "Syllabus", icon: FileText },
  { id: "full_course", label: "Full course", icon: GraduationCap },
  { id: "textbook", label: "Textbook", icon: BookOpen },
  { id: "practice_quiz", label: "Practice quiz", icon: CheckCircle2 },
];

const TRY_A_TOPIC_CHIPS = [
  {
    label: "Limits & Derivatives",
    prompt:
      "AP Calculus AB: Limit notation and graphical interpretation, one-sided limits, algebraic limit evaluation (factoring & conjugates), continuity, and the derivative power rule",
  },
  {
    label: "Behavioral economics",
    prompt:
      "Behavioral Economics: Prospect theory, loss aversion, cognitive biases, mental accounting, and intertemporal choice models",
  },
  {
    label: "Organic chemistry",
    prompt:
      "Organic Chemistry: Functional groups, hybridization & molecular geometry, stereochemistry (chirality & enantiomers), and SN1/SN2 substitution mechanisms",
  },
  {
    label: "Cellular respiration",
    prompt:
      "Cellular Respiration: Glycolysis, pyruvate oxidation, Citric Acid (Krebs) cycle, electron transport chain, and chemiosmosis ATP synthesis",
  },
];

interface StarterCourseTemplate {
  id: string;
  tag: string;
  code: string;
  symbol: string;
  bannerBg: string;
  bannerText: string;
  modeLabel: string;
  title: string;
  level: StudyAcademicLevel;
  prompt: string;
  upNext: string;
  moduleCount: number;
}

const STARTER_COURSE_TEMPLATES: StarterCourseTemplate[] = [
  {
    id: "starter-neuro",
    tag: "THE SCIENCE OF THE MIND",
    code: "FLO / 01",
    symbol: "Ψ",
    bannerBg:
      "linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(6, 78, 59, 0.35) 100%)",
    bannerText: "text-emerald-300",
    modeLabel: "COURSE",
    title: "Introduction to Neuroscience",
    level: "College level",
    prompt:
      "Introduction to Cognitive Neuroscience: Action potentials & resting membrane potential, synaptic transmission & neurotransmitters, neural circuits, and memory consolidation",
    upNext: "How neurons communicate via action potentials",
    moduleCount: 12,
  },
  {
    id: "starter-econ",
    tag: "IDEAS THAT SHAPE OUR WORLD",
    code: "FLO / 02",
    symbol: "Aa",
    bannerBg:
      "linear-gradient(135deg, rgba(168, 85, 247, 0.22) 0%, rgba(88, 28, 135, 0.35) 100%)",
    bannerText: "text-purple-300",
    modeLabel: "TEXTBOOK",
    title: "Principles of Microeconomics",
    level: "College level",
    prompt:
      "Principles of Microeconomics: Supply and demand equilibrium, price elasticity of demand, consumer & producer surplus, and market structures",
    upNext: "Supply, demand & market equilibrium",
    moduleCount: 10,
  },
  {
    id: "starter-calc",
    tag: "THE MATHEMATICS OF CHANGE",
    code: "FLO / 03",
    symbol: "∫",
    bannerBg:
      "linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, rgba(120, 53, 15, 0.35) 100%)",
    bannerText: "text-amber-300",
    modeLabel: "SYLLABUS",
    title: "Calculus: Limits & Continuity",
    level: "College level",
    prompt:
      "Calculus I — Limits & Continuity: Formal limit notation, graphical limits & one-sided limits, algebraic limit evaluation by factoring & rationalization, and continuity",
    upNext: "Limit notation & graphical interpretation",
    moduleCount: 9,
  },
];

const BANNER_THEMES = [
  {
    tag: "STRUCTURED MASTERY",
    symbol: "Ψ",
    bannerBg:
      "linear-gradient(135deg, rgba(16, 185, 129, 0.24) 0%, rgba(6, 78, 59, 0.38) 100%)",
    bannerText: "text-emerald-300",
    dotColor: "bg-emerald-400",
  },
  {
    tag: "CORE FOUNDATIONS",
    symbol: "Aa",
    bannerBg:
      "linear-gradient(135deg, rgba(168, 85, 247, 0.24) 0%, rgba(88, 28, 135, 0.38) 100%)",
    bannerText: "text-purple-300",
    dotColor: "bg-purple-400",
  },
  {
    tag: "ANALYTICAL SYSTEMS",
    symbol: "∫",
    bannerBg:
      "linear-gradient(135deg, rgba(245, 158, 11, 0.24) 0%, rgba(120, 53, 15, 0.38) 100%)",
    bannerText: "text-amber-300",
    dotColor: "bg-amber-400",
  },
  {
    tag: "DEEP EXPLORATION",
    symbol: "Ω",
    bannerBg:
      "linear-gradient(135deg, rgba(56, 189, 248, 0.24) 0%, rgba(12, 74, 110, 0.38) 100%)",
    bannerText: "text-sky-300",
    dotColor: "bg-sky-400",
  },
];

interface StudyModeViewProps {
  profile: UserProfile;
  workspaceConfig: WorkspaceConfig;
  hasApiKey: boolean;
  effectiveApiKey: string;
  onUpdateWorkspaceConfig: (updates: Partial<WorkspaceConfig>) => void;
  onOpenApiKeySetup: () => void;
  onShowToast: (msg: string) => void;
}

export const StudyModeView: React.FC<StudyModeViewProps> = ({
  profile,
  workspaceConfig,
  hasApiKey,
  effectiveApiKey,
  onUpdateWorkspaceConfig,
  onOpenApiKeySetup,
  onShowToast,
}) => {
  // Navigation state within flo: "overview" (Forma-style dashboard) vs "studio" (active lesson + editable syllabus)
  const [floSubView, setFloSubView] = useState<"overview" | "studio">(
    "overview"
  );
  const [topicInput, setTopicInput] = useState<string>("");
  const [referenceNotes, setReferenceNotes] = useState<string>("");
  const [showNotesInput, setShowNotesInput] = useState<boolean>(false);
  const [studyStyle, setStudyStyle] = useState<StudyModeStyle>("syllabus");
  const [academicLevel, setAcademicLevel] =
    useState<StudyAcademicLevel>("College level");
  const [levelDropdownOpen, setLevelDropdownOpen] = useState<boolean>(false);
  const [librarySearch, setLibrarySearch] = useState<string>("");

  const [syllabus, setSyllabus] = useState<StudySyllabus | null>(null);
  const [turns, setTurns] = useState<StudyLessonTurn[]>([]);
  const [sessionStarted, setSessionStarted] = useState<boolean>(false);
  const [savedCourses, setSavedCourses] = useState<SavedStudyCourse[]>([]);

  const [isGeneratingSyllabus, setIsGeneratingSyllabus] =
    useState<boolean>(false);
  const [isTutorThinking, setIsTutorThinking] = useState<boolean>(false);
  const [lastTutorError, setLastTutorError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState<string>("");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState<boolean>(false);
  const [geminiTier, setGeminiTier] = useState<"flash" | "pro">("flash");

  const hydratedRef = useRef<boolean>(false);
  const streamEndRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastTurnParamsRef = useRef<{
    currentSyllabus: StudySyllabus;
    actionType:
      | "start_or_continue"
      | "answer_checkpoint"
      | "chat_message"
      | "remediate";
    userMessage?: string;
    targetSubtopicId?: string;
    checkpointSubmission?: {
      checkpointId: string;
      subtopicId: string;
      questionType: "mcq" | "short_answer";
      question: string;
      selectedOptionId?: string;
      selectedOptionText?: string;
      isMcqCorrect?: boolean;
      shortAnswerText?: string;
    };
  } | null>(null);

  const activeProvider: AIProvider = workspaceConfig.aiProvider || "nvidia";
  const activeNvidiaModel =
    NVIDIA_MODEL_OPTIONS.find((m) => m.id === workspaceConfig.nvidiaModel)
      ?.id || DEFAULT_NVIDIA_MODEL;
  const activeModelMeta =
    NVIDIA_MODEL_OPTIONS.find((m) => m.id === activeNvidiaModel) ||
    NVIDIA_MODEL_OPTIONS[0];

  const activeModelLabel =
    activeProvider === "nvidia"
      ? activeModelMeta.shortName
      : geminiTier === "pro"
      ? "Gemini 1.5 Pro"
      : "Gemini 2.0 Flash";

  // 1. Hydrate Study Session from WorkspaceConfig or localStorage
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const hydrateFromState = (s: StudySessionState) => {
      if (s.syllabus) {
        setSyllabus(s.syllabus);
        setTurns(s.turns || []);
        setSessionStarted(Boolean(s.sessionStarted));
      }
      if (Array.isArray(s.savedCourses) && s.savedCourses.length > 0) {
        setSavedCourses(s.savedCourses);
      } else if (s.syllabus) {
        setSavedCourses([
          {
            id: s.syllabus.id,
            syllabus: s.syllabus,
            turns: s.turns || [],
            sessionStarted: Boolean(s.sessionStarted),
            updatedAt: s.updatedAt || new Date().toISOString(),
          },
        ]);
      }
    };

    if (workspaceConfig.studySession) {
      hydrateFromState(workspaceConfig.studySession);
      return;
    }

    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(LOCAL_STUDY_SESSION_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as StudySessionState;
          if (parsed) {
            hydrateFromState(parsed);
          }
        }
      } catch {}
    }
  }, [workspaceConfig.studySession]);

  // 2. Persist Study Session & Saved Courses Library
  const persistSession = useCallback(
    (
      nextSyllabus: StudySyllabus | null,
      nextTurns: StudyLessonTurn[],
      nextStarted: boolean,
      overrideCourses?: SavedStudyCourse[]
    ) => {
      const nowISO = new Date().toISOString();
      let updatedCourses = overrideCourses
        ? [...overrideCourses]
        : [...savedCourses];

      if (nextSyllabus) {
        const entry: SavedStudyCourse = {
          id: nextSyllabus.id,
          syllabus: nextSyllabus,
          turns: nextTurns.slice(-25),
          sessionStarted: nextStarted,
          updatedAt: nowISO,
        };
        const existingIdx = updatedCourses.findIndex(
          (c) => c.id === nextSyllabus.id
        );
        if (existingIdx !== -1) {
          updatedCourses[existingIdx] = entry;
        } else {
          updatedCourses = [entry, ...updatedCourses].slice(0, 12);
        }
        setSavedCourses(updatedCourses);
      }

      const stateToSave: StudySessionState = {
        syllabus: nextSyllabus,
        turns: nextTurns.slice(-25),
        sessionStarted: nextStarted,
        savedCourses: updatedCourses,
        updatedAt: nowISO,
      };

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            LOCAL_STUDY_SESSION_KEY,
            JSON.stringify(stateToSave)
          );
        } catch {}
      }

      onUpdateWorkspaceConfig({
        studySession: stateToSave,
      });
    },
    [savedCourses, onUpdateWorkspaceConfig]
  );

  // Scroll to newest lesson turn smoothly when in studio
  useEffect(() => {
    if (floSubView === "studio" && turns.length > 0) {
      streamEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [floSubView, turns.length, isTutorThinking]);

  const progress = computeSyllabusProgress(syllabus);

  // Total mastered subtopics across all courses for the bottom streak widget
  const totalMasteredAllCourses = useMemo(() => {
    let count = 0;
    for (const c of savedCourses) {
      const p = computeSyllabusProgress(c.syllabus);
      count += p.completedCount;
    }
    return count;
  }, [savedCourses]);

  // ===========================================================================
  // Core AI Tutor Turn Request
  // ===========================================================================
  const requestTutorTurn = useCallback(
    async (params: {
      currentSyllabus: StudySyllabus;
      actionType:
        | "start_or_continue"
        | "answer_checkpoint"
        | "chat_message"
        | "remediate";
      userMessage?: string;
      targetSubtopicId?: string;
      checkpointSubmission?: {
        checkpointId: string;
        subtopicId: string;
        questionType: "mcq" | "short_answer";
        question: string;
        selectedOptionId?: string;
        selectedOptionText?: string;
        isMcqCorrect?: boolean;
        shortAnswerText?: string;
      };
      appendUserBubble?: boolean;
      overrideProvider?: AIProvider;
      overrideNvidiaModel?: string;
      overrideGeminiTier?: "flash" | "pro";
      baseTurns?: StudyLessonTurn[];
    }) => {
      const {
        currentSyllabus,
        actionType,
        userMessage,
        targetSubtopicId,
        checkpointSubmission,
        appendUserBubble,
        overrideProvider,
        overrideNvidiaModel,
        overrideGeminiTier,
        baseTurns,
      } = params;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      lastTurnParamsRef.current = {
        currentSyllabus,
        actionType,
        userMessage,
        targetSubtopicId,
        checkpointSubmission,
      };

      setIsTutorThinking(true);
      setLastTutorError(null);

      let updatedTurns = baseTurns !== undefined ? [...baseTurns] : [...turns];
      if (appendUserBubble && userMessage?.trim()) {
        const userTurn: StudyLessonTurn = {
          id: makeLocalId("u"),
          role: "user",
          timestamp: new Date().toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          }),
          content: userMessage.trim(),
        };
        updatedTurns = [...updatedTurns, userTurn];
        setTurns(updatedTurns);
      }

      try {
        const providerToUse = overrideProvider || activeProvider;
        const nvidiaModelToUse = overrideNvidiaModel || activeNvidiaModel;
        const geminiModelToUse = overrideGeminiTier || geminiTier;

        const res = await fetch("/api/study", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            mode: "tutor_turn",
            syllabus: currentSyllabus,
            actionType,
            userMessage,
            targetSubtopicId,
            checkpointSubmission,
            tone: profile.ai_tone,
            aiProvider: providerToUse,
            nvidiaModel: nvidiaModelToUse,
            geminiModel: geminiModelToUse,
            workspaceConfig: {
              ...workspaceConfig,
              aiProvider: providerToUse,
              nvidiaModel: nvidiaModelToUse,
            },
            customApiKey: effectiveApiKey,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.turn) {
          const errMsg =
            data.message ||
            data.error ||
            "Could not load micro-lesson. Try switching models below.";
          setLastTutorError(errMsg);
          onShowToast(errMsg);
          return;
        }

        const returnedSyllabus: StudySyllabus =
          data.syllabus || currentSyllabus;
        const assistantTurn: StudyLessonTurn = data.turn;

        if (
          actionType === "answer_checkpoint" &&
          checkpointSubmission &&
          assistantTurn.evaluationResult
        ) {
          updatedTurns = updatedTurns.map((t) => {
            if (
              t.checkpoint &&
              t.checkpoint.id === checkpointSubmission.checkpointId
            ) {
              return {
                ...t,
                checkpoint: {
                  ...t.checkpoint,
                  userShortAnswer: checkpointSubmission.shortAnswerText || "",
                  isAnswered: true,
                  isCorrect: assistantTurn.evaluationResult?.passed ?? false,
                  aiFeedback: assistantTurn.evaluationResult?.feedback || null,
                },
              };
            }
            return t;
          });
        }

        const finalTurns = [...updatedTurns, assistantTurn];
        setSyllabus(returnedSyllabus);
        setTurns(finalTurns);
        setSessionStarted(true);
        persistSession(returnedSyllabus, finalTurns, true);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        console.error("[StudyModeView] Tutor turn error:", err);
        setLastTutorError(
          "Connection timed out or interrupted. Switch to a faster model below to retry immediately."
        );
      } finally {
        if (abortControllerRef.current === controller) {
          setIsTutorThinking(false);
        }
      }
    },
    [
      turns,
      activeProvider,
      activeNvidiaModel,
      geminiTier,
      profile.ai_tone,
      workspaceConfig,
      effectiveApiKey,
      onShowToast,
      persistSession,
    ]
  );

  // Switch model and optionally retry in-flight or failed turn immediately
  const handleSelectModel = (
    provider: AIProvider,
    nvidiaModelId?: string,
    gemTier?: "flash" | "pro",
    retryNow = false
  ) => {
    const nextNvidia = nvidiaModelId || activeNvidiaModel;
    const nextGem = gemTier || geminiTier;
    if (gemTier) setGeminiTier(gemTier);

    onUpdateWorkspaceConfig({
      aiProvider: provider,
      nvidiaModel: nextNvidia,
    });
    setModelDropdownOpen(false);

    const label =
      provider === "nvidia"
        ? NVIDIA_MODEL_OPTIONS.find((m) => m.id === nextNvidia)?.shortName ||
          nextNvidia
        : nextGem === "pro"
        ? "Gemini 1.5 Pro"
        : "Gemini 2.0 Flash";

    onShowToast(`Switched flo model to ${label}`);

    if ((isTutorThinking || retryNow || lastTutorError) && syllabus) {
      const retryParams = lastTurnParamsRef.current || {
        currentSyllabus: syllabus,
        actionType: "start_or_continue" as const,
      };
      requestTutorTurn({
        ...retryParams,
        overrideProvider: provider,
        overrideNvidiaModel: nextNvidia,
        overrideGeminiTier: nextGem,
        appendUserBubble: false,
      });
    }
  };

  // ===========================================================================
  // Topic Ingestion & Syllabus Generation
  // ===========================================================================
  const handleGenerateSyllabus = async (
    autoStartFirstLesson = true,
    overrideTopic?: string,
    overrideLevel?: StudyAcademicLevel
  ) => {
    const query = (overrideTopic ?? topicInput).trim();
    if (!query || isGeneratingSyllabus) return;

    setIsGeneratingSyllabus(true);
    setLastTutorError(null);
    try {
      const res = await fetch("/api/study", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "generate_syllabus",
          topicInput: query,
          academicLevel: overrideLevel || academicLevel,
          studyStyle,
          referenceNotes,
          tone: profile.ai_tone,
          aiProvider: activeProvider,
          nvidiaModel: activeNvidiaModel,
          geminiModel: geminiTier,
          workspaceConfig,
          customApiKey: effectiveApiKey,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.syllabus) {
        onShowToast(data.error || "Could not generate study syllabus.");
        return;
      }

      const generatedSyllabus: StudySyllabus = data.syllabus;
      setSyllabus(generatedSyllabus);
      setTurns([]);
      setFloSubView("studio");
      setTopicInput("");

      if (autoStartFirstLesson) {
        setSessionStarted(true);
        persistSession(generatedSyllabus, [], true);
        setIsGeneratingSyllabus(false);
        await requestTutorTurn({
          currentSyllabus: generatedSyllabus,
          actionType: "start_or_continue",
          baseTurns: [],
        });
      } else {
        setSessionStarted(false);
        persistSession(generatedSyllabus, [], false);
        onShowToast(
          "Syllabus ready! Customize your modules on the left or click Start Micro-Lesson 1."
        );
      }
    } catch (err) {
      console.error("[StudyModeView] Syllabus generation error:", err);
      onShowToast("Failed to generate syllabus.");
    } finally {
      setIsGeneratingSyllabus(false);
    }
  };

  // Open an existing saved course from "Continue learning" or left sidebar
  const handleOpenSavedCourse = (course: SavedStudyCourse) => {
    setSyllabus(course.syllabus);
    setTurns(course.turns || []);
    setSessionStarted(Boolean(course.sessionStarted));
    setFloSubView("studio");

    // If course has no turns yet, automatically start Lesson 1
    if (!course.turns || course.turns.length === 0) {
      setSessionStarted(true);
      requestTutorTurn({
        currentSyllabus: course.syllabus,
        actionType: "start_or_continue",
        baseTurns: [],
      });
    }
  };

  const handleDeleteSavedCourse = (courseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextCourses = savedCourses.filter((c) => c.id !== courseId);
    setSavedCourses(nextCourses);
    const nextActive =
      syllabus?.id === courseId ? nextCourses[0]?.syllabus || null : syllabus;
    const nextTurns =
      syllabus?.id === courseId ? nextCourses[0]?.turns || [] : turns;
    setSyllabus(nextActive);
    setTurns(nextTurns);
    persistSession(nextActive, nextTurns, Boolean(nextActive), nextCourses);
    onShowToast("Removed course from library");
  };

  // ===========================================================================
  // Interactive Syllabus Mutations (Sidebar & Active Lesson Controls)
  // ===========================================================================
  const updateSyllabusState = (
    mutator: (prev: StudySyllabus) => StudySyllabus,
    toastText?: string,
    autoTeachIfActiveChanged = false
  ) => {
    if (!syllabus) return;
    const prevActiveId = computeSyllabusProgress(syllabus).activeSubtopic?.id;
    const rawNext = mutator(syllabus);
    const normalized = normalizeSyllabusStates(rawNext);
    const nextProgress = computeSyllabusProgress(normalized);

    setSyllabus(normalized);
    persistSession(normalized, turns, sessionStarted);
    if (toastText) onShowToast(toastText);

    if (
      autoTeachIfActiveChanged &&
      sessionStarted &&
      nextProgress.activeSubtopic &&
      nextProgress.activeSubtopic.id !== prevActiveId
    ) {
      requestTutorTurn({
        currentSyllabus: normalized,
        actionType: "start_or_continue",
        targetSubtopicId: nextProgress.activeSubtopic.id,
      });
    }
  };

  const handleRenameModule = (moduleId: string, newTitle: string) => {
    updateSyllabusState(
      (prev) => ({
        ...prev,
        modules: prev.modules.map((m) =>
          m.id === moduleId ? { ...m, title: newTitle } : m
        ),
      }),
      "Renamed module"
    );
  };

  const handleDeleteModule = (moduleId: string) => {
    updateSyllabusState(
      (prev) => ({
        ...prev,
        modules: prev.modules.filter((m) => m.id !== moduleId),
      }),
      "Removed module from active curriculum",
      true
    );
  };

  const handleMoveModule = (moduleId: string, direction: "up" | "down") => {
    updateSyllabusState((prev) => {
      const idx = prev.modules.findIndex((m) => m.id === moduleId);
      if (idx === -1) return prev;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.modules.length) return prev;
      const copy = [...prev.modules];
      const [moved] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, moved);
      return { ...prev, modules: copy };
    });
  };

  const handleAddModule = (title: string) => {
    updateSyllabusState(
      (prev) => ({
        ...prev,
        modules: [
          ...prev.modules,
          {
            id: makeLocalId("mod"),
            title,
            description: `Custom module on ${title}`,
            subtopics: [
              {
                id: makeLocalId("sub"),
                title: `${title}: Core Concepts & Examples`,
                description: `Foundational overview and worked examples for ${title}`,
                estimatedMinutes: 8,
                state: "locked",
              },
            ],
          },
        ],
      }),
      `Added module "${title}"`
    );
  };

  const handleRenameSubtopic = (
    moduleId: string,
    subtopicId: string,
    newTitle: string
  ) => {
    updateSyllabusState(
      (prev) => ({
        ...prev,
        modules: prev.modules.map((m) =>
          m.id === moduleId
            ? {
                ...m,
                subtopics: m.subtopics.map((s) =>
                  s.id === subtopicId ? { ...s, title: newTitle } : s
                ),
              }
            : m
        ),
      }),
      "Renamed subtopic"
    );
  };

  const handleDeleteSubtopic = (moduleId: string, subtopicId: string) => {
    updateSyllabusState(
      (prev) => ({
        ...prev,
        modules: prev.modules
          .map((m) =>
            m.id === moduleId
              ? {
                  ...m,
                  subtopics: m.subtopics.filter((s) => s.id !== subtopicId),
                }
              : m
          )
          .filter((m) => m.subtopics.length > 0),
      }),
      "Removed subtopic from curriculum",
      true
    );
  };

  const handleMoveSubtopic = (
    moduleId: string,
    subtopicId: string,
    direction: "up" | "down"
  ) => {
    updateSyllabusState((prev) => ({
      ...prev,
      modules: prev.modules.map((m) => {
        if (m.id !== moduleId) return m;
        const idx = m.subtopics.findIndex((s) => s.id === subtopicId);
        if (idx === -1) return m;
        const targetIdx = direction === "up" ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= m.subtopics.length) return m;
        const copy = [...m.subtopics];
        const [moved] = copy.splice(idx, 1);
        copy.splice(targetIdx, 0, moved);
        return { ...m, subtopics: copy };
      }),
    }));
  };

  const handleReorderSubtopicDrag = (
    moduleId: string,
    fromIndex: number,
    toIndex: number
  ) => {
    updateSyllabusState((prev) => ({
      ...prev,
      modules: prev.modules.map((m) => {
        if (m.id !== moduleId) return m;
        const copy = [...m.subtopics];
        const [moved] = copy.splice(fromIndex, 1);
        copy.splice(toIndex, 0, moved);
        return { ...m, subtopics: copy };
      }),
    }));
  };

  const handleAddSubtopic = (moduleId: string, title: string) => {
    updateSyllabusState(
      (prev) => ({
        ...prev,
        modules: prev.modules.map((m) =>
          m.id === moduleId
            ? {
                ...m,
                subtopics: [
                  ...m.subtopics,
                  {
                    id: makeLocalId("sub"),
                    title,
                    description: `Custom micro-lesson on ${title}`,
                    estimatedMinutes: 8,
                    state: "locked",
                  },
                ],
              }
            : m
        ),
      }),
      `Added subtopic "${title}"`
    );
  };

  const handleToggleSkipKnown = (subtopicId: string) => {
    if (!syllabus) return;
    const prevActiveId = computeSyllabusProgress(syllabus).activeSubtopic?.id;
    let markedKnown = false;

    const updated: StudySyllabus = {
      ...syllabus,
      modules: syllabus.modules.map((m) => ({
        ...m,
        subtopics: m.subtopics.map((s) => {
          if (s.id !== subtopicId) return s;
          if (s.state === "skipped_known") {
            return { ...s, state: "locked" };
          }
          markedKnown = true;
          return { ...s, state: "skipped_known" };
        }),
      })),
    };

    const normalized = normalizeSyllabusStates(updated);
    const nextProgress = computeSyllabusProgress(normalized);
    setSyllabus(normalized);
    persistSession(normalized, turns, sessionStarted);

    onShowToast(
      markedKnown
        ? "Marked subtopic as Already Known — progress updated!"
        : "Restored subtopic to active curriculum."
    );

    if (
      markedKnown &&
      sessionStarted &&
      subtopicId === prevActiveId &&
      nextProgress.activeSubtopic
    ) {
      requestTutorTurn({
        currentSyllabus: normalized,
        actionType: "start_or_continue",
        targetSubtopicId: nextProgress.activeSubtopic.id,
      });
    }
  };

  const handleSelectActiveSubtopic = (subtopicId: string) => {
    if (!syllabus) return;
    const reopened: StudySyllabus = {
      ...syllabus,
      modules: syllabus.modules.map((m) => ({
        ...m,
        subtopics: m.subtopics.map((s) => {
          if (s.id === subtopicId) {
            return { ...s, state: "in_progress" };
          }
          if (s.state === "in_progress") {
            return { ...s, state: "locked" };
          }
          return s;
        }),
      })),
    };
    const normalized = normalizeSyllabusStates(reopened, subtopicId);
    setSyllabus(normalized);
    setSessionStarted(true);
    setMobileDrawerOpen(false);
    persistSession(normalized, turns, true);

    requestTutorTurn({
      currentSyllabus: normalized,
      actionType: "start_or_continue",
      targetSubtopicId: subtopicId,
    });
  };

  // ===========================================================================
  // Checkpoint Handlers (MCQ & Short-Answer)
  // ===========================================================================
  const handleSelectMcqOption = (
    checkpoint: StudyCheckpoint,
    option: StudyMCQOption
  ) => {
    if (!syllabus || isTutorThinking) return;

    const nextTurns = turns.map((t) => {
      if (t.checkpoint && t.checkpoint.id === checkpoint.id) {
        return {
          ...t,
          checkpoint: {
            ...t.checkpoint,
            userSelectedOptionId: option.id,
            isAnswered: true,
            isCorrect: option.isCorrect,
          },
        };
      }
      return t;
    });
    setTurns(nextTurns);

    if (option.isCorrect) {
      const updatedSyllabus = normalizeSyllabusStates({
        ...syllabus,
        modules: syllabus.modules.map((m) => ({
          ...m,
          subtopics: m.subtopics.map((s) =>
            s.id === checkpoint.subtopicId ? { ...s, state: "mastered" } : s
          ),
        })),
      });
      setSyllabus(updatedSyllabus);
      persistSession(updatedSyllabus, nextTurns, true);
      onShowToast("Subtopic mastered! Loading next micro-lesson...");

      const nextProg = computeSyllabusProgress(updatedSyllabus);
      if (nextProg.activeSubtopic && !nextProg.isComplete) {
        requestTutorTurn({
          currentSyllabus: updatedSyllabus,
          actionType: "start_or_continue",
          targetSubtopicId: nextProg.activeSubtopic.id,
          baseTurns: nextTurns,
        });
      }
    } else {
      persistSession(syllabus, nextTurns, true);
      requestTutorTurn({
        currentSyllabus: syllabus,
        actionType: "remediate",
        checkpointSubmission: {
          checkpointId: checkpoint.id,
          subtopicId: checkpoint.subtopicId,
          questionType: "mcq",
          question: checkpoint.question,
          selectedOptionId: option.id,
          selectedOptionText: option.text,
          isMcqCorrect: false,
        },
        baseTurns: nextTurns,
      });
    }
  };

  const handleSubmitShortAnswer = (
    checkpoint: StudyCheckpoint,
    answerText: string
  ) => {
    if (!syllabus || isTutorThinking) return;
    requestTutorTurn({
      currentSyllabus: syllabus,
      actionType: "answer_checkpoint",
      userMessage: answerText,
      checkpointSubmission: {
        checkpointId: checkpoint.id,
        subtopicId: checkpoint.subtopicId,
        questionType: "short_answer",
        question: checkpoint.question,
        shortAnswerText: answerText,
      },
      appendUserBubble: true,
    });
  };

  const handleSendChatMessage = (overrideText?: string) => {
    const text = (overrideText ?? chatInput).trim();
    if (!text || !syllabus || isTutorThinking) return;
    if (overrideText === undefined) {
      setChatInput("");
    }
    requestTutorTurn({
      currentSyllabus: syllabus,
      actionType: "chat_message",
      userMessage: text,
      appendUserBubble: true,
    });
  };

  // ===========================================================================
  // Reusable Model Selector Dropdown
  // ===========================================================================
  const ModelSelectorDropdown = (
    <div className="relative">
      <button
        type="button"
        onClick={() => setModelDropdownOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/90 hover:border-primary/50 hover:text-white transition-all"
        title="Choose AI Tutor Model (NVIDIA NIM or Google Gemini)"
      >
        <Cpu className="h-3.5 w-3.5 text-primary" />
        <span className="truncate max-w-[135px]">{activeModelLabel}</span>
        <ChevronDown className="h-3 w-3 text-white/55" />
      </button>

      {modelDropdownOpen && (
        <div
          className="absolute right-0 mt-2 w-80 max-h-[420px] overflow-y-auto rounded-2xl border border-white/20 bg-[#14161c]/95 p-2.5 shadow-2xl backdrop-blur-2xl z-50 space-y-2.5"
          onMouseLeave={() => setModelDropdownOpen(false)}
        >
          <div className="px-2 py-1 flex items-center justify-between border-b border-white/10">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
              NVIDIA NIM Models (Fastest First)
            </span>
            <span className="text-[10px] text-white/50">Click to switch</span>
          </div>

          <div className="space-y-1">
            {NVIDIA_MODEL_OPTIONS.map((m) => {
              const isSelected =
                activeProvider === "nvidia" && activeNvidiaModel === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() =>
                    handleSelectModel("nvidia", m.id, undefined, true)
                  }
                  className={`w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left transition-colors ${
                    isSelected
                      ? "bg-primary/25 border border-primary/50 text-white"
                      : "hover:bg-white/10 text-zinc-200"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white truncate">
                        {m.name}
                      </span>
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-highlight shrink-0">
                        {m.badge}
                      </span>
                    </div>
                    <div className="text-[10px] text-white/55 truncate">
                      {m.provider} • {m.desc}
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-1 border-t border-white/10 space-y-1">
            <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-sky-400">
              Google Gemini Models
            </div>
            {(["flash", "pro"] as const).map((tier) => {
              const isSelected =
                activeProvider === "gemini" && geminiTier === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() =>
                    handleSelectModel("gemini", undefined, tier, true)
                  }
                  className={`w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left transition-colors ${
                    isSelected
                      ? "bg-primary/25 border border-primary/50 text-white"
                      : "hover:bg-white/10 text-zinc-200"
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-white">
                      {tier === "flash"
                        ? "Gemini 2.0 Flash"
                        : "Gemini 1.5 Pro"}
                    </div>
                    <div className="text-[10px] text-white/55">
                      {tier === "flash"
                        ? "Low-latency multimodal tutor"
                        : "Deep reasoning & complex STEM derivations"}
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // Filter saved courses by search query
  const filteredSavedCourses = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    if (!q) return savedCourses;
    return savedCourses.filter(
      (c) =>
        c.syllabus.title.toLowerCase().includes(q) ||
        c.syllabus.topicQuery.toLowerCase().includes(q)
    );
  }, [savedCourses, librarySearch]);

  // Fill out the 3-card "Continue learning" grid with starter templates if user has fewer than 3 saved courses
  const visibleStarterCards = useMemo(() => {
    const needed = Math.max(0, 3 - filteredSavedCourses.length);
    return STARTER_COURSE_TEMPLATES.slice(0, needed);
  }, [filteredSavedCourses.length]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start min-h-[calc(100vh-5.5rem)]">
      {/* =====================================================================
          LEFT NAVIGATION SIDEBAR (Forma-style "flo" Learning Space Sidebar)
         ===================================================================== */}
      <aside className="hidden lg:flex lg:col-span-3 xl:col-span-2 flex-col justify-between rounded-3xl border theme-panel p-4 backdrop-blur-2xl min-h-[calc(100vh-6rem)] sticky top-20">
        <div className="space-y-6">
          {/* Top Brand Identity: "f flo" */}
          <div className="flex items-center gap-2.5 px-2 pt-1">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg font-serif text-lg italic font-bold text-black shadow-md"
              style={{ backgroundColor: "var(--primary)" }}
            >
              f
            </div>
            <span className="font-serif text-xl font-bold tracking-tight text-white">
              flo
            </span>
          </div>

          {/* Section 1: YOUR LEARNING SPACE */}
          <div className="space-y-1">
            <div className="px-2.5 pb-1.5 text-[10px] font-mono font-bold uppercase tracking-widest text-white/45">
              YOUR LEARNING SPACE
            </div>

            <button
              type="button"
              onClick={() => setFloSubView("overview")}
              className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                floSubView === "overview"
                  ? "bg-primary/20 text-white border border-primary/40 shadow-sm"
                  : "text-white/70 hover:bg-white/5 hover:text-white border border-transparent"
              }`}
            >
              <LayoutGrid className="h-4 w-4 text-primary" />
              <span>Overview</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (syllabus) {
                  setFloSubView("studio");
                } else {
                  const el = document.getElementById("flo-study-topic-input");
                  el?.focus();
                }
              }}
              className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                floSubView === "studio"
                  ? "bg-primary/20 text-white border border-primary/40 shadow-sm"
                  : "text-white/70 hover:bg-white/5 hover:text-white border border-transparent"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>AI studio</span>
              </span>
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase text-highlight">
                NEW
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setFloSubView("overview");
                const el = document.getElementById("flo-continue-learning");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-white/70 hover:bg-white/5 hover:text-white transition-all"
            >
              <BookOpen className="h-4 w-4 text-white/55" />
              <span>My library</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (syllabus) {
                  setFloSubView("studio");
                } else {
                  onShowToast("Generate or select a course below to view its syllabus");
                }
              }}
              className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-white/70 hover:bg-white/5 hover:text-white transition-all"
            >
              <Folder className="h-4 w-4 text-white/55" />
              <span>Master syllabus</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (syllabus) {
                  setFloSubView("studio");
                } else {
                  const el = document.getElementById("flo-study-topic-input");
                  el?.focus();
                }
              }}
              className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-white/70 hover:bg-white/5 hover:text-white transition-all"
            >
              <Calendar className="h-4 w-4 text-white/55" />
              <span>Study planner</span>
            </button>
          </div>

          {/* Section 2: YOUR COLLECTIONS / COURSES */}
          <div className="space-y-1.5">
            <div className="px-2.5 pb-1 text-[10px] font-mono font-bold uppercase tracking-widest text-white/45">
              YOUR COLLECTIONS
            </div>

            {savedCourses.length > 0 ? (
              savedCourses.slice(0, 5).map((c, idx) => {
                const theme = BANNER_THEMES[idx % BANNER_THEMES.length];
                const isCurrent =
                  syllabus?.id === c.id && floSubView === "studio";
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleOpenSavedCourse(c)}
                    className={`w-full flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-xs transition-colors ${
                      isCurrent
                        ? "bg-white/10 text-white font-semibold"
                        : "text-white/65 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-xs shrink-0 ${theme.dotColor}`}
                    />
                    <span className="truncate">{c.syllabus.title}</span>
                  </button>
                );
              })
            ) : (
              <>
                {STARTER_COURSE_TEMPLATES.map((st, idx) => {
                  const theme = BANNER_THEMES[idx % BANNER_THEMES.length];
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() =>
                        handleGenerateSyllabus(true, st.prompt, st.level)
                      }
                      className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left text-xs text-white/65 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <span
                        className={`h-2 w-2 rounded-xs shrink-0 ${theme.dotColor}`}
                      />
                      <span className="truncate">{st.title}</span>
                    </button>
                  );
                })}
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setFloSubView("overview");
                setTimeout(() => {
                  document.getElementById("flo-study-topic-input")?.focus();
                }, 50);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-white/45 hover:text-highlight transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New collection</span>
            </button>
          </div>
        </div>

        {/* Bottom Sidebar Card ("Room to grow.") */}
        <div className="space-y-3 pt-6">
          <div className="rounded-2xl border border-primary/25 bg-primary/[0.08] p-4 space-y-2.5">
            <Sparkles className="h-4 w-4 text-primary" />
            <div className="font-serif text-base font-semibold text-white">
              Room to grow.
            </div>
            <p className="text-[11px] text-white/65 leading-relaxed">
              More ideas. Fewer limits. Unlock your full potential with
              step-by-step interactive mastery.
            </p>
            <button
              type="button"
              onClick={() => {
                if (syllabus) {
                  setFloSubView("studio");
                } else {
                  document.getElementById("flo-study-topic-input")?.focus();
                }
              }}
              className="w-full inline-flex items-center justify-between rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-black hover:brightness-110 transition-all shadow-sm"
            >
              <span>{syllabus ? "Resume Studio" : "Start Learning"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setModelDropdownOpen((v) => !v)}
            className="flex items-center gap-2 px-2 text-[11px] text-white/50 hover:text-white transition-colors"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Help &amp; getting started</span>
          </button>
        </div>
      </aside>

      {/* =====================================================================
          RIGHT MAIN WORKSPACE COLUMN
         ===================================================================== */}
      <div className="lg:col-span-9 xl:col-span-10 space-y-6">
        {/* Top Workspace Header Row (Breadcrumb + Library Search + Model Selector + Profile) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setFloSubView("overview")}
              className="text-white/50 hover:text-white transition-colors"
            >
              Workspace
            </button>
            <span className="text-white/30">/</span>
            <button
              type="button"
              onClick={() => setFloSubView("overview")}
              className={`font-semibold transition-colors ${
                floSubView === "overview"
                  ? "text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Overview
            </button>
            {floSubView === "studio" && syllabus && (
              <>
                <span className="text-white/30">/</span>
                <span className="font-bold text-highlight truncate max-w-[200px] sm:max-w-xs">
                  {syllabus.title}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search Your Library Bar */}
            <div className="relative hidden sm:flex items-center">
              <Search className="absolute left-3 h-3.5 w-3.5 text-white/40 pointer-events-none" />
              <input
                type="text"
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                placeholder="Search your library..."
                className="w-48 md:w-64 rounded-full border border-white/12 bg-black/40 pl-8 pr-10 py-1.5 text-xs text-white placeholder:text-white/40 focus:border-primary focus:outline-none"
              />
              <span className="absolute right-3 font-mono text-[10px] text-white/35 pointer-events-none">
                ⌘K
              </span>
            </div>

            {/* Live AI Model Selector */}
            {ModelSelectorDropdown}

            {/* User Workspace Badge */}
            <div className="hidden xl:flex flex-col text-right pl-2 border-l border-white/10">
              <span className="text-xs font-semibold text-white leading-tight truncate max-w-[130px]">
                {profile.full_name || profile.email || "Scholar"}
              </span>
              <span className="text-[10px] text-white/45 leading-tight">
                Personal workspace
              </span>
            </div>
          </div>
        </div>

        {/* ===================================================================
            VIEW 1: FORMA-STYLE "flo" OVERVIEW DASHBOARD
           =================================================================== */}
        {floSubView === "overview" ? (
          <div className="space-y-8 pb-8">
            {/* 1. Hero Greeting & Streak Row */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1.5">
                <h1 className="font-serif text-2xl sm:text-4xl font-normal tracking-tight text-white">
                  A little curiosity goes a long way.
                </h1>
                <p className="text-xs sm:text-sm text-white/60">
                  Pick up where you left off, or learn something entirely new.
                </p>
              </div>

              {/* Streak Badge Card */}
              <div className="flex items-center gap-3.5 rounded-2xl border theme-panel px-5 py-3 backdrop-blur-xl">
                <span className="font-serif text-3xl font-normal text-highlight leading-none">
                  {Math.max(1, savedCourses.length)}
                </span>
                <div className="leading-tight">
                  <div className="text-xs font-bold text-white">day streak</div>
                  <div className="text-[11px] text-white/55">
                    Keep the momentum going
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Centerpiece Card: "What do you want to learn?" */}
            <div className="rounded-3xl border-2 border-primary/50 theme-panel p-5 sm:p-7 shadow-2xl backdrop-blur-2xl space-y-5">
              {/* Card Header */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary/35 bg-primary/15">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-serif text-xl sm:text-2xl font-normal text-white">
                      What do you want to learn?
                    </h2>
                    <p className="text-xs text-white/60">
                      From a spark of interest to a structured learning journey.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-primary/15 px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-highlight">
                    <Sparkles className="h-3 w-3 text-primary" />
                    AI POWERED
                  </span>
                </div>
              </div>

              {!hasApiKey && (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-400/35 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-amber-400 shrink-0" />
                    <span>
                      Connect your free NVIDIA NIM or Google Gemini API key for
                      live AI tutoring.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenApiKeySetup}
                    className="rounded-lg bg-amber-400 px-3 py-1 font-bold text-black hover:brightness-110 shrink-0"
                  >
                    Configure Key
                  </button>
                </div>
              )}

              {/* Mode Selector Tabs Row (Syllabus, Full course, Textbook, Practice quiz) */}
              <div className="flex flex-wrap items-center gap-2">
                {STUDY_STYLE_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isSelected = studyStyle === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStudyStyle(tab.id)}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
                        isSelected
                          ? "bg-primary text-black shadow-neon font-bold"
                          : "border border-white/12 bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Unified Input Box with Embedded Footer Bar */}
              <div className="rounded-2xl border border-white/15 bg-black/45 p-4 focus-within:border-primary/60 transition-colors space-y-3">
                <textarea
                  id="flo-study-topic-input"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value.slice(0, 2000))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleGenerateSyllabus(true);
                    }
                  }}
                  rows={3}
                  placeholder="e.g. A 12-week introduction to cognitive neuroscience, from neurons to memory..."
                  className="w-full resize-none bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none leading-relaxed"
                />

                {/* Optional Expandable Reference Notes Area */}
                {showNotesInput && (
                  <div className="pt-2 border-t border-white/10 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-white/60">
                      <span>Paste syllabus notes or reference material:</span>
                      <button
                        type="button"
                        onClick={() => setShowNotesInput(false)}
                        className="text-white/45 hover:text-white"
                      >
                        Hide
                      </button>
                    </div>
                    <textarea
                      value={referenceNotes}
                      onChange={(e) => setReferenceNotes(e.target.value)}
                      rows={2}
                      placeholder="Paste lecture syllabus, textbook chapters, or specific formulas you want covered..."
                      className="w-full rounded-xl border border-white/10 bg-black/40 p-2.5 text-xs text-white placeholder:text-white/30 focus:border-primary focus:outline-none"
                    />
                  </div>
                )}

                {/* Bottom Bar inside Input Box */}
                <div className="flex items-center justify-between pt-1 text-xs text-white/50">
                  <button
                    type="button"
                    onClick={() => setShowNotesInput((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-white/60 hover:text-highlight transition-colors"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    <span>
                      {referenceNotes
                        ? "Reference material attached ✓"
                        : "Add your notes or reference material"}
                    </span>
                  </button>

                  <span className="font-mono text-[11px] text-white/40">
                    {topicInput.length} / 2,000
                  </span>
                </div>
              </div>

              {/* Bottom Controls Row: Academic Level Dropdown + "Try a topic:" Chips + "Generate syllabus →" Button */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Academic Level Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setLevelDropdownOpen((v) => !v)}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-white hover:border-primary/40 transition-colors"
                    >
                      <GraduationCap className="h-3.5 w-3.5 text-primary" />
                      <span>{academicLevel}</span>
                      <ChevronDown className="h-3.5 w-3.5 text-white/50" />
                    </button>

                    {levelDropdownOpen && (
                      <div
                        className="absolute left-0 mt-1.5 w-48 rounded-xl border border-white/20 bg-[#14161c]/95 p-1.5 shadow-2xl backdrop-blur-xl z-40"
                        onMouseLeave={() => setLevelDropdownOpen(false)}
                      >
                        {ACADEMIC_LEVELS.map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => {
                              setAcademicLevel(lvl);
                              setLevelDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                              academicLevel === lvl
                                ? "bg-primary/20 text-highlight font-semibold"
                                : "text-white/75 hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            <span>{lvl}</span>
                            {academicLevel === lvl && (
                              <Check className="h-3.5 w-3.5 text-primary" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* "Try a topic:" Quick Chips */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-white/45 px-1">
                      Try a topic:
                    </span>
                    {TRY_A_TOPIC_CHIPS.map((chip, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setTopicInput(chip.prompt)}
                        className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-xs text-white/80 hover:border-primary/45 hover:bg-primary/15 hover:text-white transition-all"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right: Generate Syllabus CTA */}
                <button
                  type="button"
                  disabled={!topicInput.trim() || isGeneratingSyllabus}
                  onClick={() => handleGenerateSyllabus(true)}
                  className="inline-flex items-center gap-2.5 rounded-xl bg-primary px-5 py-2.5 text-xs sm:text-sm font-bold text-black hover:brightness-110 transition-all shadow-neon disabled:opacity-40 shrink-0"
                >
                  {isGeneratingSyllabus ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Generating ({activeModelLabel})...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>
                        {studyStyle === "full_course"
                          ? "Generate course"
                          : studyStyle === "textbook"
                          ? "Generate textbook"
                          : studyStyle === "practice_quiz"
                          ? "Generate practice"
                          : "Generate syllabus"}
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 3. "Continue learning" 3-Column Course Cards Grid */}
            <div id="flo-continue-learning" className="space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <h3 className="font-serif text-xl sm:text-2xl font-normal text-white">
                    Continue learning
                  </h3>
                  <p className="text-xs text-white/55">
                    Your next discovery is waiting.
                  </p>
                </div>

                {syllabus && (
                  <button
                    type="button"
                    onClick={() => setFloSubView("studio")}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-highlight hover:underline"
                  >
                    <span>Open active studio</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* User's Saved/Active Courses */}
                {filteredSavedCourses.slice(0, 6).map((course, idx) => {
                  const prog = computeSyllabusProgress(course.syllabus);
                  const banner = BANNER_THEMES[idx % BANNER_THEMES.length];
                  const modeUpper = (
                    course.syllabus.studyStyle || "COURSE"
                  )
                    .replace("_", " ")
                    .toUpperCase();

                  return (
                    <div
                      key={course.id}
                      onClick={() => handleOpenSavedCourse(course)}
                      className="group cursor-pointer rounded-2xl border theme-panel overflow-hidden transition-all hover:border-primary/50 hover:-translate-y-0.5 shadow-lg flex flex-col justify-between"
                    >
                      {/* Top Artistic Banner */}
                      <div
                        className="relative h-24 px-4 py-3 flex flex-col justify-between border-b border-white/10"
                        style={{ background: banner.bannerBg }}
                      >
                        <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-white/70">
                          {banner.tag}
                        </span>
                        <span className="text-[9px] font-mono uppercase tracking-widest text-white/55">
                          FLO / {String(idx + 1).padStart(2, "0")}
                        </span>
                        <span
                          className={`absolute right-4 bottom-1 font-serif text-5xl font-normal select-none opacity-80 ${banner.bannerText}`}
                        >
                          {banner.symbol}
                        </span>
                      </div>

                      {/* Card Body */}
                      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-white/50">
                            <span>{modeUpper}</span>
                            <button
                              type="button"
                              onClick={(e) =>
                                handleDeleteSavedCourse(course.id, e)
                              }
                              className="rounded p-1 text-white/40 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
                              title="Remove course"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>

                          <h4 className="font-serif text-base font-semibold text-white group-hover:text-highlight transition-colors line-clamp-1">
                            {course.syllabus.title}
                          </h4>

                          <p className="text-xs text-white/55">
                            {course.syllabus.modules.length} modules •{" "}
                            {prog.totalActive} subtopics •{" "}
                            {course.syllabus.academicLevel || "College level"}
                          </p>
                        </div>

                        <div className="space-y-3 pt-1">
                          {/* Progress Bar + Percentage */}
                          <div className="flex items-center gap-3">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${prog.percentage}%`,
                                  backgroundColor: "var(--primary)",
                                }}
                              />
                            </div>
                            <span className="font-mono text-[11px] font-semibold text-white/75">
                              {prog.percentage}%
                            </span>
                          </div>

                          {/* Up Next Footer */}
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10 text-xs text-white/65">
                            <span className="truncate">
                              Up next:{" "}
                              <strong className="text-white/90 font-medium">
                                {prog.activeSubtopic?.title ||
                                  "Course Completed!"}
                              </strong>
                            </span>
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Curated Starter Course Cards (so the 3-card row is always populated) */}
                {visibleStarterCards.map((st) => (
                  <div
                    key={st.id}
                    onClick={() =>
                      handleGenerateSyllabus(true, st.prompt, st.level)
                    }
                    className="group cursor-pointer rounded-2xl border theme-panel overflow-hidden transition-all hover:border-primary/50 hover:-translate-y-0.5 shadow-lg flex flex-col justify-between"
                  >
                    <div
                      className="relative h-24 px-4 py-3 flex flex-col justify-between border-b border-white/10"
                      style={{ background: st.bannerBg }}
                    >
                      <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-white/70">
                        {st.tag}
                      </span>
                      <span className="text-[9px] font-mono uppercase tracking-widest text-white/55">
                        {st.code}
                      </span>
                      <span
                        className={`absolute right-4 bottom-1 font-serif text-5xl font-normal select-none opacity-80 ${st.bannerText}`}
                      >
                        {st.symbol}
                      </span>
                    </div>

                    <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-white/50">
                          <span>{st.modeLabel}</span>
                          <MoreHorizontal className="h-3.5 w-3.5 text-white/35" />
                        </div>

                        <h4 className="font-serif text-base font-semibold text-white group-hover:text-highlight transition-colors">
                          {st.title}
                        </h4>

                        <p className="text-xs text-white/55">
                          {st.moduleCount} subtopics • {st.level}
                        </p>
                      </div>

                      <div className="space-y-3 pt-1">
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: "0%",
                                backgroundColor: "var(--primary)",
                              }}
                            />
                          </div>
                          <span className="font-mono text-[11px] text-white/55">
                            Start
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10 text-xs text-white/65">
                          <span className="truncate">
                            Up next: {st.upNext}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Bottom Row: "Small steps, lasting knowledge." + "Your next study session" */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Left 8 Cols: Weekly Momentum Card */}
              <div className="md:col-span-7 lg:col-span-8 rounded-2xl border theme-panel p-5 flex flex-col justify-between space-y-4">
                <div>
                  <h4 className="font-serif text-lg font-normal text-white">
                    Small steps, lasting knowledge.
                  </h4>
                  <p className="text-xs text-white/60 mt-0.5">
                    You&apos;ve completed {totalMasteredAllCourses} micro-lesson
                    {totalMasteredAllCourses === 1 ? "" : "s"} across your
                    active courses. Keep your daily rhythm going!
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    {["M", "T", "W", "T", "F", "S", "S"].map((day, dIdx) => {
                      const isDoneDay = dIdx < 4 || totalMasteredAllCourses > dIdx;
                      return (
                        <div
                          key={dIdx}
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                            isDoneDay
                              ? "bg-primary text-black shadow-sm"
                              : "border border-white/15 bg-white/5 text-white/45"
                          }`}
                        >
                          {isDoneDay ? <Check className="h-3.5 w-3.5" /> : day}
                        </div>
                      );
                    })}
                  </div>

                  <span className="font-mono text-xs font-bold text-white/80">
                    {Math.min(5, Math.max(1, savedCourses.length))} / 5 days
                  </span>
                </div>
              </div>

              {/* Right 4 Cols: Next Study Session Card */}
              <div className="md:col-span-5 lg:col-span-4 rounded-2xl border theme-panel p-5 flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/45">
                    MAKE TIME FOR YOUR MIND
                  </div>
                  <h4 className="font-serif text-lg font-normal text-white">
                    Your next study session
                  </h4>
                  <div className="flex items-center gap-1.5 text-xs text-white/65 pt-1">
                    <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate">
                      {syllabus && progress.activeSubtopic
                        ? `${syllabus.title} • ${progress.activeSubtopic.title}`
                        : "Ready when you are • Choose a topic above"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (syllabus) {
                      setFloSubView("studio");
                    } else {
                      document.getElementById("flo-study-topic-input")?.focus();
                    }
                  }}
                  className="w-full flex items-center justify-between pt-2 border-t border-white/10 text-xs font-semibold text-highlight hover:text-white transition-colors"
                >
                  <span>
                    {syllabus ? "Resume active lesson" : "Start a new syllabus"}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* =================================================================
             VIEW 2: ACTIVE "flo" AI STUDIO (Editable Syllabus + Micro-Lessons)
             ================================================================= */
          syllabus && (
            <div className="space-y-4 pb-8">
              {/* Top Studio Progress & Navigation Bar */}
              <div className="rounded-2xl border theme-panel px-4 py-3 backdrop-blur-2xl shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => setFloSubView("overview")}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:text-white hover:border-primary/45 transition-colors shrink-0"
                    >
                      <ArrowLeft className="h-3.5 w-3.5 text-primary" />
                      <span>Overview</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMobileDrawerOpen((v) => !v)}
                      className="lg:hidden inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 p-2 text-white/80 hover:text-white"
                      title="Toggle Master Syllabus Drawer"
                    >
                      <Menu className="h-4 w-4 text-primary" />
                    </button>

                    <div className="min-w-0">
                      <h2 className="font-serif text-sm sm:text-base font-semibold text-white truncate">
                        {syllabus.title}
                      </h2>
                      <div className="text-[10px] font-mono text-white/50">
                        {syllabus.academicLevel || "College level"} •{" "}
                        {progress.completedCount}/{progress.totalActive} mastered
                      </div>
                    </div>
                  </div>

                  {/* Real-Time Progress Bar */}
                  <div className="flex flex-1 items-center justify-end gap-3 min-w-[220px]">
                    <div className="flex-1 max-w-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-white/70">Curriculum Mastery</span>
                        <span className="font-bold text-highlight">
                          {progress.percentage}%
                        </span>
                      </div>
                      <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <progress
                          aria-label="flo curriculum completion progress"
                          value={progress.completedCount}
                          max={Math.max(1, progress.totalActive)}
                          className="sr-only"
                        />
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${progress.percentage}%`,
                            background:
                              "linear-gradient(90deg, var(--primary) 0%, #34d399 100%)",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Studio 2-Column Split: Editable Master Syllabus + Interactive Lesson Stream */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Left 4 Cols: Editable Master Syllabus */}
                <div className="hidden lg:block lg:col-span-4 sticky top-20 max-h-[calc(100vh-7rem)]">
                  <StudySyllabusSidebar
                    syllabus={syllabus}
                    isBusy={isTutorThinking}
                    onRenameModule={handleRenameModule}
                    onDeleteModule={handleDeleteModule}
                    onMoveModule={handleMoveModule}
                    onAddModule={handleAddModule}
                    onRenameSubtopic={handleRenameSubtopic}
                    onDeleteSubtopic={handleDeleteSubtopic}
                    onMoveSubtopic={handleMoveSubtopic}
                    onReorderSubtopicDrag={handleReorderSubtopicDrag}
                    onAddSubtopic={handleAddSubtopic}
                    onToggleSkipKnown={handleToggleSkipKnown}
                    onSelectActiveSubtopic={handleSelectActiveSubtopic}
                  />
                </div>

                {/* Mobile Collapsible Master Syllabus Drawer */}
                {mobileDrawerOpen && (
                  <div className="fixed inset-0 z-50 lg:hidden flex">
                    <div
                      className="fixed inset-0 bg-black/70 backdrop-blur-sm"
                      onClick={() => setMobileDrawerOpen(false)}
                    />
                    <div className="relative z-10 w-full max-w-sm h-full p-3">
                      <div className="mb-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setMobileDrawerOpen(false)}
                          className="inline-flex items-center gap-1 rounded-xl border border-white/20 bg-black/80 px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Close Syllabus</span>
                        </button>
                      </div>
                      <div className="h-[calc(100%-2.5rem)]">
                        <StudySyllabusSidebar
                          syllabus={syllabus}
                          isBusy={isTutorThinking}
                          onRenameModule={handleRenameModule}
                          onDeleteModule={handleDeleteModule}
                          onMoveModule={handleMoveModule}
                          onAddModule={handleAddModule}
                          onRenameSubtopic={handleRenameSubtopic}
                          onDeleteSubtopic={handleDeleteSubtopic}
                          onMoveSubtopic={handleMoveSubtopic}
                          onReorderSubtopicDrag={handleReorderSubtopicDrag}
                          onAddSubtopic={handleAddSubtopic}
                          onToggleSkipKnown={handleToggleSkipKnown}
                          onSelectActiveSubtopic={handleSelectActiveSubtopic}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Right 8 Cols: Active Lesson Stream */}
                <div className="lg:col-span-8 flex flex-col space-y-4">
                  {/* Active Subtopic Header Card */}
                  {progress.activeSubtopic && (
                    <div className="rounded-2xl border theme-panel px-4 py-3 backdrop-blur-xl flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 border border-primary/45 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-highlight shrink-0">
                          <Play className="h-2.5 w-2.5 text-primary" />
                          Active Subtopic
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-bold text-white truncate">
                            {progress.activeSubtopic.title}
                          </div>
                          {progress.activeModule && (
                            <div className="text-[11px] text-white/55 truncate">
                              {progress.activeModule.title}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={isTutorThinking}
                          onClick={() =>
                            handleToggleSkipKnown(progress.activeSubtopic!.id)
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 transition-colors disabled:opacity-40"
                        >
                          <FastForward className="h-3.5 w-3.5 text-amber-300" />
                          <span>I already know this</span>
                        </button>

                        {progress.activeModule && (
                          <button
                            type="button"
                            disabled={isTutorThinking}
                            onClick={() =>
                              handleDeleteSubtopic(
                                progress.activeModule!.id,
                                progress.activeSubtopic!.id
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/70 hover:border-rose-400/40 hover:bg-rose-500/15 hover:text-rose-200 transition-colors disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Remove</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Lesson Turns Stream */}
                  <div className="space-y-4">
                    {turns.map((turn, idx) => {
                      const isLatest = idx === turns.length - 1;

                      if (turn.role === "user") {
                        return (
                          <div key={turn.id} className="flex justify-end">
                            <div className="max-w-xl rounded-2xl rounded-br-sm border border-primary/40 bg-primary/20 px-4 py-2.5 text-xs sm:text-sm text-white shadow-md">
                              <div className="mb-1 flex items-center justify-end gap-2 text-[10px] font-mono text-white/60">
                                <span>You</span>
                                <span>•</span>
                                <span>{turn.timestamp}</span>
                              </div>
                              <div className="leading-relaxed">
                                {turn.content}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <article
                          key={turn.id}
                          className="rounded-2xl border theme-panel p-4 sm:p-6 shadow-xl backdrop-blur-2xl space-y-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-highlight">
                                <BookOpen className="h-3 w-3 text-primary" />
                                {turn.isRemediation
                                  ? "Adaptive Remediation"
                                  : "Micro-Lesson"}
                              </span>
                              {turn.subtopicTitle && (
                                <span className="font-serif text-sm sm:text-base font-semibold text-white">
                                  {turn.subtopicTitle}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[11px] font-mono text-white/45">
                              {turn.modelUsed && (
                                <span className="rounded bg-white/5 px-2 py-0.5 text-highlight/80">
                                  {turn.modelUsed.split("/").pop()}
                                </span>
                              )}
                              <span>{turn.timestamp}</span>
                            </div>
                          </div>

                          {turn.syllabusMutationsApplied &&
                            turn.syllabusMutationsApplied.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {turn.syllabusMutationsApplied.map(
                                  (mText, mIdx) => (
                                    <span
                                      key={mIdx}
                                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                      {mText}
                                    </span>
                                  )
                                )}
                              </div>
                            )}

                          {turn.evaluationResult && (
                            <div
                              className={`rounded-xl border px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                                turn.evaluationResult.passed
                                  ? "border-emerald-500/40 bg-emerald-950/35 text-emerald-200"
                                  : "border-amber-500/40 bg-amber-950/35 text-amber-200"
                              }`}
                            >
                              <div className="font-bold mb-0.5 flex items-center gap-1.5">
                                {turn.evaluationResult.passed ? (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                    <span>
                                      Previous Subtopic Mastered! Advancing to
                                      Next Micro-Lesson:
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <RotateCcw className="h-4 w-4 text-amber-400" />
                                    <span>
                                      Let&apos;s Clarify That Before Moving
                                      Forward:
                                    </span>
                                  </>
                                )}
                              </div>
                              <div>{turn.evaluationResult.feedback}</div>
                            </div>
                          )}

                          <StudyMarkdown content={turn.content} />

                          {turn.keyTakeaways &&
                            turn.keyTakeaways.length > 0 && (
                              <div className="rounded-xl border border-primary/25 bg-primary/[0.08] p-3.5 space-y-1.5">
                                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-highlight flex items-center gap-1.5">
                                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                                  <span>Key Takeaways</span>
                                </div>
                                <ul className="space-y-1">
                                  {turn.keyTakeaways.map((kt, kIdx) => (
                                    <li
                                      key={kIdx}
                                      className="flex items-start gap-2 text-xs text-zinc-100 leading-relaxed"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                                      <span>{kt}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                          {turn.visual && (
                            <StudyVisualRenderer visual={turn.visual} />
                          )}

                          {turn.checkpoint && (
                            <StudyCheckpointCard
                              checkpoint={turn.checkpoint}
                              subtopicTitle={
                                turn.subtopicTitle ||
                                progress.activeSubtopic?.title ||
                                "Current Subtopic"
                              }
                              isLatestTurn={isLatest}
                              isBusy={isTutorThinking}
                              onSelectMcqOption={handleSelectMcqOption}
                              onSubmitShortAnswer={handleSubmitShortAnswer}
                              onSkipKnown={handleToggleSkipKnown}
                              onRequestNextLesson={
                                progress.activeSubtopic && !progress.isComplete
                                  ? () =>
                                      requestTutorTurn({
                                        currentSyllabus: syllabus,
                                        actionType: "start_or_continue",
                                        targetSubtopicId:
                                          progress.activeSubtopic!.id,
                                      })
                                  : undefined
                              }
                            />
                          )}
                        </article>
                      );
                    })}

                    {/* AI Tutor Thinking Indicator with Live Model Switcher */}
                    {isTutorThinking && (
                      <div className="rounded-2xl border border-primary/40 theme-panel p-5 space-y-3.5 shadow-xl">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                            <div>
                              <div className="text-xs sm:text-sm font-bold text-white">
                                flo Tutor is preparing your micro-lesson, worked
                                examples &amp; visual diagram...
                              </div>
                              <div className="text-xs text-white/60">
                                Syncing with your live syllabus state (
                                {progress.percentage}% complete) • Active model:{" "}
                                <strong className="text-highlight">
                                  {activeModelLabel}
                                </strong>
                              </div>
                            </div>
                          </div>

                          {ModelSelectorDropdown}
                        </div>

                        <div className="border-t border-white/10 pt-3 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-mono text-white/55 mr-1 flex items-center gap-1">
                            <Zap className="h-3 w-3 text-amber-400" />
                            Switch model &amp; retry instantly:
                          </span>
                          {[
                            {
                              provider: "nvidia" as AIProvider,
                              id: "google/gemma-4-31b-it",
                              label: "Gemma 4 31B (Fast)",
                            },
                            {
                              provider: "nvidia" as AIProvider,
                              id: "google/gemma-3-12b-it",
                              label: "Gemma 3 12B (Ultra Fast)",
                            },
                            {
                              provider: "nvidia" as AIProvider,
                              id: "nvidia/nemotron-3.5-bolt-e4b",
                              label: "Nemotron Bolt",
                            },
                            {
                              provider: "nvidia" as AIProvider,
                              id: "nvidia/nemotron-3.5-lightning-30b-a3b",
                              label: "Nemotron Lightning",
                            },
                            {
                              provider: "nvidia" as AIProvider,
                              id: "mistralai/mistral-large-4-1t-a52b",
                              label: "Mistral Large 4",
                            },
                          ].map((opt) => {
                            const isCurrent =
                              activeProvider === opt.provider &&
                              activeNvidiaModel === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() =>
                                  handleSelectModel(
                                    opt.provider,
                                    opt.id,
                                    undefined,
                                    true
                                  )
                                }
                                className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                                  isCurrent
                                    ? "border-primary bg-primary/25 text-white"
                                    : "border-white/15 bg-white/5 text-zinc-200 hover:border-primary/50 hover:bg-primary/15 hover:text-white"
                                }`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Retry Card if a Model Timed Out */}
                    {lastTutorError && !isTutorThinking && (
                      <div className="rounded-2xl border border-rose-400/40 bg-rose-950/30 p-5 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs sm:text-sm font-bold text-rose-200">
                            {lastTutorError}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleSelectModel(
                                activeProvider,
                                activeNvidiaModel,
                                geminiTier,
                                true
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-black hover:brightness-110 shrink-0"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Retry Now</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 100% Curriculum Completion Celebration Card */}
                    {progress.isComplete && (
                      <div className="rounded-2xl border border-emerald-400/50 bg-emerald-950/30 p-6 text-center space-y-3 shadow-2xl">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-400/50">
                          <Trophy className="h-6 w-6 text-emerald-300" />
                        </div>
                        <h3 className="font-serif text-xl font-semibold text-white">
                          100% Active Curriculum Mastered!
                        </h3>
                        <p className="mx-auto max-w-lg text-xs sm:text-sm text-emerald-100/80 leading-relaxed">
                          You&apos;ve completed all{" "}
                          <strong>{progress.totalActive}</strong> active
                          subtopics in <strong>{syllabus.title}</strong>.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                          <button
                            type="button"
                            onClick={() => setFloSubView("overview")}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-xs font-bold text-black hover:brightness-110 transition-all"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Explore Another Topic in flo</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <div ref={streamEndRef} />
                  </div>

                  {/* Bottom Chat & Natural Language Override Bar */}
                  <div className="sticky bottom-3 z-20 rounded-2xl border theme-panel p-3 shadow-2xl backdrop-blur-2xl space-y-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-white/45 mr-1 flex items-center gap-1">
                        <MessageSquare className="h-3 w-3 text-primary" />
                        Quick actions:
                      </span>
                      <button
                        type="button"
                        disabled={isTutorThinking || progress.isComplete}
                        onClick={() =>
                          handleSendChatMessage("I already know this, skip ahead")
                        }
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/75 hover:border-primary/40 hover:text-white transition-colors disabled:opacity-40"
                      >
                        &ldquo;I already know this, skip ahead&rdquo;
                      </button>
                      <button
                        type="button"
                        disabled={isTutorThinking || progress.isComplete}
                        onClick={() =>
                          handleSendChatMessage(
                            "Give me 2 more step-by-step worked examples with numbers on this topic"
                          )
                        }
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/75 hover:border-primary/40 hover:text-white transition-colors disabled:opacity-40"
                      >
                        &ldquo;Show 2 more worked examples&rdquo;
                      </button>
                      {progress.activeSubtopic && (
                        <button
                          type="button"
                          disabled={isTutorThinking || progress.isComplete}
                          onClick={() =>
                            handleSendChatMessage(
                              `Remove ${progress.activeSubtopic!.title}, I don't need to learn it`
                            )
                          }
                          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/75 hover:border-rose-400/40 hover:text-rose-200 transition-colors disabled:opacity-40"
                        >
                          &ldquo;Remove this topic&rdquo;
                        </button>
                      )}
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendChatMessage();
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        disabled={isTutorThinking}
                        placeholder='Ask for more examples, ask a question, or type "I already know this, skip ahead"...'
                        className="flex-1 rounded-xl border border-white/15 bg-black/55 px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-white/35 focus:border-primary focus:outline-none disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={!chatInput.trim() || isTutorThinking}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-black hover:brightness-110 transition-all disabled:opacity-40 shrink-0"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Send</span>
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};
