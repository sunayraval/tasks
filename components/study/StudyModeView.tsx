"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  AIProvider,
  DEFAULT_NVIDIA_MODEL,
  NVIDIA_MODEL_OPTIONS,
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
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Cpu,
  FastForward,
  GraduationCap,
  KeyRound,
  Layers,
  Loader2,
  Menu,
  MessageSquare,
  Play,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  Trophy,
  Wand2,
  X,
  Zap,
} from "lucide-react";

const LOCAL_STUDY_SESSION_KEY = "flo_study_session_v1";

function makeLocalId(prefix = "id"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const EXAMPLE_STUDY_TOPICS = [
  {
    label: "Calculus: Limits, Derivatives & Chain Rule",
    prompt:
      "AP Calculus AB: Limits & continuity, power rule, product & quotient rules, chain rule, and implicit differentiation",
  },
  {
    label: "Biology: Cellular Respiration & ATP",
    prompt:
      "Cellular Respiration: Glycolysis, Pyruvate Oxidation, Citric Acid (Krebs) Cycle, Electron Transport Chain, and Chemiosmosis",
  },
  {
    label: "CS: Trees, Heaps & Graph Algorithms",
    prompt:
      "Data Structures & Algorithms: Binary Search Trees, Min/Max Heaps, Priority Queues, Breadth-First Search (BFS), and Depth-First Search (DFS)",
  },
  {
    label: "Macroeconomics: Supply, Demand & Monetary Policy",
    prompt:
      "Macroeconomics: Supply and demand equilibrium, price elasticity, inflation & CPI, fiscal policy vs. central bank monetary policy",
  },
  {
    label: "World History: Causes & Impact of WWI",
    prompt:
      "World War I: M.A.I.N. causes (Militarism, Alliances, Imperialism, Nationalism), trench warfare, US entry, and the Treaty of Versailles",
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
  const [topicInput, setTopicInput] = useState<string>("");
  const [syllabus, setSyllabus] = useState<StudySyllabus | null>(null);
  const [turns, setTurns] = useState<StudyLessonTurn[]>([]);
  const [sessionStarted, setSessionStarted] = useState<boolean>(false);

  const [isGeneratingSyllabus, setIsGeneratingSyllabus] =
    useState<boolean>(false);
  const [isTutorThinking, setIsTutorThinking] = useState<boolean>(false);
  const [lastTutorError, setLastTutorError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState<string>("");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [showNewTopicForm, setShowNewTopicForm] = useState<boolean>(false);
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

    if (workspaceConfig.studySession?.syllabus) {
      setSyllabus(workspaceConfig.studySession.syllabus);
      setTurns(workspaceConfig.studySession.turns || []);
      setSessionStarted(Boolean(workspaceConfig.studySession.sessionStarted));
      return;
    }

    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(LOCAL_STUDY_SESSION_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as StudySessionState;
          if (parsed && parsed.syllabus) {
            setSyllabus(parsed.syllabus);
            setTurns(parsed.turns || []);
            setSessionStarted(Boolean(parsed.sessionStarted));
          }
        }
      } catch {}
    }
  }, [workspaceConfig.studySession]);

  // 2. Persist Study Session whenever syllabus, turns, or sessionStarted changes
  const persistSession = useCallback(
    (
      nextSyllabus: StudySyllabus | null,
      nextTurns: StudyLessonTurn[],
      nextStarted: boolean
    ) => {
      const stateToSave: StudySessionState | null = nextSyllabus
        ? {
            syllabus: nextSyllabus,
            turns: nextTurns.slice(-30),
            sessionStarted: nextStarted,
            updatedAt: new Date().toISOString(),
          }
        : null;

      if (typeof window !== "undefined") {
        try {
          if (stateToSave) {
            localStorage.setItem(
              LOCAL_STUDY_SESSION_KEY,
              JSON.stringify(stateToSave)
            );
          } else {
            localStorage.removeItem(LOCAL_STUDY_SESSION_KEY);
          }
        } catch {}
      }

      onUpdateWorkspaceConfig({
        studySession: stateToSave,
      });
    },
    [onUpdateWorkspaceConfig]
  );

  // Scroll to newest lesson turn smoothly
  useEffect(() => {
    if (turns.length > 0) {
      streamEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [turns.length, isTutorThinking]);

  const progress = computeSyllabusProgress(syllabus);

  // ===========================================================================
  // Core AI Tutor Turn Request (with AbortController & Model Override Support)
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
      } = params;

      // Abort any previous in-flight request if switching models mid-flight
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

      let updatedTurns = [...turns];
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

    onShowToast(`Switched Study Mode model to ${label}`);

    // If tutor is currently thinking (hung/slow) or had an error, immediately abort & re-run with the new model!
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
    autoStartFirstLesson: boolean,
    overrideTopic?: string
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
      setShowNewTopicForm(false);

      if (autoStartFirstLesson) {
        setSessionStarted(true);
        persistSession(generatedSyllabus, [], true);
        setIsGeneratingSyllabus(false);
        await requestTutorTurn({
          currentSyllabus: generatedSyllabus,
          actionType: "start_or_continue",
        });
      } else {
        setSessionStarted(false);
        persistSession(generatedSyllabus, [], false);
        onShowToast(
          "Curriculum generated! Review or edit your syllabus, then click Start Studying."
        );
      }
    } catch (err) {
      console.error("[StudyModeView] Syllabus generation error:", err);
      onShowToast("Failed to generate syllabus.");
    } finally {
      setIsGeneratingSyllabus(false);
    }
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
  // Reusable Model Selector Dropdown Component
  // ===========================================================================
  const ModelSelectorDropdown = (
    <div className="relative">
      <button
        type="button"
        onClick={() => setModelDropdownOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-semibold text-highlight hover:bg-primary/25 transition-colors"
        title="Choose AI Tutor Model (NVIDIA NIM or Google Gemini)"
      >
        <Cpu className="h-3.5 w-3.5 text-primary" />
        <span className="truncate max-w-[140px]">{activeModelLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 text-white/60" />
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
                  onClick={() => handleSelectModel("nvidia", m.id, undefined, true)}
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

  const showEntryScreen = !syllabus || showNewTopicForm;

  return (
    <div className="flex flex-col space-y-4">
      {/* =====================================================================
          TOP ANCHORED REAL-TIME STUDY PROGRESS BAR + MODEL SELECTOR
         ===================================================================== */}
      {syllabus && !showNewTopicForm && (
        <div className="sticky top-14 z-20 rounded-2xl border theme-panel px-4 py-3 backdrop-blur-2xl shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: Brand & Active Syllabus Title */}
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setMobileDrawerOpen((v) => !v)}
                className="lg:hidden inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 p-2 text-white/80 hover:text-white"
                title="Toggle Master Syllabus Drawer"
              >
                <Menu className="h-4 w-4 text-primary" />
              </button>

              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/45 bg-primary/20 px-2.5 py-0.5 text-[11px] font-mono font-bold text-highlight shrink-0">
                  <GraduationCap className="h-3.5 w-3.5 text-primary" />
                  flo study
                </span>
                <h2 className="text-sm sm:text-base font-extrabold text-white truncate">
                  {syllabus.title}
                </h2>
              </div>
            </div>

            {/* Center/Right: Progress Bar, Model Selector & New Topic */}
            <div className="flex flex-1 items-center justify-end gap-2.5 min-w-[260px]">
              <div className="flex-1 max-w-xs sm:max-w-sm space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-white/75">
                    Mastery:{" "}
                    <strong className="text-white">
                      {progress.completedCount}
                    </strong>
                    /{progress.totalActive}
                  </span>
                  <span className="font-bold text-highlight">
                    {progress.percentage}%
                  </span>
                </div>

                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/10 border border-white/10">
                  <progress
                    aria-label="Study Mode curriculum completion progress"
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
                      boxShadow: "0 0 12px var(--primary)",
                    }}
                  />
                </div>
              </div>

              {/* Live Model Selector Dropdown */}
              {ModelSelectorDropdown}

              <button
                type="button"
                onClick={() => {
                  setTopicInput(syllabus.topicQuery || "");
                  setShowNewTopicForm(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:text-white hover:border-primary/45 transition-colors shrink-0"
                title="Start a new study topic or replace curriculum"
              >
                <Plus className="h-3.5 w-3.5 text-primary" />
                <span className="hidden sm:inline">New Topic</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          STATE 1: TOPIC INGESTION ENTRY SCREEN
         ===================================================================== */}
      {showEntryScreen ? (
        <div className="mx-auto w-full max-w-3xl py-6 sm:py-10">
          <div className="rounded-3xl border theme-panel p-6 sm:p-8 shadow-2xl backdrop-blur-2xl space-y-6">
            {/* Top Bar with Model Selector */}
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/15 px-3.5 py-1 text-xs font-mono font-bold text-highlight">
                <GraduationCap className="h-4 w-4 text-primary" />
                <span>flo study • Interactive AI Tutor</span>
              </div>
              {ModelSelectorDropdown}
            </div>

            <div className="space-y-2 text-center">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                What do you want to master today?
              </h1>
              <p className="mx-auto max-w-xl text-xs sm:text-sm text-white/65 leading-relaxed">
                Enter your study topics, paste syllabus notes, or list exam
                focus areas.{" "}
                <strong className="text-white">flo study</strong> breaks them
                into an editable micro-curriculum and teaches you step-by-step
                with concrete formulas, worked examples, visual diagrams, and
                comprehension checkpoints.
              </p>
            </div>

            {!hasApiKey && (
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
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
                  className="rounded-lg bg-amber-400 px-3 py-1.5 font-bold text-black hover:brightness-110 shrink-0"
                >
                  Configure Key
                </button>
              </div>
            )}

            {/* Topic Input Textarea */}
            <div className="space-y-2.5">
              <label
                htmlFor="flo-study-topic-input"
                className="block text-xs font-bold uppercase tracking-wider text-white/75"
              >
                Study Topics, Syllabus Notes, or Exam Focus Areas
              </label>
              <textarea
                id="flo-study-topic-input"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                rows={4}
                placeholder="e.g., AP Calculus AB: Limits & continuity, evaluating limits algebraically (factoring & conjugates), one-sided limits, and graphical interpretation..."
                className="w-full rounded-2xl border border-white/15 bg-black/50 p-4 text-sm text-white placeholder:text-white/35 focus:border-primary focus:outline-none leading-relaxed"
              />
            </div>

            {/* Example Topic Quick Chips */}
            <div className="space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-white/50">
                Or try an example curriculum:
              </div>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_STUDY_TOPICS.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setTopicInput(item.prompt)}
                    className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-1.5 text-left text-xs text-zinc-200 hover:border-primary/50 hover:bg-primary/15 hover:text-white transition-all"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              {syllabus && showNewTopicForm ? (
                <button
                  type="button"
                  onClick={() => setShowNewTopicForm(false)}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white/75 hover:text-white"
                >
                  ← Back to Active Session
                </button>
              ) : (
                <div />
              )}

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={!topicInput.trim() || isGeneratingSyllabus}
                  onClick={() => handleGenerateSyllabus(false)}
                  className="inline-flex items-center gap-2 rounded-xl border border-primary/45 bg-primary/15 px-4 py-2.5 text-xs font-bold text-highlight hover:bg-primary/25 transition-all disabled:opacity-40"
                >
                  <Layers className="h-4 w-4 text-primary" />
                  <span>Generate &amp; Customize Syllabus First</span>
                </button>

                <button
                  type="button"
                  disabled={!topicInput.trim() || isGeneratingSyllabus}
                  onClick={() => handleGenerateSyllabus(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs sm:text-sm font-bold text-black hover:brightness-110 transition-all shadow-neon disabled:opacity-40"
                >
                  {isGeneratingSyllabus ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Building Curriculum ({activeModelLabel})...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      <span>Generate Syllabus &amp; Start Studying</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ===================================================================
           STATE 2 & 3: PERSISTENT EDITABLE SYLLABUS SIDEBAR + LESSON STREAM
           =================================================================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Desktop Persistent Master Syllabus Sidebar */}
          <div className="hidden lg:block lg:col-span-4 xl:col-span-4 sticky top-32 max-h-[calc(100vh-9.5rem)]">
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

          {/* Right Column: Active Lesson Workspace & Interactive Stream */}
          <div className="lg:col-span-8 xl:col-span-8 flex flex-col space-y-4">
            {/* Active Subtopic Quick Control Bar */}
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

                {/* Direct Active Subtopic Actions: "I already know this" & "Don't want to learn" */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isTutorThinking}
                    onClick={() =>
                      handleToggleSkipKnown(progress.activeSubtopic!.id)
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 transition-colors disabled:opacity-40"
                    title="Mark this subtopic as Already Known and advance to the next one"
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
                      title="Remove this subtopic from the active curriculum"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Remove</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Pre-Session Curriculum Review Card (if session hasn't started teaching yet) */}
            {!sessionStarted && turns.length === 0 && !isTutorThinking && (
              <div className="rounded-2xl border theme-panel p-6 backdrop-blur-xl space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-highlight">
                      <Sparkles className="h-3 w-3 text-primary" />
                      Curriculum Ready
                    </span>
                    <h3 className="text-lg font-extrabold text-white">
                      {syllabus.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-white/70 leading-relaxed">
                      {syllabus.overview}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/35 p-4 text-xs text-zinc-300 space-y-1.5">
                  <div className="font-bold text-white">
                    Full Manual Control — Before &amp; During Your Session:
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-white/75">
                    <li>
                      <strong>Rename or Reorder:</strong> Click the pencil icon
                      or drag/move any module or subtopic in the{" "}
                      <strong>Master Syllabus</strong> sidebar.
                    </li>
                    <li>
                      <strong>Skip What You Know:</strong> Click{" "}
                      <span className="text-amber-200 font-semibold">
                        Know it
                      </span>{" "}
                      or{" "}
                      <span className="text-amber-200 font-semibold">
                        I already know this
                      </span>{" "}
                      to count a subtopic toward completion without being taught
                      it.
                    </li>
                    <li>
                      <strong>Prune Unwanted Topics:</strong> Click the trash
                      icon on any subtopic or module you don&apos;t want to
                      learn to permanently remove it from the progress
                      denominator.
                    </li>
                  </ul>
                </div>

                {progress.activeSubtopic && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      disabled={isTutorThinking}
                      onClick={() => {
                        setSessionStarted(true);
                        requestTutorTurn({
                          currentSyllabus: syllabus,
                          actionType: "start_or_continue",
                          targetSubtopicId: progress.activeSubtopic!.id,
                        });
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs sm:text-sm font-bold text-black hover:brightness-110 transition-all shadow-neon"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      <span>
                        Start Micro-Lesson 1: {progress.activeSubtopic.title}
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
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
                        <div className="leading-relaxed">{turn.content}</div>
                      </div>
                    </div>
                  );
                }

                return (
                  <article
                    key={turn.id}
                    className="rounded-2xl border theme-panel p-4 sm:p-6 shadow-xl backdrop-blur-2xl space-y-4"
                  >
                    {/* Turn Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-highlight">
                          <BookOpen className="h-3 w-3 text-primary" />
                          {turn.isRemediation
                            ? "Adaptive Remediation"
                            : "Micro-Lesson"}
                        </span>
                        {turn.subtopicTitle && (
                          <span className="text-xs sm:text-sm font-extrabold text-white">
                            {turn.subtopicTitle}
                          </span>
                        )}
                        {turn.moduleTitle && (
                          <span className="rounded-lg bg-white/5 px-2 py-0.5 text-[11px] font-mono text-white/60">
                            {turn.moduleTitle}
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

                    {/* Applied Syllabus Mutation Pills */}
                    {turn.syllabusMutationsApplied &&
                      turn.syllabusMutationsApplied.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {turn.syllabusMutationsApplied.map((mText, mIdx) => (
                            <span
                              key={mIdx}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                              {mText}
                            </span>
                          ))}
                        </div>
                      )}

                    {/* Evaluation Feedback Banner */}
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
                                Previous Subtopic Mastered! Advancing to Next
                                Micro-Lesson:
                              </span>
                            </>
                          ) : (
                            <>
                              <RotateCcw className="h-4 w-4 text-amber-400" />
                              <span>
                                Let&apos;s Clarify That Before Moving Forward:
                              </span>
                            </>
                          )}
                        </div>
                        <div>{turn.evaluationResult.feedback}</div>
                      </div>
                    )}

                    {/* Main Lesson Markdown + LaTeX + Worked Examples */}
                    <StudyMarkdown content={turn.content} />

                    {/* Key Takeaways Box */}
                    {turn.keyTakeaways && turn.keyTakeaways.length > 0 && (
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

                    {/* Inline Visualization */}
                    {turn.visual && (
                      <StudyVisualRenderer visual={turn.visual} />
                    )}

                    {/* Mandatory Interactive Comprehension Gate */}
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
                                  targetSubtopicId: progress.activeSubtopic!.id,
                                })
                            : undefined
                        }
                      />
                    )}
                  </article>
                );
              })}

              {/* =============================================================
                  AI TUTOR THINKING INDICATOR WITH LIVE MODEL SWITCHER
                  Allows user to switch models on the spot if a model is slow!
                 ============================================================= */}
              {isTutorThinking && (
                <div className="rounded-2xl border border-primary/40 theme-panel p-5 space-y-3.5 shadow-xl">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-white">
                          flo study Tutor is preparing your micro-lesson, worked
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

                  {/* Instant 1-Click Fast Model Switch Pills right inside the loading box */}
                  <div className="border-t border-white/10 pt-3 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-mono text-white/55 mr-1 flex items-center gap-1">
                      <Zap className="h-3 w-3 text-amber-400" />
                      Taking too long? Switch &amp; retry instantly:
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
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-mono text-white/60 mr-1">
                      Or switch to a faster model:
                    </span>
                    {[
                      {
                        id: "google/gemma-4-31b-it",
                        label: "Gemma 4 31B (Fast)",
                      },
                      {
                        id: "google/gemma-3-12b-it",
                        label: "Gemma 3 12B (Ultra Fast)",
                      },
                      {
                        id: "nvidia/nemotron-3.5-bolt-e4b",
                        label: "Nemotron Bolt",
                      },
                      {
                        id: "mistralai/mistral-large-4-1t-a52b",
                        label: "Mistral Large 4",
                      },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          handleSelectModel("nvidia", opt.id, undefined, true)
                        }
                        className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white hover:border-primary/50 hover:bg-primary/20"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 100% Curriculum Completion Celebration Card */}
              {progress.isComplete && (
                <div className="rounded-2xl border border-emerald-400/50 bg-emerald-950/30 p-6 text-center space-y-3 shadow-2xl">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-400/50">
                    <Trophy className="h-6 w-6 text-emerald-300" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-white">
                    100% Active Curriculum Mastered!
                  </h3>
                  <p className="mx-auto max-w-lg text-xs sm:text-sm text-emerald-100/80 leading-relaxed">
                    You&apos;ve completed all{" "}
                    <strong>{progress.totalActive}</strong> active subtopics in{" "}
                    <strong>{syllabus.title}</strong> ({progress.masteredCount}{" "}
                    mastered via checkpoints, {progress.skippedKnownCount}{" "}
                    marked already known).
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTopicInput("");
                        setShowNewTopicForm(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-4 py-2 text-xs font-bold text-black hover:brightness-110 transition-all"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Start Another Study Topic</span>
                    </button>
                  </div>
                </div>
              )}

              <div ref={streamEndRef} />
            </div>

            {/* ===============================================================
                BOTTOM NATURAL LANGUAGE CHAT & OVERRIDE BAR
               =============================================================== */}
            <div className="sticky bottom-3 z-20 rounded-2xl border theme-panel p-3 shadow-2xl backdrop-blur-2xl space-y-2.5">
              {/* Quick Natural-Language Override Chips */}
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
                <button
                  type="button"
                  disabled={isTutorThinking || progress.isComplete}
                  onClick={() =>
                    handleSendChatMessage(
                      "Explain this concept with a simpler real-world analogy"
                    )
                  }
                  className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/75 hover:border-primary/40 hover:text-white transition-colors disabled:opacity-40"
                >
                  &ldquo;Explain with a simpler analogy&rdquo;
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
                    &ldquo;Remove this topic, I don&apos;t need to learn
                    it&rdquo;
                  </button>
                )}
              </div>

              {/* Chat Form */}
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
      )}
    </div>
  );
};
