import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

export function Hero() {
  const rootRef = useRef<HTMLElement>(null);

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

  return (
    <section ref={rootRef} className="fp-hero" aria-label="Flightpath hero">
      <div className="fp-hero-plate" aria-hidden>
        <div className="fp-hero-layer fp-hero-bg" />
        <div className="fp-hero-layer fp-hero-mist" />
        <div className="fp-hero-layer fp-hero-disc" />
        <div className="fp-hero-layer fp-hero-basket" />
        <img
          className="fp-hero-photo"
          src="/assets/hero-course.jpg"
          alt=""
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      </div>
      <div className="fp-hero-copy">
        <p className="fp-brand-lockup">Flightpath</p>
        <h1>The season, written in flight.</h1>
        <p className="fp-hero-sub">
          Elite Series dossiers for the Disc Golf Pro Tour — ratings, career
          lines, and every year on the card.
        </p>
        <div className="fp-hero-actions">
          <Link to="/players" className="fp-cta-enter">
            Open the roster
          </Link>
          <a className="fp-cta-ghost" href="#featured">
            Featured pros
          </a>
        </div>
      </div>
    </section>
  );
}
