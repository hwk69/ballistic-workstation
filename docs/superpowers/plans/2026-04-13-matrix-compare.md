# Matrix Compare Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new MATRIX tab that displays a 2D grid of sessions organized by two user-selected variables, with color-coded metric cells and click-to-expand detail panel.

**Architecture:** Add phase constant `P.MATRIX = 7`, four new state variables, a nav item, and a self-contained Matrix Compare render block. The grid is computed fresh each render from `log` + `vars`. Color coding uses rank-based green-to-red interpolation. All logic lives in `src/App.jsx`.

**Tech Stack:** React 19, D3 v7, Tailwind CSS v4

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/App.jsx` | All changes — phase constant, state, nav item, Matrix render block with axis picker, grid, detail panel |

---

### Task 1: Phase Constant, State, and Nav Item

**Files:**
- Modify: `src/App.jsx:1320` (P constant)
- Modify: `src/App.jsx:1765` (after `libraryFilterSessionIds` state)
- Modify: `src/App.jsx:2120-2127` (navItems)

Wire up the Matrix tab so it's navigable, even though the page content is empty.

- [ ] **Step 1: Add P.MATRIX to the phase constant**

Find this line (line 1320):

```js
const P = { SETUP: 0, FIRE: 1, RESULTS: 2, HISTORY: 3, CMP: 4, EDIT: 5, LIBRARY: 6 };
```

Replace with:

```js
const P = { SETUP: 0, FIRE: 1, RESULTS: 2, HISTORY: 3, CMP: 4, EDIT: 5, LIBRARY: 6, MATRIX: 7 };
```

- [ ] **Step 2: Add matrix state variables**

Find this line (line 1765):

```js
  const [libraryFilterSessionIds, setLibraryFilterSessionIds] = useState(null);
```

Insert immediately after it:

```js
  const [matrixRowVar, setMatrixRowVar] = useState(null);
  const [matrixColVar, setMatrixColVar] = useState(null);
  const [matrixMetric, setMatrixMetric] = useState(null);
  const [matrixDetail, setMatrixDetail] = useState(null);
```

- [ ] **Step 3: Add Matrix nav item**

Find the navItems array (line 2120):

```js
  const navItems = [
    { label: "Setup",   ph: P.SETUP,   onClick: newSession },
    { label: "Fire",    ph: P.FIRE,    disabled: phase !== P.FIRE },
    { label: "Results", ph: P.RESULTS, disabled: !viewId,        onClick: () => setPhase(P.RESULTS) },
    { label: "History", ph: P.HISTORY, onClick: () => setPhase(P.HISTORY) },
    { label: "Compare", ph: P.CMP,     disabled: log.length < 2, onClick: () => { setCmpSlots([]); setPhase(P.CMP); } },
    { label: "Library", ph: P.LIBRARY, onClick: () => { setLibraryFilterSessionIds(null); setPhase(P.LIBRARY); } },
  ];
```

Replace with:

```js
  const navItems = [
    { label: "Setup",   ph: P.SETUP,   onClick: newSession },
    { label: "Fire",    ph: P.FIRE,    disabled: phase !== P.FIRE },
    { label: "Results", ph: P.RESULTS, disabled: !viewId,        onClick: () => setPhase(P.RESULTS) },
    { label: "History", ph: P.HISTORY, onClick: () => setPhase(P.HISTORY) },
    { label: "Compare", ph: P.CMP,     disabled: log.length < 2, onClick: () => { setCmpSlots([]); setPhase(P.CMP); } },
    { label: "Matrix",  ph: P.MATRIX,  disabled: log.length < 2, onClick: () => { setMatrixRowVar(null); setMatrixColVar(null); setMatrixMetric(null); setMatrixDetail(null); setPhase(P.MATRIX); } },
    { label: "Library", ph: P.LIBRARY, onClick: () => { setLibraryFilterSessionIds(null); setPhase(P.LIBRARY); } },
  ];
```

- [ ] **Step 4: Add empty Matrix phase block**

Find the LIBRARY section header comment (line 3237):

```js
  // ─── LIBRARY ─────────────────────────────────────────────────────────────────
