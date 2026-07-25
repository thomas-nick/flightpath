import { createFileRoute } from "@tanstack/react-router";
import { AsiaLeaderboard } from "../components/flightpath/asia-leaderboard";
import { AsiaTourStandings } from "../components/flightpath/asia-tour-standings";
import { CountryGrid } from "../components/flightpath/country-grid";
import { FeaturedPlayers } from "../components/flightpath/featured-players";
import { Hero } from "../components/flightpath/hero";
import { PageShell } from "../components/flightpath/site-chrome";
import { SmoothScroll } from "../components/flightpath/smooth-scroll";
import { UpcomingRail } from "../components/flightpath/upcoming-rail";
import { getAsiaBoard } from "../lib/asia";
import { getFlightpathTop } from "../lib/flightpath-rating";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Flightpath Asia — Disc Golf Leaderboards",
      },
      {
        name: "description",
        content:
          "PDGA Asia Tour standings, national leaders, and historical player dossiers across Asian disc golf tournaments.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const board = getAsiaBoard();
  const featured = getFlightpathTop(10);

  return (
    <PageShell>
      <SmoothScroll />
      <Hero />
      <UpcomingRail />
      <FeaturedPlayers asiaPlayers={featured} />
      <CountryGrid
        limit={8}
        title="Country hubs"
        subtitle="National boards, hosted tournaments, and all-time stats across Asia."
      />
      <AsiaTourStandings />
      <AsiaLeaderboard />
      <section className="fp-section fp-close">
        <h2>The archive is growing.</h2>
        <p>
          {board.total_players} players across {board.total_events} PDGA tournaments in
          Asia — open and amateur. Weekly leagues stay off the board. Historical seasons
          backfill into this ledger over time.
        </p>
        <a
          className="fp-cta-enter"
          href="https://www.pdga.com/asiatour"
          target="_blank"
          rel="noreferrer"
        >
          PDGA Asia Tour
        </a>
      </section>
    </PageShell>
  );
}
