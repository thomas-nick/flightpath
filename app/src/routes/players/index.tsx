import { createFileRoute } from "@tanstack/react-router";
import { AsiaLeaderboard } from "../../components/flightpath/asia-leaderboard";
import { PageShell } from "../../components/flightpath/site-chrome";
import { getAsiaBoard } from "../../lib/asia";

export const Route = createFileRoute("/players/")({
  head: () => {
    const board = getAsiaBoard();
    return {
      meta: [
        { title: "Asia Players — Flightpath Asia" },
        {
          name: "description",
          content: `Browse ${board.total_players} Asia disc golf players with PDGA tournament stats, wins, and class splits.`,
        },
      ],
    };
  },
  component: PlayersIndex,
});

function PlayersIndex() {
  return (
    <PageShell>
      <div className="fp-page-top">
        <h1>Asia player directory</h1>
        <p className="fp-hero-sub">
          Open any dossier for ratings, class toggles, charts, and Asia tournament history.
          Leagues are excluded from the archive.
        </p>
      </div>
      <AsiaLeaderboard />
    </PageShell>
  );
}
