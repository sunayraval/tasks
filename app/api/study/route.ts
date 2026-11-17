import { NextResponse } from "next/server";
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
 * Maps any deprecated/legacy model IDs to verified active, high-speed NVIDIA NIM models.
 */
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

/**
 * Repairs unescaped LaTeX backslashes (e.g. \lim, \to, \frac, \theta, \right, \neq, \beta)
 * and unescaped literal newlines inside JSON string values so JSON.parse never fails on math/science output.
 */
function repairJsonWithLatex(jsonCandidate: string): string {
  // 1. Escape common LaTeX commands that start with JSON control escape letters (\t, \f, \b, \r, \n)
  // e.g. \to, \theta, \times, \text, \frac, \forall, \beta, \begin, \binom, \right, \rho, \neq, \nabla, \nu
  let s = jsonCandidate.replace(
    /(?<!\\)\\(to\b|theta\b|times\b|text\b|tan\b|tau\b|triangle\b|frac\b|forall\b|beta\b|begin\b|binom\b|bar\b|mathbf\b|right\b|rho\b|Rightarrow\b|neq\b|nabla\b|nu\b|not\b|natural\b)/g,
    "\\\\$1"
  );

  // 2. Escape any backslash followed by a character that is NOT a valid JSON escape (", \, /, b, f, n, r, t, u)
  s = s.replace(/(?<!\\)\\(?![/\\bfnrtu"])/g, "\\\\");

  // 3. Walk string literals to escape literal control characters (newlines/tabs) inside quotes
  let out = "";
  let inString = false;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '"' && (i === 0 || s[i - 1] !== "\\")) {
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

  // 4. Remove trailing commas before } or ]
  return out.replace(/,\s*([}\]])/g, "$1");
}

/**
 * Strips <think>...</think> reasoning blocks and markdown code fences to extract a clean JSON object,
 * safely preserving LaTeX formulas and multi-line strings.
 */
function extractJsonObject<T = Record<string, unknown>>(rawText: string): T | null {
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
      const repaired = repairJsonWithLatex(candidate);
      return JSON.parse(repaired) as T;
    } catch (err) {
      console.warn("[extractJsonObject] Repair parse failed:", err);
      return null;
    }
  }
}

/**
 * Extracts structured tutor sections from either XML-delimited tags (<LESSON>, <TAKEAWAYS>, <VISUAL>, <CHECKPOINT>)
 * OR a JSON object response. This guarantees fast generation and zero LaTeX escaping failures.
 */
