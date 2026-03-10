export type Sentiment = "positive" | "neutral" | "negative";
export type Intensity = "weak" | "medium" | "strong";
export type Category =
  | "economy"
  | "politics"
  | "world"
  | "disaster"
  | "crime"
  | "health"
  | "tech"
  | "society"
  | "entertainment"
  | "other";

export interface Source {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  created_at: string;
}

export interface Item {
  id: string;
  source_id: string;
  title: string;
  url: string;
  published_at: string | null;
  fetched_at: string;
  sentiment: Sentiment;
  intensity: Intensity;
  category: Category;
  score: number;
  analyzed_at: string | null;
}

export interface DailySnapshot {
  day: string;
  positive_points: number;
  negative_points: number;
  net_score: number;
  items_count: number;
  sources_count: number;
  updated_at: string;
}

export interface AiJudgment {
  sentiment: Sentiment;
  intensity: Intensity;
  category: Category;
}

export interface CategoryBreakdown {
  category: Category;
  points: number;
}

export interface TodaySummary {
  snapshot: DailySnapshot | null;
  topPositive: CategoryBreakdown[];
  topNegative: CategoryBreakdown[];
  sources: Source[];
}
