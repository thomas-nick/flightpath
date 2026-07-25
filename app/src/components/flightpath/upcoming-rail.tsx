import {
  countdownLabel,
  getUpcomingEvents,
  isSeededSchedule,
  upcomingUpdatedAt,
} from "../../lib/upcoming";

export function UpcomingRail({
  limit = 8,
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
        <a
          className="fp-cta-ghost"
          href="https://www.pdga.com/tour/search"
          target="_blank"
          rel="noreferrer"
        >
          PDGA schedule →
        </a>
      </div>
      <div className="fp-rail" tabIndex={0}>
        {events.map((e) => {
          const chip = countdownLabel(e.start_date);
          return (
            <a
              key={`${e.event_id ?? e.title}-${e.start_date}`}
              className="fp-rail-card fp-upcoming-card"
              href={e.url}
              target="_blank"
              rel="noreferrer"
            >
              <div className="fp-upcoming-top">
                <span className="fp-pill">{e.tier || "C"}</span>
                {chip ? (
                  <span
                    className={`fp-upcoming-chip${e.is_asia_tour ? " fp-upcoming-chip-tour" : ""}`}
                  >
                    {chip}
                  </span>
                ) : null}
              </div>
              <strong>{e.title}</strong>
              <span className="fp-muted">{e.dates}</span>
              <span className="fp-muted">{e.location}</span>
              {e.is_asia_tour ? (
                <span className="fp-tour-tag">Asia Tour</span>
              ) : null}
            </a>
          );
        })}
      </div>
    </section>
  );
}
