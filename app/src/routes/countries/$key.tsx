import { createFileRoute, notFound } from "@tanstack/react-router";
import { CountryHubView } from "../../components/flightpath/country-hub";
import { PageShell } from "../../components/flightpath/site-chrome";
import { getAsiaCountryHub } from "../../lib/asia-countries";

export const Route = createFileRoute("/countries/$key")({
  loader: ({ params }) => {
    const data = getAsiaCountryHub(params.key);
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    const hub = loaderData?.hub;
    return {
      meta: [
        {
          title: hub
            ? `${hub.name} Disc Golf — Flightpath Asia`
            : "Country — Flightpath Asia",
        },
        {
          name: "description",
          content: hub
            ? `${hub.name}: ${hub.playerCount} players and ${hub.eventCount} hosted Asia-archive tournaments.`
            : "Asia disc golf country hub.",
        },
      ],
    };
  },
  component: CountryPage,
});

function CountryPage() {
  const data = Route.useLoaderData();
  return (
    <PageShell>
      <CountryHubView data={data} />
    </PageShell>
  );
}
