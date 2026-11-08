import { NextResponse } from "next/server";
import { generateObject, generateText, tool, CoreMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import {
  AgentExecutedAction,
  AgentQAPrompt,
  AgentWorkspaceMutationPayload,
  AIModelChoice,
  AITone,
  BADGE_COLOR_KEYS,
  BadgeColorKey,
  DEFAULT_WORKSPACE_CONFIG,
  MyDayBlock,
  MyDaySchedule,
  normalizeVideoPreset,
  QASubmissionPayload,
  TaskItem,
  THEME_OPTIONS,
  ThemeName,
  UserProfile,
  VideoPresetName,
  ViewMode,
  WorkspaceConfig,
  WorkspaceTab,
} from "@/types/taskit";
import {
  addMinutesToTime,
  cascadeFromBlockIndex,
  computeDurationMinutes,
  computeMyDayLiveTelemetry,
  formatDurationCompact,
  formatTime12h,
  makeBlockId,
  minutesToTimeString,
  normalizeTimeString,
  parseTimeToMinutes,
  recommendTaskMinutes,
  shiftScheduleBlocks,
  smartHeuristicArrange,
  swapScheduleBlocks,
} from "@/utils/myDayUtils";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

const TONE_PROMPTS: Record<AITone, string> = {
  locked_in:
    "Tone: LOCKED IN — crisp, focused, tactical, high-agency partner. Zero fluff, clear priorities, sharp execution.",
  chill_coach:
    "Tone: CHILL COACH — warm, calm, encouraging, low-stress productivity partner. Supportive pacing and clarity.",
  hyper_drive:
    "Tone: HYPER DRIVE — energetic, fast-paced, momentum-oriented coach. Celebrate wins and drive rapid progress.",
  executive:
    "Tone: EXECUTIVE — strategic, structured, analytical chief-of-staff. Emphasize leverage, time blocks, and clarity.",
};

function makeUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function stripHeaderDecorations(title: string): string {
  return title
    .replace(/^[—\-=\s✨📅⏰🔔🚀📌🔥🎯]+/g, "")
    .replace(/[—\-=\s✨📅⏰🔔🚀📌🔥🎯]+$/g, "")
    .trim();
}

function isHeaderRow(t: TaskItem): boolean {
  return Boolean(t.custom_properties?.is_header);
}

function isDoneStatus(status: string): boolean {
  const s = (status || "").trim().toLowerCase();
  return s === "done" || s === "completed" || s === "complete";
}

function isEmptyBoardDayPlanRequest(rawMsg: string): boolean {
  const msg = (rawMsg || "").trim();
  if (!msg) return false;
  const lower = msg.toLowerCase();

  // Standard quick-prompt chip for auto-arranging active tasks when board is empty
  if (lower.includes("auto-arrange all my active tasks")) {
    return true;
  }

  // If the user already supplied concrete tasks in their prompt (e.g. colon list, multi-comma list, or explicit "add ..."), let the agent process them directly
  if (
    msg.includes(":") ||
    msg.includes("\n") ||
    /\b(i need to|i have to|i gotta|add\s+these|tasks\s+are)\b/i.test(lower) ||
    ((msg.match(/,/g) || []).length >= 2 && msg.length > 60)
  ) {
    return false;
  }

  return (
    /\b(plan|arrange|auto[- ]?arrange|schedule|build|set\s*up|organize|structure|map\s*out|figure\s*out)\b[\s\S]{0,40}\b(my\s+day|the\s+day|today|my\s+schedule|today'?s\s+schedule|daily\s+plan|my\s+my\s+day)\b/i.test(
      lower
    ) ||
    /\b(help\s+(me\s+)?plan(\s+out)?|what\s+should\s+i\s+(work\s+on|do)\s+today|plan\s+today)\b/i.test(
      lower
    )
  );
}

function buildEmptyBoardDayQAPrompt(
  originalRequest: string,
  defaultStartHHMM: string,
  defaultEndHHMM: string
): AgentQAPrompt {
  return {
    id: `qa-${Date.now()}`,
    purpose: "plan_day",
    originalRequest,
    consentTitle: "Can I ask a few questions to fulfill your request?",
    consentSubtitle:
      "You don't have any active tasks on your list yet. Answer a few quick questions so I can gauge your tasks for today, populate your Tasks list, and build your my day schedule.",
    submitLabel: "Populate Tasks & Build my day",
    status: "consent",
    questions: [
      {
        id: "tasks_braindump",
        question:
          "What tasks, assignments, or errands do you want to accomplish today?",
        helperText:
          "List anything on your plate (comma-separated or one per line)—I'll infer priorities, categories, and durations automatically.",
        inputType: "textarea",
        required: true,
        quickChips: [
          "Study / Homework",
          "Deep Work / Project",
          "Meetings / Calls",
          "Errands & Admin",
          "Workout / Health",
          "Emails & Follow-ups",
        ],
        placeholder:
          "e.g., Finish calc problem set, write history outline, 45m workout, reply to internship emails...",
      },
      {
        id: "priority_order",
        question: "How should I prioritize and sequence your day?",
        inputType: "single_choice",
        options: [
          "Hardest / highest-impact task first",
          "Quick wins first to build momentum",
          "Strict deadline & urgency order",
          "Balanced mix of deep focus & lighter tasks",
        ],
      },
      {
        id: "day_timeframe",
        question: "What timeframe do you want scheduled in my day?",
        helperText:
          "Choose a quick window or set your exact start and planned end times.",
        inputType: "timeframe",
        defaultStartTime: defaultStartHHMM,
        defaultEndTime: defaultEndHHMM,
      },
      {
        id: "pacing_style",
        question: "How should your focus blocks and breaks be paced?",
        inputType: "single_choice",
        options: [
          "Focused 45–60m blocks + short recharge breaks",
          "Deep 90m flow blocks + breaks",
          "30m Pomodoro sprints + 5–10m breaks",
          "Back-to-back blocks (no breaks)",
        ],
      },
    ],
  };
}

function parseFallbackTaskTitles(rawAnswer: string): string[] {
  return rawAnswer
    .split(/[\n;,]+/)
    .map((s) => s.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((s) => s.length >= 2)
    .slice(0, 12);
}

function formatHeaderTitle(raw: string): string {
  const cleaned = stripHeaderDecorations(raw);
  if (!cleaned) return "——— ✨ NEW SECTION ———";
  if (raw.trim().startsWith("———")) return raw.trim();
  return `——— ${cleaned} ———`;
}

function parseFlexibleDueDate(
  raw: string | undefined,
  clientNowMs: number,
  tzOffsetMinutes: number
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (
    !trimmed ||
    trimmed.toLowerCase() === "none" ||
    trimmed.toLowerCase() === "null" ||
    trimmed.toLowerCase() === "clear"
  ) {
    return null;
  }

  // Construct client-local calendar date helper
  const localMs = clientNowMs - tzOffsetMinutes * 60 * 1000;
  const localRef = new Date(localMs);
  const buildEndOfLocalDayISO = (daysFromToday: number): string => {
    const targetUtcMs =
      Date.UTC(
        localRef.getUTCFullYear(),
        localRef.getUTCMonth(),
        localRef.getUTCDate() + daysFromToday,
        23,
        59,
        0
      ) +
      tzOffsetMinutes * 60 * 1000;
    return new Date(targetUtcMs).toISOString();
  };

  const lower = trimmed.toLowerCase();
  if (lower === "today" || lower === "tonight") {
    return buildEndOfLocalDayISO(0);
  }
  if (lower === "tomorrow" || lower === "tmr") {
    return buildEndOfLocalDayISO(1);
  }
  if (lower === "day after tomorrow") {
    return buildEndOfLocalDayISO(2);
  }

  // Match YYYY-MM-DD explicitly in user's local timezone at 23:59
  const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const utcMs =
      Date.UTC(year, month, day, 23, 59, 0) + tzOffsetMinutes * 60 * 1000;
    return new Date(utcMs).toISOString();
  }

  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }
  return null;
}