```

Insert immediately before it:

```jsx
  // ─── MATRIX COMPARE ──────────────────────────────────────────────────────────
  if (phase === P.MATRIX) return (
    <AppShell phase={phase} navItems={navItems} sessionCount={log.length} dbError={dbError} onDismissError={() => setDbError(null)} maxW="1200px">
      <h1 className="text-[22px] font-bold tracking-tight text-foreground mb-6">Matrix Compare</h1>
      <p className="text-sm text-muted-foreground">Coming soon…</p>
    </AppShell>
  );

```

- [ ] **Step 5: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds. Matrix tab appears in nav but shows placeholder content.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add Matrix phase constant, state, nav item, and placeholder page"
```

---

### Task 2: Axis Picker and Grid Data Computation

**Files:**
- Modify: `src/App.jsx` — the Matrix phase block added in Task 1

Replace the placeholder Matrix phase block with the axis picker UI and grid data computation logic.

- [ ] **Step 1: Replace the Matrix phase block**

Find and replace the entire Matrix phase block (the `if (phase === P.MATRIX) return (...)` block added in Task 1) with the following:

```jsx
  // ─── MATRIX COMPARE ──────────────────────────────────────────────────────────
  if (phase === P.MATRIX) {
    // Build the grid data
    const matrixVarOptions = vars.map(v => ({ key: v.key, label: v.label }));
    const rowVar = matrixRowVar || matrixVarOptions[0]?.key;
    const colVar = matrixColVar || matrixVarOptions.find(v => v.key !== rowVar)?.key;

    // Collect all sessions that have both variables set
    const matrixSessions = log.filter(s => s.config[rowVar] && s.config[colVar]);

    // Extract unique row/column values
    const smartSort = (a, b) => {
      const na = parseFloat(a), nb = parseFloat(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return String(a).localeCompare(String(b));
    };
    const rowValues = [...new Set(matrixSessions.map(s => s.config[rowVar]))].sort(smartSort);
    const colValues = [...new Set(matrixSessions.map(s => s.config[colVar]))].sort(smartSort);

    // Build lookup: grid[rowVal][colVal] = [sessions]
    const grid = {};
    for (const rv of rowValues) {
      grid[rv] = {};
      for (const cv of colValues) {
        grid[rv][cv] = matrixSessions.filter(s => s.config[rowVar] === rv && s.config[colVar] === cv);
      }
    }

    // Determine available metrics from matched sessions
    const anyHasXY = matrixSessions.some(s => s.stats?.hasXY);
    const anyHasFps = matrixSessions.some(s => s.stats?.hasFps);
    const metricOptions = [];
    if (anyHasXY) {
      metricOptions.push({ key: "cep", label: "CEP (50%)", dec: 3, unit: "in" });
      metricOptions.push({ key: "r90", label: "R90", dec: 3, unit: "in" });
      metricOptions.push({ key: "mr", label: "Mean Radius", dec: 3, unit: "in" });
      metricOptions.push({ key: "es", label: "Ext. Spread", dec: 3, unit: "in" });
      metricOptions.push({ key: "sdX", label: "SD X", dec: 3, unit: "in" });
      metricOptions.push({ key: "sdY", label: "SD Y", dec: 3, unit: "in" });
    }
    if (anyHasFps) {
      metricOptions.push({ key: "meanV", label: "Mean FPS", dec: 1, unit: "fps" });
      metricOptions.push({ key: "sdV", label: "SD FPS", dec: 1, unit: "fps" });
      metricOptions.push({ key: "esV", label: "ES FPS", dec: 1, unit: "fps" });
    }
    // Custom field metrics
    const allFieldKeys = new Set();
    const fieldDefs = {};
    matrixSessions.forEach(s => {
      const sf = s.config.fields || [];
      sf.forEach(f => {
        if (!allFieldKeys.has(f.key) && !["fps", "x", "y", "weight"].includes(f.key)) {
          allFieldKeys.add(f.key);
          fieldDefs[f.key] = f;
        }
      });
    });
    for (const [fk, f] of Object.entries(fieldDefs)) {
      if (f.type === "number") metricOptions.push({ key: `fieldMean:${fk}`, label: `Mean ${f.label}`, dec: 2, unit: f.unit || "" });
      if (f.type === "yesno") metricOptions.push({ key: `fieldPct:${fk}`, label: `${f.label} %`, dec: 0, unit: "%" });
    }

    // Default metric selection
    const selMetric = matrixMetric && metricOptions.some(m => m.key === matrixMetric) ? matrixMetric : (metricOptions[0]?.key || null);
    const metricDef = metricOptions.find(m => m.key === selMetric);

    // Determine if lower is better for the selected metric
    const LOWER_BETTER_KEYS = ["cep", "r90", "mr", "es", "sdX", "sdY", "sdR", "sdV", "esV"];
    const isLowerBetter = LOWER_BETTER_KEYS.includes(selMetric);

    // Compute cell values
    const getCellValue = (sessions) => {
      if (!sessions || sessions.length === 0) return null;
      if (selMetric.startsWith("fieldMean:")) {
        const fk = selMetric.replace("fieldMean:", "");
        const vals = sessions.map(s => s.stats?.fieldStats?.[fk]?.mean).filter(v => v != null);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      }
      if (selMetric.startsWith("fieldPct:")) {
        const fk = selMetric.replace("fieldPct:", "");
        const vals = sessions.map(s => s.stats?.fieldStats?.[fk]?.pct).filter(v => v != null);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      }
      const vals = sessions.map(s => s.stats?.[selMetric]).filter(v => v != null && !isNaN(v));
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };

    // Build cell data and collect all values for ranking
    const cellData = {};
    const allValues = [];
    for (const rv of rowValues) {
      cellData[rv] = {};
      for (const cv of colValues) {
        const sessions = grid[rv][cv];
        const val = getCellValue(sessions);
        cellData[rv][cv] = { value: val, count: sessions.length };
        if (val != null) allValues.push(val);
      }
    }

    // Rank values for color coding
    const sorted = [...allValues].sort((a, b) => isLowerBetter ? a - b : b - a);
    const getColor = (val) => {
      if (val == null) return "rgba(255,255,255,0.03)";
      const rank = sorted.indexOf(val);
      const t = sorted.length > 1 ? rank / (sorted.length - 1) : 0;
      const r = Math.round(34 + (239 - 34) * t);
      const g = Math.round(197 + (68 - 197) * t);
      const b = Math.round(94 + (68 - 94) * t);
      return `rgba(${r},${g},${b},0.25)`;
    };

    // Format value for display
    const fmtVal = (val) => {
      if (val == null) return "—";
      const dec = metricDef?.dec ?? 2;
      const unit = metricDef?.unit || "";
      return val.toFixed(dec) + (unit ? " " + unit : "");
    };

    return (
      <AppShell phase={phase} navItems={navItems} sessionCount={log.length} dbError={dbError} onDismissError={() => setDbError(null)} maxW="1200px">
        <h1 className="text-[22px] font-bold tracking-tight text-foreground mb-6">Matrix Compare</h1>

        {/* Axis Picker */}
        <div className="flex flex-wrap gap-4 mb-6 items-end">
          <div>
            <SecLabel className="mb-1.5">Row Variable</SecLabel>
            <select className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground" value={rowVar || ""} onChange={e => { setMatrixRowVar(e.target.value); setMatrixDetail(null); }}>
              {matrixVarOptions.map(v => <option key={v.key} value={v.key} disabled={v.key === colVar}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <SecLabel className="mb-1.5">Column Variable</SecLabel>
            <select className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground" value={colVar || ""} onChange={e => { setMatrixColVar(e.target.value); setMatrixDetail(null); }}>
              {matrixVarOptions.filter(v => v.key !== rowVar).map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <SecLabel className="mb-1.5">Metric</SecLabel>
            <select className="bg-card border border-border rounded-md px-3 py-1.5 text-sm text-foreground" value={selMetric || ""} onChange={e => { setMatrixMetric(e.target.value); setMatrixDetail(null); }}>
              {metricOptions.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
        </div>

        {matrixSessions.length === 0 ? (
          <Empty icon={<span className="text-base">⊞</span>}>
            <p className="text-sm text-muted-foreground">No sessions have both <strong>{matrixVarOptions.find(v => v.key === rowVar)?.label}</strong> and <strong>{matrixVarOptions.find(v => v.key === colVar)?.label}</strong> set.</p>
          </Empty>
        ) : (
          <>
            {/* Grid */}
            <div className="overflow-x-auto mb-6">
              <table className="border-collapse w-full">
                <thead>
                  <tr>
                    <th className="p-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 text-left border border-border bg-card"></th>
                    {colValues.map(cv => (
                      <th key={cv} className="p-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 text-center border border-border bg-card min-w-[100px]">{cv}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowValues.map(rv => (
                    <tr key={rv}>
                      <td className="p-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 border border-border bg-card whitespace-nowrap">{rv}</td>
                      {colValues.map(cv => {
                        const cell = cellData[rv][cv];
                        const isSelected = matrixDetail?.row === rv && matrixDetail?.col === cv;
                        return (
                          <td
                            key={cv}
                            className={`p-3 text-center border border-border cursor-pointer transition-all hover:ring-2 hover:ring-primary/40 ${isSelected ? "ring-2 ring-primary" : ""}`}
                            style={{ background: getColor(cell.value) }}
                            onClick={() => cell.count > 0 ? setMatrixDetail(isSelected ? null : { row: rv, col: cv }) : null}
                          >
                            <div className="text-sm font-semibold text-foreground">{fmtVal(cell.value)}</div>
                            {cell.count > 1 && <div className="text-[10px] text-muted-foreground mt-0.5">{cell.count} sessions</div>}
                            {cell.count === 0 && <div className="text-[10px] text-muted-foreground">—</div>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Placeholder for detail panel — Task 3 */}
          </>
        )}
      </AppShell>
    );
  }

```

