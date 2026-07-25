import { createFileRoute } from "@tanstack/react-router";
import { CountryGrid } from "../../components/flightpath/country-grid";
import { PageShell } from "../../components/flightpath/site-chrome";
import { listAsiaCountryHubs } from "../../lib/asia-countries";

export const Route = createFileRoute("/countries/")({
  head: () => {
    const hubs = listAsiaCountryHubs();
    return {
      meta: [
        { title: "Countries — Flightpath Asia" },
        {
          name: "description",
          content: `Explore ${hubs.length} Asian disc golf country hubs — leaders, hosted events, and national boards.`,
        },
      ],
    };
  },
  component: CountriesIndex,
});

function CountriesIndex() {
  const hubs = listAsiaCountryHubs();
  return (
    <PageShell>
      <div className="fp-page-top">
        <h1>Country hubs</h1>
        <p className="fp-hero-sub">
          {hubs.length} countries with players in the Asia tournament archive. Open a hub for
          national leaders and events hosted there.
        </p>
      </div>
      <CountryGrid
        title="Browse by country"
        subtitle="Retro country heroes with national flags — boards and hosted events inside."
      />
    </PageShell>
  );
}
