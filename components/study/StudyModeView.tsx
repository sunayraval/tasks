"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  AIProvider,
  DEFAULT_NVIDIA_MODEL,
  NVIDIA_MODEL_OPTIONS,
  SavedStudyCourse,
  StudyCheckpoint,
  StudyLessonTurn,
  StudyMCQOption,
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
  Check,
  CheckCircle2,
  ChevronDown,
  Cpu,
  FastForward,
  KeyRound,
  Loader2,
  Menu,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from "lucide-react";

const LOCAL_STUDY_SESSION_KEY = "flo_study_session_v1";

function makeLocalId(prefix = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const QUICK_TOPICS = [
  {
    label: "Limits & Derivatives",
    prompt:
      "Calculus: Limit notation and graphical interpretation, one-sided limits, algebraic limit evaluation (factoring & conjugates), continuity, and the derivative power rule",
  },
  {
    label: "Cellular respiration",
    prompt:
      "Cellular Respiration: Glycolysis, pyruvate oxidation, Citric Acid (Krebs) cycle, electron transport chain, and chemiosmosis",
  },
  {
    label: "Microeconomics",
    prompt:
      "Principles of Microeconomics: Supply and demand equilibrium, price elasticity, consumer & producer surplus, and market structures",
  },
  {
    label: "Organic chemistry",
    prompt:
      "Organic Chemistry: Functional groups, hybridization, stereochemistry, and SN1/SN2 substitution mechanisms",
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
  const [floSubView, setFloSubView] = useState<"home" | "lesson">("home");
  const [topicInput, setTopicInput] = useState<string>("");

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
  const [priorTopicsOpen, setPriorTopicsOpen] = useState<boolean>(false);
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

  // 1. Hydrate & Merge from both WorkspaceConfig (Supabase) and localStorage
  useEffect(() => {
    const mergeCourses = (
      a: SavedStudyCourse[],
      b: SavedStudyCourse[]
    ): SavedStudyCourse[] => {
      const map = new Map<string, SavedStudyCourse>();
      for (const item of [...a, ...b]) {
        if (!item?.id || !item?.syllabus) continue;
        const existing = map.get(item.id);
        if (
          !existing ||
          new Date(item.updatedAt || 0).getTime() >=
            new Date(existing.updatedAt || 0).getTime()
        ) {
          map.set(item.id, item);
        }
      }
      return Array.from(map.values())
        .sort(
          (x, y) =>
            new Date(y.updatedAt || 0).getTime() -
            new Date(x.updatedAt || 0).getTime()
        )
        .slice(0, 15);
    };

    let localParsed: StudySessionState | null = null;
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(LOCAL_STUDY_SESSION_KEY);
        if (raw) {
          localParsed = JSON.parse(raw) as StudySessionState;
        }
      } catch {}
    }

    const remoteSession = workspaceConfig.studySession || null;
    const remoteCourses: SavedStudyCourse[] = Array.isArray(
      remoteSession?.savedCourses
    )
      ? remoteSession!.savedCourses!
      : remoteSession?.syllabus
      ? [
          {
            id: remoteSession.syllabus.id,
            syllabus: remoteSession.syllabus,
            turns: remoteSession.turns || [],
            sessionStarted: Boolean(remoteSession.sessionStarted),
            updatedAt: remoteSession.updatedAt || new Date().toISOString(),
          },
        ]
      : [];

    const localCourses: SavedStudyCourse[] = Array.isArray(
      localParsed?.savedCourses
    )
      ? localParsed!.savedCourses!
      : localParsed?.syllabus
      ? [
          {
            id: localParsed.syllabus.id,
            syllabus: localParsed.syllabus,
            turns: localParsed.turns || [],
            sessionStarted: Boolean(localParsed.sessionStarted),
            updatedAt: localParsed.updatedAt || new Date().toISOString(),
          },
        ]
      : [];

    const merged = mergeCourses(localCourses, remoteCourses);
    if (merged.length > 0) {
      setSavedCourses((prev) => mergeCourses(prev, merged));
    }

    if (!hydratedRef.current) {
      hydratedRef.current = true;
      const initialActive = remoteSession?.syllabus
        ? remoteSession
        : localParsed;
      if (initialActive?.syllabus) {
        setSyllabus(initialActive.syllabus);
        setTurns(initialActive.turns || []);
        setSessionStarted(Boolean(initialActive.sessionStarted));
      }
    }
  }, [workspaceConfig.studySession]);

  // 2. Persist state
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
          updatedCourses = [entry, ...updatedCourses].slice(0, 9);
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

  const progress = computeSyllabusProgress(syllabus);

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
            "Could not load lesson. Try switching models in the top right.";
          setLastTutorError(errMsg);
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
        setLastTutorError(
          "Model timed out. Pick another model from the selector to retry immediately."
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
      persistSession,
    ]
  );

  // Switch model and automatically retry if currently loading or errored
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

    onShowToast(`Model set to ${label}`);

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
  // Generate Syllabus & Start Learning
  // ===========================================================================
  const handleGenerateSyllabus = async (overrideTopic?: string) => {
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
        onShowToast(data.error || "Could not generate syllabus.");
        return;
      }

      const generatedSyllabus: StudySyllabus = data.syllabus;
      setSyllabus(generatedSyllabus);
      setTurns([]);
      setSessionStarted(true);
      setFloSubView("lesson");
      setTopicInput("");
      persistSession(generatedSyllabus, [], true);
      setIsGeneratingSyllabus(false);

      await requestTutorTurn({
        currentSyllabus: generatedSyllabus,
        actionType: "start_or_continue",
        baseTurns: [],
      });
    } catch {
      onShowToast("Failed to generate syllabus.");
    } finally {
      setIsGeneratingSyllabus(false);
    }
  };

  const handleOpenSavedCourse = (course: SavedStudyCourse) => {
    setSyllabus(course.syllabus);
    setTurns(course.turns || []);
    setSessionStarted(true);
    setFloSubView("lesson");

    if (!course.turns || course.turns.length === 0) {
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
  };

  // ===========================================================================
  // Syllabus Edits
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
          if (s.id === subtopicId) return { ...s, state: "in_progress" };
          if (s.state === "in_progress") return { ...s, state: "locked" };
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
  // Checkpoint & Chat Handlers
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
    if (overrideText === undefined) setChatInput("");
    requestTutorTurn({
      currentSyllabus: syllabus,
      actionType: "chat_message",
      userMessage: text,
      appendUserBubble: true,
    });
  };

  // ===========================================================================
  // Clean Model Selector Dropdown
  // ===========================================================================
  const ModelSelectorDropdown = (
    <div className="relative">
      <button
        type="button"
        onClick={() => setModelDropdownOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/90 hover:border-primary/50 hover:text-white transition-all"
        title="Switch AI Model"
      >
        <Cpu className="h-3.5 w-3.5 text-primary" />
        <span className="truncate max-w-[140px]">{activeModelLabel}</span>
        <ChevronDown className="h-3 w-3 text-white/55" />
      </button>

      {modelDropdownOpen && (
        <div
          className="absolute right-0 mt-1.5 w-72 max-h-80 overflow-y-auto rounded-2xl border border-white/20 bg-[#14161c]/95 p-2 shadow-2xl z-50 space-y-1"
          onMouseLeave={() => setModelDropdownOpen(false)}
        >
          <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-white/45">
            Select AI Model
          </div>
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
                className={`w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition-colors ${
                  isSelected
                    ? "bg-primary/20 text-white font-bold"
                    : "text-zinc-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <div className="truncate">
                  <span>{m.name}</span>
                  <span className="ml-1.5 rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-mono text-highlight">
                    {m.badge}
                  </span>
                </div>
                {isSelected && (
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
              </button>
            );
          })}

          <div className="border-t border-white/10 pt-1 mt-1">
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
                  className={`w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition-colors ${
                    isSelected
                      ? "bg-primary/20 text-white font-bold"
                      : "text-zinc-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span>
                    {tier === "flash" ? "Gemini 2.0 Flash" : "Gemini 1.5 Pro"}
                  </span>
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // Only show the latest assistant lesson turn (plus any user follow-ups after it) so the screen stays clean and focused on 1 lesson at a time
  const latestAssistantIdx = (() => {
    for (let i = turns.length - 1; i >= 0; i--) {
      if (turns[i].role === "assistant") return i;
    }
    return -1;
  })();
  const activeLessonTurn =
    latestAssistantIdx !== -1 ? turns[latestAssistantIdx] : null;

  return (
    <div className="mx-auto w-full max-w-5xl py-2 sm:py-4">
      {/* =====================================================================
          VIEW 1: CLEAN "What do you want to learn?" HOME VIEW
         ===================================================================== */}
      {floSubView === "home" || !syllabus ? (
        <div className="space-y-8">
          {/* Clean Focused Prompt Card */}
          <div className="rounded-3xl border theme-panel p-6 sm:p-8 shadow-2xl space-y-5">
            {/* Header Row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/35 bg-primary/15">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    What do you want to learn?
                  </h1>
                  <p className="text-xs text-white/55">
                    Enter any topic or paste your syllabus —{" "}
                    <strong className="text-white">flo</strong> breaks it down
                    and teaches you step-by-step.
                  </p>
                </div>
              </div>

              {ModelSelectorDropdown}
            </div>

            {!hasApiKey && (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-400/35 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>
                    Connect your free NVIDIA NIM or Google Gemini API key to
                    start learning.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onOpenApiKeySetup}
                  className="rounded-lg bg-amber-400 px-3 py-1 font-bold text-black hover:brightness-110 shrink-0"
                >
                  Setup Key
                </button>
              </div>
            )}

            {/* Simple Input Box */}
            <div className="rounded-2xl border border-white/15 bg-black/45 p-4 focus-within:border-primary/60 transition-colors">
              <textarea
                id="flo-study-topic-input"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleGenerateSyllabus();
                  }
                }}
                rows={3}
                placeholder="e.g. Calculus limits & continuity, Cellular respiration, Principles of microeconomics..."
                className="w-full resize-none bg-transparent text-sm sm:text-base text-white placeholder:text-white/35 focus:outline-none leading-relaxed"
              />
            </div>

            {/* Bottom Row: Quick Topic Chips + Generate Button */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-white/45 mr-1">Try:</span>
                {QUICK_TOPICS.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setTopicInput(chip.prompt)}
                    className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-xs text-white/75 hover:border-primary/45 hover:bg-primary/15 hover:text-white transition-all"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={!topicInput.trim() || isGeneratingSyllabus}
                onClick={() => handleGenerateSyllabus()}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs sm:text-sm font-bold text-black hover:brightness-110 transition-all shadow-neon disabled:opacity-40 shrink-0"
              >
                {isGeneratingSyllabus ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Building syllabus...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Generate syllabus</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Saved Courses ("Prior Study Topics") — always visible when user has prior topics */}
          {savedCourses.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-bold uppercase tracking-wider text-white/70">
                  Prior Study Topics ({savedCourses.length})
                </h2>
                <span className="text-xs text-white/45">
                  Click any topic to pick up where you left off
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {savedCourses.map((course) => {
                  const prog = computeSyllabusProgress(course.syllabus);
                  return (
                    <div
                      key={course.id}
                      onClick={() => handleOpenSavedCourse(course)}
                      className="group cursor-pointer rounded-2xl border theme-panel p-4 transition-all hover:border-primary/50 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-bold text-white group-hover:text-highlight transition-colors line-clamp-1">
                            {course.syllabus.title}
                          </h3>
                          <button
                            type="button"
                            onClick={(e) =>
                              handleDeleteSavedCourse(course.id, e)
                            }
                            className="rounded p-1 text-white/35 hover:bg-rose-500/20 hover:text-rose-300 transition-colors shrink-0"
                            title="Delete course"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-white/50">
                          {prog.completedCount} / {prog.totalActive} topics
                          completed
                        </p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${prog.percentage}%`,
                                backgroundColor: "var(--primary)",
                              }}
                            />
                          </div>
                          <span className="font-mono text-[11px] font-bold text-highlight">
                            {prog.percentage}%
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs text-white/65 pt-1 border-t border-white/10">
                          <span className="truncate">
                            Next:{" "}
                            {prog.activeSubtopic?.title || "Completed!"}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/45 group-hover:text-primary" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ===================================================================
           VIEW 2: CLEAN, FOCUSED LESSON WORKSPACE
           =================================================================== */
        <div className="space-y-4">
          {/* Single Compact Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border theme-panel px-4 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setFloSubView("home")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white/80 hover:text-white transition-colors shrink-0"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-primary" />
                <span>New / All Topics</span>
              </button>

              {savedCourses.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPriorTopicsOpen((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white/80 hover:text-white hover:border-primary/40 transition-colors shrink-0"
                    title="Switch to a prior study topic"
                  >
                    <span>Prior ({savedCourses.length})</span>
                    <ChevronDown className="h-3 w-3 text-white/55" />
                  </button>

                  {priorTopicsOpen && (
                    <div
                      className="absolute left-0 mt-1.5 w-72 max-h-72 overflow-y-auto rounded-2xl border border-white/20 bg-[#14161c]/95 p-2 shadow-2xl z-50 space-y-1"
                      onMouseLeave={() => setPriorTopicsOpen(false)}
                    >
                      <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-white/45">
                        Switch Study Topic
                      </div>
                      {savedCourses.map((course) => {
                        const prog = computeSyllabusProgress(course.syllabus);
                        const isCurrent = course.id === syllabus.id;
                        return (
                          <button
                            key={course.id}
                            type="button"
                            onClick={() => {
                              setPriorTopicsOpen(false);
                              handleOpenSavedCourse(course);
                            }}
                            className={`w-full flex items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition-colors ${
                              isCurrent
                                ? "bg-primary/20 text-white font-bold"
                                : "text-zinc-300 hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate">
                                {course.syllabus.title}
                              </div>
                              <div className="text-[10px] text-white/50 truncate">
                                {prog.completedCount}/{prog.totalActive} done •{" "}
                                {prog.percentage}%
                              </div>
                            </div>
                            {isCurrent && (
                              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setMobileDrawerOpen((v) => !v)}
                className="lg:hidden inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-white/80"
              >
                <Menu className="h-3.5 w-3.5 text-primary" />
                <span>Syllabus</span>
              </button>

              <h2 className="text-sm font-bold text-white truncate">
                {syllabus.title}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              {/* Simple Progress Pill */}
              <div className="flex items-center gap-2">
                <div className="w-24 sm:w-32 h-2 overflow-hidden rounded-full bg-white/10">
                  <progress
                    aria-label="Study progress"
                    value={progress.completedCount}
                    max={Math.max(1, progress.totalActive)}
                    className="sr-only"
                  />
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${progress.percentage}%`,
                      backgroundColor: "var(--primary)",
                    }}
                  />
                </div>
                <span className="font-mono text-xs font-bold text-highlight">
                  {progress.percentage}%
                </span>
              </div>

              {ModelSelectorDropdown}
            </div>
          </div>

          {/* 2-Column Workspace: Left Checklist + Right Active Lesson */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left 4 Cols: Clean Syllabus Checklist */}
            <div className="hidden lg:block lg:col-span-4 sticky top-20">
              <StudySyllabusSidebar
                syllabus={syllabus}
                isBusy={isTutorThinking}
                onRenameModule={(modId, title) =>
                  updateSyllabusState((prev) => ({
                    ...prev,
                    modules: prev.modules.map((m) =>
                      m.id === modId ? { ...m, title } : m
                    ),
                  }))
                }
                onDeleteModule={(modId) =>
                  updateSyllabusState(
                    (prev) => ({
                      ...prev,
                      modules: prev.modules.filter((m) => m.id !== modId),
                    }),
                    "Removed section",
                    true
                  )
                }
                onMoveModule={() => {}}
                onAddModule={(title) =>
                  updateSyllabusState((prev) => ({
                    ...prev,
                    modules: [
                      ...prev.modules,
                      {
                        id: makeLocalId("mod"),
                        title,
                        subtopics: [
                          {
                            id: makeLocalId("sub"),
                            title: `${title} — Core Concepts`,
                            state: "locked",
                          },
                        ],
                      },
                    ],
                  }))
                }
                onRenameSubtopic={(modId, subId, title) =>
                  updateSyllabusState((prev) => ({
                    ...prev,
                    modules: prev.modules.map((m) =>
                      m.id === modId
                        ? {
                            ...m,
                            subtopics: m.subtopics.map((s) =>
                              s.id === subId ? { ...s, title } : s
                            ),
                          }
                        : m
                    ),
                  }))
                }
                onDeleteSubtopic={(modId, subId) =>
                  updateSyllabusState(
                    (prev) => ({
                      ...prev,
                      modules: prev.modules
                        .map((m) =>
                          m.id === modId
                            ? {
                                ...m,
                                subtopics: m.subtopics.filter(
                                  (s) => s.id !== subId
                                ),
                              }
                            : m
                        )
                        .filter((m) => m.subtopics.length > 0),
                    }),
                    "Removed topic",
                    true
                  )
                }
                onMoveSubtopic={(modId, subId, dir) =>
                  updateSyllabusState((prev) => ({
                    ...prev,
                    modules: prev.modules.map((m) => {
                      if (m.id !== modId) return m;
                      const idx = m.subtopics.findIndex((s) => s.id === subId);
                      if (idx === -1) return m;
                      const tIdx = dir === "up" ? idx - 1 : idx + 1;
                      if (tIdx < 0 || tIdx >= m.subtopics.length) return m;
                      const copy = [...m.subtopics];
                      const [moved] = copy.splice(idx, 1);
                      copy.splice(tIdx, 0, moved);
                      return { ...m, subtopics: copy };
                    }),
                  }))
                }
                onReorderSubtopicDrag={() => {}}
                onAddSubtopic={(modId, title) =>
                  updateSyllabusState((prev) => ({
                    ...prev,
                    modules: prev.modules.map((m) =>
                      m.id === modId
                        ? {
                            ...m,
                            subtopics: [
                              ...m.subtopics,
                              {
                                id: makeLocalId("sub"),
                                title,
                                state: "locked",
                              },
                            ],
                          }
                        : m
                    ),
                  }))
                }
                onToggleSkipKnown={handleToggleSkipKnown}
                onSelectActiveSubtopic={handleSelectActiveSubtopic}
              />
            </div>

            {/* Mobile Drawer */}
            {mobileDrawerOpen && (
              <div className="fixed inset-0 z-50 lg:hidden flex">
                <div
                  className="fixed inset-0 bg-black/70"
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
                      <span>Close</span>
                    </button>
                  </div>
                  <StudySyllabusSidebar
                    syllabus={syllabus}
                    isBusy={isTutorThinking}
                    onRenameModule={(modId, title) =>
                      updateSyllabusState((prev) => ({
                        ...prev,
                        modules: prev.modules.map((m) =>
                          m.id === modId ? { ...m, title } : m
                        ),
                      }))
                    }
                    onDeleteModule={(modId) =>
                      updateSyllabusState(
                        (prev) => ({
                          ...prev,
                          modules: prev.modules.filter((m) => m.id !== modId),
                        }),
                        "Removed section",
                        true
                      )
                    }
                    onMoveModule={() => {}}
                    onAddModule={(title) =>
                      updateSyllabusState((prev) => ({
                        ...prev,
                        modules: [
                          ...prev.modules,
                          {
                            id: makeLocalId("mod"),
                            title,
                            subtopics: [
                              {
                                id: makeLocalId("sub"),
                                title: `${title} — Core Concepts`,
                                state: "locked",
                              },
                            ],
                          },
                        ],
                      }))
                    }
                    onRenameSubtopic={(modId, subId, title) =>
                      updateSyllabusState((prev) => ({
                        ...prev,
                        modules: prev.modules.map((m) =>
                          m.id === modId
                            ? {
                                ...m,
                                subtopics: m.subtopics.map((s) =>
                                  s.id === subId ? { ...s, title } : s
                                ),
                              }
                            : m
                        ),
                      }))
                    }
                    onDeleteSubtopic={(modId, subId) =>
                      updateSyllabusState(
                        (prev) => ({
                          ...prev,
                          modules: prev.modules
                            .map((m) =>
                              m.id === modId
                                ? {
                                    ...m,
                                    subtopics: m.subtopics.filter(
                                      (s) => s.id !== subId
                                    ),
                                  }
                                : m
                            )
                            .filter((m) => m.subtopics.length > 0),
                        }),
                        "Removed topic",
                        true
                      )
                    }
                    onMoveSubtopic={() => {}}
                    onReorderSubtopicDrag={() => {}}
                    onAddSubtopic={(modId, title) =>
                      updateSyllabusState((prev) => ({
                        ...prev,
                        modules: prev.modules.map((m) =>
                          m.id === modId
                            ? {
                                ...m,
                                subtopics: [
                                  ...m.subtopics,
                                  {
                                    id: makeLocalId("sub"),
                                    title,
                                    state: "locked",
                                  },
                                ],
                              }
                            : m
                        ),
                      }))
                    }
                    onToggleSkipKnown={handleToggleSkipKnown}
                    onSelectActiveSubtopic={handleSelectActiveSubtopic}
                  />
                </div>
              </div>
            )}

            {/* Right 8 Cols: Focused Single Lesson View */}
            <div className="lg:col-span-8 space-y-4">
              {isTutorThinking ? (
                /* Clean Loading State with Model Switcher */
                <div className="rounded-2xl border theme-panel p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                      <div>
                        <div className="text-sm font-bold text-white">
                          Preparing lesson:{" "}
                          {progress.activeSubtopic?.title || "Next topic"}...
                        </div>
                        <div className="text-xs text-white/55">
                          Using {activeModelLabel} • Switch models on the right
                          if it takes more than a few seconds
                        </div>
                      </div>
                    </div>
                    {ModelSelectorDropdown}
                  </div>
                </div>
              ) : lastTutorError ? (
                /* Simple Retry Card */
                <div className="rounded-2xl border border-rose-400/40 bg-rose-950/30 p-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs sm:text-sm text-rose-200">
                    {lastTutorError}
                  </div>
                  <div className="flex items-center gap-2">
                    {ModelSelectorDropdown}
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
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-black"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Retry</span>
                    </button>
                  </div>
                </div>
              ) : progress.isComplete ? (
                /* 100% Complete Card */
                <div className="rounded-2xl border border-emerald-400/50 bg-emerald-950/30 p-8 text-center space-y-3">
                  <Trophy className="mx-auto h-8 w-8 text-emerald-300" />
                  <h3 className="text-xl font-bold text-white">
                    100% Syllabus Completed!
                  </h3>
                  <p className="text-xs sm:text-sm text-emerald-100/80">
                    You finished all {progress.totalActive} topics in{" "}
                    <strong>{syllabus.title}</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={() => setFloSubView("home")}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-xs font-bold text-black"
                  >
                    <span>Study Another Topic</span>
                  </button>
                </div>
              ) : activeLessonTurn ? (
                /* Active Micro-Lesson Card */
                <article className="rounded-2xl border theme-panel p-5 sm:p-6 shadow-xl space-y-5">
                  {/* Clean Header: Topic Title + Skip Button */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3.5">
                    <div>
                      <div className="text-[11px] font-mono text-primary uppercase tracking-wider">
                        {activeLessonTurn.moduleTitle || syllabus.title}
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-white">
                        {activeLessonTurn.subtopicTitle ||
                          progress.activeSubtopic?.title}
                      </h3>
                    </div>

                    {progress.activeSubtopic && (
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleSkipKnown(progress.activeSubtopic!.id)
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/35 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 transition-colors"
                      >
                        <FastForward className="h-3.5 w-3.5" />
                        <span>I already know this</span>
                      </button>
                    )}
                  </div>

                  {/* Short-Answer Evaluation Feedback (if any) */}
                  {activeLessonTurn.evaluationResult && (
                    <div
                      className={`rounded-xl border px-4 py-3 text-xs sm:text-sm ${
                        activeLessonTurn.evaluationResult.passed
                          ? "border-emerald-500/40 bg-emerald-950/35 text-emerald-200"
                          : "border-amber-500/40 bg-amber-950/35 text-amber-200"
                      }`}
                    >
                      {activeLessonTurn.evaluationResult.feedback}
                    </div>
                  )}

                  {/* Lesson Content (Formulas, Step-by-Step, Worked Examples) */}
                  <StudyMarkdown content={activeLessonTurn.content} />

                  {/* Key Takeaways */}
                  {activeLessonTurn.keyTakeaways &&
                    activeLessonTurn.keyTakeaways.length > 0 && (
                      <div className="rounded-xl border border-primary/25 bg-primary/[0.08] p-3.5 space-y-1.5">
                        <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-highlight">
                          Key Takeaways
                        </div>
                        <ul className="space-y-1">
                          {activeLessonTurn.keyTakeaways.map((kt, kIdx) => (
                            <li
                              key={kIdx}
                              className="flex items-start gap-2 text-xs text-zinc-100"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                              <span>{kt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {/* Visual Diagram */}
                  {activeLessonTurn.visual && (
                    <StudyVisualRenderer visual={activeLessonTurn.visual} />
                  )}

                  {/* Interactive Question Checkpoint */}
                  {activeLessonTurn.checkpoint && (
                    <StudyCheckpointCard
                      checkpoint={activeLessonTurn.checkpoint}
                      subtopicTitle={
                        activeLessonTurn.subtopicTitle ||
                        progress.activeSubtopic?.title ||
                        "Current Topic"
                      }
                      isLatestTurn={true}
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
                                targetSubtopicId: progress.activeSubtopic!.id,
                              })
                          : undefined
                      }
                    />
                  )}
                </article>
              ) : null}

              <div ref={streamEndRef} />

              {/* Single Clean Bottom Chat Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChatMessage();
                }}
                className="flex items-center gap-2 rounded-2xl border theme-panel p-2.5 shadow-xl"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={isTutorThinking}
                  placeholder='Ask a question, ask for more examples, or type "skip"...'
                  className="flex-1 rounded-xl bg-transparent px-3 py-1.5 text-xs sm:text-sm text-white placeholder:text-white/40 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isTutorThinking}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-black hover:brightness-110 transition-all disabled:opacity-40 shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Ask</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
