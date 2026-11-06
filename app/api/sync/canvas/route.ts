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

// Built-in HCPSS Canvas iCal sample payload if user triggers Demo Sync or tests offline
const DEMO_HCPSS_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Instructure Inc.//Canvas LMS//EN
BEGIN:VEVENT
UID:hcpss-canvas-event-1001
DTSTAMP:20261105T120000Z
DTSTART:20261106T235900Z
DTEND:20261106T235900Z
SUMMARY:SVD & Principal Component Analysis Lab [MATH 240 - Linear Algebra]
DESCRIPTION:Complete MATLAB / Python notebook on Singular Value Decomposition and upload PDF to Canvas.
END:VEVENT
BEGIN:VEVENT
UID:hcpss-canvas-event-1002
DTSTAMP:20261105T120000Z
DTSTART:20261107T235900Z
DTEND:20261107T235900Z
SUMMARY:Signal Transduction & Cell Cycle FRQ Practice [AP BIOLOGY]
DESCRIPTION:Complete AP Classroom Progress Check Unit 4 FRQs.
END:VEVENT
BEGIN:VEVENT
UID:hcpss-canvas-event-1003
DTSTAMP:20261105T120000Z
DTSTART:20261109T235900Z
DTEND:20261109T235900Z
SUMMARY:Macroeconomics Fiscal Policy Problem Set [AP MACRO]
DESCRIPTION:Multiplier effect calculations and AD-AS graph shifts.
END:VEVENT
END:VCALENDAR`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const feedUrl: string = (body.canvasFeedUrl || "").trim();

    let parsedEvents: Record<string, CalendarComponent> = {};

    if (feedUrl && feedUrl.startsWith("http")) {
      parsedEvents = await ical.async.fromURL(feedUrl);
    } else {
      // Parse sample HCPSS Canvas ICS feed for immediate testing
      parsedEvents = ical.sync.parseICS(DEMO_HCPSS_ICS);
    }

    const now = new Date();
    const cutoffPast = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const syncedTasks: Partial<TaskItem>[] = [];

    for (const key of Object.keys(parsedEvents)) {
      const ev = parsedEvents[key];
      if (!ev || ev.type !== "VEVENT") continue;

      const summary = ev.summary ? String(ev.summary) : "Canvas Assignment";
      const dueDate = ev.end || ev.start || new Date();
      if (new Date(dueDate) < cutoffPast) continue;

      const { cleanTitle, courseCode } = parseCanvasSummary(summary);
      const description = ev.description ? String(ev.description) : "";

      const dueISO = new Date(dueDate).toISOString();
      const diffHours =
        (new Date(dueDate).getTime() - now.getTime()) / (1000 * 60 * 60);

      const sectionGroup =
        diffHours <= 30 ? "TODAY" : diffHours <= 56 ? "TMR" : "SOON";

      const courseTag = `#${courseCode.replace(/[^A-Za-z0-9]/g, "")}`;

      syncedTasks.push({
        id: `canvas-${ev.uid || key}`,
        title: cleanTitle,
        content: `<p>${description || "Synced from HCPSS Canvas iCal feed."}</p>`,
        status: "To Do",
        type: "School",
        priority: diffHours <= 24 ? "Urgent" : "High",
        due_date: dueISO,
        estimated_minutes: 45,
        tags: ["#Canvas", courseTag],
        notes: description.slice(0, 140) || `Course: ${courseCode}`,
        is_canvas_assignment: true,
        canvas_course_code: courseCode,
        section_group: sectionGroup,
        custom_properties: {
          canvas_uid: ev.uid || key,
          synced_at: now.toISOString(),
        },
      });
    }

    // If Supabase is configured and user is authenticated, upsert into public.tasks
    let dbSynced = false;
    if (isSupabaseConfigured()) {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user && syncedTasks.length > 0) {
          for (const item of syncedTasks) {
            // Deduplicate by title + is_canvas_assignment for this user
            const { data: existing } = await supabase
              .from("tasks")
              .select("id")
              .eq("user_id", user.id)
              .eq("title", item.title!)
              .maybeSingle();

            if (existing?.id) {
              await supabase
                .from("tasks")
                .update({
                  due_date: item.due_date,
                  canvas_course_code: item.canvas_course_code,
                  updated_at: now.toISOString(),
                })
                .eq("id", existing.id);
            } else {
              await supabase.from("tasks").insert({
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
              });
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
      count: syncedTasks.length,
      tasks: syncedTasks,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to parse Canvas iCal feed";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

