import { Link } from "@tanstack/react-router";
import {
  ACCENT_GRADIENTS,
  formatMoney,
  formatNumber,
  pdgaProfileUrl,
  playerLocation,
  playerName,
  type Player,
} from "../../lib/players";

export function PlayerProfile({ player }: { player: Player }) {
  const g = ACCENT_GRADIENTS[(player.accent ?? 0) % ACCENT_GRADIENTS.length];
  const stats = [...player.stats].sort(
    (a, b) => Number(b.year) - Number(a.year),
  );
  const name = playerName(player);

  return (
    <article className="fp-profile">
      <Link to="/players" className="fp-cta-ghost fp-back">
        ← Roster
      </Link>

      <header className="fp-profile-hero">
        <div className="fp-profile-art" style={{ background: g }}>
          <span className="fp-news-card-flare" aria-hidden />
          <span className="fp-profile-initials">
            {name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)}
          </span>
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

      <section className="fp-stat-grid" aria-label="Career summary">
        <Stat label="Current rating" value={player.rating ?? "—"} />
        <Stat
          label="Peak rating"
          value={String(player.career.peak_rating || "—")}
        />
        <Stat
          label="Career events"
          value={formatNumber(player.career.tournaments)}
        />
        <Stat
          label="Career points"
          value={formatNumber(Math.round(player.career.points))}
        />
        <Stat
          label="Career earnings"
          value={formatMoney(player.career.prize)}
        />
        <Stat
          label="Seasons logged"
          value={String(player.career.years_active)}
        />
      </section>

      <section className="fp-history">
        <div className="fp-section-head">
          <h2>Historical stats</h2>
          <p className="fp-muted">Year-by-year PDGA player statistics</p>
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
                  <td>
                    {row.prize
                      ? formatMoney(Number(row.prize))
                      : "—"}
                  </td>
                  <td>{row.rating_rounds_used || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fp-attr">
          Player data © 2026 PDGA ·{" "}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="fp-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
