import { NextResponse } from "next/server";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import {
  AIProvider,
  AITone,
  DEFAULT_NVIDIA_MODEL,
  StudyCheckpoint,
  StudyModule,
  StudySubtopic,
  StudySyllabus,
  StudySyllabusMutation,
  StudyVisualPayload,
  computeSyllabusProgress,
  normalizeSyllabusStates,
} from "@/types/taskit";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

function makeId(prefix = "st"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Strips <think>...</think> reasoning blocks and markdown code fences to extract a clean JSON object.
 */
function extractJsonObject<T = Record<string, unknown>>(rawText: string): T | null {
  if (!rawText || typeof rawText !== "string") return null;

  // Remove <think>...</think> tags emitted by reasoning models
  let cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Remove ```json ... ``` fences if present
  const fenceMatch = /```(?:json)?\s*([\s\S]*?)```/i.exec(cleaned);
  if (fenceMatch && fenceMatch[1]) {
    cleaned = fenceMatch[1].trim();
  }

  // Locate outermost { ... }
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
      // Repair trailing commas before } or ]
      const repaired = candidate.replace(/,\s*([}\]])/g, "$1");
      return JSON.parse(repaired) as T;
    } catch {
      return null;
    }
  }
}

const TUTOR_SYSTEM_PROMPT = `You are the AI Tutor powering "flo study" (Study Mode).
Follow these mandatory behavioral rules on every turn:
1. Role & Accuracy: You are an expert, hyper-organized tutor. Prioritize 100% factual precision, clear definitions, and structured reasoning.
2. Respect User Syllabus Edits: Always treat the live syllabus JSON provided in context as the single source of truth. Never bring back topics the user deleted, and never re-teach subtopics marked "skipped_known" or "mastered". If the user asks in chat to skip, remove, or add a topic, emit the corresponding syllabus state update in "syllabusMutations" and move immediately to the next active "in_progress" subtopic.
3. One Step at a Time: Teach ONLY the current active subtopic in concise, digestible paragraphs or bullet points. Never dump long walls of text or teach multiple subtopics at once. Use bolded key terms and LaTeX ($...$ for inline math, $$...$$ for block equations) when teaching math, science, or quantitative formulas.
4. Always Visualize: Whenever a concept involves a process, relationship, structure, comparison, or quantitative trend, include a clean "visual" payload:
   - "mermaid": Valid Mermaid.js diagram syntax (e.g. flowchart TD, flowchart LR, sequenceDiagram, stateDiagram-v2). Quote node labels containing parentheses or special characters, e.g. A["Step 1 (Input)"] --> B["Step 2 (Output)"].
   - "svg": Clean, self-contained inline <svg viewBox="0 0 500 280" ...> diagram with high-contrast strokes/labels for dark backgrounds (use light colors like #e2e8f0, #38bdf8, #a855f7, #34d399, #facc15 on transparent or dark backgrounds).
   - "comparison_table": Structured table with "tableHeaders" (string[]) and "tableRows" (string[][]).
   - "visual_cards": Side-by-side structured visual breakdown cards.
5. Verify Understanding: End every teaching turn with 1 targeted interactive question ("checkpoint") — either "mcq" (with 4 options, exact isCorrect boolean, and a targeted explanation for each option explaining why it is right or wrong) or "short_answer" (active recall prompt where the user explains the concept in their own words).
6. Gate Progression: Only mark the current subtopic as "mastered" and introduce the next subtopic once the user answers correctly (or explicitly chooses to mark it as already known). If they miss it or express confusion, do NOT advance—re-explain the current concept from a different angle or simpler analogy and issue a follow-up check until mastery is demonstrated.
7. Zero Omissions: Address every remaining active subtopic in order until 100% of the active syllabus is complete.`;

/**
 * Fallback deterministic syllabus builder in case API key is unavailable or model times out,
 * ensuring 100% coverage of user-entered topics.
 */