- [ ] **Step 2: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds. Matrix tab shows axis pickers and a color-coded grid.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add Matrix Compare axis picker and color-coded grid"
```

---

### Task 3: Detail Panel

**Files:**
- Modify: `src/App.jsx` — the Matrix phase block, replace the detail panel placeholder comment

Add the expandable detail panel that shows full stats when a cell is clicked.

- [ ] **Step 1: Add the detail panel**

Find this comment inside the Matrix phase block:

```jsx
            {/* Placeholder for detail panel — Task 3 */}
```

Replace it with:

```jsx
            {/* Detail Panel */}
            {matrixDetail && (() => {
              const sessions = grid[matrixDetail.row]?.[matrixDetail.col] || [];
              if (sessions.length === 0) return null;
              const isSingle = sessions.length === 1;
              const s = isSingle ? sessions[0] : null;
              const stats = isSingle ? s.stats : (() => {
                // Average stats across sessions
                const keys = ["cep", "r90", "mr", "es", "sdX", "sdY", "sdR", "meanV", "sdV", "esV"];
                const avg = {};
                for (const k of keys) {
                  const vals = sessions.map(x => x.stats?.[k]).filter(v => v != null && !isNaN(v));
                  avg[k] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                }
                avg.hasXY = sessions.some(x => x.stats?.hasXY);
                avg.hasFps = sessions.some(x => x.stats?.hasFps);
                avg.n = Math.round(sessions.reduce((a, x) => a + (x.stats?.n || 0), 0) / sessions.length);
                // Average field stats
                avg.fieldStats = {};
                const allFk = new Set();
                sessions.forEach(x => Object.keys(x.stats?.fieldStats || {}).forEach(k => allFk.add(k)));
                for (const fk of allFk) {
                  const first = sessions.find(x => x.stats?.fieldStats?.[fk])?.stats.fieldStats[fk];
                  if (!first) continue;
                  if (first.type === "number") {
                    const vals = sessions.map(x => x.stats?.fieldStats?.[fk]?.mean).filter(v => v != null);
                    avg.fieldStats[fk] = { ...first, mean: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
                  } else if (first.type === "yesno") {
                    const vals = sessions.map(x => x.stats?.fieldStats?.[fk]?.pct).filter(v => v != null);
                    avg.fieldStats[fk] = { ...first, pct: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0 };
                  }
                }
                return avg;
              })();

              return (
                <CardSection title={isSingle ? (s.config.sessionName || "Session") : `Average of ${sessions.length} sessions`} className="mb-6">
                  {isSingle && (
                    <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
                      <span>{new Date(s.date).toLocaleDateString()}</span>
                      <span>{s.shots.length} shots</span>
                    </div>
                  )}
                  {!isSingle && (
                    <div className="mb-4">
                      <div className="text-xs text-muted-foreground mb-2">Contributing sessions:</div>
                      <div className="flex flex-wrap gap-2">
                        {sessions.map((x, i) => (
                          <span key={i} className="text-xs bg-secondary px-2 py-0.5 rounded border border-border text-foreground">
                            {x.config.sessionName || "Session"} — {new Date(x.date).toLocaleDateString()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stat block */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {stats.hasXY && [
                      ["CEP (50%)", stats.cep, 3, "in"],
                      ["R90", stats.r90, 3, "in"],
                      ["Mean Radius", stats.mr, 3, "in"],
                      ["Ext. Spread", stats.es, 3, "in"],
                      ["SD X", stats.sdX, 3, "in"],
                      ["SD Y", stats.sdY, 3, "in"],
                    ].map(([label, val, dec, unit]) => (
                      <div key={label} className="bg-secondary/50 rounded-md p-2.5">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">{label}</div>
                        <div className="text-sm font-semibold text-foreground">{val != null ? val.toFixed(dec) + " " + unit : "—"}</div>
                      </div>
                    ))}
                    {stats.hasFps && [
                      ["Mean FPS", stats.meanV, 1, "fps"],
                      ["SD FPS", stats.sdV, 1, "fps"],
                      ["ES FPS", stats.esV, 1, "fps"],
                    ].map(([label, val, dec, unit]) => (
                      <div key={label} className="bg-secondary/50 rounded-md p-2.5">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">{label}</div>
                        <div className="text-sm font-semibold text-foreground">{val != null ? val.toFixed(dec) + " " + unit : "—"}</div>
                      </div>
                    ))}
                    {Object.entries(stats.fieldStats || {}).map(([fk, fs]) => (
                      <div key={fk} className="bg-secondary/50 rounded-md p-2.5">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">{fs.label}</div>
                        <div className="text-sm font-semibold text-foreground">
                          {fs.type === "number" && fs.mean != null ? fs.mean.toFixed(2) + (fs.unit ? " " + fs.unit : "") : ""}
                          {fs.type === "yesno" ? fs.pct + "%" : ""}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* View Session button */}
                  {isSingle && (
                    <div className="mt-4">
                      <Btn v="secondary" onClick={() => { setViewId(s.id); setPhase(P.RESULTS); }}>View Session</Btn>
                    </div>
                  )}
                </CardSection>
              );
            })()}
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds. Clicking a grid cell opens the detail panel with full stats.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add Matrix Compare detail panel with full stats and View Session"
```

---

### Task 4: Manual Testing and Polish

**Files:**
- Modify: `src/App.jsx` (if any fixes needed)

Verify the complete feature works end-to-end.

- [ ] **Step 1: Manual integration test**

Start the dev server: `npm run dev`

1. Make sure you have at least 2 sessions in the log with different variable values (e.g., different Rifle Rate and Sleeve Type).
2. Click the **Matrix** tab in the nav bar.
3. Verify:
   - Row Variable and Column Variable dropdowns populate from `vars`.
   - Column Variable excludes the selected Row Variable.
   - Metric dropdown shows available metrics based on session data.
   - Grid displays with correct row/column headers sorted alphabetically (or numerically if values look numeric).
   - Cells show metric values with color coding (green = best, red = worst).
   - Empty cells show "—" with neutral background.
   - Cells with multiple sessions show "N sessions" label.
   - Clicking a cell opens the detail panel with all stats.
   - Clicking the same cell again closes the panel.
   - Clicking a different cell switches the detail panel.
   - "View Session" button appears for single-session cells and navigates to Results.
   - Multi-session cells show averaged stats and contributing session list (no View Session button).
   - Changing axis dropdowns or metric dropdown updates the grid and clears the detail panel.

- [ ] **Step 2: Final build check**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit any fixes**

If any issues were found during testing:
```bash
git add src/App.jsx
git commit -m "fix: address Matrix Compare integration test issues"
```
