import { NextResponse } from "next/server";
import ical, { type CalendarComponent } from "node-ical";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/client";
import { TaskItem } from "@/types/taskit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Blacklist of non-class clutter, school-wide groups, counseling, and non-instructional events
const NON_CLASS_KEYWORDS = [
  // Grade / Schoolwide cohorts
  "class of 20",
  "class of '",
  "seniors",
  "juniors",
  "sophomores",
  "freshmen",
  "all students",
  "schoolwide",
  "school-wide",
  "whole school",
  "student body",
  "community",

  // Counseling & Admin
  "counseling",
  "counselor",
  "student services",
  "student support",
  "guidance",
  "advising",
  "academic advising",
  "college & career",
  "college and career",
  "naviance",
  "scholarship",
  "financial aid",
  "administration",
  "principal",
  "front office",
  "dean of",

  // Advisory / Homeroom / Testing Info
  "advisory",
  "homeroom",
  "morning announcements",
  "announcements",
  "study hall",
  "testing info",
  "psat info",
  "sat info",
  "testing center",

  // Clubs / Extracurriculars / Sports
  "sga",
  "student government",
  "nhs",
  "national honor society",
  "ptsa",
  "pta",
  "booster club",
  "athletics",
  "varsity",
  "junior varsity",
  "cheer",
  "football",
  "basketball",
  "soccer",
  "baseball",
  "lacrosse",
  "track & field",
  "cross country",
  "key club",
  "model un",

  // Facility / Services
  "media center",
  "library",
  "cafeteria",
  "attendance",
  "nurse",
  "health room",

  // School calendar events / non-instructional
  "early dismissal",
  "delayed opening",
  "2-hour delay",
  "2 hour delay",
  "half day",
  "no school",
  "school closed",
  "professional development",
  "staff development",
  "teacher workday",
  "in-service",
  "interim",
  "end of quarter",
  "end of term",
  "report card",
  "bell schedule",
  "assembly",
  "holiday",
  "break",
  "vacation",
  "parent teacher",
  "back to school night",
  "open house",
  "office hours",
  "info session",
  "information session",
  "webinar",
  "survey",
];

// Academic subjects and course signals
const ACADEMIC_PATTERNS = [
  /\b(math|algebra|geometry|calculus|calc|statistics|stat|trig|trigonometry|precalc)\b/i,
  /\b(bio|biology|chem|chemistry|physics|phys|science|anatomy|physiology|environmental|geology)\b/i,
  /\b(english|eng|lit|literature|lang|language|writing|composition|journalism|reading)\b/i,
  /\b(history|hist|gov|government|econ|economics|macro|micro|psych|psychology|sociology|geography|civics|world)\b/i,
  /\b(spanish|french|german|chinese|mandarin|latin|japanese|italian|asl|esol|ell)\b/i,
  /\b(cs|computer science|coding|programming|cyber|engineering|robotics|cad|tech|technology)\b/i,
  /\b(art|music|band|orchestra|choir|theatre|drama|dance|health|pe|physical education|fitness)\b/i,
  /\b(ap|ib|honors|hon|gt|gifted|cp|college prep|dual enrollment|de)\b/i,
  /\b[A-Z]{2,6}\s*\d{2,4}\b/,
  /\b(period|per|block|p)\s*[1-8]\b/i,
  /\b(sec|section)\s*\d{1,4}\b/i,
];

// Extract course code from Canvas summary strings like:
// "Lab 4: Photosynthesis [AP BIOLOGY - Sec 01]" or "Quiz 5 (MATH 240)"
function parseCanvasSummary(rawSummary: string): {
  cleanTitle: string;
  courseCode: string;
  hasCourseBracket: boolean;
} {
  const bracketMatch = rawSummary.match(/\[([^\]]+)\]/);
  if (bracketMatch) {
    const rawCourse = bracketMatch[1].split("-")[0].trim().toUpperCase();
    const cleanTitle = rawSummary.replace(bracketMatch[0], "").trim();
    return {
      cleanTitle: cleanTitle || rawSummary,
      courseCode: rawCourse || "CANVAS",
      hasCourseBracket: true,
    };
  }
  const parenMatch = rawSummary.match(/\(([A-Z]{2,6}\s*\d{2,4})\)/i);
  if (parenMatch) {
    return {
      cleanTitle: rawSummary.replace(parenMatch[0], "").trim(),
      courseCode: parenMatch[1].toUpperCase(),
      hasCourseBracket: true,
    };
  }
  return {
    cleanTitle: rawSummary.trim(),
    courseCode: "",
    hasCourseBracket: false,
  };
}

