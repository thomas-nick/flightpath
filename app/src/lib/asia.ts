import boardJson from "../data/asia/board.json";
import { getFlightpathIndex } from "./flightpath-rating";

export type AsiaClassBucket = "open_mpo" | "open_fpo" | "amateur" | "all" | "other";

export type AsiaClassStats = {
  events: number;
  wins: number;
  podiums: number;
  top5: number;
  top10: number;
  top20: number;
  pdga_points: number;
  tour_weighted_points: number;
  avg_finish: number | null;
  win_rate: number;
  top10_rate: number;
};

export type AsiaResult = {
  event_id: string;
  title: string;
  location: string;
  dates: string;
  year: string;
  tier: string;
  level: string;
  is_asia_tour: boolean;
  place: number;
  pdga_points: number;
  division?: string;
  class_bucket?: AsiaClassBucket;
  prize?: string;
  weighted_points?: number;
};

export type AsiaPlayer = {
  pdga: number;
  name: string;
  country: string;
  country_key: string;
  flag: string;
  rating: number | null;
  classification: string;
  city: string;
  nationality: string;
  division: string;
  primary_class?: string;
  pdga_rank: number;
  weighted_rank: number;
  country_rank?: number;
  tour_weighted_points: number;
  pdga_points: number;
  cash_earned?: number;
  events_played: number;
  wins: number;
  podiums: number;
  top5?: number;
  top10: number;
  top20?: number;
  avg_finish?: number | null;
  win_rate?: number;
  top10_rate?: number;
  am_events?: number;
  am_wins?: number;
  asia_tour_events: number;
  asia_tour_points: number;
  last_active: string;
  by_level: Record<string, { events: number; wins: number; points: number; weighted: number }>;
  by_class?: Partial<Record<AsiaClassBucket, AsiaClassStats>>;
  results: AsiaResult[];
  rating_history?: Array<{ date: string; rating: number; rounds: number }>;
  streak?: {
    direction: "up" | "down" | "flat";
    recent_avg: number;
    season_avg: number;
    delta_pct: number;
  };
  slug: string;
};

export type AsiaTourCountingFinish = {
  event_id: string;
  event: string;
  tour_event: string;
  division: string;
  place: number;
  points: number;
  dates: string;
};

export type AsiaTourStanding = {
  rank: number;
  pdga: number;
  name: string;
  flag: string;
  country: string;
  country_key: string;
  division: string;
  rating: number | null;
  events_played: number;
  total_points: number;
  counting?: AsiaTourCountingFinish[];
  all_results?: AsiaTourCountingFinish[];
  slug: string;
};

export type AsiaBoard = {
  title: string;
  description: string;
  updated_at: string;
  years: string[];
  countries: Array<{ key: string; name: string; flag: string }>;
  country_stats: Record<
    string,
    {
      key: string;
      name: string;
      flag: string;
      player_count: number;
      leader: AsiaPlayer | null;
    }
  >;
  country_champions: Array<{
    country_key: string;
    country: string;
    flag: string;
    player_count: number;
    leader_pdga: number;
    leader_name: string;
    leader_division: string;
    leader_rating: number | null;
    leader_points: number;
    leader_events: number;
    leader_wins: number;
  }>;
  tour_standings: AsiaTourStanding[];
  highlights: Record<string, unknown>;
  events: Array<{
    event_id: string;
    title: string;
    location: string;
    dates: string;
    year: string;
    tier: string;
    level: string;
    is_asia_tour: boolean;
    field_size: number;
  }>;
  total_events: number;
  total_players: number;
  players: AsiaPlayer[];
  scoring: {
    notes: string;
    asia_tour_official?: { rule: string };
  };
};

