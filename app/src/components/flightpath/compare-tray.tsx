import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import {
  formatCash,
  formatNumber,
  getAsiaPlayerBySlug,
  playerDisplayName,
  type AsiaPlayer,
} from "../../lib/asia";
import { getFlightpathRating } from "../../lib/flightpath-rating";
import { searchAsia } from "../../lib/search";
import {
  COMPARE_MAX,
  addToCompare,
  clearCompare,
  getCompare,
  removeFromCompare,
  subscribeCompare,
} from "../../lib/compare-store";
import { WinsPodium } from "./wins-podium";

export function CompareTray() {
  const [slugs, setSlugs] = useState<string[]>(() => getCompare());
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => subscribeCompare(() => setSlugs(getCompare())), []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("fp:open-compare", onOpen);
    return () => window.removeEventListener("fp:open-compare", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const players = useMemo(
    () =>
      slugs
        .map((s) => getAsiaPlayerBySlug(s))
        .filter((p): p is AsiaPlayer => p != null),
    [slugs],
  );

  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    return searchAsia(query, 6).players.filter((h) => !slugs.includes(h.slug));
  }, [query, slugs]);

  function pick(slug: string) {
    addToCompare(slug);
    setQuery("");
  }

  if (slugs.length === 0 && !open) return null;

  return (
    <>
      <button
        type="button"
        className="fp-compare-fab"
        onClick={() => setOpen(true)}
        aria-label={`Compare ${slugs.length} player${slugs.length === 1 ? "" : "s"}`}
      >
        <span aria-hidden>⇄</span>
        <span>Compare</span>
        <span className="fp-compare-fab-count">{slugs.length}</span>
      </button>

      {open && (
        <div
          className="fp-search-overlay fp-compare-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Compare players"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="fp-compare-panel">
            <div className="fp-compare-bar">
              <h2>Compare players</h2>
              <div className="fp-compare-bar-actions">
                {slugs.length > 0 && (
                  <button
                    type="button"
                    className="fp-cta-ghost"
                    onClick={() => clearCompare()}
                  >
                    Clear all
                  </button>
                )}
                <button
                  type="button"
                  className="fp-compare-close"
                  onClick={() => setOpen(false)}
                  aria-label="Close compare"
                >
                  ✕
                </button>
              </div>
            </div>

            {players.length === 0 ? (
              <p className="fp-muted fp-compare-empty">
                Add up to {COMPARE_MAX} players to put them head-to-head.
              </p>
            ) : (
              <div className="fp-compare-grid">
                {players.map((p) => {
                  const fp = getFlightpathRating(p.pdga);
                  return (
                    <article key={p.pdga} className="fp-compare-card">
                      <Link
                        to="/players/$slug"
                        params={{ slug: p.slug }}
                        className="fp-compare-head"
                        onClick={() => setOpen(false)}
                      >
                        <span className="fp-compare-flag" aria-hidden>
                          {p.flag}
                        </span>
                        <span className="fp-compare-head-copy">
                          <strong>{playerDisplayName(p.name)}</strong>
                          <em>
                            {p.country} · {p.division}
                          </em>
                        </span>
                      </Link>
                      <button
                        type="button"
                        className="fp-compare-remove"
                        onClick={() => removeFromCompare(p.slug)}
                      >
                        ✕ Remove
                      </button>
                      <WinsPodium
                        wins={formatNumber(p.wins)}
                        podiums={formatNumber(p.podiums)}
                        top10={formatNumber(p.top10)}
                      />
                      <dl className="fp-compare-stats">
                        <Stat label="Flightpath" value={fp ? formatNumber(Math.round(fp.index)) : "—"} />
                        <Stat label="Rating" value={p.rating ?? "—"} />
                        <Stat label="Wins" value={formatNumber(p.wins)} />
                        <Stat label="Podiums" value={formatNumber(p.podiums)} />
                        <Stat label="Top 10" value={formatNumber(p.top10)} />
                        <Stat label="Events" value={formatNumber(p.events_played)} />
                        <Stat label="PDGA pts" value={formatNumber(Math.round(p.pdga_points))} />
                        <Stat label="Asia Tour" value={formatNumber(Math.round(p.asia_tour_points))} />
                        <Stat label="Cash" value={formatCash(p.cash_earned ?? 0)} />
                      </dl>
                    </article>
                  );
                })}
              </div>
            )}

            <div className="fp-compare-add">
              <div className="fp-leader-search">
                <span className="fp-leader-search-icon" aria-hidden>
                  ⌕
                </span>
                <input
                  type="search"
                  className="fp-leader-search-input"
                  placeholder={
                    players.length >= COMPARE_MAX
                      ? "Compare is full — remove one to add another"
                      : "Add a player by name…"
                  }
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={players.length >= COMPARE_MAX}
                  aria-label="Add a player to compare"
                  onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === "Enter" && suggestions[0]) pick(suggestions[0].slug);
                  }}
                />
                {query ? (
                  <button
                    type="button"
                    className="fp-leader-search-clear"
                    onClick={() => setQuery("")}
                    aria-label="Clear"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
              {query && suggestions.length > 0 && (
                <ul className="fp-compare-suggest">
                  {suggestions.map((hit) => (
                    <li key={hit.pdga}>
                      <button type="button" onClick={() => pick(hit.slug)}>
                        <span aria-hidden>{hit.flag}</span>
                        <strong>{hit.name}</strong>
                        <em>{hit.subtitle}</em>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="fp-compare-stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
