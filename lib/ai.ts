/**
 * AI 判定モジュール
 * 優先順: OpenAI → ルールベース
 * 将来的に Gemini も追加可能
 */

import type { AiJudgment, Category, Intensity, Sentiment } from "./types";

// =====================
// ルールベースフォールバック
// =====================

// ---- ネガティブ ----

const NEGATIVE_STRONG = [
  // 人的被害
  "死亡", "死者", "殺人", "殺害", "重体", "行方不明", "自殺", "虐待",
  // 災害・事件
  "爆発", "爆撃", "大地震", "大津波", "津波", "壊滅", "大火災",
  // 安全保障
  "テロ", "戦争", "侵攻", "核攻撃", "崩壊", "破綻",
];
const NEGATIVE_MEDIUM = [
  // 事件・事故
  "事故", "火災", "逮捕", "起訴", "書類送検", "家宅捜索", "摘発",
  "強盗", "暴行", "詐欺", "脱税", "ひき逃げ", "不審火",
  // 企業・経済
  "不正", "不祥事", "倒産", "廃業", "破産", "暴落", "急落", "大幅下落",
  "業績悪化", "赤字転落", "リストラ", "大量解雇", "撤退", "閉鎖",
  "リコール", "欠陥", "回収", "値上げ", "物価高",
  // 政治・社会
  "辞任", "更迭", "罷免", "否決", "廃案", "疑惑", "スキャンダル",
  "汚職", "違反", "違法", "差別", "ハラスメント", "中止",
  // 状況悪化
  "悪化", "危機", "感染拡大", "クラスター", "被害", "停止", "中断",
  "反発", "抗議", "衝突", "対立", "制裁", "報復",
];
const NEGATIVE_WEAK = [
  // 数値下落
  "減少", "下落", "下降", "下げ", "マイナス", "低下", "縮小",
  "損失", "遅延", "失敗", "困難", "停滞", "鈍化", "横ばい",
  // 状況・懸念
  "不安", "懸念", "リスク", "警戒", "注意報", "課題", "批判",
  "問題", "延期", "見直し", "赤字",
];

// ---- ポジティブ ----

const POSITIVE_STRONG = [
  // 業績・経済
  "大幅増", "躍進", "最高益", "過去最高", "大幅黒字", "記録更新",
  // 社会・歴史
  "歴史的", "快挙", "大成功", "大幅回復", "飛躍",
  // スポーツ
  "優勝", "初優勝", "日本一", "世界一", "金メダル", "世界新記録", "新記録",
];
const POSITIVE_MEDIUM = [
  // 経済・企業
  "改善", "成長", "成功", "増収", "増益", "好決算", "黒字", "増加",
  "拡大", "上昇", "好調", "回復", "賃上げ", "値下げ", "増配",
  // 合意・制度
  "合意", "締結", "調印", "可決", "成立", "承認", "認可", "解決",
  "和解", "解禁", "再開", "復活",
  // 人・社会
  "受賞", "表彰", "当選", "合格", "就任", "救助", "救出", "退院",
  "復帰", "復興", "発展", "達成", "前進",
  // テック・市場
  "実用化", "商用化", "上場", "IPO", "特許取得", "高値", "最高値", "最高水準",
  // スポーツ
  "勝利", "逆転", "快勝", "連勝", "全勝", "準優勝", "決勝進出",
  "突破", "ホームラン", "サヨナラ", "完封", "完投",
];
const POSITIVE_WEAK = [
  // 状況
  "上向き", "プラス", "強化", "充実", "安定", "順調", "好評",
  "活性", "整備", "開始", "スタート", "導入", "採用",
  // スポーツ・イベント
  "観戦", "応援", "粘り", "粘投", "好投", "好守", "活躍", "奮闘",
  // 感情・期待
  "心躍", "熱望", "喜び", "歓喜", "感動", "歓迎", "朗報",
  // お得・割引
  "割引", "セール", "特価", "お得", "安値", "最安",
];

