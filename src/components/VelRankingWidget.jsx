// src/components/VelRankingWidget.jsx
const CHART_BG = '#111118';
const WIN_COLOR = '#69db7c';

export function VelRankingWidget({ sessions }) {
  if (!sessions || sessions.length === 0) return null;

  const sorted = [...sessions]
    .filter(s => s.stats && s.stats.meanV != null && !isNaN(s.stats.meanV))
    .sort((a, b) => b.stats.meanV - a.stats.meanV);
  if (sorted.length === 0) return null;
  const best = sorted[0].stats.meanV;
  const worst = sorted[sorted.length - 1].stats.meanV;
  const range = best - worst || 1;
  const single = sorted.length === 1;

  return (
    <div style={{ background: CHART_BG, borderRadius: 8, padding: '14px 16px' }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 12 }}>
        Mean FPS — higher is better
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map((sess, i) => {
          const isWinner = i === 0;
          const barPct = single ? 100 : ((sess.stats.meanV - worst) / range) * 100;
          const delta = best - sess.stats.meanV;
          const dimOpacity = isWinner ? 1 : i === 1 ? 0.6 : 0.45;
          const numSize = isWinner ? 22 : 18;
          const color = isWinner ? WIN_COLOR : sess.color;

          return (
            <div key={`${sess.name}-${i}`} style={{
              padding: '9px 11px',
              borderRadius: 6,
              background: isWinner ? 'rgba(105,219,124,0.10)' : i === 1 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.015)',
              border: isWinner ? '1px solid rgba(105,219,124,0.25)' : '1px solid rgba(255,255,255,0.05)',
              boxShadow: isWinner ? '0 0 16px rgba(105,219,124,0.08)' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: color,
                    opacity: dimOpacity,
                    boxShadow: isWinner ? `0 0 6px rgba(105,219,124,0.8)` : 'none',
                    flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: `rgba(255,255,255,${dimOpacity * 0.8})`, fontFamily: 'ui-monospace,monospace' }}>
                    {single ? 'This Session' : sess.name}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: numSize, fontWeight: 900, color, opacity: dimOpacity, fontFamily: 'ui-monospace,monospace', lineHeight: 1 }}>
                    {sess.stats.meanV.toFixed(1)}
                  </span>
                  {isWinner && !single && (
                    <span style={{ fontSize: 9, fontWeight: 800, color: WIN_COLOR, letterSpacing: '0.08em' }}>fps ✦ BEST</span>
                  )}
                  {!isWinner && !single && (
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: 'ui-monospace,monospace' }}>
                      −{delta.toFixed(1)}
                    </span>
                  )}
                  {single && (
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em' }}>fps</span>
                  )}
                </div>
              </div>
              <div style={{ height: isWinner ? 8 : 6, borderRadius: 3, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${barPct}%`,
                  borderRadius: 3,
                  background: isWinner
                    ? `linear-gradient(90deg, rgba(105,219,124,0.6), ${WIN_COLOR})`
                    : color,
                  opacity: isWinner ? 1 : dimOpacity * 0.5,
                  boxShadow: isWinner ? '0 0 8px rgba(105,219,124,0.4)' : 'none',
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)' }}>bars show relative gap</span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)', fontFamily: 'ui-monospace,monospace' }}>fps</span>
      </div>
    </div>
  );
}
