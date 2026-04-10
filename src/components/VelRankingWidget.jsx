// src/components/VelRankingWidget.jsx
export function VelRankingWidget({ sessions }) {
  if (!sessions || sessions.length === 0) return null;

  const sorted = [...sessions]
    .filter(s => s.stats && s.stats.meanV != null && !isNaN(s.stats.meanV))
    .sort((a, b) => b.stats.meanV - a.stats.meanV);
  if (sorted.length === 0) return null;

  const best = sorted[0].stats.meanV;
  const single = sorted.length === 1;

  return (
    <div>
      <div className="px-2.5 py-2 border-b border-border">
        <span className="text-sm font-bold uppercase tracking-wide">Mean FPS</span>
        <span className="text-[11px] text-muted-foreground ml-1.5">higher is better</span>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Session</th>
            <th className="text-right px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">FPS</th>
            {!single && <th className="text-right px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Delta</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((sess, i) => {
            const isBest = i === 0 && !single;
            return (
              <tr key={`${sess.name}-${i}`} className="border-b border-border odd:bg-secondary/30"
                style={isBest ? { backgroundColor: `${sess.color}18` } : undefined}>
                <td className="px-2.5 py-2.5 text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: sess.color }} />
                    {single ? 'This Session' : sess.name}
                  </span>
                </td>
                <td className="px-2.5 py-2.5 text-right font-mono font-semibold text-sm" style={isBest ? { color: sess.color } : undefined}>
                  {sess.stats.meanV.toFixed(1)}{isBest ? ' ✦' : ''}
                </td>
                {!single && (
                  <td className="px-2.5 py-2.5 text-right font-mono text-sm text-muted-foreground">
                    {i === 0 ? '—' : `−${(best - sess.stats.meanV).toFixed(1)}`}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
