import { NextResponse } from "next/server";
import { getRecommendations } from "@/lib/recommend";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const when = (searchParams.get("when") as "now" | "later") || "now";
  const limit = Number(searchParams.get("limit") || 5);
  const data = await getRecommendations(when, limit);
  return NextResponse.json(data, { status: 200 });
}

