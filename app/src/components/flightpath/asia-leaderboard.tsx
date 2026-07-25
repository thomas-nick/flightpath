import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  cashFromResults,
  formatCash,
  formatNumber,
  getAsiaBoard,
  getAsiaPlayers,
  playerDisplayName,
  type AsiaPlayer,
  type AsiaSortMode,
} from "../../lib/asia";
import {
  METRIC_TIPS,
  flightpathFactorTip,
  getFlightpathRating,
} from "../../lib/flightpath-rating";
import { AsiaAvatar } from "./asia-avatar";
import { CollapsibleSection } from "./collapsible-section";
import { Tip } from "./tip";

type Division = "all" | "MPO" | "FPO" | "Amateur";

const SORT_TIPS: Record<AsiaSortMode, string> = {
  flightpath: METRIC_TIPS.flightpath,
  pdga: METRIC_TIPS.pdga,
  weighted: METRIC_TIPS.weighted,
  asia_tour: METRIC_TIPS.asia_tour,
  cash: METRIC_TIPS.cash,
  form: METRIC_TIPS.form,
  wins: METRIC_TIPS.wins,
  podiums: METRIC_TIPS.podiums,
  top10_rate: METRIC_TIPS.top10_rate,
  events: METRIC_TIPS.events,
  rating: METRIC_TIPS.rating,
};

function metricTip(sort: AsiaSortMode, player: AsiaPlayer): string {
  if (sort === "flightpath") {
    const fp = getFlightpathRating(player.pdga);
    return fp ? flightpathFactorTip(fp) : METRIC_TIPS.flightpath;
  }
  return SORT_TIPS[sort];
}

function metricLabel(sort: AsiaSortMode, player: AsiaPlayer, division: Division) {
  const bucket =
    division === "MPO"
      ? player.by_class?.open_mpo
      : division === "FPO"
        ? player.by_class?.open_fpo
        : division === "Amateur"
          ? player.by_class?.amateur
          : player.by_class?.all;
  if (sort === "wins") return String(bucket?.wins ?? player.wins);
  if (sort === "podiums") return String(bucket?.podiums ?? player.podiums);
  if (sort === "top10_rate") {
    const rate = bucket?.top10_rate ?? player.top10_rate ?? 0;
    return `${Math.round(rate * 100)}%`;
  }
  if (sort === "events") return String(bucket?.events ?? player.events_played);
  if (sort === "weighted") {
    return formatNumber(Math.round(bucket?.tour_weighted_points ?? player.tour_weighted_points));
  }
  if (sort === "flightpath") {
    const fp = getFlightpathRating(player.pdga);
    return fp ? formatNumber(Math.round(fp.index)) : "—";
  }
  if (sort === "rating") return player.rating != null ? String(player.rating) : "—";
  if (sort === "asia_tour") return formatNumber(Math.round(player.asia_tour_points));
  if (sort === "form") {
    const d = player.streak?.delta_pct;
    if (d == null) return "—";
    return `${d > 0 ? "+" : ""}${d}%`;
  }
  if (sort === "cash") {
    return formatCash(player.cash_earned ?? cashFromResults(player.results));
  }
  return formatNumber(Math.round(bucket?.pdga_points ?? player.pdga_points));
}

