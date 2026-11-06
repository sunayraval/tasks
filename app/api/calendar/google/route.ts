import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const tasks = Array.isArray(body.tasks) ? body.tasks : [];

    // Check if user has an active Google OAuth provider token via Supabase session
    let providerToken: string | null = body.accessToken || null;

    if (!providerToken && isSupabaseConfigured()) {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.provider_token) {
          providerToken = session.provider_token;
        }
      } catch {
        // Ignore session read error
      }
    }

    const tasksWithDueDates = tasks.filter((t: { due_date?: string }) =>
      Boolean(t.due_date)
    );

    if (providerToken) {
      let syncedCount = 0;
      for (const task of tasksWithDueDates.slice(0, 15)) {
        const end = new Date(task.due_date);
        const start = new Date(
          end.getTime() - (task.estimated_minutes || 30) * 60 * 1000
        );

        const res = await fetch(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${providerToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              summary: `[TaskIt • ${task.priority}] ${task.title}`,
              description: `${task.notes || ""}\nTags: ${(
                task.tags || []
              ).join(", ")}`,
              start: { dateTime: start.toISOString() },
              end: { dateTime: end.toISOString() },
            }),
          }
        );
        if (res.ok) syncedCount++;
      }

      return NextResponse.json({
        success: true,
        mode: "google_api_live",
        syncedCount,
        message: `Synced ${syncedCount} task deadlines to your primary Google Calendar.`,
      });
    }

    // If OAuth token isn't active yet, return structured preview ready for Google Calendar
    return NextResponse.json({
      success: true,
      mode: "ready_preview",
      syncedCount: tasksWithDueDates.length,
      message: `Prepared ${tasksWithDueDates.length} task deadlines for Google Calendar sync. Sign in with Google OAuth (calendar.events scope) to push live events.`,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Google Calendar sync error";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

