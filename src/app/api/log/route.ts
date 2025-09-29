import { NextResponse } from "next/server";
import { supaServer } from "@/lib/supabase";
import { getNow } from "@/lib/clock";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const activityId = Number(body.activity_id ?? body.activityId);
  if (!activityId) return NextResponse.json({ error: "activity_id required" }, { status: 400 });
  const startedAt = body.started_at ? new Date(body.started_at) : getNow();
  const durationMin = body.duration_min ? Number(body.duration_min) : undefined;
  const rating = body.rating != null ? Number(body.rating) : undefined;
  const notes = typeof body.notes === "string" ? body.notes : undefined;
  const who = typeof body.who === "string" ? body.who : undefined;
  let insert = await supaServer
    .from("activity_logs")
    .insert([{ activity_id: activityId, started_at: startedAt.toISOString(), duration_min: durationMin, rating, notes, who }])
    .select()
    .single();
  if (insert.error) {
    insert = await supaServer
      .from("ActivityLog")
      .insert([{ activityId, startedAt: startedAt.toISOString(), durationMin, rating, notes, who }])
      .select()
      .single();
  }
  if (insert.error) return NextResponse.json({ error: "Failed to create log" }, { status: 500 });
  const data = insert.data;
  return NextResponse.json({ ok: true, log: data }, { status: 201 });
}
