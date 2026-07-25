import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "../../components/flightpath/site-chrome";
import { CourseLink } from "../../components/flightpath/course-link";
import { UpcomingRail } from "../../components/flightpath/upcoming-rail";
import { getAsiaBoard } from "../../lib/asia";
import { getUpcomingEvents, upcomingUpdatedAt, isSeededSchedule } from "../../lib/upcoming";

export const Route = createFileRoute("/events/")({
  head: () => ({
    meta: [
      { title: "Asia Events — Flightpath Asia" },
      {
        name: "description",
        content:
          "PDGA tournaments across Asia — Asia Tour stops and regional opens. Leagues excluded.",
      },
    ],
  }),
  component: EventsIndex,
});

function EventsIndex() {
  const board = getAsiaBoard();
  const events = [...board.events].sort((a, b) =>
    `${b.year}${b.dates}`.localeCompare(`${a.year}${a.dates}`),
  );

  return (
    <PageShell>
      <div className="fp-page-top">
        <h1>Asia tournament archive</h1>
        <p className="fp-hero-sub">
          {events.length} PDGA tournaments in the current dataset. Historical seasons are
          backfilling — weekly leagues never make this list.
        </p>
      </div>
      {getUpcomingEvents().length > 0 ? (
        <UpcomingRail
          title="Upcoming"
          subtitle="Future PDGA tournaments scheduled across Asia"
        />
      ) : (
        <div className="fp-section fp-empty-state">
          <div className="fp-section-head">
            <h2>Upcoming</h2>
            <p className="fp-muted">
              No PDGA Asia Tour events scheduled yet
              {!isSeededSchedule() && upcomingUpdatedAt()
                ? ` · last checked ${new Date(upcomingUpdatedAt() as string).toLocaleDateString()}`
                : ""}
            </p>
          </div>
          <p className="fp-muted">
            The 2026 PDGA Asia Tour has concluded. When PDGA posts the next season's
            schedule, it'll appear here automatically. In the meantime, browse the
            past archive below.
          </p>
        </div>
      )}
      <section className="fp-section">
        <div className="fp-section-head">
          <h2>Past archive</h2>
          <p className="fp-muted">{events.length} historical PDGA tournaments in Asia</p>
        </div>
        <ul className="fp-post-list">
          {events.map((ev) => (
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
                    <CourseLink location={ev.location} />
                    {" · "}
                    {ev.dates || ev.year}
                    {ev.is_asia_tour ? " · Asia Tour" : ""}
                    {` · ${ev.field_size} finishers`}
                  </p>
                </div>
              </a>
            </li>
          ))}
        </ul>
        <p className="fp-muted" style={{ marginTop: "1.5rem" }}>
          <Link to="/" className="fp-inline-link">
            ← Back to leaderboard
          </Link>
        </p>
      </section>
    </PageShell>
  );
}
