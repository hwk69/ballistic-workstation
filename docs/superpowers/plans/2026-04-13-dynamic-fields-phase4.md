# Dynamic Measurement Fields — Phase 4: Compare View

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Compare view work with dynamic measurement fields — filter widgets by common fields across selected sessions, show dynamic metrics and shot log columns, and display a message when sessions share no common fields.

**Architecture:** Compute the intersection of field keys across all selected sessions. Use that intersection to filter which compare widgets are available, generate dynamic metrics table rows, and render dynamic shot log columns. The session picker and slot management remain unchanged.

**Tech Stack:** React 19, Tailwind CSS v4

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `src/App.jsx` | Main app — Compare view | Modify: `resolved` filtering, `CMP_WIDGET_DEFS`, metrics table, shot log, widget visibility |

---

### Task 1: Dynamic `resolved` Filtering and Common Fields Detection

**Files:**
- Modify: `src/App.jsx`

The `resolved` array currently filters shots with hardcoded `fps`/`x`/`y`. Make it dynamic and compute the intersection of fields across selected sessions.

- [ ] **Step 1: Update `resolved` and add common fields computation**

In the Compare view section, find (around line 2268):
```js
  if (phase === P.CMP) {
    const resolved = cmpSlots.map(sl => {
      const s = log.find(x => x.id === sl.id);
      if (!s) return null;
      const vs = s.shots.filter(sh => !isNaN(sh.fps) && !isNaN(sh.x) && !isNaN(sh.y));
      return { ...sl, session: s, shots: vs, stats: s.stats };
    }).filter(Boolean);
    const activeMetrics = ALL_METRICS.filter(m => cmpMetrics.includes(m[0]));
    const CMP_WIDGET_DEFS = { overlay: { label: "Dispersion Overlay" }, metrics: { label: "Metrics Table" }, velCompare: { label: "Velocity Comparison" }, shotLog: { label: "Shot Log" }, attachments: { label: "Attachments" }, rankings: { label: "Rankings" } };
```

Replace with:
```js
  if (phase === P.CMP) {
    const resolved = cmpSlots.map(sl => {
      const s = log.find(x => x.id === sl.id);
      if (!s) return null;
      const sf = s.config.fields || fields;
      const reqNum = sf.filter(f => f.required && f.type === "number").map(f => f.key);
      const vs = s.shots.filter(sh => {
        const d = sh.data || sh;
        return reqNum.every(k => d[k] !== null && d[k] !== undefined && !isNaN(d[k]));
      });
      return { ...sl, session: s, shots: vs, stats: s.stats, fields: sf };
    }).filter(Boolean);
    // Compute common fields across all selected sessions
    const commonFields = resolved.length > 0
      ? resolved[0].fields.filter(f => resolved.every(r => r.fields.some(rf => rf.key === f.key)))
      : [];
    const commonKeys = new Set(commonFields.map(f => f.key));
    const commonHasXY = commonKeys.has("x") && commonKeys.has("y");
    const commonHasFps = commonKeys.has("fps");
    const activeMetrics = ALL_METRICS.filter(m => cmpMetrics.includes(m[0]));
    const CMP_WIDGET_DEFS = {
      overlay:    { label: "Dispersion Overlay", requires: ["x", "y"] },
      metrics:    { label: "Metrics Table", requires: [] },
      velCompare: { label: "Velocity Comparison", requires: ["fps"] },
      shotLog:    { label: "Shot Log", requires: [] },
      attachments:{ label: "Attachments", requires: [] },
      rankings:   { label: "Rankings", requires: ["fps", "x", "y"] },
    };
    const availableCmpWidgets = Object.keys(CMP_WIDGET_DEFS).filter(k =>
      CMP_WIDGET_DEFS[k].requires.every(r => commonKeys.has(r))
    );
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: dynamic resolved filtering and common fields detection in Compare view"
```

---

### Task 2: Dynamic Metrics Table

**Files:**
- Modify: `src/App.jsx`

The metrics table currently iterates `ALL_METRICS` which are all hardcoded to fps/x/y stats. Make it dynamic based on common fields.

- [ ] **Step 1: Update the metrics table rendering**

In the `renderWidgetContent` function inside the Compare view, find the metrics section (search for `if (key === 'metrics' && activeMetrics.length)`):

```js
      if (key === 'metrics' && activeMetrics.length) return (
```

Replace that entire `if (key === 'metrics' ...` block (through its closing `);`) with:

