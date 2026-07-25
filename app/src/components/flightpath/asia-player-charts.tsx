import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AsiaResult } from "../../lib/asia";
import {
  filterResults,
  type AsiaClassView,
  type AsiaPlayerProfile,
} from "../../lib/asia-profiles";

const pine = "#16382C";
const lime = "#C6E85A";
const mist = "#8AA396";
const ink = "#121816";

function ChartFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="fp-chart-card">
      <div className="fp-chart-head">
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="fp-chart-body">{children}</div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="fp-chart-empty">
      <p>Not enough Asia data yet</p>
      <span>{label}</span>
    </div>
  );
}

export function AsiaPlayerCharts({
  player,
  view,
  results,
}: {
  player: AsiaPlayerProfile;
  view: AsiaClassView;
  results: AsiaResult[];
}) {
  const [ready, setReady] = useState(false);
  const [showSecondary, setShowSecondary] = useState(false);
  useEffect(() => setReady(true), []);

  const years = useMemo(() => {
    const map = new Map<
      string,
      {
        year: string;
        events: number;
        wins: number;
        podiums: number;
        top10: number;
        pdga_points: number;
        places: number[];
      }
    >();
    for (const r of filterResults(player.results || [], view)) {
      const y = r.year || "?";
      const slot = map.get(y) ?? {
        year: y,
        events: 0,
        wins: 0,
        podiums: 0,
        top10: 0,
        pdga_points: 0,
        places: [],
      };
      slot.events += 1;
      slot.pdga_points += r.pdga_points || 0;
      slot.places.push(r.place);
      if (r.place === 1) slot.wins += 1;
      if (r.place <= 3) slot.podiums += 1;
      if (r.place <= 10) slot.top10 += 1;
      map.set(y, slot);
    }
    return [...map.values()]
      .map(({ places, ...rest }) => ({
        ...rest,
        avg_finish: places.length
          ? Math.round((places.reduce((a, b) => a + b, 0) / places.length) * 10) / 10
          : null,
      }))
      .sort((a, b) => a.year.localeCompare(b.year));
  }, [player.results, view]);

  const rating = useMemo(() => {
    const hist = player.rating_history || [];
    if (hist.length >= 2) {
      return hist.map((h) => ({ label: h.date.slice(0, 7), rating: h.rating }));
    }
    if (player.rating != null) return [{ label: "Now", rating: player.rating }];
    return [];
  }, [player.rating, player.rating_history]);

  const hist = useMemo(() => {
    const bands = [
      { label: "1", min: 1, max: 1 },
      { label: "2–3", min: 2, max: 3 },
      { label: "4–5", min: 4, max: 5 },
      { label: "6–10", min: 6, max: 10 },
      { label: "11–20", min: 11, max: 20 },
      { label: "21+", min: 21, max: 9999 },
    ];
    return bands.map((b) => ({
      label: b.label,
      count: results.filter((r) => r.place >= b.min && r.place <= b.max).length,
    }));
  }, [results]);

  const band =
    view === "open_mpo"
      ? "MPO"
      : view === "open_fpo"
        ? "FPO"
        : view === "amateur"
          ? "Amateur"
          : "All";

  if (!ready) {
    return (
      <section className="fp-charts">
        <div className="fp-section-head">
          <h2>Performance graphs</h2>
          <p className="fp-muted">Loading chart canvas…</p>
        </div>
        <div className="fp-chart-grid fp-chart-grid-primary">
          <div className="fp-chart-card fp-metric-skeleton" style={{ minHeight: 300 }} />
          <div className="fp-chart-card fp-metric-skeleton" style={{ minHeight: 300 }} />
        </div>
      </section>
    );
  }

  const secondary = (
    <div className="fp-chart-grid fp-chart-grid-secondary">
      <ChartFrame title="Wins · podiums · top 10" subtitle="By year">
        {years.length ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={years}>
              <CartesianGrid stroke="rgba(18,24,22,0.08)" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: mist, fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fill: mist, fontSize: 11 }} width={28} />
              <Tooltip />
              <Legend />
              <Bar dataKey="wins" name="Wins" fill={lime} />
              <Bar dataKey="podiums" name="Podiums" fill={pine} />
              <Bar dataKey="top10" name="Top 10" fill={mist} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart label="Need finishes to chart placings" />
        )}
      </ChartFrame>

      <ChartFrame title="Finish distribution" subtitle={`${band} place bands`}>
        {results.length ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={hist}>
              <CartesianGrid stroke="rgba(18,24,22,0.08)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: mist, fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fill: mist, fontSize: 11 }} width={28} />
              <Tooltip />
              <Bar dataKey="count" name="Finishes" fill={pine} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart label="No place bands in this class" />
        )}
      </ChartFrame>

      <ChartFrame title="Average finish" subtitle="Lower is better">
        {years.some((y) => y.avg_finish != null) ? (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={years}>
              <CartesianGrid stroke="rgba(18,24,22,0.08)" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: mist, fontSize: 11 }} />
              <YAxis reversed tick={{ fill: mist, fontSize: 11 }} width={28} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="avg_finish"
                stroke={ink}
                fill={lime}
                fillOpacity={0.25}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart label="Need yearly finishes for average place" />
        )}
      </ChartFrame>
    </div>
  );

  return (
    <section className="fp-charts" aria-label="Performance charts">
      <div className="fp-section-head">
        <h2>Performance graphs</h2>
        <p className="fp-muted">Showing {band} Asia tournament finishes</p>
      </div>

      <div className="fp-chart-grid fp-chart-grid-primary">
        <ChartFrame title="Rating trajectory" subtitle="PDGA rating updates">
          {rating.length >= 2 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={rating}>
                <defs>
                  <linearGradient id="asiaFpRating" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lime} stopOpacity={0.7} />
                    <stop offset="100%" stopColor={lime} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(18,24,22,0.08)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: mist, fontSize: 11 }} />
                <YAxis
                  domain={["dataMin - 10", "dataMax + 10"]}
                  tick={{ fill: mist, fontSize: 11 }}
                  width={42}
                />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="rating"
                  stroke={pine}
                  fill="url(#asiaFpRating)"
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="Need two rating updates for a trajectory" />
          )}
        </ChartFrame>

        <ChartFrame title="Season points" subtitle="PDGA points by year">
          {years.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={years}>
                <CartesianGrid stroke="rgba(18,24,22,0.08)" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: mist, fontSize: 11 }} />
                <YAxis tick={{ fill: mist, fontSize: 11 }} width={42} />
                <Tooltip />
                <Legend />
                <Bar dataKey="pdga_points" name="Points" fill={pine} radius={[8, 8, 0, 0]} />
                <Line type="monotone" dataKey="events" name="Events" stroke={lime} strokeWidth={3} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="No season points in this class yet" />
          )}
        </ChartFrame>
      </div>

      <div className="fp-chart-secondary-desktop">{secondary}</div>

      <div className="fp-chart-secondary-mobile">
        <button
          type="button"
          className="fp-chart-more"
          aria-expanded={showSecondary}
          onClick={() => setShowSecondary((v) => !v)}
        >
          {showSecondary ? "Hide more charts" : "More charts"}
        </button>
        {showSecondary ? secondary : null}
      </div>
    </section>
  );
}
