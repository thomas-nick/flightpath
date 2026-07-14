import { useEffect, useState, type ReactNode } from "react";
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
import {
  finishTrend,
  placeHistogramBars,
  ratingTrend,
  yearlySeries,
  type FinishSplit,
  type FinishBundle,
} from "../../lib/player-analytics";
import { formatMoney, type Player } from "../../lib/players";

const ink = "#121816";
const pine = "#16382C";
const lime = "#C6E85A";
const mist = "#8AA396";

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

export function PlayerCharts({
  player,
  finishes,
  split,
}: {
  player: Player;
  finishes: FinishBundle | null;
  split: FinishSplit | null;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const years = yearlySeries(player.stats);
  const finishYears = finishTrend(split?.year_finishes);
  const rating = ratingTrend(finishes, player);
  const hist = placeHistogramBars(split?.finishes);
  const band = split?.label || "All";

  if (!ready) {
    return (
      <section className="fp-charts" aria-label="Performance charts">
        <div className="fp-section-head">
          <h2>Performance graphs</h2>
          <p className="fp-muted">Loading chart canvas…</p>
        </div>
      </section>
    );
  }

  return (
    <section className="fp-charts" aria-label="Performance charts">
      <div className="fp-section-head">
        <h2>Performance graphs</h2>
        <p className="fp-muted">
          Showing {band} finishes · rating path stays career-wide
        </p>
      </div>

      <div className="fp-chart-grid">
        <ChartFrame
          title="Rating trajectory"
          subtitle={
            finishes?.rating_history?.length
              ? "Official PDGA rating updates"
              : "Year-end ratings from PDGA player statistics"
          }
        >
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={rating}>
              <defs>
                <linearGradient id="fpRating" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lime} stopOpacity={0.7} />
                  <stop offset="100%" stopColor={lime} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(18,24,22,0.08)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: mist, fontSize: 11 }} minTickGap={28} />
              <YAxis
                domain={["dataMin - 15", "dataMax + 10"]}
                tick={{ fill: mist, fontSize: 11 }}
                width={42}
              />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "1px solid rgba(18,24,22,0.08)",
                  borderRadius: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="rating"
                stroke={pine}
                fill="url(#fpRating)"
                strokeWidth={2.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartFrame>

        <ChartFrame title="Season earnings & events" subtitle="PDGA year statistics">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={years}>
              <CartesianGrid stroke="rgba(18,24,22,0.08)" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: mist, fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                tick={{ fill: mist, fontSize: 11 }}
                width={48}
                tickFormatter={(v) =>
                  v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                }
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: mist, fontSize: 11 }}
                width={28}
              />
              <Tooltip
                formatter={(value, name) => {
                  if (name === "prize") return [formatMoney(Number(value)), "Prize"];
                  if (name === "events") return [value, "Events"];
                  return [value, String(name)];
                }}
                contentStyle={{
                  background: "#fff",
                  border: "1px solid rgba(18,24,22,0.08)",
                  borderRadius: 12,
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="prize" name="prize" fill={pine} radius={[8, 8, 0, 0]} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="events"
                name="events"
                stroke={lime}
                strokeWidth={3}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartFrame>

        {finishYears.length ? (
          <ChartFrame
            title={`${band}: wins · podiums · top 10s`}
            subtitle="Tracked PDGA event results in this class"
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={finishYears}>
                <CartesianGrid stroke="rgba(18,24,22,0.08)" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: mist, fontSize: 11 }} />
                <YAxis tick={{ fill: mist, fontSize: 11 }} width={28} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid rgba(18,24,22,0.08)",
                    borderRadius: 12,
                  }}
                />
                <Legend />
                <Bar dataKey="wins" fill={lime} name="Wins" />
                <Bar dataKey="podiums" fill={pine} name="Podiums" />
                <Bar dataKey="top10" fill={mist} name="Top 10" />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        ) : null}

        {hist.some((h) => h.count > 0) ? (
          <ChartFrame
            title={`${band}: finish distribution`}
            subtitle="How often they land each place band"
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={hist}>
                <CartesianGrid stroke="rgba(18,24,22,0.08)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: mist, fontSize: 11 }} />
                <YAxis tick={{ fill: mist, fontSize: 11 }} width={28} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid rgba(18,24,22,0.08)",
                    borderRadius: 12,
                  }}
                />
                <Bar dataKey="count" fill={ink} radius={[8, 8, 0, 0]} name="Starts" />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        ) : null}

        <ChartFrame title="Points by season" subtitle="PDGA points earned each year">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={years}>
              <CartesianGrid stroke="rgba(18,24,22,0.08)" vertical={false} />
              <XAxis dataKey="year" tick={{ fill: mist, fontSize: 11 }} />
              <YAxis
                tick={{ fill: mist, fontSize: 11 }}
                width={48}
                tickFormatter={(v) =>
                  v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
                }
              />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "1px solid rgba(18,24,22,0.08)",
                  borderRadius: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="points"
                stroke={pine}
                fill="rgba(22,56,44,0.18)"
                strokeWidth={2.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartFrame>

        {finishYears.some((y) => y.avg_place != null) ? (
          <ChartFrame
            title={`${band}: average finish`}
            subtitle="Lower is better · tracked seasons only"
          >
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={finishYears.filter((y) => y.avg_place != null)}>
                <CartesianGrid stroke="rgba(18,24,22,0.08)" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: mist, fontSize: 11 }} />
                <YAxis
                  reversed
                  tick={{ fill: mist, fontSize: 11 }}
                  width={28}
                  domain={[1, "dataMax + 2"]}
                />
                <Tooltip
                  contentStyle={{
                    background: "#fff",
                    border: "1px solid rgba(18,24,22,0.08)",
                    borderRadius: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="avg_place"
                  stroke={pine}
                  strokeWidth={3}
                  dot={{ r: 3, fill: lime }}
                  name="Avg place"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </ChartFrame>
        ) : null}
      </div>
    </section>
  );
}
