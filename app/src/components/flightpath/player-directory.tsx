import { Link } from "@tanstack/react-router";
import { useState } from "react";
import finishesJson from "../../data/finishes.json";
import type { FinishBundle } from "../../lib/player-analytics";
import {
  ACCENT_GRADIENTS,
  formatNumber,
  playerLocation,
  playerName,
  type Player,
} from "../../lib/players";

const finishesMap = finishesJson as Record<string, FinishBundle>;

export function PlayerDirectory({
  players,
  compact = false,
}: {
  players: Player[];
  compact?: boolean;
}) {
  const [filter, setFilter] = useState<"ALL" | "MPO" | "FPO">("ALL");
  const list =
    filter === "ALL" ? players : players.filter((p) => p.division === filter);
  const shown = compact ? list.slice(0, 8) : list;

  return (
    <section id="directory" className="fp-section fp-directory">
      <div className="fp-section-head">
        <h2>{compact ? "Tour roster" : "Player directory"}</h2>
        <div className="fp-filters" role="tablist" aria-label="Division filter">
          {(["ALL", "MPO", "FPO"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={filter === key ? "is-active" : undefined}
              onClick={() => setFilter(key)}
            >
              {key === "ALL" ? "All" : key}
            </button>
          ))}
        </div>
      </div>
      <ul className="fp-post-list">
        {shown.map((player) => {
          const g =
            ACCENT_GRADIENTS[(player.accent ?? 0) % ACCENT_GRADIENTS.length];
          const bundle = finishesMap[player.pdga_number];
          const open = bundle?.splits?.open.finishes ?? bundle?.finishes;
          const am = bundle?.splits?.amateur.finishes;
          return (
            <li key={player.pdga_number}>
              <Link
                to="/players/$slug"
                params={{ slug: player.slug }}
                className="fp-post-row"
              >
                <div className="fp-post-thumb" style={{ background: g }}>
                  <span className="fp-news-card-flare" aria-hidden />
                  <span>
                    {playerName(player)
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                </div>
                <div className="fp-post-copy">
                  <h3>{playerName(player)}</h3>
                  <p>
                    Rating {player.rating ?? "—"}
                    {open
                      ? ` · ${bundle?.open_division || player.division}: ${formatNumber(open.wins)}W / ${formatNumber(open.podiums)} podiums / ${formatNumber(open.top10)} top 10`
                      : ` · peak ${player.career.peak_rating || "—"} · ${formatNumber(player.career.tournaments)} events`}
                    {am && am.events_tracked > 0
                      ? ` · Am: ${formatNumber(am.wins)}W`
                      : ""}
                    {" · "}
                    {playerLocation(player) || "—"}
                  </p>
                  <span className="fp-tag">{player.division}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {compact ? (
        <div className="fp-directory-more">
          <Link to="/players" className="fp-cta-enter">
            Browse all players
          </Link>
        </div>
      ) : null}
    </section>
  );
}
