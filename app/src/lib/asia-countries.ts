import {
  getAsiaBoard,
  getAsiaPlayers,
  type AsiaPlayer,
} from "./asia";
import { getCountryHero } from "./country-heroes";
import { getCountryPhoto } from "./country-photos";
import { getCountryMascot } from "./country-mascots";
import { getCoursesByCountry } from "./courses";

/** Location-tail (PDGA event country string) → board country_key */
const LOCATION_TO_KEY: Record<string, string> = {
  japan: "JP",
  thailand: "TH",
  china: "CN",
  "south korea": "KR",
  korea: "KR",
  malaysia: "MY",
  singapore: "SG",
  philippines: "PH",
  cambodia: "KH",
  "chinese taipei": "TW",
  taiwan: "TW",
  vietnam: "VN",
  "hong kong": "HK",
  mongolia: "MN",
  indonesia: "ID",
  laos: "LA",
  kazakhstan: "KZ",
  india: "IN",
  russia: "RU",
};

export type AsiaCountryHub = {
  key: string;
  slug: string;
  name: string;
  flag: string;
  playerCount: number;
  eventCount: number;
  courseCount: number;
  firstYear: string | null;
  lastYear: string | null;
  leader: AsiaPlayer | null;
  heroSrc: string | null;
  photoSrc: string | null;
  mascotSrc: string | null;
  animal: string | null;
};

export function countrySlug(key: string) {
  return key.toLowerCase();
}

export function countryKeyFromSlug(slug: string) {
  return slug.trim().toUpperCase();
}

export function eventHostCountryKey(location: string | undefined | null): string | null {
  if (!location) return null;
  const parts = location
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  if (!parts.length) return null;
  const tail = parts[parts.length - 1]!;
  if (LOCATION_TO_KEY[tail]) return LOCATION_TO_KEY[tail]!;
  for (const [name, key] of Object.entries(LOCATION_TO_KEY)) {
    if (parts.includes(name)) return key;
  }
  return null;
}

/** Hide one-off travelers / thin tags from the country index. */
const MIN_HUB_PLAYERS = 5;
/** Keep the product focused on Asia circuits — not European PDGA homes. */
const HUB_EXCLUDED = new Set(["RU", "INTL"]);

export function listAsiaCountryHubs(opts?: { includeThin?: boolean }): AsiaCountryHub[] {
  const board = getAsiaBoard();
  const eventCounts = new Map<string, number>();
  const firstYear = new Map<string, string>();
  const lastYear = new Map<string, string>();
  for (const ev of board.events) {
    const key = eventHostCountryKey(ev.location);
    if (!key) continue;
    eventCounts.set(key, (eventCounts.get(key) || 0) + 1);
    const y = ev.year;
    if (y) {
      if (!firstYear.has(key) || y < (firstYear.get(key) ?? "")) firstYear.set(key, y);
      if (!lastYear.has(key) || y > (lastYear.get(key) ?? "")) lastYear.set(key, y);
    }
  }

  return Object.values(board.country_stats)
    .filter((c) => {
      if (HUB_EXCLUDED.has(c.key)) return false;
      if (opts?.includeThin) return (c.player_count || 0) > 0;
      return (c.player_count || 0) >= MIN_HUB_PLAYERS;
    })
    .map((c) => {
      const hero = getCountryHero(c.key);
      const photo = getCountryPhoto(c.key);
      const mascot = getCountryMascot(c.key);
      return {
        key: c.key,
        slug: countrySlug(c.key),
        name: c.name,
        flag: c.flag,
        playerCount: c.player_count,
        eventCount: eventCounts.get(c.key) || 0,
        courseCount: getCoursesByCountry(c.key).length,
        firstYear: firstYear.get(c.key) ?? null,
        lastYear: lastYear.get(c.key) ?? null,
        leader: c.leader,
        heroSrc: hero?.src ?? null,
        photoSrc: photo?.src ?? null,
        mascotSrc: mascot?.src ?? null,
        animal: mascot?.animal ?? null,
      };
    })
    .sort((a, b) => b.playerCount - a.playerCount || a.name.localeCompare(b.name));
}

export type AsiaCountryLeader = {
  pdga: number;
  slug: string;
  name: string;
  flag: string;
  value: number;
  label: string;
};

export type AsiaCountryAllTime = {
  wins: number;
  podiums: number;
  cash: number;
  pdgaPoints: number;
  eventsPlayed: number;
  avgRating: number | null;
  ratedPlayers: number;
  firstYear: string | null;
  lastYear: string | null;
  peakYear: string | null;
  peakYearEvents: number;
  decade2010s: number;
  decade2020s: number;
  asiaTourHosted: number;
  byYear: Array<{ year: string; events: number }>;
  mostWins: AsiaCountryLeader | null;
  mostEvents: AsiaCountryLeader | null;
  mostCash: AsiaCountryLeader | null;
  podiumMachine: AsiaCountryLeader | null;
};