function parseStructuredTutorOutput(rawText: string): {
  lessonMarkdown: string;
  keyTakeaways: string[];
  visual: unknown;
  checkpoint: unknown;
  evaluation?: { passed?: boolean; feedback?: string } | null;
  syllabusMutations?: StudySyllabusMutation[];
  isRemediation?: boolean;
} | null {
  if (!rawText || typeof rawText !== "string") return null;
  const cleaned = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Check if response uses <LESSON>...</LESSON> tags
  const lessonMatch = /<LESSON>([\s\S]*?)(?:<\/LESSON>|(?=<TAKEAWAYS>|<VISUAL|<CHECKPOINT>|$))/i.exec(
    cleaned
  );

  if (lessonMatch && lessonMatch[1] && lessonMatch[1].trim().length > 20) {
    const lessonMarkdown = lessonMatch[1].trim();

    // Extract <TAKEAWAYS>
    const takeawaysMatch = /<TAKEAWAYS>([\s\S]*?)(?:<\/TAKEAWAYS>|(?=<VISUAL|<CHECKPOINT>|$))/i.exec(
      cleaned
    );
    const keyTakeaways: string[] = [];
    if (takeawaysMatch && takeawaysMatch[1]) {
      for (const line of takeawaysMatch[1].split("\n")) {
        const t = line.replace(/^[-*•\d.)\s]+/, "").trim();
        if (t.length > 3) keyTakeaways.push(t);
      }
    }

    // Extract <VISUAL ...>...</VISUAL>
    let visual: unknown = null;
    const visualTagMatch =
      /<VISUAL([^>]*)>([\s\S]*?)(?:<\/VISUAL>|(?=<CHECKPOINT>|$))/i.exec(cleaned);
    if (visualTagMatch) {
      const attrs = visualTagMatch[1] || "";
      const body = (visualTagMatch[2] || "").trim();
      const typeMatch = /type=["']([^"']+)["']/i.exec(attrs);
      const titleMatch = /title=["']([^"']+)["']/i.exec(attrs);
      const captionMatch = /caption=["']([^"']+)["']/i.exec(attrs);
      const vType = (typeMatch?.[1] || "").toLowerCase();

      if (vType === "svg" || body.includes("<svg")) {
        const svgStart = body.indexOf("<svg");
        const svgEnd = body.lastIndexOf("</svg>");
        if (svgStart !== -1 && svgEnd !== -1) {
          visual = {
            type: "svg",
            title: titleMatch?.[1] || "Interactive Concept Diagram",
            caption: captionMatch?.[1],
            svgCode: body.slice(svgStart, svgEnd + 6),
          };
        }
      } else if (vType === "mermaid" || /^(flowchart|graph|sequenceDiagram|stateDiagram)/i.test(body)) {
        visual = {
          type: "mermaid",
          title: titleMatch?.[1] || "Concept Flowchart",
          caption: captionMatch?.[1],
          mermaidCode: body
            .replace(/^```(?:mermaid)?\s*/i, "")
            .replace(/```$/i, "")
            .trim(),
        };
      } else {
        const parsedVisualJson = extractJsonObject(body);
        if (parsedVisualJson) {
          visual = parsedVisualJson;
        }
      }
    }

    // Extract <CHECKPOINT>...</CHECKPOINT>
    let checkpoint: unknown = null;
    const checkpointMatch = /<CHECKPOINT>([\s\S]*?)(?:<\/CHECKPOINT>|$)/i.exec(
      cleaned
    );
    if (checkpointMatch && checkpointMatch[1]) {
      checkpoint = extractJsonObject(checkpointMatch[1]);
    }

    // Extract <EVALUATION>...</EVALUATION>
    let evaluation: { passed?: boolean; feedback?: string } | null = null;
    const evalMatch = /<EVALUATION>([\s\S]*?)<\/EVALUATION>/i.exec(cleaned);
    if (evalMatch && evalMatch[1]) {
      evaluation = extractJsonObject<{ passed?: boolean; feedback?: string }>(
        evalMatch[1]
      );
    }

    // Extract <MUTATIONS>...</MUTATIONS>
    let syllabusMutations: StudySyllabusMutation[] = [];
    const mutMatch = /<MUTATIONS>([\s\S]*?)<\/MUTATIONS>/i.exec(cleaned);
    if (mutMatch && mutMatch[1]) {
      const parsedMut = extractJsonObject<{ mutations?: StudySyllabusMutation[] }>(
        mutMatch[1]
      );
      if (parsedMut && Array.isArray(parsedMut.mutations)) {
        syllabusMutations = parsedMut.mutations;
      }
    }

    return {
      lessonMarkdown,
      keyTakeaways,
      visual,
      checkpoint,
      evaluation,
      syllabusMutations,
    };
  }

  // Fallback: Check if the model returned a full JSON object
  const parsedJson = extractJsonObject<{
    lessonMarkdown?: string;
    keyTakeaways?: string[];
    visual?: unknown;
    checkpoint?: unknown;
    evaluation?: { passed?: boolean; feedback?: string } | null;
    syllabusMutations?: StudySyllabusMutation[];
    isRemediation?: boolean;
  }>(cleaned);

  if (
    parsedJson &&
    typeof parsedJson.lessonMarkdown === "string" &&
    parsedJson.lessonMarkdown.trim().length > 15
  ) {
    return {
      lessonMarkdown: parsedJson.lessonMarkdown.trim(),
      keyTakeaways: Array.isArray(parsedJson.keyTakeaways)
        ? parsedJson.keyTakeaways.map((k) => String(k))
        : [],
      visual: parsedJson.visual,
      checkpoint: parsedJson.checkpoint,
      evaluation: parsedJson.evaluation,
      syllabusMutations: parsedJson.syllabusMutations,
      isRemediation: parsedJson.isRemediation,
    };
  }

  return null;
}

const TUTOR_SYSTEM_PROMPT = `You are the expert AI Tutor powering "flo study" (Study Mode).
Follow these mandatory behavioral and pedagogical rules on every turn:
1. Role & Deep Pedagogical Rigor: You are an elite, crystal-clear tutor (like 3Blue1Brown + Paul's Online Math Notes + Feynman). NEVER output vague meta-commentary like "X defines the core structural principles". Always teach the ACTUAL subject matter with 100% factual precision, exact formulas/equations, concrete definitions, and step-by-step worked examples.
2. Respect User Syllabus Edits: Always treat the live syllabus JSON provided in context as the single source of truth. Never bring back topics the user deleted, and never re-teach subtopics marked "skipped_known" or "mastered".
3. One Step at a Time — With Real Math & Worked Examples:
   Teach ONLY the current active subtopic, structured into three clear parts:
   - **Core Concept & Notation / Formula:** Show the exact mathematical notation, equation, law, or definition (using LaTeX $...$ for inline math and $$...$$ for display equations) and explain what every variable/symbol means intuitively.
   - **Step-by-Step Method (How to Solve It):** Give a numbered 2-3 step recipe for solving problems on this subtopic.
   - **Concrete Worked Example(s):** Walk through at least 1-2 complete, concrete worked examples with real numbers/equations solved step-by-step so the student sees exactly how to do it BEFORE answering the checkpoint question!
4. Always Visualize: Include a clear visual diagram (<VISUAL>) — either a valid Mermaid diagram (flowchart LR / flowchart TD with quoted labels) or a clean inline <svg viewBox="0 0 560 240"> figure (coordinate axes, curves, free-body diagram, or process sketch using bright high-contrast colors like #38bdf8, #34d399, #facc15, #f43f5e, #e2e8f0 on dark backgrounds).
5. Verify Understanding: End every teaching turn with 1 targeted interactive <CHECKPOINT> question (MCQ with 4 options A/B/C/D and step-by-step explanations for why each option is right or wrong, OR short_answer active recall) testing the exact skill just demonstrated in the worked example.
6. Gate Progression: Only mark the current subtopic as "mastered" and introduce the next subtopic once the user answers correctly (or explicitly chooses to mark it as already known). If they miss it, re-explain with a simpler analogy and a new worked example.
7. Zero Omissions: Address every remaining active subtopic in order until 100% of the active syllabus is complete.`;

