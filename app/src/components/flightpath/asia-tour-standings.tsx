import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { getAsiaBoard, playerDisplayName } from "../../lib/asia";
import { AsiaAvatar } from "./asia-avatar";

export function AsiaTourStandings() {
  const board = getAsiaBoard();
  const [division, setDivision] = useState<"all" | "MPO" | "FPO">("all");

  const rows = useMemo(() => {
    const list =
      division === "all"
        ? board.tour_standings
        : board.tour_standings.filter((s) => s.division === division);
    return list.slice(0, 20);
  }, [board.tour_standings, division]);

  if (!board.tour_standings.length) return null;

  return (
    <section className="fp-section" id="tour">
      <div className="fp-section-head">
        <div>
          <h2>Official Asia Tour standings</h2>
          <p className="fp-muted">
            {board.scoring.asia_tour_official?.rule ??
              "Top 4 finishes count · min 2 events (MPO/FPO)"}
          </p>
        </div>
        <div className="fp-filters fp-filters-segmented" role="tablist" aria-label="Tour division">
          {(["all", "MPO", "FPO"] as const).map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={division === d}
              className={division === d ? "is-active" : undefined}
              onClick={() => setDivision(d)}
            >
              {d === "all" ? "All" : d}
            </button>
          ))}
        </div>
      </div>

      <ul className="fp-post-list">
        {rows.map((s) => (
          <li key={s.pdga}>
            <Link
              to="/players/$slug"
              params={{ slug: s.slug }}
              className="fp-post-row fp-post-row-avatar"
            >
              <AsiaAvatar
                flag={s.flag}
                rank={s.rank}
                label={s.country || playerDisplayName(s.name)}
              />
              <div className="fp-post-copy">
                <h3>{playerDisplayName(s.name)}</h3>
                <p>
                  {s.division}
                  {s.rating != null ? ` · ${s.rating}` : ""}
                  {` · ${s.events_played} tour events · ${s.country}`}
                </p>
              </div>
              <div className="fp-post-meta">
                <strong>{s.total_points}</strong>
                <span>pts</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
