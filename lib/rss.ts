import Parser from "rss-parser";
import type { Source } from "./types";

interface RssItem {
  title: string;
  link: string;
  pubDate?: string;
  isoDate?: string;
}

const parser = new Parser({ timeout: 10000 });

export async function fetchRssItems(
  source: Source,
  maxItems = 20
): Promise<RssItem[]> {
  try {
    const feed = await parser.parseURL(source.url);
    return (feed.items ?? []).slice(0, maxItems).map((item) => ({
      title: (item.title ?? "").trim(),
      link: item.link ?? item.guid ?? "",
      pubDate: item.pubDate,
      isoDate: item.isoDate,
    }));
  } catch (err) {
    console.error(`[rss] fetch error: ${source.url}`, err);
    return [];
  }
}
