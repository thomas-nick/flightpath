import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AsiaPlayerProfileView } from "../../components/flightpath/asia-player-profile";
import { PageShell } from "../../components/flightpath/site-chrome";
import {
  cashFromResults,
  getAsiaPlayerBySlug,
  getAsiaTourStanding,
  playerDisplayName,
} from "../../lib/asia";
import { loadAsiaProfile } from "../../lib/asia-profiles";
import { fetchPdgaCareerHeader } from "../../lib/pdga-career.server";

const loadAsiaDossier = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().min(1) }))
  .handler(async ({ data }) => {
    const boardPlayer = getAsiaPlayerBySlug(data.slug);
    if (!boardPlayer) return null;
    const profile = await loadAsiaProfile(boardPlayer.pdga);
    if (!profile) return null;

    const career = await fetchPdgaCareerHeader(boardPlayer.pdga);
    const tourStanding = getAsiaTourStanding(boardPlayer.pdga);
    const cash =
      boardPlayer.cash_earned ??
      profile.cash_earned ??
      cashFromResults(profile.results);
    return {
      player: {
        ...profile,
        slug: boardPlayer.slug,
        rating: career?.rating ?? profile.rating ?? boardPlayer.rating,
        classification: career?.classification || profile.classification,
        city: career?.city || profile.city,
        pdga_rank: boardPlayer.pdga_rank ?? profile.pdga_rank,
        weighted_rank: boardPlayer.weighted_rank ?? profile.weighted_rank,
        country_rank: boardPlayer.country_rank ?? profile.country_rank,
        cash_earned: cash,
        streak: boardPlayer.streak ?? profile.streak,
        tour_weighted_points:
          boardPlayer.tour_weighted_points ?? profile.tour_weighted_points,
        tour_standing: tourStanding,
        pdga_career: career ?? undefined,
      },
      accent: (boardPlayer.pdga_rank || 0) % 6,
    };
  });

export const Route = createFileRoute("/players/$slug")({
  loader: async ({ params }) => {
    const dossier = await loadAsiaDossier({ data: { slug: params.slug } });
    if (!dossier) throw notFound();
    return dossier;
  },
  head: ({ loaderData }) => {
    const name = loaderData
      ? playerDisplayName(loaderData.player.name)
      : "Player";
    const careerWins = loaderData?.player.pdga_career?.career_wins;
    const asiaWins = loaderData?.player.wins;
    return {
      meta: [
        { title: `${name} — Flightpath Asia` },
        {
          name: "description",
          content: loaderData
            ? `${name}: ${asiaWins ?? 0} Asia-archive wins` +
              (careerWins != null ? ` · ${careerWins} PDGA career wins` : "") +
              ` · ${loaderData.player.events_played} Asia tournaments tracked.`
            : "Asia disc golf player dossier.",
        },
      ],
    };
  },
  component: PlayerPage,
});

function PlayerPage() {
  const { player, accent } = Route.useLoaderData();
  return (
    <PageShell>
      <AsiaPlayerProfileView player={player} accent={accent} />
    </PageShell>
  );
}