```js
      if (key === 'metrics') {
        // Filter activeMetrics to only show metrics whose required fields are present
        const metricRequires = { cep: ["x","y"], r90: ["x","y"], mr: ["x","y"], es: ["x","y"], sdX: ["x","y"], sdY: ["x","y"], sdR: ["x","y"], mpiX: ["x","y"], mpiY: ["x","y"], meanV: ["fps"], sdV: ["fps"], esV: ["fps"] };
        const visibleMetrics = activeMetrics.filter(([_label, key2]) => {
          const reqs = metricRequires[key2] || [];
          return reqs.every(r => commonKeys.has(r));
        });
        // Add dynamic per-field metrics for common number fields (excluding x,y,fps)
        const customNumFields = commonFields.filter(f => f.type === "number" && !["x","y","fps"].includes(f.key));
        const customYesNoFields = commonFields.filter(f => f.type === "yesno");
        if (!visibleMetrics.length && !customNumFields.length && !customYesNoFields.length) return (
          <div className="py-6 text-center text-sm text-muted-foreground">No comparable metrics available for the selected sessions.</div>
        );
        return (
        <>
          <div className="export-hide flex justify-end mb-2">
            <button onClick={() => setCmpMetricsOpen(o => !o)}
              className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none transition-colors">
              {cmpMetricsOpen ? "Done" : "Edit metrics"}
            </button>
          </div>
          {cmpMetricsOpen && (
            <div className="export-hide flex flex-wrap gap-1.5 mb-4 p-3 bg-secondary rounded-lg border border-border">
              {ALL_METRICS.filter(([_label, key2]) => {
                const reqs = metricRequires[key2] || [];
                return reqs.every(r => commonKeys.has(r));
              }).map(([label]) => (
                <Toggle key={label} label={label} on={cmpMetrics.includes(label)} onToggle={() => toggleCmpMetric(label)} />
              ))}
            </div>
          )}
          <div className="overflow-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-muted-foreground text-left px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide">Metric</th>
                  {resolved.map((r, i) => (
                    <th key={i} className="text-right px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: r.color }}>{r.session.config.sessionName}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleMetrics.map(([label, key2, dec]) => {
                  const vals = resolved.map(r => r.stats[key2]);
                  const isLb = LOWER_BETTER.includes(label);
                  const best = isLb ? Math.min(...vals) : Math.max(...vals);
                  return (
                    <tr key={label} className="border-b border-border odd:bg-secondary/30">
                      <td className="px-2.5 py-2.5 text-sm" style={{ color: ({cep:OC.cep,r90:OC.r90,mpiX:OC.mpi,mpiY:OC.mpi}[key2]) || "var(--color-foreground)" }}>
                        <MetricTip label={label}>{label}</MetricTip>
                      </td>
                      {resolved.map((r, i) => {
                        const v = r.stats[key2];
                        const isBest = v === best && vals.filter(x => x === best).length === 1;
                        return <td key={i} className={cn("px-2.5 py-2.5 text-right font-mono font-semibold text-sm", !isBest && "text-foreground")} style={isBest ? { color: r.color } : undefined}>{v.toFixed(dec)}{isBest ? " ✦" : ""}</td>;
                      })}
                    </tr>
                  );
                })}
                {customNumFields.map(f => {
                  const vals = resolved.map(r => {
                    const fs = r.stats.fieldStats?.[f.key];
                    return fs?.mean ?? null;
                  });
                  const validVals = vals.filter(v => v !== null);
                  if (validVals.length < 2) return null;
                  return (
                    <tr key={`mean-${f.key}`} className="border-b border-border odd:bg-secondary/30">
                      <td className="px-2.5 py-2.5 text-sm text-foreground">Mean {f.label}</td>
                      {resolved.map((r, i) => {
                        const v = r.stats.fieldStats?.[f.key]?.mean;
                        return <td key={i} className="px-2.5 py-2.5 text-right font-mono font-semibold text-sm text-foreground">{v !== null && v !== undefined ? v.toFixed(1) : "—"}{f.unit ? ` ${f.unit}` : ""}</td>;
                      })}
                    </tr>
                  );
                })}
                {customYesNoFields.map(f => {
                  return (
                    <tr key={`yn-${f.key}`} className="border-b border-border odd:bg-secondary/30">
                      <td className="px-2.5 py-2.5 text-sm text-foreground">{f.label}</td>
                      {resolved.map((r, i) => {
                        const fs = r.stats.fieldStats?.[f.key];
                        return <td key={i} className="px-2.5 py-2.5 text-right font-mono font-semibold text-sm text-foreground">{fs ? `${fs.yes}/${fs.total} (${fs.pct}%)` : "—"}</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
        );
      }
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: dynamic metrics table in Compare view with common-field detection"
```

