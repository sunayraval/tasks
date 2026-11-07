import { NextResponse } from "next/server";
import { INITIAL_SEED_TASKS } from "@/utils/seedData";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/client";

function formatICSDate(dateStr: string | null): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeICSText(str: string): string {
  return (str || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return new NextResponse("Missing subscription token", { status: 401 });
  }

  let tasks = INITIAL_SEED_TASKS;

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .order("due_date", { ascending: true });
      if (data && data.length > 0) {
        tasks = data;
      }
    } catch {
      // Fallback to seed tasks
    }
  }

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//kite AI Workspace//tasks.sunayraval.com//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:kite — AI Productivity Workspace",
    "X-WR-TIMEZONE:UTC",
  ];

  for (const t of tasks) {
    if (!t.due_date) continue;
    const dtEnd = formatICSDate(t.due_date);
    const startObj = new Date(
      new Date(t.due_date).getTime() - (t.estimated_minutes || 30) * 60 * 1000
    );
    const dtStart = formatICSDate(startObj.toISOString());

    lines.push(
      "BEGIN:VEVENT",
      `UID:kite-${t.id}@tasks.sunayraval.com`,
      `DTSTAMP:${formatICSDate(t.updated_at || new Date().toISOString())}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${escapeICSText(`[${t.priority}] ${t.title}`)}`,
      `DESCRIPTION:${escapeICSText(
        `Status: ${t.status} | Type: ${t.type} | Tags: ${(t.tags || []).join(
          " "
        )} | Notes: ${t.notes || ""}`
      )}`,
      `STATUS:${t.status === "Done" ? "CONFIRMED" : "TENTATIVE"}`,
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="taskit-feed.ics"',
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

