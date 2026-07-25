import {
  cashFromResults,
  type AsiaClassBucket,
  type AsiaClassStats,
  type AsiaPlayer,
  type AsiaResult,
  type AsiaTourStanding,
} from "./asia";

export type AsiaPlayerProfile = AsiaPlayer & {
  wins_ledger: AsiaResult[];
  by_year: Array<{
    year: string;
    events: number;
    wins: number;
    podiums: number;
    top10: number;
    pdga_points: number;
    avg_finish: number | null;
  }>;
  pdga_url: string;
  by_class: Partial<Record<AsiaClassBucket, AsiaClassStats>>;
  /** Official PDGA career header (full tour, not Asia-only). */
  pdga_career?: {
    rating: number | null;
    career_events: number | null;
    career_wins: number | null;
    classification: string | null;
    city: string | null;
    state_prov: string | null;
    country: string | null;
    membership_status: string | null;
  };
  /** Joined from board tour standings when available. */
  tour_standing?: AsiaTourStanding | null;
};

const profileModules = import.meta.glob("../data/asia/players/*.json") as Record<
  string,
  () => Promise<{ default: AsiaPlayerProfile } | AsiaPlayerProfile>
>;

export async function loadAsiaProfile(
  pdga: number | string,
): Promise<AsiaPlayerProfile | null> {
  const key = `../data/asia/players/${pdga}.json`;
  const loader = profileModules[key];
  if (!loader) return null;
  const mod = await loader();
  return ("default" in mod ? mod.default : mod) as AsiaPlayerProfile;
}

export type AsiaClassView = "open_mpo" | "open_fpo" | "amateur" | "all";

export function defaultClassView(player: AsiaPlayerProfile): AsiaClassView {
  const primary = player.primary_class;
  if (primary === "open_mpo" || primary === "open_fpo" || primary === "amateur") {
    return primary;
  }
  if (player.division === "FPO") return "open_fpo";
  if (player.division === "MPO") return "open_mpo";
  if ((player.am_events ?? 0) > 0) return "amateur";
  return "all";
}

export function filterResults(results: AsiaResult[], view: AsiaClassView) {
  if (view === "all") return results;
  return results.filter((r) => (r.class_bucket || "") === view);
}

export function statsForView(player: AsiaPlayerProfile, view: AsiaClassView): AsiaClassStats {
  const from = player.by_class?.[view];
  if (from) return from;
  const rows = filterResults(player.results || [], view);
  const events = rows.length;
  const wins = rows.filter((r) => r.place === 1).length;
  const podiums = rows.filter((r) => r.place <= 3).length;
  const top5 = rows.filter((r) => r.place <= 5).length;
  const top10 = rows.filter((r) => r.place <= 10).length;
  const top20 = rows.filter((r) => r.place <= 20).length;
  const places = rows.map((r) => r.place);
  return {
    events,
    wins,
    podiums,
    top5,
    top10,
    top20,
    pdga_points: rows.reduce((s, r) => s + (r.pdga_points || 0), 0),
    tour_weighted_points: rows.reduce((s, r) => s + (r.weighted_points || 0), 0),
    avg_finish: places.length
      ? Math.round((places.reduce((a, b) => a + b, 0) / places.length) * 100) / 100
      : null,
    win_rate: events ? wins / events : 0,
    top10_rate: events ? top10 / events : 0,
  };
}

export function cashForView(player: AsiaPlayerProfile, view: AsiaClassView): number {
  const rows = filterResults(player.results || [], view);
  if (view === "all" && player.cash_earned != null) return player.cash_earned;
  return cashFromResults(rows);
}

const TIER_LABELS: Record<string, string> = {
  major: "Major",
  elite: "Elite",
  asia_tour: "Asia Tour",
  a_tier: "A-tier",
  b_tier: "B-tier",
  c_tier: "C-tier",
};

export function tierMixRows(byLevel: AsiaPlayer["by_level"] | undefined) {
  if (!byLevel) return [];
  return Object.entries(byLevel)
    .map(([key, stats]) => ({
      key,
      label: TIER_LABELS[key] || key,
      events: stats?.events ?? 0,
      wins: stats?.wins ?? 0,
      points: stats?.points ?? 0,
    }))
    .filter((r) => r.events > 0)
    .sort((a, b) => b.events - a.events);
}

export function geographyFromResults(results: AsiaResult[]) {
  const counts = new Map<string, number>();
  for (const r of results) {
    const loc = (r.location || "").trim();
    if (!loc) continue;
    const country = loc.split(",").map((s) => s.trim()).filter(Boolean).at(-1) || loc;
    counts.set(country, (counts.get(country) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([country, events]) => ({ country, events }))
    .sort((a, b) => b.events - a.events);
}

export function activityStrip(player: AsiaPlayerProfile) {
  const years = [...(player.by_year || [])].sort((a, b) => b.year.localeCompare(a.year));
  const latest = years[0];
  const prev = years[1];
  const eventsDelta =
    latest && prev ? latest.events - prev.events : null;
  const pointsDelta =
    latest && prev ? Math.round(latest.pdga_points - prev.pdga_points) : null;
  return {
    lastActive: player.last_active || "—",
    latestYear: latest?.year ?? null,
    eventsDelta,
    pointsDelta,
    countries: geographyFromResults(player.results || []).slice(0, 4),
  };
}

export function pdgaEventUrl(eventId: string) {
  return `https://www.pdga.com/tour/event/${eventId}`;
}
