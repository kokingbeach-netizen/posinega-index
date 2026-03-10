# ポジネガ指数

多数の情報源（RSS/公式フィード）をAIで分析し、「いまポジかネガか」を一発で分かる指標として表示するWebアプリ。

## スタック

- **フレームワーク**: Next.js 14 (App Router) + TypeScript
- **スタイリング**: Tailwind CSS
- **DB**: Supabase (PostgreSQL)
- **RSS**: rss-parser
- **Cron**: Vercel Cron（毎時0分）
- **AI判定**: OpenAI API（未設定時はルールベース）

---

## 1. Supabase セットアップ

1. [Supabase](https://supabase.com/) でプロジェクトを新規作成
2. SQL エディタを開き、`schema.sql` の内容を全て貼り付けて実行

```sql
-- schema.sql の内容をそのまま実行してください
```

---

## 2. 環境変数

`.env.example` を `.env.local` にコピーして値を設定:

```bash
cp .env.example .env.local
```

| 変数名 | 必須 | 説明 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public キー |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service_role キー（サーバーサイド専用） |
| `CRON_SECRET` | ✅ | Cron 保護シークレット（任意文字列） |
| `OPENAI_API_KEY` | - | 設定するとOpenAI(gpt-4o-mini)で判定 |
| `OPENAI_MODEL` | - | モデル名（省略時: `gpt-4o-mini`） |

> **注意**: `SUPABASE_SERVICE_ROLE_KEY` は絶対に公開しないでください。

Supabase のキーは「Project Settings > API」から確認できます。

---

## 3. ローカル起動

```bash
# 依存インストール
npm install

# 開発サーバー起動
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開く。

---

## 4. 初期データ投入（seed）

Supabase に RSS ソースを登録:

```bash
npm run seed
```

30件のソースが登録されます。

---

## 5. 手動でCronを実行（ローカル確認）

```bash
curl -X POST http://localhost:3000/api/cron/run \
  -H "x-cron-secret: your-secret-here"
```

成功すると以下のようなJSONが返ります:

```json
{
  "ok": true,
  "sources_count": 30,
  "items_new": 400,
  "items_analyzed": 100,
  "net_score": 12,
  "positive_points": 45,
  "negative_points": 33
}
```

---

## 6. Vercel デプロイ

```bash
# Vercel CLI でデプロイ
npx vercel --prod
```

**Vercel 環境変数の設定**:
Vercel ダッシュボード → Settings → Environment Variables に `.env.local` の値を全て追加。

**Cron の有効化**:
`vercel.json` にすでに設定済みです。Vercel Pro プランで毎時0分に `/api/cron/run` が自動実行されます。

```json
{
  "crons": [{ "path": "/api/cron/run", "schedule": "0 * * * *" }]
}
```

> 無料プランでは Cron は1日1回まで。毎時更新には Pro プランが必要です。

---

## 7. tug.png（綱引き画像）

`/public/tug.png` に綱引きのイラストを配置してください。
画像がない場合もアプリは動作します（画像エリアが空白になるだけ）。

---

## API エンドポイント

| エンドポイント | メソッド | 説明 |
|---|---|---|
| `/api/health` | GET | 死活確認（常に200） |
| `/api/cron/run` | POST | Cronジョブ（`x-cron-secret` ヘッダ必須） |
| `/api/summary/today` | GET | 今日のスナップショット取得 |

---

## データフロー

```
毎時0分
  ↓ Vercel Cron
POST /api/cron/run
  ↓
1. sources（enabled=true）取得
2. 各RSS フェッチ（各ソース最大20件）
3. items テーブルに upsert（URL でユニーク）
4. 未分析 items を最大100件 AI判定
5. sentiment / intensity / category / score を保存
6. 当日(JST)の集計 → daily_snapshots upsert
```

---

## ルール・注意事項

- RSS/Atom/XML など公式に提供されるフィードのみ取得（スクレイピング禁止）
- 記事本文の転載・保存なし（タイトル・URL・判定結果のみ）
- MVPはログイン不要
