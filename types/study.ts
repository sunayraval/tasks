export type StudySubtopicState =
  | "locked"
  | "in_progress"
  | "mastered"
  | "skipped_known";

export type StudyModeStyle =
  | "syllabus"
  | "full_course"
  | "textbook"
  | "practice_quiz";

export type StudyAcademicLevel =
  | "College level"
  | "High School / AP"
  | "Graduate level"
  | "Beginner friendly";

export interface StudySubtopic {
  id: string;
  title: string;
  description?: string;
  estimatedMinutes?: number;
  state: StudySubtopicState;
}

export interface StudyModule {
  id: string;
  title: string;
  description?: string;
  subtopics: StudySubtopic[];
}

export interface StudySyllabus {
  id: string;
  topicQuery: string;
  title: string;
  overview: string;
  academicLevel?: StudyAcademicLevel;
  studyStyle?: StudyModeStyle;
  referenceNotes?: string;
  modules: StudyModule[];
  createdAt: string;
  updatedAt: string;
}

export type StudyVisualType =
  | "mermaid"
  | "svg"
  | "comparison_table"
  | "visual_cards";

export interface StudyVisualCardItem {
  title: string;
  badge?: string;
  points: string[];
  highlight?: string;
}

export interface StudyVisualPayload {
  type: StudyVisualType;
  title: string;
  caption?: string;
  mermaidCode?: string;
  svgCode?: string;
  tableHeaders?: string[];
  tableRows?: string[][];
  cards?: StudyVisualCardItem[];
}

export interface StudyMCQOption {
  id: string;
  label: string;
  text: string;
  isCorrect: boolean;
  explanation: string;
}

export interface StudyCheckpoint {
  id: string;
  subtopicId: string;
  questionType: "mcq" | "short_answer";
  question: string;
  hint?: string;
  options?: StudyMCQOption[];
  expectedKeyConcepts?: string[];
  sampleAnswer?: string;
  userSelectedOptionId?: string | null;
  userShortAnswer?: string | null;
  isAnswered?: boolean;
  isCorrect?: boolean | null;
  aiFeedback?: string | null;
}

export interface StudySyllabusMutation {
  action:
    | "skip_known"
    | "remove_subtopic"
    | "remove_module"
    | "add_subtopic"
    | "add_module"
    | "rename_subtopic"
    | "rename_module"
    | "mark_mastered";
  targetId?: string;
  targetTitle?: string;
  newTitle?: string;
  parentModuleId?: string;
  parentModuleTitle?: string;
  description?: string;
}

export interface StudyLessonTurn {
  id: string;
  role: "user" | "assistant";
  timestamp: string;
  subtopicId?: string | null;
  subtopicTitle?: string | null;
  moduleTitle?: string | null;
  content: string;
  keyTakeaways?: string[];
  visual?: StudyVisualPayload | null;
  checkpoint?: StudyCheckpoint | null;
  syllabusMutationsApplied?: string[];
  isRemediation?: boolean;
  evaluationResult?: {
    passed: boolean;
    feedback: string;
  } | null;
  modelUsed?: string;
}

export interface SavedStudyCourse {
  id: string;
  syllabus: StudySyllabus;
  turns: StudyLessonTurn[];
  sessionStarted: boolean;
  updatedAt: string;
}

export interface StudySessionState {
  syllabus: StudySyllabus | null;
  turns: StudyLessonTurn[];
  sessionStarted: boolean;
  savedCourses?: SavedStudyCourse[];
  updatedAt: string;
}

export interface SyllabusProgressMetrics {
  totalActive: number;
  masteredCount: number;
  skippedKnownCount: number;
  completedCount: number;
  lockedCount: number;
  inProgressCount: number;
  percentage: number;
  activeSubtopic: StudySubtopic | null;
  activeModule: StudyModule | null;
  activeSubtopicIndexGlobal: number;
  isComplete: boolean;
}

/**
 * Ensures exactly one uncompleted subtopic is marked `in_progress` (the first uncompleted one in syllabus order,
 * or `preferredSubtopicId` if provided and uncompleted), while all other uncompleted subtopics are `locked`.
 * Preserves `mastered` and `skipped_known` states.
 */
