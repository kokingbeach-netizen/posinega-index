import { createServerClient } from "@/lib/supabase";
import type { Source } from "@/lib/types";
import Link from "next/link";

export const revalidate = 300; // 5分

async function getSources(): Promise<Source[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("sources")
    .select("*")
    .eq("enabled", true)
    .order("name");
  return (data as Source[]) ?? [];
}

export default async function SourcesPage() {
  const sources = await getSources();

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <Link
            href="/"
            className="text-xs text-gray-500 hover:text-gray-300 mb-2 block"
          >
            ← ホームへ
          </Link>
          <h1 className="text-2xl font-black">情報ソース一覧</h1>
          <p className="text-sm text-gray-400 mt-1">
            監視中：
            <span className="font-bold text-white">{sources.length}</span>{" "}
            件のRSSフィード
          </p>
        </div>
      </header>

      <p className="text-xs text-gray-500 bg-gray-900 border border-gray-800 rounded-lg p-4">
        以下のRSS/Atomフィード（公式提供）からAIがタイトルを分析し、ポジネガ指数を算出しています。
        記事本文の取得・保存は行っていません。
      </p>

      <ul className="divide-y divide-gray-800">
        {sources.map((s) => (
          <li key={s.id} className="py-3 flex items-center justify-between gap-4">
            <span className="text-sm text-gray-200 font-medium shrink-0">
              {s.name}
            </span>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 underline break-all text-right"
            >
              {s.url}
            </a>
          </li>
        ))}
      </ul>

      {sources.length === 0 && (
        <p className="text-gray-600 text-sm text-center py-12">
          ソースが登録されていません。seed スクリプトを実行してください。
        </p>
      )}
    </main>
  );
}
