import { asiaBoard, playerDisplayName } from "./asia";
import { countrySlug } from "./asia-countries";
import { getCourses } from "./courses";

export type PlayerHit = {
  type: "player";
  pdga: number;
  slug: string;
  name: string;
  flag: string;
  country: string;
  division: string;
  rating: number | null;
  subtitle: string;
};

export type CountryHit = {
  type: "country";
  key: string;
  slug: string;
  name: string;
  flag: string;
  subtitle: string;
};

export type EventHit = {
  type: "event";
  event_id: string;
  title: string;
  location: string;
  dates: string;
  year: string;
  tier: string;
  subtitle: string;
};

export type CourseHit = {
  type: "course";
  slug: string;
  name: string;
  flag: string;
  country: string;
  country_key: string;
  event_count: number;
  subtitle: string;
};

export type SearchHit = PlayerHit | CountryHit | EventHit | CourseHit;

export type SearchResults = {
  players: PlayerHit[];
  countries: CountryHit[];
  events: EventHit[];
  courses: CourseHit[];
};

function norm(s: string) {
  return s.toLowerCase().trim();
}

function scoreMatch(haystack: string, q: string): number {
  if (!q) return 0;
  const h = norm(haystack);
  if (!h) return 0;
  if (h === q) return 100;
  if (h.startsWith(q)) return 80;
  if (h.includes(q)) return 50;
  const words = h.split(/[\s,.-]+/);
  for (const w of words) {
    if (w.startsWith(q)) return 35;
  }
  return 0;
}

export function searchAsia(query: string, limit = 7): SearchResults {
  const q = norm(query);
  if (!q) return { players: [], countries: [], events: [], courses: [] };

  const players = asiaBoard.players
    .map((p) => {
      const name = playerDisplayName(p.name);
      const s = Math.max(
        scoreMatch(name, q) * 2,
        scoreMatch(p.country, q),
        scoreMatch(p.country_key, q),
      );
      return { p, name, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ p, name }) => ({
      type: "player" as const,
      pdga: p.pdga,
      slug: p.slug,
      name,
      flag: p.flag,
      country: p.country,
      division: p.division,
      rating: p.rating,
      subtitle: `${p.flag} ${p.country} · ${p.division}${
        p.rating != null ? ` · ${p.rating}` : ""
      }`,
    }));

  const countries = Object.values(asiaBoard.country_stats)
    .filter((c) => c.player_count > 0)
    .map((c) => ({ c, s: Math.max(scoreMatch(c.name, q) * 2, scoreMatch(c.key, q)) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ c }) => ({
      type: "country" as const,
      key: c.key,
      slug: countrySlug(c.key),
      name: c.name,
      flag: c.flag,
      subtitle: `${c.flag} ${c.player_count} players`,
    }));

  const events = asiaBoard.events
    .map((e) => ({
      e,
      s: Math.max(
        scoreMatch(e.title, q) * 2,
        scoreMatch(e.location, q),
        scoreMatch(e.year, q),
      ),
    }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ e }) => ({
      type: "event" as const,
      event_id: e.event_id,
      title: e.title,
      location: e.location,
      dates: e.dates,
      year: e.year,
      tier: e.tier,
      subtitle: `${e.location || "Asia"} · ${e.dates || e.year}${
        e.tier ? ` · ${e.tier}` : ""
      }`,
    }));

  const courses = getCourses()
    .map((c) => ({
      c,
      s: Math.max(
        scoreMatch(c.name, q) * 2,
        scoreMatch(c.city, q),
        scoreMatch(c.country, q),
        scoreMatch(c.country_key, q),
      ),
    }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ c }) => ({
      type: "course" as const,
      slug: c.slug,
      name: c.name,
      flag: c.flag,
      country: c.country,
      country_key: c.country_key,
      event_count: c.event_count,
      subtitle: `${c.flag} ${c.country || c.country_key} · ${c.event_count} events hosted`,
    }));

  return { players, countries, events, courses };
}

export function totalSearchResults(r: SearchResults) {
  return r.players.length + r.countries.length + r.events.length + r.courses.length;
}
