import { Link } from "@tanstack/react-router";
import {
  formatCash,
  formatNumber,
  playerDisplayName,
} from "../../lib/asia";
import type { AsiaCountryLeader, getAsiaCountryHub } from "../../lib/asia-countries";
import { getCoursesByCountry } from "../../lib/courses";
import { getCoursePhoto } from "../../lib/course-photos";
import { countdownLabel, getUpcomingByCountry } from "../../lib/upcoming";
import { AsiaAvatar } from "./asia-avatar";
import { CourseLink } from "./course-link";
import { CollapsibleSection } from "./collapsible-section";

type HubData = NonNullable<ReturnType<typeof getAsiaCountryHub>>;

function LeaderChip({
  leader,
  formatValue,
}: {
  leader: AsiaCountryLeader;
  formatValue: (n: number) => string;
}) {
  return (
    <Link
      to="/players/$slug"
      params={{ slug: leader.slug }}
      className="fp-country-leader-chip"
    >
      <span className="fp-country-leader-flag" aria-hidden>
        {leader.flag}
      </span>
      <span className="fp-country-leader-copy">
        <strong>{playerDisplayName(leader.name)}</strong>
        <span>
          {formatValue(leader.value)}
          {leader.label ? ` ${leader.label}` : ""}
        </span>
      </span>
    </Link>
  );
}

