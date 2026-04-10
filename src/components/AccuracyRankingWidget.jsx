// src/components/AccuracyRankingWidget.jsx
const METRICS = [
  { key: 'cep',  label: 'CEP',  decimals: 3 },
  { key: 'sdX',  label: 'SD X', decimals: 3 },
  { key: 'sdY',  label: 'SD Y', decimals: 3 },
];

function computeScores(sessions) {
  const scores = sessions.map(() => 0);
  METRICS.forEach(({ key }) => {
    const vals = sessions.map(s => s.stats[key]);
    const best = Math.min(...vals);
    const worst = Math.max(...vals);
    const range = worst - best || 1;
    sessions.forEach((_, i) => { scores[i] += (vals[i] - best) / range; });
  });
  return scores;
}

export function AccuracyRankingWidget({ sessions }) {
  if (!sessions || sessions.length === 0) return null;

  const valid = sessions.filter(s =>
    s.stats && METRICS.every(({ key }) => s.stats[key] != null && !isNaN(s.stats[key]))
  );
  if (valid.length === 0) return null;

  const single = valid.length === 1;
  const sorted = single
    ? valid
    : valid.map((s, i) => ({ ...s, _score: computeScores(valid)[i] })).sort((a, b) => a._score - b._score);

  return (
    <div>
      <div className="px-2.5 py-2 border-b border-border">
        <span className="text-sm font-bold uppercase tracking-wide">Std Dev</span>
        <span className="text-[11px] text-muted-foreground ml-1.5">lower is better</span>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Session</th>
            {METRICS.map(m => (
              <th key={m.key} className="text-right px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{m.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((sess, rank) => {
            const isBest = rank === 0 && !single;
            return (
              <tr key={`${sess.name}-${rank}`} className="border-b border-border odd:bg-secondary/30"
                style={isBest ? { backgroundColor: `${sess.color}18` } : undefined}>
                <td className="px-2.5 py-2.5 text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: sess.color }} />
                    {sess.name ?? '—'}
                  </span>
                </td>
                {METRICS.map(({ key, decimals }) => {
                  const allVals = valid.map(s => s.stats[key]);
                  const bestVal = Math.min(...allVals);
                  const isColBest = sess.stats[key] === bestVal && allVals.filter(x => x === bestVal).length === 1;
                  return (
                    <td key={key} className="px-2.5 py-2.5 text-right font-mono font-semibold text-sm"
                      style={isColBest ? { color: sess.color } : undefined}>
                      {sess.stats[key].toFixed(decimals)}{isColBest && !single ? ' ✦' : ''}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
