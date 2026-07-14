import type { Player, YearStat } from "./players";

export type FinishSummary = {
  events_tracked: number;
  wins: number;
  podiums: number;
  top5: number;
  top10: number;
  top20: number;
  win_rate: number;
  podium_rate: number;
  top10_rate: number;
  avg_place: number | null;
  best_place: number | null;
  place_histogram: Record<string, number>;
};

export type YearFinish = {
  year: string;
  events: number;
  wins: number;
  podiums: number;
  top5: number;
  top10: number;
  top20: number;
  avg_place: number | null;
};

export type ResultRow = {
  place?: number;
  points?: number;
  tournament: string;
  tier: string;
  dates: string;
  year: string | null;
  prize: number;
  event_url: string | null;
  division?: string;
  division_code?: string;
  class_bucket?: string;
};

export type WinRow = {
  dates: string;
  year: string | null;
  tournament: string;
  tier: string;
  prize: number;
  event_url: string | null;
  division?: string;
  division_code?: string;
  class_bucket?: string;
};

export type FinishSplit = {
  label: string;
  finishes: FinishSummary;
  year_finishes: YearFinish[];
  recent_results: ResultRow[];
  wins_list: WinRow[];
};

export type FinishBundle = {
  pdga_number: string;
  open_division?: "MPO" | "FPO";
  career: {
    career_events: number;
    career_wins: number;
    career_earnings: number;
    current_rating: number | null;
  };
  finishes: FinishSummary;
  year_finishes: YearFinish[];
  wins_list: WinRow[];
  rating_history: Array<{
    date: string;
    rating: number;
    rounds: number | null;
  }>;
  recent_results: ResultRow[];
  all_results_count: number;
  splits?: {
    open: FinishSplit;
    amateur: FinishSplit;
    all: FinishSplit;
  };
};

export type FinishView = "open" | "amateur" | "all";

export function getSplit(
  finishes: FinishBundle | null | undefined,
  view: FinishView,
): FinishSplit | null {
  if (!finishes) return null;
  if (finishes.splits?.[view]) return finishes.splits[view];
  // legacy fallback
  return {
    label: view === "open" ? finishes.open_division || "Open" : view,
    finishes: finishes.finishes,
    year_finishes: finishes.year_finishes,
    recent_results: finishes.recent_results,
    wins_list: finishes.wins_list,
  };
}

export function yearlySeries(stats: YearStat[]) {
  const byYear = new Map<
    string,
    {
      year: string;
      events: number;
      points: number;
      prize: number;
      rating: number | null;
      rounds: number;
    }
  >();

  for (const row of stats) {
    const year = row.year;
    if (!year) continue;
    // Prefer player's primary open division rows when available
    const prev = byYear.get(year) ?? {
      year,
      events: 0,
      points: 0,
      prize: 0,
      rating: null as number | null,
      rounds: 0,
    };
    prev.events += Number(row.tournaments || 0);
    prev.points += Number(row.points || 0);
    prev.prize += Number(row.prize || 0);
    prev.rounds += Number(row.rating_rounds_used || 0);
    const rating = Number(row.rating || 0);
    if (rating) prev.rating = Math.max(prev.rating ?? 0, rating);
    byYear.set(year, prev);
  }

  return [...byYear.values()].sort((a, b) => Number(a.year) - Number(b.year));
}

export function placeHistogramBars(summary?: FinishSummary | null) {
  if (!summary?.place_histogram) return [];
  const hist = summary.place_histogram;
  const bars: Array<{ label: string; count: number }> = [];
  for (let i = 1; i <= 10; i++) {
    bars.push({ label: String(i), count: hist[String(i)] ?? 0 });
  }
  const top20 = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20].reduce(
    (n, k) => n + (hist[String(k)] ?? 0),
    0,
  );
  bars.push({ label: "11-20", count: top20 });
  const rest = Object.entries(hist).reduce((n, [k, v]) => {
    const num = Number(k);
    return num > 20 ? n + v : n;
  }, 0);
  bars.push({ label: "21+", count: rest });
  return bars;
}

export function finishTrend(years?: YearFinish[] | null) {
  if (!years?.length) return [];
  return [...years]
    .filter((y) => y.events > 0 || y.wins > 0)
    .sort((a, b) => Number(a.year) - Number(b.year));
}

export function ratingTrend(finishes?: FinishBundle | null, player?: Player) {
  if (finishes?.rating_history?.length) {
    return [...finishes.rating_history]
      .reverse()
      .map((r) => ({
        label: r.date.replace(/^\d{1,2}-/, "").slice(-8),
        rating: r.rating,
      }));
  }
  return yearlySeries(player?.stats ?? []).map((y) => ({
    label: y.year,
    rating: y.rating ?? 0,
  }));
}
