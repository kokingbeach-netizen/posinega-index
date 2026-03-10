import { createServerClient } from "@/lib/supabase";
import { todayJst } from "@/lib/scoring";
import { CATEGORY_LABEL } from "@/lib/categoryLabel";
import type { Category, CategoryBreakdown, DailySnapshot, Sentiment, Source } from "@/lib/types";
import Link from "next/link";

type NewsItem = {
  id: string;
  title: string;
  url: string;
  sentiment: Sentiment;
  category: Category;
  score: number;
};

// 毎分再検証（ISR）
export const revalidate = 60;

async function getData(): Promise<{
  snapshot: DailySnapshot | null;
  topPositive: CategoryBreakdown[];
  topNegative: CategoryBreakdown[];
  newsItems: NewsItem[];
  sources: Source[];
}> {
  const supabase = createServerClient();
  const today = todayJst();

  // 今日のスナップショットを取得。なければ最新のものを使う
  let { data: snapshot } = await supabase
    .from("daily_snapshots")
    .select("*")
    .eq("day", today)
    .maybeSingle();

  if (!snapshot) {
    const { data: latest } = await supabase
      .from("daily_snapshots")
      .select("*")
      .order("day", { ascending: false })
      .limit(1)
      .maybeSingle();
    snapshot = latest;
  }

  const { data: sources } = await supabase
    .from("sources")
    .select("id, name, url, enabled")
    .eq("enabled", true)
    .order("name");

  // スナップショットが昨日以前のフォールバックの場合もその日のデータを使う
  const targetDay = snapshot?.day ?? today;
  const todayStart = `${targetDay}T00:00:00+09:00`;
  const todayEnd = `${targetDay}T23:59:59+09:00`;

  const { data: todayItems } = await supabase
    .from("items")
    .select("id, title, url, score, category, sentiment")
    .not("analyzed_at", "is", null)
    .gte("published_at", todayStart)
    .lte("published_at", todayEnd);

  const { data: todayFetched } = await supabase
    .from("items")
    .select("id, title, url, score, category, sentiment")
    .not("analyzed_at", "is", null)
    .is("published_at", null)
    .gte("fetched_at", todayStart)
    .lte("fetched_at", todayEnd);

  const allItems = [...(todayItems ?? []), ...(todayFetched ?? [])];

  // スコアの絶対値が大きい順（ネガ・ポジを上位に、ニュートラルは末尾）
  const newsItems: NewsItem[] = [...allItems]
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

  const posiMap: Record<string, number> = {};
  const negaMap: Record<string, number> = {};

  for (const it of allItems) {
    const cat = (it.category as Category) ?? "other";
    if (it.score > 0) posiMap[cat] = (posiMap[cat] ?? 0) + it.score;
    else if (it.score < 0) negaMap[cat] = (negaMap[cat] ?? 0) + Math.abs(it.score);
  }

  const topPositive: CategoryBreakdown[] = Object.entries(posiMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([category, points]) => ({ category: category as Category, points }));

  const topNegative: CategoryBreakdown[] = Object.entries(negaMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([category, points]) => ({ category: category as Category, points }));

  return {
    snapshot: (snapshot as DailySnapshot) ?? null,
    topPositive,
    topNegative,
    newsItems,
    sources: (sources as Source[]) ?? [],
  };
}

