/** Flag-first avatar tile — country emoji as the mark, not a photo likeness. */
export function AsiaAvatar({
  flag,
  rank,
  size = "md",
  label,
}: {
  name?: string;
  pdga?: number;
  flag?: string;
  rank?: number | string;
  size?: "sm" | "md" | "lg";
  /** Accessible country/name hint when flag alone is unclear. */
  label?: string;
}) {
  const mark = flag && flag !== "🌐" ? flag : "🌐";
  return (
    <div
      className={`fp-avatar fp-avatar-flagtile fp-avatar-${size}`}
      title={label}
      aria-hidden
    >
      <span className="fp-avatar-flag-main">{mark}</span>
      {rank != null ? <span className="fp-avatar-rank">{rank}</span> : null}
    </div>
  );
}
