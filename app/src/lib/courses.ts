import coursesJson from "../data/asia/courses.json";
import { asiaBoard, playerDisplayName, playerSlug } from "./asia";
import { eventHostCountryKey } from "./asia-countries";
import { getUpcomingEvents, type UpcomingEvent } from "./upcoming";

export type CourseTopFinisher = {
  pdga: number;
  name: string;
  slug: string;
  flag: string;
  country: string;
  country_key: string;
  wins: number;
};

export type Course = {
  slug: string;
  name: string;
  city: string;
  country_key: string;
  country: string;
  flag: string;
  course_id: string;
  course_url: string;
  lat: number | null;
  lon: number | null;
  holes: number | null;
  par: number | null;
  established: number | null;
  course_type: string;
  region: string;
  address: string;
  pdga_url: string;
  event_count: number;
  first_year: string | null;
  last_year: string | null;
  event_ids: string[];
  upcoming_event_ids: string[];
  distinct_winners: number;
  top_finisher: CourseTopFinisher | null;
  aliases: string[];
  provisional: boolean;
};

export type CourseEventMeta = {
  event_id: string;
  title: string;
  location: string;
  dates: string;
  year: string;
  tier: string;
  level: string;
  is_asia_tour: boolean;
  field_size: number;
};

type CoursesFile = {
  updated_at: string | null;
  provisional: boolean;
  note?: string;
  courses: Course[];
};

const file = coursesJson as unknown as CoursesFile;

const flagByKey = new Map<string, string>();
for (const [k, v] of Object.entries(asiaBoard.country_stats || {})) {
  if (v?.flag) flagByKey.set(k.toUpperCase(), v.flag);
}

const courses: Course[] = (file.courses || []).map((c) => ({
  ...c,
  flag: c.flag || flagByKey.get((c.country_key || "").toUpperCase()) || "",
  lat: c.lat ?? null,
  lon: c.lon ?? null,
  holes: c.holes ?? null,
  par: c.par ?? null,
  established: c.established ?? null,
  course_type: c.course_type ?? "",
  region: c.region ?? "",
  address: c.address ?? "",
  pdga_url: c.pdga_url ?? c.course_url ?? "",
  event_ids: c.event_ids ?? [],
  upcoming_event_ids: c.upcoming_event_ids ?? [],
  aliases: c.aliases ?? [],
  top_finisher: c.top_finisher
    ? {
        ...c.top_finisher,
        name: playerDisplayName(c.top_finisher.name),
        slug: playerSlug(c.top_finisher.name, c.top_finisher.pdga),
      }
    : null,
}));

const bySlug = new Map<string, Course>();
for (const c of courses) {
  bySlug.set(c.slug, c);
  for (const alias of c.aliases ?? []) {
    if (!bySlug.has(alias)) bySlug.set(alias, c);
  }
}

const pastEventMap = new Map<string, CourseEventMeta>();
for (const ev of asiaBoard.events) {
  pastEventMap.set(String(ev.event_id), {
    event_id: String(ev.event_id),
    title: ev.title,
    location: ev.location,
    dates: ev.dates,
    year: ev.year,
    tier: ev.tier,
    level: ev.level,
    is_asia_tour: ev.is_asia_tour,
    field_size: ev.field_size,
  });
}

const upcomingMap = new Map<string, UpcomingEvent>();
for (const e of getUpcomingEvents({ includePast: true })) {
  if (e.event_id) upcomingMap.set(String(e.event_id), e);
}

export function getCourses(): Course[] {
  return courses;
}

export function getCourseBySlug(slug: string): Course | null {
  return bySlug.get(slug) ?? null;
}

export function getCoursesByCountry(countryKey: string): Course[] {
  const key = countryKey.toUpperCase();
  return courses
    .filter((c) => c.country_key.toUpperCase() === key)
    .sort((a, b) => b.event_count - a.event_count || a.name.localeCompare(b.name));
}

function haversineKm(
  a: [number, number],
  b: [number, number],
): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Other courses within `radiusKm` of `course`, nearest first (excluding itself). */
export function getNearbyCourses(
  course: Course,
  radiusKm = 200,
  limit = 6,
): Array<{ course: Course; km: number }> {
  if (course.lat == null || course.lon == null) return [];
  const origin: [number, number] = [course.lat, course.lon];
  return courses
    .filter(
      (c) =>
        c.slug !== course.slug &&
        c.lat != null &&
        c.lon != null &&
        (c.event_count > 0 || c.established != null),
    )
    .map((c) => ({
      course: c,
      km: haversineKm(origin, [c.lat as number, c.lon as number]),
    }))
    .filter((x) => x.km <= radiusKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}

export function coursesUpdatedAt(): string | null {
  return file.updated_at ?? null;
}

export function isProvisionalCourses(): boolean {
  return file.provisional === true;
}

export function totalCourses(): number {
  return courses.length;
}

/** Resolve a course slug from a PDGA event location string ("City, …, Country"). */
export function courseSlugFromLocation(location: string | undefined | null): string | null {
  if (!location) return null;
  const parts = location.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const city = parts[0] ?? "";
  const key = eventHostCountryKey(location);
  if (!key) return null;
  const base = city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!base) return null;
  return `${base}-${key.toLowerCase()}`;
}

export function resolvePastEvents(course: Course): CourseEventMeta[] {
  return course.event_ids
    .map((id) => {
      const meta = pastEventMap.get(String(id));
      if (meta) return meta;
      return {
        event_id: String(id),
        title: `Event ${id}`,
        location: "",
        dates: "",
        year: "",
        tier: "",
        level: "",
        is_asia_tour: false,
        field_size: 0,
      } satisfies CourseEventMeta;
    })
    .sort((a, b) => `${b.year}${b.dates}`.localeCompare(`${a.year}${a.dates}`));
}

export function resolveUpcomingEvents(course: Course): UpcomingEvent[] {
  return course.upcoming_event_ids
    .map((id) => upcomingMap.get(String(id)))
    .filter((e): e is UpcomingEvent => Boolean(e))
    .sort((a, b) => (a.start_date || "").localeCompare(b.start_date || ""));
}