export function normalizeSyllabusStates(
  syllabus: StudySyllabus,
  preferredSubtopicId?: string | null
): StudySyllabus {
  let assignedInProgress = false;

  let canUsePreferred = false;
  if (preferredSubtopicId) {
    for (const mod of syllabus.modules) {
      for (const sub of mod.subtopics) {
        if (
          sub.id === preferredSubtopicId &&
          sub.state !== "mastered" &&
          sub.state !== "skipped_known"
        ) {
          canUsePreferred = true;
          break;
        }
      }
    }
  }

  let existingInProgressId: string | null = null;
  if (!canUsePreferred) {
    for (const mod of syllabus.modules) {
      for (const sub of mod.subtopics) {
        if (sub.state === "in_progress") {
          existingInProgressId = sub.id;
          break;
        }
      }
      if (existingInProgressId) break;
    }
  }

  const targetActiveId = canUsePreferred
    ? preferredSubtopicId
    : existingInProgressId;

  const updatedModules: StudyModule[] = syllabus.modules.map((mod) => ({
    ...mod,
    subtopics: mod.subtopics.map((sub) => {
      if (sub.state === "mastered" || sub.state === "skipped_known") {
        return sub;
      }
      if (!assignedInProgress) {
        if (targetActiveId ? sub.id === targetActiveId : true) {
          assignedInProgress = true;
          return { ...sub, state: "in_progress" as StudySubtopicState };
        }
      }
      return { ...sub, state: "locked" as StudySubtopicState };
    }),
  }));

  if (!assignedInProgress) {
    for (const mod of updatedModules) {
      for (let i = 0; i < mod.subtopics.length; i++) {
        const s = mod.subtopics[i];
        if (s.state === "locked") {
          mod.subtopics[i] = { ...s, state: "in_progress" };
          assignedInProgress = true;
          break;
        }
      }
      if (assignedInProgress) break;
    }
  }

  return {
    ...syllabus,
    modules: updatedModules,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Calculates real-time curriculum metrics:
 * progress = (mastered + skipped_known) / total_active_subtopics
 */
export function computeSyllabusProgress(
  syllabus: StudySyllabus | null
): SyllabusProgressMetrics {
  if (!syllabus) {
    return {
      totalActive: 0,
      masteredCount: 0,
      skippedKnownCount: 0,
      completedCount: 0,
      lockedCount: 0,
      inProgressCount: 0,
      percentage: 0,
      activeSubtopic: null,
      activeModule: null,
      activeSubtopicIndexGlobal: -1,
      isComplete: false,
    };
  }

  let totalActive = 0;
  let masteredCount = 0;
  let skippedKnownCount = 0;
  let lockedCount = 0;
  let inProgressCount = 0;
  let activeSubtopic: StudySubtopic | null = null;
  let activeModule: StudyModule | null = null;
  let activeSubtopicIndexGlobal = -1;
  let globalIdx = 0;

  for (const mod of syllabus.modules) {
    for (const sub of mod.subtopics) {
      totalActive++;
      if (sub.state === "mastered") {
        masteredCount++;
      } else if (sub.state === "skipped_known") {
        skippedKnownCount++;
      } else if (sub.state === "in_progress") {
        inProgressCount++;
        if (!activeSubtopic) {
          activeSubtopic = sub;
          activeModule = mod;
          activeSubtopicIndexGlobal = globalIdx;
        }
      } else {
        lockedCount++;
      }
      globalIdx++;
    }
  }

  if (!activeSubtopic && lockedCount > 0) {
    let fallbackIdx = 0;
    for (const mod of syllabus.modules) {
      for (const sub of mod.subtopics) {
        if (sub.state === "locked") {
          activeSubtopic = sub;
          activeModule = mod;
          activeSubtopicIndexGlobal = fallbackIdx;
          break;
        }
        fallbackIdx++;
      }
      if (activeSubtopic) break;
    }
  }

  const completedCount = masteredCount + skippedKnownCount;
  const percentage =
    totalActive > 0 ? Math.round((completedCount / totalActive) * 100) : 0;
  const isComplete = totalActive > 0 && completedCount === totalActive;

  return {
    totalActive,
    masteredCount,
    skippedKnownCount,
    completedCount,
    lockedCount,
    inProgressCount,
    percentage,
    activeSubtopic,
    activeModule,
    activeSubtopicIndexGlobal,
    isComplete,
  };
}
