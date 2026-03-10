import type { Intensity, Sentiment } from "./types";

const INTENSITY_POINT: Record<Intensity, number> = {
  weak: 1,
  medium: 2,
  strong: 3,
};

export function calcScore(sentiment: Sentiment, intensity: Intensity): number {
  const point = INTENSITY_POINT[intensity];
  if (sentiment === "positive") return point;
  if (sentiment === "negative") return -point;
  return 0;
}

/** JST の今日の日付文字列を返す（YYYY-MM-DD） */
export function todayJst(): string {
  const now = new Date();
  // JST = UTC+9
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}
