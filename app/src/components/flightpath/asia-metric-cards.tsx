"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { formatNumber, type AsiaResult } from "../../lib/asia";
import {
  filterResults,
  type AsiaClassView,
  type AsiaPlayerProfile,
} from "../../lib/asia-profiles";

const green = "#2F6B52";
const greenSoft = "rgba(47, 107, 82, 0.18)";
const lime = "#C6E85A";

function MetricCard({
  value,
  label,
  children,
}: {
  value: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <article className="fp-metric-card">
      <header className="fp-metric-card-head">
        <p className="fp-metric-value">{value}</p>
        <p className="fp-metric-label">{label}</p>
      </header>
      <div className="fp-metric-viz">{children}</div>
    </article>
  );
}

function GaugeArc({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(1, pct));
  const r = 54;
  const c = 2 * Math.PI * r;
  const half = c / 2;
  const filled = half * clamped;
  return (
    <svg className="fp-metric-gauge" viewBox="0 0 140 86" aria-hidden>
      <g transform="translate(70 72)">
        <circle
          r={r}
          fill="none"
          stroke={greenSoft}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${half} ${c}`}
          transform="rotate(180)"
        />
        <circle
          r={r}
          fill="none"
          stroke={green}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          transform="rotate(180)"
        />
        <circle
          r="3.5"
          fill={green}
          transform={`rotate(${180 + clamped * 180}) translate(${r} 0)`}
        />
      </g>
    </svg>
  );
}

function SparkLine({
  data,
  halo = false,
}: {
  data: Array<{ i: number; v: number }>;
  halo?: boolean;
}) {
  if (data.length < 2) {
    return <div className="fp-metric-empty">Not enough data yet</div>;
  }
  return (
    <div className="fp-metric-spark">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 14, right: 18, left: 6, bottom: 6 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={green}
            strokeWidth={3}
            isAnimationActive={false}
            dot={(props) => {
              const { cx, cy, index } = props;
              if (index !== data.length - 1 || cx == null || cy == null) {
                return <g key={`d-${index}`} />;
              }
              return (
                <g key="end">
                  {halo ? <circle cx={cx} cy={cy} r={15} fill={greenSoft} /> : null}
                  <circle cx={cx} cy={cy} r={5.5} fill={green} />
                  {halo ? (
                    <circle cx={cx} cy={cy} r={5.5} fill={lime} opacity={0.4} />
                  ) : null}
                </g>
              );
            }}
            activeDot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function DotGrid({ results }: { results: AsiaResult[] }) {
  const cells = useMemo(() => {
    const recent = [...results].slice(0, 48).reverse();
    const target = 48;
    const padded: Array<number | null> = [
      ...Array(Math.max(0, target - recent.length)).fill(null),
      ...recent.map((r) => r.place),
    ].slice(-target);

    return padded.map((place, i) => {
      if (place == null) return { key: `e-${i}`, tone: "empty" as const };
      if (place === 1) return { key: `p-${i}`, tone: "hot" as const };
      if (place <= 3) return { key: `p-${i}`, tone: "mid" as const };
      if (place <= 10) return { key: `p-${i}`, tone: "soft" as const };
      return { key: `p-${i}`, tone: "faint" as const };
    });
  }, [results]);

  return (
    <div className="fp-metric-dots" aria-hidden>
      {cells.map((c) => (
        <span key={c.key} className={`fp-metric-dot fp-metric-dot-${c.tone}`} />
      ))}
    </div>
  );
}

export function AsiaMetricCards({
  player,
  view,
  results,
}: {
  player: AsiaPlayerProfile;
  view: AsiaClassView;
  results: AsiaResult[];
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const rows = useMemo(
    () => filterResults(player.results || [], view).slice().reverse(),
    [player.results, view],
  );

  const winRate = useMemo(() => {
    if (!rows.length) return 0;
    return rows.filter((r) => r.place === 1).length / rows.length;
  }, [rows]);

  const pointsSeries = useMemo(() => {
    let total = 0;
    return rows.map((r, i) => {
      total += r.pdga_points || 0;
      return { i, v: Math.round(total * 10) / 10 };
    });
  }, [rows]);

  const ratingSeries = useMemo(() => {
    const hist = player.rating_history || [];
    if (hist.length < 2) return [];
    return hist.map((h, i) => ({ i, v: h.rating }));
  }, [player.rating_history]);

  const band =
    view === "open_mpo"
      ? "MPO"
      : view === "open_fpo"
        ? "FPO"
        : view === "amateur"
          ? "Amateur"
          : "All";

  const pointsDelta = pointsSeries.length
    ? pointsSeries[pointsSeries.length - 1]!.v
    : 0;
  const ratingDelta =
    ratingSeries.length >= 2
      ? ratingSeries[ratingSeries.length - 1]!.v - ratingSeries[0]!.v
      : 0;

  if (!ready) {
    return (
      <section className="fp-metric-grid" aria-label="Performance metrics">
        <div className="fp-metric-card fp-metric-skeleton" />
        <div className="fp-metric-card fp-metric-skeleton" />
        <div className="fp-metric-card fp-metric-skeleton" />
        <div className="fp-metric-card fp-metric-skeleton" />
      </section>
    );
  }

  return (
    <section className="fp-metric-grid" aria-label="Performance metrics">
      <MetricCard value={`${Math.round(winRate * 100)}%`} label={`Win rate · ${band}`}>
        <GaugeArc pct={winRate} />
      </MetricCard>

      <MetricCard
        value={`+${formatNumber(Math.round(pointsDelta))}`}
        label="PDGA points · Asia archive"
      >
        <SparkLine data={pointsSeries} />
      </MetricCard>

      <MetricCard
        value={`${ratingDelta >= 0 ? "+" : ""}${Math.round(ratingDelta)}`}
        label="Rating change · tracked"
      >
        <SparkLine data={ratingSeries} halo />
      </MetricCard>

      <MetricCard
        value={formatNumber(rows.length)}
        label="Finish heat · recent Asia starts"
      >
        <DotGrid results={[...rows].reverse()} />
      </MetricCard>
    </section>
  );
}
