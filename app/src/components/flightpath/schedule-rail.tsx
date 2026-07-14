type Event = {
  name: string;
  tier: string;
  location: string;
  dates: string;
  tournament_id: string | null;
  url: string;
};

export function ScheduleRail({ events }: { events: Event[] }) {
  return (
    <section id="schedule" className="fp-section fp-schedule">
      <div className="fp-section-head">
        <h2>2026 Elite Series</h2>
        <a
          className="fp-cta-ghost"
          href="https://www.pdga.com/elite-series"
          target="_blank"
          rel="noreferrer"
        >
          Full schedule →
        </a>
      </div>
      <div className="fp-rail" tabIndex={0}>
        {events.map((event) => (
          <a
            key={event.name}
            className="fp-rail-card"
            href={event.url}
            target="_blank"
            rel="noreferrer"
          >
            <span className="fp-pill">{event.tier}</span>
            <strong>{event.name}</strong>
            <span className="fp-muted">{event.dates}</span>
            <span className="fp-muted">{event.location}</span>
          </a>
        ))}
      </div>
      <p className="fp-attr fp-inline-attr">Event data © 2026 PDGA</p>
    </section>
  );
}
