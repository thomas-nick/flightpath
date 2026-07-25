import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  getSplit,
  type FinishBundle,
  type FinishView,
} from "../../lib/player-analytics";
import {
  formatMoney,
  formatNumber,
  pdgaProfileUrl,
  playerLocation,
  playerName,
  type Player,
} from "../../lib/players";
import { PlayerCharts } from "./player-charts";
import { WinsPodium } from "./wins-podium";

export function PlayerProfile({
  player,
  finishes,
}: {
  player: Player;
  finishes: FinishBundle | null;
}) {
  const openLabel = finishes?.open_division || player.division || "MPO";
  const hasAmateur = (finishes?.splits?.amateur.finishes.events_tracked ?? 0) > 0
    || (finishes?.splits?.amateur.finishes.wins ?? 0) > 0;
  const defaultView: FinishView =
    (finishes?.splits?.open.finishes.events_tracked ?? 0) > 0 ? "open" : "all";
  const [view, setView] = useState<FinishView>(defaultView);

  const split = useMemo(() => getSplit(finishes, view), [finishes, view]);
  const f = split?.finishes;
  const careerPage = finishes?.career;
  const stats = [...player.stats].sort(
    (a, b) => Number(b.year) - Number(a.year),
  );
  const name = playerName(player);
  const viewLabel =
    view === "amateur" ? "Amateur" : view === "all" ? "All classes" : openLabel;

  return (
    <article className="fp-profile">
      <Link to="/players" className="fp-cta-ghost fp-back">
        ← Roster
      </Link>

      <header className="fp-profile-hero">
        <div className="fp-profile-art">
          <span className="fp-wins-podium-eyebrow" aria-hidden>
            Wins podium · {viewLabel}
          </span>
          <WinsPodium
            wins={f ? formatNumber(f.wins) : "—"}
            podiums={f ? formatNumber(f.podiums) : "—"}
            top10={f ? formatNumber(f.top10) : "—"}
          />
        </div>
        <div className="fp-profile-intro">
          <p className="fp-pill">
            {player.division} · PDGA #{player.pdga_number}
          </p>
          <h1>{name}</h1>
          <p className="fp-hero-sub">
            {playerLocation(player) || "Location unavailable"} ·{" "}
            {player.classification || "Professional"}
          </p>
          <a
            className="fp-cta-enter"
            href={pdgaProfileUrl(player.pdga_number)}
            target="_blank"
            rel="noreferrer"
          >
            Official PDGA profile
          </a>
        </div>
      </header>

      <div className="fp-class-toggle-wrap">
        <div className="fp-filters fp-filters-segmented fp-class-toggle" role="tablist" aria-label="Finish class">
          <button
            type="button"
            role="tab"
            aria-selected={view === "open"}
            className={view === "open" ? "is-active" : undefined}
            onClick={() => setView("open")}
          >
            {openLabel}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "amateur"}
            className={view === "amateur" ? "is-active" : undefined}
            onClick={() => setView("amateur")}
            disabled={!hasAmateur && !finishes?.splits}
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
          Finish tallies below follow the selected class. Career rating and
          earnings stay overall.
        </p>
      </div>

      <section className="fp-stat-grid" aria-label="Career summary">
        <Stat label="Current rating" value={player.rating ?? "—"} />
        <Stat
          label="Peak rating"
          value={String(player.career.peak_rating || "—")}
        />
        <Stat
          label={`${split?.label || openLabel} wins`}
          value={formatNumber(
            f?.wins
              ?? (view === "all" ? careerPage?.career_wins : 0)
              ?? 0,
          )}
        />
        <Stat
          label="Podiums"
          value={f ? formatNumber(f.podiums) : "—"}
          hint={f ? `${f.podium_rate}% of tracked ${split?.label} starts` : undefined}
        />
        <Stat
          label="Top 10s"
          value={f ? formatNumber(f.top10) : "—"}
          hint={f ? `${f.top10_rate}% of tracked starts` : undefined}
        />
        <Stat label="Top 5s" value={f ? formatNumber(f.top5) : "—"} />
        <Stat label="Top 20s" value={f ? formatNumber(f.top20) : "—"} />
        <Stat
          label="Avg finish"
          value={f?.avg_place != null ? String(f.avg_place) : "—"}
          hint={
            f?.events_tracked
              ? `${formatNumber(f.events_tracked)} tracked ${split?.label} events`
              : view === "amateur"
                ? "No amateur starts in the tracked window"
                : undefined
          }
        />
        <Stat label="Win rate" value={f ? `${f.win_rate}%` : "—"} />
        <Stat
          label="Career events"
          value={formatNumber(
            careerPage?.career_events || player.career.tournaments,
          )}
        />
        <Stat
          label="Career earnings"
          value={formatMoney(
            careerPage?.career_earnings || player.career.prize,
          )}
        />
        <Stat
          label="Career points"
          value={formatNumber(Math.round(player.career.points))}
        />
      </section>

      <PlayerCharts player={player} finishes={finishes} split={split} />

      {split?.recent_results?.length ? (
        <section className="fp-history">
          <div className="fp-section-head">
            <h2>Recent {split.label} results</h2>
            <p className="fp-muted">Latest tracked finishes in this class</p>
          </div>
          <div className="fp-table-wrap">
            <table className="fp-table">
              <thead>
                <tr>
                  <th>Place</th>
                  <th>Tournament</th>
                  <th>Division</th>
                  <th>Tier</th>
                  <th>Dates</th>
                  <th>Prize</th>
                </tr>
              </thead>
              <tbody>
                {split.recent_results.map((row) => (
                  <tr
                    key={`${row.tournament}-${row.dates}-${row.place}-${row.division_code}`}
                  >
                    <td>
                      <span className={placeClass(row.place ?? 99)}>
                        {row.place}
                      </span>
                    </td>
                    <td>
                      {row.event_url ? (
                        <a href={row.event_url} target="_blank" rel="noreferrer">
                          {row.tournament}
                        </a>
                      ) : (
                        row.tournament
                      )}
                    </td>
                    <td>{row.division_code || row.division || "—"}</td>
                    <td>{row.tier || "—"}</td>
                    <td>{row.dates || "—"}</td>
                    <td>{row.prize ? formatMoney(row.prize) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {split?.wins_list?.length ? (
        <section className="fp-history">
          <div className="fp-section-head">
            <h2>{split.label} win ledger</h2>
            <p className="fp-muted">Official PDGA singles-format wins</p>
          </div>
          <div className="fp-table-wrap">
            <table className="fp-table">
              <thead>
                <tr>
                  <th>Dates</th>
                  <th>Tournament</th>
                  <th>Division</th>
                  <th>Tier</th>
                  <th>Prize</th>
                </tr>
              </thead>
              <tbody>
                {split.wins_list.slice(0, 25).map((row) => (
                  <tr key={`${row.tournament}-${row.dates}-${row.division}`}>
                    <td>{row.dates}</td>
                    <td>
                      {row.event_url ? (
                        <a href={row.event_url} target="_blank" rel="noreferrer">
                          {row.tournament}
                        </a>
                      ) : (
                        row.tournament
                      )}
                    </td>
                    <td>{row.division_code || row.division || "—"}</td>
                    <td>{row.tier || "—"}</td>
                    <td>{row.prize ? formatMoney(row.prize) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="fp-history">
        <div className="fp-section-head">
          <h2>Yearly PDGA stats</h2>
          <p className="fp-muted">Official player-statistics by season</p>
        </div>
        <div className="fp-table-wrap">
          <table className="fp-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Division</th>
                <th>Rating</th>
                <th>Events</th>
                <th>Points</th>
                <th>Prize</th>
                <th>Rounds</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row) => (
                <tr key={`${row.year}-${row.division_code ?? "x"}`}>
                  <td>{row.year}</td>
                  <td>{row.division_code || row.division_name || "—"}</td>
                  <td>{row.rating || "—"}</td>
                  <td>{row.tournaments || "—"}</td>
                  <td>{row.points || "—"}</td>
                  <td>{row.prize ? formatMoney(Number(row.prize)) : "—"}</td>
                  <td>{row.rating_rounds_used || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fp-attr">
          Player data © 2026 PDGA · Open vs amateur finishes compiled from
          public PDGA event results ·{" "}
          <a
            href={pdgaProfileUrl(player.pdga_number)}
            target="_blank"
            rel="noreferrer"
          >
            {name}
          </a>
        </p>
      </section>
    </article>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="fp-stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <em className="fp-stat-hint">{hint}</em> : null}
    </div>
  );
}

function placeClass(place: number) {
  if (place === 1) return "fp-place fp-place-win";
  if (place <= 3) return "fp-place fp-place-podium";
  if (place <= 10) return "fp-place fp-place-top10";
  return "fp-place";
}
