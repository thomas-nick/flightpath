import { Link } from "@tanstack/react-router";
import { getAsiaBoard } from "../../lib/asia";
import { courseSlugFromLocation, getCourseBySlug } from "../../lib/courses";
import {
  countdownLabel,
  getUpcomingEvents,
  isSeededSchedule,
  upcomingUpdatedAt,
  type UpcomingEvent,
} from "../../lib/upcoming";

function venueLabel(location: string): {
  city: string;
  courseName: string | null;
  courseSlug: string | null;
} {
  const city = location.split(",")[0]?.trim() || location;
  const slug = courseSlugFromLocation(location);
  const course = slug ? getCourseBySlug(slug) : null;
  return {
    city,
    courseName: course?.name ?? null,
    courseSlug: course?.slug ?? null,
  };
}

function countryMeta(key: string): { flag: string; name: string } {
  const stats = getAsiaBoard().country_stats?.[key.toUpperCase()];
  return {
    flag: stats?.flag ?? "",
    name: stats?.name ?? key,
  };
}

function EventCard({ e }: { e: UpcomingEvent }) {
  const chip = countdownLabel(e.start_date);
  const venue = venueLabel(e.location);
  const country = countryMeta(e.country_key);

  return (
    <article className="fp-event-card">
      <div className="fp-event-card-top">
        <span className={`fp-event-tier fp-event-tier-${(e.tier || "C").toLowerCase()}`}>
          {e.tier || "C"}-tier
        </span>
        {chip ? (
          <span
            className={`fp-upcoming-chip${e.is_asia_tour ? " fp-upcoming-chip-tour" : ""}`}
          >
            {chip}
          </span>
        ) : null}
      </div>

      <a
        className="fp-event-card-title"
        href={e.url}
        target="_blank"
        rel="noreferrer"
      >
        {e.title}
      </a>

      <dl className="fp-event-card-meta">
        <div>
          <dt>Date</dt>
          <dd>{e.dates || e.start_date}</dd>
        </div>
        <div>
          <dt>Course</dt>
          <dd>
            {venue.courseName && venue.courseSlug ? (
              <Link
                to="/courses/$slug"
                params={{ slug: venue.courseSlug }}
                className="fp-event-card-course"
              >
                {venue.courseName}
              </Link>
            ) : (
              venue.courseName || venue.city
            )}
          </dd>
        </div>
        <div>
          <dt>Place</dt>
          <dd>
            <span aria-hidden>{country.flag} </span>
            {country.name}
          </dd>
        </div>
        {e.is_asia_tour ? (
          <div>
            <dt>Series</dt>
            <dd>Asia Tour</dd>
          </div>
        ) : null}
      </dl>
    </article>
  );
}

export function UpcomingRail({
  limit = 12,
  title = "Up next in Asia",
  subtitle,
}: {
  limit?: number;
  title?: string;
  subtitle?: string;
}) {
  const events = getUpcomingEvents().slice(0, limit);
  if (events.length === 0) return null;

  const updated = upcomingUpdatedAt();
  const seeded = isSeededSchedule();

  return (
    <section id="upcoming" className="fp-section fp-upcoming">
      <div className="fp-section-head">
        <div>
          <h2>{title}</h2>
          <p className="fp-muted">
            {subtitle ??
              `${events.length} upcoming PDGA tournaments across Asia · leagues excluded`}
            {updated ? ` · refreshed ${updated.slice(0, 10)}` : ""}
            {seeded ? " · seeded sample" : ""}
          </p>
        </div>
        <Link to="/events" className="fp-cta-ghost">
          All events →
        </Link>
      </div>
      <div className="fp-event-cards">
        {events.map((e) => (
          <EventCard key={`${e.event_id ?? e.title}-${e.start_date}`} e={e} />
        ))}
      </div>
    </section>
  );
}
