import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  getCourses,
  isProvisionalCourses,
  totalCourses,
} from "../../lib/courses";
import { getCoursePhoto } from "../../lib/course-photos";
import { formatNumber } from "../../lib/asia";
import { CourseMap } from "./course-map";

type SortMode = "events" | "holes" | "established" | "alpha" | "country";
type ViewMode = "list" | "grid" | "map";
type HolesFilter = "all" | "9" | "18" | "other";

type DirItem =
  | { type: "header"; key: string; name: string; flag: string; count: number }
  | { type: "row"; course: ReturnType<typeof getCourses>[number]; index: number };

const SORTS: Array<{ id: SortMode; label: string }> = [
  { id: "events", label: "Tournaments played" },
  { id: "holes", label: "Holes" },
  { id: "established", label: "Newest" },
  { id: "alpha", label: "A–Z" },
  { id: "country", label: "Country" },
];

const HOLES_OPTIONS: Array<{ id: HolesFilter; label: string }> = [
  { id: "all", label: "All holes" },
  { id: "18", label: "18-hole" },
  { id: "9", label: "9-hole" },
  { id: "other", label: "Other" },
];

function matchesHoles(c: { holes: number | null }, f: HolesFilter): boolean {
  if (f === "all") return true;
  if (f === "9") return c.holes === 9;
  if (f === "18") return c.holes === 18;
  return c.holes != null && c.holes !== 9 && c.holes !== 18;
}

type CourseLite = ReturnType<typeof getCourses>[number];

function CourseListRow({ course: c, index }: { course: CourseLite; index: number }) {
  const photo = getCoursePhoto(c.slug);
  return (
    <li>
      <Link to="/courses/$slug" params={{ slug: c.slug }} className="fp-course-dir-row">
        <span className="fp-course-dir-media" aria-hidden>
          {photo ? (
            <img
              src={photo.src}
              alt=""
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <span className="fp-course-dir-media-rank">{index + 1}</span>
          )}
          <span className="fp-course-dir-media-flag">{c.flag}</span>
        </span>
        <span className="fp-course-dir-copy">
          <strong>{c.name}</strong>
          <span>
            {c.region ? `${c.region}, ` : ""}
            {c.country || c.country_key}
          </span>
        </span>
        <span className="fp-course-dir-stat fp-course-dir-stat--wide">
          <strong>{c.holes ?? "—"}</strong>
          <span>holes</span>
        </span>
        <span className="fp-course-dir-stat fp-course-dir-stat--wide">
          <strong>{c.established ?? "—"}</strong>
          <span>est.</span>
        </span>
        <span className="fp-course-dir-stat">
          <strong className={c.event_count > 0 ? undefined : "fp-course-dir-stat-empty"}>
            {c.event_count > 0 ? formatNumber(c.event_count) : "—"}
          </strong>
          <span>played</span>
        </span>
        <span className="fp-course-dir-arrow" aria-hidden>
          →
        </span>
      </Link>
    </li>
  );
}

