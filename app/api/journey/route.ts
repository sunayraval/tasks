import { NextResponse } from "next/server";
import { generateText, CoreMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import {
  AIProvider,
  AITone,
  DEFAULT_NVIDIA_MODEL,
  JOURNEY_CATEGORY_META,
  JourneyAgentOperation,
  JourneyRoadmap,
  normalizeJourneyCategory,
  normalizeJourneyStatus,
} from "@/types/taskit";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

function makeId(prefix = "ms"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function resolveValidNvidiaModel(rawModel?: string): string {
  const m = (rawModel || "").trim();
  if (!m) return DEFAULT_NVIDIA_MODEL;
  const legacyMap: Record<string, string> = {
    "deepseek-ai/deepseek-v4.1-flash": "google/gemma-4-31b-it",
    "moonshotai/kimi-k2.6": "mistralai/mistral-large-4-1t-a52b",
    "nvidia/llama-3.1-nemotron-ultra-253b-v1": "nvidia/nemotron-3-ultra-550b-a55b",
  };
  return legacyMap[m] || m;
}

function repairJson(raw: string): string {
  let out = "";
  let inString = false;
  let i = 0;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '"' && (i === 0 || raw[i - 1] !== "\\")) {
      inString = !inString;
      out += ch;
      i++;
      continue;
    }
    if (inString) {
      if (ch === "\n") {
        out += "\\n";
        i++;
        continue;
      }
      if (ch === "\r") {
        i++;
        continue;
      }
      if (ch === "\t") {
        out += "\\t";
        i++;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out.replace(/,\s*([}\]])/g, "$1");
}

function extractJsonObject<T = Record<string, unknown>>(
  rawText: string
): T | null {
  if (!rawText || typeof rawText !== "string") return null;
  let cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(cleaned);
  if (fenceMatch && fenceMatch[1] && fenceMatch[1].includes("{")) {
    cleaned = fenceMatch[1].trim();
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  const candidate = cleaned.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(candidate) as T;
  } catch {
    try {
      return JSON.parse(repairJson(candidate)) as T;
    } catch {
      return null;
    }
  }
}

const TONE_DIRECTIVES: Record<AITone, string> = {
  locked_in:
    "Voice: crisp, ambitious, high-clarity strategist. Zero fluff, punchy momentum.",
  chill_coach:
    "Voice: calm, encouraging, grounded mentor focused on sustainable long-term progress.",
  hyper_drive:
    "Voice: intense, high-velocity execution partner. Bold, fired-up, action-oriented.",
  executive:
    "Voice: sharp chief-of-staff framing milestones around measurable outcomes and leverage.",
  killer_bee:
    "Voice: Killer Bee from Naruto! Drop playful rhymes and 'Bakayaro! Konoyaro!' while staying super accurate.",
  naruto:
    "Voice: Naruto Uzumaki! High-spirit determination, occasional 'Believe it!' / 'Dattebayo!' while keeping milestones super crisp.",
};

function sanitizeOperations(rawOps: unknown): JourneyAgentOperation[] {
  if (!Array.isArray(rawOps)) return [];
  const ops: JourneyAgentOperation[] = [];

  for (const item of rawOps) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const type = String(raw.type || "").trim();

    if (type === "set_journey_meta") {
      const title =
        typeof raw.title === "string" && raw.title.trim()
          ? raw.title.trim()
          : undefined;
      const vision =
        typeof raw.vision === "string" && raw.vision.trim()
          ? raw.vision.trim()
          : undefined;
      if (title || vision) {
        ops.push({
          type: "set_journey_meta",
          label:
            typeof raw.label === "string" && raw.label.trim()
              ? raw.label.trim()
              : title
              ? `Setting journey: "${title}"`
              : "Updating journey vision",
          detail:
            typeof raw.detail === "string" && raw.detail.trim()
              ? raw.detail.trim()
              : vision?.slice(0, 70),
          title,
          vision,
        });
      }
      continue;
    }

    if (type === "clear_milestones") {
      ops.push({
        type: "clear_milestones",
        label:
          typeof raw.label === "string" && raw.label.trim()
            ? raw.label.trim()
            : "Clearing current milestones to rebuild path",
        detail:
          typeof raw.detail === "string" ? raw.detail.trim() : undefined,
      });
      continue;
    }

    if (type === "add_milestone") {
      const mRaw =
        raw.milestone && typeof raw.milestone === "object"
          ? (raw.milestone as Record<string, unknown>)
          : raw;
      const title =
        typeof mRaw.title === "string" ? mRaw.title.trim() : "";
      if (!title) continue;

      const timeframe =
        typeof mRaw.timeframe === "string" && mRaw.timeframe.trim()
          ? mRaw.timeframe.trim()
          : typeof mRaw.targetDate === "string" && mRaw.targetDate.trim()
          ? mRaw.targetDate.trim()
          : "Upcoming";

      const category = normalizeJourneyCategory(
        typeof mRaw.category === "string" ? mRaw.category : undefined
      );
      const status = normalizeJourneyStatus(
        typeof mRaw.status === "string" ? mRaw.status : undefined
      );
      const description =
        typeof mRaw.description === "string" && mRaw.description.trim()
          ? mRaw.description.trim()
          : undefined;

      const checkpoints: string[] = Array.isArray(mRaw.checkpoints)
        ? mRaw.checkpoints
            .map((cp) => {
              if (typeof cp === "string") return cp.trim();
              if (cp && typeof cp === "object" && typeof (cp as { title?: unknown }).title === "string") {
                return String((cp as { title: string }).title).trim();
              }
              return "";
            })
            .filter((s) => s.length > 0)
            .slice(0, 6)
        : [];

      const insertAtIndex =
        typeof mRaw.insertAtIndex === "number" && Number.isFinite(mRaw.insertAtIndex)
          ? Math.max(0, Math.floor(mRaw.insertAtIndex))
          : undefined;

      const catLabel = JOURNEY_CATEGORY_META[category].label;
      ops.push({
        type: "add_milestone",
        label:
          typeof raw.label === "string" && raw.label.trim()
            ? raw.label.trim()
            : `Adding "${title}"`,
        detail:
          typeof raw.detail === "string" && raw.detail.trim()
            ? raw.detail.trim()
            : `${timeframe} · ${catLabel}`,
        milestone: {
          id: makeId("ms"),
          title,
          description,
          timeframe,
          category,
          status,
          checkpoints,
          insertAtIndex,
        },
      });
      continue;
    }

    if (type === "update_milestone") {
      const targetIdOrTitle = String(
        raw.targetIdOrTitle || raw.target || raw.milestoneId || ""
      ).trim();
      if (!targetIdOrTitle) continue;
      const uRaw =
        raw.updates && typeof raw.updates === "object"
          ? (raw.updates as Record<string, unknown>)
          : raw;

      const updates: Extract<
        JourneyAgentOperation,
        { type: "update_milestone" }
      >["updates"] = {};

      if (typeof uRaw.title === "string" && uRaw.title.trim()) {
        updates.title = uRaw.title.trim();
      }
      if (typeof uRaw.description === "string") {
        updates.description = uRaw.description.trim();
      }
      if (typeof uRaw.timeframe === "string" && uRaw.timeframe.trim()) {
        updates.timeframe = uRaw.timeframe.trim();
      }
      if (typeof uRaw.category === "string" && uRaw.category.trim()) {
        updates.category = normalizeJourneyCategory(uRaw.category);
      }
      if (typeof uRaw.status === "string" && uRaw.status.trim()) {
        updates.status = normalizeJourneyStatus(uRaw.status);
      }
      if (Array.isArray(uRaw.addCheckpoints)) {
        updates.addCheckpoints = uRaw.addCheckpoints
          .map((c) => String(c || "").trim())
          .filter(Boolean)
          .slice(0, 6);
      }
      if (Array.isArray(uRaw.replaceCheckpoints)) {
        updates.replaceCheckpoints = uRaw.replaceCheckpoints
          .map((c) => {
            if (typeof c === "string") return { title: c.trim(), completed: false };
            if (c && typeof c === "object") {
              const obj = c as Record<string, unknown>;
              return {
                title: String(obj.title || "").trim(),
                completed: Boolean(obj.completed),
              };
            }
            return { title: "", completed: false };
          })
          .filter((c) => c.title.length > 0)
          .slice(0, 8);
      }
      if (typeof uRaw.toggleCheckpointTitle === "string" && uRaw.toggleCheckpointTitle.trim()) {
        updates.toggleCheckpointTitle = uRaw.toggleCheckpointTitle.trim();
      }

      ops.push({
        type: "update_milestone",
        label:
          typeof raw.label === "string" && raw.label.trim()
            ? raw.label.trim()
            : `Updating "${targetIdOrTitle}"`,
        detail:
          typeof raw.detail === "string" && raw.detail.trim()
            ? raw.detail.trim()
            : updates.status
            ? `Status → ${updates.status.replace("_", " ")}`
            : updates.timeframe
            ? `Timeframe → ${updates.timeframe}`
            : undefined,
        targetIdOrTitle,
        updates,
      });
      continue;
    }

    if (type === "delete_milestone") {
      const targetIdOrTitle = String(
        raw.targetIdOrTitle || raw.target || raw.milestoneId || ""
      ).trim();
      if (!targetIdOrTitle) continue;
      ops.push({
        type: "delete_milestone",
        label:
          typeof raw.label === "string" && raw.label.trim()
            ? raw.label.trim()
            : `Removing "${targetIdOrTitle}"`,
        detail:
          typeof raw.detail === "string" ? raw.detail.trim() : undefined,
        targetIdOrTitle,
      });
      continue;
    }

    if (type === "reorder_milestones") {
      const ordered = Array.isArray(raw.orderedIdsOrTitles)
        ? raw.orderedIdsOrTitles.map((x) => String(x || "").trim()).filter(Boolean)
        : [];
      if (ordered.length > 0) {
        ops.push({
          type: "reorder_milestones",
          label:
            typeof raw.label === "string" && raw.label.trim()
              ? raw.label.trim()
              : "Reordering milestone sequence",
          detail: `${ordered.length} milestones arranged chronologically`,
          orderedIdsOrTitles: ordered,
        });
      }
    }
  }

  return ops;
}