function formatJst(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function HomePage() {
  const { snapshot, topPositive, topNegative, newsItems, sources } = await getData();

  // メイン表示は daily_snapshots を正とする
  const positivePoints = snapshot?.positive_points ?? 0;
  const negativePoints = snapshot?.negative_points ?? 0;
  const total = positivePoints + negativePoints;
  const posiPct = total > 0 ? Math.round((positivePoints / total) * 100) : 50;
  const negaPct = 100 - posiPct;
  const isPositiveWin = (snapshot?.net_score ?? 0) >= 0;
  const sourcesCount = snapshot?.sources_count ?? sources.length;

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-10">
      {/* ヘッダー */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">ポジネガ指数</h1>
          <p className="text-[0.963rem] text-gray-400 mt-1">
            今の日本の気持ち
          </p>
        </div>
        <div className="text-right text-xs text-gray-400 shrink-0 ml-4 mt-1">
          <div className="font-medium text-gray-300">最終更新</div>
          {snapshot?.updated_at ? (
            <div>{formatJst(snapshot.updated_at)}</div>
          ) : (
            <div>—</div>
          )}
          <div className="text-gray-600 text-[10px] mt-0.5">毎日更新</div>
        </div>
      </header>

      {/* 綱引き画像（/public/tug.png を配置してください） */}
      <div className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/tug.png"
          alt="綱引き"
          width={400}
          height={200}
          className="rounded-xl opacity-80"
          style={{ display: "block" }}
          
        />
      </div>

      {/* メイン：勝敗表示 */}
      <section className="text-center space-y-4">
        {isPositiveWin ? (
          <div className="text-5xl font-black text-green-400 drop-shadow-lg">
            ポジ優勢
          </div>
        ) : (
          <div className="text-5xl font-black text-red-400 drop-shadow-lg">
            ネガ優勢
          </div>
        )}
        <div className="text-3xl font-bold text-gray-300">
          ポジ{" "}
          <span className="text-green-400">{posiPct}%</span>
          {" "}／ ネガ{" "}
          <span className="text-red-400">{negaPct}%</span>
        </div>

        {/* 綱引きバー */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm font-semibold">
            <span className="text-green-400">ポジティブ</span>
            <span className="text-red-400">ネガティブ</span>
          </div>
          <div className="flex h-10 rounded-full overflow-hidden shadow-lg border border-gray-800">
            <div
              className="bg-green-500 flex items-center justify-end pr-3 transition-all duration-700"
              style={{ width: `${posiPct}%` }}
            >
              <span className="text-white font-black text-sm">{posiPct}%</span>
            </div>
            <div
              className="bg-red-500 flex items-center justify-start pl-3 transition-all duration-700"
              style={{ width: `${negaPct}%` }}
            >
              <span className="text-white font-black text-sm">{negaPct}%</span>
            </div>
          </div>
        </div>
      </section>

      {/* 内訳TOP3 */}
      {(topPositive.length > 0 || topNegative.length > 0) && (
        <section className="grid grid-cols-2 gap-4">
          {/* ポジ内訳 */}
          <div className="bg-green-950/40 border border-green-900/50 rounded-xl p-4">
            <h3 className="text-xs font-bold text-green-400 mb-2 uppercase tracking-wider">
              ポジ内訳 TOP3
            </h3>
            {topPositive.length > 0 ? (
              <ol className="space-y-1">
                {topPositive.map((item, i) => (
                  <li key={item.category} className="flex items-center gap-2">
                    <span className="text-green-600 text-xs font-bold w-4">
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-200">
                      {CATEGORY_LABEL[item.category]}
                    </span>
                    <span className="ml-auto text-xs text-green-500 font-mono">
                      +{item.points}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-gray-600">データなし</p>
            )}
          </div>

          {/* ネガ内訳 */}
          <div className="bg-red-950/40 border border-red-900/50 rounded-xl p-4">
            <h3 className="text-xs font-bold text-red-400 mb-2 uppercase tracking-wider">
              ネガ内訳 TOP3
            </h3>
            {topNegative.length > 0 ? (
              <ol className="space-y-1">
                {topNegative.map((item, i) => (
                  <li key={item.category} className="flex items-center gap-2">
                    <span className="text-red-600 text-xs font-bold w-4">
                      {i + 1}
                    </span>
                    <span className="text-sm text-gray-200">
                      {CATEGORY_LABEL[item.category]}
                    </span>
                    <span className="ml-auto text-xs text-red-500 font-mono">
                      -{item.points}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-gray-600">データなし</p>
            )}
          </div>
        </section>
      )}

      {/* 本日のニュース一覧 */}
      {newsItems.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-gray-400">
            本日のニュース
            <span className="ml-2 text-gray-600 font-normal">{newsItems.length}件</span>
          </h2>
          <ul className="space-y-2">
            {newsItems.map((item) => {
              const isPos = item.sentiment === "positive";
              const isNeg = item.sentiment === "negative";
              const prefix = isPos ? "好材料：" : isNeg ? "懸念：" : "";
              const dotColor = isPos
                ? "bg-green-500"
                : isNeg
                ? "bg-red-500"
                : "bg-gray-600";
              const prefixColor = isPos ? "text-green-400" : "text-red-400";
              return (
                <li key={item.id} className="flex items-start gap-2 text-sm">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                  <div className="min-w-0">
                    <span className={`text-[10px] font-bold uppercase tracking-wider mr-1 ${prefixColor}`}>
                      {CATEGORY_LABEL[item.category]}
                    </span>
                    {prefix && (
                      <span className={`text-xs font-semibold mr-0.5 ${prefixColor}`}>
                        {prefix}
                      </span>
                    )}
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-300 hover:text-white underline decoration-gray-700 hover:decoration-gray-400 transition-colors break-words"
                    >
                      {item.title}
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* エビデンス */}
      <section className="border-t border-gray-800 pt-6 space-y-2 text-center">
        <p className="text-gray-400 text-sm leading-relaxed">
          {sourcesCount}以上のニュースソースから最新記事を収集しAIが分析。<br />
          日本国内ニュースのポジティブ / ネガティブのバランスを指数化しています。<br />
          <span className="text-xs text-gray-600">分析対象：最新100件　※指数は一日一回更新されます</span>
        </p>
      </section>

      {/* ソース一覧 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-400">
            情報ソース一覧
            <span className="ml-2 text-gray-600 font-normal">
              {sources.length}件
            </span>
          </h2>
          <Link
            href="/sources"
            className="text-xs text-blue-400 hover:text-blue-300 underline"
          >
            一覧ページ →
          </Link>
        </div>
        <div className="text-xs text-gray-500 leading-relaxed flex flex-wrap gap-x-3 gap-y-1">
          {sources.map((s) => (
            <a
              key={s.id}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-300 underline decoration-gray-700 hover:decoration-gray-400 transition-colors"
            >
              {s.name}
            </a>
          ))}
        </div>
      </section>

      {/* フッター */}
      <footer className="border-t border-gray-800 mt-12 pt-10 pb-6 text-center space-y-6">
        {/* タイトル・説明 */}
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-300">ポジネガ指数</p>
          <p className="text-xs text-gray-500">
            今の日本の気持ちをニュースから可視化するAI分析サービス
          </p>
        </div>

        {/* リンク */}
        <nav className="flex justify-center gap-6 text-xs text-gray-500">
          <a href="/about" className="hover:text-gray-300 transition-colors">About</a>
          <a href="/methodology" className="hover:text-gray-300 transition-colors">Methodology</a>
          <a href="/sources" className="hover:text-gray-300 transition-colors">Sources</a>
        </nav>

        {/* 免責 */}
        <div className="space-y-1">
          <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">免責</p>
          <p className="text-[11px] text-gray-600 leading-relaxed max-w-md mx-auto">
            本サイトは各ニュースサイトが公開しているRSSフィードを利用して記事タイトルを取得し、
            AIによる感情分析結果を表示しています。
            記事の著作権は各ニュースメディアに帰属し、本サイトは記事本文の転載を行っていません。
          </p>
        </div>

        {/* コピーライト */}
        <p className="text-[11px] text-gray-700">
          © 2026 Posinega Index &nbsp;·&nbsp; Data updated hourly
        </p>
      </footer>
    </main>
  );
}
