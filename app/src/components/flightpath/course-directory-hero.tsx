import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { getCourses } from "../../lib/courses";
import { getCoursePhoto } from "../../lib/course-photos";
import { formatNumber } from "../../lib/asia";

/** Page hero for /courses: featured-course photo backdrop + headline stats +
 *  a spotlight CTA on the most-played course. */
export function CourseDirectoryHero() {
  const { top, totals } = useMemo(() => {
    const courses = getCourses();
    const countryCount = new Set(courses.map((c) => c.country_key)).size;
    const tournaments = courses.reduce((s, c) => s + (c.event_count || 0), 0);
    const withPhoto = courses.filter((c) => getCoursePhoto(c.slug) && c.event_count > 0);
    const pool = withPhoto.length ? withPhoto : courses;
    const topCourse =
      pool.length > 0
        ? pool.reduce((a, b) => (b.event_count > a.event_count ? b : a), pool[0])
        : null;
    return {
      top: topCourse,
      totals: {
        courses: courses.length,
        countries: countryCount,
        tournaments,
      },
    };
  }, []);

  const photo = top ? getCoursePhoto(top.slug) : null;

  return (
    <header className="fp-courses-hero">
      <div className="fp-courses-hero-art">
        {photo && (
          <img
            src={photo.src}
            alt=""
            className="fp-courses-hero-img"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}
        <div className="fp-courses-hero-scrim" aria-hidden />
      </div>
      <div className="fp-courses-hero-copy">
        <p className="fp-pill">Courses directory</p>
        <h1>Courses</h1>
        <p className="fp-hero-sub">
          {formatNumber(totals.courses)} disc golf courses across {totals.countries}{" "}
          {totals.countries === 1 ? "country" : "countries"} ·{" "}
          {formatNumber(totals.tournaments)} PDGA tournaments played · holes, par,
          year established, and a location map for each
        </p>
        <div className="fp-stat-grid fp-courses-hero-stats" aria-label="Course directory totals">
          <div className="fp-stat">
            <strong>{formatNumber(totals.courses)}</strong>
            <span>Courses</span>
          </div>
          <div className="fp-stat">
            <strong>{formatNumber(totals.countries)}</strong>
            <span>Countries</span>
          </div>
          <div className="fp-stat">
            <strong>{formatNumber(totals.tournaments)}</strong>
            <span>Tournaments played</span>
          </div>
        </div>
        {top && (
          <Link to="/courses/$slug" params={{ slug: top.slug }} className="fp-courses-hero-spotlight">
            <span className="fp-courses-hero-spotlight-label">Featured · most-played</span>
            <span className="fp-courses-hero-spotlight-name">
              {top.flag} {top.name}
            </span>
            <span className="fp-courses-hero-spotlight-meta">
              {formatNumber(top.event_count)} tournaments
              {top.holes ? ` · ${top.holes} holes` : ""}
              {top.established ? ` · est. ${top.established}` : ""}
            </span>
            <span className="fp-courses-hero-spotlight-cta" aria-hidden>
              View course →
            </span>
          </Link>
        )}
      </div>
    </header>
  );
}
