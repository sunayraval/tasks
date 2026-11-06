import { NextResponse } from "next/server";
import ical, { type CalendarComponent } from "node-ical";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/client";
import { TaskItem } from "@/types/taskit";

// Extract course code from Canvas summary strings like:
// "Lab 4: Photosynthesis [AP BIOLOGY - Sec 01]" or "Quiz 5 (MATH 240)"
function parseCanvasSummary(rawSummary: string): {
  cleanTitle: string;
  courseCode: string;
} {
  const bracketMatch = rawSummary.match(/\[([^\]]+)\]/);
  if (bracketMatch) {
    const rawCourse = bracketMatch[1].split("-")[0].trim().toUpperCase();
    const cleanTitle = rawSummary.replace(bracketMatch[0], "").trim();
    return {
      cleanTitle: cleanTitle || rawSummary,
      courseCode: rawCourse || "CANVAS",
    };
  }
  const parenMatch = rawSummary.match(/\(([A-Z]{2,6}\s*\d{2,4})\)/i);
  if (parenMatch) {
    return {
      cleanTitle: rawSummary.replace(parenMatch[0], "").trim(),
      courseCode: parenMatch[1].toUpperCase(),
    };
  }
  return {
    cleanTitle: rawSummary.trim(),
    courseCode: "HCPSS CANVAS",
  };
}

// Inferred assignment details (smart duration, tag, priority)
function inferCanvasTaskMetadata(
  title: string,
  description: string,
  diffDays: number
): {
  priority: string;
  estimatedMinutes: number;
  inferredTags: string[];
  type: string;
} {
  const lower = `${title} ${description}`.toLowerCase();

  let estimatedMinutes = 45;
  const inferredTags: string[] = [];

  if (
    lower.includes("exam") ||
    lower.includes("midterm") ||
    lower.includes("final")
  ) {
    estimatedMinutes = 90;
    inferredTags.push("#Exam");
  } else if (
    lower.includes("lab") ||
    lower.includes("experiment") ||
    lower.includes("notebook")
  ) {
    estimatedMinutes = 60;
    inferredTags.push("#Lab");
  } else if (
    lower.includes("project") ||
    lower.includes("paper") ||
    lower.includes("essay")
  ) {
    estimatedMinutes = 75;
    inferredTags.push(lower.includes("essay") ? "#Essay" : "#Project");
  } else if (
    lower.includes("quiz") ||
    lower.includes("frq") ||
    lower.includes("check")
  ) {
    estimatedMinutes = 40;
    inferredTags.push("#Quiz");
  } else if (
    lower.includes("homework") ||
    lower.includes("problem set") ||
    lower.includes("hw") ||
    lower.includes("worksheet") ||
    lower.includes("reading")
  ) {
    estimatedMinutes = 35;
    inferredTags.push("#Homework");
  }

  // Priority based on urgency
  let priority = "Medium";
  if (diffDays <= 0) {
    priority = "Urgent";
  } else if (diffDays === 1) {
    priority = "High";
  } else {
    priority =
      lower.includes("exam") || lower.includes("project") ? "High" : "Medium";
  }

  const type =
    lower.includes("college") ||
    lower.includes("common app") ||
    lower.includes("admissions")
      ? "College"
      : "School";

  return { priority, estimatedMinutes, inferredTags, type };
}

// Format date as iCal UTC string YYYYMMDDTHHMMSSZ
function formatIcsDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(
    d.getUTCDate()
  )}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