---

### Task 3: Dynamic Shot Log and Widget Filtering

**Files:**
- Modify: `src/App.jsx`

Update the compare shot log to use dynamic columns, and filter widgets by `availableCmpWidgets`.

- [ ] **Step 1: Update the shot log rendering**

In `renderWidgetContent`, find the shot log section (search for `if (key === 'shotLog')`):

```js
      if (key === 'shotLog') {
        const allShots = resolved.flatMap(r =>
          [...r.shots]
            .sort((a, b) => (a.shotNum || 0) - (b.shotNum || 0))
            .map(s => ({ ...s, sessionName: r.session.config.sessionName, sessionColor: r.color, mpiX: r.stats.mpiX, mpiY: r.stats.mpiY }))
        );
        const hdrs = ["Session","#","Serial","FPS","X","Y","Wt","Rad"];
        const rightAlign = ["FPS","X","Y","Wt","Rad"];
        return (
          <div className="overflow-auto max-h-80">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border">
                  {hdrs.map(h => (
                    <th key={h} className={cn(
                      "text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2.5 py-1.5",
                      rightAlign.includes(h) ? "text-right" : "text-left"
                    )}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allShots.map((s, i) => {
                  const r = rad(s.x - (s.mpiX || 0), s.y - (s.mpiY || 0));
                  return (
                    <tr key={i} className="border-b transition-colors"
                      style={{ background: s.sessionColor + "18", borderColor: s.sessionColor + "30" }}>
                      <td className="px-2.5 py-1.5 font-semibold" style={{ color: s.sessionColor }}>{s.sessionName}</td>
                      <td className="px-2.5 py-1.5" style={{ color: s.sessionColor + "99" }}>{s.shotNum}</td>
                      <td className="px-2.5 py-1.5 font-mono text-[11px]" style={{ color: s.sessionColor + "99" }}>{s.serial}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-foreground">{s.fps}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-foreground">{s.x}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-foreground">{s.y}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-muted-foreground">{s.weight || "—"}</td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-muted-foreground">{r.toFixed(3)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }
```

Replace that entire `if (key === 'shotLog')` block with:

```js
      if (key === 'shotLog') {
        const allShots = resolved.flatMap(r =>
          [...r.shots]
            .sort((a, b) => (a.shotNum || 0) - (b.shotNum || 0))
            .map(s => ({ ...s, sessionName: r.session.config.sessionName, sessionColor: r.color }))
        );
        return (
          <div className="overflow-auto max-h-80">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border">
                  <th className="text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2.5 py-1.5 text-left">Session</th>
                  <th className="text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2.5 py-1.5 text-left">#</th>
                  <th className="text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2.5 py-1.5 text-left">Serial</th>
                  {commonFields.map(f => (
                    <th key={f.key} className={cn(
                      "text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2.5 py-1.5",
                      f.type === "number" ? "text-right" : "text-left"
                    )}>{f.label}</th>
                  ))}
                  <th className="text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2.5 py-1.5 text-left">Time</th>
                </tr>
              </thead>
              <tbody>
                {allShots.map((s, i) => (
                  <tr key={i} className="border-b transition-colors"
                    style={{ background: s.sessionColor + "18", borderColor: s.sessionColor + "30" }}>
                    <td className="px-2.5 py-1.5 font-semibold" style={{ color: s.sessionColor }}>{s.sessionName}</td>
                    <td className="px-2.5 py-1.5" style={{ color: s.sessionColor + "99" }}>{s.shotNum}</td>
                    <td className="px-2.5 py-1.5 font-mono text-[11px]" style={{ color: s.sessionColor + "99" }}>{s.serial}</td>
                    {commonFields.map(f => {
                      const val = (s.data || s)[f.key];
                      let display = "";
                      if (val === true) display = "Yes";
                      else if (val === false) display = "No";
                      else if (val !== null && val !== undefined) display = String(val);
                      return (
                        <td key={f.key} className={cn(
                          "px-2.5 py-1.5",
                          f.type === "number" ? "text-right font-mono text-foreground" : "text-foreground"
                        )}>{display || "—"}</td>
                      );
                    })}
                    <td className="text-muted-foreground px-2.5 py-1.5">{s.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
```

- [ ] **Step 2: Filter compare widgets by available fields and add no-common-fields message**