export function AsiaLeaderboard({
  collapsible = false,
}: {
  collapsible?: boolean;
}) {
  const board = getAsiaBoard();
  const [division, setDivision] = useState<Division>("all");
  const [country, setCountry] = useState("all");
  const [sort, setSort] = useState<AsiaSortMode>("flightpath");
  const [query, setQuery] = useState("");
  const [showMoreSorts, setShowMoreSorts] = useState(false);

  const players = useMemo(() => {
    const list = getAsiaPlayers({ division, country, sort });
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        playerDisplayName(p.name).toLowerCase().includes(q) ||
        p.country.toLowerCase().includes(q) ||
        p.country_key.toLowerCase().includes(q),
    );
  }, [division, country, sort, query]);

  const countries = Object.values(board.country_stats)
    .filter((c) => c.player_count > 0)
    .sort((a, b) => b.player_count - a.player_count);

  const subtitle = `${players.length} players · PDGA tournaments across ${board.total_events} events · leagues excluded${
    sort === "flightpath"
      ? " · sorted by Flightpath Index (Asia-weighted house rating)"
      : ""
  }`;

  const body = (
    <>
      <div className="fp-filter-stack">
        <div className="fp-leader-search">
          <span className="fp-leader-search-icon" aria-hidden>
            ⌕
          </span>
          <input
            type="search"
            className="fp-leader-search-input"
            placeholder="Filter this board by name or country…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter leaderboard"
          />
          {query ? (
            <button
              type="button"
              className="fp-leader-search-clear"
              onClick={() => setQuery("")}
              aria-label="Clear filter"
            >
              ✕
            </button>
          ) : null}
        </div>

        <div className="fp-filters" role="group" aria-label="Country">
          <button
            type="button"
            className={country === "all" ? "is-active" : undefined}
            onClick={() => setCountry("all")}
          >
            All countries
          </button>
          {countries.slice(0, 12).map((c) => (
            <button
              key={c.key}
              type="button"
              className={country === c.key ? "is-active" : undefined}
              onClick={() => setCountry(c.key)}
            >
              <span className="fp-chip-flag" aria-hidden>
                {c.flag}
              </span>
              {c.name}
            </button>
          ))}
        </div>

        <div className="fp-filters fp-filters-segmented" role="group" aria-label="Division">
          {(["all", "MPO", "FPO", "Amateur"] as const).map((d) => (
            <button
              key={d}
              type="button"
              className={division === d ? "is-active" : undefined}
              onClick={() => setDivision(d)}
            >
              {d === "all" ? "All classes" : d}
            </button>
          ))}
        </div>

        <div className="fp-filters" role="group" aria-label="Sort">
          {(
            [
              ["flightpath", "Flightpath"],
              ["pdga", "PDGA pts"],
              ["wins", "Wins"],
              ["form", "Form"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={sort === id ? "is-active" : undefined}
              onClick={() => setSort(id)}
            >
              <Tip text={SORT_TIPS[id]} side="bottom">
                {label}
              </Tip>
            </button>
          ))}

          {showMoreSorts &&
            (
              [
                ["weighted", "Weighted"],
                ["asia_tour", "Asia Tour"],
                ["cash", "Cash"],
                ["podiums", "Podiums"],
                ["top10_rate", "Top 10 %"],
                ["events", "Events"],
                ["rating", "Rating"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={sort === id ? "is-active" : undefined}
                onClick={() => setSort(id)}
              >
                <Tip text={SORT_TIPS[id]} side="bottom">
                  {label}
                </Tip>
              </button>
            ))}

          <button
            type="button"
            className={`fp-sort-more${showMoreSorts ? " is-active" : ""}`}
            onClick={() => setShowMoreSorts((v) => !v)}
            aria-expanded={showMoreSorts}
          >
            {showMoreSorts ? "Less" : "More"}
          </button>
        </div>
      </div>

      {country !== "all" && country !== "INTL" && (
        <p className="fp-muted" style={{ margin: "-0.5rem 0 1.1rem" }}>
          <Link
            to="/countries/$key"
            params={{ key: country.toLowerCase() }}
            className="fp-inline-link"
          >
            Open {countries.find((c) => c.key === country)?.name || country} hub →
          </Link>
        </p>
      )}

      <ul className="fp-post-list">
        {players.slice(0, 80).map((p, i) => (
          <li key={p.pdga}>
            <Link to="/players/$slug" params={{ slug: p.slug }} className="fp-post-row fp-post-row-avatar">
              <AsiaAvatar
                flag={p.flag}
                rank={i + 1}
                label={p.country || playerDisplayName(p.name)}
              />
              <div className="fp-post-copy">
                <h3>{playerDisplayName(p.name)}</h3>
                <p>
                  {p.division}
                  {p.rating != null ? ` · ${p.rating}` : ""}
                  {` · ${p.events_played} ev`}
                  {p.wins > 0 ? ` · ${p.wins}W` : ""}
                  {p.podiums > 0 ? ` · ${p.podiums}P` : ""}
                  {p.streak?.direction === "up"
                    ? " · ↑ form"
                    : p.streak?.direction === "down"
                      ? " · ↓ form"
                      : ""}
                </p>
              </div>
              <div className="fp-post-meta">
                <Tip text={metricTip(sort, p)}>
                  <strong>{metricLabel(sort, p, division)}</strong>
                </Tip>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {players.length > 80 && (
        <p className="fp-muted" style={{ marginTop: "1rem" }}>
          Showing top 80 —{" "}
          <Link to="/players" className="fp-inline-link">
            open full directory
          </Link>
        </p>
      )}
    </>
  );

  if (collapsible) {
    return (
      <CollapsibleSection
        id="leaderboard"
        title="Asia leaderboard"
        subtitle={subtitle}
        count={players.length}
      >
        {body}
      </CollapsibleSection>
    );
  }

  return (
    <section className="fp-section" id="leaderboard">
      <div className="fp-section-head">
        <h2>Asia leaderboard</h2>
        <p className="fp-muted">{subtitle}</p>
      </div>
      {body}
    </section>
  );
}
