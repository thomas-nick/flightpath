import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  formatNumber,
  playerDisplayName,
} from "../../lib/asia";
import {
  getNearbyCourses,
  resolvePastEvents,
  resolveUpcomingEvents,
  type Course,
} from "../../lib/courses";
import { countdownLabel } from "../../lib/upcoming";
import { getCoursePhoto } from "../../lib/course-photos";
import { CourseLink } from "./course-link";
import { CourseMap } from "./course-map";

function mapsHref(course: Course): string {
  const q = encodeURIComponent(
    `${course.name}, ${course.city || ""} ${course.country || course.country_key}`,
  );
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

function CopyLinkButton() {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="fp-cta-ghost fp-course-copy"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {done ? "Link copied ✓" : "Copy link"}
    </button>
  );
}

function CourseHeroArt({ course, nearby }: { course: Course; nearby?: Course[] }) {
  const photo = getCoursePhoto(course.slug);
  const hasCoords = course.lat != null && course.lon != null;
  const [mode, setMode] = useState<"photo" | "map" | "flag">(
    photo ? "photo" : hasCoords ? "map" : "flag",
  );
  return (
    <div className="fp-course-hero-art">
      {mode === "photo" && photo ? (
        <img
          src={photo.src}
          alt=""
          className="fp-course-hero-photo"
          onError={() => setMode(hasCoords ? "map" : "flag")}
        />
      ) : mode === "map" && hasCoords ? (
        <CourseMap
          courses={[course]}
          nearby={nearby}
          focusSlug={course.slug}
          height={300}
          className="fp-course-hero-map"
        />
      ) : (
        <span className="fp-course-hero-flag" aria-hidden>
          {course.flag}
        </span>
      )}
      <span className="fp-country-card-flag-badge" aria-hidden>
        {course.flag}
      </span>
    </div>
  );
}

