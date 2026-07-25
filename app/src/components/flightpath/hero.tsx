import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { getAsiaBoard } from "../../lib/asia";
import { CountUp } from "./count-up";

export function Hero() {
  const rootRef = useRef<HTMLElement>(null);
  const board = getAsiaBoard();
  const countryCount = Object.values(board.country_stats).filter(
    (c) => c.player_count > 0,
  ).length;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    let raf = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = root.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        root.style.setProperty("--fp-px", String(x));
        root.style.setProperty("--fp-py", String(y));
      });
    };
    root.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener("pointermove", onMove);
    };
  }, []);

  const stats = [
    { label: "Players", value: board.total_players },
    { label: "Tournaments", value: board.total_events },
    { label: "Countries", value: countryCount },
    { label: "Tour qualifiers", value: board.tour_standings.length },
  ];

  return (
    <section ref={rootRef} className="fp-hero" aria-label="Flightpath Asia hero">
      <div className="fp-hero-art" aria-hidden>
        <img
          className="fp-hero-map"
          src="/assets/hero/flightpath-hero.png"
          alt=""
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        <div className="fp-hero-scrim" />
      </div>

      <div className="fp-hero-copy">
        <p className="fp-hero-eyebrow">
          <span className="fp-hero-eyebrow-dot" aria-hidden />
          PDGA Asia Tour · Leaderboards &amp; dossiers
        </p>
        <h1>
          Asia disc golf,
          <br />
          in full flight.
        </h1>
        <p className="fp-hero-sub">
          Standings, national leaders, and player dossiers across{" "}
          {board.total_events} PDGA tournaments — open and amateur. Weekly
          leagues stay off the board.
        </p>
        <div className="fp-hero-actions">
          <a className="fp-cta-enter" href="#leaderboard">
            Open the board
          </a>
          <Link to="/players" className="fp-cta-ghost">
            Full roster →
          </Link>
        </div>

        <div className="fp-hero-stats">
          {stats.map((s) => (
            <div key={s.label} className="fp-hero-stat">
              <span className="fp-hero-stat-label">{s.label}</span>
              <span className="fp-hero-stat-value">
                <CountUp value={s.value} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
