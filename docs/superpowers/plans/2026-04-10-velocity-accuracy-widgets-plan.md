# Velocity & Accuracy Comparison Widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two addable widgets — "Best Velocity" and "Best Accuracy" — to the Results and Compare pages, with visual ranking that makes the winner obvious at a glance.

**Architecture:** Two new React components (`VelRankingWidget`, `AccuracyRankingWidget`) in `src/components/`, each accepting a `sessions` prop (array of `{ name, color, stats }`). Single-session mode (Results page) shows one row; multi-session mode (Compare page) ranks and highlights the winner. Both components are wired into the existing `WIDGETS` registry (Results) and `CMP_WIDGET_DEFS` (Compare) in `src/App.jsx`.

**Tech Stack:** React 19, Tailwind v4, pure CSS (no D3). Existing `CHART_BG = '#111118'` for dark interiors. Winner accent `#69db7c` (green).

---

## File Structure

- **Create:** `src/components/VelRankingWidget.jsx` — Best Velocity widget component
- **Create:** `src/components/AccuracyRankingWidget.jsx` — Best Accuracy widget component
- **Modify:** `src/App.jsx` lines ~812–859 — add both to `WIDGETS` object
- **Modify:** `src/App.jsx` line ~1667 — add both to `CMP_WIDGET_DEFS`
- **Modify:** `src/App.jsx` lines ~2013–2030 — add render cases for both in the Compare widget loop

---

## Task 1: Create VelRankingWidget component

**Files:**
- Create: `src/components/VelRankingWidget.jsx`

This component receives a `sessions` array. Each entry has `{ name, color, stats }` where `stats.meanV` is mean FPS. It sorts descending by `meanV`, picks the winner, and renders rows with progressive dimming and relative bars.

Bar width formula: `(session.stats.meanV - min) / (max - min) * 100`  
When only one session: bar is 100% width, no ranking label.

- [ ] **Step 1: Create the file with the full component**

```jsx
// src/components/VelRankingWidget.jsx
const CHART_BG = '#111118';
const WIN_COLOR = '#69db7c';

export function VelRankingWidget({ sessions }) {
  if (!sessions || sessions.length === 0) return null;

  const sorted = [...sessions].sort((a, b) => b.stats.meanV - a.stats.meanV);
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
            <div key={sess.name} style={{
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
```

- [ ] **Step 2: Verify the file was created**

```bash
ls src/components/VelRankingWidget.jsx
```
Expected: file listed

- [ ] **Step 3: Commit**

```bash
git add src/components/VelRankingWidget.jsx
git commit -m "feat: add VelRankingWidget component"
```

---

## Task 2: Create AccuracyRankingWidget component

**Files:**
- Create: `src/components/AccuracyRankingWidget.jsx`

Three metrics: CEP (`stats.cep`), SD X (`stats.sdX`), SD Y (`stats.sdY`). Lower = better for all.  
Overall winner = session with lowest sum of normalized scores across all three metrics.  
Bar fill formula per cell: `(value - best) / (worst - best) * 100` — best = 0% fill, worst = 100% fill.

- [ ] **Step 1: Create the file with the full component**

```jsx
// src/components/AccuracyRankingWidget.jsx
const CHART_BG = '#111118';
const WIN_COLOR = '#69db7c';
const METRICS = [
  { key: 'cep',  label: 'CEP',  decimals: 3 },
  { key: 'sdX',  label: 'SD X', decimals: 3 },
  { key: 'sdY',  label: 'SD Y', decimals: 3 },
];

function normalizedScore(sessions) {
  // Returns index of overall winner (lowest combined normalized rank)
  if (sessions.length <= 1) return 0;
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
  return scores.indexOf(Math.min(...scores));
}

export function AccuracyRankingWidget({ sessions }) {
  if (!sessions || sessions.length === 0) return null;

  const single = sessions.length === 1;
  const winnerIdx = normalizedScore(sessions);
  // Sort: winner first, then by combined score ascending
  const sortedWithIdx = sessions.map((s, i) => ({ ...s, origIdx: i }));
  if (!single) {
    const scores = sessions.map(() => 0);
    METRICS.forEach(({ key }) => {
      const vals = sessions.map(s => s.stats[key]);
      const best = Math.min(...vals);
      const worst = Math.max(...vals);
      const range = worst - best || 1;
      sessions.forEach((_, i) => { scores[i] += (vals[i] - best) / range; });
    });
    sortedWithIdx.sort((a, b) => scores[a.origIdx] - scores[b.origIdx]);
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
        {sortedWithIdx.map((sess, rank) => {
          const isWinner = rank === 0 && !single;
          const dimOpacity = isWinner ? 1 : rank === 1 ? 0.6 : 0.45;

          return (
            <div key={sess.name} style={{
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
                  background: isWinner ? WIN_COLOR : sess.color,
                  opacity: dimOpacity,
                  boxShadow: isWinner ? '0 0 6px rgba(105,219,124,0.8)' : 'none',
                }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: `rgba(255,255,255,${dimOpacity * 0.8})`, fontFamily: 'ui-monospace,monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {single ? 'Session' : sess.name}
                </span>
              </div>

              {/* Metric cells */}
              {METRICS.map(({ key, decimals }) => {
                const allVals = sessions.map(s => s.stats[key]);
                const best = Math.min(...allVals);
                const worst = Math.max(...allVals);
                const range = worst - best || 1;
                const barPct = single ? 0 : ((sess.stats[key] - best) / range) * 100;
                const cellColor = isWinner ? WIN_COLOR : sess.color;

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
                          boxShadow: isWinner && barPct < 5 ? `0 0 4px rgba(105,219,124,0.5)` : 'none',
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
```

