import {
  asiaBoard,
  type AsiaPlayer,
  type AsiaResult,
} from "./asia";

/** House rating: 1000 ± blend of Asia performance, tour, finish quality, PDGA rating, form. */
export type FlightpathFactors = {
  asiaPerf: number;
  asiaTour: number;
  finishQuality: number;
  rating: number;
  form: number;
};

export type FlightpathRating = {
  index: number;
  rank: number | null;
  eligible: boolean;
  factors: FlightpathFactors;
  z: FlightpathFactors;
  asiaEventsRecent: number;
  asiaEventsAll: number;
};

const TIER_MULT: Record<string, number> = {
  major: 4.0,
  elite: 2.5,
  asia_tour: 2.0,
  a_tier: 1.5,
  b_tier: 1.0,
  c_tier: 0.45,
};

/** Asia-hosted / Asia Tour count fully; anything outside Asia is discounted. */
const GEO_ASIA = 1.0;
const GEO_NON_ASIA = 0.4;
/** Extra bump for official Asia Tour stops on top of Asia geo. */
const ASIA_TOUR_GEO = 1.25;

const HALF_LIFE_YEARS = 2.5;
const FINISH_EXP = 1.5;
const MIN_EVENTS_ELIGIBLE = 4;
const RECENT_YEARS = 2;

const WEIGHTS = {
  asiaPerf: 0.4,
  asiaTour: 0.2,
  finishQuality: 0.15,
  rating: 0.1,
  form: 0.1,
} as const;

const INDEX_CENTER = 1000;
const INDEX_SCALE = 50;

const ASIA_LOCATION_HINT =
  /japan|thailand|china|korea|malaysia|singapore|philippines|cambodia|taiwan|taipei|vietnam|hong kong|mongolia|indonesia|laos|kazakhstan|india|asia/i;

function parseYearFromText(text: string | undefined | null): number | null {
  if (!text) return null;
  const m = String(text).match(/(20\d{2})/);
  return m ? Number(m[1]) : null;
}

function parseResultYear(r: AsiaResult): number | null {
  if (r.year && /^\d{4}$/.test(r.year)) return Number(r.year);
  return parseYearFromText(r.dates);
}

function isAsiaResult(r: AsiaResult): boolean {
  if (r.is_asia_tour || r.level === "asia_tour") return true;
  if (r.location && ASIA_LOCATION_HINT.test(r.location)) return true;
  // Archive is Asia-first; treat unknown locations as Asia unless clearly outside.
  if (!r.location) return true;
  return false;
}

function geoMult(r: AsiaResult): number {
  if (r.is_asia_tour || r.level === "asia_tour") return ASIA_TOUR_GEO;
  if (isAsiaResult(r)) return GEO_ASIA;
  return GEO_NON_ASIA;
}

function levelGeoMult(level: string): number {
  if (level === "asia_tour") return ASIA_TOUR_GEO;
  if (level === "major" || level === "elite") return GEO_ASIA;
  return GEO_ASIA;
}

function decayForYear(year: number | null, nowYear: number): number {
  if (year == null) return 0.35;
  const age = Math.max(0, nowYear - year);
  return Math.pow(0.5, age / HALF_LIFE_YEARS);
}

function finishQuality(place: number, fieldSize: number | undefined): number {
  const field = Math.max(fieldSize || 0, place, 2);
  const pct = 1 - (place - 1) / Math.max(field - 1, 1);
  return Math.pow(Math.max(0, Math.min(1, pct)), FINISH_EXP);
}

