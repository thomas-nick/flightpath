import upcomingJson from "../data/asia/upcoming-events.json";
import { eventHostCountryKey } from "./asia-countries";

export type UpcomingEvent = {
  event_id: string | null;
  title: string;
  tier: string;
  level: string;
  location: string;
  country_key: string;
  dates: string;
  start_date: string;
  end_date: string;
  is_asia_tour: boolean;
  url: string;
};

type UpcomingFile = {
  updated_at: string;
  seeded?: boolean;
  note?: string;
  events: UpcomingEvent[];
};

const file = upcomingJson as unknown as UpcomingFile;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function getUpcomingEvents(opts?: { includePast?: boolean }): UpcomingEvent[] {
  const today = todayIso();
  const events = [...(file.events || [])];
  const filtered = opts?.includePast
    ? events
    : events.filter((e) => (e.end_date || e.start_date || "") >= today);
  return filtered.sort((a, b) =>
    (a.start_date || "").localeCompare(b.start_date || ""),
  );
}

export function getUpcomingByCountry(countryKey: string): UpcomingEvent[] {
  const key = countryKey.toUpperCase();
  return getUpcomingEvents().filter((e) => e.country_key.toUpperCase() === key);
}

export function nextUpcomingEvent(): UpcomingEvent | null {
  return getUpcomingEvents()[0] ?? null;
}

export function upcomingUpdatedAt(): string | null {
  return file.updated_at ?? null;
}

export function isSeededSchedule(): boolean {
  return file.seeded === true;
}

export function daysUntil(isoDate: string): number | null {
  if (!isoDate) return null;
  const target = new Date(`${isoDate}T00:00:00Z`).getTime();
  if (!Number.isFinite(target)) return null;
  const now = Date.now();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

export function countdownLabel(isoDate: string): string {
  const d = daysUntil(isoDate);
  if (d == null) return "";
  if (d < 0) return "past";
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  return `in ${d} days`;
}

/** Fallback host country when a scraped event has no country_key. */
export function inferCountryKey(e: { location?: string; country_key?: string }) {
  if (e.country_key) return e.country_key;
  return eventHostCountryKey(e.location) ?? "";
}
