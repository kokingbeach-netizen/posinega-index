import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { fetchRssItems } from "@/lib/rss";
import { judgeItem } from "@/lib/ai";
import { calcScore, todayJst } from "@/lib/scoring";
import type { Source } from "@/lib/types";

const MAX_ITEMS_PER_SOURCE = 20;
const MAX_ANALYZE_PER_RUN = 100;

export const maxDuration = 300; // Vercel Pro: 最大300秒

export async function POST(req: NextRequest) {
  // CRON_SECRET 認証
  const secret = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const startedAt = new Date().toISOString();

  // ① enabled sources 取得
  const { data: sources, error: srcErr } = await supabase
    .from("sources")
    .select("*")
    .eq("enabled", true);

  if (srcErr || !sources) {
    return NextResponse.json({ error: "sources fetch failed" }, { status: 500 });
  }

  // ② RSS fetch & ③ items upsert
  let itemsNew = 0;

  await Promise.allSettled(
    (sources as Source[]).map(async (source) => {
      const rssItems = await fetchRssItems(source, MAX_ITEMS_PER_SOURCE);
      if (rssItems.length === 0) return;

      const rows = rssItems
        .filter((it) => it.title && it.link)
        .map((it) => ({
          source_id: source.id,
          title: it.title.slice(0, 400),
          url: it.link,
          published_at: it.isoDate ?? it.pubDate ?? null,
        }));

      const { error } = await supabase.from("items").upsert(rows, {
        onConflict: "url",
        ignoreDuplicates: true,
      });

      if (error) {
        console.error(`[cron] upsert error for ${source.name}:`, error.message);
      } else {
        itemsNew += rows.length;
      }
    })
  );

  // ④ 未分析 items を最大 MAX_ANALYZE_PER_RUN 件取得
  const { data: unanalyzed } = await supabase
    .from("items")
    .select("id, title, source_id")
    .is("analyzed_at", null)
    .limit(MAX_ANALYZE_PER_RUN);

  // source名マップ
  const sourceMap = new Map((sources as Source[]).map((s) => [s.id, s.name]));

  let itemsAnalyzed = 0;

  if (unanalyzed && unanalyzed.length > 0) {
    // ⑤ AI判定（並列で実行、ただし負荷考慮で5並列ずつ）
    const batchSize = 5;
    for (let i = 0; i < unanalyzed.length; i += batchSize) {
      const batch = unanalyzed.slice(i, i + batchSize);
      await Promise.allSettled(
        batch.map(async (item) => {
          const sourceName = sourceMap.get(item.source_id) ?? "unknown";
          const judgment = await judgeItem(item.title, sourceName);
          const score = calcScore(judgment.sentiment, judgment.intensity);

          const { error } = await supabase
            .from("items")
            .update({
              sentiment: judgment.sentiment,
              intensity: judgment.intensity,
              category: judgment.category,
              score,
              analyzed_at: new Date().toISOString(),
            })
            .eq("id", item.id);

          if (!error) itemsAnalyzed++;
        })
      );
    }
  }

  // ⑥ 今日(JST)の集計 → daily_snapshots upsert
  const today = todayJst();

  // 今日のJST範囲（UTC換算）
  const todayStart = `${today}T00:00:00+09:00`;
  const todayEnd = `${today}T23:59:59+09:00`;

  const { data: todayItems } = await supabase
    .from("items")
    .select("score, category")
    .not("analyzed_at", "is", null)
    .gte("published_at", todayStart)
    .lte("published_at", todayEnd);

  // published_atがnullのものも本日fetchした分として拾う
  const { data: todayFetched } = await supabase
    .from("items")
    .select("score, category")
    .not("analyzed_at", "is", null)
    .is("published_at", null)
    .gte("fetched_at", todayStart)
    .lte("fetched_at", todayEnd);

  const allTodayItems = [...(todayItems ?? []), ...(todayFetched ?? [])];

  let positivePoints = 0;
  let negativePoints = 0;

  // カテゴリ集計
  const categoryScores: Record<string, number> = {};

  for (const it of allTodayItems) {
    if (it.score > 0) {
      positivePoints += it.score;
    } else if (it.score < 0) {
      negativePoints += Math.abs(it.score);
    }
    if (it.category) {
      categoryScores[it.category] = (categoryScores[it.category] ?? 0) + it.score;
    }
  }

  const netScore = positivePoints - negativePoints;

  const { error: snapErr } = await supabase.from("daily_snapshots").upsert(
    {
      day: today,
      positive_points: positivePoints,
      negative_points: negativePoints,
      net_score: netScore,
      items_count: allTodayItems.length,
      sources_count: sources.length,
      updated_at: startedAt,
    },
    { onConflict: "day" }
  );

  if (snapErr) {
    console.error("[cron] daily_snapshots upsert error:", snapErr.message);
  }

  // ⑦ 30日より前の items を削除
  const { error: cleanupErr, count: deletedCount } = await supabase
    .from("items")
    .delete({ count: "exact" })
    .lt("fetched_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  if (cleanupErr) {
    console.error("[cron] cleanup error:", cleanupErr.message);
  }

  return NextResponse.json({
    ok: true,
    sources_count: sources.length,
    items_new: itemsNew,
    items_analyzed: itemsAnalyzed,
    net_score: netScore,
    positive_points: positivePoints,
    negative_points: negativePoints,
    items_deleted: deletedCount ?? 0,
  });
}

// Vercel Cron は GET でも呼ぶ場合があるが、POSTを正とする
export async function GET(req: NextRequest) {
  return POST(req);
}
