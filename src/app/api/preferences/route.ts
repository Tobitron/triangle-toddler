import { NextResponse } from "next/server";
import { supaServer } from "@/lib/supabase";

export async function GET() {
  let sel = await supaServer
    .from("category_prefs")
    .select("*")
    .order("category", { ascending: true });
  if (sel.error) {
    sel = await supaServer.from("CategoryPref").select("*");
  }
  if (sel.error) return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  return NextResponse.json({ prefs: sel.data ?? [] });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const category = String(body.category ?? "").trim();
  const weight = Number(body.weight);
  if (!category || Number.isNaN(weight)) {
    return NextResponse.json({ error: "category and weight required" }, { status: 400 });
  }
  // Emulate upsert by unique category
  let existingSel = await supaServer
    .from("category_prefs")
    .select("id")
    .eq("category", category)
    .limit(1)
    .maybeSingle();
  if (existingSel.error) {
    existingSel = await supaServer.from("CategoryPref").select("id").eq("category", category).limit(1).maybeSingle();
  }
  let resp;
  if (existingSel.data?.id) {
    resp = await supaServer.from("category_prefs").update({ weight }).eq("id", existingSel.data.id).select().single();
    if (resp.error) resp = await supaServer.from("CategoryPref").update({ weight }).eq("id", existingSel.data.id).select().single();
  } else {
    resp = await supaServer.from("category_prefs").insert({ category, weight }).select().single();
    if (resp.error) resp = await supaServer.from("CategoryPref").insert({ category, weight }).select().single();
  }
  if (resp.error) return NextResponse.json({ error: "Failed to upsert preference" }, { status: 500 });
  return NextResponse.json({ ok: true, pref: resp.data });
}