function leaderFrom(
  player: AsiaPlayer | undefined,
  value: number,
  label: string,
): AsiaCountryLeader | null {
  if (!player || value <= 0) return null;
  return {
    pdga: player.pdga,
    slug: player.slug,
    name: player.name,
    flag: player.flag,
    value,
    label,
  };
}

function buildCountryAllTime(
  players: AsiaPlayer[],
  events: ReturnType<typeof getAsiaBoard>["events"],
): AsiaCountryAllTime {
  const wins = players.reduce((n, p) => n + (p.wins || 0), 0);
  const podiums = players.reduce((n, p) => n + (p.podiums || 0), 0);
  const cash = players.reduce((n, p) => n + (p.cash_earned || 0), 0);
  const pdgaPoints = players.reduce((n, p) => n + (p.pdga_points || 0), 0);
  const eventsPlayed = players.reduce((n, p) => n + (p.events_played || 0), 0);
  const rated = players.filter((p) => p.rating != null && p.rating > 0);
  const avgRating = rated.length
    ? Math.round(rated.reduce((n, p) => n + (p.rating || 0), 0) / rated.length)
    : null;

  const yearCounts = new Map<string, number>();
  for (const ev of events) {
    yearCounts.set(ev.year, (yearCounts.get(ev.year) || 0) + 1);
  }
  const byYear = [...yearCounts.entries()]
    .map(([year, count]) => ({ year, events: count }))
    .sort((a, b) => a.year.localeCompare(b.year));
  const years = byYear.map((y) => y.year);
  const peak = byYear.reduce<{ year: string; events: number } | null>(
    (best, row) => (!best || row.events > best.events ? row : best),
    null,
  );

  const mostWinsP = [...players].sort((a, b) => b.wins - a.wins)[0];
  const mostEventsP = [...players].sort((a, b) => b.events_played - a.events_played)[0];
  const mostCashP = [...players].sort(
    (a, b) => (b.cash_earned || 0) - (a.cash_earned || 0),
  )[0];
  const podiumP = [...players].sort((a, b) => b.podiums - a.podiums)[0];

  return {
    wins,
    podiums,
    cash,
    pdgaPoints,
    eventsPlayed,
    avgRating,
    ratedPlayers: rated.length,
    firstYear: years[0] ?? null,
    lastYear: years[years.length - 1] ?? null,
    peakYear: peak?.year ?? null,
    peakYearEvents: peak?.events ?? 0,
    decade2010s: byYear
      .filter((y) => y.year >= "2010" && y.year <= "2019")
      .reduce((n, y) => n + y.events, 0),
    decade2020s: byYear
      .filter((y) => y.year >= "2020")
      .reduce((n, y) => n + y.events, 0),
    asiaTourHosted: events.filter((e) => e.is_asia_tour).length,
    byYear,
    mostWins: leaderFrom(mostWinsP, mostWinsP?.wins || 0, "wins"),
    mostEvents: leaderFrom(
      mostEventsP,
      mostEventsP?.events_played || 0,
      "events",
    ),
    mostCash: leaderFrom(mostCashP, mostCashP?.cash_earned || 0, "earned"),
    podiumMachine: leaderFrom(podiumP, podiumP?.podiums || 0, "podiums"),
  };
}

export function getAsiaCountryHub(slugOrKey: string) {
  const key = countryKeyFromSlug(slugOrKey);
  // Allow direct URLs even for thin countries; index stays filtered.
  const hubs = listAsiaCountryHubs({ includeThin: true }).filter(
    (h) => !HUB_EXCLUDED.has(h.key),
  );
  const hub = hubs.find((h) => h.key === key || h.slug === slugOrKey.toLowerCase());
  if (!hub) return null;

  const board = getAsiaBoard();
  const players = getAsiaPlayers({ country: hub.key, sort: "pdga" });
  const events = board.events
    .filter((ev) => eventHostCountryKey(ev.location) === hub.key)
    .sort((a, b) => `${b.year}${b.dates}`.localeCompare(`${a.year}${a.dates}`));

  const champion = board.country_champions.find((c) => c.country_key === hub.key) ?? null;
  const tourRows = board.tour_standings.filter((s) => s.country_key === hub.key);
  const allTime = buildCountryAllTime(players, events);

  return {
    hub,
    players,
    events,
    champion,
    tourRows,
    allTime,
  };
}