// Strictly classify whether an item is from an actual academic class vs extra school clutter
function isActualClassAssignment(
  rawSummary: string,
  rawDescription: string = "",
  url: string = ""
): { isClass: boolean; cleanTitle: string; courseCode: string } {
  const { cleanTitle, courseCode, hasCourseBracket } =
    parseCanvasSummary(rawSummary);

  const combinedLower = `${rawSummary} ${courseCode} ${rawDescription}`.toLowerCase();

  // 1. Blacklist check: If it contains any non-class/admin/cohort keyword, reject
  for (const keyword of NON_CLASS_KEYWORDS) {
    if (combinedLower.includes(keyword)) {
      return { isClass: false, cleanTitle, courseCode };
    }
  }

  // 2. In Canvas iCal, actual class assignments have brackets [Course Name] or course code paren
  // Standalone calendar events without course brackets are generic calendar noise (e.g. holidays, announcements)
  if (!hasCourseBracket && !courseCode) {
    return { isClass: false, cleanTitle, courseCode };
  }

  // 3. Check for academic indicators in courseCode or summary
  const hasAcademicSignal = ACADEMIC_PATTERNS.some(
    (pattern) => pattern.test(courseCode) || pattern.test(rawSummary)
  );

  // 4. Check for assignment signals (assignments, quizzes, homework, labs, tests)
  const isAssignmentSignal =
    url.includes("/assignments/") ||
    url.includes("/quizzes/") ||
    url.includes("/discussion_topics/") ||
    /\b(assignment|quiz|test|exam|lab|project|homework|hw|problem set|frq|reading|paper|essay|submission|checkpoint)\b/i.test(
      cleanTitle
    );

  if (hasAcademicSignal || isAssignmentSignal) {
    return { isClass: true, cleanTitle, courseCode: courseCode || "CLASS" };
  }

  // If it has a course bracket and isn't blacklisted, accept as class
  if (hasCourseBracket && courseCode.length >= 2) {
    return { isClass: true, cleanTitle, courseCode };
  }

  return { isClass: false, cleanTitle, courseCode };
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
URL:https://hcpss.instructure.com/courses/101/assignments/1001
END:VEVENT
BEGIN:VEVENT
UID:hcpss-canvas-event-tmr
DTSTAMP:${formatIcsDate(baseDate)}
DTSTART:${formatIcsDate(tmrDue)}
DTEND:${formatIcsDate(tmrDue)}
SUMMARY:Signal Transduction & Cell Cycle FRQ Practice [AP BIOLOGY]
DESCRIPTION:Complete AP Classroom Progress Check Unit 4 FRQs.
URL:https://hcpss.instructure.com/courses/102/assignments/1002
END:VEVENT
BEGIN:VEVENT
UID:hcpss-canvas-event-dayafter
DTSTAMP:${formatIcsDate(baseDate)}
DTSTART:${formatIcsDate(dayAfterDue)}
DTEND:${formatIcsDate(dayAfterDue)}
SUMMARY:Macroeconomics Fiscal Policy Problem Set [AP MACRO]
DESCRIPTION:Multiplier effect calculations and AD-AS graph shifts.
URL:https://hcpss.instructure.com/courses/103/assignments/1003
END:VEVENT
END:VCALENDAR`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const feedUrl: string = (body.canvasFeedUrl || "").trim();

    const clientNow = body.clientDate ? new Date(body.clientDate) : new Date();
    const now = isNaN(clientNow.getTime()) ? new Date() : clientNow;

    // Start of Today: 00:00:00.000 in user's calendar date
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

      const rawSummary = ev.summary ? String(ev.summary) : "";
      const rawDescription = ev.description ? String(ev.description) : "";
      const evUrl = (ev as { url?: string }).url
        ? String((ev as { url?: string }).url)
        : "";

      // 1. STRICT CLASS FILTER: Cut out extra school clutter, clubs, counseling, announcements
      const { isClass, cleanTitle, courseCode } = isActualClassAssignment(
        rawSummary,
        rawDescription,
        evUrl
      );
      if (!isClass) {
        continue;
      }

      // 2. STRICT 3-DAY WINDOW: Only assignments due today, tomorrow, or day after tomorrow!
      const rawDueDate = ev.end || ev.start || (ev as { due?: Date }).due;
      if (!rawDueDate) continue;

      const dueDateObj = new Date(rawDueDate);
      if (isNaN(dueDateObj.getTime())) continue;

      // Drop anything in the past (such as 10/31) or past day after tomorrow!
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

      const { priority, estimatedMinutes, inferredTags, type } =
        inferCanvasTaskMetadata(cleanTitle, rawDescription, diffDays);

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
          rawDescription || "Synced from Canvas LMS."
        }</p>`,
        status: "To Do",
        type,
        priority,
        due_date: dueISO,
        estimated_minutes: estimatedMinutes,
        tags: allTags,
        notes: rawDescription.slice(0, 160) || `Course: ${courseCode}`,
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

    // Database Sync & Automatic Clutter Purge for Supabase
    let dbSynced = false;
    const finalSavedTasks: TaskItem[] = [];

    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          // 1. PURGE past Canvas assignments (e.g. 10/31 and earlier) from Supabase
          await supabase
            .from("tasks")
            .delete()
            .eq("user_id", user.id)
            .eq("is_canvas_assignment", true)
            .lt("due_date", startOfToday.toISOString());

          // 2. PURGE Canvas assignments beyond the 3-day window from Supabase
          await supabase
            .from("tasks")
            .delete()
            .eq("user_id", user.id)
            .eq("is_canvas_assignment", true)
            .gt("due_date", endOfDayAfter.toISOString());

          // 3. Upsert clean active class assignments
          if (syncedTasks.length > 0) {
            for (const item of syncedTasks) {
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
          }
          dbSynced = true;
        }
      } catch (dbErr) {
        console.warn("Supabase Canvas sync/purge error:", dbErr);
      }
    }

    const resultTasks =
      finalSavedTasks.length > 0 ? finalSavedTasks : syncedTasks;

    return NextResponse.json({
      success: true,
      dbSynced,
      usedDemoFeed: !(feedUrl && feedUrl.startsWith("http")),
      count: resultTasks.length,
      tasks: resultTasks,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to parse Canvas feed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