export function CourseHubView({ course }: { course: Course }) {
  const past = resolvePastEvents(course);
  const upcoming = resolveUpcomingEvents(course);
  const nearby = useMemo(() => getNearbyCourses(course), [course]);
  const nearbyCourses = useMemo(() => nearby.map((n) => n.course), [nearby]);
  const hasCoords = course.lat != null && course.lon != null;
  const spanLabel =
    course.first_year && course.last_year
      ? course.first_year === course.last_year
        ? course.first_year
        : `${course.first_year}–${course.last_year}`
      : null;

  return (
    <article className="fp-course-hub">
      <Link to="/courses" className="fp-cta-ghost fp-back">
        ← All courses
      </Link>

      <header className="fp-course-hero">
        <CourseHeroArt course={course} nearby={nearbyCourses} />
        <div className="fp-course-hero-copy">
          <p className="fp-pill">
            {course.flag} Course · {course.country || course.country_key}
            {spanLabel ? ` · ${spanLabel}` : ""}
          </p>
          <h1>{course.name}</h1>
          <p className="fp-hero-sub">
            {course.city ? `${course.city}, ` : ""}
            {course.country || course.country_key}
            {course.holes ? ` · ${course.holes} holes` : ""}
            {course.established ? ` · est. ${course.established}` : ""}
            {course.event_count > 0
              ? ` · ${formatNumber(course.event_count)} PDGA tournament${
                  course.event_count === 1 ? "" : "s"
                } played here · ${formatNumber(course.distinct_winners)} distinct winners`
              : ""}
          </p>
          <div className="fp-stat-grid fp-course-stat-grid" aria-label="Course summary">
            <div className="fp-stat">
              <strong>{course.holes ?? "—"}</strong>
              <span>Holes</span>
            </div>
            <div className="fp-stat">
              <strong>{course.par ?? "—"}</strong>
              <span>Par</span>
            </div>
            <div className="fp-stat">
              <strong>{course.established ?? "—"}</strong>
              <span>Established</span>
            </div>
            <div className="fp-stat">
              <strong>{course.course_type || "—"}</strong>
              <span>Course type</span>
            </div>
          </div>
          <div className="fp-course-hero-actions">
            <a
              className="fp-inline-link"
              href={mapsHref(course)}
              target="_blank"
              rel="noreferrer"
            >
              Open in Google Maps ↗
            </a>
            {course.pdga_url && (
              <a
                className="fp-inline-link"
                href={course.pdga_url}
                target="_blank"
                rel="noreferrer"
              >
                PDGA directory ↗
              </a>
            )}
            <CopyLinkButton />
          </div>
        </div>
      </header>

      <section className="fp-section fp-course-overview">
        <div className="fp-section-head">
          <h2>At a glance</h2>
          <p className="fp-muted">
            {course.name} · {course.city ? `${course.city}, ` : ""}
            {course.country || course.country_key}
          </p>
        </div>
        <div className="fp-course-overview-grid">
          <dl className="fp-course-specs">
            <div>
              <dt>Location</dt>
              <dd>
                {course.city ? `${course.city}, ` : ""}
                {course.country || course.country_key}
              </dd>
            </div>
            <div>
              <dt>Holes</dt>
              <dd className={course.holes ? "" : "fp-muted"}>{course.holes ?? "—"}</dd>
            </div>
            <div>
              <dt>Par</dt>
              <dd className={course.par ? "" : "fp-muted"}>{course.par ?? "—"}</dd>
            </div>
            <div>
              <dt>Established</dt>
              <dd className={course.established ? "" : "fp-muted"}>
                {course.established ?? "—"}
              </dd>
            </div>
            <div>
              <dt>Course type</dt>
              <dd className={course.course_type ? "" : "fp-muted"}>
                {course.course_type || "—"}
              </dd>
            </div>
            <div>
              <dt>Region</dt>
              <dd className={course.region ? "" : "fp-muted"}>{course.region || "—"}</dd>
            </div>
          </dl>
          <div className="fp-course-nearby">
            <h3>Nearby courses</h3>
            {nearby.length > 0 ? (
              <ul className="fp-course-nearby-list">
                {nearby.map((n) => (
                  <li key={n.course.slug}>
                    <Link to="/courses/$slug" params={{ slug: n.course.slug }}>
                      <span className="fp-course-nearby-flag" aria-hidden>
                        {n.course.flag}
                      </span>
                      <span className="fp-course-nearby-copy">
                        <strong>{n.course.name}</strong>
                        <span>
                          {n.course.holes ? `${n.course.holes} holes · ` : ""}
                          {n.km < 1 ? `${Math.round(n.km * 1000)} m` : `${Math.round(n.km)} km`}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="fp-muted fp-course-nearby-empty">
                {hasCoords
                  ? "No other archived courses nearby."
                  : "Course coordinates unavailable."}
              </p>
            )}
          </div>
        </div>
      </section>

      {course.top_finisher && (
        <section className="fp-section fp-course-top">
          <div className="fp-section-head">
            <h2>Top finisher here</h2>
            <p className="fp-muted">Most wins at this course across all divisions</p>
          </div>
          <Link
            to="/players/$slug"
            params={{ slug: course.top_finisher.slug }}
            className="fp-country-leader-chip"
          >
            <span className="fp-country-leader-flag" aria-hidden>
              {course.top_finisher.flag}
            </span>
            <span className="fp-country-leader-copy">
              <strong>{playerDisplayName(course.top_finisher.name)}</strong>
              <span>
                {formatNumber(course.top_finisher.wins)} wins · {course.top_finisher.country}
              </span>
            </span>
          </Link>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="fp-section fp-course-upcoming">
          <div className="fp-section-head">
            <h2>Upcoming here</h2>
            <p className="fp-muted">
              {upcoming.length} scheduled PDGA tournament{upcoming.length === 1 ? "" : "s"} at {course.name}
            </p>
          </div>
          <ul className="fp-post-list">
            {upcoming.map((e) => (
              <li key={`${e.event_id ?? e.title}-${e.start_date}`}>
                <a className="fp-post-row" href={e.url} target="_blank" rel="noreferrer">
                  <div
                    className="fp-post-thumb"
                    style={{
                      background: e.is_asia_tour ? "var(--fp-lime)" : "var(--fp-pine)",
                      color: e.is_asia_tour ? "var(--fp-ink)" : "var(--fp-chalk)",
                    }}
                  >
                    <span>{e.tier || "C"}</span>
                  </div>
                  <div className="fp-post-copy">
                    <h3>{e.title}</h3>
                    <p>
                      {e.dates} · {e.location || course.name}
                      {e.is_asia_tour ? " · Asia Tour" : ""}
                    </p>
                  </div>
                  <div className="fp-post-meta">
                    <strong>{countdownLabel(e.start_date) || "—"}</strong>
                    <span>starts</span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {past.length > 0 && (
        <section className="fp-section">
          <div className="fp-section-head">
            <h2>Tournament history</h2>
            <p className="fp-muted">
              {formatNumber(past.length)} PDGA tournaments in the archive · newest first
            </p>
          </div>
          <ul className="fp-post-list">
            {past.map((ev) => (
              <li key={ev.event_id}>
                <a
                  className="fp-post-row"
                  href={`https://www.pdga.com/tour/event/${ev.event_id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <div
                    className="fp-post-thumb"
                    style={{
                      background: ev.is_asia_tour ? "var(--fp-lime)" : "var(--fp-pine)",
                      color: ev.is_asia_tour ? "var(--fp-ink)" : "var(--fp-chalk)",
                    }}
                  >
                    <span>{ev.tier || "C"}</span>
                  </div>
                  <div className="fp-post-copy">
                    <h3>{ev.title}</h3>
                    <p>
                      <CourseLink location={ev.location} selfSlug={course.slug} />
                      {" · "}
                      {ev.dates || ev.year}
                      {ev.is_asia_tour ? " · Asia Tour" : ""}
                      {ev.field_size ? ` · ${ev.field_size} finishers` : ""}
                    </p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