function extractCleanError(error: unknown, provider: AIProvider): {
  status: number;
  message: string;
  isKeyError: boolean;
} {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : "Unexpected AI error";
  const lower = raw.toLowerCase();
  if (
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("invalid api key") ||
    lower.includes("api_key_invalid") ||
    lower.includes("unauthorized")
  ) {
    return {
      status: 401,
      isKeyError: true,
      message:
        provider === "nvidia"
          ? "Your NVIDIA NIM API key was rejected. Please verify it in Settings → AI."
          : "Your Google Gemini API key was rejected. Please verify it in Settings → AI.",
    };
  }
  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("quota")) {
    return {
      status: 429,
      isKeyError: false,
      message: "Rate limit hit on the selected model. Wait a few seconds or switch models in the Journey Agent header.",
    };
  }
  return {
    status: 500,
    isKeyError: false,
    message: raw.slice(0, 260),
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userMessage: string = String(body.message || "").trim();
    const journey = body.journey as JourneyRoadmap | undefined;
    const history = Array.isArray(body.history)
      ? (body.history as Array<{ role: string; content: string }>)
      : [];
    const tone: AITone = (body.tone as AITone) || "locked_in";
    const cursingMode = Boolean(body.cursingMode);
    const clientDateReadable: string =
      typeof body.clientDateReadable === "string" && body.clientDateReadable.trim()
        ? body.clientDateReadable.trim()
        : new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          });

    if (!userMessage) {
      return NextResponse.json(
        { error: "Please enter a message for the Journey Agent." },
        { status: 400 }
      );
    }

    // Resolve API keys & provider
    const reqProvider = body.provider as AIProvider | undefined;
    const rawUserKey = String(body.apiKey || "").trim();
    const rawNvidiaKey = String(body.nvidiaApiKey || "").trim();
    const rawGeminiKey = String(body.geminiApiKey || "").trim();

    const envNvidiaKey = (process.env.NVIDIA_API_KEY || "").trim();
    const envGeminiKey = (
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      ""
    ).trim();

    const nvidiaKey =
      (rawNvidiaKey.startsWith("nvapi-") ? rawNvidiaKey : "") ||
      (rawUserKey.startsWith("nvapi-") ? rawUserKey : "") ||
      envNvidiaKey;

    const geminiKey =
      (rawGeminiKey.startsWith("AIza") ? rawGeminiKey : "") ||
      (rawUserKey.startsWith("AIza") ? rawUserKey : "") ||
      envGeminiKey;

    const detectedProvider: AIProvider =
      reqProvider === "gemini" && geminiKey.length >= 15
        ? "gemini"
        : reqProvider === "nvidia" && nvidiaKey.length >= 15
        ? "nvidia"
        : nvidiaKey.length >= 15
        ? "nvidia"
        : "gemini";

    const requestedNvidiaModel = resolveValidNvidiaModel(body.nvidiaModel);
    const modelChoice: "flash" | "pro" =
      body.modelChoice === "pro" ? "pro" : "flash";

    if (
      (detectedProvider === "nvidia" && nvidiaKey.length < 15) ||
      (detectedProvider === "gemini" && geminiKey.length < 15)
    ) {
      return NextResponse.json(
        {
          error: "MISSING_API_KEY",
          reply:
            "Connect your free NVIDIA NIM or Google Gemini API key to use the Journey Agent — or click **+ Add Milestone** to set milestones manually anytime!",
        },
        { status: 401 }
      );
    }

    const currentMilestones = journey?.milestones || [];
    const serializedMilestones =
      currentMilestones.length > 0
        ? currentMilestones
            .map((m, idx) => {
              const cpSummary =
                m.checkpoints.length > 0
                  ? ` | Steps: ${m.checkpoints
                      .map((c) => `${c.completed ? "[x]" : "[ ]"} ${c.title}`)
                      .join("; ")}`
                  : "";
              return `${idx + 1}. [ID="${m.id}"] "${m.title}" • Timeframe: "${m.timeframe}" • Category: ${m.category} • Status: ${m.status}${
                m.description ? ` • Outcome: "${m.description}"` : ""
              }${cpSummary}`;
            })
            .join("\n")
        : "(Empty — no milestones set yet)";

    const cursingDirective = cursingMode
      ? `\n🤬 CURSING MODE ENABLED (UNFILTERED COMEDY):
The user explicitly toggled on Cursing Mode for fun! In your "reply" field ONLY, openly curse, swear, and be hilariously vulgar (drop real F-bombs, "shit", "ass", "damn", "motherfucker", never censor with asterisks) while keeping the milestone titles/descriptions clean, sharp, and genuinely inspiring!`
      : "";

    const systemPrompt = `You are the **Journey Agent** inside "kite" — an autonomous, sequential milestone-roadmap architect.
${TONE_DIRECTIVES[tone]}${cursingDirective}

CURRENT USER LOCAL DATE: ${clientDateReadable}

CURRENT JOURNEY STATE:
- Journey Title: "${journey?.title || "My Journey"}"
- Vision: "${journey?.vision || "The big milestones I'm building toward over time."}"
- Milestones (${currentMilestones.length} total, in chronological sequence):
${serializedMilestones}

YOUR ROLE:
You help the user visually map out BIG, meaningful life/career/academic/startup/health/creative milestones over time.
When the user tells you their goals, dreams, timeline, or edits, you emit an **ordered sequence of atomic agent operations** so the UI adds/updates milestones one-by-one sequentially like a live autonomous agent!

CRITICAL RULES:
1. ALWAYS return ONLY a valid JSON object matching the exact schema below (no markdown prose outside the JSON object).
2. Whenever the user asks to add, plan, map out, set up, update, complete, break down, reorder, or remove milestones:
   - You MUST populate \`"operations"\` with concrete step-by-step operations!
   - NEVER just list milestones in \`"reply"\` with an empty \`"operations": []\` array!
   - Emit ONE separate \`"add_milestone"\` operation per milestone in chronological order (earliest → latest) so the UI builds the path step-by-step sequentially!
3. Keep each milestone CLEAN, CRISP, and EASY TO READ:
   - \`title\`: 3–7 punchy words (e.g., "Launch MVP to First 50 Users", "Hit 1550+ SAT Score", "Run First Half Marathon").
   - \`timeframe\`: Short, scannable horizon grounded in ${clientDateReadable} (e.g., "Dec 2026", "Q1 2027", "Spring 2027", "Jul 2027", "Year 2").
   - \`category\`: One of \`"career" | "academics" | "startup" | "health" | "creative" | "finance" | "personal" | "custom"\`.
   - \`description\`: 1 concise sentence defining what success looks like (max ~130 chars).
   - \`status\`: \`"in_progress"\` for the first active milestone if none is in progress yet, \`"upcoming"\` for future milestones, \`"completed"\` if already achieved.
   - \`checkpoints\`: 2 to 4 concrete, actionable mini-steps (3–8 words each) that lead to accomplishing that milestone.
4. When building a brand-new journey from an empty roadmap (or when user asks to replace/rebuild their journey), emit \`"set_journey_meta"\` first with a motivating title + 1-line vision, then each \`"add_milestone"\` sequentially!
5. For purely conversational questions (e.g., "which milestone should I focus on first?", "how am I doing?"), \`"operations"\` may be \`[]\` and answer thoughtfully in \`"reply"\`.

EXACT JSON OUTPUT SCHEMA:
{
  "reply": "Concise, motivating response confirming what you sequentially mapped or updated.",
  "operations": [
    {
      "type": "set_journey_meta",
      "label": "Setting journey theme & vision",
      "detail": "Short detail",
      "title": "Optional new journey title",
      "vision": "Optional 1-sentence vision"
    },
    {
      "type": "clear_milestones",
      "label": "Clearing previous milestones"
    },
    {
      "type": "add_milestone",
      "label": "Adding Milestone 1: Ship v1 Prototype",
      "detail": "Jan 2027 · Build / Startup",
      "milestone": {
        "title": "Ship v1 Prototype",
        "timeframe": "Jan 2027",
        "category": "startup",
        "description": "Deploy a working MVP with core functionality for real early users.",
        "status": "in_progress",
        "checkpoints": [
          "Lock core MVP scope",
          "Build and deploy v1",
          "Collect feedback from 10 users"
        ]
      }
    },
    {
      "type": "update_milestone",
      "label": "Updating milestone status",
      "detail": "Marked as completed",
      "targetIdOrTitle": "exact ID or title of existing milestone",
      "updates": {
        "title": "optional",
        "description": "optional",
        "timeframe": "optional",
        "category": "optional",
        "status": "upcoming | in_progress | completed",
        "addCheckpoints": ["optional new step"],
        "replaceCheckpoints": [{ "title": "step", "completed": false }]
      }
    },
    {
      "type": "delete_milestone",
      "label": "Removing milestone",
      "targetIdOrTitle": "exact ID or title"
    },
    {
      "type": "reorder_milestones",
      "label": "Reordering milestones chronologically",
      "orderedIdsOrTitles": ["id1", "id2", "id3"]
    }
  ]
}`;

    const messages: CoreMessage[] = [
      ...history
        .slice(-6)
        .filter((m) => m.content && m.content.trim().length > 0)
        .map((m) => ({
          role: (m.role === "assistant" ? "assistant" : "user") as
            | "user"
            | "assistant",
          content: m.content.slice(0, 900),
        })),
      { role: "user", content: userMessage },
    ];

    const isMutationIntent =
      /\b(add|create|set\s*up|build|map|plan|make|generate|put|insert|edit|update|change|mark|complete|finish|reach|delete|remove|drop|clear|rebuild|reorder|move|push|shift|break\s*down|add\s+steps|milestones?|journey|roadmap|goal|accomplish|want\s+to)\b/i.test(
        userMessage
      );

    interface JourneyLLMResult {
      reply: string;
      operations: JourneyAgentOperation[];
      modelUsed: string;
    }

    let lastError: unknown = null;
    const tStart = Date.now();

    const tryCallNvidia = async (
      key: string
    ): Promise<JourneyLLMResult | null> => {
      if (!key || key.length < 15) return null;
      const nvidia = createOpenAI({
        baseURL: "https://integrate.api.nvidia.com/v1",
        apiKey: key,
        compatibility: "compatible",
      });

      const primary = requestedNvidiaModel;
      const backup =
        primary !== "google/gemma-4-31b-it"
          ? "google/gemma-4-31b-it"
          : "nvidia/nemotron-3.5-lightning-30b-a3b";
      const candidates = [primary, backup];

      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        try {
          const timeout = new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Timeout on ${candidate}`)),
              45000
            )
          );
          const extraReminder: CoreMessage[] =
            i > 0 && isMutationIntent
              ? [
                  {
                    role: "system",
                    content:
                      'REMINDER: Return ONLY a valid JSON object with non-empty "operations" array containing concrete add_milestone / update_milestone / delete_milestone actions.',
                  },
                ]
              : [];

          const res = await Promise.race([
            generateText({
              model: nvidia(candidate),
              system: systemPrompt,
              messages: [...messages, ...extraReminder],
              maxTokens: 2800,
              temperature: 0.45,
            }),
            timeout,
          ]);

          const rawText = (res.text || "").trim();
          const parsed = extractJsonObject<{
            reply?: string;
            operations?: unknown;
          }>(rawText);

          if (parsed) {
            const ops = sanitizeOperations(parsed.operations);
            if (isMutationIntent && ops.length === 0 && i < candidates.length - 1) {
              console.warn(
                `[Journey Agent] "${candidate}" returned 0 operations on mutation request; retrying with "${candidates[i + 1]}".`
              );
              continue;
            }
            return {
              reply:
                typeof parsed.reply === "string" && parsed.reply.trim()
                  ? parsed.reply.trim()
                  : ops.length > 0
                  ? `Mapped ${ops.length} step${ops.length === 1 ? "" : "s"} onto your journey!`
                  : "All set — let me know what milestones you'd like to add next!",
              operations: ops,
              modelUsed: candidate,
            };
          }

          if (i === candidates.length - 1 && rawText) {
            return {
              reply: rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim(),
              operations: [],
              modelUsed: candidate,
            };
          }
        } catch (err) {
          lastError = err;
          const info = extractCleanError(err, "nvidia");
          if (info.isKeyError) return null;
        }
      }
      return null;
    };

    const tryCallGemini = async (
      key: string
    ): Promise<JourneyLLMResult | null> => {
      if (!key || key.length < 15) return null;
      const google = createGoogleGenerativeAI({ apiKey: key });
      const candidates =
        modelChoice === "pro"
          ? ["gemini-1.5-pro", "gemini-2.0-flash"]
          : ["gemini-2.0-flash", "gemini-1.5-flash"];

      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        try {
          const timeout = new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Timeout on ${candidate}`)),
              45000
            )
          );
          const res = await Promise.race([
            generateText({
              model: google(candidate),
              system: systemPrompt,
              messages,
              maxTokens: 2800,
              temperature: 0.45,
            }),
            timeout,
          ]);

          const rawText = (res.text || "").trim();
          const parsed = extractJsonObject<{
            reply?: string;
            operations?: unknown;
          }>(rawText);

          if (parsed) {
            const ops = sanitizeOperations(parsed.operations);
            return {
              reply:
                typeof parsed.reply === "string" && parsed.reply.trim()
                  ? parsed.reply.trim()
                  : ops.length > 0
                  ? `Mapped ${ops.length} step${ops.length === 1 ? "" : "s"} onto your journey!`
                  : "All set — tell me what milestone you want to map next!",
              operations: ops,
              modelUsed: candidate,
            };
          }

          if (i === candidates.length - 1 && rawText) {
            return {
              reply: rawText,
              operations: [],
              modelUsed: candidate,
            };
          }
        } catch (err) {
          lastError = err;
          const info = extractCleanError(err, "gemini");
          if (info.isKeyError) return null;
        }
      }
      return null;
    };

    let parsedResult: JourneyLLMResult | null = null;

    if (detectedProvider === "nvidia") {
      parsedResult = await tryCallNvidia(nvidiaKey);
      const isKeyErr =
        lastError && extractCleanError(lastError, "nvidia").isKeyError;
      if (!parsedResult && !isKeyErr && geminiKey.length >= 15) {
        parsedResult = await tryCallGemini(geminiKey);
      }
    } else {
      parsedResult = await tryCallGemini(geminiKey);
      const isKeyErr =
        lastError && extractCleanError(lastError, "gemini").isKeyError;
      if (!parsedResult && !isKeyErr && nvidiaKey.length >= 15) {
        parsedResult = await tryCallNvidia(nvidiaKey);
      }
    }

    if (!parsedResult) {
      const info = extractCleanError(lastError, detectedProvider);
      return NextResponse.json(
        {
          error: info.isKeyError ? "INVALID_API_KEY" : "AI_EXECUTION_ERROR",
          reply: info.message,
        },
        { status: info.status }
      );
    }

    return NextResponse.json({
      reply: parsedResult.reply,
      operations: parsedResult.operations,
      modelUsed: parsedResult.modelUsed,
      latencyMs: Date.now() - tStart,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Journey agent error";
    return NextResponse.json(
      { error: "SERVER_ERROR", reply: msg },
      { status: 500 }
    );
  }
}