Find the section that renders widgets (search for `{resolved.length >= 2 ? (`). Before that line, the `mainItems`, `sidebarItems`, and `fullItems` are computed from `cmpLayout`. Update them to filter by available widgets:

Find:
```js
    const mainItems    = cmpLayout.filter(item => item.zone === 'main');
    const sidebarItems = cmpLayout.filter(item => item.zone === 'sidebar');
    const fullItems    = cmpLayout.filter(item => item.zone === 'full');
```

Replace with:
```js
    const activeCmpLayout = cmpLayout.filter(item => availableCmpWidgets.includes(item.i));
    const mainItems    = activeCmpLayout.filter(item => item.zone === 'main');
    const sidebarItems = activeCmpLayout.filter(item => item.zone === 'sidebar');
    const fullItems    = activeCmpLayout.filter(item => item.zone === 'full');
```

- [ ] **Step 3: Update the WidgetAdder in Compare view**

Find the WidgetAdder in the compare view (search for `onAdd={addWidget}` — it's in the compare section, around line 2700+):

```jsx
                      <WidgetAdder
                        available={Object.keys(CMP_WIDGET_DEFS).filter(k => !cmpLayout.some(item => item.i === k))}
                        labels={Object.fromEntries(Object.keys(CMP_WIDGET_DEFS).map(k => [k, CMP_WIDGET_DEFS[k].label]))}
                        onAdd={addWidget} />
```

Replace with:
```jsx
                      <WidgetAdder
                        available={availableCmpWidgets.filter(k => !activeCmpLayout.some(item => item.i === k))}
                        labels={Object.fromEntries(availableCmpWidgets.map(k => [k, CMP_WIDGET_DEFS[k].label]))}
                        onAdd={addWidget} />
```

- [ ] **Step 4: Add no-common-fields message**

Find the condition `{resolved.length >= 2 ? (` and look at its `else` branch (the `:` case). Currently it likely shows some kind of "select sessions" message. After the existing condition, add a check for empty common fields.

Find (around the `resolved.length >= 2` check):
```jsx
          {resolved.length >= 2 ? (
```

Change to:
```jsx
          {resolved.length >= 2 && commonFields.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-muted-foreground">Selected sessions have no common measurement fields to compare.</p>
            </div>
          ) : resolved.length >= 2 ? (
```

- [ ] **Step 5: Verify build passes**

Run: `npm run build`

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: dynamic shot log, widget filtering, and no-common-fields message in Compare view"
```

---

### Task 4: Update Rankings Widget Visibility

**Files:**
- Modify: `src/App.jsx`

The rankings widget in Compare currently always shows both velocity and accuracy rankings side by side. Make each half conditional.

- [ ] **Step 1: Update the rankings render in `renderWidgetContent`**

Find (in `renderWidgetContent`):
```js
      if (key === 'rankings') return (
        <div className="flex">
          <div className="flex-1 min-w-0 border-r border-border"><VelRankingWidget sessions={cmpSessions} /></div>
          <div className="flex-1 min-w-0"><AccuracyRankingWidget sessions={cmpSessions} /></div>
        </div>
      );
```

Replace with:
```js
      if (key === 'rankings') return (
        <div className="flex">
          {commonHasFps && <div className={cn("flex-1 min-w-0", commonHasXY && "border-r border-border")}><VelRankingWidget sessions={cmpSessions} /></div>}
          {commonHasXY && <div className="flex-1 min-w-0"><AccuracyRankingWidget sessions={cmpSessions} /></div>}
        </div>
      );
```

Also update `CMP_WIDGET_DEFS` for rankings — currently `requires: ["fps", "x", "y"]` means it needs ALL three. Change this so rankings shows if the session has fps OR (x+y):

In the `CMP_WIDGET_DEFS` definition (from Task 1), find:
```js
      rankings:   { label: "Rankings", requires: ["fps", "x", "y"] },
```

Change to:
```js
      rankings:   { label: "Rankings", requires: [] },
```

And update `availableCmpWidgets` to include custom logic for rankings. Find:
```js
    const availableCmpWidgets = Object.keys(CMP_WIDGET_DEFS).filter(k =>
      CMP_WIDGET_DEFS[k].requires.every(r => commonKeys.has(r))
    );
```

Change to:
```js
    const availableCmpWidgets = Object.keys(CMP_WIDGET_DEFS).filter(k => {
      if (k === 'rankings') return commonHasFps || commonHasXY;
      return CMP_WIDGET_DEFS[k].requires.every(r => commonKeys.has(r));
    });
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: conditional rankings widget halves based on common fields in Compare view"
```
