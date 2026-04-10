// src/components/AccuracyRankingWidget.jsx
const CHART_BG = '#111118';
const WIN_COLOR = '#69db7c';
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
    sessions.forEach((_, i) => {
      scores[i] += (vals[i] - best) / range;
    });
  });
  return scores;
}

export function AccuracyRankingWidget({ sessions }) {
  if (!sessions || sessions.length === 0) return null;

  const valid = sessions.filter(s =>
    s.stats &&
    METRICS.every(({ key }) => s.stats[key] != null && !isNaN(s.stats[key]))
  );
  if (valid.length === 0) return null;

  const single = valid.length === 1;

  let sorted;
  if (single) {
    sorted = valid;
  } else {
    const scores = computeScores(valid);
    sorted = valid
      .map((s, i) => ({ ...s, _score: scores[i] }))
      .sort((a, b) => a._score - b._score);
  }

  return (
    <div style={{ background: CHART_BG, borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 12 }}>
        CEP · SD X · SD Y — lower is better
      </div>

      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr', gap: 6, marginBottom: 6, padding: '0 4px' }}>
        <div />
        {METRICS.map(m => (
          <div key={m.key} style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
            {m.label}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {sorted.map((sess, rank) => {
          const isWinner = rank === 0 && !single;
          const dimOpacity = isWinner ? 1 : rank === 1 ? 0.6 : 0.45;

          return (
            <div key={`${sess.name}-${rank}`} style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr 1fr 1fr',
              gap: 6,
              alignItems: 'center',
              padding: '9px 8px',
              borderRadius: 6,
              background: isWinner ? 'rgba(105,219,124,0.10)' : rank === 1 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.015)',
              border: isWinner ? '1px solid rgba(105,219,124,0.25)' : '1px solid rgba(255,255,255,0.05)',
              boxShadow: isWinner ? '0 0 16px rgba(105,219,124,0.08)' : 'none',
            }}>
              {/* Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: sess.color,
                  opacity: dimOpacity,
                }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: `rgba(255,255,255,${dimOpacity * 0.8})`, fontFamily: 'ui-monospace,monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sess.name ?? '—'}
                </span>
              </div>

              {/* Metric cells */}
              {METRICS.map(({ key, decimals }) => {
                const allVals = valid.map(s => s.stats[key]);
                const best = Math.min(...allVals);
                const worst = Math.max(...allVals);
                const range = worst - best || 1;
                const barPct = single ? 0 : Math.min(100, ((sess.stats[key] - best) / range) * 100);
                const cellColor = sess.color;

                return (
                  <div key={key} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: isWinner ? 13 : 12, fontWeight: isWinner ? 900 : 700, color: cellColor, opacity: dimOpacity, fontFamily: 'ui-monospace,monospace', lineHeight: 1.2 }}>
                      {sess.stats[key].toFixed(decimals)}
                    </div>
                    {!single && (
                      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.05)', marginTop: 4, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${barPct}%`,
                          borderRadius: 2,
                          background: cellColor,
                          opacity: isWinner ? 0.8 : 0.35,
                          boxShadow: isWinner && barPct < 5 ? '0 0 4px rgba(105,219,124,0.5)' : 'none',
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {!single && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)' }}>bars fill toward worst — shorter = better</span>
        </div>
      )}
    </div>
  );
}