// Built-in HCPSS Canvas iCal sample payload dynamically tuned to today, tomorrow, and day after tomorrow
function getDynamicDemoIcs(baseDate: Date): string {
  const todayDue = new Date(baseDate);
  todayDue.setHours(23, 59, 0, 0);

  const tmrDue = new Date(baseDate);
  tmrDue.setDate(tmrDue.getDate() + 1);
  tmrDue.setHours(23, 59, 0, 0);

  const dayAfterDue = new Date(baseDate);
  dayAfterDue.setDate(dayAfterDue.getDate() + 2);
  dayAfterDue.setHours(23, 59, 0, 0);

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Instructure Inc.//Canvas LMS//EN
BEGIN:VEVENT
UID:hcpss-canvas-event-today
DTSTAMP:${formatIcsDate(baseDate)}
DTSTART:${formatIcsDate(todayDue)}
DTEND:${formatIcsDate(todayDue)}
SUMMARY:SVD & Principal Component Analysis Lab [MATH 240 - Linear Algebra]
DESCRIPTION:Complete MATLAB / Python notebook on Singular Value Decomposition and upload PDF to Canvas.
END:VEVENT
BEGIN:VEVENT
UID:hcpss-canvas-event-tmr
DTSTAMP:${formatIcsDate(baseDate)}
DTSTART:${formatIcsDate(tmrDue)}
DTEND:${formatIcsDate(tmrDue)}
SUMMARY:Signal Transduction & Cell Cycle FRQ Practice [AP BIOLOGY]
DESCRIPTION:Complete AP Classroom Progress Check Unit 4 FRQs.
END:VEVENT
BEGIN:VEVENT
UID:hcpss-canvas-event-dayafter
DTSTAMP:${formatIcsDate(baseDate)}
DTSTART:${formatIcsDate(dayAfterDue)}
DTEND:${formatIcsDate(dayAfterDue)}
SUMMARY:Macroeconomics Fiscal Policy Problem Set [AP MACRO]
DESCRIPTION:Multiplier effect calculations and AD-AS graph shifts.
END:VEVENT
END:VCALENDAR`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const feedUrl: string = (body.canvasFeedUrl || "").trim();

    const clientNow = body.clientDate ? new Date(body.clientDate) : new Date();
    const now = isNaN(clientNow.getTime()) ? new Date() : clientNow;

    // Start of Today: 00:00:00.000
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    // End of Day After Tomorrow: +2 calendar days at 23:59:59.999
    // (Today = day 0, Tomorrow = day 1, Day After Tomorrow = day 2)
    const endOfDayAfter = new Date(startOfToday);
    endOfDayAfter.setDate(endOfDayAfter.getDate() + 2);
    endOfDayAfter.setHours(23, 59, 59, 999);

    let parsedEvents: Record<string, CalendarComponent> = {};

    if (feedUrl && feedUrl.startsWith("http")) {
      parsedEvents = await ical.async.fromURL(feedUrl);
    } else {
      // Parse sample HCPSS Canvas ICS feed dynamically mapped to today, tmr, day after
      parsedEvents = ical.sync.parseICS(getDynamicDemoIcs(now));
    }

    const syncedTasks: TaskItem[] = [];

    for (const key of Object.keys(parsedEvents)) {
      const ev = parsedEvents[key];
      if (!ev || ev.type !== "VEVENT") continue;

      const rawDueDate = ev.end || ev.start || (ev as { due?: Date }).due;
      if (!rawDueDate) continue;

      const dueDateObj = new Date(rawDueDate);
      if (isNaN(dueDateObj.getTime())) continue;

      // STRICT FILTER: Only sync assignments due today, tomorrow, or day after tomorrow!
      if (dueDateObj < startOfToday || dueDateObj > endOfDayAfter) {
        continue;
      }

      // Autofill due date: if time is 00:00:00, default to end of that day (23:59)
      const finalDueDate = new Date(dueDateObj);
      if (
        finalDueDate.getHours() === 0 &&
        finalDueDate.getMinutes() === 0 &&
        finalDueDate.getSeconds() === 0
      ) {
        finalDueDate.setHours(23, 59, 0, 0);
      }
      const dueISO = finalDueDate.toISOString();

      // Compute diffDays relative to start of today
      const startOfDue = new Date(finalDueDate);
      startOfDue.setHours(0, 0, 0, 0);
      const diffDays = Math.round(
        (startOfDue.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Autofill Section Group:
      // Today -> TODAY
      // Tomorrow -> TMR
      // Day after tomorrow -> SOON
      const sectionGroup =
        diffDays <= 0 ? "TODAY" : diffDays === 1 ? "TMR" : "SOON";

      const summary = ev.summary ? String(ev.summary) : "Canvas Assignment";
      const { cleanTitle, courseCode } = parseCanvasSummary(summary);
      const description = ev.description ? String(ev.description) : "";

      const { priority, estimatedMinutes, inferredTags, type } =
        inferCanvasTaskMetadata(cleanTitle, description, diffDays);

      const courseTag = `#${courseCode.replace(/[^A-Za-z0-9]/g, "")}`;
      const allTags = Array.from(
        new Set(["#Canvas", courseTag, ...inferredTags])
      );

      const itemUuid =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `canvas-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      syncedTasks.push({
        id: itemUuid,
        user_id: "",
        title: cleanTitle,
        content: `<p><strong>Course:</strong> ${courseCode}</p><p>${
          description || "Synced from Canvas LMS iCal feed."
        }</p>`,
        status: "To Do",
        type,
        priority,
        due_date: dueISO,
        estimated_minutes: estimatedMinutes,
        tags: allTags,
        notes: description.slice(0, 160) || `Course: ${courseCode}`,
        is_canvas_assignment: true,
        canvas_course_code: courseCode,
        section_group: sectionGroup,
        order_index: 0,
        completed_at: null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        custom_properties: {
          canvas_uid: ev.uid || key,
          synced_at: now.toISOString(),
        },
      });
    }

    // If Supabase is configured and user is authenticated, upsert into public.tasks
    let dbSynced = false;
    const finalSavedTasks: TaskItem[] = [];

    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user && syncedTasks.length > 0) {
          for (const item of syncedTasks) {
            // Deduplicate by title + user_id
            const { data: existing } = await supabase
              .from("tasks")
              .select("id")
              .eq("user_id", user.id)
              .eq("title", item.title)
              .maybeSingle();

            if (existing?.id) {
              const { data: updated } = await supabase
                .from("tasks")
                .update({
                  due_date: item.due_date,
                  section_group: item.section_group,
                  priority: item.priority,
                  estimated_minutes: item.estimated_minutes,
                  tags: item.tags,
                  notes: item.notes,
                  canvas_course_code: item.canvas_course_code,
                  updated_at: now.toISOString(),
                })
                .eq("id", existing.id)
                .select()
                .single();

              if (updated) {
                finalSavedTasks.push(updated as TaskItem);
              }
            } else {
              const newUuid =
                typeof crypto !== "undefined" &&
                typeof crypto.randomUUID === "function"
                  ? crypto.randomUUID()
                  : item.id;

              const { data: inserted } = await supabase
                .from("tasks")
                .insert({
                  id: newUuid,
                  user_id: user.id,
                  title: item.title,
                  content: item.content,
                  status: item.status,
                  type: item.type,
                  priority: item.priority,
                  due_date: item.due_date,
                  estimated_minutes: item.estimated_minutes,
                  tags: item.tags,
                  notes: item.notes,
                  is_canvas_assignment: true,
                  canvas_course_code: item.canvas_course_code,
                  section_group: item.section_group,
                  custom_properties: item.custom_properties,
                  order_index: 0,
                })
                .select()
                .single();

              if (inserted) {
                finalSavedTasks.push(inserted as TaskItem);
              }
            }
          }
          dbSynced = true;
        }
      } catch (dbErr) {
        console.warn("Supabase Canvas upsert fallback to client state:", dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      dbSynced,
      usedDemoFeed: !(feedUrl && feedUrl.startsWith("http")),
      count: (finalSavedTasks.length > 0 ? finalSavedTasks : syncedTasks).length,
      tasks: finalSavedTasks.length > 0 ? finalSavedTasks : syncedTasks,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to parse Canvas iCal feed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
