import { createFileRoute } from "@tanstack/react-router";
import { PlayerDirectory } from "../../components/flightpath/player-directory";
import { PageShell } from "../../components/flightpath/site-chrome";
import { getPlayers } from "../../lib/players";

export const Route = createFileRoute("/players/")({
  head: () => ({
    meta: [
      { title: "Player Directory — Flightpath" },
      {
        name: "description",
        content:
          "Browse Disc Golf Pro Tour players with PDGA ratings and career stats.",
      },
    ],
  }),
  component: PlayersIndex,
});

function PlayersIndex() {
  return (
    <PageShell>
      <div className="fp-page-top">
        <h1>Player directory</h1>
        <p className="fp-hero-sub">
          Click any pro to open a full historical stats dossier.
        </p>
      </div>
      <PlayerDirectory players={getPlayers()} />
    </PageShell>
  );
}
