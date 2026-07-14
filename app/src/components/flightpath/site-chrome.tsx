import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function SiteNav() {
  return (
    <header className="fp-nav">
      <Link to="/" className="fp-mark">
        <span className="fp-mark-glyph" aria-hidden />
        <span>Flightpath</span>
      </Link>
      <nav className="fp-nav-links" aria-label="Primary">
        <a href="#featured">Players</a>
        <a href="#schedule">Elite Series</a>
        <Link to="/players">Directory</Link>
      </nav>
      <a
        className="fp-cta-enter"
        href="https://www.pdga.com/elite-series"
        target="_blank"
        rel="noreferrer"
      >
        Elite Series
      </a>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="fp-footer">
      <div>
        <strong>Flightpath</strong>
        <p>Disc Golf Pro Tour dossiers powered by PDGA data.</p>
      </div>
      <p className="fp-attr">
        Player data © 2026{" "}
        <a href="https://www.pdga.com" target="_blank" rel="noreferrer">
          PDGA
        </a>
        . Event data © 2026 PDGA. Schedule source:{" "}
        <a
          href="https://www.pdga.com/elite-series"
          target="_blank"
          rel="noreferrer"
        >
          PDGA Elite Series
        </a>
        .
      </p>
    </footer>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="fp-shell">
      <SiteNav />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
