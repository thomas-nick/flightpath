import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PlayerProfile } from "../../components/flightpath/player-profile";
import { PageShell } from "../../components/flightpath/site-chrome";
import finishesJson from "../../data/finishes.json";
import type { FinishBundle } from "../../lib/player-analytics";
import {
  getPlayerBySlug,
  playerName,
  type Player,
  type YearStat,
} from "../../lib/players";

const finishesMap = finishesJson as Record<string, FinishBundle>;

const loadPlayerDossier = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const base = getPlayerBySlug(data.slug);
    if (!base) return null;

    const finishes = finishesMap[base.pdga_number] ?? null;
    let player: Player = base;

    // Live refresh when credentials are present; fall back to cache.
    try {
      const { fetchPlayer, fetchPlayerStatistics } = await import(
        "../../lib/pdga.server"
      );
      const [live, stats] = await Promise.all([
        fetchPlayer(base.pdga_number),
        fetchPlayerStatistics(base.pdga_number),
      ]);
      if (live) {
        const yearStats = (stats as YearStat[]).sort(
          (a, b) => Number(a.year) - Number(b.year),
        );
        player = {
          ...base,
          first_name: live.first_name || base.first_name,
          last_name: live.last_name || base.last_name,
          city: live.city ?? base.city,
          state_prov: live.state_prov ?? base.state_prov,
          country: live.country ?? base.country,
          classification: live.classification ?? base.classification,
          membership_status: live.membership_status ?? base.membership_status,
          rating: live.rating ?? base.rating,
          rating_effective_date:
            live.rating_effective_date ?? base.rating_effective_date,
          official_status: live.official_status ?? base.official_status,
          upcoming_events: live.upcoming_events ?? base.upcoming_events,
          stats: yearStats.length ? yearStats : base.stats,
          career: {
            years_active: yearStats.length || base.career.years_active,
            tournaments: yearStats.length
              ? yearStats.reduce((n, s) => n + Number(s.tournaments || 0), 0)
              : base.career.tournaments,
            points: yearStats.length
              ? yearStats.reduce((n, s) => n + Number(s.points || 0), 0)
              : base.career.points,
            prize: yearStats.length
              ? yearStats.reduce((n, s) => n + Number(s.prize || 0), 0)
              : base.career.prize,
            peak_rating: yearStats.length
              ? Math.max(
                  ...yearStats.map((s) => Number(s.rating || 0)),
                  Number(live.rating || 0),
                )
              : base.career.peak_rating,
            latest_year: yearStats.length
              ? yearStats[yearStats.length - 1]?.year ?? null
              : base.career.latest_year,
          },
        };
      }
    } catch {
      // keep cached player
    }

    return { player, finishes };
  });

export const Route = createFileRoute("/players/$slug")({
  loader: async ({ params }) => {
    const dossier = await loadPlayerDossier({ data: { slug: params.slug } });
    if (!dossier) throw notFound();
    return dossier;
  },
  head: ({ loaderData }) => {
    const player = loaderData?.player;
    const name = player ? playerName(player) : "Player";
    return {
      meta: [
        { title: `${name} — Flightpath` },
        {
          name: "description",
          content: `Historical PDGA stats, podiums, top 10s, and career graphs for ${name}.`,
        },
      ],
    };
  },
  component: PlayerPage,
});

function PlayerPage() {
  const { player, finishes } = Route.useLoaderData();
  return (
    <PageShell>
      <PlayerProfile player={player} finishes={finishes} />
    </PageShell>
  );
}