function slugify(name: string, pdga: number): string {
  const base = name
    .replace(/\s*#\d+\s*$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base}-${pdga}`;
}

/** Public slug helper — same scheme used for player profile routes. */
export function playerSlug(name: string, pdga: number): string {
  return slugify(name, pdga);
}

function withSlugs<T extends { pdga: number; name: string }>(row: T): T & { slug: string } {
  return { ...row, slug: slugify(row.name, row.pdga) };
}

const raw = boardJson as unknown as Omit<AsiaBoard, "players" | "tour_standings"> & {
  players: Array<Omit<AsiaPlayer, "slug">>;
  tour_standings: Array<Omit<AsiaTourStanding, "slug">>;
};

export const asiaBoard: AsiaBoard = {
  ...raw,
  players: (raw.players || []).map(withSlugs),
  tour_standings: (raw.tour_standings || []).map(withSlugs),
};

export function getAsiaBoard() {
  return asiaBoard;
}

export type AsiaSortMode =
  | "pdga"
  | "weighted"
  | "flightpath"
  | "rating"
  | "asia_tour"
  | "wins"
  | "podiums"
  | "top10_rate"
  | "events"
  | "form"
  | "cash";

export function parsePrizeUsd(prize?: string | null): number {
  if (!prize) return 0;
  const text = String(prize).trim();
  if (!text || text === "-" || text === "—" || /^n\/?a$/i.test(text)) return 0;
  const cleaned = text.replace(/,/g, "").replace(/[^\d.]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function cashFromResults(results: AsiaResult[] | undefined): number {
  if (!results?.length) return 0;
  return Math.round(results.reduce((sum, r) => sum + parsePrizeUsd(r.prize), 0) * 100) / 100;
}

export function formScore(streak?: AsiaPlayer["streak"] | null): number {
  return streak?.delta_pct ?? Number.NEGATIVE_INFINITY;
}

export function formatCash(n: number): string {
  if (!n) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function getAsiaPlayers(opts?: {
  division?: "all" | "MPO" | "FPO" | "Amateur";
  country?: string;
  sort?: AsiaSortMode;
}) {
  const division = opts?.division ?? "all";
  const country = opts?.country ?? "all";
  const sort = opts?.sort ?? "pdga";
  let players = [...asiaBoard.players];

  if (country !== "all") {
    players = players.filter(
      (p) => p.country_key === country || (country === "INTL" && !p.country_key),
    );
  }
  if (division === "MPO") {
    players = players.filter(
      (p) => (p.by_class?.open_mpo?.events ?? 0) > 0 || p.division === "MPO",
    );
  } else if (division === "FPO") {
    players = players.filter(
      (p) => (p.by_class?.open_fpo?.events ?? 0) > 0 || p.division === "FPO",
    );
  } else if (division === "Amateur") {
    players = players.filter(
      (p) => (p.by_class?.amateur?.events ?? p.am_events ?? 0) > 0,
    );
  }

  const metric = (p: AsiaPlayer) => {
    const bucket =
      division === "MPO"
        ? p.by_class?.open_mpo
        : division === "FPO"
          ? p.by_class?.open_fpo
          : division === "Amateur"
            ? p.by_class?.amateur
            : p.by_class?.all;
    if (sort === "wins") return bucket?.wins ?? p.wins;
    if (sort === "podiums") return bucket?.podiums ?? p.podiums;
    if (sort === "top10_rate") return bucket?.top10_rate ?? p.top10_rate ?? 0;
    if (sort === "events") return bucket?.events ?? p.events_played;
    if (sort === "weighted") return bucket?.tour_weighted_points ?? p.tour_weighted_points;
    if (sort === "flightpath") return getFlightpathIndex(p.pdga);
    if (sort === "rating") return p.rating ?? 0;
    if (sort === "asia_tour") return p.asia_tour_points;
    if (sort === "form") return formScore(p.streak);
    if (sort === "cash") {
      return p.cash_earned ?? cashFromResults(p.results);
    }
    return bucket?.pdga_points ?? p.pdga_points;
  };

  players.sort((a, b) => metric(b) - metric(a));
  return players;
}

export function getAsiaTourStanding(pdga: number | string) {
  const n = Number(pdga);
  return asiaBoard.tour_standings.find((s) => s.pdga === n) ?? null;
}

export function getAsiaPlayerBySlug(slug: string) {
  return asiaBoard.players.find((p) => p.slug === slug) ?? null;
}

export function getAsiaPlayerByPdga(pdga: string | number) {
  const n = Number(pdga);
  return asiaBoard.players.find((p) => p.pdga === n) ?? null;
}

export const ACCENT_GRADIENTS = [
  "linear-gradient(135deg, #16382C 0%, #2F6B52 45%, #C6E85A 100%)",
  "linear-gradient(145deg, #0F2420 0%, #3A6E58 50%, #D7E3DA 100%)",
  "linear-gradient(160deg, #1A4032 0%, #C6E85A 55%, #F2F5F0 100%)",
  "linear-gradient(120deg, #121816 0%, #16382C 40%, #8FBF4A 100%)",
  "linear-gradient(150deg, #244C3A 0%, #6FA86A 50%, #E8F0E4 100%)",
  "linear-gradient(135deg, #102820 0%, #C6E85A 35%, #16382C 100%)",
] as const;

export function playerDisplayName(name: string) {
  return name.replace(/\s*#\d+\s*$/, "").trim();
}

export function playerInitials(name: string) {
  return playerDisplayName(name)
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Stable gradient index from PDGA number (not list rank). */
export function playerAccentIndex(pdga: number | string) {
  const n = Math.abs(Number(pdga) || 0);
  return n % ACCENT_GRADIENTS.length;
}

export function playerAccent(pdga: number | string) {
  return ACCENT_GRADIENTS[playerAccentIndex(pdga)];
}

export function pdgaPlayerUrl(pdga: number | string) {
  return `https://www.pdga.com/player/${pdga}`;
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}