- [ ] **Step 2: Verify the file was created**

```bash
ls src/components/AccuracyRankingWidget.jsx
```
Expected: file listed

- [ ] **Step 3: Commit**

```bash
git add src/components/AccuracyRankingWidget.jsx
git commit -m "feat: add AccuracyRankingWidget component"
```

---

## Task 3: Wire both widgets into the Results page

**Files:**
- Modify: `src/App.jsx`

Two changes:
1. Add imports at the top of the file (near the other component imports around line 10–12)
2. Add two entries to the `WIDGETS` object (after the `attachments` entry, before the closing `}` at line ~859)

For the Results page, the render signature is `(s, vs, st, opts, toggle, setOpt, onError)`. We pass a single-item `sessions` array using `st` for stats and `s.config.sessionName` for the name.

- [ ] **Step 1: Add imports**

Find this block near line 10–12:
```jsx
import { LoginScreen } from './components/LoginScreen.jsx';
import { AttachmentWidget } from './components/AttachmentWidget.jsx';
import { LibraryPage } from './components/LibraryPage.jsx';
```

Add two lines after it:
```jsx
import { LoginScreen } from './components/LoginScreen.jsx';
import { AttachmentWidget } from './components/AttachmentWidget.jsx';
import { LibraryPage } from './components/LibraryPage.jsx';
import { VelRankingWidget } from './components/VelRankingWidget.jsx';
import { AccuracyRankingWidget } from './components/AccuracyRankingWidget.jsx';
```

- [ ] **Step 2: Add entries to WIDGETS object**

Find this block at line ~856–859:
```jsx
  attachments: { label: "Attachments", default: false, render: (s, _vs, _st, _opts, _toggle, _setOpt, onError) => (
    <AttachmentWidget session={s} onError={onError} />
  )},
};
```

Replace with:
```jsx
  attachments: { label: "Attachments", default: false, render: (s, _vs, _st, _opts, _toggle, _setOpt, onError) => (
    <AttachmentWidget session={s} onError={onError} />
  )},
  velRanking: { label: "Best Velocity", default: false, render: (s, _vs, st) => (
    <VelRankingWidget sessions={[{ name: s.config.sessionName || 'This Session', color: '#FFDF00', stats: st }]} />
  )},
  accuracyRanking: { label: "Best Accuracy", default: false, render: (s, _vs, st) => (
    <AccuracyRankingWidget sessions={[{ name: s.config.sessionName || 'Session', color: '#FFDF00', stats: st }]} />
  )},
};
```

- [ ] **Step 3: Verify the dev server compiles**

```bash
npm run dev
```
Expected: no errors in terminal. Open http://localhost:5173, go to a Results page, click "+ Add widget" — "Best Velocity" and "Best Accuracy" should appear in the list.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire velocity and accuracy widgets into Results page"
```

---

## Task 4: Wire both widgets into the Compare page

**Files:**
- Modify: `src/App.jsx`

Two changes:
1. Add `velRanking` and `accuracyRanking` to `CMP_WIDGET_DEFS` (line ~1667)
2. Add render cases in the Compare widget loop (after the `attachments` case, before `return null`)

For the Compare page, `resolved` is available in scope. Each entry has `.session.config.sessionName`, `.color`, and `.stats`.

- [ ] **Step 1: Add to CMP_WIDGET_DEFS**

Find line ~1667:
```jsx
    const CMP_WIDGET_DEFS = { overlay: { label: "Dispersion Overlay" }, metrics: { label: "Metrics Table" }, velCompare: { label: "Velocity Comparison" }, shotLog: { label: "Shot Log" }, attachments: { label: "Attachments" } };
