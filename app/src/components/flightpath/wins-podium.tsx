export function WinsPodium({
  wins,
  podiums,
  top10,
  ariaLabel = "Wins podium",
}: {
  wins: string;
  podiums: string;
  top10: string;
  ariaLabel?: string;
}) {
  return (
    <div className="fp-wins-podium" role="figure" aria-label={ariaLabel}>
      <div className="fp-wins-step fp-wins-2nd">
        <span className="fp-wins-step-num">{podiums}</span>
        <span className="fp-wins-step-label">Podiums</span>
      </div>
      <div className="fp-wins-step fp-wins-1st">
        <span className="fp-wins-step-num">{wins}</span>
        <span className="fp-wins-step-label">Wins</span>
      </div>
      <div className="fp-wins-step fp-wins-3rd">
        <span className="fp-wins-step-num">{top10}</span>
        <span className="fp-wins-step-label">Top 10</span>
      </div>
    </div>
  );
}
