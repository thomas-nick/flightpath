import { Link } from "@tanstack/react-router";
import {
  formatNumber,
  playerDisplayName,
  type AsiaPlayer,
} from "../../lib/asia";
import type { FlightpathRating } from "../../lib/flightpath-rating";
import {
  FLIGHTPATH_RATING_NOTES,
  METRIC_TIPS,
  flightpathFactorTip,
} from "../../lib/flightpath-rating";
import { Tip } from "./tip";

type FeaturedPlayer = AsiaPlayer & { flightpath?: FlightpathRating };

export function FeaturedPlayers({ asiaPlayers }: { asiaPlayers: FeaturedPlayer[] }) {
  const podium = asiaPlayers.slice(0, 3);
  const rest = asiaPlayers.slice(3, 10);

  return (
    <section id="featured" className="fp-section fp-featured">
      <div className="fp-section-head">
        <h2>Flightpath Top 10</h2>
        <a href="#leaderboard" className="fp-cta-ghost">
          Full board →
        </a>
      </div>
      <p className="fp-muted fp-featured-blurb">{FLIGHTPATH_RATING_NOTES}</p>

      <div className="fp-podium-kit">
        {podium.map((player, i) => {
          const name = playerDisplayName(player.name);
          const rank = player.flightpath?.rank ?? i + 1;
          const countryCode = (player.country_key || "FP").toUpperCase();
          const fp = player.flightpath;
          const medalClass =
            rank === 1
              ? " fp-kit-card-gold"
              : rank === 2
                ? " fp-kit-card-silver"
                : rank === 3
                  ? " fp-kit-card-bronze"
                  : "";
          const formDir = player.streak?.direction;
          return (
            <Link
              key={player.pdga}
              to="/players/$slug"
              params={{ slug: player.slug }}
              className={`fp-kit-card${medalClass}`}
            >
              <div className="fp-kit-crest">
                <span className="fp-kit-rank-badge" aria-hidden>
                  {rank}
                </span>
                <span className="fp-kit-seal" aria-hidden>
                  <span className="fp-kit-seal-ring" />
                  <span className="fp-kit-seal-code">{countryCode}</span>
                </span>
              </div>
              <div className="fp-kit-body">
                <h3>
                  {name}
                  {formDir ? (
                    <span
                      className={`fp-kit-form fp-kit-form-${formDir}`}
                      aria-hidden
                      title={
                        formDir === "up"
                          ? "Heating up"
                          : formDir === "down"
                            ? "Cooling"
                            : "Steady"
                      }
                    >
                      {formDir === "up" ? "↑" : formDir === "down" ? "↓" : "→"}
                    </span>
                  ) : null}
                </h3>
                <p className="fp-kit-country">
                  <span className="fp-kit-flag" aria-hidden>
                    {player.flag}
                  </span>
                  {player.country_key || "INT"} · {player.division || "Open"}
                </p>
                <div className="fp-kit-stats">
                  <div className="fp-kit-stat">
                    <Tip text={fp ? flightpathFactorTip(fp) : METRIC_TIPS.flightpath}>
                      <strong>{fp ? formatNumber(Math.round(fp.index)) : "—"}</strong>
                    </Tip>
                    <span>Flightpath</span>
                  </div>
                  <div className="fp-kit-stat fp-kit-stat-2">
                    <strong>{formatNumber(player.wins)}</strong>
                    <span>Wins</span>
                  </div>
                </div>
                <p className="fp-kit-meta">
                  Rating {player.rating ?? "—"} · {formatNumber(player.events_played)} starts
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {rest.length > 0 && (
        <ol className="fp-fp-top-list">
          {rest.map((player, i) => {
            const fp = player.flightpath;
            const rank = fp?.rank ?? i + 4;
            return (
              <li key={player.pdga}>
                <Link
                  to="/players/$slug"
                  params={{ slug: player.slug }}
                  className="fp-fp-top-row"
                >
                  <span className="fp-fp-top-rank">{rank}</span>
                  <span className="fp-fp-top-flag" aria-hidden>
                    {player.flag}
                  </span>
                  <span className="fp-fp-top-name">
                    {playerDisplayName(player.name)}
                    <em>
                      {player.division}
                      {player.rating != null ? ` · ${player.rating}` : ""}
                    </em>
                  </span>
                  <Tip text={fp ? flightpathFactorTip(fp) : METRIC_TIPS.flightpath}>
                    <strong>{fp ? formatNumber(Math.round(fp.index)) : "—"}</strong>
                  </Tip>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