function extractCleanErrorMessage(err: unknown): {
  status: number;
  message: string;
  isKeyError: boolean;
} {
  const raw = err instanceof Error ? err.message : String(err || "");
  const lower = raw.toLowerCase();
  if (
    lower.includes("api_key_invalid") ||
    lower.includes("api key not valid") ||
    lower.includes("invalid api key") ||
    lower.includes("permission_denied") ||
    lower.includes("unauthenticated")
  ) {
    return {
      status: 401,
      message:
        "Your Google AI API key was rejected by Google Gemini. Please verify your key in Settings → AI (keys start with AIza...).",
      isKeyError: true,
    };
  }
  if (lower.includes("quota") || lower.includes("rate limit") || lower.includes("429")) {
    return {
      status: 429,
      message:
        "Google Gemini rate limit reached for this API key. Wait a few seconds or switch to Flash mode and try again.",
      isKeyError: false,
    };
  }
  return {
    status: 500,
    message: raw || "Failed to reach Google Gemini API.",
    isKeyError: false,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mode: string = body.mode || "chat";
    const customApiKey: string = (body.customApiKey || "").trim();

    // -------------------------------------------------------------------------
    // MODE 1: Live API Key Verification
    // -------------------------------------------------------------------------
    if (mode === "verify") {
      if (!customApiKey || customApiKey.length < 20) {
        return NextResponse.json(
          {
            valid: false,
            error:
              "Please enter a complete Google AI Studio API key (usually ~39 characters starting with AIza...).",
          },
          { status: 400 }
        );
      }

      const google = createGoogleGenerativeAI({ apiKey: customApiKey });
      const verifyCandidates = [
        "gemini-3.8-flash",
        "gemini-1.5-flash",
        "gemini-2.5-flash",
      ];
      let lastErr: unknown = null;

      for (const candidateModel of verifyCandidates) {
        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Timeout verifying on ${candidateModel}`)),
              3500
            )
          );

          await Promise.race([
            generateText({
              model: google(candidateModel),
              prompt: "Reply with OK",
              maxTokens: 5,
            }),
            timeoutPromise,
          ]);

          return NextResponse.json({
            valid: true,
            model: candidateModel,
          });
        } catch (err) {
          lastErr = err;
          const info = extractCleanErrorMessage(err);
          if (info.isKeyError) {
            return NextResponse.json(
              { valid: false, error: info.message },
              { status: 401 }
            );
          }
        }
      }

      const finalErr = extractCleanErrorMessage(lastErr);
      return NextResponse.json(
        { valid: false, error: finalErr.message },
        { status: finalErr.status }
      );
    }

    // -------------------------------------------------------------------------
    // MODE 1.5: AI Auto-Arrange MY DAY Schedule
    // -------------------------------------------------------------------------
    if (mode === "auto_arrange_day") {
      const selectedTasks: TaskItem[] = (
        Array.isArray(body.tasks) ? (body.tasks as TaskItem[]) : []
      ).filter((t) => !isHeaderRow(t));
      const startTime = normalizeTimeString(body.startTime, "09:00");
      const endTime = normalizeTimeString(body.endTime, "17:00");
      const includeBreaks = Boolean(body.includeBreaks);
      const windowMins = computeDurationMinutes(startTime, endTime);

      if (selectedTasks.length === 0) {
        return NextResponse.json({
          blocks: [],
          summary: "No tasks were provided to arrange.",
        });
      }

      if (!customApiKey || customApiKey.length < 20) {
        const fallback = smartHeuristicArrange({
          tasks: selectedTasks,
          startTime,
          endTime,
          includeBreaks,
        });
        return NextResponse.json(fallback);
      }

      const google = createGoogleGenerativeAI({ apiKey: customApiKey });
      const arrangeCandidates = [
        "gemini-3.8-flash",
        "gemini-1.5-flash",
        "gemini-2.5-flash",
      ];

      const taskLines = selectedTasks
        .map((t, i) => {
          const rec = recommendTaskMinutes(t);
          return `${i + 1}. ID="${t.id}" | Title="${t.title}" | Priority="${
            t.priority
          }" | Category="${t.type}" | RecommendedMinutes=${rec}${
            t.due_date ? ` | Due=${t.due_date.slice(0, 10)}` : ""
          }`;
        })
        .join("\n");

      const arrangeSchema = z.object({
        summary: z
          .string()
          .describe(
            "Concise 1-2 sentence explanation of how tasks were ordered and fitted into the schedule window"
          ),
        blocks: z.array(
          z.object({
            taskId: z
              .string()
              .nullable()
              .describe(
                "Exact ID of the task from the list, or null ONLY if this is a short recharge break"
              ),
            title: z.string(),
            startTime: z
              .string()
              .describe("24-hour HH:mm format, e.g. 09:00 or 14:30"),
            endTime: z
              .string()
              .describe("24-hour HH:mm format, e.g. 09:45 or 15:15"),
            notes: z.string().optional(),
            isBreak: z.boolean().optional(),
          })
        ),
      });

      const arrangePrompt = `Arrange ALL ${
        selectedTasks.length
      } tasks below into an optimal, non-overlapping daily schedule starting at ${startTime} (${formatTime12h(
        startTime
      )}) with planned end time ${endTime} (${formatTime12h(
        endTime
      )}, total window = ${windowMins} minutes).

RULES:
1. Include EVERY task from the list below exactly once, using its exact taskId.
2. Base each task's slot length on its RecommendedMinutes. If total task durations exceed ${windowMins} minutes, scale durations proportionally (minimum 15m per task) so the schedule fits cleanly and sequentially starting at ${startTime}.
3. Front-load Urgent/High-priority tasks and imminent deadlines during peak focus, and alternate heavy cognitive tasks sensibly.
4. ${
        includeBreaks
          ? "Insert short 10-minute recharge breaks (taskId: null, isBreak: true) after ~80-95 minutes of continuous deep work ONLY if window time permits."
          : "Do NOT insert break blocks; schedule tasks back-to-back."
      }
5. Use strict 24-hour HH:mm strings for startTime and endTime in chronological order without overlaps.

TASKS TO SCHEDULE:
${taskLines}`;

      for (const candidateModel of arrangeCandidates) {
        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Timeout on ${candidateModel}`)),
              7000
            )
          );

          const res = await Promise.race([
            generateObject({
              model: google(candidateModel),
              schema: arrangeSchema,
              prompt: arrangePrompt,
            }),
            timeoutPromise,
          ]);

          const taskById = new Map(selectedTasks.map((t) => [t.id, t]));
          const seenTaskIds = new Set<string>();
          const normalizedBlocks: MyDayBlock[] = [];

          for (const raw of res.object.blocks) {
            const matchedTask = raw.taskId
              ? taskById.get(raw.taskId) ||
                selectedTasks.find(
                  (t) =>
                    !seenTaskIds.has(t.id) &&
                    t.title.toLowerCase() === raw.title.trim().toLowerCase()
                )
              : undefined;

            if (matchedTask) {
              seenTaskIds.add(matchedTask.id);
            }

            const sTime = normalizeTimeString(raw.startTime, startTime);
            const eTime = normalizeTimeString(
              raw.endTime,
              addMinutesToTime(
                sTime,
                matchedTask ? recommendTaskMinutes(matchedTask) : 15
              )
            );
            const dur = computeDurationMinutes(sTime, eTime);

            normalizedBlocks.push({
              id: makeBlockId(),
              taskId: matchedTask ? matchedTask.id : null,
              title: matchedTask ? matchedTask.title : raw.title,
              startTime: sTime,
              endTime: eTime,
              durationMinutes: dur,
              category: matchedTask
                ? matchedTask.type
                : raw.isBreak
                ? "Break"
                : "Focus",
              priority: matchedTask ? matchedTask.priority : "Low",
              notes: raw.notes || matchedTask?.notes || "",
              completed: matchedTask ? isDoneStatus(matchedTask.status) : false,
              isBreak: Boolean(raw.isBreak && !matchedTask),
            });
          }

          // Guarantee no selected task was accidentally omitted by the LLM
          let appendCursor =
            normalizedBlocks.length > 0
              ? normalizedBlocks[normalizedBlocks.length - 1].endTime
              : startTime;

          for (const t of selectedTasks) {
            if (!seenTaskIds.has(t.id)) {
              const rec = recommendTaskMinutes(t);
              const nextEnd = addMinutesToTime(appendCursor, rec);
              normalizedBlocks.push({
                id: makeBlockId(),
                taskId: t.id,
                title: t.title,
                startTime: appendCursor,
                endTime: nextEnd,
                durationMinutes: rec,
                category: t.type,
                priority: t.priority,
                notes: t.notes || "",
                completed: isDoneStatus(t.status),
                isBreak: false,
              });
              appendCursor = nextEnd;
            }
          }

          return NextResponse.json({
            blocks: normalizedBlocks,
            summary: res.object.summary,
            modelUsed: candidateModel,
          });
        } catch (err) {
          const info = extractCleanErrorMessage(err);
          if (info.isKeyError) {
            return NextResponse.json(
              { error: "INVALID_API_KEY", message: info.message },
              { status: 401 }
            );
          }
        }
      }

      const fallback = smartHeuristicArrange({
        tasks: selectedTasks,
        startTime,
        endTime,
        includeBreaks,
      });
      return NextResponse.json(fallback);
    }

    // -------------------------------------------------------------------------
    // MODE 2: Full Workspace Agent Chat
    // -------------------------------------------------------------------------
    if (!customApiKey || customApiKey.length < 20) {
      return NextResponse.json(
        {
          error: "MISSING_API_KEY",
          reply: "Please add your Google AI API key to use this feature.",
        },
        { status: 401 }
      );
    }

    const userMessage: string = (body.message || "").trim();
    if (!userMessage) {
      return NextResponse.json(
        { error: "Empty message" },
        { status: 400 }
      );
    }

    const incomingTasks: TaskItem[] = Array.isArray(body.tasks)
      ? body.tasks
      : [];
    const userId: string = body.userId || "user-default";
    const tone: AITone = body.tone || "locked_in";
    const modelChoice: AIModelChoice =
      body.modelChoice === "pro" ? "pro" : "flash";
    const currentTheme: ThemeName = body.theme || "cyber_ocean";
    const videoPreset: VideoPresetName = normalizeVideoPreset(body.videoPreset);
    const videoDim: number =
      typeof body.videoDim === "number" ? body.videoDim : 0.45;
    const videoBlur: number =
      typeof body.videoBlur === "number" ? body.videoBlur : 6;
    const viewMode: ViewMode = body.viewMode || "slide_drawer";
    const incomingConfig: WorkspaceConfig = {
      ...DEFAULT_WORKSPACE_CONFIG,
      ...(body.workspaceConfig || {}),
    };
    const history: Array<{ role: "user" | "assistant"; content: string }> =
      Array.isArray(body.history) ? body.history : [];
    const qaSubmission: QASubmissionPayload | null =
      body.qaSubmission && Array.isArray(body.qaSubmission.answers)
        ? body.qaSubmission
        : null;

    const clientISO: string = body.clientISO || new Date().toISOString();
    const clientNowMs = !isNaN(new Date(clientISO).getTime())
      ? new Date(clientISO).getTime()
      : Date.now();
    const tzOffsetMinutes: number =
      typeof body.clientTimezoneOffset === "number"
        ? body.clientTimezoneOffset
        : 0;
    const clientLocalDateReadable: string =
      body.clientLocalDateReadable ||
      new Date(clientNowMs).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

    const localClockRef = new Date(clientNowMs - tzOffsetMinutes * 60 * 1000);
    const clientLocalMinutesOfDay =
      localClockRef.getUTCHours() * 60 +
      localClockRef.getUTCMinutes() +
      localClockRef.getUTCSeconds() / 60;
    const clientLocalTimeHHMM = minutesToTimeString(
      Math.floor(clientLocalMinutesOfDay)
    );
    const roundedStartMins =
      (Math.ceil(clientLocalMinutesOfDay / 15) * 15) % (24 * 60);
    const defaultStartHHMM = minutesToTimeString(roundedStartMins);
    const defaultEndHHMM = addMinutesToTime(defaultStartHHMM, 240);
    const clientLocalDateYMD = `${localClockRef.getUTCFullYear()}-${String(
      localClockRef.getUTCMonth() + 1
    ).padStart(2, "0")}-${String(localClockRef.getUTCDate()).padStart(2, "0")}`;

    // Mutable working copies across multi-step tool calls in this turn
    let workingTasks: TaskItem[] = incomingTasks
      .map((t) => ({
        ...t,
        tags: Array.isArray(t.tags) ? [...t.tags] : [],
        custom_properties: { ...(t.custom_properties || {}) },
      }))
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

    let workingConfig: WorkspaceConfig = {
      ...incomingConfig,
      columnHeaders: { ...incomingConfig.columnHeaders },
      sections: [...incomingConfig.sections],
      statuses: [...incomingConfig.statuses],
      types: [...incomingConfig.types],
      priorities: [...incomingConfig.priorities],
      tags: [...incomingConfig.tags],
      myDaySchedule: incomingConfig.myDaySchedule
        ? {
            ...incomingConfig.myDaySchedule,
            blocks: incomingConfig.myDaySchedule.blocks.map((b) => ({ ...b })),
          }
        : null,
    };

    const activeRealTasks = workingTasks.filter(
      (t) => !isHeaderRow(t) && !isDoneStatus(t.status)
    );

    // Instant Empty-Board Day-Planning Q&A Prompt Fast-Path
    if (
      activeRealTasks.length === 0 &&
      !qaSubmission &&
      isEmptyBoardDayPlanRequest(userMessage)
    ) {
      const qaPrompt = buildEmptyBoardDayQAPrompt(
        userMessage,
        defaultStartHHMM,
        defaultEndHHMM
      );
      return NextResponse.json({
        reply:
          "You don't have any active tasks on your list yet—let me gauge what's on your plate today so I can populate both your **Tasks** list and your **my day** schedule.",
        modelUsed: "kite-qa-engine",
        latencyMs: 5,
        mutation: {
          executedActions: [],
          tasksMutation: null,
          profileUpdates: null,
          workspaceConfigUpdates: null,
          triggerCanvasSync: false,
          switchTab: null,
          showMyDayCard: false,
          qaPrompt,
        } satisfies AgentWorkspaceMutationPayload,
      });
    }

    const addedTasksMap = new Map<string, TaskItem>();
    const modifiedTaskIds = new Set<string>();
    const deletedTaskIds = new Set<string>();
    let reordered = false;
    let tasksTouched = false;
    let configTouched = false;
    let scheduleMutatedInTurn = false;
    const profileUpdates: Partial<UserProfile> = {};
    const executedActions: AgentExecutedAction[] = [];
    let triggerCanvasSync = false;
    let switchTab: WorkspaceTab | null = null;
    let showMyDayCard = false;
    const qaState: { prompt: AgentQAPrompt | null } = { prompt: null };

    const recordAction = (
      category: AgentExecutedAction["category"],
      summary: string,
      detail?: string
    ) => {
      executedActions.push({
        id: `act-${Date.now()}-${executedActions.length}`,
        category,
        summary,
        detail,
      });
    };

    const reindexWorkingTasks = () => {
      let currentSectionGroup = workingConfig.sections[0]?.id || "TODAY";
      workingTasks = workingTasks.map((item, idx) => {
        if (isHeaderRow(item)) {
          const cleanLabel = stripHeaderDecorations(item.title).toUpperCase();
          if (cleanLabel.includes("TODAY")) currentSectionGroup = "TODAY";
          else if (cleanLabel.includes("TOMORROW") || cleanLabel.includes("TMR"))
            currentSectionGroup = "TMR";
          else if (cleanLabel.includes("COLLEGE"))
            currentSectionGroup = "COLLEGE";
          else if (cleanLabel.includes("SOON")) currentSectionGroup = "SOON";
          else if (cleanLabel.includes("REMEMBER"))
            currentSectionGroup = "REMEMBER";
          else if (item.section_group) currentSectionGroup = item.section_group;

          return {
            ...item,
            section_group: currentSectionGroup,
            order_index: idx,
          };
        }
        return {
          ...item,
          section_group: currentSectionGroup,
          order_index: idx,
        };
      });
    };

    const findItem = (
      idOrTitle: string,
      options?: { headersOnly?: boolean; tasksOnly?: boolean }
    ): TaskItem | undefined => {
      const q = (idOrTitle || "").trim();
      if (!q) return undefined;
      const qLower = q.toLowerCase();
      const qStripped = stripHeaderDecorations(q).toLowerCase();

      const pool = workingTasks.filter((t) => {
        if (options?.headersOnly && !isHeaderRow(t)) return false;
        if (options?.tasksOnly && isHeaderRow(t)) return false;
        return true;
      });

      // 1. Exact ID match
      const byId = pool.find((t) => t.id === q);
      if (byId) return byId;

      // 2. Exact title or stripped title match
      const byExactTitle = pool.find(
        (t) =>
          t.title.trim().toLowerCase() === qLower ||
          stripHeaderDecorations(t.title).toLowerCase() === qStripped
      );
      if (byExactTitle) return byExactTitle;

      // 3. Substring match
      if (qStripped.length >= 2) {
        return pool.find(
          (t) =>
            t.title.toLowerCase().includes(qLower) ||
            stripHeaderDecorations(t.title).toLowerCase().includes(qStripped)
        );
      }
      return undefined;
    };

    const findInsertIndexUnderHeader = (headerQuery: string): number => {
      const header = findItem(headerQuery, { headersOnly: true });
      if (!header) return -1;
      const headerIdx = workingTasks.findIndex((t) => t.id === header.id);
      if (headerIdx === -1) return -1;
      // Insert at the end of that header's section (right before the next header)
      for (let i = headerIdx + 1; i < workingTasks.length; i++) {
        if (isHeaderRow(workingTasks[i])) {
          return i;
        }
      }
      return workingTasks.length;
    };

    const ensureOptionRegistered = (
      field: "tags" | "types" | "statuses" | "priorities",
      rawLabel: string,
      preferredColor: BadgeColorKey = "cyan"
    ) => {
      const trimmed = rawLabel.trim();
      if (!trimmed) return;
      const label =
        field === "tags" && !trimmed.startsWith("#") ? `#${trimmed}` : trimmed;
      const exists = workingConfig[field].some(
        (opt) => opt.label.toLowerCase() === label.toLowerCase()
      );
      if (!exists) {
        workingConfig[field] = [
          ...workingConfig[field],
          { id: label, label, color: preferredColor },
        ];
        configTouched = true;
      }
    };

    // Build compact, single-line board snapshot for system prompt (drastically reduces input tokens and latency)
    const serializedBoard = workingTasks
      .map((t, index) => {
        if (isHeaderRow(t)) {
          return `[ROW ${index + 1} | HEADER] ID="${t.id}" "${t.title}" (Section: ${t.section_group || "CUSTOM"})`;
        }
        const fields = [
          `[ROW ${index + 1} | TASK] ID="${t.id}" "${t.title}"`,
          `Status: "${t.status}"`,
          `Priority: "${t.priority}"`,
          `Category: "${t.type}"`,
          `Section: "${t.section_group}"`,
        ];
        if (t.due_date) fields.push(`Due: ${t.due_date.slice(0, 10)}`);
        if (t.estimated_minutes) fields.push(`Est: ${t.estimated_minutes}m`);
        if (t.tags && t.tags.length > 0) fields.push(`Tags: ${t.tags.join(",")}`);
        if (t.notes) fields.push(`Note: "${t.notes.slice(0, 80)}"`);
        if (t.is_canvas_assignment) fields.push(`Canvas: true`);
        return fields.join(" • ");
      })
      .join("\n");

    const initialTelemetry = computeMyDayLiveTelemetry(
      workingConfig.myDaySchedule,
      workingTasks,
      clientLocalMinutesOfDay
    );

    const serializedMyDay = initialTelemetry.hasSchedule
      ? initialTelemetry.enrichedBlocks
          .map(
            (b, i) =>
              `[SLOT ${i + 1}] ID="${b.id}" ${formatTime12h(
                b.startTime
              )}–${formatTime12h(b.endTime)} (${b.durationMinutes}m) "${
                b.title
              }" • State=${b.timeState.toUpperCase()} • Done=${b.isCompleted}`
          )
          .join("\n")
      : "(No MY DAY schedule built yet)";

    const qaSubmissionDirective = qaSubmission
      ? `
===========================================================================
GUIDED Q&A ANSWERS SUBMITTED BY USER (Original Request: "${qaSubmission.originalRequest}" • Purpose: "${qaSubmission.purpose}"):
${qaSubmission.answers
  .map((a, idx) => `${idx + 1}. Q: ${a.question}\n   A: ${a.answer}`)
  .join("\n")}
${
  qaSubmission.startTime && qaSubmission.endTime
    ? `Requested Schedule Timeframe: ${qaSubmission.startTime} to ${qaSubmission.endTime}`
    : ""
}

MANDATORY EXECUTION FOR THIS Q&A SUBMISSION:
1. Extract every task, assignment, errand, or goal described in the user's answers (breaking broad goals into concrete, actionable tasks if helpful). Assign smart priorities, categories (${workingConfig.types
          .map((t) => t.label)
          .join(", ")}), tags, due_date ('today' for today's tasks), and realistic \`estimated_minutes\` matching their pacing answer, and call \`add_tasks\` NOW to populate their Tasks list (under 'TODAY' if headers exist).
2. ${
          qaSubmission.purpose === "plan_day" || qaSubmission.startTime
            ? `Immediately call \`manage_my_day_schedule\` (using \`action: "auto_arrange"\` with \`day_start_time: "${
                qaSubmission.startTime || defaultStartHHMM
              }"\`, \`day_end_time: "${
                qaSubmission.endTime || defaultEndHHMM
              }"\`, \`include_all_active: true\`, and \`include_breaks\` matching their pacing answer) so those newly added tasks are ALSO populated directly into their \`my day\` schedule and the live \`my day\` status bar UI is shown!`
            : `If their request or answers also involve scheduling today's plan, call \`manage_my_day_schedule\` as well.`
        }
