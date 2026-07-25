import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  formatCash,
  formatNumber,
  pdgaPlayerUrl,
  playerDisplayName,
} from "../../lib/asia";
import {
  activityStrip,
  cashForView,
  defaultClassView,
  filterResults,
  pdgaEventUrl,
  statsForView,
  tierMixRows,
  type AsiaClassView,
  type AsiaPlayerProfile,
} from "../../lib/asia-profiles";
import {
  METRIC_TIPS,
  flightpathFactorTip,
  getFlightpathRating,
} from "../../lib/flightpath-rating";
import { AsiaMetricCards } from "./asia-metric-cards";
import { AsiaPlayerCharts } from "./asia-player-charts";
import { Tip } from "./tip";
import { WinsPodium } from "./wins-podium";
import { addToCompare } from "../../lib/compare-store";

function Stat({
  label,
  value,
  tip,
}: {
  label: string;
  value: string | number;
  tip?: string;
}) {
  return (
    <div className="fp-stat">
      <strong>{value}</strong>
      {tip ? (
        <Tip text={tip} className="fp-stat-tip" focusable>
          <span>{label}</span>
        </Tip>
      ) : (
        <span>{label}</span>
      )}
    </div>
  );
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function formLabel(direction: string | undefined) {
  if (direction === "up") return "Heating up";
  if (direction === "down") return "Cooling";
  return "Steady";
}

export function AsiaPlayerProfileView({
  player,
  accent = 0,
}: {
  player: AsiaPlayerProfile;
  accent?: number;
}) {
  const hasMpo = (player.by_class?.open_mpo?.events ?? 0) > 0;
  const hasFpo = (player.by_class?.open_fpo?.events ?? 0) > 0;
  const hasAm = (player.by_class?.amateur?.events ?? player.am_events ?? 0) > 0;
  const [view, setView] = useState<AsiaClassView>(() => defaultClassView(player));
  const stats = useMemo(() => statsForView(player, view), [player, view]);
  const results = useMemo(
    () => filterResults(player.results || [], view),
    [player.results, view],
  );
  const wins = useMemo(
    () => filterResults(player.wins_ledger || [], view),
    [player.wins_ledger, view],
  );
  const cash = useMemo(() => cashForView(player, view), [player, view]);
  const tiers = useMemo(() => tierMixRows(player.by_level), [player.by_level]);
  const activity = useMemo(() => activityStrip(player), [player]);
  const tour = player.tour_standing;
  const streak = player.streak;
  const flightpath = getFlightpathRating(player.pdga);
  const name = playerDisplayName(player.name);
  const maxTierEvents = Math.max(...tiers.map((t) => t.events), 1);
  const classLabel =
    view === "open_mpo"
      ? "MPO"
      : view === "open_fpo"
        ? "FPO"
        : view === "amateur"
          ? "Amateur"
          : "All classes";

  return (
    <article className="fp-profile">
      <Link to="/players" className="fp-cta-ghost fp-back">
        ← Asia roster
      </Link>

      <header className="fp-profile-hero">
        <div className="fp-profile-art">
          <span className="fp-wins-podium-eyebrow" aria-hidden>
            Wins podium · {classLabel}
          </span>
          <WinsPodium
            wins={formatNumber(stats.wins)}
            podiums={formatNumber(stats.podiums)}
            top10={formatNumber(stats.top10)}
            ariaLabel="Asia wins podium"
          />
        </div>
        <div className="fp-profile-intro">
          <p className="fp-pill">
            {player.flag} {player.division || "Open"} · PDGA #{player.pdga}
          </p>
          <h1>{name}</h1>
          <p className="fp-hero-sub">
            {[
              player.pdga_career?.city || player.city,
              player.pdga_career?.state_prov,
              player.pdga_career?.country || player.country,
            ]
              .filter(Boolean)
              .join(", ") || "Asia"}
            {player.classification ? ` · ${player.classification}` : ""}
          </p>

          <div className="fp-rank-strip" aria-label="Asia archive ranks">
            {flightpath?.rank != null && (
              <Tip text={METRIC_TIPS.flightpath_rank} className="fp-rank-chip">
                Flightpath #{flightpath.rank}
              </Tip>
            )}
            {player.pdga_rank != null && (
              <Tip text={METRIC_TIPS.pdga} className="fp-rank-chip">
                Asia #{player.pdga_rank}
              </Tip>
            )}
            {player.weighted_rank != null && (
              <Tip text={METRIC_TIPS.weighted} className="fp-rank-chip">
                Weighted #{player.weighted_rank}
              </Tip>
            )}
            {player.country_rank != null && player.country_key && (
              <span className="fp-rank-chip">
                {player.flag} #{player.country_rank}
              </span>
            )}
            {tour && (
              <Tip text={METRIC_TIPS.asia_tour} className="fp-rank-chip">
                Tour #{tour.rank}
              </Tip>
            )}
            {streak && (
              <Tip
                text={`${METRIC_TIPS.form} Recent avg ${streak.recent_avg} pts vs season ${streak.season_avg}.`}
                className={`fp-form-badge fp-form-${streak.direction || "flat"}`}
              >
                {formLabel(streak.direction)}{" "}
                {streak.delta_pct > 0 ? "+" : ""}
                {streak.delta_pct}%
              </Tip>
            )}
          </div>

          <div className="fp-profile-cta-row">
            <a
              className="fp-cta-enter"
              href={player.pdga_url || pdgaPlayerUrl(player.pdga)}
              target="_blank"
              rel="noreferrer"
            >
              Official PDGA profile
            </a>
            <button
              type="button"
              className="fp-cta-ghost"
              onClick={() => {
                addToCompare(player.slug);
                window.dispatchEvent(new CustomEvent("fp:open-compare"));
              }}
            >
              ⇄ Add to compare
            </button>
          </div>
        </div>
      </header>

      {player.pdga_career && (
        <section className="fp-stat-grid" aria-label="Official PDGA career">
          <Stat
            label="PDGA rating"
            value={player.pdga_career.rating ?? player.rating ?? "—"}
          />
          <Stat
            label="Career events"
            value={
              player.pdga_career.career_events != null
                ? formatNumber(player.pdga_career.career_events)
                : "—"
            }
          />
          <Stat
            label="Career wins"
            value={
              player.pdga_career.career_wins != null
                ? formatNumber(player.pdga_career.career_wins)
                : "—"
            }
          />
          <Stat
            label="Membership"
            value={player.pdga_career.membership_status?.split("(")[0]?.trim() || "—"}
          />
        </section>
      )}

      <div className="fp-class-toggle-wrap">
        <div className="fp-filters fp-filters-segmented fp-class-toggle" role="tablist" aria-label="Finish class">
          {hasMpo && (
            <button
              type="button"
              role="tab"
              aria-selected={view === "open_mpo"}
              className={view === "open_mpo" ? "is-active" : undefined}
              onClick={() => setView("open_mpo")}
            >
              MPO
            </button>
          )}
          {hasFpo && (
            <button
              type="button"
              role="tab"
              aria-selected={view === "open_fpo"}
              className={view === "open_fpo" ? "is-active" : undefined}
              onClick={() => setView("open_fpo")}
            >
              FPO
            </button>
          )}
          <button
            type="button"
            role="tab"
            aria-selected={view === "amateur"}
            className={view === "amateur" ? "is-active" : undefined}
            onClick={() => setView("amateur")}
            disabled={!hasAm}
          >
            Amateur
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "all"}
            className={view === "all" ? "is-active" : undefined}
            onClick={() => setView("all")}
          >
            All classes
          </button>
        </div>
        <p className="fp-muted">
          Charts and tables below are the <strong>Asia tournament archive</strong> (PDGA
          tournaments in Asia only — leagues excluded). Official career totals above come
          from PDGA and can include events outside this archive.
        </p>
      </div>

      <section className="fp-stat-grid" aria-label="Asia archive summary">
        <Stat
          label="Flightpath Index"
          value={
            flightpath ? formatNumber(Math.round(flightpath.index)) : "—"
          }
          tip={flightpath ? flightpathFactorTip(flightpath) : METRIC_TIPS.flightpath}
        />
        <Stat
          label="Asia events"
          value={formatNumber(stats.events)}
          tip={METRIC_TIPS.events}
        />
        <Stat
          label="Asia wins"
          value={formatNumber(stats.wins)}
          tip={METRIC_TIPS.wins}
        />
        <Stat
          label="Asia podiums"
          value={formatNumber(stats.podiums)}
          tip={METRIC_TIPS.podiums}
        />
        <Stat label="Top 5" value={formatNumber(stats.top5)} />
        <Stat label="Top 10" value={formatNumber(stats.top10)} />
        <Stat label="Top 20" value={formatNumber(stats.top20)} />
        <Stat label="Avg finish" value={stats.avg_finish ?? "—"} />
        <Stat label="Win rate" value={pct(stats.win_rate)} />
        <Stat
          label="Top 10 rate"
          value={pct(stats.top10_rate)}
          tip={METRIC_TIPS.top10_rate}
        />
        <Stat
          label="PDGA points"
          value={formatNumber(Math.round(stats.pdga_points))}
          tip={METRIC_TIPS.pdga}
        />
        <Stat
          label="Cash earned"
          value={formatCash(cash)}
          tip={METRIC_TIPS.cash}
        />
        <Stat
          label="Weighted pts"
          value={formatNumber(Math.round(stats.tour_weighted_points || 0))}
          tip={METRIC_TIPS.weighted}
        />
        <Stat
          label="Asia Tour pts"
          value={
            view === "amateur"
              ? "—"
              : formatNumber(Math.round(player.asia_tour_points || 0))
          }
          tip={METRIC_TIPS.asia_tour}
        />
        <Stat
          label="Archive rating"
          value={player.rating ?? "—"}
          tip={METRIC_TIPS.rating}
        />
      </section>

      <AsiaMetricCards player={player} view={view} results={results} />

      <section className="fp-insight-row" aria-label="Form, tier mix, activity">
        <article className="fp-insight-card">
          <h3>Form</h3>
          {streak && (streak.recent_avg || streak.season_avg) ? (
            <>
              <p className={`fp-form-badge fp-form-${streak.direction || "flat"}`}>
                {formLabel(streak.direction)}{" "}
                {streak.delta_pct > 0 ? "+" : ""}
                {streak.delta_pct}%
              </p>
              <p className="fp-muted">
                Last 3 finishes avg {streak.recent_avg} PDGA pts vs earlier season avg{" "}
                {streak.season_avg}.
              </p>
            </>
          ) : (
            <p className="fp-muted">Need 4+ Asia finishes to score form.</p>
          )}
        </article>

        <article className="fp-insight-card">
          <h3>Tier mix</h3>
          {tiers.length ? (
            <ul className="fp-tier-bars">
              {tiers.map((t) => (
                <li key={t.key}>
                  <div className="fp-tier-meta">
                    <span>{t.label}</span>
                    <span>
                      {t.events} ev · {t.wins}W
                    </span>
                  </div>
                  <div className="fp-tier-track">
                    <span
                      className="fp-tier-fill"
                      style={{ width: `${(t.events / maxTierEvents) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="fp-muted">No tier split yet.</p>
          )}
        </article>

        <article className="fp-insight-card">
          <h3>Activity</h3>
          <p className="fp-insight-value">{activity.lastActive}</p>
          <p className="fp-muted">Last active in archive</p>
          {activity.latestYear && activity.eventsDelta != null && activity.pointsDelta != null ? (
            <p className="fp-muted" style={{ marginTop: "0.75rem" }}>
              {activity.latestYear} vs prior year:{" "}
              {activity.eventsDelta >= 0 ? "+" : ""}
              {activity.eventsDelta} events ·{" "}
              {activity.pointsDelta >= 0 ? "+" : ""}
              {formatNumber(activity.pointsDelta)} pts
            </p>
          ) : null}
          {activity.countries.length > 0 && (
            <p className="fp-geo-line">
              {activity.countries.map((c) => `${c.country} (${c.events})`).join(" · ")}
            </p>
          )}
        </article>
      </section>

      {tour && view !== "amateur" && (
        <section className="fp-tour-counting" aria-label="Asia Tour counting finishes">
          <div className="fp-section-head">
            <h2>Asia Tour standings</h2>
            <p className="fp-muted">
              Rank #{tour.rank} · {formatNumber(tour.total_points)} counting pts ·{" "}
              {tour.events_played} tour starts
              {tour.events_played >= 2
                ? " · eligible (min 2 events)"
                : " · needs 2 events to qualify"}
            </p>
          </div>
          <div className="fp-table-wrap">
            <table className="fp-table">
              <thead>
                <tr>
                  <th>Counts?</th>
                  <th>Place</th>
                  <th>Event</th>
                  <th>Pts</th>
                  <th>Dates</th>
                </tr>
              </thead>
              <tbody>
                {(tour.all_results || []).map((r) => {
                  const counts = (tour.counting || []).some(
                    (c) => c.event_id === r.event_id && c.division === r.division,
                  );
                  return (
                    <tr key={`${r.event_id}-${r.division}-${r.place}`}>
                      <td>{counts ? "Yes" : "—"}</td>
                      <td>{r.place}</td>
                      <td>
                        <a
                          href={pdgaEventUrl(r.event_id)}
                          target="_blank"
                          rel="noreferrer"
                          className="fp-inline-link"
                        >
                          {r.event}
                        </a>
                      </td>
                      <td>{r.points}</td>
                      <td>{r.dates}</td>
                    </tr>
                  );
                })}
                {!tour.all_results?.length && (
                  <tr>
                    <td colSpan={5}>No Asia Tour finishes yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <AsiaPlayerCharts player={player} view={view} results={results} />

      <section className="fp-history">
        <div className="fp-section-head">
          <h2>Recent results</h2>
          <p className="fp-muted">{results.length} Asia tournament finishes</p>
        </div>
        <div className="fp-table-wrap">
          <table className="fp-table fp-table-results">
            <thead>
              <tr>
                <th>Place</th>
                <th>Event</th>
                <th>Tier</th>
                <th>Loc</th>
                <th>Div</th>
                <th>Pts</th>
                <th>Prize</th>
                <th>Dates</th>
              </tr>
            </thead>
            <tbody>
              {results.slice(0, 40).map((r) => (
                <tr key={`${r.event_id}-${r.division}-${r.place}-${r.dates}`}>
                  <td>{r.place}</td>
                  <td>
                    <a
                      href={pdgaEventUrl(r.event_id)}
                      target="_blank"
                      rel="noreferrer"
                      className="fp-inline-link"
                    >
                      {r.title}
                    </a>
                    {r.is_asia_tour ? (
                      <span className="fp-tour-tag"> Tour</span>
                    ) : null}
                  </td>
                  <td>{r.tier || "—"}</td>
                  <td className="fp-cell-loc">{r.location || "—"}</td>
                  <td>{r.division || "—"}</td>
                  <td>{Math.round(r.pdga_points)}</td>
                  <td>{r.prize || "—"}</td>
                  <td>{r.dates}</td>
                </tr>
              ))}
              {!results.length && (
                <tr>
                  <td colSpan={8}>No finishes in this class yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="fp-history">
        <div className="fp-section-head">
          <h2>Win ledger</h2>
          <p className="fp-muted">{wins.length} wins</p>
        </div>
        <div className="fp-table-wrap">
          <table className="fp-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Tier</th>
                <th>Div</th>
                <th>Prize</th>
                <th>Dates</th>
              </tr>
            </thead>
            <tbody>
              {wins.map((r) => (
                <tr key={`win-${r.event_id}-${r.division}-${r.dates}`}>
                  <td>
                    <a
                      href={pdgaEventUrl(r.event_id)}
                      target="_blank"
                      rel="noreferrer"
                      className="fp-inline-link"
                    >
                      {r.title}
                    </a>
                  </td>
                  <td>{r.tier || "—"}</td>
                  <td>{r.division || "—"}</td>
                  <td>{r.prize || "—"}</td>
                  <td>{r.dates}</td>
                </tr>
              ))}
              {!wins.length && (
                <tr>
                  <td colSpan={5}>No wins in this class yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="fp-attr" style={{ marginTop: "2rem" }}>
        Asia tournament archive powered by PDGA event results.{" "}
        <a href={pdgaPlayerUrl(player.pdga)} target="_blank" rel="noreferrer">
          Official PDGA profile
        </a>
        .
      </p>
    </article>
  );
}