```

Replace with:
```jsx
    const CMP_WIDGET_DEFS = { overlay: { label: "Dispersion Overlay" }, metrics: { label: "Metrics Table" }, velCompare: { label: "Velocity Comparison" }, shotLog: { label: "Shot Log" }, attachments: { label: "Attachments" }, velRanking: { label: "Best Velocity" }, accuracyRanking: { label: "Best Accuracy" } };
```

- [ ] **Step 2: Add render cases in the Compare widget loop**

Find this block (just before `return null`):
```jsx
                if (key === "attachments") return (
                  <div key={key} className="p-6 border-b border-border">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-semibold uppercase tracking-wider text-foreground">Attachments</span>
                      <button onClick={() => toggleCmpWidget("attachments")} title="Remove widget"
                        className="flex items-center justify-center size-5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-secondary transition-colors cursor-pointer bg-transparent border-none">
                        <X size={13} />
                      </button>
                    </div>
                    <LibraryPage
                      log={log}
                      vars={vars}
                      preFilterSessionIds={resolved.map(r => r.session.id)}
                      onError={setDbError} />
                  </div>
                );
                return null;
```

Replace with:
```jsx
                if (key === "attachments") return (
                  <div key={key} className="p-6 border-b border-border">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-semibold uppercase tracking-wider text-foreground">Attachments</span>
                      <button onClick={() => toggleCmpWidget("attachments")} title="Remove widget"
                        className="flex items-center justify-center size-5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-secondary transition-colors cursor-pointer bg-transparent border-none">
                        <X size={13} />
                      </button>
                    </div>
                    <LibraryPage
                      log={log}
                      vars={vars}
                      preFilterSessionIds={resolved.map(r => r.session.id)}
                      onError={setDbError} />
                  </div>
                );
                if (key === "velRanking") return (
                  <div key={key} className="p-6 border-b border-border">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-semibold uppercase tracking-wider text-foreground">Best Velocity</span>
                      <button onClick={() => toggleCmpWidget("velRanking")} title="Remove widget"
                        className="flex items-center justify-center size-5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-secondary transition-colors cursor-pointer bg-transparent border-none">
                        <X size={13} />
                      </button>
                    </div>
                    <VelRankingWidget
                      sessions={resolved.map(r => ({ name: r.session.config.sessionName || 'Session', color: r.color, stats: r.stats }))} />
                  </div>
                );
                if (key === "accuracyRanking") return (
                  <div key={key} className="p-6 border-b border-border">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-semibold uppercase tracking-wider text-foreground">Best Accuracy</span>
                      <button onClick={() => toggleCmpWidget("accuracyRanking")} title="Remove widget"
                        className="flex items-center justify-center size-5 rounded text-muted-foreground/50 hover:text-foreground hover:bg-secondary transition-colors cursor-pointer bg-transparent border-none">
                        <X size={13} />
                      </button>
                    </div>
                    <AccuracyRankingWidget
                      sessions={resolved.map(r => ({ name: r.session.config.sessionName || 'Session', color: r.color, stats: r.stats }))} />
                  </div>
                );
                return null;
```

- [ ] **Step 3: Verify in dev server**

```bash
npm run dev
```
Expected: no errors. Open http://localhost:5173, go to Compare tab, select 2+ sessions, click "+ Add widget" — "Best Velocity" and "Best Accuracy" appear. Add them and confirm the winner row glows green.

- [ ] **Step 4: Commit and push**

```bash
git add src/App.jsx
git commit -m "feat: wire velocity and accuracy widgets into Compare page"
git push
```

---

## Self-Review

**Spec coverage:**
- ✅ Widget 1: Mean FPS ranking with bars, winner glow, delta labels — Task 1 + 3 + 4
- ✅ Widget 2: CEP/SDX/SDY grid with bars, winner glow, overall winner by combined score — Task 2 + 3 + 4
- ✅ Single-session mode on Results page — Tasks 3 (single-item array, no bars on accuracy)
- ✅ Multi-session mode on Compare page — Task 4
- ✅ Theme: `#111118` interior, `#69db7c` winner, session colors for runners-up — baked into components
- ✅ Not default-on, added via "+ Add widget" — `default: false` in Task 3
- ✅ No new dependencies, no schema changes

**Placeholder scan:** None found.

**Type consistency:** `sessions` prop shape `{ name, color, stats }` used consistently across Tasks 1, 2, 3, 4. `stats.meanV`, `stats.cep`, `stats.sdX`, `stats.sdY` match `calcStats()` return shape confirmed in App.jsx line 69.
