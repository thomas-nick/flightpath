import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { getAsiaBoard } from "../../lib/asia";
import { CompareTray } from "./compare-tray";
import { SearchPalette } from "./search-palette";

export function SiteNav() {
  return (
    <header className="fp-nav">
      <Link to="/" className="fp-mark">
        <span className="fp-mark-glyph" aria-hidden />
        <span>Flightpath Asia</span>
      </Link>
      <nav className="fp-nav-links" aria-label="Primary">
        <a href="/#leaderboard">Leaderboard</a>
        <a href="/#tour">Asia Tour</a>
        <Link to="/countries">Countries</Link>
        <Link to="/players">Players</Link>
        <Link to="/events">Events</Link>
        <Link to="/courses">Courses</Link>
        <button
          type="button"
          className="fp-nav-link-button"
          onClick={() => window.dispatchEvent(new CustomEvent("fp:open-compare"))}
        >
          Compare
        </button>
      </nav>
      <div className="fp-nav-actions">
        <button
          type="button"
          className="fp-nav-search"
          onClick={() => window.dispatchEvent(new CustomEvent("fp:open-search"))}
          aria-label="Search Flightpath Asia"
        >
          <span aria-hidden>⌕</span>
          <span className="fp-nav-search-label">Search</span>
          <kbd className="fp-nav-search-kbd" aria-hidden>
            ⌘K
          </kbd>
        </button>
        <a
          className="fp-cta-enter"
          href="https://www.pdga.com/asiatour"
          target="_blank"
          rel="noreferrer"
        >
          PDGA Asia Tour
        </a>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const board = getAsiaBoard();
  const updated = board.updated_at ? String(board.updated_at).slice(0, 10) : null;
  return (
    <footer className="fp-footer">
      <div className="fp-footer-brand">
        <strong>Flightpath Asia</strong>
        <p>
          A PDGA tournament archive for Asian disc golf — Asia Tour, regionals, open
          and amateur. Weekly leagues excluded.
        </p>
        <nav className="fp-footer-links" aria-label="Footer">
          <a href="/#leaderboard">Leaderboard</a>
          <a href="/#tour">Asia Tour</a>
          <Link to="/countries">Countries</Link>
          <Link to="/players">Players</Link>
          <Link to="/events">Events</Link>
          <Link to="/courses">Courses</Link>
        </nav>
      </div>
      <p className="fp-attr">
        Player and event data ©{" "}
        <a href="https://www.pdga.com" target="_blank" rel="noreferrer">
          Professional Disc Golf Association
        </a>
        . Asia Tour rules:{" "}
        <a href="https://www.pdga.com/asiatour" target="_blank" rel="noreferrer">
          pdga.com/asiatour
        </a>
        .{updated ? ` Archive updated ${updated}.` : ""}
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
      <SearchPalette />
      <CompareTray />
    </div>
  );
}
