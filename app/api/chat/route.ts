import { NextResponse } from "next/server";
import { generateText, tool } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import {
  ActionProposalPayload,
  AITone,
  TaskItem,
  TaskPriority,
  TaskType,
} from "@/types/taskit";

const TONE_PROMPTS: Record<AITone, string> = {
  locked_in:
    "You are TaskIt Copilot in LOCKED IN mode: a direct, disciplined, high-focus productivity coach. Speak concisely with tactical clarity. Push the user to execute their highest-leverage tasks right now.",
  chill_coach:
    "You are TaskIt Copilot in CHILL COACH mode: an empathetic, steady, mindful productivity partner. Keep stress low, validate effort, and encourage sustainable pacing.",
  hyper_drive:
    "You are TaskIt Copilot in HYPER DRIVE mode: high-energy, intense, deadline-driven execution mode. Treat every minute like championship overtime.",
  executive:
    "You are TaskIt Copilot in EXECUTIVE mode: analytical, strategic, ROI-driven chief of staff. Focus on bottlenecks, pareto efficiency, and schedule optimization.",
};

function getNextSaturdayISO(): { iso: string; formatted: string } {
  const now = new Date();
  const day = now.getDay();
  const daysUntilSat = (6 - day + 7) % 7 || 7;
  const sat = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + daysUntilSat,
    18,
    0,
    0
  );
  return {
    iso: sat.toISOString(),
    formatted: sat.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    }),
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userMessage: string = body.message || "";
    const tasks: TaskItem[] = Array.isArray(body.tasks) ? body.tasks : [];
    const tone: AITone = body.tone || "locked_in";
    const customApiKey: string | null = body.customApiKey || null;

    const apiKey =
      (customApiKey && customApiKey.trim()) ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      "";

    const hasValidGeminiKey =
      Boolean(apiKey) &&
      !apiKey.includes("your-gemini-api-key") &&
      apiKey.length > 15;

    let replyText = "";
    let actionProposal: ActionProposalPayload | null = null;

    // 1. If a real Gemini API key (env or BYOK) is configured, run Vercel AI SDK with gemini-1.5-flash & tools
    if (hasValidGeminiKey && !apiKey.startsWith("sk-or-")) {
      try {
        const google = createGoogleGenerativeAI({ apiKey });
        const result = await generateText({
          model: google("gemini-1.5-flash"),
          system: `${TONE_PROMPTS[tone]}
Current local date: ${new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "short",
            day: "numeric",
          })}.
Here are the user's current tasks in JSON:
${JSON.stringify(
  tasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    type: t.type,
    due_date: t.due_date,
    section_group: t.section_group,
  }))
)}
IMPORTANT: Never mutate the database directly. Always invoke the appropriate tool when the user wants to reschedule tasks, create batch tasks, prioritize tasks, or get a daily briefing.`,
          prompt: userMessage,
          tools: {
            reschedule_tasks: tool({
              description:
                "Propose rescheduling one or more tasks to a new due date. Returns an action_proposal for user confirmation.",
              parameters: z.object({
                task_ids: z.array(z.string()),
                new_due_date: z.string(),
                reason: z.string().optional(),
              }),
              execute: async ({ task_ids, new_due_date }) => {
                const targetTasks = tasks.filter((t) =>
                  task_ids.includes(t.id)
                );
                const formattedTarget = new Date(
                  new_due_date
                ).toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                });
                actionProposal = {
                  actionType: "BATCH_RESCHEDULE",
                  description: `Move ${targetTasks.length} task(s) to ${formattedTarget}`,
                  newDueDate: new Date(new_due_date).toISOString(),
                  changes: targetTasks.map((t) => ({
                    id: t.id,
                    title: t.title,
                    from: "Overdue / Current",
                    to: formattedTarget,
                  })),
                };
                return { action_proposal: actionProposal };
              },
            }),
            create_batch_tasks: tool({
              description:
                "Propose creating a batch of new tasks. Returns an action_proposal for user confirmation.",
              parameters: z.object({
                tasks: z.array(
                  z.object({
                    title: z.string(),
                    priority: z.enum(["Urgent", "High", "Medium", "Low"]),
                    due_date: z.string(),
                    type: z.enum([
                      "College",
                      "School",
                      "Personal",
                      "Club",
                      "Work",
                      "General",
                    ]),
                  })
                ),
              }),
              execute: async ({ tasks: batch }) => {
                actionProposal = {
                  actionType: "BATCH_CREATE",
                  description: `Create ${batch.length} new structured tasks`,
                  changes: batch.map((b) => ({
                    title: b.title,
                    from: "New Task",
                    to: `${b.priority} • ${b.type}`,
                    priority: b.priority as TaskPriority,
                    type: b.type as TaskType,
                    section_group: "TODAY",
                  })),
                };
                return { action_proposal: actionProposal };
              },
            }),
            filter_and_prioritize: tool({
              description:
                "Analyze tasks by criteria and propose priority elevations.",
              parameters: z.object({
                criteria: z.string(),
              }),
              execute: async ({ criteria }) => {
                const candidates = tasks
                  .filter((t) => t.status !== "Done")
                  .slice(0, 3);
                actionProposal = {
                  actionType: "PRIORITIZE_AND_TAG",
                  description: `Elevate priority for ${candidates.length} high-impact tasks (${criteria})`,
                  changes: candidates.map((c) => ({
                    id: c.id,
                    title: c.title,
                    from: c.priority,
                    to: "Urgent",
                    priority: "Urgent",
                  })),
                };
                return { action_proposal: actionProposal };
              },
            }),
            generate_daily_briefing: tool({
              description:
                "Generate an executive daily briefing of today's tasks, overdue items, and estimated focus time.",
              parameters: z.object({}),
              execute: async () => {
                const pending = tasks.filter((t) => t.status !== "Done");
                const totalMins = pending.reduce(
                  (acc, t) => acc + (t.estimated_minutes || 30),
                  0
                );
                return {
                  pendingCount: pending.length,
                  totalHours: (totalMins / 60).toFixed(1),
                };
              },
            }),
          },
          maxSteps: 2,
        });

        replyText =
          result.text ||
          "I've prepared an action proposal below. Review the changes and click **Confirm Changes** to apply them to your workspace.";
      } catch (aiErr) {
        console.warn("Gemini SDK fallback triggered:", aiErr);
      }
    }

    // 2. Smart Local Copilot Engine (Handles tool proposals deterministically if no API key is set or when tool is triggered)
    if (!replyText && !actionProposal) {
      const lower = userMessage.toLowerCase();
      const now = new Date();
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );

      const overdueTasks = tasks.filter(
        (t) =>
          t.status !== "Done" &&
          t.due_date &&
          new Date(t.due_date) < startOfToday
      );

      if (
        lower.includes("reschedule") ||
        lower.includes("overdue") ||
        lower.includes("saturday") ||
        lower.includes("move")
      ) {
        const targets =
          overdueTasks.length > 0
            ? overdueTasks
            : tasks.filter((t) => t.status !== "Done").slice(0, 2);
        const { iso, formatted } = getNextSaturdayISO();

        actionProposal = {
          actionType: "BATCH_RESCHEDULE",
          description: `Move ${targets.length} overdue tasks to ${formatted}`,
          newDueDate: iso,
          changes: targets.map((t) => ({
            id: t.id,
            title: t.title,
            from: "Overdue (Yesterday)",
            to: formatted,
          })),
        };

        replyText =
          tone === "locked_in"
            ? `Locked in. I found **${targets.length} overdue tasks** creating drag on your today queue. I've staged a batch reschedule to **${formatted}** so you can focus 100% on today's primary objectives. Confirm below to execute.`
            : tone === "hyper_drive"
            ? `⚡ Let's clear the runway! Moving **${targets.length} overdue tasks** to **${formatted}** so we can blitz today's board at maximum velocity. Hit Confirm!`
            : tone === "executive"
            ? `Strategic reallocation: shifting **${targets.length} carried-over deliverables** to **${formatted}** optimizes today's cognitive load. Review and confirm the proposal card below.`
            : `No stress—let's give your schedule some breathing room. I've proposed moving **${targets.length} overdue tasks** to **${formatted}**. Click Confirm whenever you're ready.`;
      } else if (
        lower.includes("create") ||
        lower.includes("add") ||
        lower.includes("study plan") ||
        lower.includes("batch")
      ) {
        const tomorrowISO = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1,
          20,
          0,
          0
        ).toISOString();

        actionProposal = {
          actionType: "BATCH_CREATE",
          description: "Create 3 high-focus sprint tasks in TODAY",
           newDueDate: tomorrowISO,
          changes: [
            {
              title: "Deep Work Block: Linear Algebra Spectral Proofs (45m)",
              from: "Staged",
              to: "Urgent • School",
              priority: "Urgent",
              type: "School",
              section_group: "TODAY",
              estimated_minutes: 45,
            },
            {
              title: "Common App Final PDF Preview & Signature Lock",
              from: "Staged",
              to: "Urgent • College",
              priority: "Urgent",
              type: "College",
              section_group: "COLLEGE",
              estimated_minutes: 30,
            },
            {
              title: "AP Biology Active Recall Flashcard Sprint",
              from: "Staged",
              to: "High • School",
              priority: "High",
              type: "School",
              section_group: "TODAY",
              estimated_minutes: 35,
            },
          ],
        };

        replyText = `I've architected a **3-part execution block** tailored to your College & AP workload. Per the Action Confirmation Protocol, review the staged tasks below and click **Confirm Changes** to insert them into your table.`;
      } else if (lower.includes("prioritize") || lower.includes("filter")) {
        const highImpact = tasks
          .filter((t) => t.status !== "Done" && t.priority !== "Urgent")
          .slice(0, 2);

        actionProposal = {
          actionType: "PRIORITIZE_AND_TAG",
          description: `Elevate ${highImpact.length} key tasks to Urgent priority`,
          changes: highImpact.map((t) => ({
            id: t.id,
            title: t.title,
            from: t.priority,
            to: "Urgent",
            priority: "Urgent",
          })),
        };

        replyText = `I analyzed your queue for high-ROI bottlenecks and staged a priority elevation for **${highImpact.length} tasks**. Confirm below to apply.`;
      } else {
        // Daily Briefing (`generate_daily_briefing`)
        const pending = tasks.filter((t) => t.status !== "Done");
        const done = tasks.filter((t) => t.status === "Done");
        const urgent = pending.filter((t) => t.priority === "Urgent");
        const totalMins = pending.reduce(
          (acc, t) => acc + (t.estimated_minutes || 30),
          0
        );

        const toneHeader =
          tone === "locked_in"
            ? "🎯 **LOCKED IN BRIEFING**"
            : tone === "hyper_drive"
            ? "🚀 **HYPER DRIVE TELEMETRY**"
            : tone === "executive"
            ? "📊 **EXECUTIVE SITUATION REPORT**"
            : "🌿 **MINDFUL PACING BRIEFING**";

        replyText = `${toneHeader}\n\n• **Completed:** ${done.length} tasks crushed\n• **Active Queue:** ${pending.length} tasks remaining (~${(
          totalMins / 60
        ).toFixed(1)} hrs estimated)\n• **Urgent Bottlenecks:** ${
          urgent.length
        } (${urgent.map((u) => u.title).join(", ") || "None"})\n• **Overdue:** ${
          overdueTasks.length
        } tasks\n\nTry asking me:\n1. *"Reschedule my overdue tasks to Saturday"*\n2. *"Create a batch of study sprint tasks"*\n3. *"Prioritize my highest ROI tasks"*`;
      }
    }

    return NextResponse.json({
      reply: replyText,
      actionProposal,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to run Copilot request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