export function CountryHubView({ data }: { data: HubData }) {
  const { hub, players, events, champion, tourRows, allTime } = data;
  const pointsLeader =
    champion && hub.leader
      ? {
          pdga: champion.leader_pdga,
          slug: hub.leader.slug,
          name: champion.leader_name,
          flag: hub.flag,
          value: champion.leader_points,
          label: "pts",
        }
      : hub.leader
        ? {
            pdga: hub.leader.pdga,
            slug: hub.leader.slug,
            name: hub.leader.name,
            flag: hub.leader.flag,
            value: hub.leader.pdga_points,
            label: "pts",
          }
        : null;
  const maxYearEvents = Math.max(1, ...allTime.byYear.map((y) => y.events));
  const spanLabel =
    allTime.firstYear && allTime.lastYear
      ? allTime.firstYear === allTime.lastYear
        ? allTime.firstYear
        : `${allTime.firstYear}–${allTime.lastYear}`
      : null;

  return (
    <article className="fp-country-hub">
      <Link to="/countries" className="fp-cta-ghost fp-back">
        ← All countries
      </Link>

      <header className="fp-country-hero">
        <div className="fp-country-hero-art">
          {(hub.photoSrc ?? hub.heroSrc) ? (
            <img
              src={hub.photoSrc ?? hub.heroSrc ?? ""}
              alt=""
              className="fp-country-hero-img"
              onError={(e) => {
                const el = e.currentTarget;
                if (el.dataset.fb === "1" || !hub.heroSrc) {
                  el.style.display = "none";
                  return;
                }
                el.dataset.fb = "1";
                el.src = hub.heroSrc;
              }}
            />
          ) : (
            <div className="fp-country-hero-fallback" aria-hidden>
              {hub.flag}
            </div>
          )}
          <span className="fp-country-hero-flag-badge" aria-hidden>
            {hub.flag}
          </span>
        </div>
        <div className="fp-country-hero-copy">
          <p className="fp-pill">
            {hub.flag} Country hub · {hub.key}
            {spanLabel ? ` · ${spanLabel}` : ""}
          </p>
          <h1>{hub.name}</h1>
          <p className="fp-hero-sub">
            All-time Asia archive · {formatNumber(hub.playerCount)} players ·{" "}
            {formatNumber(hub.eventCount)} tournaments hosted · leagues excluded
          </p>
          <div className="fp-stat-grid fp-country-stat-grid" aria-label="Country summary">
            <div className="fp-stat">
              <strong>{formatNumber(hub.playerCount)}</strong>
              <span>Players</span>
            </div>
            <div className="fp-stat">
              <strong>{formatNumber(hub.eventCount)}</strong>
              <span>Hosted events</span>
            </div>
            <div className="fp-stat">
              <strong>{formatNumber(allTime.wins)}</strong>
              <span>All-time wins</span>
            </div>
            <div className="fp-stat">
              <strong>
                {allTime.cash > 0 ? formatCash(allTime.cash) : "—"}
              </strong>
              <span>Cash earned</span>
            </div>
          </div>
        </div>
      </header>

      {(() => {
        const upcoming = getUpcomingByCountry(hub.key);
        if (!upcoming.length) return null;
        return (
          <section className="fp-section fp-country-upcoming">
            <div className="fp-section-head">
              <h2>Upcoming in {hub.name}</h2>
              <p className="fp-muted">
                {upcoming.length} scheduled PDGA tournament{upcoming.length === 1 ? "" : "s"} in {hub.name}
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
                        {e.dates} · {e.location || hub.name}
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
        );
      })()}

      <section className="fp-section">
        <div className="fp-section-head">
          <h2>All-time</h2>
          <p className="fp-muted">
            Career totals for {hub.name} players across the Asia archive
            {spanLabel ? ` · hosted events ${spanLabel}` : ""}
          </p>
        </div>
        <div className="fp-stat-grid fp-country-alltime-grid" aria-label="All-time stats">
          <div className="fp-stat">
            <strong>{formatNumber(allTime.wins)}</strong>
            <span>Wins</span>
          </div>
          <div className="fp-stat">
            <strong>{formatNumber(allTime.podiums)}</strong>
            <span>Podiums</span>
          </div>
          <div className="fp-stat">
            <strong>{formatNumber(Math.round(allTime.pdgaPoints))}</strong>
            <span>PDGA points</span>
          </div>
          <div className="fp-stat">
            <strong>{formatNumber(allTime.eventsPlayed)}</strong>
            <span>Starts</span>
          </div>
          <div className="fp-stat">
            <strong>{allTime.avgRating != null ? allTime.avgRating : "—"}</strong>
            <span>Avg rating ({allTime.ratedPlayers})</span>
          </div>
          <div className="fp-stat">
            <strong>{formatNumber(allTime.asiaTourHosted)}</strong>
            <span>Asia Tour hosted</span>
          </div>
          <div className="fp-stat">
            <strong>{formatNumber(allTime.decade2010s)}</strong>
            <span>Events 2010–19</span>
          </div>
          <div className="fp-stat">
            <strong>{formatNumber(allTime.decade2020s)}</strong>
            <span>Events 2020–</span>
          </div>
        </div>

        {(pointsLeader ||
          allTime.mostWins ||
          allTime.mostEvents ||
          allTime.mostCash ||
          allTime.podiumMachine) && (
          <div className="fp-country-leaders" aria-label="Country record holders">
            {pointsLeader && (
              <div>
                <p className="fp-country-leader-label">Points leader</p>
                <LeaderChip
                  leader={pointsLeader}
                  formatValue={(n) => formatNumber(Math.round(n))}
                />
              </div>
            )}
            {allTime.mostWins && (
              <div>
                <p className="fp-country-leader-label">Most wins</p>
                <LeaderChip
                  leader={allTime.mostWins}
                  formatValue={(n) => formatNumber(n)}
                />
              </div>
            )}
            {allTime.podiumMachine && (
              <div>
                <p className="fp-country-leader-label">Podium machine</p>
                <LeaderChip
                  leader={allTime.podiumMachine}
                  formatValue={(n) => formatNumber(n)}
                />
              </div>
            )}
            {allTime.mostEvents && (
              <div>
                <p className="fp-country-leader-label">Most starts</p>
                <LeaderChip
                  leader={allTime.mostEvents}
                  formatValue={(n) => formatNumber(n)}
                />
              </div>
            )}
            {allTime.mostCash && (
              <div>
                <p className="fp-country-leader-label">Most cash</p>
                <LeaderChip
                  leader={allTime.mostCash}
                  formatValue={(n) => formatCash(n)}
                />
              </div>
            )}
          </div>
        )}

        {allTime.byYear.length > 0 && (
          <div className="fp-country-years" aria-label="Hosted events by year">
            <p className="fp-country-leader-label">
              Hosted events by year
              {allTime.peakYear
                ? ` · peak ${allTime.peakYear} (${allTime.peakYearEvents})`
                : ""}
            </p>
            <div className="fp-country-year-bars">
              {allTime.byYear.map((row) => (
                <div key={row.year} className="fp-country-year-bar" title={`${row.year}: ${row.events}`}>
                  <span
                    style={{
                      height: `${Math.max(8, (row.events / maxYearEvents) * 100)}%`,
                    }}
                  />
                  <span className="fp-country-year-count">{row.events}</span>
                  <em>{row.year.slice(2)}</em>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {(() => {
        const countryCourses = getCoursesByCountry(hub.key);
        if (!countryCourses.length) return null;
        const shown = countryCourses.slice(0, 8);
        return (
          <section className="fp-section">
            <div className="fp-section-head">
              <h2>Available courses in {hub.name}</h2>
              <p className="fp-muted">
                {countryCourses.length} course{countryCourses.length === 1 ? "" : "s"} in the Asia archive · ranked by tournaments played
              </p>
            </div>
            <ul className="fp-course-cards">
              {shown.map((c) => {
                const hasCoords = c.lat != null && c.lon != null;
                const photo = getCoursePhoto(c.slug);
                return (
                  <li key={c.slug} className="fp-course-card">
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
                          <span className="fp-course-card-played">
                            {formatNumber(c.event_count)} played
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {countryCourses.length > shown.length && (
              <Link to="/courses" className="fp-cta-ghost fp-section-more">
                View all {countryCourses.length} courses in {hub.name} →
              </Link>
            )}
          </section>
        );
      })()}

      <CollapsibleSection
        title="Leaderboard"
        subtitle={`Ranked by Asia-archive PDGA points · ${players.length} players`}
        count={players.length}
      >
        <ul className="fp-post-list">
          {players.slice(0, 60).map((p, i) => (
            <li key={p.pdga}>
              <Link
                to="/players/$slug"
                params={{ slug: p.slug }}
                className="fp-post-row fp-post-row-avatar"
              >
                <AsiaAvatar flag={p.flag} rank={i + 1} label={p.country} />
                <div className="fp-post-copy">
                  <h3>{playerDisplayName(p.name)}</h3>
                  <p>
                    {p.division}
                    {p.rating != null ? ` · ${p.rating}` : ""}
                    {` · ${p.events_played} ev`}
                    {p.wins > 0 ? ` · ${p.wins}W` : ""}
                    {p.podiums > 0 ? ` · ${p.podiums}P` : ""}
                  </p>
                </div>
                <div className="fp-post-meta">
                  <strong>{formatNumber(Math.round(p.pdga_points))}</strong>
                  <span>pts</span>
                </div>
              </Link>
            </li>
          ))}
          {!players.length && (
            <li className="fp-muted">No players tagged to this country yet.</li>
          )}
        </ul>
      </CollapsibleSection>

      {tourRows.length > 0 && (
        <CollapsibleSection
          title="Asia Tour standings"
          subtitle={`${tourRows.length} players from ${hub.name} on the tour board`}
          count={tourRows.length}
        >
          <ul className="fp-post-list">
            {tourRows.slice(0, 20).map((s) => (
              <li key={s.pdga}>
                <Link
                  to="/players/$slug"
                  params={{ slug: s.slug }}
                  className="fp-post-row fp-post-row-avatar"
                >
                  <AsiaAvatar flag={s.flag} rank={s.rank} label={s.country} />
                  <div className="fp-post-copy">
                    <h3>{playerDisplayName(s.name)}</h3>
                    <p>
                      {s.division}
                      {s.rating != null ? ` · ${s.rating}` : ""}
                      {` · ${s.events_played} tour events`}
                    </p>
                  </div>
                  <div className="fp-post-meta">
                    <strong>{formatNumber(s.total_points)}</strong>
                    <span>tour</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title="Hosted events"
        subtitle={`PDGA tournaments staged in ${hub.name} · ${events.length} in archive`}
        count={events.length}
      >
        <ul className="fp-post-list">
          {events.slice(0, 80).map((ev) => (
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
          {!events.length && (
            <li className="fp-muted">
              No hosted tournaments matched this country in the current archive. Players from{" "}
              {hub.name} may still appear above from events staged elsewhere in Asia.
            </li>
          )}
        </ul>
      </CollapsibleSection>
    </article>
  );
}