function buildDeterministicSyllabus(topicInput: string): StudySyllabus {
  const rawSegments = topicInput
    .split(/[\n,;•]+/)
    .map((s) => s.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((s) => s.length >= 2);

  const topics =
    rawSegments.length > 0 ? rawSegments.slice(0, 8) : [topicInput.trim() || "Core Topic"];

  const modules: StudyModule[] = topics.map((topic, idx) => {
    const cleanTopic = topic.charAt(0).toUpperCase() + topic.slice(1);
    return {
      id: makeId(`mod-${idx + 1}`),
      title: `Module ${idx + 1}: ${cleanTopic}`,
      description: `Comprehensive mastery of ${cleanTopic} from foundational principles to applied problem-solving.`,
      subtopics: [
        {
          id: makeId(`sub-${idx + 1}-1`),
          title: `${cleanTopic}: Core Definitions & Intuition`,
          description: `Foundational principles, key terminology, and mental models for ${cleanTopic}.`,
          estimatedMinutes: 8,
          state: idx === 0 ? "in_progress" : "locked",
        },
        {
          id: makeId(`sub-${idx + 1}-2`),
          title: `${cleanTopic}: Mechanisms & Key Relationships`,
          description: `How the components of ${cleanTopic} interact, including formulas, rules, or causal structure.`,
          estimatedMinutes: 10,
          state: "locked",
        },
        {
          id: makeId(`sub-${idx + 1}-3`),
          title: `${cleanTopic}: Applied Analysis & Edge Cases`,
          description: `Real-world applications, common pitfalls, and synthesis of ${cleanTopic}.`,
          estimatedMinutes: 10,
          state: "locked",
        },
      ],
    };
  });

  const nowISO = new Date().toISOString();
  return normalizeSyllabusStates({
    id: makeId("syl"),
    topicQuery: topicInput.trim(),
    title:
      topics.length === 1
        ? `Mastery Curriculum: ${topics[0]}`
        : `Custom Study Curriculum (${topics.length} Topics)`,
    overview: `Structured, bite-sized curriculum covering ${topics.join(", ")} with interactive comprehension checkpoints and visual models.`,
    modules,
    createdAt: nowISO,
    updatedAt: nowISO,
  });
}

/**
 * Applies structured or natural-language syllabus mutations to the live syllabus.
 */
function applyMutationsToSyllabus(
  syllabus: StudySyllabus,
  mutations: StudySyllabusMutation[],
  currentActiveSubtopicId?: string | null
): { updatedSyllabus: StudySyllabus; appliedSummaries: string[] } {
  let workingModules: StudyModule[] = syllabus.modules.map((m) => ({
    ...m,
    subtopics: m.subtopics.map((s) => ({ ...s })),
  }));
  const appliedSummaries: string[] = [];

  const matchSubtopic = (targetId?: string, targetTitle?: string): { modIdx: number; subIdx: number } | null => {
    if (targetId) {
      for (let m = 0; m < workingModules.length; m++) {
        const sIdx = workingModules[m].subtopics.findIndex((s) => s.id === targetId);
        if (sIdx !== -1) return { modIdx: m, subIdx: sIdx };
      }
    }
    if (targetTitle) {
      const q = targetTitle.trim().toLowerCase();
      for (let m = 0; m < workingModules.length; m++) {
        const sIdx = workingModules[m].subtopics.findIndex(
          (s) =>
            s.title.toLowerCase() === q ||
            s.title.toLowerCase().includes(q) ||
            q.includes(s.title.toLowerCase())
        );
        if (sIdx !== -1) return { modIdx: m, subIdx: sIdx };
      }
    }
    return null;
  };

  for (const mut of mutations) {
    if (mut.action === "skip_known") {
      const loc =
        matchSubtopic(mut.targetId, mut.targetTitle) ||
        (currentActiveSubtopicId ? matchSubtopic(currentActiveSubtopicId) : null);
      if (loc) {
        const sub = workingModules[loc.modIdx].subtopics[loc.subIdx];
        sub.state = "skipped_known";
        appliedSummaries.push(`Marked "${sub.title}" as Already Known (skipped)`);
      }
    } else if (mut.action === "mark_mastered") {
      const loc =
        matchSubtopic(mut.targetId, mut.targetTitle) ||
        (currentActiveSubtopicId ? matchSubtopic(currentActiveSubtopicId) : null);
      if (loc) {
        const sub = workingModules[loc.modIdx].subtopics[loc.subIdx];
        sub.state = "mastered";
        appliedSummaries.push(`Mastered "${sub.title}"`);
      }
    } else if (mut.action === "remove_subtopic") {
      const loc =
        matchSubtopic(mut.targetId, mut.targetTitle) ||
        (currentActiveSubtopicId && !mut.targetTitle
          ? matchSubtopic(currentActiveSubtopicId)
          : null);
      if (loc) {
        const removed = workingModules[loc.modIdx].subtopics[loc.subIdx];
        workingModules[loc.modIdx].subtopics.splice(loc.subIdx, 1);
        appliedSummaries.push(`Removed subtopic "${removed.title}" from curriculum`);
      }
    } else if (mut.action === "remove_module") {
      const q = (mut.targetTitle || "").trim().toLowerCase();
      const modIdx = workingModules.findIndex(
        (m) =>
          m.id === mut.targetId ||
          (q && (m.title.toLowerCase().includes(q) || q.includes(m.title.toLowerCase())))
      );
      if (modIdx !== -1) {
        const removedMod = workingModules[modIdx];
        workingModules.splice(modIdx, 1);
        appliedSummaries.push(`Removed module "${removedMod.title}"`);
      }
    } else if (mut.action === "rename_subtopic" && mut.newTitle?.trim()) {
      const loc =
        matchSubtopic(mut.targetId, mut.targetTitle) ||
        (currentActiveSubtopicId ? matchSubtopic(currentActiveSubtopicId) : null);
      if (loc) {
        const oldTitle = workingModules[loc.modIdx].subtopics[loc.subIdx].title;
        workingModules[loc.modIdx].subtopics[loc.subIdx].title = mut.newTitle.trim();
        appliedSummaries.push(`Renamed "${oldTitle}" to "${mut.newTitle.trim()}"`);
      }
    } else if (mut.action === "rename_module" && mut.newTitle?.trim()) {
      const q = (mut.targetTitle || "").trim().toLowerCase();
      const modIdx = workingModules.findIndex(
        (m) =>
          m.id === mut.targetId ||
          (q && (m.title.toLowerCase().includes(q) || q.includes(m.title.toLowerCase())))
      );
      if (modIdx !== -1) {
        const oldTitle = workingModules[modIdx].title;
        workingModules[modIdx].title = mut.newTitle.trim();
        appliedSummaries.push(`Renamed module "${oldTitle}" to "${mut.newTitle.trim()}"`);
      }
    } else if (mut.action === "add_subtopic") {
      const titleToAdd = (mut.newTitle || mut.targetTitle || "").trim();
      if (titleToAdd) {
        let targetModIdx = 0;
        if (mut.parentModuleId || mut.parentModuleTitle) {
          const pq = (mut.parentModuleTitle || "").trim().toLowerCase();
          const foundIdx = workingModules.findIndex(
            (m) =>
              m.id === mut.parentModuleId ||
              (pq && m.title.toLowerCase().includes(pq))
          );
          if (foundIdx !== -1) targetModIdx = foundIdx;
        } else if (currentActiveSubtopicId) {
          const activeLoc = matchSubtopic(currentActiveSubtopicId);
          if (activeLoc) targetModIdx = activeLoc.modIdx;
        }
        if (workingModules.length === 0) {
          workingModules.push({
            id: makeId("mod"),
            title: "Custom Module",
            description: "User-added study module",
            subtopics: [],
          });
        }
        workingModules[targetModIdx].subtopics.push({
          id: makeId("sub"),
          title: titleToAdd,
          description: mut.description || `Focused micro-lesson on ${titleToAdd}`,
          estimatedMinutes: 8,
          state: "locked",
        });
        appliedSummaries.push(`Added subtopic "${titleToAdd}" to curriculum`);
      }
    } else if (mut.action === "add_module") {
      const modTitle = (mut.newTitle || mut.targetTitle || "").trim();
      if (modTitle) {
        workingModules.push({
          id: makeId("mod"),
          title: modTitle,
          description: mut.description || `Module covering ${modTitle}`,
          subtopics: [
            {
              id: makeId("sub"),
              title: `${modTitle}: Core Concepts`,
              description: `Key principles and applications of ${modTitle}`,
              estimatedMinutes: 10,
              state: "locked",
            },
          ],
        });
        appliedSummaries.push(`Added module "${modTitle}"`);
      }
    }
  }

  // Filter out empty modules if all their subtopics were removed (unless all modules are empty)
  const nonEmptyModules = workingModules.filter((m) => m.subtopics.length > 0);
  const finalModules = nonEmptyModules.length > 0 ? nonEmptyModules : workingModules;

  const normalized = normalizeSyllabusStates({
    ...syllabus,
    modules: finalModules,
    updatedAt: new Date().toISOString(),
  });

  return { updatedSyllabus: normalized, appliedSummaries };
}

/**
 * Deterministic natural-language command detector for chat messages so overrides like
 * "I already know this, skip ahead" or "Remove [topic], I don't need to learn it"
 * are guaranteed to execute even before or alongside LLM output.
 */
function detectNaturalLanguageSyllabusMutations(
  userMessage: string,
  syllabus: StudySyllabus,
  activeSubtopic: StudySubtopic | null
): StudySyllabusMutation[] {
  const msg = (userMessage || "").trim();
  if (!msg) return [];
  const lower = msg.toLowerCase();
  const mutations: StudySyllabusMutation[] = [];

  // 1. Detect "I already know this" / "skip ahead" / "skip this subtopic"
  if (
    /\b(i\s+already\s+know(\s+this|\s+it)?|already\s+familiar|skip\s+ahead|skip\s+this(\s+topic|\s+subtopic|\s+lesson)?|mark\s+(this\s+)?(as\s+)?known|pass\s+this\s+topic)\b/i.test(
      lower
    )
  ) {
    if (activeSubtopic) {
      mutations.push({
        action: "skip_known",
        targetId: activeSubtopic.id,
        targetTitle: activeSubtopic.title,
      });
    }
  }

  // 2. Detect "Remove [topic], I don't need to learn it" / "Delete [topic]" / "Don't want to learn [topic]"
  const removeMatch =
    /(?:remove|delete|drop|exclude|cut)\s+["']?([^"',.!?\n]+?)["']?(?:\s*,\s*|\s+because\s+|\s+since\s+|\s+from\s+the\s+syllabus|\s+i\s+don'?t\s+(?:need|want)|[.!?]|$)/i.exec(
      msg
    ) ||
    /i\s+don'?t\s+(?:need|want)\s+to\s+(?:learn|study|cover)\s+["']?([^"',.!?\n]+?)["']?(?:[.!?]|$)/i.exec(
      msg
    );

  if (removeMatch && removeMatch[1]) {
    const rawTarget = removeMatch[1].trim();
    if (/^(this|this\s+topic|this\s+subtopic|this\s+lesson|it)$/i.test(rawTarget)) {
      if (activeSubtopic) {
        mutations.push({
          action: "remove_subtopic",
          targetId: activeSubtopic.id,
          targetTitle: activeSubtopic.title,
        });
      }
    } else if (rawTarget.length >= 2) {
      mutations.push({
        action: "remove_subtopic",
        targetTitle: rawTarget,
      });
    }
  }

  // 3. Detect "Add [topic] to the syllabus"
  const addMatch =
    /(?:add|insert|include)\s+(?:a\s+)?(?:new\s+)?(?:subtopic|topic|lesson|module)?\s*(?:on|about|for|called|named)?\s*["']([^"']+)["']/i.exec(
      msg
    ) ||
    /(?:add|include)\s+(?:a\s+)?(?:subtopic|topic|lesson)\s+(?:on|about|for)\s+([^,.!?\n]+)/i.exec(
      msg
    );

  if (addMatch && addMatch[1]) {
    mutations.push({
      action: "add_subtopic",
      newTitle: addMatch[1].trim(),
    });
  }

  return mutations;
}

/**
 * Normalizes a visual payload from the LLM or constructs a high-clarity visual fallback for the subtopic.
 */
function normalizeVisualPayload(
  rawVisual: unknown,
  subtopicTitle: string,
  moduleTitle: string
): StudyVisualPayload {
  if (rawVisual && typeof rawVisual === "object") {
    const v = rawVisual as Record<string, unknown>;
    const type = v.type as string;
    const title =
      typeof v.title === "string" && v.title.trim()
        ? v.title.trim()
        : `Visual Concept Map: ${subtopicTitle}`;
    const caption = typeof v.caption === "string" ? v.caption.trim() : undefined;

    if (
      type === "mermaid" &&
      typeof v.mermaidCode === "string" &&
      v.mermaidCode.trim().length > 10
    ) {
      let cleanMermaid = v.mermaidCode
        .trim()
        .replace(/^```(?:mermaid)?\s*/i, "")
        .replace(/```$/i, "")
        .trim();
      return {
        type: "mermaid",
        title,
        caption,
        mermaidCode: cleanMermaid,
      };
    }

    if (
      type === "svg" &&
      typeof v.svgCode === "string" &&
      v.svgCode.includes("<svg") &&
      v.svgCode.includes("</svg>")
    ) {
      return {
        type: "svg",
        title,
        caption,
        svgCode: v.svgCode.trim(),
      };
    }

    if (
      type === "comparison_table" &&
      Array.isArray(v.tableHeaders) &&
      Array.isArray(v.tableRows) &&
      v.tableRows.length > 0
    ) {
      return {
        type: "comparison_table",
        title,
        caption,
        tableHeaders: v.tableHeaders.map((h) => String(h)),
        tableRows: v.tableRows.map((row) =>
          Array.isArray(row) ? row.map((cell) => String(cell)) : [String(row)]
        ),
      };
    }

    if (type === "visual_cards" && Array.isArray(v.cards) && v.cards.length > 0) {
      return {
        type: "visual_cards",
        title,
        caption,
        cards: v.cards.map((c: Record<string, unknown>) => ({
          title: String(c.title || "Concept"),
          badge: c.badge ? String(c.badge) : undefined,
          points: Array.isArray(c.points)
            ? c.points.map((p) => String(p))
            : [],
          highlight: c.highlight ? String(c.highlight) : undefined,
        })),
      };
    }
  }

  // Default fallback Mermaid diagram illustrating the conceptual progression of the subtopic
  const safeMod = moduleTitle.replace(/["[\]()]/g, "");
  const safeSub = subtopicTitle.replace(/["[\]()]/g, "");
  return {
    type: "mermaid",
    title: `Conceptual Architecture: ${subtopicTitle}`,
    caption: `Logical flow within ${moduleTitle}`,
    mermaidCode: `flowchart LR
  A["${safeMod}"] --> B["Core Principle: ${safeSub}"]
  B --> C["Mechanism & Analysis"]
  C --> D["Applied Mastery"]`,
  };
}

/**
 * Normalizes a checkpoint payload from the LLM or builds a fallback comprehension check.
 */
function normalizeCheckpoint(
  rawCheckpoint: unknown,
  subtopic: StudySubtopic
): StudyCheckpoint {
  if (rawCheckpoint && typeof rawCheckpoint === "object") {
    const cp = rawCheckpoint as Record<string, unknown>;
    const qType =
      cp.questionType === "short_answer" ? "short_answer" : "mcq";
    const question =
      typeof cp.question === "string" && cp.question.trim()
        ? cp.question.trim()
        : `Which statement best captures the primary concept of ${subtopic.title}?`;

    if (qType === "mcq" && Array.isArray(cp.options) && cp.options.length >= 2) {
      const labels = ["A", "B", "C", "D"];
      let hasCorrect = false;
      const options = cp.options.slice(0, 4).map((opt: unknown, idx: number) => {
        const o = (opt && typeof opt === "object" ? opt : {}) as Record<
          string,
          unknown
        >;
        const isCorrect = Boolean(o.isCorrect);
        if (isCorrect) hasCorrect = true;
        return {
          id: makeId(`opt-${idx}`),
          label: labels[idx] || String(idx + 1),
          text: String(o.text || `Option ${labels[idx]}`),
          isCorrect,
          explanation: String(
            o.explanation ||
              (isCorrect
                ? `Correct! This accurately reflects the core mechanism of ${subtopic.title}.`
                : `Not quite—review how ${subtopic.title} operates in the lesson above.`)
          ),
        };
      });

      if (!hasCorrect && options.length > 0) {
        options[0].isCorrect = true;
      }

      return {
        id: makeId("chk"),
        subtopicId: subtopic.id,
        questionType: "mcq",
        question,
        hint: typeof cp.hint === "string" ? cp.hint : undefined,
        options,
      };
    }

    if (qType === "short_answer") {
      return {
        id: makeId("chk"),
        subtopicId: subtopic.id,
        questionType: "short_answer",
        question,
        hint:
          typeof cp.hint === "string"
            ? cp.hint
            : `Summarize the key mechanism or definition of ${subtopic.title} in 1-2 sentences.`,
        expectedKeyConcepts: Array.isArray(cp.expectedKeyConcepts)
          ? cp.expectedKeyConcepts.map((k) => String(k))
          : [subtopic.title],
        sampleAnswer:
          typeof cp.sampleAnswer === "string" ? cp.sampleAnswer : undefined,
      };
    }
  }

  return {
    id: makeId("chk"),
    subtopicId: subtopic.id,
    questionType: "mcq",
    question: `Based on this micro-lesson on "${subtopic.title}", which of the following best describes its core principle and role?`,
    hint: `Focus on the primary definition and structural relationship covered above.`,
    options: [
      {
        id: makeId("opt-0"),
        label: "A",
        text: `It establishes the foundational mechanism and governing rules for ${subtopic.title}, enabling systematic analysis.`,
        isCorrect: true,
        explanation: `Correct! Understanding the governing mechanism of ${subtopic.title} is essential before applying it to complex scenarios.`,
      },
      {
        id: makeId("opt-1"),
        label: "B",
        text: `It operates independently of foundational constraints and only applies to isolated exceptions.`,
        isCorrect: false,
        explanation: `Incorrect. ${subtopic.title} directly builds upon core rules rather than isolated exceptions.`,
      },
      {
        id: makeId("opt-2"),
        label: "C",
        text: `It eliminates the need to analyze underlying variables or structural relationships.`,
        isCorrect: false,
        explanation: `Incorrect. Analyzing the relationship between variables is central to ${subtopic.title}.`,
      },
      {
        id: makeId("opt-3"),
        label: "D",
        text: `It reverses the causal direction of the primary system without affecting outcomes.`,
        isCorrect: false,
        explanation: `Incorrect. Reversing the causal relationship fundamentally changes the outcome.`,
      },
    ],
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mode: "generate_syllabus" | "tutor_turn" =
      body.mode === "generate_syllabus" ? "generate_syllabus" : "tutor_turn";

    const customApiKey: string = (body.customApiKey || "").trim();
    const rawExplicitProvider: string | undefined =
      body.aiProvider || body.workspaceConfig?.aiProvider;
    const requestedNvidiaModel: string = (
      body.nvidiaModel ||
      body.workspaceConfig?.nvidiaModel ||
      DEFAULT_NVIDIA_MODEL
    ).trim();
    const tone: AITone = body.tone || "locked_in";

    const isNvKey = (k?: string | null): boolean =>
      Boolean(k && k.trim().startsWith("nvapi-") && k.trim().length >= 15);
    const isGemKey = (k?: string | null): boolean =>
      Boolean(k && k.trim().startsWith("AIza") && k.trim().length >= 15);

    const nvidiaKey: string =
      (isNvKey(customApiKey) ? customApiKey : "") ||
      (isNvKey(body.workspaceConfig?.nvidiaApiKey)
        ? body.workspaceConfig.nvidiaApiKey
        : "") ||
      (isNvKey(process.env.NVIDIA_API_KEY) ? process.env.NVIDIA_API_KEY : "") ||
      "";

    const geminiKey: string =
      (isGemKey(customApiKey) ? customApiKey : "") ||
      (isGemKey(body.workspaceConfig?.geminiApiKey)
        ? body.workspaceConfig.geminiApiKey
        : "") ||
      (isGemKey(process.env.GOOGLE_GENERATIVE_AI_API_KEY)
        ? process.env.GOOGLE_GENERATIVE_AI_API_KEY
        : "") ||
      "";

    const detectedProvider: AIProvider =
      rawExplicitProvider === "gemini"
        ? "gemini"
        : rawExplicitProvider === "nvidia"
        ? "nvidia"
        : isGemKey(customApiKey)
        ? "gemini"
        : isNvKey(customApiKey)
        ? "nvidia"
        : nvidiaKey
        ? "nvidia"
        : geminiKey
        ? "gemini"
        : "nvidia";

    // Unified helper to call the configured LLM pipeline (NVIDIA NIM or Google Gemini with automatic failover)
    const runModelPrompt = async (
      systemPrompt: string,
      userPrompt: string,
      maxTokens = 3000
    ): Promise<{ text: string; modelUsed: string } | null> => {
      const tryNvidia = async (key: string): Promise<{ text: string; modelUsed: string } | null> => {
        if (!key || key.length < 15) return null;
        const nvidia = createOpenAI({
          baseURL: "https://integrate.api.nvidia.com/v1",
          apiKey: key,
          compatibility: "compatible",
        });
        const primary = requestedNvidiaModel || DEFAULT_NVIDIA_MODEL;
        const backup =
          primary !== "nvidia/nemotron-3.5-lightning-30b-a3b"
            ? "nvidia/nemotron-3.5-lightning-30b-a3b"
            : "deepseek-ai/deepseek-v4.1-flash";

        for (const candidate of [primary, backup]) {
          try {
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Timeout on ${candidate}`)), 50000)
            );
            const res = await Promise.race([
              generateText({
                model: nvidia(candidate),
                system: systemPrompt,
                prompt: userPrompt,
                maxTokens,
              }),
              timeoutPromise,
            ]);
            if (res.text && res.text.trim()) {
              return { text: res.text.trim(), modelUsed: candidate };
            }
          } catch (err) {
            console.warn(`[flo study NVIDIA] Model ${candidate} failed:`, err);
          }
        }
        return null;
      };

      const tryGemini = async (key: string): Promise<{ text: string; modelUsed: string } | null> => {
        if (!key || key.length < 15) return null;
        const google = createGoogleGenerativeAI({ apiKey: key });
        for (const candidate of ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"]) {
          try {
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Timeout on ${candidate}`)), 45000)
            );
            const res = await Promise.race([
              generateText({
                model: google(candidate),
                system: systemPrompt,
                prompt: userPrompt,
                maxTokens,
              }),
              timeoutPromise,
            ]);
            if (res.text && res.text.trim()) {
              return { text: res.text.trim(), modelUsed: candidate };
            }
          } catch (err) {
            console.warn(`[flo study Gemini] Model ${candidate} failed:`, err);
          }
        }
        return null;
      };

      if (detectedProvider === "nvidia") {
        const nvRes = await tryNvidia(nvidiaKey);
        if (nvRes) return nvRes;
        if (geminiKey.length >= 15) {
          return await tryGemini(geminiKey);
        }
      } else {
        const gemRes = await tryGemini(geminiKey);
        if (gemRes) return gemRes;
        if (nvidiaKey.length >= 15) {
          return await tryNvidia(nvidiaKey);
        }
      }
      return null;
    };

    // =========================================================================
    // MODE 1: Structured Syllabus Generation
    // =========================================================================
    if (mode === "generate_syllabus") {
      const topicInput: string = (body.topicInput || "").trim();
      if (!topicInput) {
        return NextResponse.json(
          { error: "Please enter at least one study topic or syllabus focus area." },
          { status: 400 }
        );
      }

      const syllabusPrompt = `Break the following user study topic(s), syllabus notes, or exam focus areas into an ordered, hyper-organized JSON curriculum:

USER INPUT TOPICS:
"""
${topicInput}
"""

REQUIREMENTS:
1. Ensure 100% coverage of EVERY topic the user entered.
2. Group into logical "modules" (Major Topics, typically 2 to 5 modules depending on breadth).
3. Break each module into 2 to 4 bite-sized "subtopics" (Micro-Lessons) ordered logically from foundational concepts to advanced applications.
4. Return ONLY a valid JSON object matching this exact schema (no markdown text outside the JSON):
{
  "title": "Clear overarching curriculum title",
  "overview": "1-2 sentence motivating overview of what the student will master",
  "modules": [
    {
      "title": "Module 1: [Major Topic Title]",
      "description": "Concise 1-sentence summary of this module",
      "subtopics": [
        {
          "title": "[Specific Bite-Sized Micro-Lesson Title]",
          "description": "1-sentence description of the exact concept covered",
          "estimatedMinutes": 8
        }
      ]
    }
  ]
}`;

      const llmRes = await runModelPrompt(
        TUTOR_SYSTEM_PROMPT,
        syllabusPrompt,
        2800
      );

      if (llmRes) {
        const parsed = extractJsonObject<{
          title?: string;
          overview?: string;
          modules?: Array<{
            title?: string;
            description?: string;
            subtopics?: Array<{
              title?: string;
              description?: string;
              estimatedMinutes?: number;
            }>;
          }>;
        }>(llmRes.text);

        if (parsed && Array.isArray(parsed.modules) && parsed.modules.length > 0) {
          const nowISO = new Date().toISOString();
          const builtModules: StudyModule[] = parsed.modules
            .map((m, mIdx) => {
              const rawSubs = Array.isArray(m.subtopics) ? m.subtopics : [];
              const subtopics: StudySubtopic[] = rawSubs
                .filter((s) => s && typeof s.title === "string" && s.title.trim())
                .map((s, sIdx) => ({
                  id: makeId(`sub-${mIdx + 1}-${sIdx + 1}`),
                  title: String(s.title).trim(),
                  description:
                    typeof s.description === "string"
                      ? s.description.trim()
                      : undefined,
                  estimatedMinutes:
                    typeof s.estimatedMinutes === "number" &&
                    s.estimatedMinutes > 0
                      ? s.estimatedMinutes
                      : 8,
                  state: "locked",
                }));

              return {
                id: makeId(`mod-${mIdx + 1}`),
                title:
                  typeof m.title === "string" && m.title.trim()
                    ? m.title.trim()
                    : `Module ${mIdx + 1}`,
                description:
                  typeof m.description === "string"
                    ? m.description.trim()
                    : undefined,
                subtopics,
              };
            })
            .filter((m) => m.subtopics.length > 0);

          if (builtModules.length > 0) {
            const syllabus = normalizeSyllabusStates({
              id: makeId("syl"),
              topicQuery: topicInput,
              title:
                typeof parsed.title === "string" && parsed.title.trim()
                  ? parsed.title.trim()
                  : `Study Curriculum: ${topicInput.slice(0, 60)}`,
              overview:
                typeof parsed.overview === "string" && parsed.overview.trim()
                  ? parsed.overview.trim()
                  : `Interactive micro-lesson curriculum covering ${topicInput}.`,
              modules: builtModules,
              createdAt: nowISO,
              updatedAt: nowISO,
            });

            return NextResponse.json({
              syllabus,
              modelUsed: llmRes.modelUsed,
            });
          }
        }
      }

      // Deterministic fallback if API key is missing or LLM output failed parsing
      const fallbackSyllabus = buildDeterministicSyllabus(topicInput);
      return NextResponse.json({
        syllabus: fallbackSyllabus,
        modelUsed: "flo-study-structured-engine",
      });
    }

    // =========================================================================
    // MODE 2: Interactive Bite-Sized Teaching, Checkpoint Evaluation & Remediation
    // =========================================================================
    const rawSyllabus = body.syllabus as StudySyllabus | undefined;
    if (!rawSyllabus || !Array.isArray(rawSyllabus.modules)) {
      return NextResponse.json(
        { error: "Missing active syllabus in request." },
        { status: 400 }
      );
    }

    let workingSyllabus = normalizeSyllabusStates(rawSyllabus, body.targetSubtopicId);
    let progress = computeSyllabusProgress(workingSyllabus);

    const actionType:
      | "start_or_continue"
      | "answer_checkpoint"
      | "chat_message"
      | "remediate" = body.actionType || "start_or_continue";
    const userMessage: string = (body.userMessage || "").trim();
    const checkpointSubmission = body.checkpointSubmission as
      | {
          checkpointId: string;
          subtopicId: string;
          questionType: "mcq" | "short_answer";
          question: string;
          selectedOptionId?: string;
          selectedOptionText?: string;
          isMcqCorrect?: boolean;
          shortAnswerText?: string;
        }
      | undefined;

    const allAppliedMutations: string[] = [];

    // 1. Pre-check natural language overrides if user sent a chat message
    if (actionType === "chat_message" && userMessage) {
      const nlMutations = detectNaturalLanguageSyllabusMutations(
        userMessage,
        workingSyllabus,
        progress.activeSubtopic
      );
      if (nlMutations.length > 0) {
        const res = applyMutationsToSyllabus(
          workingSyllabus,
          nlMutations,
          progress.activeSubtopic?.id
        );
        workingSyllabus = res.updatedSyllabus;
        allAppliedMutations.push(...res.appliedSummaries);
        progress = computeSyllabusProgress(workingSyllabus);
      }
    }

    // 2. If all active subtopics are now mastered or skipped_known, return 100% completion turn
    if (progress.isComplete || !progress.activeSubtopic) {
      return NextResponse.json({
        syllabus: workingSyllabus,
        syllabusMutationsApplied: allAppliedMutations,
        turn: {
          id: makeId("turn"),
          role: "assistant",
          timestamp: new Date().toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          }),
          subtopicId: null,
          subtopicTitle: "Curriculum Complete",
          moduleTitle: workingSyllabus.title,
          content: `### 🎉 100% Active Curriculum Completed!\n\nYou have completed every active micro-lesson in **${workingSyllabus.title}** (${progress.masteredCount} mastered, ${progress.skippedKnownCount} marked already known).\n\n* **Want to go deeper?** Use the **Master Syllabus** sidebar to add new subtopics or modules at any time, or click any subtopic to review it.`,
          keyTakeaways: [
            `Completed ${progress.completedCount}/${progress.totalActive} active subtopics (100%).`,
            "You can add new custom subtopics in the sidebar to continue learning.",
          ],
          visual: null,
          checkpoint: null,
          syllabusMutationsApplied: allAppliedMutations,
        },
      });
    }

    const currentSubtopic = progress.activeSubtopic;
    const currentModule = progress.activeModule;

    // Serialize the live syllabus so the AI Tutor always treats it as the single source of truth
    const serializedSyllabus = JSON.stringify(
      {
        title: workingSyllabus.title,
        progressPercentage: `${progress.percentage}% (${progress.completedCount}/${progress.totalActive})`,
        currentActiveSubtopic: {
          id: currentSubtopic.id,
          title: currentSubtopic.title,
          moduleTitle: currentModule?.title || "",
        },
        modules: workingSyllabus.modules.map((m) => ({
          id: m.id,
          title: m.title,
          subtopics: m.subtopics.map((s) => ({
            id: s.id,
            title: s.title,
            state: s.state,
          })),
        })),
      },
      null,
      2
    );

    const toneNote =
      tone === "killer_bee"
        ? "Flavor note: Add subtle Killer Bee rhyming swagger at the start/end while keeping all definitions, math, visuals, and checkpoints 100% rigorous and crystal clear."
        : tone === "naruto"
        ? "Flavor note: Bring encouraging Naruto energy ('Believe it!') while keeping all academic explanations, formulas, and checkpoints 100% rigorous and clear."
        : "";

    // Build specific instruction based on actionType
    let turnDirective = "";
    if (
      actionType === "answer_checkpoint" &&
      checkpointSubmission &&
      checkpointSubmission.questionType === "short_answer"
    ) {
      turnDirective = `The student just submitted a Short-Answer / Active Recall response for subtopic "${currentSubtopic.title}" (ID: "${currentSubtopic.id}").
Question asked: "${checkpointSubmission.question}"
Student's answer: "${checkpointSubmission.shortAnswerText || userMessage}"

TASK:
1. Evaluate the student's answer for conceptual accuracy ("evaluation": { "passed": true/false, "feedback": "..." }). Be fair: if they captured the core intuition or mechanism in their own words, set "passed": true. If their answer is wrong, vague, or says "I don't know", set "passed": false.
2. IF "passed" is FALSE:
   - Do NOT advance to the next subtopic! Keep teaching "${currentSubtopic.title}".
   - Set "isRemediation": true.
   - In "lessonMarkdown", clarify the misconception simply using a fresh analogy or step-by-step breakdown.
   - Provide a helpful "visual" and a new follow-up "checkpoint" (MCQ or short_answer) testing "${currentSubtopic.title}".
3. IF "passed" is TRUE:
   - Praise their accurate explanation in "evaluation.feedback"!
   - Mark "${currentSubtopic.title}" as mastered (we will advance to the next subtopic automatically if you set "evaluation.passed": true).
   - Look at the LIVE SYLLABUS JSON: find the NEXT subtopic after "${currentSubtopic.title}" whose state is "locked".
   - If a next "locked" subtopic exists, teach THAT NEXT subtopic right now in "lessonMarkdown", "keyTakeaways", "visual", and "checkpoint" (and set "taughtSubtopicId" to that next subtopic's ID and "taughtSubtopicTitle" to its title)!
   - If NO "locked" subtopics remain after "${currentSubtopic.title}", congratulate them on completing 100% of the syllabus!`;
    } else if (
      actionType === "remediate" ||
      (actionType === "answer_checkpoint" &&
        checkpointSubmission &&
        checkpointSubmission.isMcqCorrect === false)
    ) {
      const wrongChoice =
        checkpointSubmission?.selectedOptionText || userMessage || "an incorrect option";
      turnDirective = `The student answered the comprehension check for subtopic "${currentSubtopic.title}" (ID: "${currentSubtopic.id}") INCORRECTLY.
Question: "${checkpointSubmission?.question || ""}"
Student selected/wrote: "${wrongChoice}"

ADAPTIVE REMEDIATION MANDATE:
1. Do NOT advance to the next subtopic! You MUST stay on "${currentSubtopic.title}" (ID: "${currentSubtopic.id}").
2. Set "isRemediation": true.
3. In "lessonMarkdown", gently explain why "${wrongChoice}" is a misconception, then re-explain "${currentSubtopic.title}" from a simpler angle or concrete real-world analogy.
4. Include a clear "visual" (mermaid, svg, comparison_table, or visual_cards) that highlights the exact distinction they missed.
5. End with a fresh follow-up "checkpoint" question testing "${currentSubtopic.title}" to verify mastery.`;
    } else if (actionType === "chat_message" && userMessage) {
      turnDirective = `The student sent the following message in the Study Mode stream:
"${userMessage}"
${
  allAppliedMutations.length > 0
    ? `\nNOTE: The system already applied these syllabus updates requested by the user: ${allAppliedMutations.join("; ")}. The current active "in_progress" subtopic is now "${currentSubtopic.title}" (ID: "${currentSubtopic.id}") in "${currentModule?.title || ""}".`
    : ""
}

TASK:
1. If the user is asking to skip, remove, rename, or add any other topic in the syllabus that wasn't already mutated above, include it in "syllabusMutations" and teach the resulting active subtopic.
2. If the user is asking a clarifying question or expressing confusion about "${currentSubtopic.title}", answer their question clearly, stay on "${currentSubtopic.title}", include a helpful visual, and provide a targeted "checkpoint" question for "${currentSubtopic.title}".
3. Otherwise, teach the current active subtopic "${currentSubtopic.title}" (ID: "${currentSubtopic.id}") concisely with a visual and mandatory comprehension checkpoint.`;
    } else {
      turnDirective = `Teach ONLY the current active "in_progress" subtopic:
Subtopic Title: "${currentSubtopic.title}" (ID: "${currentSubtopic.id}")
Module: "${currentModule?.title || ""}"
Description: "${currentSubtopic.description || ""}"

TASK:
1. Deliver a crisp, high-precision micro-lesson for "${currentSubtopic.title}" ONLY (2-4 short paragraphs or structured bullet sections, bold key terms, and LaTeX $...$ or $$...$$ if math/science formulas apply).
2. Include 2-4 crisp "keyTakeaways".
3. Include a rich "visual" payload ("mermaid", "svg", "comparison_table", or "visual_cards") that makes "${currentSubtopic.title}" immediately intuitive.
4. End with 1 mandatory interactive "checkpoint" ("mcq" with 4 options & targeted explanations OR "short_answer" active recall prompt) testing "${currentSubtopic.title}".`;
    }

    const userPrompt = `LIVE SYLLABUS JSON (Single Source of Truth):
${serializedSyllabus}

${toneNote}

CURRENT INSTRUCTION:
${turnDirective}

Return ONLY a valid JSON object matching this exact schema (no markdown fences outside JSON):
{
  "taughtSubtopicId": "${currentSubtopic.id}",
  "taughtSubtopicTitle": "${currentSubtopic.title}",
  "isRemediation": false,
  "evaluation": null,
  "syllabusMutations": [],
  "lessonMarkdown": "Clear, bite-sized markdown explanation of the single active subtopic (use **bold**, bullet points, and LaTeX $...$ where helpful)",
  "keyTakeaways": [
    "Key takeaway 1",
    "Key takeaway 2"
  ],
  "visual": {
    "type": "mermaid | svg | comparison_table | visual_cards",
    "title": "Visual title",
    "caption": "Brief explanation of what the diagram/table shows",
    "mermaidCode": "flowchart LR\\n  A[\\"Concept A\\"] --> B[\\"Concept B\\"]",
    "svgCode": "<svg viewBox=\\"0 0 500 260\\" xmlns=\\"http://www.w3.org/2000/svg\\">...</svg>",
    "tableHeaders": ["Column 1", "Column 2", "Column 3"],
    "tableRows": [["Row 1A", "Row 1B", "Row 1C"]],
    "cards": [
      { "title": "Card Title", "badge": "Category", "points": ["Point 1", "Point 2"], "highlight": "Key takeaway" }
    ]
  },
  "checkpoint": {
    "questionType": "mcq | short_answer",
    "question": "Targeted comprehension question testing the exact concept just taught",
    "hint": "Optional brief hint",
    "options": [
      {
        "label": "A",
        "text": "Option A text",
        "isCorrect": true,
        "explanation": "Targeted explanation of why Option A is right or wrong"
      },
      {
        "label": "B",
        "text": "Option B text",
        "isCorrect": false,
        "explanation": "Targeted explanation of why Option B is right or wrong"
      },
      {
        "label": "C",
        "text": "Option C text",
        "isCorrect": false,
        "explanation": "Targeted explanation of why Option C is right or wrong"
      },
      {
        "label": "D",
        "text": "Option D text",
        "isCorrect": false,
        "explanation": "Targeted explanation of why Option D is right or wrong"
      }
    ],
    "expectedKeyConcepts": ["concept 1", "concept 2"],
    "sampleAnswer": "Ideal short answer explanation"
  }
}`;

    const llmRes = await runModelPrompt(TUTOR_SYSTEM_PROMPT, userPrompt, 3500);

    if (llmRes) {
      const parsed = extractJsonObject<{
        taughtSubtopicId?: string;
        taughtSubtopicTitle?: string;
        isRemediation?: boolean;
        evaluation?: { passed?: boolean; feedback?: string } | null;
        syllabusMutations?: StudySyllabusMutation[];
        lessonMarkdown?: string;
        keyTakeaways?: string[];
        visual?: unknown;
        checkpoint?: unknown;
      }>(llmRes.text);

      if (parsed && typeof parsed.lessonMarkdown === "string" && parsed.lessonMarkdown.trim()) {
        // 1. Apply any AI-emitted syllabusMutations
        if (Array.isArray(parsed.syllabusMutations) && parsed.syllabusMutations.length > 0) {
          const mutRes = applyMutationsToSyllabus(
            workingSyllabus,
            parsed.syllabusMutations,
            currentSubtopic.id
          );
          workingSyllabus = mutRes.updatedSyllabus;
          allAppliedMutations.push(...mutRes.appliedSummaries);
          progress = computeSyllabusProgress(workingSyllabus);
        }

        // 2. If this was a Short-Answer evaluation and `evaluation.passed === true`, mark currentSubtopic as mastered!
        let evaluationResult: { passed: boolean; feedback: string } | null = null;
        if (parsed.evaluation && typeof parsed.evaluation === "object") {
          const passed = Boolean(parsed.evaluation.passed);
          const feedback = String(
            parsed.evaluation.feedback ||
              (passed
                ? "Spot on! You captured the core concept accurately."
                : "Let's refine that idea before moving forward.")
          );
          evaluationResult = { passed, feedback };

          if (passed && actionType === "answer_checkpoint") {
            const masterRes = applyMutationsToSyllabus(
              workingSyllabus,
              [{ action: "mark_mastered", targetId: currentSubtopic.id }],
              currentSubtopic.id
            );
            workingSyllabus = masterRes.updatedSyllabus;
            allAppliedMutations.push(...masterRes.appliedSummaries);
            progress = computeSyllabusProgress(workingSyllabus);
          }
        }

        const effectiveSubtopic = progress.activeSubtopic || currentSubtopic;
        const effectiveModule = progress.activeModule || currentModule;

        // If 100% complete after mastering the final subtopic
        if (progress.isComplete) {
          return NextResponse.json({
            syllabus: workingSyllabus,
            syllabusMutationsApplied: allAppliedMutations,
            turn: {
              id: makeId("turn"),
              role: "assistant",
              timestamp: new Date().toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              }),
              subtopicId: currentSubtopic.id,
              subtopicTitle: currentSubtopic.title,
              moduleTitle: currentModule?.title || workingSyllabus.title,
              content: `${
                evaluationResult?.feedback
                  ? `✅ **${evaluationResult.feedback}**\n\n---\n\n`
                  : ""
              }### 🎉 100% Active Curriculum Mastered!\n\nCongratulations! You have completed every active subtopic in **${
                workingSyllabus.title
              }** (${progress.masteredCount} mastered, ${
                progress.skippedKnownCount
              } marked as already known).\n\n${parsed.lessonMarkdown.trim()}`,
              keyTakeaways: Array.isArray(parsed.keyTakeaways)
                ? parsed.keyTakeaways.map((k) => String(k))
                : [
                    `Completed 100% (${progress.completedCount}/${progress.totalActive}) of the active syllabus!`,
                  ],
              visual: null,
              checkpoint: null,
              syllabusMutationsApplied: allAppliedMutations,
              evaluationResult,
              modelUsed: llmRes.modelUsed,
            },
          });
        }

        const visual = normalizeVisualPayload(
          parsed.visual,
          effectiveSubtopic.title,
          effectiveModule?.title || workingSyllabus.title
        );
        const checkpoint = normalizeCheckpoint(
          parsed.checkpoint,
          effectiveSubtopic
        );

        return NextResponse.json({
          syllabus: workingSyllabus,
          syllabusMutationsApplied: allAppliedMutations,
          turn: {
            id: makeId("turn"),
            role: "assistant",
            timestamp: new Date().toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            }),
            subtopicId: effectiveSubtopic.id,
            subtopicTitle: effectiveSubtopic.title,
            moduleTitle: effectiveModule?.title || workingSyllabus.title,
            content: parsed.lessonMarkdown.trim(),
            keyTakeaways: Array.isArray(parsed.keyTakeaways)
              ? parsed.keyTakeaways.map((k) => String(k)).slice(0, 5)
              : [],
            visual,
            checkpoint,
            syllabusMutationsApplied: allAppliedMutations,
            isRemediation: Boolean(parsed.isRemediation || actionType === "remediate"),
            evaluationResult,
            modelUsed: llmRes.modelUsed,
          },
        });
      }
    }

    // =========================================================================
    // Deterministic High-Clarity Fallback Turn (if offline / API timeout)
    // =========================================================================
    let fallbackEvaluation: { passed: boolean; feedback: string } | null = null;
    if (
      actionType === "answer_checkpoint" &&
      checkpointSubmission?.questionType === "short_answer"
    ) {
      const answerLen = (checkpointSubmission.shortAnswerText || userMessage).trim().length;
      const passed = answerLen >= 12;
      fallbackEvaluation = {
        passed,
        feedback: passed
          ? `Great explanation of ${currentSubtopic.title}! Advancing to the next micro-lesson.`
          : `Your response is a bit too brief—try explaining the core mechanism of ${currentSubtopic.title} in a full sentence.`,
      };
      if (passed) {
        const masterRes = applyMutationsToSyllabus(
          workingSyllabus,
          [{ action: "mark_mastered", targetId: currentSubtopic.id }],
          currentSubtopic.id
        );
        workingSyllabus = masterRes.updatedSyllabus;
        allAppliedMutations.push(...masterRes.appliedSummaries);
        progress = computeSyllabusProgress(workingSyllabus);
      }
    }

    const activeSub = progress.activeSubtopic || currentSubtopic;
    const activeMod = progress.activeModule || currentModule;
    const isRem =
      actionType === "remediate" ||
      (fallbackEvaluation !== null && !fallbackEvaluation.passed);

    const fallbackContent = isRem
      ? `### 🔄 Let's Look at **${activeSub.title}** from a Simpler Angle\n\nThink of **${activeSub.title}** inside **${activeMod?.title || "this module"}** as a cause-and-effect bridge:\n\n* **Core Intuition:** Rather than memorizing isolated details, focus on how the primary input condition directly governs the output behavior.\n* **Why It Matters:** ${activeSub.description || `Understanding ${activeSub.title} prevents common analytical errors in downstream applications.`}\n* **Step-by-Step Check:** Identify the baseline state first, apply the governing rule of **${activeSub.title}**, and verify that the result satisfies the system's constraints.`
      : `### 📘 Micro-Lesson: **${activeSub.title}**\n\n${
          activeSub.description
            ? `*${activeSub.description}*\n\n`
            : ""
        }Let's break **${activeSub.title}** down into bite-sized building blocks:\n\n* **1. Foundational Definition:** **${activeSub.title}** defines the core structural and analytical principles within **${activeMod?.title || workingSyllabus.title}**.\n* **2. Governing Mechanism:** When analyzing a problem involving **${activeSub.title}**, we track how primary variables interact under well-defined constraints.\n* **3. Practical Application:** Mastering this step prepares you to connect foundational theory directly to real problem-solving scenarios.`;

    return NextResponse.json({
      syllabus: workingSyllabus,
      syllabusMutationsApplied: allAppliedMutations,
      turn: {
        id: makeId("turn"),
        role: "assistant",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        }),
        subtopicId: activeSub.id,
        subtopicTitle: activeSub.title,
        moduleTitle: activeMod?.title || workingSyllabus.title,
        content: fallbackContent,
        keyTakeaways: [
          `Identify the core definition and scope of ${activeSub.title}.`,
          `Connect input conditions to output behavior systematically.`,
        ],
        visual: normalizeVisualPayload(
          null,
          activeSub.title,
          activeMod?.title || workingSyllabus.title
        ),
        checkpoint: normalizeCheckpoint(null, activeSub),
        syllabusMutationsApplied: allAppliedMutations,
        isRemediation: isRem,
        evaluationResult: fallbackEvaluation,
        modelUsed: "flo-study-tutor",
      },
    });
  } catch (error: unknown) {
    console.error("[/api/study] Error:", error);
    return NextResponse.json(
      {
        error: "STUDY_ENGINE_ERROR",
        message:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred in Study Mode.",
      },
      { status: 500 }
    );
  }
}
