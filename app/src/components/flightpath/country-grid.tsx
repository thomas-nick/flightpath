import { Link } from "@tanstack/react-router";
import { formatNumber, playerDisplayName } from "../../lib/asia";
import { listAsiaCountryHubs } from "../../lib/asia-countries";

export function CountryGrid({
  limit,
  title = "Countries",
  subtitle,
}: {
  limit?: number;
  title?: string;
  subtitle?: string;
}) {
  const hubs = listAsiaCountryHubs();
  const rows = limit ? hubs.slice(0, limit) : hubs;
  const rankByKey = new Map(hubs.map((h, i) => [h.key, i + 1]));

  return (
    <section className="fp-section" id="countries">
      <div className="fp-section-head">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p className="fp-muted">{subtitle}</p> : null}
        </div>
        {limit ? (
          <Link to="/countries" className="fp-cta-ghost">
            All countries →
          </Link>
        ) : null}
      </div>

      <div className="fp-country-grid">
        {rows.map((c) => (
          <Link
            key={c.key}
            to="/countries/$key"
            params={{ key: c.slug }}
            className="fp-country-card"
          >
            <div className="fp-country-card-art">
              {(c.photoSrc ?? c.heroSrc) ? (
                <img
                  src={c.photoSrc ?? c.heroSrc ?? ""}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    const el = e.currentTarget;
                    if (el.dataset.fb === "1" || !c.heroSrc) {
                      el.style.display = "none";
                      return;
                    }
                    el.dataset.fb = "1";
                    el.src = c.heroSrc;
                  }}
                />
              ) : (
                <span className="fp-country-card-flag-only" aria-hidden>
                  {c.flag}
                </span>
              )}
              <span className="fp-country-card-flag-badge" aria-hidden>
                {c.flag}
              </span>
              <span className="fp-country-card-rank" aria-hidden>
                #{rankByKey.get(c.key)}
              </span>
            </div>
            <div className="fp-country-card-body">
              <div className="fp-country-card-head">
                <h3>{c.name}</h3>
                {c.firstYear && c.lastYear ? (
                  <span className="fp-country-card-span">
                    {c.firstYear === c.lastYear
                      ? `Since ${c.firstYear}`
                      : `${c.firstYear}–${c.lastYear}`}
                  </span>
                ) : null}
              </div>
              <p className="fp-country-card-spec">
                <span>
                  <strong>{formatNumber(c.playerCount)}</strong> players
                </span>
                <span>
                  <strong>{formatNumber(c.eventCount)}</strong> hosted
                </span>
                {c.courseCount > 0 && (
                  <span>
                    <strong>{formatNumber(c.courseCount)}</strong> courses
                  </span>
                )}
              </p>
              {c.leader ? (
                <p className="fp-country-card-leader">
                  Leader {playerDisplayName(c.leader.name)} →
                </p>
              ) : (
                <p className="fp-country-card-leader fp-muted">No leader yet</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
