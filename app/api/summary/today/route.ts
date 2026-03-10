import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { todayJst } from "@/lib/scoring";
import type { Category, CategoryBreakdown, TodaySummary } from "@/lib/types";

export const revalidate = 60; // 1分キャッシュ

export async function GET() {
  const supabase = createServerClient();
  const today = todayJst();

  // daily_snapshots
  const { data: snapshot } = await supabase
    .from("daily_snapshots")
    .select("*")
    .eq("day", today)
    .maybeSingle();

  // sources一覧
  const { data: sources } = await supabase
    .from("sources")
    .select("id, name, url, enabled, created_at")
    .eq("enabled", true)
    .order("name");

  // カテゴリ内訳TOP3
  const todayStart = `${today}T00:00:00+09:00`;
  const todayEnd = `${today}T23:59:59+09:00`;

  const { data: todayItems } = await supabase
    .from("items")
    .select("score, category")
    .not("analyzed_at", "is", null)
    .gte("published_at", todayStart)
    .lte("published_at", todayEnd);

  const { data: todayFetched } = await supabase
    .from("items")
    .select("score, category")
    .not("analyzed_at", "is", null)
    .is("published_at", null)
    .gte("fetched_at", todayStart)
    .lte("fetched_at", todayEnd);

  const allItems = [...(todayItems ?? []), ...(todayFetched ?? [])];

  // カテゴリごとのポジ/ネガ集計
  const posiMap: Record<string, number> = {};
  const negaMap: Record<string, number> = {};

  for (const it of allItems) {
    const cat = (it.category as Category) ?? "other";
    if (it.score > 0) {
      posiMap[cat] = (posiMap[cat] ?? 0) + it.score;
    } else if (it.score < 0) {
      negaMap[cat] = (negaMap[cat] ?? 0) + Math.abs(it.score);
    }
  }

  const topPositive: CategoryBreakdown[] = Object.entries(posiMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([category, points]) => ({ category: category as Category, points }));

  const topNegative: CategoryBreakdown[] = Object.entries(negaMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([category, points]) => ({ category: category as Category, points }));

  const result: TodaySummary = {
    snapshot: snapshot ?? null,
    topPositive,
    topNegative,
    sources: sources ?? [],
  };

  return NextResponse.json(result);
}
