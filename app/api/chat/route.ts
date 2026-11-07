import { NextResponse } from "next/server";
import { generateText, tool, CoreMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import {
  AgentExecutedAction,
  AgentWorkspaceMutationPayload,
  AIModelChoice,
  AITone,
  BADGE_COLOR_KEYS,
  BadgeColorKey,
  DEFAULT_WORKSPACE_CONFIG,
  TaskItem,
  THEME_OPTIONS,
  ThemeName,
  UserProfile,
  VideoPresetName,
  ViewMode,
  WorkspaceConfig,
  WorkspaceTab,
} from "@/types/taskit";

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
    const videoPreset: VideoPresetName = body.videoPreset || "rain";
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
    };

    const addedTasksMap = new Map<string, TaskItem>();
    const modifiedTaskIds = new Set<string>();
    const deletedTaskIds = new Set<string>();
    let reordered = false;
    let tasksTouched = false;
    let configTouched = false;
    const profileUpdates: Partial<UserProfile> = {};
    const executedActions: AgentExecutedAction[] = [];
    let triggerCanvasSync = false;
    let switchTab: WorkspaceTab | null = null;

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

    const systemPrompt = `You are the Gemini Workspace Agent for "${workingConfig.brandName}" (${workingConfig.workspaceTitle}).
${TONE_PROMPTS[tone]}

CURRENT USER LOCAL DATE: ${clientLocalDateReadable} (ISO: ${clientISO})

CONVERSATIONAL FAST PATH:
- For simple greetings, small talk, acknowledgments, or questions that don't ask to change the workspace (e.g. "yo", "hi", "hey", "hello", "how are you?", "what can you do?"), respond directly and naturally in text. DO NOT invoke any tools for simple conversational messages.

YOUR CAPABILITIES:
You have direct, live read/write control over the user's entire workspace via your tools:
1. Tasks: Add single or batch tasks, edit titles/statuses/priorities/categories/due dates/time estimates/tags/notes, write rich HTML study guides or checklists into a task's document ("content"), mark tasks Done or reopen them, delete tasks, and move/reorder/sort tasks anywhere in the table.
2. Section Headers: Create, rename, move, or remove movable divider headers (like TODAY, TOMORROW, COLLEGE, SOON, REMEMBER, or custom sections).
3. Themes & Atmosphere: Switch between preset themes (${THEME_OPTIONS.map((t) => `${t.id} ("${t.name}")`).join(", ")}) OR design bespoke custom 5-color hex palettes, switch ambient backgrounds (rain, cyber, lofi, particles), and adjust dim/blur.
4. Workspace Settings & Customization: Update workspace title/subtitle/brand, toggle "Show completed tasks", change task document view mode (slide_drawer, center_modal, inline), change AI coaching tone, rename table columns, or create custom color-coded tags/categories/statuses/priorities.
5. Integrations & Navigation: Trigger a live Canvas LMS sync or switch the user's active view to the Tasks table.

GUIDELINES FOR THOUGHTFUL EXECUTION:
- Execute user requests directly using the appropriate tools—do NOT ask for permission first unless a request is genuinely ambiguous. You can chain multiple tools in one turn!
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

CURRENT BOARD (${workingTasks.length} rows in exact top-to-bottom table order):
${serializedBoard || "(No tasks currently on the board)"}`;

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
            .enum(["rain", "cyber", "lofi", "particles"])
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

      workspace_utilities: tool({
        description:
          "Trigger live Canvas LMS assignment sync or switch the user's active tab to the Tasks table.",
        parameters: z.object({
          sync_canvas: z
            .boolean()
            .optional()
            .describe("Set true when user asks to sync or refresh Canvas assignments"),
          switch_to_tab: z
            .enum(["chat", "tasks"])
            .optional()
            .describe("Set to 'tasks' only when the user explicitly asks to switch to or open the Tasks table tab"),
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

    for (const candidate of modelChain) {
      const candStart = Date.now();
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Timeout on model ${candidate}`)),
            5500
          )
        );

        const result = await Promise.race([
          generateText({
            model: google(candidate),
            system: systemPrompt,
            messages: conversationMessages,
            tools,
            maxSteps: 4,
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
        if (info.isKeyError || executedActions.length > 0) {
          if (executedActions.length > 0) {
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

    if (!replyText && executedActions.length > 0) {
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
}
