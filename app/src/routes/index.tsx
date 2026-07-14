import { createFileRoute } from "@tanstack/react-router";
import { FeaturedPlayers } from "../components/flightpath/featured-players";
import { Hero } from "../components/flightpath/hero";
import { PlayerDirectory } from "../components/flightpath/player-directory";
import { ScheduleRail } from "../components/flightpath/schedule-rail";
import { PageShell } from "../components/flightpath/site-chrome";
import { SmoothScroll } from "../components/flightpath/smooth-scroll";
import eliteSeries from "../data/elite-series-2026.json";
import { getPlayers } from "../lib/players";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Flightpath — Disc Golf Pro Tour Ledger",
      },
      {
        name: "description",
        content:
          "Elite Series player dossiers for the Disc Golf Pro Tour with historical PDGA stats.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const players = getPlayers();

  return (
    <PageShell>
      <SmoothScroll />
      <Hero />
      <FeaturedPlayers players={players} />
      <ScheduleRail events={eliteSeries} />
      <PlayerDirectory players={players} compact />
      <section className="fp-section fp-close">
        <h2>Follow the flight.</h2>
        <p>
          Every line on this ledger comes from the PDGA API and the official
          Elite Series calendar.
        </p>
        <a
          className="fp-cta-enter"
          href="https://www.pdga.com/elite-series"
          target="_blank"
          rel="noreferrer"
        >
          PDGA Elite Series
        </a>
      </section>
    </PageShell>
  );
}