3. Respond warmly and concisely summarizing the tasks you added to their list and how you structured their \`my day\` plan!
===========================================================================`
      : "";

    const systemPrompt = `You are the Gemini Workspace Agent for "${workingConfig.brandName}" (${workingConfig.workspaceTitle}).
${TONE_PROMPTS[tone]}

CURRENT USER LOCAL DATE & TIME: ${clientLocalDateReadable}, ${formatTime12h(
      clientLocalTimeHHMM
    )} (24h: ${clientLocalTimeHHMM}, ISO: ${clientISO})

CONVERSATIONAL FAST PATH:
- For simple greetings, small talk, acknowledgments, or questions that don't ask to change or inspect the workspace/schedule (e.g. "yo", "hi", "hey", "hello", "how are you?", "what can you do?"), respond directly and naturally in text. DO NOT invoke any tools for simple conversational messages.

YOUR CAPABILITIES:
You have direct, live read/write control over the user's entire workspace via your tools:
1. Tasks: Add single or batch tasks, edit titles/statuses/priorities/categories/due dates/time estimates/tags/notes, write rich HTML study guides or checklists into a task's document ("content"), mark tasks Done or reopen them, delete tasks, and move/reorder/sort tasks anywhere in the table.
2. my day Schedule & Live Status Bar:
   - Use \`show_my_day_schedule\` whenever the user asks to see their current schedule, asks what their day/plan looks like, asks what they should be working on right now, asks how much of their task or day is done, or asks for schedule logistics. Calling \`show_my_day_schedule\` renders the live my day status bar UI & plan directly inside the chat AND gives you exact down-to-the-minute logistics to summarize!
   - Use \`manage_my_day_schedule\` whenever the user asks to build, auto-arrange, add to, swap, reorder, shift, edit, or clear their my day schedule (which also displays the live my day status bar UI in chat).
3. Section Headers: Create, rename, move, or remove movable divider headers (like TODAY, TOMORROW, COLLEGE, SOON, REMEMBER, or custom sections).
4. Themes & Atmosphere: Switch between preset themes (${THEME_OPTIONS.map((t) => `${t.id} ("${t.name}")`).join(", ")}) OR design bespoke custom 5-color hex palettes, switch ambient backgrounds (aurora, cyber, lofi, particles), and adjust dim/blur.
5. Workspace Settings & Customization: Update workspace title/subtitle/brand, toggle "Show completed tasks", change task document view mode (slide_drawer, center_modal, inline), change AI coaching tone, rename table columns, or create custom color-coded tags/categories/statuses/priorities.
6. Integrations & Navigation: Trigger a live Canvas LMS sync or switch the user's active view between Chat, Tasks, and my day.
7. Interactive Guided Q&A (\`prompt_user_qa\`):
   - Use \`prompt_user_qa\` at moments when gauging user input via a structured Q&A UI will produce a dramatically better plan—specifically: (a) when the user asks to plan/organize their day or routine and has 0 active tasks on their board without naming tasks, (b) when the user asks to break down a broad goal, exam study plan, or multi-step project without enough context, or (c) when the user asks you to ask them questions / interview them to figure out their tasks or schedule.
   - \`prompt_user_qa\` renders a consent card first ("Can I ask a few questions to fulfill your request?") and then collects structured answers so you can populate their Tasks list and \`my day\` schedule. Do NOT use \`prompt_user_qa\` for direct, clear commands where you already have enough info to act immediately.

GUIDELINES FOR THOUGHTFUL EXECUTION:
- Execute clear user requests directly using the appropriate tools—do NOT ask for permission first unless using \`prompt_user_qa\` for underspecified planning/empty-list day discovery. You can chain multiple tools in one turn!
- When adding tasks, choose smart, helpful defaults for priority, category (${workingConfig.types.map((t) => t.label).join(", ")}), estimated_minutes, and tags (${workingConfig.tags.map((t) => t.label).join(", ")}), and place them under the most fitting section header (e.g. TODAY, TOMORROW, SOON, COLLEGE) if headers exist on the board.
- If the user mentions a task with @ or by partial name, match it accurately to the board items below.
- Keep your text response clean, natural, well-structured (use concise Markdown bullets or bold highlights where helpful), and confirm what you just did or answer their question thoughtfully.

CURRENT WORKSPACE CONFIGURATION:
- Active Theme: "${currentTheme}"${workingConfig.customThemeColors ? ` (Custom Colors: ${JSON.stringify(workingConfig.customThemeColors)})` : ""}
- Background Preset: "${videoPreset}" (dim: ${videoDim}, blur: ${videoBlur}px)
- Document View Mode: "${viewMode}" | Show Completed Tasks in Table: ${Boolean(workingConfig.showCompletedTasks)}
- Statuses: ${workingConfig.statuses.map((s) => s.label).join(", ")}
- Categories: ${workingConfig.types.map((t) => t.label).join(", ")}
- Priorities: ${workingConfig.priorities.map((p) => p.label).join(", ")}
- Tags: ${workingConfig.tags.map((t) => t.label).join(", ")}

CURRENT MY DAY SCHEDULE (${
      initialTelemetry.hasSchedule
        ? `${Math.round(initialTelemetry.dayScheduleProgressPct)}% day elapsed • ${initialTelemetry.completedTaskBlocks}/${initialTelemetry.totalTaskBlocks} tasks done`
        : "Empty"
    }):
${serializedMyDay}

CURRENT BOARD (${workingTasks.length} rows in exact top-to-bottom table order):
${serializedBoard || "(No tasks currently on the board)"}${qaSubmissionDirective}`;

    // Assemble multi-turn conversation messages (last 6 turns for instant context ingestion)
    const conversationMessages: CoreMessage[] = [
      ...history
        .slice(-6)
        .filter((m) => m.content && m.content.trim().length > 0)
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      { role: "user", content: userMessage },
    ];

    const tools = {
      add_tasks: tool({
        description:
          "Add one or more new tasks to the user's task list, optionally placing them under a specific section header or after a specific row.",
        parameters: z.object({
          tasks: z.array(
            z.object({
              title: z.string().describe("Clear, concise task title"),
              status: z
                .string()
                .optional()
                .describe("Task status, e.g. 'To Do', 'In Progress', 'Done'"),
              type: z
                .string()
                .optional()
                .describe("Category/Type, e.g. 'School', 'College', 'Personal', 'Work', 'Club', 'General'"),
              priority: z
                .string()
                .optional()
                .describe("Priority level, e.g. 'Urgent', 'High', 'Medium', 'Low'"),
              due_date: z
                .string()
                .optional()
                .describe("Due date as YYYY-MM-DD, ISO string, 'today', 'tomorrow', or omit if none"),
              estimated_minutes: z
                .number()
                .optional()
                .describe("Estimated duration in minutes (e.g. 15, 30, 45, 60, 90)"),
              tags: z
                .array(z.string())
                .optional()
                .describe("Tags such as ['#Exam', '#Focus']"),
              notes: z
                .string()
                .optional()
                .describe("Short inline note shown in the Notes column"),
              content: z
                .string()
                .optional()
                .describe("Optional rich HTML document content (<p>, <ul>, <li>, <h2>) for the task's doc drawer"),
              under_header: z
                .string()
                .optional()
                .describe("Optional header name or ID to place this task under (e.g. 'TODAY', 'TOMORROW', 'COLLEGE', 'SOON')"),
              after_item: z
                .string()
                .optional()
                .describe("Optional task/header ID or title to insert immediately after"),
              position: z
                .enum(["top", "bottom"])
                .optional()
                .describe("Fallback placement if under_header/after_item is not specified"),
            })
          ),
        }),
        execute: async ({ tasks: itemsToAdd }) => {
          const nowISO = new Date().toISOString();
          const createdSummaries: Array<{ id: string; title: string }> = [];

          for (const item of itemsToAdd) {
            const newId = makeUuid();
            const status = item.status?.trim() || workingConfig.statuses[0]?.label || "To Do";
            const type = item.type?.trim() || workingConfig.types[0]?.label || "General";
            const priority = item.priority?.trim() || "Medium";
            const formattedTags = (item.tags || []).map((tg) =>
              tg.trim().startsWith("#") ? tg.trim() : `#${tg.trim()}`
            );

            ensureOptionRegistered("types", type, "cyan");
            ensureOptionRegistered("statuses", status, "sky");
            ensureOptionRegistered("priorities", priority, "amber");
            formattedTags.forEach((tg) => ensureOptionRegistered("tags", tg, "cyan"));

            const resolvedDue = parseFlexibleDueDate(
              item.due_date,
              clientNowMs,
              tzOffsetMinutes
            );

            const newTask: TaskItem = {
              id: newId,
              user_id: userId,
              title: item.title.trim() || "Untitled Task",
              content: item.content || "",
              status,
              type,
              priority,
              due_date: resolvedDue,
              estimated_minutes: item.estimated_minutes || 30,
              tags: formattedTags,
              notes: item.notes || "",
              is_canvas_assignment: false,
              canvas_course_code: null,
              custom_properties: {},
              section_group: "TODAY",
              order_index: workingTasks.length,
              completed_at: isDoneStatus(status) ? nowISO : null,
              created_at: nowISO,
              updated_at: nowISO,
            };

            let insertIdx = -1;
            if (item.after_item) {
              const anchor = findItem(item.after_item);
              if (anchor) {
                insertIdx = workingTasks.findIndex((t) => t.id === anchor.id) + 1;
              }
            }
            if (insertIdx === -1 && item.under_header) {
              insertIdx = findInsertIndexUnderHeader(item.under_header);
            }
            if (insertIdx === -1 && item.position === "top") {
              const firstHeaderIdx = workingTasks.findIndex((t) => isHeaderRow(t));
              insertIdx = firstHeaderIdx === 0 ? 1 : 0;
            }
            if (insertIdx === -1) {
              // Smart default: if TODAY header exists and due is today, place under TODAY
              const todayIdx = findInsertIndexUnderHeader("TODAY");
              insertIdx = todayIdx !== -1 ? todayIdx : workingTasks.length;
            }

            workingTasks.splice(insertIdx, 0, newTask);
            addedTasksMap.set(newId, newTask);
            createdSummaries.push({ id: newId, title: newTask.title });
          }

          tasksTouched = true;
          reordered = true;
          reindexWorkingTasks();
          // Refresh addedTasksMap references after reindexing
          for (const t of workingTasks) {
            if (addedTasksMap.has(t.id)) {
              addedTasksMap.set(t.id, t);
            }
          }

          recordAction(
            "create",
            createdSummaries.length === 1
              ? `Added task "${createdSummaries[0].title}"`
              : `Added ${createdSummaries.length} tasks`,
            createdSummaries.map((c) => c.title).join(" • ")
          );

          return {
            success: true,
            added_count: createdSummaries.length,
            created_tasks: createdSummaries,
          };
        },
      }),

      update_tasks: tool({
        description:
          "Modify one or more existing tasks (title, status, completion, priority, category, due date, estimated time, tags, inline notes, rich HTML doc content, or section placement).",
        parameters: z.object({
          updates: z.array(
            z.object({
              target: z
                .string()
                .describe("Task ID (preferred) or exact/partial task title"),
              new_title: z.string().optional(),
              status: z
                .string()
                .optional()
                .describe("e.g. 'To Do', 'In Progress', 'Blocked', 'Done'"),
              priority: z.string().optional(),
              type: z.string().optional(),
              due_date: z
                .string()
                .optional()
                .describe("New due date (YYYY-MM-DD, ISO, 'today', 'tomorrow') or 'clear' to remove due date"),
              estimated_minutes: z.number().optional(),
              replace_tags: z.array(z.string()).optional(),
              add_tags: z.array(z.string()).optional(),
              remove_tags: z.array(z.string()).optional(),
              notes: z.string().optional(),
              content: z
                .string()
                .optional()
                .describe("Rich HTML document content for this task"),
              move_under_header: z
                .string()
                .optional()
                .describe("Optional section header title/ID to also move this task under"),
            })
          ),
        }),
        execute: async ({ updates }) => {
          const nowISO = new Date().toISOString();
          const updatedTitles: string[] = [];
          const notFound: string[] = [];

          for (const u of updates) {
            const existing = findItem(u.target, { tasksOnly: true }) || findItem(u.target);
            if (!existing) {
              notFound.push(u.target);
              continue;
            }

            const idx = workingTasks.findIndex((t) => t.id === existing.id);
            if (idx === -1) continue;

            const next = { ...workingTasks[idx], updated_at: nowISO };

            if (u.new_title !== undefined && u.new_title.trim()) {
              next.title = u.new_title.trim();
            }
            if (u.status !== undefined && u.status.trim()) {
              next.status = u.status.trim();
              ensureOptionRegistered("statuses", next.status, "sky");
              next.completed_at = isDoneStatus(next.status) ? nowISO : null;
            }
            if (u.priority !== undefined && u.priority.trim()) {
              next.priority = u.priority.trim();
              ensureOptionRegistered("priorities", next.priority, "amber");
            }
            if (u.type !== undefined && u.type.trim()) {
              next.type = u.type.trim();
              ensureOptionRegistered("types", next.type, "cyan");
            }
            if (u.due_date !== undefined) {
              next.due_date = parseFlexibleDueDate(
                u.due_date,
                clientNowMs,
                tzOffsetMinutes
              );
            }
            if (typeof u.estimated_minutes === "number" && u.estimated_minutes >= 0) {
              next.estimated_minutes = u.estimated_minutes;
            }
            if (u.replace_tags) {
              next.tags = u.replace_tags.map((tg) =>
                tg.trim().startsWith("#") ? tg.trim() : `#${tg.trim()}`
              );
              next.tags.forEach((tg) => ensureOptionRegistered("tags", tg, "cyan"));
            }
            if (u.add_tags && u.add_tags.length > 0) {
              const formatted = u.add_tags.map((tg) =>
                tg.trim().startsWith("#") ? tg.trim() : `#${tg.trim()}`
              );
              formatted.forEach((tg) => {
                ensureOptionRegistered("tags", tg, "cyan");
                if (!next.tags.some((et) => et.toLowerCase() === tg.toLowerCase())) {
                  next.tags = [...next.tags, tg];
                }
              });
            }
            if (u.remove_tags && u.remove_tags.length > 0) {
              const removeSet = new Set(
                u.remove_tags.map((tg) =>
                  (tg.trim().startsWith("#") ? tg.trim() : `#${tg.trim()}`).toLowerCase()
                )
              );
              next.tags = next.tags.filter((tg) => !removeSet.has(tg.toLowerCase()));
            }
            if (u.notes !== undefined) {
              next.notes = u.notes;
            }
            if (u.content !== undefined) {
              next.content = u.content;
            }

            workingTasks[idx] = next;

            if (u.move_under_header) {
              const [removed] = workingTasks.splice(idx, 1);
              const destIdx = findInsertIndexUnderHeader(u.move_under_header);
              workingTasks.splice(
                destIdx !== -1 ? destIdx : workingTasks.length,
                0,
                removed
              );
              reordered = true;
            }

            if (addedTasksMap.has(next.id)) {
              addedTasksMap.set(next.id, next);
            } else {
              modifiedTaskIds.add(next.id);
            }
            updatedTitles.push(next.title);
          }

          if (updatedTitles.length > 0) {
            tasksTouched = true;
            reindexWorkingTasks();
            recordAction(
              "update",
              updatedTitles.length === 1
                ? `Updated "${updatedTitles[0]}"`
                : `Updated ${updatedTitles.length} tasks`,
              updatedTitles.join(" • ")
            );
          }

          return {
            success: true,
            updated_count: updatedTitles.length,
            updated_titles: updatedTitles,
            not_found: notFound,
          };
        },
      }),

      delete_tasks: tool({
        description:
          "Delete one or more tasks (or header rows) by ID/title, or clear all completed tasks.",
        parameters: z.object({
          targets: z
            .array(z.string())
            .optional()
            .describe("Array of task/header IDs or titles to delete"),
          delete_all_completed: z
            .boolean()
            .optional()
            .describe("Set true to delete all tasks currently marked Done/Completed"),
        }),
        execute: async ({ targets, delete_all_completed }) => {
          const removedTitles: string[] = [];

          if (delete_all_completed) {
            const toRemove = workingTasks.filter(
              (t) => !isHeaderRow(t) && isDoneStatus(t.status)
            );
            for (const item of toRemove) {
              removedTitles.push(item.title);
              if (addedTasksMap.has(item.id)) {
                addedTasksMap.delete(item.id);
              } else {
                deletedTaskIds.add(item.id);
                modifiedTaskIds.delete(item.id);
              }
            }
            const removeIdSet = new Set(toRemove.map((t) => t.id));
            workingTasks = workingTasks.filter((t) => !removeIdSet.has(t.id));
          }

          if (targets && targets.length > 0) {
            for (const q of targets) {
              const match = findItem(q);
              if (match) {
                removedTitles.push(match.title);
                if (addedTasksMap.has(match.id)) {
                  addedTasksMap.delete(match.id);
                } else {
                  deletedTaskIds.add(match.id);
                  modifiedTaskIds.delete(match.id);
                }
                workingTasks = workingTasks.filter((t) => t.id !== match.id);
              }
            }
          }

          if (removedTitles.length > 0) {
            tasksTouched = true;
            reordered = true;
            reindexWorkingTasks();
            recordAction(
              "delete",
              removedTitles.length === 1
                ? `Deleted "${removedTitles[0]}"`
                : `Deleted ${removedTitles.length} items`,
              removedTitles.join(" • ")
            );
          }

          return {
            success: true,
            deleted_count: removedTitles.length,
            deleted_titles: removedTitles,
          };
        },
      }),

      move_and_reorder_tasks: tool({
        description:
          "Move specific tasks/rows around the table (to top, bottom, under a section header, or before/after another row) OR sort the task list by priority, due date, estimated time, status, or title.",
        parameters: z.object({
          targets: z
            .array(z.string())
            .optional()
            .describe("IDs or titles of rows to move"),
          destination: z
            .enum(["top", "bottom", "under_header", "before_item", "after_item"])
            .optional()
            .describe("Where to move the specified targets"),
          anchor_target: z
            .string()
            .optional()
            .describe("Header or task ID/title when destination is under_header, before_item, or after_item"),
          sort_by: z
            .enum(["priority", "due_date", "estimated_minutes", "status", "title"])
            .optional()
            .describe("Optional: sort tasks automatically by a field"),
          sort_direction: z
            .enum(["asc", "desc"])
            .optional()
            .describe("Sort direction (default 'asc'; for priority 'asc' puts Urgent first)"),
          keep_within_headers: z
            .boolean()
            .optional()
            .describe("When sorting, keep tasks grouped inside their current section headers (default true)"),
        }),
        execute: async ({
          targets,
          destination,
          anchor_target,
          sort_by,
          sort_direction = "asc",
          keep_within_headers = true,
        }) => {
          const summaryParts: string[] = [];

          if (targets && targets.length > 0 && destination) {
            const matchedItems: TaskItem[] = [];
            for (const q of targets) {
              const found = findItem(q);
              if (found && !matchedItems.some((m) => m.id === found.id)) {
                matchedItems.push(found);
              }
            }

            if (matchedItems.length > 0) {
              const movingIds = new Set(matchedItems.map((m) => m.id));
              workingTasks = workingTasks.filter((t) => !movingIds.has(t.id));

              let insertAt = workingTasks.length;
              if (destination === "top") {
                const firstIsHeader =
                  workingTasks.length > 0 &&
                  isHeaderRow(workingTasks[0]) &&
                  matchedItems.every((m) => !isHeaderRow(m));
                insertAt = firstIsHeader ? 1 : 0;
              } else if (destination === "bottom") {
                insertAt = workingTasks.length;
              } else if (destination === "under_header" && anchor_target) {
                const idx = findInsertIndexUnderHeader(anchor_target);
                insertAt = idx !== -1 ? idx : workingTasks.length;
              } else if (
                (destination === "before_item" || destination === "after_item") &&
                anchor_target
              ) {
                const anchor = findItem(anchor_target);
                if (anchor) {
                  const anchorIdx = workingTasks.findIndex((t) => t.id === anchor.id);
                  if (anchorIdx !== -1) {
                    insertAt =
                      destination === "before_item" ? anchorIdx : anchorIdx + 1;
                  }
                }
              }

              workingTasks.splice(insertAt, 0, ...matchedItems);
              summaryParts.push(
                `Moved ${matchedItems.length} item${matchedItems.length > 1 ? "s" : ""}${
                  anchor_target ? ` (${destination.replace("_", " ")} ${anchor_target})` : ` to ${destination}`
                }`
              );
            }
          }

          if (sort_by) {
            const priorityRank: Record<string, number> = {
              urgent: 0,
              high: 1,
              medium: 2,
              low: 3,
            };
            const compareTasks = (a: TaskItem, b: TaskItem): number => {
              let cmp = 0;
              if (sort_by === "priority") {
                const ra = priorityRank[(a.priority || "").toLowerCase()] ?? 2;
                const rb = priorityRank[(b.priority || "").toLowerCase()] ?? 2;
                cmp = ra - rb;
              } else if (sort_by === "due_date") {
                const da = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
                const db = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
                cmp = da - db;
              } else if (sort_by === "estimated_minutes") {
                cmp = (a.estimated_minutes || 0) - (b.estimated_minutes || 0);
              } else if (sort_by === "status") {
                cmp = (a.status || "").localeCompare(b.status || "");
              } else {
                cmp = (a.title || "").localeCompare(b.title || "");
              }
              return sort_direction === "desc" ? -cmp : cmp;
            };

            const hasHeaders = workingTasks.some((t) => isHeaderRow(t));
            if (keep_within_headers && hasHeaders) {
              const rebuilt: TaskItem[] = [];
              let bucket: TaskItem[] = [];
              for (const row of workingTasks) {
                if (isHeaderRow(row)) {
                  if (bucket.length > 0) {
                    bucket.sort(compareTasks);
                    rebuilt.push(...bucket);
                    bucket = [];
                  }
                  rebuilt.push(row);
                } else {
                  bucket.push(row);
                }
              }
              if (bucket.length > 0) {
                bucket.sort(compareTasks);
                rebuilt.push(...bucket);
              }
              workingTasks = rebuilt;
            } else {
              const headers = workingTasks.filter((t) => isHeaderRow(t));
              const onlyTasks = workingTasks.filter((t) => !isHeaderRow(t));
              onlyTasks.sort(compareTasks);
              workingTasks = [...headers, ...onlyTasks];
            }
            summaryParts.push(`Sorted tasks by ${sort_by.replace("_", " ")}`);
          }

          if (summaryParts.length > 0) {
            tasksTouched = true;
            reordered = true;
            reindexWorkingTasks();
            recordAction("move", summaryParts.join(" & "));
          }

          return {
            success: true,
            summary: summaryParts.join("; ") || "No movement needed",
          };
        },
      }),

      manage_headers: tool({
        description:
          "Create, rename, or remove movable section divider header rows inside the task table.",
        parameters: z.object({
          action: z.enum(["create", "rename", "delete"]),
          title: z
            .string()
            .optional()
            .describe("Title for creating or renaming a header (e.g. '🚀 FINALS PREP')"),
          target: z
            .string()
            .optional()
            .describe("Existing header ID or title when renaming or deleting"),
          position: z
            .enum(["top", "bottom", "before_item", "after_item"])
            .optional()
            .describe("Where to insert a newly created header"),
          anchor_target: z
            .string()
            .optional()
            .describe("Anchor row ID or title for before_item / after_item"),
        }),
        execute: async ({ action, title, target, position = "bottom", anchor_target }) => {
          const nowISO = new Date().toISOString();

          if (action === "create") {
            const newId = makeUuid();
            const formattedTitle = formatHeaderTitle(title || "NEW SECTION");
            const sectionId =
              stripHeaderDecorations(formattedTitle)
                .toUpperCase()
                .replace(/[^A-Z0-9]+/g, "_") || "CUSTOM";

            const headerRow: TaskItem = {
              id: newId,
              user_id: userId,
              title: formattedTitle,
              content: "",
              status: "To Do",
              type: "General",
              priority: "Medium",
              due_date: null,
              estimated_minutes: 0,
              tags: [],
              notes: "",
              is_canvas_assignment: false,
              canvas_course_code: null,
              custom_properties: { is_header: true },
              section_group: sectionId,
              order_index: workingTasks.length,
              completed_at: null,
              created_at: nowISO,
              updated_at: nowISO,
            };

            let insertIdx = workingTasks.length;
            if (position === "top") insertIdx = 0;
            else if (
              (position === "before_item" || position === "after_item") &&
              anchor_target
            ) {
              const anchor = findItem(anchor_target);
              if (anchor) {
                const idx = workingTasks.findIndex((t) => t.id === anchor.id);
                if (idx !== -1) {
                  insertIdx = position === "before_item" ? idx : idx + 1;
                }
              }
            }

            workingTasks.splice(insertIdx, 0, headerRow);
            addedTasksMap.set(newId, headerRow);
            tasksTouched = true;
            reordered = true;
            reindexWorkingTasks();
            addedTasksMap.set(
              newId,
              workingTasks.find((t) => t.id === newId) || headerRow
            );

            recordAction("header", `Created section header "${formattedTitle}"`);
            return { success: true, header_id: newId, title: formattedTitle };
          }

          if (action === "rename" && target && title) {
            const existing = findItem(target, { headersOnly: true });
            if (!existing) return { success: false, error: "Header not found" };
            const formatted = formatHeaderTitle(title);
            const idx = workingTasks.findIndex((t) => t.id === existing.id);
            workingTasks[idx] = {
              ...workingTasks[idx],
              title: formatted,
              updated_at: nowISO,
            };
            if (addedTasksMap.has(existing.id)) {
              addedTasksMap.set(existing.id, workingTasks[idx]);
            } else {
              modifiedTaskIds.add(existing.id);
            }
            tasksTouched = true;
            recordAction("header", `Renamed header to "${formatted}"`);
            return { success: true, header_id: existing.id, title: formatted };
          }

          if (action === "delete" && target) {
            const existing = findItem(target, { headersOnly: true });
            if (!existing) return { success: false, error: "Header not found" };
            workingTasks = workingTasks.filter((t) => t.id !== existing.id);
            if (addedTasksMap.has(existing.id)) {
              addedTasksMap.delete(existing.id);
            } else {
              deletedTaskIds.add(existing.id);
            }
            tasksTouched = true;
            reordered = true;
            reindexWorkingTasks();
            recordAction("header", `Removed header "${existing.title}"`);
            return { success: true };
          }

          return { success: false, error: "Invalid header parameters" };
        },
      }),

      update_theme_and_appearance: tool({
        description:
          "Change the workspace color theme preset, design a custom 5-hex color palette, or update the ambient animated background, dimming, and frosted glass blur.",
        parameters: z.object({
          theme: z
            .enum([
              "cyber_ocean",
              "electric_lavender",
              "warm_slate",
              "alpine_forest",
              "mint_sunray",
              "rose_nebula",
              "monochrome",
              "custom",
            ])
            .optional()
            .describe("Preset theme ID or 'custom' when providing custom hex colors"),
          custom_palette: z
            .object({
              bgBase: z.string().describe("Deep dark background hex, e.g. #0b1021"),
              surface: z.string().describe("Elevated panel hex, e.g. #162040"),
              accent: z.string().describe("Midtone glow hex, e.g. #2b3f78"),
              primary: z.string().describe("Vibrant primary accent hex, e.g. #38bdf8"),
              highlight: z.string().describe("Crisp light highlight hex, e.g. #e0f2fe"),
            })
            .optional()
            .describe("Optional bespoke 5-color dark-mode palette"),
          video_bg_preset: z
            .enum(["aurora", "cyber", "lofi", "particles"])
            .optional()
            .describe("Ambient background engine preset"),
          video_bg_dim: z
            .number()
            .optional()
            .describe("Background overlay dimming between 0.1 and 0.85"),
          video_bg_blur: z
            .number()
            .optional()
            .describe("Frosted glass blur in pixels between 0 and 24"),
        }),
        execute: async ({
          theme,
          custom_palette,
          video_bg_preset,
          video_bg_dim,
          video_bg_blur,
        }) => {
          const changes: string[] = [];

          if (custom_palette) {
            profileUpdates.theme = "custom";
            workingConfig.customThemeColors = custom_palette;
            configTouched = true;
            changes.push(`Applied custom color palette (${custom_palette.primary})`);
          } else if (theme) {
            profileUpdates.theme = theme;
            if (theme !== "custom") {
              workingConfig.customThemeColors = null;
              configTouched = true;
            }
            const meta = THEME_OPTIONS.find((t) => t.id === theme);
            changes.push(`Switched theme to ${meta ? meta.name : theme}`);
          }

          if (video_bg_preset) {
            profileUpdates.video_bg_preset = video_bg_preset;
            changes.push(`Set ambient background to ${video_bg_preset}`);
          }
          if (typeof video_bg_dim === "number") {
            const clamped = Math.min(0.85, Math.max(0.1, video_bg_dim));
            profileUpdates.video_bg_dim = clamped;
            changes.push(`Adjusted background dim to ${Math.round(clamped * 100)}%`);
          }
          if (typeof video_bg_blur === "number") {
            const clamped = Math.min(24, Math.max(0, Math.round(video_bg_blur)));
            profileUpdates.video_bg_blur = clamped;
            changes.push(`Set glass blur to ${clamped}px`);
          }

          if (changes.length > 0) {
            recordAction("theme", changes.join(" • "));
          }

          return { success: true, applied: changes };
        },
      }),

      update_workspace_settings: tool({
        description:
          "Update workspace titles/motto, show/hide completed tasks in the table, change document view mode, change AI coaching tone, rename table column headers, or add new color-coded tags/categories/statuses.",
        parameters: z.object({
          workspace_title: z.string().optional(),
          workspace_subtitle: z.string().optional(),
          brand_name: z.string().optional(),
          brand_badge: z.string().optional(),
          show_completed_tasks: z.boolean().optional(),
          view_mode: z.enum(["slide_drawer", "center_modal", "inline"]).optional(),
          ai_tone: z
            .enum(["locked_in", "chill_coach", "hyper_drive", "executive"])
            .optional(),
          rename_columns: z
            .object({
              title: z.string().optional(),
              status: z.string().optional(),
              type: z.string().optional(),
              priority: z.string().optional(),
              due_date: z.string().optional(),
              estimated_minutes: z.string().optional(),
              tags: z.string().optional(),
              notes: z.string().optional(),
            })
            .optional(),
          add_custom_options: z
            .array(
              z.object({
                group: z.enum(["tags", "types", "statuses", "priorities"]),
                label: z.string(),
                color: z.enum(BADGE_COLOR_KEYS as [BadgeColorKey, ...BadgeColorKey[]]),
              })
            )
            .optional(),
        }),
        execute: async ({
          workspace_title,
          workspace_subtitle,
          brand_name,
          brand_badge,
          show_completed_tasks,
          view_mode,
          ai_tone,
          rename_columns,
          add_custom_options,
        }) => {
          const changes: string[] = [];

          if (workspace_title !== undefined) {
            workingConfig.workspaceTitle = workspace_title;
            configTouched = true;
            changes.push(`Workspace title → "${workspace_title}"`);
          }
          if (workspace_subtitle !== undefined) {
            workingConfig.workspaceSubtitle = workspace_subtitle;
            configTouched = true;
            changes.push("Updated workspace motto");
          }
          if (brand_name !== undefined) {
            workingConfig.brandName = brand_name;
            configTouched = true;
            changes.push(`Brand name → "${brand_name}"`);
          }
          if (brand_badge !== undefined) {
            workingConfig.brandBadge = brand_badge;
            configTouched = true;
            changes.push(`Brand badge → "${brand_badge}"`);
          }
          if (typeof show_completed_tasks === "boolean") {
            workingConfig.showCompletedTasks = show_completed_tasks;
            configTouched = true;
            changes.push(
              show_completed_tasks
                ? "Enabled showing completed tasks in table"
                : "Hidden completed tasks from active table"
            );
          }
          if (view_mode) {
            profileUpdates.view_mode = view_mode;
            changes.push(`Document view mode → ${view_mode.replace("_", " ")}`);
          }
          if (ai_tone) {
            profileUpdates.ai_tone = ai_tone;
            changes.push(`Agent tone → ${ai_tone.replace("_", " ")}`);
          }
          if (rename_columns) {
            workingConfig.columnHeaders = {
              ...workingConfig.columnHeaders,
              ...Object.fromEntries(
                Object.entries(rename_columns).filter(([, v]) => Boolean(v))
              ),
            };
            configTouched = true;
            changes.push("Renamed table column headers");
          }
          if (add_custom_options && add_custom_options.length > 0) {
            for (const opt of add_custom_options) {
              ensureOptionRegistered(opt.group, opt.label, opt.color);
            }
            changes.push(`Added ${add_custom_options.length} custom option badge(s)`);
          }

          if (changes.length > 0) {
            recordAction("settings", changes.join(" • "));
          }
          return { success: true, changes };
        },
      }),

      show_my_day_schedule: tool({
        description:
          "Show the user's current MY DAY schedule and render the interactive MY DAY live status bar UI (current task progress bar + overall day schedule progress bar + full plan) directly inside the chat, while returning exact live schedule logistics.",
        parameters: z.object({
          include_unscheduled_summary: z
            .boolean()
            .optional()
            .describe("Whether to also list unscheduled active tasks from the board"),
        }),
        execute: async ({ include_unscheduled_summary }) => {
          showMyDayCard = true;
          const live = computeMyDayLiveTelemetry(
            workingConfig.myDaySchedule,
            workingTasks,
            clientLocalMinutesOfDay
          );

          const scheduledIds = new Set(
            (workingConfig.myDaySchedule?.blocks || [])
              .map((b) => b.taskId)
              .filter(Boolean) as string[]
          );
          const unscheduledActive = include_unscheduled_summary
            ? workingTasks
                .filter(
                  (t) =>
                    !isHeaderRow(t) &&
                    !isDoneStatus(t.status) &&
                    !scheduledIds.has(t.id)
                )
                .map((t) => ({
                  title: t.title,
                  priority: t.priority,
                  estimated_minutes: recommendTaskMinutes(t),
                }))
            : undefined;

          return {
            renderedStatusCardInChat: true,
            currentLocalTime: formatTime12h(clientLocalTimeHHMM),
            hasSchedule: live.hasSchedule,
            phase: live.phase,
            plannedWindow: live.hasSchedule
              ? `${formatTime12h(live.dayStartTime)} – ${formatTime12h(
                  live.dayEndTime
                )}`
              : null,
            currentTaskStatus: live.currentBlock
              ? {
                  title: live.currentBlock.title,
                  timeframe: `${formatTime12h(
                    live.currentBlock.startTime
                  )} – ${formatTime12h(live.currentBlock.endTime)}`,
                  progressPercent: Math.round(live.currentTaskProgressPct),
                  elapsedMinutes: live.currentTaskElapsedMinutes,
                  remainingMinutes: live.currentTaskRemainingMinutes,
                  isCompleted: live.currentBlock.isCompleted,
                }
              : null,
            nextUpcomingBlock: live.nextBlock
              ? {
                  title: live.nextBlock.title,
                  startsAt: formatTime12h(live.nextBlock.startTime),
                  startsInMinutes: live.minutesUntilNextBlock,
                }
              : null,
            dayLogistics: {
              dayScheduleElapsedPercent: Math.round(live.dayScheduleProgressPct),
              taskCompletionPercent: live.dayTaskCompletionPct,
              completedTasks: live.completedTaskBlocks,
              totalScheduledTasks: live.totalTaskBlocks,
              remainingTasks: live.remainingTaskBlocks,
              totalScheduledTime: formatDurationCompact(
                live.totalScheduledMinutes
              ),
              elapsedScheduledTime: formatDurationCompact(
                live.elapsedScheduledMinutes
              ),
              remainingScheduledTime: formatDurationCompact(
                live.remainingScheduledMinutes
              ),
              freeBufferMinutes: live.freeBufferMinutes,
              overdueUncheckedSlots: live.overdueBlocks.map(
                (b) =>
                  `${b.title} (${formatTime12h(b.startTime)}–${formatTime12h(
                    b.endTime
                  )})`
              ),
            },
            schedulePlan: live.enrichedBlocks.map((b, i) => ({
              order: i + 1,
              title: b.title,
              timeframe: `${formatTime12h(b.startTime)} – ${formatTime12h(
                b.endTime
              )}`,
              durationMinutes: b.durationMinutes,
              state: b.timeState,
              completed: b.isCompleted,
              isBreak: Boolean(b.isBreak),
            })),
            unscheduledActiveTasks: unscheduledActive,
          };
        },
      }),

      manage_my_day_schedule: tool({
        description:
          "Build, auto-arrange, add to, edit, swap, shift, or clear the user's MY DAY schedule, and display the updated live MY DAY status bar UI in chat.",
        parameters: z.object({
          action: z.enum([
            "auto_arrange",
            "set_blocks",
            "add_block",
            "update_block",
            "swap_blocks",
            "shift_schedule",
            "remove_block",
            "clear_schedule",
          ]),
          day_start_time: z
            .string()
            .optional()
            .describe("Start time for auto_arrange or schedule window (e.g. '09:00' or '2:00 PM')"),
          day_end_time: z
            .string()
            .optional()
            .describe("Planned end time for auto_arrange (e.g. '17:00' or '6:00 PM')"),
          include_all_active: z
            .boolean()
            .optional()
            .describe("For auto_arrange: set true to schedule all active board tasks"),
          task_queries: z
            .array(z.string())
            .optional()
            .describe("For auto_arrange: specific task IDs or titles to include"),
          include_breaks: z.boolean().optional(),
          blocks: z
            .array(
              z.object({
                task_id_or_title: z.string(),
                start_time: z.string(),
                end_time: z.string(),
                notes: z.string().optional(),
                is_break: z.boolean().optional(),
              })
            )
            .optional()
            .describe("For set_blocks: explicit ordered schedule blocks"),
          block_query: z
            .string()
            .optional()
            .describe("For add_block, update_block, remove_block, or swap_blocks (first block)"),
          second_block_query: z
            .string()
            .optional()
            .describe("For swap_blocks: ID or title of second block to swap with"),
          start_time: z.string().optional(),
          end_time: z.string().optional(),
          notes: z.string().optional(),
          is_break: z.boolean().optional(),
          shift_minutes: z
            .number()
            .optional()
            .describe("For shift_schedule: minutes to shift (+30 pushes later, -15 earlier)"),
          align_to_now: z
            .boolean()
            .optional()
            .describe("For shift_schedule: shift schedule so first block starts right now"),
        }),
        execute: async (args) => {
          showMyDayCard = true;
          scheduleMutatedInTurn = true;
          const existing: MyDaySchedule = workingConfig.myDaySchedule || {
            date: clientLocalDateYMD,
            dayStartTime: clientLocalTimeHHMM,
            dayEndTime: addMinutesToTime(clientLocalTimeHHMM, 240),
            blocks: [],
            autoCascadeTimes: true,
            aiSummary: null,
            updatedAt: new Date().toISOString(),
          };

          const findScheduleBlockIdx = (q: string | undefined): number => {
            if (!q) return -1;
            const clean = q.trim().toLowerCase();
            return existing.blocks.findIndex(
              (b) =>
                b.id === q.trim() ||
                b.taskId === q.trim() ||
                b.title.toLowerCase() === clean ||
                b.title.toLowerCase().includes(clean)
            );
          };

          if (args.action === "clear_schedule") {
            workingConfig.myDaySchedule = {
              ...existing,
              blocks: [],
              aiSummary: null,
              updatedAt: new Date().toISOString(),
            };
            configTouched = true;
            recordAction("schedule", "Cleared MY DAY schedule");
            return { success: true, count: 0 };
          }

          if (args.action === "auto_arrange") {
            const sTime = normalizeTimeString(
              args.day_start_time,
              clientLocalTimeHHMM
            );
            const eTime = normalizeTimeString(
              args.day_end_time,
              addMinutesToTime(sTime, 240)
            );

            let pool: TaskItem[] = [];
            if (args.task_queries && args.task_queries.length > 0 && !args.include_all_active) {
              const seen = new Set<string>();
              for (const q of args.task_queries) {
                const found = findItem(q, { tasksOnly: true });
                if (found && !seen.has(found.id)) {
                  seen.add(found.id);
                  pool.push(found);
                }
              }
            }
            if (pool.length === 0) {
              pool = workingTasks.filter(
                (t) => !isHeaderRow(t) && !isDoneStatus(t.status)
              );
            }

            const arranged = smartHeuristicArrange({
              tasks: pool,
              startTime: sTime,
              endTime: eTime,
              includeBreaks: args.include_breaks ?? true,
            });

            workingConfig.myDaySchedule = {
              date: clientLocalDateYMD,
              dayStartTime: sTime,
              dayEndTime: eTime,
              blocks: arranged.blocks,
              autoCascadeTimes: true,
              aiSummary: arranged.summary,
              updatedAt: new Date().toISOString(),
            };
            configTouched = true;
            recordAction(
              "schedule",
              `Built MY DAY schedule (${arranged.blocks.length} slots, ${formatTime12h(
                sTime
              )} – ${formatTime12h(eTime)})`,
              arranged.summary
            );
            return {
              success: true,
              scheduledCount: arranged.blocks.length,
              summary: arranged.summary,
            };
          }

          if (args.action === "set_blocks" && Array.isArray(args.blocks)) {
            const built: MyDayBlock[] = args.blocks.map((raw) => {
              const task = !raw.is_break
                ? findItem(raw.task_id_or_title, { tasksOnly: true })
                : undefined;
              const s = normalizeTimeString(raw.start_time, clientLocalTimeHHMM);
              const e = normalizeTimeString(
                raw.end_time,
                addMinutesToTime(s, task ? recommendTaskMinutes(task) : 30)
              );
              return {
                id: makeBlockId(),
                taskId: task ? task.id : null,
                title: task ? task.title : raw.task_id_or_title,
                startTime: s,
                endTime: e,
                durationMinutes: computeDurationMinutes(s, e),
                category: task ? task.type : raw.is_break ? "Break" : "Focus",
                priority: task ? task.priority : "Medium",
                notes: raw.notes || task?.notes || "",
                completed: task ? isDoneStatus(task.status) : false,
                isBreak: Boolean(raw.is_break),
              };
            });

            workingConfig.myDaySchedule = {
              date: clientLocalDateYMD,
              dayStartTime: built[0]?.startTime || existing.dayStartTime,
              dayEndTime:
                built[built.length - 1]?.endTime || existing.dayEndTime,
              blocks: built,
              autoCascadeTimes: true,
              aiSummary: "Custom schedule arranged by Gemini Agent.",
              updatedAt: new Date().toISOString(),
            };
            configTouched = true;
            recordAction(
              "schedule",
              `Arranged ${built.length} blocks in MY DAY schedule`
            );
            return { success: true, scheduledCount: built.length };
          }

          if (args.action === "add_block") {
            const q = args.block_query || "Focus Block";
            const matched = !args.is_break
              ? findItem(q, { tasksOnly: true })
              : undefined;
            const defaultStart =
              existing.blocks.length > 0
                ? existing.blocks[existing.blocks.length - 1].endTime
                : clientLocalTimeHHMM;
            const s = normalizeTimeString(args.start_time, defaultStart);
            const recDur = matched ? recommendTaskMinutes(matched) : 30;
            const e = normalizeTimeString(
              args.end_time,
              addMinutesToTime(s, recDur)
            );
            const newBlock: MyDayBlock = {
              id: makeBlockId(),
              taskId: matched ? matched.id : null,
              title: matched ? matched.title : q,
              startTime: s,
              endTime: e,
              durationMinutes: computeDurationMinutes(s, e),
              category: matched
                ? matched.type
                : args.is_break
                ? "Break"
                : "Focus",
              priority: matched ? matched.priority : "Medium",
              notes: args.notes || matched?.notes || "",
              completed: matched ? isDoneStatus(matched.status) : false,
              isBreak: Boolean(args.is_break),
            };
            const nextBlocks = [...existing.blocks, newBlock];
            workingConfig.myDaySchedule = {
              ...existing,
              dayStartTime: nextBlocks[0].startTime,
              dayEndTime: nextBlocks[nextBlocks.length - 1].endTime,
              blocks: nextBlocks,
              updatedAt: new Date().toISOString(),
            };
            configTouched = true;
            recordAction(
              "schedule",
              `Scheduled "${newBlock.title}" (${formatTime12h(s)} – ${formatTime12h(
                e
              )})`
            );
            return { success: true, added: newBlock.title };
          }

          if (args.action === "update_block") {
            const idx = findScheduleBlockIdx(args.block_query);
            if (idx === -1) {
              return {
                success: false,
                error: "Could not find matching block in MY DAY schedule.",
              };
            }
            const target = existing.blocks[idx];
            const s = args.start_time
              ? normalizeTimeString(args.start_time, target.startTime)
              : target.startTime;
            const e = args.end_time
              ? normalizeTimeString(args.end_time, target.endTime)
              : args.start_time
              ? addMinutesToTime(s, target.durationMinutes)
              : target.endTime;

            let nextBlocks = existing.blocks.map((b, i) =>
              i === idx
                ? {
                    ...b,
                    startTime: s,
                    endTime: e,
                    durationMinutes: computeDurationMinutes(s, e),
                    notes: args.notes !== undefined ? args.notes : b.notes,
                  }
                : b
            );
            if (existing.autoCascadeTimes ?? true) {
              nextBlocks = cascadeFromBlockIndex(nextBlocks, idx);
            }
            workingConfig.myDaySchedule = {
              ...existing,
              dayStartTime: nextBlocks[0].startTime,
              dayEndTime: nextBlocks[nextBlocks.length - 1].endTime,
              blocks: nextBlocks,
              updatedAt: new Date().toISOString(),
            };
            configTouched = true;
            recordAction(
              "schedule",
              `Updated "${target.title}" to ${formatTime12h(s)} – ${formatTime12h(
                e
              )}`
            );
            return { success: true };
          }

          if (args.action === "swap_blocks") {
            const idxA = findScheduleBlockIdx(args.block_query);
            const idxB = findScheduleBlockIdx(args.second_block_query);
            if (idxA === -1 || idxB === -1) {
              return {
                success: false,
                error: "Could not find both blocks to swap in MY DAY.",
              };
            }
            const swapped = swapScheduleBlocks(
              existing.blocks,
              idxA,
              idxB,
              existing.autoCascadeTimes ?? true
            );
            workingConfig.myDaySchedule = {
              ...existing,
              blocks: swapped,
              updatedAt: new Date().toISOString(),
            };
            configTouched = true;
            recordAction(
              "schedule",
              `Swapped "${existing.blocks[idxA].title}" and "${existing.blocks[idxB].title}" in MY DAY`
            );
            return { success: true };
          }

          if (args.action === "shift_schedule") {
            if (existing.blocks.length === 0) {
              return { success: false, error: "Schedule is currently empty." };
            }
            const delta = args.align_to_now
              ? Math.round(clientLocalMinutesOfDay) -
                parseTimeToMinutes(existing.blocks[0].startTime)
              : args.shift_minutes || 0;
            const shifted = shiftScheduleBlocks(existing.blocks, delta);
            workingConfig.myDaySchedule = {
              ...existing,
              dayStartTime: shifted[0].startTime,
              dayEndTime: shifted[shifted.length - 1].endTime,
              blocks: shifted,
              updatedAt: new Date().toISOString(),
            };
            configTouched = true;
            recordAction(
              "schedule",
              args.align_to_now
                ? "Aligned MY DAY schedule start to current time"
                : `Shifted MY DAY schedule by ${delta > 0 ? `+${delta}m` : `${delta}m`}`
            );
            return { success: true };
          }

          if (args.action === "remove_block") {
            const idx = findScheduleBlockIdx(args.block_query);
            if (idx === -1) {
              return { success: false, error: "Block not found in schedule." };
            }
            const removed = existing.blocks[idx];
            const nextBlocks = existing.blocks.filter((_, i) => i !== idx);
            workingConfig.myDaySchedule = {
              ...existing,
              blocks: nextBlocks,
              updatedAt: new Date().toISOString(),
            };
            configTouched = true;
            recordAction(
              "schedule",
              `Removed "${removed.title}" from MY DAY schedule`
            );
            return { success: true };
          }

          return { success: false };
        },
      }),

      workspace_utilities: tool({
        description:
          "Trigger live Canvas LMS assignment sync or switch the user's active tab between Chat, Tasks table, and MY DAY.",
        parameters: z.object({
          sync_canvas: z
            .boolean()
            .optional()
            .describe("Set true when user asks to sync or refresh Canvas assignments"),
          switch_to_tab: z
            .enum(["chat", "tasks", "my_day"])
            .optional()
            .describe(
              "Set to 'tasks' or 'my_day' only when the user explicitly asks to switch to or open that tab"
            ),
        }),
        execute: async ({ sync_canvas, switch_to_tab }) => {
          if (sync_canvas) {
            triggerCanvasSync = true;
            recordAction("sync", "Triggered live Canvas LMS sync");
          }
          if (switch_to_tab) {
            switchTab = switch_to_tab;
          }
          return {
            success: true,
            sync_canvas: Boolean(sync_canvas),
            switch_to_tab: switch_to_tab || null,
          };
        },
      }),
      ...(qaSubmission
        ? {}
        : {
            prompt_user_qa: tool({
              description:
                "Prompt an interactive Q&A UI card in chat (asking 'Can I ask a few questions to fulfill your request?' first) to gauge missing tasks, goals, or schedule preferences from the user before creating tasks or building a plan.",
              parameters: z.object({
                purpose: z
                  .enum([
                    "plan_day",
                    "project_breakdown",
                    "workspace_setup",
                    "general",
                  ])
                  .describe(
                    "Use 'plan_day' when gauging tasks & timeframe to populate both the Tasks list and my day schedule"
                  ),
                consent_title: z
                  .string()
                  .optional()
                  .describe(
                    "Defaults to 'Can I ask a few questions to fulfill your request?'"
                  ),
                consent_subtitle: z
                  .string()
                  .describe(
                    "1-2 sentence explanation of how answering these quick questions will help fulfill their request"
                  ),
                submit_label: z
                  .string()
                  .optional()
                  .describe(
                    "Submit button text, e.g. 'Populate Tasks & Build my day' or 'Build My Plan'"
                  ),
                questions: z
                  .array(
                    z.object({
                      id: z.string().describe("Unique snake_case question id"),
                      question: z.string().describe("Clear, concise question"),
                      helperText: z.string().optional(),
                      inputType: z
                        .enum([
                          "textarea",
                          "text",
                          "single_choice",
                          "multi_choice",
                          "timeframe",
                        ])
                        .describe("UI control best suited for this question"),
                      options: z
                        .array(z.string())
                        .optional()
                        .describe(
                          "2-5 concise options when inputType is single_choice or multi_choice"
                        ),
                      placeholder: z.string().optional(),
                      quickChips: z.array(z.string()).optional(),
                      required: z.boolean().optional(),
                    })
                  )
                  .min(2)
                  .max(5),
              }),
              execute: async (args) => {
                qaState.prompt = {
                  id: `qa-${Date.now()}`,
                  purpose: args.purpose,
                  originalRequest: userMessage,
                  consentTitle:
                    args.consent_title?.trim() ||
                    "Can I ask a few questions to fulfill your request?",
                  consentSubtitle: args.consent_subtitle.trim(),
                  submitLabel: args.submit_label?.trim(),
                  status: "consent",
                  questions: args.questions.map((q) => ({
                    ...q,
                    ...(q.inputType === "timeframe"
                      ? {
                          defaultStartTime: defaultStartHHMM,
                          defaultEndTime: defaultEndHHMM,
                        }
                      : {}),
                  })),
                };
                return {
                  success: true,
                  promptedQA: true,
                  questionCount: args.questions.length,
                };
              },
            }),
          }),
    };

    // Execute Gemini with smart model fallback and latency optimization
    const google = createGoogleGenerativeAI({ apiKey: customApiKey });
    const modelChain =
      modelChoice === "pro"
        ? ["gemini-3.8-flash", "gemini-1.5-pro", "gemini-1.5-flash"]
        : ["gemini-3.8-flash", "gemini-1.5-flash", "gemini-2.5-flash"];

    let replyText = "";
    let usedModel = modelChain[0];
    let lastError: unknown = null;
    let succeeded = false;
    const tStart = Date.now();
    const candidateTimeoutMs = qaSubmission ? 10500 : 5500;

    for (const candidate of modelChain) {
      const candStart = Date.now();
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Timeout on model ${candidate}`)),
            candidateTimeoutMs
          )
        );

        const result = await Promise.race([
          generateText({
            model: google(candidate),
            system: systemPrompt,
            messages: conversationMessages,
            tools,
            maxSteps: qaSubmission ? 5 : 4,
            maxTokens: 1200,
          }),
          timeoutPromise,
        ]);

        usedModel = candidate;
        replyText = (result.text || "").trim();
        succeeded = true;
        console.log(
          `[Gemini Chat] Model "${candidate}" generated response in ${
            Date.now() - candStart
          }ms`
        );
        break;
      } catch (err) {
        lastError = err;
        console.warn(
          `[Gemini Chat] Candidate "${candidate}" attempt failed in ${
            Date.now() - candStart
          }ms:`,
          err
        );
        const info = extractCleanErrorMessage(err);
        // Do not retry other models if the API key itself is invalid OR if tools already mutated state
        if (info.isKeyError || executedActions.length > 0 || qaState.prompt) {
          if (executedActions.length > 0 || qaState.prompt) {
            succeeded = true;
            break;
          }
          return NextResponse.json(
            {
              error: "INVALID_API_KEY",
              reply: info.message,
            },
            { status: 401 }
          );
        }
      }
    }

    // Deterministic Safety Net for Guided Q&A Day Planning Submissions:
    // Guarantee that answers always populate BOTH the Tasks list AND the my day schedule!
    if (qaSubmission && qaSubmission.purpose === "plan_day") {
      const combinedAnswersLower = qaSubmission.answers
        .map((a) => a.answer.toLowerCase())
        .join(" ");

      const currentActiveOnBoard = workingTasks.filter(
        (t) => !isHeaderRow(t) && !isDoneStatus(t.status)
      );

      if (currentActiveOnBoard.length === 0 && qaSubmission.answers.length > 0) {
        const rawBraindump = qaSubmission.answers[0]?.answer || "";
        const parsedTitles = parseFallbackTaskTitles(rawBraindump);
        const nowISO = new Date().toISOString();
        const defaultEst = combinedAnswersLower.includes("90m")
          ? 75
          : combinedAnswersLower.includes("30m")
          ? 30
          : 45;

        for (let i = 0; i < parsedTitles.length; i++) {
          const newId = makeUuid();
          const newTask: TaskItem = {
            id: newId,
            user_id: userId,
            title: parsedTitles[i],
            content: "",
            status: workingConfig.statuses[0]?.label || "To Do",
            type: workingConfig.types[0]?.label || "General",
            priority: i === 0 ? "High" : "Medium",
            due_date: parseFlexibleDueDate("today", clientNowMs, tzOffsetMinutes),
            estimated_minutes: defaultEst,
            tags: ["#Today"],
            notes: "",
            is_canvas_assignment: false,
            canvas_course_code: null,
            custom_properties: {},
            section_group: "TODAY",
            order_index: workingTasks.length,
            completed_at: null,
            created_at: nowISO,
            updated_at: nowISO,
          };
          workingTasks.push(newTask);
          addedTasksMap.set(newId, newTask);
        }

        if (parsedTitles.length > 0) {
          reindexWorkingTasks();
          tasksTouched = true;
          succeeded = true;
          recordAction(
            "create",
            `Added ${parsedTitles.length} task${
              parsedTitles.length === 1 ? "" : "s"
            } to Tasks list`,
            parsedTitles.join(" • ")
          );
        }
      }

      const refreshedActivePool = workingTasks.filter(
        (t) => !isHeaderRow(t) && !isDoneStatus(t.status)
      );

      if (!scheduleMutatedInTurn && refreshedActivePool.length > 0) {
        const sTime = normalizeTimeString(
          qaSubmission.startTime,
          defaultStartHHMM
        );
        const eTime = normalizeTimeString(
          qaSubmission.endTime,
          addMinutesToTime(sTime, 240)
        );
        const includeBreaks = !combinedAnswersLower.includes("no breaks");
        const arranged = smartHeuristicArrange({
          tasks: refreshedActivePool,
          startTime: sTime,
          endTime: eTime,
          includeBreaks,
        });

        workingConfig.myDaySchedule = {
          date: clientLocalDateYMD,
          dayStartTime: sTime,
          dayEndTime: eTime,
          blocks: arranged.blocks,
          autoCascadeTimes: true,
          aiSummary: arranged.summary,
          updatedAt: new Date().toISOString(),
        };
        configTouched = true;
        showMyDayCard = true;
        scheduleMutatedInTurn = true;
        succeeded = true;
        recordAction(
          "schedule",
          `Built my day schedule (${arranged.blocks.length} slots, ${formatTime12h(
            sTime
          )} – ${formatTime12h(eTime)})`,
          arranged.summary
        );
      }
    }

    if (!succeeded) {
      const info = extractCleanErrorMessage(lastError);
      return NextResponse.json(
        {
          error: "AI_EXECUTION_ERROR",
          reply: info.message,
        },
        { status: info.status }
      );
    }

    if (!replyText && qaState.prompt) {
      replyText = qaState.prompt.consentSubtitle;
    } else if (!replyText && executedActions.length > 0) {
      replyText = `Done! Here is what I updated across your workspace:\n${executedActions
        .map((a) => `• **${a.summary}**${a.detail ? ` — ${a.detail}` : ""}`)
        .join("\n")}`;
    } else if (!replyText) {
      replyText = "I'm ready—let me know what you'd like to tackle next.";
    }

    if (configTouched) {
      workspaceConfigUpdatesAssign(workingConfig, incomingConfig);
    }

    const mutationPayload: AgentWorkspaceMutationPayload = {
      executedActions,
      tasksMutation: tasksTouched
        ? {
            updatedTasks: workingTasks,
            addedTasks: Array.from(addedTasksMap.values()),
            modifiedTasks: workingTasks.filter((t) => modifiedTaskIds.has(t.id)),
            deletedTaskIds: Array.from(deletedTaskIds),
            reordered,
          }
        : null,
      profileUpdates:
        Object.keys(profileUpdates).length > 0 ? profileUpdates : null,
      workspaceConfigUpdates: configTouched ? workingConfig : null,
      triggerCanvasSync,
      switchTab,
      showMyDayCard,
      qaPrompt: qaState.prompt,
    };

    return NextResponse.json({
      reply: replyText,
      modelUsed: usedModel,
      latencyMs: Date.now() - tStart,
      mutation: mutationPayload,
    });
  } catch (error: unknown) {
    const info = extractCleanErrorMessage(error);
    return NextResponse.json(
      { error: "SERVER_ERROR", reply: info.message },
      { status: info.status }
    );
  }
}

function workspaceConfigUpdatesAssign(
  working: WorkspaceConfig,
  incoming: WorkspaceConfig
) {
  if (working.geminiApiKey === undefined && incoming.geminiApiKey) {
    working.geminiApiKey = incoming.geminiApiKey;
  }
  if (working.myDaySchedule === undefined && incoming.myDaySchedule) {
    working.myDaySchedule = incoming.myDaySchedule;
  }
}