/**
 * Subject-aware syllabus fallback if API key is missing or offline.
 */
function buildDeterministicSyllabus(topicInput: string): StudySyllabus {
  const rawSegments = topicInput
    .split(/[\n,;•]+/)
    .map((s) => s.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((s) => s.length >= 2);

  const topics =
    rawSegments.length > 0
      ? rawSegments.slice(0, 8)
      : [topicInput.trim() || "Core Topic"];

  const modules: StudyModule[] = topics.map((topic, idx) => {
    const cleanTopic = topic.charAt(0).toUpperCase() + topic.slice(1);
    return {
      id: makeId(`mod-${idx + 1}`),
      title: `Module ${idx + 1}: ${cleanTopic}`,
      description: `Complete mastery of ${cleanTopic} with formal notation, worked examples, and visual models.`,
      subtopics: [
        {
          id: makeId(`sub-${idx + 1}-1`),
          title: `${cleanTopic}: Intuition, Notation & Core Formulas`,
          description: `Formal definitions, notation, and step-by-step worked examples for ${cleanTopic}.`,
          estimatedMinutes: 8,
          state: idx === 0 ? "in_progress" : "locked",
        },
        {
          id: makeId(`sub-${idx + 1}-2`),
          title: `${cleanTopic}: Analytical Techniques & Problem Solving`,
          description: `How to solve standard and multi-step problems involving ${cleanTopic}.`,
          estimatedMinutes: 10,
          state: "locked",
        },
        {
          id: makeId(`sub-${idx + 1}-3`),
          title: `${cleanTopic}: Edge Cases & Exam Applications`,
          description: `Common exam traps, special cases, and synthesis problems for ${cleanTopic}.`,
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
        : `Study Curriculum: ${topics.slice(0, 3).join(", ")}${
            topics.length > 3 ? "..." : ""
          }`,
    overview: `Interactive step-by-step curriculum covering ${topics.join(
      ", "
    )} with worked examples, visual diagrams, and comprehension checkpoints.`,
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
  const workingModules: StudyModule[] = syllabus.modules.map((m) => ({
    ...m,
    subtopics: m.subtopics.map((s) => ({ ...s })),
  }));
  const appliedSummaries: string[] = [];

  const matchSubtopic = (
    targetId?: string,
    targetTitle?: string
  ): { modIdx: number; subIdx: number } | null => {
    if (targetId) {
      for (let m = 0; m < workingModules.length; m++) {
        const sIdx = workingModules[m].subtopics.findIndex(
          (s) => s.id === targetId
        );
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
        (currentActiveSubtopicId
          ? matchSubtopic(currentActiveSubtopicId)
          : null);
      if (loc) {
        const sub = workingModules[loc.modIdx].subtopics[loc.subIdx];
        sub.state = "skipped_known";
        appliedSummaries.push(
          `Marked "${sub.title}" as Already Known (skipped)`
        );
      }
    } else if (mut.action === "mark_mastered") {
      const loc =
        matchSubtopic(mut.targetId, mut.targetTitle) ||
        (currentActiveSubtopicId
          ? matchSubtopic(currentActiveSubtopicId)
          : null);
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
        appliedSummaries.push(
          `Removed subtopic "${removed.title}" from curriculum`
        );
      }
    } else if (mut.action === "remove_module") {
      const q = (mut.targetTitle || "").trim().toLowerCase();
      const modIdx = workingModules.findIndex(
        (m) =>
          m.id === mut.targetId ||
          (q &&
            (m.title.toLowerCase().includes(q) ||
              q.includes(m.title.toLowerCase())))
      );
      if (modIdx !== -1) {
        const removedMod = workingModules[modIdx];
        workingModules.splice(modIdx, 1);
        appliedSummaries.push(`Removed module "${removedMod.title}"`);
      }
    } else if (mut.action === "rename_subtopic" && mut.newTitle?.trim()) {
      const loc =
        matchSubtopic(mut.targetId, mut.targetTitle) ||
        (currentActiveSubtopicId
          ? matchSubtopic(currentActiveSubtopicId)
          : null);
      if (loc) {
        const oldTitle = workingModules[loc.modIdx].subtopics[loc.subIdx].title;
        workingModules[loc.modIdx].subtopics[loc.subIdx].title =
          mut.newTitle.trim();
        appliedSummaries.push(
          `Renamed "${oldTitle}" to "${mut.newTitle.trim()}"`
        );
      }
    } else if (mut.action === "rename_module" && mut.newTitle?.trim()) {
      const q = (mut.targetTitle || "").trim().toLowerCase();
      const modIdx = workingModules.findIndex(
        (m) =>
          m.id === mut.targetId ||
          (q &&
            (m.title.toLowerCase().includes(q) ||
              q.includes(m.title.toLowerCase())))
      );
      if (modIdx !== -1) {
        const oldTitle = workingModules[modIdx].title;
        workingModules[modIdx].title = mut.newTitle.trim();
        appliedSummaries.push(
          `Renamed module "${oldTitle}" to "${mut.newTitle.trim()}"`
        );
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
          description:
            mut.description || `Focused micro-lesson on ${titleToAdd}`,
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
              title: `${modTitle}: Core Concepts & Examples`,
              description: `Key principles and worked examples for ${modTitle}`,
              estimatedMinutes: 10,
              state: "locked",
            },
          ],
        });
        appliedSummaries.push(`Added module "${modTitle}"`);
      }
    }
  }

  const nonEmptyModules = workingModules.filter((m) => m.subtopics.length > 0);
  const finalModules =
    nonEmptyModules.length > 0 ? nonEmptyModules : workingModules;

  const normalized = normalizeSyllabusStates({
    ...syllabus,
    modules: finalModules,
    updatedAt: new Date().toISOString(),
  });

  return { updatedSyllabus: normalized, appliedSummaries };
}

function detectNaturalLanguageSyllabusMutations(
  userMessage: string,
  activeSubtopic: StudySubtopic | null
): StudySyllabusMutation[] {
  const msg = (userMessage || "").trim();
  if (!msg) return [];
  const lower = msg.toLowerCase();
  const mutations: StudySyllabusMutation[] = [];

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

  const removeMatch =
    /(?:remove|delete|drop|exclude|cut)\s+["']?([^"',.!?\n]+?)["']?(?:\s*,\s*|\s+because\s+|\s+since\s+|\s+from\s+the\s+syllabus|\s+i\s+don'?t\s+(?:need|want)|[.!?]|$)/i.exec(
      msg
    ) ||
    /i\s+don'?t\s+(?:need|want)\s+to\s+(?:learn|study|cover)\s+["']?([^"',.!?\n]+?)["']?(?:[.!?]|$)/i.exec(
      msg
    );

  if (removeMatch && removeMatch[1]) {
    const rawTarget = removeMatch[1].trim();
    if (
      /^(this|this\s+topic|this\s+subtopic|this\s+lesson|it)$/i.test(rawTarget)
    ) {
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
        : `Visual Concept Model: ${subtopicTitle}`;
    const caption =
      typeof v.caption === "string" ? v.caption.trim() : undefined;

    if (
      type === "mermaid" &&
      typeof v.mermaidCode === "string" &&
      v.mermaidCode.trim().length > 10
    ) {
      const cleanMermaid = v.mermaidCode
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

  const safeMod = moduleTitle.replace(/["[\]()]/g, "");
  const safeSub = subtopicTitle.replace(/["[\]()]/g, "");
  return {
    type: "mermaid",
    title: `Step-by-Step Problem Solving Flow: ${subtopicTitle}`,
    caption: `Analytical workflow within ${moduleTitle}`,
    mermaidCode: `flowchart LR
  A["1. Identify Given Expression / State (${safeSub})"] --> B["2. Apply Governing Formula & Rules"]
  B --> C["3. Simplify & Check Edge Cases"]
  C --> D["4. Verify Final Solution (${safeMod})"]`,
  };
}

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
        : `Apply what you just learned in "${subtopic.title}": which statement or calculation is correct?`;

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
                ? `Correct! This directly follows from the formula and worked example for ${subtopic.title}.`
                : `Not quite—check the step-by-step method in the worked example above.`)
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
            : `Walk through the key formula or step-by-step reasoning for ${subtopic.title}.`,
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
    questionType: "short_answer",
    question: `In your own words (or using an example), explain the main rule or step-by-step method for "${subtopic.title}".`,
    hint: `Refer to the formula and worked example above and describe how you apply it.`,
    expectedKeyConcepts: [subtopic.title],
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
    const requestedNvidiaModel: string = resolveValidNvidiaModel(
      body.nvidiaModel ||
        body.workspaceConfig?.nvidiaModel ||
        DEFAULT_NVIDIA_MODEL
    );
    const requestedGeminiModel: string =
      body.geminiModel === "pro" ? "gemini-1.5-pro" : "gemini-2.0-flash";
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

    const cerebrasKey: string = (process.env.CEREBRAS_API_KEY || "").trim();

    const detectedProvider: AIProvider =
      rawExplicitProvider === "gemini" && geminiKey.length >= 15
        ? "gemini"
        : rawExplicitProvider === "nvidia" && nvidiaKey.length >= 15
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

    /**
     * Direct, low-overhead LLM execution with fast timeouts and automatic failover to fast non-blocking models.
     */
    const runModelPrompt = async (
      systemPrompt: string,
      userPrompt: string,
      maxTokens = 2400,
      timeoutPerModelMs = 20000
    ): Promise<{ text: string; modelUsed: string } | null> => {
      const tryNvidiaDirect = async (
        key: string
      ): Promise<{ text: string; modelUsed: string } | null> => {
        if (!key || key.length < 15) return null;

        // Build prioritized candidate list starting with user's selected model,
        // followed by ultra-fast non-blocking models (Gemma 4 31B, Gemma 3 12B, Nemotron Lightning)
        const fastFallbacks = [
          "google/gemma-4-31b-it",
          "google/gemma-3-12b-it",
          "nvidia/nemotron-3.5-lightning-30b-a3b",
          "nvidia/nemotron-3.5-bolt-e4b",
        ];
        const candidates = Array.from(
          new Set([requestedNvidiaModel, ...fastFallbacks])
        ).slice(0, 3);

        for (const candidate of candidates) {
          const isReasoningModel =
            /nemotron-3\.5-(super|lightning)|nemotron-3-ultra|glm-5|minimax/i.test(
              candidate
            );
          const effectiveMaxTokens = isReasoningModel
            ? Math.max(maxTokens, 4096)
            : maxTokens;

          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutPerModelMs);
          try {
            const res = await fetch(
              "https://integrate.api.nvidia.com/v1/chat/completions",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${key}`,
                },
                signal: controller.signal,
                body: JSON.stringify({
                  model: candidate,
                  messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                  ],
                  temperature: 0.3,
                  max_tokens: effectiveMaxTokens,
                }),
              }
            );
            clearTimeout(timer);

            if (!res.ok) {
              console.warn(
                `[flo study NVIDIA] ${candidate} returned HTTP ${res.status}`
              );
              continue;
            }

            const data = await res.json();
            const msg = data?.choices?.[0]?.message;
            const contentText = (
              msg?.content ||
              msg?.reasoning_content ||
              ""
            ).trim();
            if (contentText && contentText.length > 15) {
              return { text: contentText, modelUsed: candidate };
            }
          } catch (err) {
            clearTimeout(timer);
            console.warn(`[flo study NVIDIA] ${candidate} failed/timed out:`, err);
          }
        }
        return null;
      };

      const tryGeminiDirect = async (
        key: string
      ): Promise<{ text: string; modelUsed: string } | null> => {
        if (!key || key.length < 15) return null;
        const candidates = Array.from(
          new Set([
            requestedGeminiModel,
            "gemini-2.0-flash",
            "gemini-1.5-flash",
            "gemini-1.5-pro",
          ])
        );

        for (const candidate of candidates) {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutPerModelMs);
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${encodeURIComponent(
              key
            )}`;
            const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: controller.signal,
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents: [
                  { role: "user", parts: [{ text: userPrompt }] },
                ],
                generationConfig: {
                  temperature: 0.3,
                  maxOutputTokens: maxTokens,
                },
              }),
            });
            clearTimeout(timer);

            if (!res.ok) continue;
            const data = await res.json();
            const text = (
              data?.candidates?.[0]?.content?.parts
                ?.map((p: { text?: string }) => p.text || "")
                .join("") || ""
            ).trim();
            if (text && text.length > 15) {
              return { text, modelUsed: candidate };
            }
          } catch (err) {
            clearTimeout(timer);
            console.warn(`[flo study Gemini] ${candidate} failed/timed out:`, err);
          }
        }
        return null;
      };

      const tryCerebrasFallback = async (): Promise<{
        text: string;
        modelUsed: string;
      } | null> => {
        if (!cerebrasKey || cerebrasKey.length < 15) return null;
        for (const model of ["llama-3.3-70b", "llama3.1-8b"]) {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 12000);
          try {
            const res = await fetch(
              "https://api.cerebras.ai/v1/chat/completions",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${cerebrasKey}`,
                },
                signal: controller.signal,
                body: JSON.stringify({
                  model,
                  messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                  ],
                  temperature: 0.3,
                  max_tokens: maxTokens,
                }),
              }
            );
            clearTimeout(timer);
            if (!res.ok) continue;
            const data = await res.json();
            const text = (data?.choices?.[0]?.message?.content || "").trim();
            if (text && text.length > 15) {
              return { text, modelUsed: `cerebras/${model}` };
            }
          } catch {
            clearTimeout(timer);
          }
        }
        return null;
      };

      if (detectedProvider === "nvidia") {
        const nvRes = await tryNvidiaDirect(nvidiaKey);
        if (nvRes) return nvRes;
        if (geminiKey.length >= 15) {
          const gemRes = await tryGeminiDirect(geminiKey);
          if (gemRes) return gemRes;
        }
      } else {
        const gemRes = await tryGeminiDirect(geminiKey);
        if (gemRes) return gemRes;
        if (nvidiaKey.length >= 15) {
          const nvRes = await tryNvidiaDirect(nvidiaKey);
          if (nvRes) return nvRes;
        }
      }

      return await tryCerebrasFallback();
    };

    // =========================================================================
    // MODE 1: Fast Structured Syllabus Generation
    // =========================================================================
    if (mode === "generate_syllabus") {
      const topicInput: string = (body.topicInput || "").trim();
      const academicLevel = body.academicLevel || "College level";
      const studyStyle = body.studyStyle || "syllabus";
      const referenceNotes: string = (body.referenceNotes || "").trim();

      if (!topicInput) {
        return NextResponse.json(
          {
            error:
              "Please enter at least one study topic or syllabus focus area.",
          },
          { status: 400 }
        );
      }

      const syllabusPrompt = `Break the following user study topic(s), syllabus notes, or exam focus areas into an ordered, hyper-organized JSON curriculum tailored for "${academicLevel}" (mode: "${studyStyle}"):

USER INPUT TOPICS:
"""
${topicInput}${referenceNotes ? `\n\nADDITIONAL REFERENCE NOTES:\n${referenceNotes}` : ""}
"""

REQUIREMENTS:
1. Ensure 100% coverage of EVERY topic the user entered, calibrated to ${academicLevel}.
2. Group into 2 to 4 logical "modules" (Major Topics).
3. Break each module into 2 to 4 concrete, bite-sized "subtopics" (Micro-Lessons) ordered logically from foundational concepts/notation to problem-solving & applications.
4. Keep titles and descriptions crisp so generation is instant.
5. Return ONLY a valid JSON object matching this exact schema (no markdown text outside the JSON):
{
  "title": "Clear overarching curriculum title",
  "overview": "1-2 sentence overview of what the student will master",
  "modules": [
    {
      "title": "Module 1: [Major Topic Title]",
      "description": "Concise 1-sentence summary of this module",
      "subtopics": [
        {
          "title": "[Specific Bite-Sized Micro-Lesson Title]",
          "description": "1-sentence description of the exact concept, formula, and examples covered",
          "estimatedMinutes": 8
        }
      ]
    }
  ]
}`;

      const llmRes = await runModelPrompt(
        TUTOR_SYSTEM_PROMPT,
        syllabusPrompt,
        1400,
        15000
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

        if (
          parsed &&
          Array.isArray(parsed.modules) &&
          parsed.modules.length > 0
        ) {
          const nowISO = new Date().toISOString();
          const builtModules: StudyModule[] = parsed.modules
            .map((m, mIdx) => {
              const rawSubs = Array.isArray(m.subtopics) ? m.subtopics : [];
              const subtopics: StudySubtopic[] = rawSubs
                .filter(
                  (s) => s && typeof s.title === "string" && s.title.trim()
                )
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
              academicLevel,
              studyStyle,
              referenceNotes: referenceNotes || undefined,
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

      const fallbackSyllabus = {
        ...buildDeterministicSyllabus(topicInput),
        academicLevel,
        studyStyle,
        referenceNotes: referenceNotes || undefined,
      };
      return NextResponse.json({
        syllabus: fallbackSyllabus,
        modelUsed: requestedNvidiaModel,
      });
    }

    // =========================================================================
    // MODE 2: Interactive Bite-Sized Teaching, Worked Examples, Visuals & Checkpoints
    // =========================================================================
    const rawSyllabus = body.syllabus as StudySyllabus | undefined;
    if (!rawSyllabus || !Array.isArray(rawSyllabus.modules)) {
      return NextResponse.json(
        { error: "Missing active syllabus in request." },
        { status: 400 }
      );
    }

    let workingSyllabus = normalizeSyllabusStates(
      rawSyllabus,
      body.targetSubtopicId
    );
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

    const serializedSyllabus = JSON.stringify({
      title: workingSyllabus.title,
      progressPercentage: `${progress.percentage}% (${progress.completedCount}/${progress.totalActive})`,
      currentActiveSubtopic: {
        id: currentSubtopic.id,
        title: currentSubtopic.title,
        description: currentSubtopic.description || "",
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
    });

    const cursingMode = Boolean(body.workspaceConfig?.cursingMode);
    const cursingNote = cursingMode
      ? "\n🤬 CURSING MODE ENABLED (ALL FUN & GAMES): Openly curse, swear, and use hilarious, unfiltered vulgar profanity (e.g. 'fuck', 'shit', 'ass', 'damn', 'bitch', funny creative insults) while teaching! Never censor with asterisks. Keep it hysterically funny and playful while keeping ALL math formulas, LaTeX, worked examples, and checkpoints 100% accurate!"
      : "";

    const toneNote =
      (tone === "killer_bee"
        ? "Flavor note: Add subtle Killer Bee rhyming swagger at the very start/end while keeping all math, formulas, worked examples, and checkpoints 100% rigorous and crystal clear."
        : tone === "naruto"
        ? "Flavor note: Bring encouraging Naruto energy ('Believe it!') while keeping all math, formulas, worked examples, and checkpoints 100% rigorous and clear."
        : "") + cursingNote;

    let turnDirective = "";
    if (
      actionType === "answer_checkpoint" &&
      checkpointSubmission &&
      checkpointSubmission.questionType === "short_answer"
    ) {
      turnDirective = `The student submitted a Short-Answer / Active Recall response for subtopic "${currentSubtopic.title}" (ID: "${currentSubtopic.id}").
Question asked: "${checkpointSubmission.question}"
Student's answer: "${checkpointSubmission.shortAnswerText || userMessage}"

TASK:
1. Output an <EVALUATION>{"passed": true/false, "feedback": "..."}</EVALUATION> block first.
2. IF "passed" is FALSE:
   - Do NOT advance to the next subtopic! Stay on "${currentSubtopic.title}".
   - In <LESSON>, clarify the exact misconception with a concrete worked example and step-by-step math/explanation.
   - Provide <TAKEAWAYS>, <VISUAL>, and a new <CHECKPOINT> testing "${currentSubtopic.title}".
3. IF "passed" is TRUE:
   - Find the NEXT subtopic in the syllabus whose state is "locked" after "${currentSubtopic.title}".
   - Teach THAT NEXT subtopic in <LESSON> (with real formulas, step-by-step method, and 1-2 worked examples), <TAKEAWAYS>, <VISUAL>, and <CHECKPOINT>!`;
    } else if (
      actionType === "remediate" ||
      (actionType === "answer_checkpoint" &&
        checkpointSubmission &&
        checkpointSubmission.isMcqCorrect === false)
    ) {
      const wrongChoice =
        checkpointSubmission?.selectedOptionText ||
        userMessage ||
        "an incorrect option";
      turnDirective = `The student answered the comprehension check for subtopic "${currentSubtopic.title}" INCORRECTLY.
Question: "${checkpointSubmission?.question || ""}"
Student selected: "${wrongChoice}"

ADAPTIVE REMEDIATION MANDATE:
1. Stay on "${currentSubtopic.title}". Do NOT advance!
2. In <LESSON>:
   - First, show why "${wrongChoice}" doesn't work by plugging in or walking through the exact step where it breaks down.
   - Second, re-explain "${currentSubtopic.title}" using a simpler intuition AND walk through a brand-new, step-by-step worked example with real numbers/formulas.
3. Include a clear <VISUAL> and a fresh <CHECKPOINT> question testing "${currentSubtopic.title}".`;
    } else if (actionType === "chat_message" && userMessage) {
      turnDirective = `The student sent this message in the Study Mode stream:
"${userMessage}"
${
  allAppliedMutations.length > 0
    ? `\nNOTE: The system already applied these syllabus updates: ${allAppliedMutations.join(
        "; "
      )}. The current active "in_progress" subtopic is now "${
        currentSubtopic.title
      }" in "${currentModule?.title || ""}".`
    : ""
}

TASK:
1. If the user is asking a question or asking for more examples on "${currentSubtopic.title}", answer their question directly with concrete math/formulas and step-by-step worked examples in <LESSON>, include <VISUAL>, and end with a <CHECKPOINT>.
2. If the user just skipped/removed a topic and transitioned to "${currentSubtopic.title}", teach "${currentSubtopic.title}" in full depth (formulas + how-to steps + worked examples + visual + checkpoint).`;
    } else {
      turnDirective = `Teach ONLY the current active "in_progress" subtopic in concrete, example-rich depth:
Subtopic Title: "${currentSubtopic.title}"
Module: "${currentModule?.title || ""}"
Scope: "${currentSubtopic.description || ""}"

MANDATORY LESSON STRUCTURE INSIDE <LESSON>:
1. **Core Concept, Formal Notation & Equations**:
   - Define the concept clearly and show the exact mathematical notation, formula, or rule (use $...$ for inline LaTeX and $$...$$ for block equations).
   - Explain what every piece of the notation or formula means in plain English.
2. **How to Do It (Step-by-Step Recipe)**:
   - Give a numbered 3-step method showing how to solve problems or evaluate questions on "${currentSubtopic.title}".
3. **Concrete Worked Examples (1–2 Full Examples)**:
   - Walk through at least 2 concrete worked examples with real numbers, functions, or scenarios solved step-by-step from start to finish so the student sees the exact mechanics before being quizzed!`;
    }

    const userPrompt = `LIVE SYLLABUS STATE:
${serializedSyllabus}

${toneNote}

${turnDirective}

Output your response using these exact section tags (do NOT wrap the whole response in a single JSON string—write natural Markdown & LaTeX inside <LESSON>):

<EVALUATION>
{"passed": true, "feedback": "Only include this tag if evaluating a student's short answer"}
</EVALUATION>

<LESSON>
### 1. Core Concept & Notation
(Write clear explanation with exact formulas/LaTeX $...$ and $$...$$)

### 2. How to Solve It (Step-by-Step)
1. **Step 1:** ...
2. **Step 2:** ...
3. **Step 3:** ...

### 3. Worked Examples
**Example 1:** ... (Show problem, step-by-step work, and final answer)

**Example 2:** ... (Show problem, step-by-step work, and final answer)
</LESSON>

<TAKEAWAYS>
- Concrete takeaway 1 (with formula/rule)
- Concrete takeaway 2
- Common exam pitfall to avoid
</TAKEAWAYS>

<VISUAL type="mermaid" title="Visual Title" caption="What this diagram illustrates">
flowchart LR
  A["Step 1: ..."] --> B["Step 2: ..."]
  B --> C["Step 3: ..."]
</VISUAL>

<CHECKPOINT>
{
  "questionType": "mcq",
  "question": "A concrete problem or conceptual check directly testing the worked examples above (use $...$ for math)",
  "hint": "Helpful step-by-step hint",
  "options": [
    {
      "label": "A",
      "text": "Option A",
      "isCorrect": true,
      "explanation": "Step-by-step explanation of why A is correct"
    },
    {
      "label": "B",
      "text": "Option B",
      "isCorrect": false,
      "explanation": "Specific reason why B is incorrect"
    },
    {
      "label": "C",
      "text": "Option C",
      "isCorrect": false,
      "explanation": "Specific reason why C is incorrect"
    },
    {
      "label": "D",
      "text": "Option D",
      "isCorrect": false,
      "explanation": "Specific reason why D is incorrect"
    }
  ]
}
</CHECKPOINT>`;

    const llmRes = await runModelPrompt(
      TUTOR_SYSTEM_PROMPT,
      userPrompt,
      2600,
      22000
    );

    if (llmRes) {
      const parsed = parseStructuredTutorOutput(llmRes.text);

      if (parsed && parsed.lessonMarkdown) {
        if (
          Array.isArray(parsed.syllabusMutations) &&
          parsed.syllabusMutations.length > 0
        ) {
          const mutRes = applyMutationsToSyllabus(
            workingSyllabus,
            parsed.syllabusMutations,
            currentSubtopic.id
          );
          workingSyllabus = mutRes.updatedSyllabus;
          allAppliedMutations.push(...mutRes.appliedSummaries);
          progress = computeSyllabusProgress(workingSyllabus);
        }

        let evaluationResult: { passed: boolean; feedback: string } | null =
          null;
        if (
          actionType === "answer_checkpoint" &&
          parsed.evaluation &&
          typeof parsed.evaluation === "object" &&
          typeof parsed.evaluation.passed === "boolean"
        ) {
          const passed = Boolean(parsed.evaluation.passed);
          const feedback = String(
            parsed.evaluation.feedback ||
              (passed
                ? "Spot on! You demonstrated clear mastery of this concept."
                : "Let's review the key step and try one more check.")
          );
          evaluationResult = { passed, feedback };

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

        const effectiveSubtopic = progress.activeSubtopic || currentSubtopic;
        const effectiveModule = progress.activeModule || currentModule;

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
              } marked as already known).\n\n${parsed.lessonMarkdown}`,
              keyTakeaways:
                parsed.keyTakeaways.length > 0
                  ? parsed.keyTakeaways
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
            content: parsed.lessonMarkdown,
            keyTakeaways: parsed.keyTakeaways.slice(0, 5),
            visual,
            checkpoint,
            syllabusMutationsApplied: allAppliedMutations,
            isRemediation: Boolean(
              parsed.isRemediation || actionType === "remediate"
            ),
            evaluationResult,
            modelUsed: llmRes.modelUsed,
          },
        });
      }
    }

    // =========================================================================
    // Offline / No-Key Fallback (with concrete examples when API is unreachable)
    // =========================================================================
    const activeSub = progress.activeSubtopic || currentSubtopic;
    const activeMod = progress.activeModule || currentModule;

    return NextResponse.json(
      {
        error: "AI_MODEL_TIMEOUT",
        message:
          "The selected AI model took too long or could not be reached. Please try switching to 'Gemma 4 31B', 'Gemma 3 12B', or 'Nemotron Lightning' in the Study Mode model selector.",
        syllabus: workingSyllabus,
        activeSubtopic: activeSub.title,
        activeModule: activeMod?.title,
      },
      { status: 504 }
    );
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