const CATEGORY_KEYWORDS: Array<[Category, string[]]> = [
  ["economy",  [
    "経済", "株価", "株式", "景気", "GDP", "為替", "円安", "円高", "ドル", "物価",
    "賃金", "賃上げ", "値上げ", "値下げ", "倒産", "破産", "廃業", "決算", "増収",
    "増益", "赤字", "黒字", "上場", "IPO", "投資", "金融", "銀行", "日銀", "利上げ",
    "利下げ", "インフレ", "デフレ", "消費税", "関税", "貿易赤字", "企業",
  ]],
  ["politics", [
    "政府", "国会", "首相", "総理", "大臣", "議員", "選挙", "内閣", "自民", "立民",
    "公明", "維新", "共産", "国民民主", "予算", "法案", "規制", "政策", "与党",
    "野党", "可決", "否決", "廃案", "辞任", "更迭", "罷免", "解散",
  ]],
  ["world",    [
    "米国", "アメリカ", "中国", "ロシア", "韓国", "北朝鮮", "EU", "NATO", "国連",
    "外交", "制裁", "貿易", "G7", "G20", "国際", "ウクライナ", "中東", "イスラエル",
    "パレスチナ", "台湾", "インド", "トランプ", "バイデン", "習近平", "プーチン",
  ]],
  ["disaster", [
    "地震", "台風", "洪水", "豪雨", "大雨", "火災", "土砂", "津波", "被害", "避難",
    "災害", "爆発", "停電", "断水", "浸水", "崖崩れ", "噴火", "竜巻", "熱波",
  ]],
  ["crime",    [
    "逮捕", "起訴", "書類送検", "容疑", "殺人", "詐欺", "窃盗", "強盗", "暴行",
    "不正", "不祥事", "横領", "汚職", "脱税", "摘発", "家宅捜索", "ひき逃げ",
    "虐待", "ハラスメント", "差別",
  ]],
  ["health",   [
    "コロナ", "ウイルス", "感染", "ワクチン", "医療", "病院", "薬", "治療", "手術",
    "厚労省", "がん", "健康", "感染症", "クラスター", "重症", "退院", "新薬", "承認",
  ]],
  ["tech",     [
    "AI", "人工知能", "テック", "IT", "半導体", "スタートアップ", "宇宙", "ロケット",
    "研究", "科学", "特許", "量子", "EV", "電気自動車", "自動運転", "データ",
    "サイバー", "セキュリティ", "メタバース", "ChatGPT", "生成AI",
  ]],
  ["society",  [
    "教育", "学校", "大学", "労働", "雇用", "人口", "少子化", "高齢", "福祉",
    "社会保障", "子育て", "移民", "外国人", "格差", "貧困", "ジェンダー", "LGBT",
    "環境", "気候変動", "カーボン", "脱炭素",
  ]],
  ["entertainment", [
    "映画", "音楽", "ライブ", "コンサート", "芸能", "ゲーム", "アニメ", "文化",
    "観光", "スポーツ", "野球", "サッカー", "バスケ", "テニス", "ゴルフ",
    "五輪", "オリンピック", "パラリンピック", "WBC", "ラグビー", "卓球",
    "柔道", "相撲", "陸上", "水泳", "スキー", "観戦", "選手", "監督",
  ]],
];

function matchKeywords(title: string, keywords: string[]): boolean {
  return keywords.some((kw) => title.includes(kw));
}

function detectCategory(title: string): Category {
  for (const [cat, keywords] of CATEGORY_KEYWORDS) {
    if (matchKeywords(title, keywords)) return cat;
  }
  return "other";
}

function ruleBasedJudge(title: string): AiJudgment {
  const category = detectCategory(title);

  if (matchKeywords(title, NEGATIVE_STRONG)) {
    return { sentiment: "negative", intensity: "strong", category };
  }
  if (matchKeywords(title, NEGATIVE_MEDIUM)) {
    return { sentiment: "negative", intensity: "medium", category };
  }
  if (matchKeywords(title, NEGATIVE_WEAK)) {
    return { sentiment: "negative", intensity: "weak", category };
  }
  if (matchKeywords(title, POSITIVE_STRONG)) {
    return { sentiment: "positive", intensity: "strong", category };
  }
  if (matchKeywords(title, POSITIVE_MEDIUM)) {
    return { sentiment: "positive", intensity: "medium", category };
  }
  if (matchKeywords(title, POSITIVE_WEAK)) {
    return { sentiment: "positive", intensity: "weak", category };
  }

  return { sentiment: "neutral", intensity: "weak", category };
}

// =====================
// OpenAI 判定
// =====================

const SYSTEM_PROMPT = `あなたはニュース記事のタイトルからポジティブ/ネガティブを判定するAIです。
必ずJSONのみで返答してください。他の文章は一切不要です。

出力形式:
{"sentiment":"positive|neutral|negative","intensity":"weak|medium|strong","category":"economy|politics|world|disaster|crime|health|tech|society|entertainment|other"}

判断基準:
- negative: 被害/事故/犯罪/不祥事/倒産/戦争/危機/悪化/死亡/逮捕
- positive: 改善/成長/成功/合意/回復/技術進展/賃上げ/好決算/達成
- neutral: 発表/予定/解説など感情が薄いもの/釣り見出し
- 強度(weak/medium/strong)は規模・影響の大きさで判断`;

async function openAiJudge(
  title: string,
  sourceName: string
): Promise<AiJudgment | null> {
  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

    const res = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `ソース: ${sourceName}\nタイトル: ${title}` },
      ],
      max_tokens: 100,
      temperature: 0,
    });

    const text = res.choices[0]?.message?.content?.trim() ?? "";
    const json = JSON.parse(text) as AiJudgment;

    // バリデーション
    const sentiments: Sentiment[] = ["positive", "neutral", "negative"];
    const intensities: Intensity[] = ["weak", "medium", "strong"];
    if (
      !sentiments.includes(json.sentiment) ||
      !intensities.includes(json.intensity) ||
      !json.category
    ) {
      return null;
    }
    return json;
  } catch {
    return null;
  }
}

// =====================
// メインエクスポート
// =====================

export async function judgeItem(
  title: string,
  sourceName: string
): Promise<AiJudgment> {
  if (process.env.OPENAI_API_KEY) {
    const result = await openAiJudge(title, sourceName);
    if (result) return result;
    // OpenAI失敗 → ルールベースにフォールバック
    console.warn("[ai] OpenAI failed, falling back to rule-based");
  }

  return ruleBasedJudge(title);
}