function CourseCard({ course: c }: { course: CourseLite }) {
  const hasCoords = c.lat != null && c.lon != null;
  const photo = getCoursePhoto(c.slug);
  return (
    <li className="fp-course-card">
      <Link to="/courses/$slug" params={{ slug: c.slug }} className="fp-course-card-link">
        <div className="fp-course-card-thumb">
          {hasCoords && (
            <iframe
              title={`Map of ${c.name}`}
              loading="lazy"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${(c.lon as number) - 0.012}%2C${(c.lat as number) - 0.007}%2C${(c.lon as number) + 0.012}%2C${(c.lat as number) + 0.007}&layer=mapnik&marker=${c.lat}%2C${c.lon}`}
            />
          )}
          {photo && (
            <img
              src={photo.src}
              alt=""
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
          {!hasCoords && !photo && (
            <div className="fp-course-card-thumb-fallback" aria-hidden>
              <span>⛳</span>
            </div>
          )}
          <span className="fp-course-card-flag" aria-hidden>
            {c.flag}
          </span>
        </div>
        <div className="fp-course-card-body">
          <strong>{c.name}</strong>
          <span className="fp-course-card-meta">
            {c.region || c.city || c.country || c.country_key}
            {c.holes ? ` · ${c.holes} holes` : ""}
            {c.established ? ` · est. ${c.established}` : ""}
          </span>
          {c.event_count > 0 && (
            <span className="fp-course-card-played">{formatNumber(c.event_count)} played</span>
          )}
        </div>
      </Link>
    </li>
  );
}

export function CourseDirectory() {
  const all = useMemo(() => getCourses(), []);
  const [sort, setSort] = useState<SortMode>("country");
  const [country, setCountry] = useState<string>("all");
  const [holes, setHoles] = useState<HolesFilter>("all");
  const [view, setView] = useState<ViewMode>("list");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(5);
  const grouped = country === "all";

  useEffect(() => {
    setLimit(grouped ? 5 : 20);
  }, [sort, country, holes, query, view]);

  const countries = useMemo(() => {
    const map = new Map<string, { key: string; name: string; flag: string; count: number }>();
    for (const c of all) {
      const k = c.country_key;
      const entry = map.get(k) ?? { key: k, name: c.country || k, flag: c.flag, count: 0 };
      entry.count += 1;
      map.set(k, entry);
    }
    return [...map.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    );
  }, [all]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = all.filter((c) => {
      if (country !== "all" && c.country_key !== country) return false;
      if (!matchesHoles(c, holes)) return false;
      if (q) {
        const hay = `${c.name} ${c.city} ${c.region} ${c.country}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list = [...list];
    list.sort((a, b) => {
      if (sort === "events") return b.event_count - a.event_count || a.name.localeCompare(b.name);
      if (sort === "holes") return (b.holes ?? 0) - (a.holes ?? 0) || a.name.localeCompare(b.name);
      if (sort === "established")
        return (b.established ?? 0) - (a.established ?? 0) || a.name.localeCompare(b.name);
      if (sort === "country")
        return a.country.localeCompare(b.country) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [all, sort, country, holes, query]);

  const provisional = isProvisionalCourses();

  const visibleItems = useMemo<DirItem[]>(() => {
    if (!grouped) {
      return rows.slice(0, limit).map((c, i) => ({ type: "row" as const, course: c, index: i }));
    }
    const out: DirItem[] = [];
    const byCountry = new Map<string, typeof rows>();
    for (const c of rows) {
      const arr = byCountry.get(c.country_key) ?? [];
      arr.push(c);
      byCountry.set(c.country_key, arr);
    }
    for (const ct of countries) {
      const arr = byCountry.get(ct.key);
      if (!arr || !arr.length) continue;
      out.push({ type: "header", key: ct.key, name: ct.name, flag: ct.flag, count: arr.length });
      arr.slice(0, limit).forEach((c, i) => out.push({ type: "row", course: c, index: i }));
    }
    return out;
  }, [rows, countries, limit, grouped]);

  const shownRows = useMemo(() => {
    let n = 0;
    for (const it of visibleItems) if (it.type === "row") n += 1;
    return n;
  }, [visibleItems]);
  const hasMore = shownRows < rows.length;

  return (
    <div className="fp-course-dir">
      <div className="fp-course-dir-bar">
        <div className="fp-course-dir-search">
          <span className="fp-course-dir-search-icon" aria-hidden>
            ⌕
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${formatNumber(totalCourses())} courses…`}
            aria-label="Search courses"
          />
        </div>
        <div className="fp-course-dir-view-toggle" role="group" aria-label="View mode">
          <button
            type="button"
            className={view === "list" ? "is-active" : undefined}
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            List
          </button>
          <button
            type="button"
            className={view === "grid" ? "is-active" : undefined}
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            Grid
          </button>
          <button
            type="button"
            className={view === "map" ? "is-active" : undefined}
            aria-pressed={view === "map"}
            onClick={() => setView("map")}
          >
            Map
          </button>
        </div>
      </div>

      <div className="fp-chip-row fp-chip-row--country" role="group" aria-label="Filter by country">
        <button
          type="button"
          className={country === "all" ? "is-active" : undefined}
          aria-pressed={country === "all"}
          onClick={() => setCountry("all")}
        >
          All <span className="fp-chip-count">{formatNumber(all.length)}</span>
        </button>
        {countries.map((c) => (
          <button
            key={c.key}
            type="button"
            className={country === c.key ? "is-active" : undefined}
            aria-pressed={country === c.key}
            onClick={() => setCountry(c.key)}
          >
            {c.flag} {c.name} <span className="fp-chip-count">{formatNumber(c.count)}</span>
          </button>
        ))}
      </div>

      <div className="fp-course-dir-subbar">
        <div className="fp-chip-row fp-chip-row--sm" role="group" aria-label="Sort courses">
          <span className="fp-chip-label">Sort</span>
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={sort === s.id}
              className={sort === s.id ? "is-active" : undefined}
              onClick={() => setSort(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="fp-chip-row fp-chip-row--sm" role="group" aria-label="Filter by holes">
          <span className="fp-chip-label">Holes</span>
          {HOLES_OPTIONS.map((h) => (
            <button
              key={h.id}
              type="button"
              aria-pressed={holes === h.id}
              className={holes === h.id ? "is-active" : undefined}
              onClick={() => setHoles(h.id)}
            >
              {h.label}
            </button>
          ))}
        </div>
        <p className="fp-course-dir-count">
          <strong>{formatNumber(rows.length)}</strong> course{rows.length === 1 ? "" : "s"}
        </p>
      </div>

      {provisional && (
        <p className="fp-course-dir-note fp-muted">
          Venue-derived from event locations — {formatNumber(totalCourses())} host
          cities grouped across the Asia archive. Real PDGA course names arrive via a
          backfill pass.
        </p>
      )}

      {view === "map" ? (
        <div className="fp-course-dir-map">
          <CourseMap courses={rows} height={520} />
        </div>
      ) : (
        <>
          <ul
            className={
              view === "grid" ? "fp-course-cards fp-course-cards--dir" : "fp-course-dir-list"
            }
          >
            {visibleItems.map((it) =>
              it.type === "header" ? (
                <li key={`h-${it.key}`} className="fp-course-dir-group-head">
                  <span className="fp-course-dir-group-flag" aria-hidden>
                    {it.flag}
                  </span>
                  <span className="fp-course-dir-group-name">{it.name}</span>
                  <span className="fp-course-dir-group-count">
                    {formatNumber(it.count)} course{it.count === 1 ? "" : "s"}
                  </span>
                </li>
              ) : view === "grid" ? (
                <CourseCard key={it.course.slug} course={it.course} />
              ) : (
                <CourseListRow key={it.course.slug} course={it.course} index={it.index} />
              ),
            )}
            {!rows.length && <li className="fp-muted">No courses match this filter.</li>}
          </ul>
          {hasMore && rows.length > 0 && (
            <button
              type="button"
              className="fp-cta-ghost fp-course-dir-more"
              onClick={() => setLimit((n) => n + (grouped ? 5 : 20))}
            >
              Show more · {formatNumber(rows.length - shownRows)} remaining
            </button>
          )}
        </>
      )}
    </div>
  );
}
