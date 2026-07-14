import { Link } from "@tanstack/react-router";
import finishesJson from "../../data/finishes.json";
import type { FinishBundle } from "../../lib/player-analytics";
import {
  ACCENT_GRADIENTS,
  formatMoney,
  formatNumber,
  playerName,
  type Player,
} from "../../lib/players";

const finishesMap = finishesJson as Record<string, FinishBundle>;

export function FeaturedPlayers({ players }: { players: Player[] }) {
  const featured = players.slice(0, 3);

  return (
    <section id="featured" className="fp-section fp-featured">
      <div className="fp-section-head">
        <h2>Latest from the ledger.</h2>
        <Link to="/players" className="fp-cta-ghost">
          View roster →
        </Link>
      </div>
      <div className="fp-card-grid">
        {featured.map((player) => {
          const g =
            ACCENT_GRADIENTS[(player.accent ?? 0) % ACCENT_GRADIENTS.length];
          const bundle = finishesMap[player.pdga_number];
          const f = bundle?.splits?.open.finishes ?? bundle?.finishes;
          const openLabel = bundle?.open_division || player.division;
          return (
            <Link
              key={player.pdga_number}
              to="/players/$slug"
              params={{ slug: player.slug }}
              className="fp-news-card"
            >
              <div className="fp-news-card-art" style={{ background: g }}>
                <span className="fp-news-card-flare" aria-hidden />
                <span className="fp-news-card-initials">
                  {playerName(player)
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)}
                </span>
                <span className="fp-news-card-meta">
                  {player.division} · #{player.pdga_number}
                </span>
              </div>
              <div className="fp-news-card-body">
                <h3>{playerName(player)}</h3>
                <p>
                  Rating {player.rating ?? "—"}
                  {f
                    ? ` · ${openLabel}: ${formatNumber(f.wins)} wins · ${formatNumber(f.podiums)} podiums · ${formatNumber(f.top10)} top 10s`
                    : ` · ${formatNumber(player.career.tournaments)} events · ${formatMoney(player.career.prize)} earned`}
                  .
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