function meanStd(values: number[]): { mean: number; std: number } {
  if (!values.length) return { mean: 0, std: 1 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(values.length, 1);
  const std = Math.sqrt(variance);
  return { mean, std: std > 1e-9 ? std : 1 };
}

function zScore(x: number, mean: number, std: number) {
  return (x - mean) / std;
}

function eventFieldMap() {
  const map = new Map<string, number>();
  for (const ev of asiaBoard.events) {
    map.set(String(ev.event_id), ev.field_size || 0);
  }
  return map;
}

/**
 * Board rows only keep ~8 recent results. Career Asia strength comes from
 * by_level / tour_weighted_points; recent results add a freshness bump.
 */
function asiaPerformance(
  player: AsiaPlayer,
  fields: Map<string, number>,
  nowYear: number,
): { asiaPerf: number; asiaEventsRecent: number } {
  let career = 0;
  const byLevel = player.by_level || {};
  for (const [level, stats] of Object.entries(byLevel)) {
    const weighted = stats?.weighted ?? 0;
    if (weighted > 0) {
      career += weighted * levelGeoMult(level);
      continue;
    }
    // Fallback if weighted missing
    const events = stats?.events ?? 0;
    const wins = stats?.wins ?? 0;
    career += events * (TIER_MULT[level] ?? 0.35) * levelGeoMult(level) * (8 + wins * 4);
  }
  if (career <= 0) {
    career = (player.tour_weighted_points || 0) * GEO_ASIA;
  }

  const lastYear = parseYearFromText(player.last_active);
  const careerDecay = 0.4 + 0.6 * decayForYear(lastYear, nowYear);

  let recent = 0;
  let asiaEventsRecent = 0;
  for (const r of player.results || []) {
    const year = parseResultYear(r);
    if (isAsiaResult(r) && year != null && year >= nowYear - RECENT_YEARS) {
      asiaEventsRecent += 1;
    }
    const tier = TIER_MULT[r.level] ?? 0.35;
    const finish = finishQuality(r.place, fields.get(String(r.event_id)));
    recent += finish * tier * geoMult(r) * decayForYear(year, nowYear) * 100;
  }

  // If truncated results don't show recent Asia play but last_active is fresh,
  // credit a floor of recent activity from career volume.
  if (
    asiaEventsRecent < MIN_EVENTS_ELIGIBLE &&
    lastYear != null &&
    lastYear >= nowYear - RECENT_YEARS &&
    player.events_played >= MIN_EVENTS_ELIGIBLE
  ) {
    asiaEventsRecent = Math.min(player.events_played, MIN_EVENTS_ELIGIBLE);
  }

  const asiaPerf = career * careerDecay + recent * 0.85;
  return {
    asiaPerf: Math.round(asiaPerf * 10) / 10,
    asiaEventsRecent,
  };
}

function rawFactors(
  player: AsiaPlayer,
  fields: Map<string, number>,
  nowYear: number,
): Omit<FlightpathRating, "index" | "rank" | "eligible" | "z"> & {
  factors: FlightpathFactors;
} {
  const { asiaPerf, asiaEventsRecent } = asiaPerformance(player, fields, nowYear);
  const asiaEventsAll = player.events_played || 0;

  const events = asiaEventsAll;
  const winRate = player.win_rate ?? (events ? player.wins / events : 0);
  const top10Rate = player.top10_rate ?? (events ? player.top10 / events : 0);
  const finishQualityFactor =
    (winRate * 0.65 + top10Rate * 0.35) * Math.log1p(events);

  return {
    factors: {
      asiaPerf,
      asiaTour: player.asia_tour_points || 0,
      finishQuality: Math.round(finishQualityFactor * 1000) / 1000,
      rating: player.rating ?? 0,
      form: player.streak?.delta_pct ?? 0,
    },
    asiaEventsRecent,
    asiaEventsAll,
  };
}

function buildRatings(): Map<number, FlightpathRating> {
  const nowYear = new Date().getFullYear();
  const fields = eventFieldMap();
  const players = asiaBoard.players;

  const raw = players.map((p) => ({
    pdga: p.pdga,
    ...rawFactors(p, fields, nowYear),
  }));

  const eligible = raw.filter(
    (r) => r.asiaEventsRecent >= MIN_EVENTS_ELIGIBLE || r.asiaEventsAll >= 8,
  );
  const pool = eligible.length >= 20 ? eligible : raw;

  const stats = {
    asiaPerf: meanStd(pool.map((r) => r.factors.asiaPerf)),
    asiaTour: meanStd(pool.map((r) => r.factors.asiaTour)),
    finishQuality: meanStd(pool.map((r) => r.factors.finishQuality)),
    rating: meanStd(pool.map((r) => r.factors.rating).filter((x) => x > 0)),
    form: meanStd(pool.map((r) => r.factors.form)),
  };

  const scored = raw.map((r) => {
    const ratingZ =
      r.factors.rating > 0
        ? zScore(r.factors.rating, stats.rating.mean, stats.rating.std)
        : -0.5;
    const z: FlightpathFactors = {
      asiaPerf: zScore(r.factors.asiaPerf, stats.asiaPerf.mean, stats.asiaPerf.std),
      asiaTour: zScore(r.factors.asiaTour, stats.asiaTour.mean, stats.asiaTour.std),
      finishQuality: zScore(
        r.factors.finishQuality,
        stats.finishQuality.mean,
        stats.finishQuality.std,
      ),
      rating: ratingZ,
      form: zScore(r.factors.form, stats.form.mean, stats.form.std),
    };
    const blend =
      WEIGHTS.asiaPerf * z.asiaPerf +
      WEIGHTS.asiaTour * z.asiaTour +
      WEIGHTS.finishQuality * z.finishQuality +
      WEIGHTS.rating * z.rating +
      WEIGHTS.form * z.form;
    const eligiblePlayer =
      r.asiaEventsRecent >= MIN_EVENTS_ELIGIBLE || r.asiaEventsAll >= 8;
    return {
      pdga: r.pdga,
      index: Math.round((INDEX_CENTER + INDEX_SCALE * blend) * 10) / 10,
      rank: null as number | null,
      eligible: eligiblePlayer,
      factors: r.factors,
      z,
      asiaEventsRecent: r.asiaEventsRecent,
      asiaEventsAll: r.asiaEventsAll,
    };
  });

  const ranked = [...scored]
    .filter((r) => r.eligible)
    .sort((a, b) => b.index - a.index);
  ranked.forEach((r, i) => {
    r.rank = i + 1;
  });

  return new Map(scored.map((r) => [r.pdga, r]));
}

/** Lazy so we don't hit a circular import with asia.ts during module init. */
let ratingsByPdga: Map<number, FlightpathRating> | null = null;

function ensureRatings() {
  if (!ratingsByPdga) ratingsByPdga = buildRatings();
  return ratingsByPdga;
}

export function getFlightpathRating(pdga: number | string): FlightpathRating | null {
  return ensureRatings().get(Number(pdga)) ?? null;
}

export function getFlightpathIndex(pdga: number | string): number {
  return getFlightpathRating(pdga)?.index ?? 0;
}

export function listFlightpathRatings() {
  return [...ensureRatings().values()].sort((a, b) => b.index - a.index);
}

/** Eligible Top N for the house board (default 10). */
export function getFlightpathTop(
  n = 10,
  opts?: { division?: "all" | "MPO" | "FPO" | "Amateur" },
): Array<AsiaPlayer & { flightpath: FlightpathRating }> {
  const division = opts?.division ?? "all";
  const map = ensureRatings();
  let players = asiaBoard.players.filter((p) => map.get(p.pdga)?.eligible);

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

  return players
    .map((p) => ({ ...p, flightpath: map.get(p.pdga)! }))
    .sort((a, b) => b.flightpath.index - a.flightpath.index)
    .slice(0, n);
}

export const FLIGHTPATH_RATING_NOTES =
  "Flightpath Index blends career Asia performance (Asia Tour weighted highest; non-Asia discounted), Asia Tour points, finish quality, PDGA rating, and recent form. Board results are freshness-weighted; deep Asia careers still count via archive totals. Eligible with 4+ recent Asia starts (or 8+ career Asia starts).";

/** Hover copy for scoring metrics across leaderboard, profiles, and Top 10. */
export const METRIC_TIPS = {
  flightpath:
    "Flightpath Index — house rating (~1000 avg). Weights Asia event performance highest, then Asia Tour points, finish quality, PDGA rating, and recent form. Asia Tour stops count more; non-Asia results are discounted.",
  flightpath_rank:
    "Rank among eligible players on the Flightpath Index (4+ recent Asia starts, or 8+ career Asia starts).",
  asia_perf:
    "Asia performance — decayed career archive strength from tier-weighted finishes. Asia Tour events get a 1.25× boost.",
  asia_tour:
    "Official PDGA Asia Tour points (best counting finishes). Separate from the Flightpath Index, but feeds into it.",
  weighted:
    "Custom finish×tier points from the Asia archive (Majors/Asia Tour count more than B/C tiers).",
  pdga:
    "Sum of PDGA points earned in Asia-archive tournaments (PDGA’s own tier + field weighting).",
  rating:
    "Current PDGA player rating — global skill signal used lightly in the Flightpath Index.",
  form: "Recent form — last few finishes vs earlier season average PDGA points.",
  cash: "Prize money recorded from Asia-archive event results.",
  wins: "Event wins in the Asia tournament archive (leagues excluded).",
  podiums: "Top-3 finishes in the Asia tournament archive.",
  top10_rate: "Share of Asia-archive starts that finished top 10.",
  events: "PDGA tournament starts in the Asia archive (leagues excluded).",
  finish_quality:
    "Win rate and top-10 rate scaled by how many Asia starts a player has logged.",
} as const;

export function flightpathFactorTip(fp: FlightpathRating): string {
  const f = fp.factors;
  return [
    METRIC_TIPS.flightpath,
    "",
    `Asia perf ${Math.round(f.asiaPerf)} · Tour ${Math.round(f.asiaTour)} · Finish quality ${f.finishQuality.toFixed(2)} · Rating ${f.rating || "—"} · Form ${f.form > 0 ? "+" : ""}${f.form}%`,
  ].join("\n");
}
