/**
 * Supabase sources テーブルに初期データを投入するスクリプト
 * 実行: npm run seed
 *
 * .env.local または .env に
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 * が設定されている必要があります。
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SOURCES = [
  // ────────── 主要ニュース ──────────
  { name: "NHKニュース", url: "https://www.nhk.or.jp/rss/news/cat0.xml" },
  { name: "NHKニュース（社会）", url: "https://www.nhk.or.jp/rss/news/cat1.xml" },
  { name: "NHKニュース（経済）", url: "https://www.nhk.or.jp/rss/news/cat3.xml" },
  { name: "NHKニュース（政治）", url: "https://www.nhk.or.jp/rss/news/cat4.xml" },
  { name: "NHKニュース（国際）", url: "https://www.nhk.or.jp/rss/news/cat6.xml" },
  { name: "NHKニュース（科学文化）", url: "https://www.nhk.or.jp/rss/news/cat5.xml" },
  { name: "読売新聞（最新ニュース）", url: "https://www.yomiuri.co.jp/feed/" },
  { name: "朝日新聞デジタル", url: "https://rss.asahi.com/rss/asahi/newsheadlines.rdf" },
  { name: "毎日新聞", url: "https://mainichi.jp/rss/articles.rss" },
  { name: "産経ニュース", url: "https://www.sankei.com/rss/news/flash/flash.xml" },
  { name: "日本経済新聞", url: "https://www.nikkei.com/rss/news.rdf" },
  { name: "東京新聞", url: "https://www.tokyo-np.co.jp/rss/index.xml" },

  // ────────── 経済・ビジネス ──────────
  { name: "ロイター（日本語）", url: "https://feeds.reuters.com/reuters/JPTopNews" },
  { name: "Bloomberg Japan", url: "https://feeds.bloomberg.com/markets/news.rss" },
  { name: "東洋経済オンライン", url: "https://toyokeizai.net/list/feed/rss" },
  { name: "ダイヤモンドオンライン", url: "https://diamond.jp/list/feed/rss" },
  { name: "プレジデントオンライン", url: "https://president.jp/list/feed/rss" },

  // ────────── テック・IT ──────────
  { name: "ITmedia NEWS", url: "https://rss.itmedia.co.jp/rss/2.0/itmedia_news.xml" },
  { name: "Impress Watch", url: "https://www.watch.impress.co.jp/data/rss/1.0/ipw/feed.rdf" },
  { name: "GIGAZINE", url: "https://gigazine.net/news/rss_2.0/" },
  { name: "TechCrunch Japan", url: "https://jp.techcrunch.com/feed/" },
  { name: "ASCII.jp", url: "https://ascii.jp/rss.xml" },
  { name: "ZDNet Japan", url: "https://japan.zdnet.com/rss/index.rdf" },
  { name: "Engadget 日本版", url: "https://japanese.engadget.com/rss.xml" },

  // ────────── 国際・外交 ──────────
  { name: "共同通信（英語）", url: "https://nordot.app/g/kyodo_english/feed.json" },
  { name: "時事通信", url: "https://www.jiji.com/rss/ranking.rdf" },

  // ────────── 政府・公的機関 ──────────
  { name: "首相官邸（ニュース）", url: "https://www.kantei.go.jp/jp/rss/news.rdf" },
  { name: "内閣府", url: "https://www.cao.go.jp/rss/news.xml" },

  // ────────── エンタメ・社会 ──────────
  { name: "スポニチ", url: "https://www.sponichi.co.jp/rss/news/baseball/npb.rdf" },
  { name: "ORICON NEWS", url: "https://www.oricon.co.jp/rss/music/news/" },
];

async function main() {
  console.log(`Seeding ${SOURCES.length} sources...`);

  const { data, error } = await supabase.from("sources").upsert(
    SOURCES.map((s) => ({ ...s, enabled: true })),
    { onConflict: "url", ignoreDuplicates: false }
  );

  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }

  console.log("Done! Sources seeded:", SOURCES.length);
}

main().catch(console.error);
