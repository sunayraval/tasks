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
  Badge,
  Button,
  Caption,
  Card,
  Input,
  Progress,
  Text,
  Textarea,
  Title,
} from "@/components/tailus-ui";
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
      <Button.Root
        type="button"
        variant="soft"
        intent="gray"
        size="sm"
        onClick={() => setModelDropdownOpen((v) => !v)}
        title="Switch AI Model"
      >
        <Button.Icon type="leading">
          <Cpu className="h-3.5 w-3.5 text-primary-400" />
        </Button.Icon>
        <Button.Label className="truncate max-w-[140px]">
          {activeModelLabel}
        </Button.Label>
        <Button.Icon type="trailing">
          <ChevronDown className="h-3 w-3 text-caption" />
        </Button.Icon>
      </Button.Root>

      {modelDropdownOpen && (
        <Card
          variant="mixed"
          className="absolute right-0 mt-1.5 w-72 max-h-80 overflow-y-auto p-2 shadow-2xl backdrop-blur-2xl z-50 space-y-1"
          onMouseLeave={() => setModelDropdownOpen(false)}
        >
          <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-caption">
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
                className={`w-full flex items-center justify-between gap-2 rounded-[--btn-radius] px-2.5 py-2 text-left text-xs transition-colors ${
                  isSelected
                    ? "bg-primary-500/20 text-title font-semibold"
                    : "text-body hover:bg-[--ui-soft-bg] hover:text-title"
                }`}
              >
                <div className="truncate flex items-center gap-1.5">
                  <span>{m.name}</span>
                  <Badge
                    variant="soft"
                    intent="primary"
                    size="xs"
                    className="font-mono text-[9px]"
                  >
                    {m.badge}
                  </Badge>
                </div>
                {isSelected && (
                  <Check className="h-3.5 w-3.5 text-primary-400 shrink-0" />
                )}
              </button>
            );
          })}

          <div className="border-t border-[--ui-border-color] pt-1 mt-1">
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
                  className={`w-full flex items-center justify-between gap-2 rounded-[--btn-radius] px-2.5 py-2 text-left text-xs transition-colors ${
                    isSelected
                      ? "bg-primary-500/20 text-title font-semibold"
                      : "text-body hover:bg-[--ui-soft-bg] hover:text-title"
                  }`}
                >
                  <span>
                    {tier === "flash" ? "Gemini 2.0 Flash" : "Gemini 1.5 Pro"}
                  </span>
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 text-primary-400 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </Card>
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
          <Card
            variant="mixed"
            className="p-6 sm:p-8 shadow-2xl backdrop-blur-2xl space-y-5"
          >
            {/* Header Row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary-500/35 bg-primary-500/15">
                  <Sparkles className="h-5 w-5 text-primary-400" />
                </div>
                <div>
                  <Title size="xl" weight="bold" className="tracking-tight">
                    What do you want to learn?
                  </Title>
                  <Caption>
                    Enter any topic or paste your syllabus —{" "}
                    <strong className="text-title">flo</strong> breaks it down
                    and teaches you step-by-step.
                  </Caption>
                </div>
              </div>

              {ModelSelectorDropdown}
            </div>

            {!hasApiKey && (
              <Card
                variant="outlined"
                className="flex items-center justify-between gap-3 border-warning-500/35 bg-warning-500/10 px-4 py-2.5 text-xs text-warning-200"
              >
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-warning-400 shrink-0" />
                  <span>
                    Connect your free NVIDIA NIM or Google Gemini API key to
                    start learning.
                  </span>
                </div>
                <Button.Root
                  type="button"
                  variant="solid"
                  intent="warning"
                  size="xs"
                  onClick={onOpenApiKeySetup}
                  className="shrink-0"
                >
                  <Button.Label>Setup Key</Button.Label>
                </Button.Root>
              </Card>
            )}

            {/* Simple Input Box */}
            <div className="rounded-[--card-radius] border border-[--ui-border-color] bg-[--ui-bg] p-4 focus-within:border-primary-500/60 transition-colors">
              <Textarea
                id="flo-study-topic-input"
                variant="plain"
                size="md"
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
                className="w-full resize-none bg-transparent text-sm sm:text-base text-title placeholder:text-placeholder focus:outline-none leading-relaxed border-0 p-0"
              />
            </div>

            {/* Bottom Row: Quick Topic Chips + Generate Button */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <Caption className="mr-1">Try:</Caption>
                {QUICK_TOPICS.map((chip, idx) => (
                  <Button.Root
                    key={idx}
                    type="button"
                    variant="soft"
                    intent="gray"
                    size="xs"
                    onClick={() => setTopicInput(chip.prompt)}
                    className="rounded-full"
                  >
                    <Button.Label>{chip.label}</Button.Label>
                  </Button.Root>
                ))}
              </div>

              <Button.Root
                type="button"
                variant="solid"
                intent="primary"
                size="md"
                disabled={!topicInput.trim() || isGeneratingSyllabus}
                onClick={() => handleGenerateSyllabus()}
                className="shadow-neon shrink-0"
              >
                {isGeneratingSyllabus ? (
                  <>
                    <Button.Icon type="leading">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </Button.Icon>
                    <Button.Label>Building syllabus...</Button.Label>
                  </>
                ) : (
                  <>
                    <Button.Icon type="leading">
                      <Sparkles className="h-4 w-4" />
                    </Button.Icon>
                    <Button.Label>Generate syllabus</Button.Label>
                    <Button.Icon type="trailing">
                      <ArrowRight className="h-4 w-4" />
                    </Button.Icon>
                  </>
                )}
              </Button.Root>
            </div>
          </Card>

          {/* Saved Courses ("Prior Study Topics") — always visible when user has prior topics */}
          {savedCourses.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <Title
                  size="base"
                  weight="bold"
                  className="text-sm uppercase tracking-wider text-body"
                >
                  Prior Study Topics ({savedCourses.length})
                </Title>
                <Caption>
                  Click any topic to pick up where you left off
                </Caption>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {savedCourses.map((course) => {
                  const prog = computeSyllabusProgress(course.syllabus);
                  return (
                    <Card
                      key={course.id}
                      variant="mixed"
                      onClick={() => handleOpenSavedCourse(course)}
                      className="group cursor-pointer p-4 transition-all hover:border-primary-500/50 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-bold text-title group-hover:text-primary-300 transition-colors line-clamp-1">
                            {course.syllabus.title}
                          </h3>
                          <Button.Root
                            type="button"
                            variant="ghost"
                            intent="danger"
                            size="xs"
                            onClick={(e) =>
                              handleDeleteSavedCourse(course.id, e)
                            }
                            className="shrink-0"
                            title="Delete course"
                          >
                            <Button.Icon type="only">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button.Icon>
                          </Button.Root>
                        </div>
                        <Caption>
                          {prog.completedCount} / {prog.totalActive} topics
                          completed
                        </Caption>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5">
                          <Progress.Root
                            value={prog.percentage}
                            size="xs"
                            variant="soft"
                            className="flex-1"
                          >
                            <Progress.Indicator
                              intent="primary"
                              style={{
                                transform: `translateX(-${
                                  100 - prog.percentage
                                }%)`,
                              }}
                            />
                          </Progress.Root>
                          <span className="font-mono text-[11px] font-bold text-primary-300">
                            {prog.percentage}%
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs text-caption pt-1.5 border-t border-[--ui-border-color]">
                          <span className="truncate">
                            Next:{" "}
                            {prog.activeSubtopic?.title || "Completed!"}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-caption group-hover:text-primary-400" />
                        </div>
                      </div>
                    </Card>
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
          <Card
            variant="mixed"
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 backdrop-blur-2xl"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Button.Root
                type="button"
                variant="soft"
                intent="gray"
                size="xs"
                onClick={() => setFloSubView("home")}
                className="shrink-0"
              >
                <Button.Icon type="leading">
                  <ArrowLeft className="h-3.5 w-3.5 text-primary-400" />
                </Button.Icon>
                <Button.Label>New / All Topics</Button.Label>
              </Button.Root>

              {savedCourses.length > 0 && (
                <div className="relative">
                  <Button.Root
                    type="button"
                    variant="soft"
                    intent="gray"
                    size="xs"
                    onClick={() => setPriorTopicsOpen((v) => !v)}
                    className="shrink-0"
                    title="Switch to a prior study topic"
                  >
                    <Button.Label>Prior ({savedCourses.length})</Button.Label>
                    <Button.Icon type="trailing">
                      <ChevronDown className="h-3 w-3 text-caption" />
                    </Button.Icon>
                  </Button.Root>

                  {priorTopicsOpen && (
                    <Card
                      variant="mixed"
                      className="absolute left-0 mt-1.5 w-72 max-h-72 overflow-y-auto p-2 shadow-2xl backdrop-blur-2xl z-50 space-y-1"
                      onMouseLeave={() => setPriorTopicsOpen(false)}
                    >
                      <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-caption">
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
                            className={`w-full flex items-center justify-between gap-2 rounded-[--btn-radius] px-2.5 py-2 text-left text-xs transition-colors ${
                              isCurrent
                                ? "bg-primary-500/20 text-title font-semibold"
                                : "text-body hover:bg-[--ui-soft-bg] hover:text-title"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate">
                                {course.syllabus.title}
                              </div>
                              <div className="text-[10px] text-caption truncate">
                                {prog.completedCount}/{prog.totalActive} done •{" "}
                                {prog.percentage}%
                              </div>
                            </div>
                            {isCurrent && (
                              <Check className="h-3.5 w-3.5 text-primary-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </Card>
                  )}
                </div>
              )}

              <Button.Root
                type="button"
                variant="soft"
                intent="gray"
                size="xs"
                onClick={() => setMobileDrawerOpen((v) => !v)}
                className="lg:hidden shrink-0"
              >
                <Button.Icon type="leading">
                  <Menu className="h-3.5 w-3.5 text-primary-400" />
                </Button.Icon>
                <Button.Label>Syllabus</Button.Label>
              </Button.Root>

              <Title size="base" weight="bold" className="text-sm truncate">
                {syllabus.title}
              </Title>
            </div>

            <div className="flex items-center gap-3">
              {/* Simple Progress Pill */}
              <div className="flex items-center gap-2">
                <Progress.Root
                  aria-label="Study progress"
                  value={progress.percentage}
                  size="sm"
                  variant="soft"
                  className="w-24 sm:w-32"
                >
                  <Progress.Indicator
                    intent="primary"
                    style={{
                      transform: `translateX(-${100 - progress.percentage}%)`,
                    }}
                  />
                </Progress.Root>
                <span className="font-mono text-xs font-bold text-primary-300">
                  {progress.percentage}%
                </span>
              </div>

              {ModelSelectorDropdown}
            </div>
          </Card>

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
                  className="fixed inset-0 bg-black/70 backdrop-blur-sm"
                  onClick={() => setMobileDrawerOpen(false)}
                />
                <div className="relative z-10 w-full max-w-sm h-full p-3">
                  <div className="mb-2 flex justify-end">
                    <Button.Root
                      type="button"
                      variant="soft"
                      intent="gray"
                      size="xs"
                      onClick={() => setMobileDrawerOpen(false)}
                    >
                      <Button.Icon type="leading">
                        <X className="h-3.5 w-3.5" />
                      </Button.Icon>
                      <Button.Label>Close</Button.Label>
                    </Button.Root>
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
                <Card variant="mixed" className="p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-primary-400 shrink-0" />
                      <div>
                        <Title className="text-sm" size="base" weight="bold">
                          Preparing lesson:{" "}
                          {progress.activeSubtopic?.title || "Next topic"}...
                        </Title>
                        <Caption>
                          Using {activeModelLabel} • Switch models on the right
                          if it takes more than a few seconds
                        </Caption>
                      </div>
                    </div>
                    {ModelSelectorDropdown}
                  </div>
                </Card>
              ) : lastTutorError ? (
                /* Simple Retry Card */
                <Card
                  variant="outlined"
                  className="border-danger-500/40 bg-danger-950/30 p-5 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="text-xs sm:text-sm text-danger-200">
                    {lastTutorError}
                  </div>
                  <div className="flex items-center gap-2">
                    {ModelSelectorDropdown}
                    <Button.Root
                      type="button"
                      variant="solid"
                      intent="primary"
                      size="xs"
                      onClick={() =>
                        handleSelectModel(
                          activeProvider,
                          activeNvidiaModel,
                          geminiTier,
                          true
                        )
                      }
                    >
                      <Button.Icon type="leading">
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button.Icon>
                      <Button.Label>Retry</Button.Label>
                    </Button.Root>
                  </div>
                </Card>
              ) : progress.isComplete ? (
                /* 100% Complete Card */
                <Card
                  variant="outlined"
                  className="border-success-500/50 bg-success-950/30 p-8 text-center space-y-3"
                >
                  <Trophy className="mx-auto h-8 w-8 text-success-300" />
                  <Title size="xl" weight="bold">
                    100% Syllabus Completed!
                  </Title>
                  <Text size="sm" className="text-success-100/80">
                    You finished all {progress.totalActive} topics in{" "}
                    <strong className="text-title">{syllabus.title}</strong>.
                  </Text>
                  <div className="pt-1 flex justify-center">
                    <Button.Root
                      type="button"
                      variant="solid"
                      intent="success"
                      size="sm"
                      onClick={() => setFloSubView("home")}
                    >
                      <Button.Label>Study Another Topic</Button.Label>
                    </Button.Root>
                  </div>
                </Card>
              ) : activeLessonTurn ? (
                /* Active Micro-Lesson Card */
                <Card
                  variant="mixed"
                  className="p-5 sm:p-6 shadow-xl backdrop-blur-2xl space-y-5"
                >
                  <article className="space-y-5">
                    {/* Clean Header: Topic Title + Skip Button */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[--ui-border-color] pb-3.5">
                      <div>
                        <div className="text-[11px] font-mono text-primary-400 uppercase tracking-wider">
                          {activeLessonTurn.moduleTitle || syllabus.title}
                        </div>
                        <Title size="lg" weight="bold">
                          {activeLessonTurn.subtopicTitle ||
                            progress.activeSubtopic?.title}
                        </Title>
                      </div>

                      {progress.activeSubtopic && (
                        <Button.Root
                          type="button"
                          variant="soft"
                          intent="warning"
                          size="xs"
                          onClick={() =>
                            handleToggleSkipKnown(progress.activeSubtopic!.id)
                          }
                        >
                          <Button.Icon type="leading">
                            <FastForward className="h-3.5 w-3.5" />
                          </Button.Icon>
                          <Button.Label>I already know this</Button.Label>
                        </Button.Root>
                      )}
                    </div>

                    {/* Short-Answer Evaluation Feedback (if any) */}
                    {activeLessonTurn.evaluationResult && (
                      <div
                        className={`rounded-[--card-radius] border px-4 py-3 text-xs sm:text-sm ${
                          activeLessonTurn.evaluationResult.passed
                            ? "border-success-500/40 bg-success-950/35 text-success-200"
                            : "border-warning-500/40 bg-warning-950/35 text-warning-200"
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
                        <div className="rounded-[--card-radius] border border-primary-500/25 bg-primary-500/10 p-3.5 space-y-1.5">
                          <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-primary-300">
                            Key Takeaways
                          </div>
                          <ul className="space-y-1">
                            {activeLessonTurn.keyTakeaways.map((kt, kIdx) => (
                              <li
                                key={kIdx}
                                className="flex items-start gap-2 text-xs text-body"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 text-primary-400 shrink-0 mt-0.5" />
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
                </Card>
              ) : null}

              <div ref={streamEndRef} />

              {/* Single Clean Bottom Chat Input */}
              <Card
                variant="mixed"
                className="p-2.5 shadow-xl backdrop-blur-2xl"
              >
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendChatMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <Input
                    type="text"
                    variant="plain"
                    size="sm"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={isTutorThinking}
                    placeholder='Ask a question, ask for more examples, or type "skip"...'
                    className="flex-1 bg-transparent border-0 text-xs sm:text-sm"
                  />
                  <Button.Root
                    type="submit"
                    variant="solid"
                    intent="primary"
                    size="sm"
                    disabled={!chatInput.trim() || isTutorThinking}
                    className="shrink-0"
                  >
                    <Button.Icon type="leading">
                      <Send className="h-3.5 w-3.5" />
                    </Button.Icon>
                    <Button.Label>Ask</Button.Label>
                  </Button.Root>
                </form>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
