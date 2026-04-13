# Dynamic Measurement Fields — Phase 3: Stats Engine & Results Page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `calcStats` function with a dynamic stats engine, make the Results page widgets conditional on available fields, and make the Key Metrics widget and Shot Table render dynamically.

**Architecture:** Extend `calcStats` to accept a `fields` array and compute stats per field type (number→mean/SD/ES, yesno→counts/percentage, dropdown→counts). Keep the existing accuracy stats (CEP, R90, covariance ellipse) but only compute them when `x` and `y` fields are present. Filter the WIDGETS registry per-session based on which fields are available. Update Key Metrics and Shot Table widgets to render dynamically from the session's fields.

**Tech Stack:** React 19, Tailwind CSS v4

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `src/App.jsx` | Main app — stats engine, WIDGETS registry, Results page | Modify: `calcStats`, `WIDGETS`, Key Metrics widget, Shot Table widget, Results page `validShots`, widget filtering |

---

### Task 1: Extend `calcStats` to Accept Fields and Compute Dynamic Stats

**Files:**
- Modify: `src/App.jsx`

The current `calcStats(shots)` computes hardcoded stats from `fps`, `x`, `y`. Extend it to accept a `fields` parameter and compute per-field stats alongside the existing accuracy stats.

- [ ] **Step 1: Update `calcStats` function signature and add dynamic stats**

Find the `calcStats` function (line 97):
```js
function calcStats(shots){
  const v=shots.filter(s=>!isNaN(s.fps)&&!isNaN(s.x)&&!isNaN(s.y));
  if(v.length<2)return{cep:0,r90:0,mpiX:0,mpiY:0,mr:0,es:0,sdR:0,sdV:0,meanV:0,esV:0,covEllipse:null,n:v.length,sdX:0,sdY:0};
  const xs=v.map(s=>s.x),ys=v.map(s=>s.y),vs=v.map(s=>s.fps),mpiX=mean(xs),mpiY=mean(ys);
  const radii=v.map(s=>rad(s.x-mpiX,s.y-mpiY)),sorted=[...radii].sort((a,b)=>a-b);
  const cep=sorted[Math.floor(sorted.length*.5)]||0,r90=sorted[Math.min(Math.floor(sorted.length*.9),sorted.length-1)]||0;
  const mr=mean(radii),es=Math.max(...radii)*2,sdR=std(radii),sdV=std(vs),meanV=mean(vs),esV=vs.length?Math.max(...vs)-Math.min(...vs):0,sdX=std(xs),sdY=std(ys);
  let covEllipse=null;
  if(v.length>=3){const cx=xs.map(q=>q-mpiX),cy=ys.map(q=>q-mpiY),n=cx.length,sxx=cx.reduce((s2,q)=>s2+q*q,0)/(n-1),syy=cy.reduce((s2,q)=>s2+q*q,0)/(n-1),sxy=cx.reduce((s2,q,i)=>s2+q*cy[i],0)/(n-1),t=Math.atan2(2*sxy,sxx-syy)/2,k=2.146,a2=(sxx+syy)/2+Math.sqrt(((sxx-syy)/2)**2+sxy**2),b2=(sxx+syy)/2-Math.sqrt(((sxx-syy)/2)**2+sxy**2);covEllipse={rx:Math.sqrt(Math.max(a2,.001)*k),ry:Math.sqrt(Math.max(b2,.001)*k),angle:t*180/Math.PI};}
  return{cep,r90,mpiX,mpiY,mr,es,sdR,sdV,meanV,esV,covEllipse,n:v.length,sdX,sdY};
}
```

Replace with:
```js
function calcStats(shots, sessionFields) {
  // Legacy accuracy stats — only when x + y fields present
  const hasXY = !sessionFields || (sessionFields.some(f => f.key === "x") && sessionFields.some(f => f.key === "y"));
  const hasFps = !sessionFields || sessionFields.some(f => f.key === "fps");
  const v = hasXY
    ? shots.filter(s => { const d = s.data || s; return !isNaN(d.x) && !isNaN(d.y); })
    : shots;
  let cep=0,r90=0,mpiX=0,mpiY=0,mr=0,es=0,sdR=0,covEllipse=null,sdX=0,sdY=0;
  if (hasXY && v.length >= 2) {
    const xs=v.map(s=>(s.data||s).x),ys=v.map(s=>(s.data||s).y);
    mpiX=mean(xs); mpiY=mean(ys);
    const radii=v.map(s=>rad((s.data||s).x-mpiX,(s.data||s).y-mpiY)),sorted=[...radii].sort((a,b)=>a-b);
    cep=sorted[Math.floor(sorted.length*.5)]||0;
    r90=sorted[Math.min(Math.floor(sorted.length*.9),sorted.length-1)]||0;
    mr=mean(radii); es=Math.max(...radii)*2; sdR=std(radii); sdX=std(xs); sdY=std(ys);
    if(v.length>=3){const cx=xs.map(q=>q-mpiX),cy=ys.map(q=>q-mpiY),n=cx.length,sxx=cx.reduce((s2,q)=>s2+q*q,0)/(n-1),syy=cy.reduce((s2,q)=>s2+q*q,0)/(n-1),sxy=cx.reduce((s2,q,i)=>s2+q*cy[i],0)/(n-1),t=Math.atan2(2*sxy,sxx-syy)/2,k=2.146,a2=(sxx+syy)/2+Math.sqrt(((sxx-syy)/2)**2+sxy**2),b2=(sxx+syy)/2-Math.sqrt(((sxx-syy)/2)**2+sxy**2);covEllipse={rx:Math.sqrt(Math.max(a2,.001)*k),ry:Math.sqrt(Math.max(b2,.001)*k),angle:t*180/Math.PI};}
  }
  // Velocity stats — only when fps field present
  let sdV=0,meanV=0,esV=0;
  if (hasFps) {
    const vs=shots.map(s=>(s.data||s).fps).filter(v=>v!==null&&v!==undefined&&!isNaN(v));
    if(vs.length>=2){sdV=std(vs);meanV=mean(vs);esV=Math.max(...vs)-Math.min(...vs);}
    else if(vs.length===1){meanV=vs[0];}
  }
  // Dynamic per-field stats
  const fieldStats = {};
  if (sessionFields) {
    for (const f of sessionFields) {
      if (f.type === "number" && !["x","y","fps"].includes(f.key)) {
        const vals = shots.map(s => (s.data || s)[f.key]).filter(v => v !== null && v !== undefined && !isNaN(v));
        fieldStats[f.key] = {
          type: "number", label: f.label, unit: f.unit || "",
          mean: vals.length >= 1 ? mean(vals) : null,
          sd: vals.length >= 2 ? std(vals) : null,
          es: vals.length >= 2 ? Math.max(...vals) - Math.min(...vals) : null,
          min: vals.length >= 1 ? Math.min(...vals) : null,
          max: vals.length >= 1 ? Math.max(...vals) : null,
          n: vals.length,
        };
      } else if (f.type === "yesno") {
        const vals = shots.map(s => (s.data || s)[f.key]).filter(v => v !== null && v !== undefined);
        const yesCount = vals.filter(v => v === true).length;
        fieldStats[f.key] = {
          type: "yesno", label: f.label,
          yes: yesCount, no: vals.length - yesCount, total: vals.length,
          pct: vals.length > 0 ? Math.round(yesCount / vals.length * 100) : 0,
        };
      } else if (f.type === "dropdown") {
        const vals = shots.map(s => (s.data || s)[f.key]).filter(v => v !== null && v !== undefined);
        const counts = {};
        for (const v of vals) counts[v] = (counts[v] || 0) + 1;
        fieldStats[f.key] = { type: "dropdown", label: f.label, counts, total: vals.length };
      }
      // text fields: no stats
    }
  }
  return { cep, r90, mpiX, mpiY, mr, es, sdR, sdV, meanV, esV, covEllipse, n: v.length, sdX, sdY, fieldStats, hasXY, hasFps };
}
```

- [ ] **Step 2: Update all `calcStats` call sites to pass fields**

There are 6 call sites. Update each one:

**Line ~1348** (in `finishSession`):
Find: `stats: calcStats(s.shots),`
Change to: `stats: calcStats(s.shots, s.config.fields || fields),`

**Line ~1463** (FIRE phase stats):
Find: `const stats = useMemo(() => calcStats(shots), [shots]);`
Change to: `const stats = useMemo(() => calcStats(shots, cfg.fields || fields), [shots, cfg.fields, fields]);`

**Line ~1538** (in `saveSession` callback — single session save):
Find: `const entry = { ...saved, stats: calcStats(saved.shots) };`
Change to: `const entry = { ...saved, stats: calcStats(saved.shots, saved.config.fields || fields) };`

**Line ~1563** (in `loadSessions` — bulk load):
Find: `const entries = saved.map(s => ({ ...s, stats: calcStats(s.shots) }));`
Change to: `const entries = saved.map(s => ({ ...s, stats: calcStats(s.shots, s.config.fields) }));`

**Line ~1575** (in another load path):
Find: `const entry = { ...saved, stats: calcStats(saved.shots) };`
Change to: `const entry = { ...saved, stats: calcStats(saved.shots, saved.config.fields) };`

**Line ~1631** (Edit Session stats):
Find: `const esStats = useMemo(() => calcStats(esShots), [esShots]);`
Change to: `const esStats = useMemo(() => calcStats(esShots, esCfg.fields || fields), [esShots, esCfg.fields, fields]);`

- [ ] **Step 3: Verify build passes**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: extend calcStats with dynamic per-field stats and conditional accuracy/velocity"
```

---

### Task 2: Conditional Widget Visibility on Results Page

**Files:**
- Modify: `src/App.jsx`

Add a `requires` property to each widget in `WIDGETS` and filter the available widgets per-session based on which fields are present.

- [ ] **Step 1: Add `requires` property to each widget in `WIDGETS`**

Find the `WIDGETS` object (line 840). Add a `requires` array to each widget entry. Modify the object so each entry has the pattern `{ label, default, requires, render }`:

```js
const WIDGETS = {
  dispersion: { label: "Shot Dispersion", default: true, requires: ["x", "y"], render: (s, vs, st, opts, toggle, setOpt) => (
```

```js
  velHist:    { label: "Velocity Distribution", default: true, requires: ["fps"], render: (s, vs, st, opts) => (
```

```js
  velRad:     { label: "FPS vs Radial", default: true, requires: ["fps", "x", "y"], render: (s, vs) => (
```

```js
  metrics:    { label: "Key Metrics", default: true, requires: [], render: (s, vs, st, opts, toggle) => {
```

```js
  radTrack:   { label: "Radial Tracking", default: false, requires: ["x", "y"], render: (s, vs, st, opts) => (
```

```js
  fpsTrack:   { label: "FPS Tracking", default: false, requires: ["fps"], render: (s, vs, st, opts) => (
```

```js
  xyTrack:    { label: "X/Y Deviation", default: false, requires: ["x", "y"], render: (s, vs) => (
```

```js
  shotTable:   { label: "Shot Table", default: false, requires: [], render: (s, vs) => <ShotTable shots={vs} session={s} /> },
```

```js
  attachments: { label: "Attachments", default: false, requires: [], render: (s, _vs, _st, _opts, _toggle, _setOpt, onError) => (
```

```js
  velRanking: { label: "Best Velocity", default: false, requires: ["fps"], render: (s, _vs, st) => (
```

```js
  accuracyRanking: { label: "Best Accuracy", default: false, requires: ["x", "y"], render: (s, _vs, st) => (
```

- [ ] **Step 2: Filter widgets on the Results page**

In the Results page section (line ~1928), after `const st = s.stats;`, add a helper to get available widget keys:

Find:
```js
    const s = viewed;
    const vs = s.shots.filter(sh => !isNaN(sh.fps) && !isNaN(sh.x) && !isNaN(sh.y));
    const st = s.stats;
```

Replace with:
```js
    const s = viewed;
    const sf = s.config.fields || fields;
    const sfKeys = new Set(sf.map(f => f.key));
    const availableWidgets = Object.keys(WIDGETS).filter(k => WIDGETS[k].requires.every(r => sfKeys.has(r)));
    const activeLayout = layout.filter(k => availableWidgets.includes(k));
    const vs = s.shots.filter(sh => {
      const d = sh.data || sh;
      const reqNum = sf.filter(f => f.required && f.type === "number").map(f => f.key);
      return reqNum.every(k => d[k] !== null && d[k] !== undefined && !isNaN(d[k]));
    });
    const st = s.stats;
```

- [ ] **Step 3: Update the widget grid to use `activeLayout` and `availableWidgets`**

In the widget grid rendering, replace references to `layout` with `activeLayout` and filter the WidgetAdder.

Find:
```jsx
            {layout.map((key, idx) => {
              const wg = WIDGETS[key]; if (!wg) return null;
```

Change to:
```jsx
            {activeLayout.map((key, idx) => {
              const wg = WIDGETS[key]; if (!wg) return null;
```

Find:
```jsx
            {Object.keys(WIDGETS).some(k => !layout.includes(k)) && (
              <div className="p-5 border-b border-border lg:col-span-2 flex justify-center">
                <WidgetAdder
                  available={Object.keys(WIDGETS).filter(k => !layout.includes(k))}
                  labels={Object.fromEntries(Object.keys(WIDGETS).map(k => [k, WIDGETS[k].label]))}
                  onAdd={toggleWidget} />
```

Change to:
```jsx
            {availableWidgets.some(k => !activeLayout.includes(k)) && (
              <div className="p-5 border-b border-border lg:col-span-2 flex justify-center">
                <WidgetAdder
                  available={availableWidgets.filter(k => !activeLayout.includes(k))}
                  labels={Object.fromEntries(availableWidgets.map(k => [k, WIDGETS[k].label]))}
                  onAdd={toggleWidget} />
```

- [ ] **Step 4: Verify build passes**

Run: `npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: conditional widget visibility based on session measurement fields"
```

---

### Task 3: Dynamic Key Metrics Widget

**Files:**
- Modify: `src/App.jsx`

Replace the hardcoded metrics grid with a dynamic renderer that uses `stats.fieldStats`, `stats.hasXY`, and `stats.hasFps`.

- [ ] **Step 1: Replace the Key Metrics widget render function**

Find the `metrics` entry in `WIDGETS` (line ~858):
```js
  metrics:    { label: "Key Metrics", default: true, requires: [], render: (s, vs, st, opts, toggle) => {
    const OMAP = { "CEP": "showCep", "R90": "showR90", "MPI X/Y": "showMpi" };
    return (
      <>
      <p className="text-[11px] text-muted-foreground/60 mb-2 mt-0">Click CEP, R90, or MPI to toggle overlays on the chart.</p>
      <div className="grid grid-cols-2 gap-2">
        {[["CEP",st.cep.toFixed(2)+" in",0,OC.cep],["R90",st.r90.toFixed(2)+" in",0,OC.r90],["SD X",st.sdX.toFixed(2)],["SD Y",st.sdY.toFixed(2)],["Mean FPS",st.meanV.toFixed(1),0,opts.color||G],["SD FPS",st.sdV.toFixed(1)],["ES FPS",st.esV.toFixed(1)],["Mean Rad",st.mr.toFixed(2)],["MPI X/Y",st.mpiX.toFixed(1)+"/"+st.mpiY.toFixed(1),0,OC.mpi],["Ext Spread",st.es.toFixed(2)]].map(([k,v,g,ac]) => {
          const ok = OMAP[k];
          return <SB key={k} label={k} value={v} gold={g} accentColor={ac}
            onClick={ok && toggle ? () => toggle(ok) : undefined}
            active={ok ? opts[ok] : undefined} />;
        })}
      </div>
      </>
    );
  }},
```

Replace with:
```js
  metrics:    { label: "Key Metrics", default: true, requires: [], render: (s, vs, st, opts, toggle) => {
    const OMAP = { "CEP": "showCep", "R90": "showR90", "MPI X/Y": "showMpi" };
    const sb = (k, v, g, ac, onClick, active) => <SB key={k} label={k} value={v} gold={g} accentColor={ac} onClick={onClick} active={active} />;
    return (
      <>
      {st.hasXY && <p className="text-[11px] text-muted-foreground/60 mb-2 mt-0">Click CEP, R90, or MPI to toggle overlays on the chart.</p>}
      <div className="grid grid-cols-2 gap-2">
        {st.hasXY && <>
          {sb("CEP", st.cep.toFixed(2)+" in", 0, OC.cep, toggle ? () => toggle("showCep") : undefined, opts.showCep)}
          {sb("R90", st.r90.toFixed(2)+" in", 0, OC.r90, toggle ? () => toggle("showR90") : undefined, opts.showR90)}
          {sb("SD X", st.sdX.toFixed(2))}
          {sb("SD Y", st.sdY.toFixed(2))}
          {sb("MPI X/Y", st.mpiX.toFixed(1)+"/"+st.mpiY.toFixed(1), 0, OC.mpi, toggle ? () => toggle("showMpi") : undefined, opts.showMpi)}
          {sb("Mean Rad", st.mr.toFixed(2))}
          {sb("Ext Spread", st.es.toFixed(2))}
        </>}
        {st.hasFps && <>
          {sb("Mean FPS", st.meanV.toFixed(1), 0, opts.color || G)}
          {sb("SD FPS", st.sdV.toFixed(1))}
          {sb("ES FPS", st.esV.toFixed(1))}
        </>}
        {st.fieldStats && Object.entries(st.fieldStats).flatMap(([key, fs]) => {
          if (fs.type === "number") return [
            fs.mean !== null ? sb(`Mean ${fs.label}`, `${fs.mean.toFixed(1)}${fs.unit ? " " + fs.unit : ""}`) : null,
            fs.sd !== null ? sb(`SD ${fs.label}`, `${fs.sd.toFixed(1)}${fs.unit ? " " + fs.unit : ""}`) : null,
            fs.es !== null ? sb(`ES ${fs.label}`, `${fs.es.toFixed(1)}${fs.unit ? " " + fs.unit : ""}`) : null,
          ].filter(Boolean);
          if (fs.type === "yesno") return [sb(fs.label, `${fs.yes}/${fs.total} (${fs.pct}%)`)];
          if (fs.type === "dropdown") return Object.entries(fs.counts).map(([opt, cnt]) =>
            sb(`${fs.label}: ${opt}`, `${cnt}/${fs.total}`)
          );
          return [];
        })}
      </div>
      </>
    );
  }},
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: dynamic Key Metrics widget renders stats based on available fields"
```

---

### Task 4: Dynamic Shot Table Widget

**Files:**
- Modify: `src/App.jsx`

The `ShotTable` component (line ~742) has hardcoded columns for FPS/X/Y/Wt/Rad. Make it dynamic based on the session's fields.

- [ ] **Step 1: Update `ShotTable` to accept session and render dynamic columns**

Find the `ShotTable` component (line 742):
```js
function ShotTable({ shots }) {
  const hdrs = ["#","Serial","FPS","X","Y","Wt","Rad","Time"];
  const right = ["FPS","X","Y","Wt","Rad"];
  return (
    <div className="overflow-auto max-h-52">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-border">
            {hdrs.map(h => (
              <th key={h} className={cn(
                "text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2.5 py-1.5",
                right.includes(h) ? "text-right" : "text-left"
              )}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shots.map((s, i) => (
            <tr key={i} className="border-b border-border transition-colors duration-150 hover:bg-accent/40">
              <td className="text-muted-foreground px-2.5 py-1.5">{s.shotNum}</td>
              <td className="text-muted-foreground px-2.5 py-1.5 font-mono text-[11px]">{s.serial}</td>
              <td className="text-foreground px-2.5 py-1.5 text-right font-mono">{s.fps}</td>
              <td className="text-foreground px-2.5 py-1.5 text-right font-mono">{s.x}</td>
              <td className="text-foreground px-2.5 py-1.5 text-right font-mono">{s.y}</td>
              <td className="text-muted-foreground px-2.5 py-1.5 text-right font-mono">{s.weight || "—"}</td>
              <td className="text-muted-foreground px-2.5 py-1.5 text-right font-mono">{rad(s.x, s.y).toFixed(1)}</td>
              <td className="text-muted-foreground px-2.5 py-1.5">{s.timestamp}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Replace with:
```js
function ShotTable({ shots, session }) {
  const sf = session?.config?.fields || DEFAULT_FIELDS;
  return (
    <div className="overflow-auto max-h-52">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2.5 py-1.5 text-left">#</th>
            <th className="text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2.5 py-1.5 text-left">Serial</th>
            {sf.map(f => (
              <th key={f.key} className={cn(
                "text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2.5 py-1.5",
                f.type === "number" ? "text-right" : "text-left"
              )}>{f.label}</th>
            ))}
            <th className="text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2.5 py-1.5 text-left">Time</th>
          </tr>
        </thead>
        <tbody>
          {shots.map((s, i) => (
            <tr key={i} className="border-b border-border transition-colors duration-150 hover:bg-accent/40">
              <td className="text-muted-foreground px-2.5 py-1.5">{s.shotNum}</td>
              <td className="text-muted-foreground px-2.5 py-1.5 font-mono text-[11px]">{s.serial}</td>
              {sf.map(f => {
                const val = (s.data || s)[f.key];
                let display = "";
                if (val === true) display = "Yes";
                else if (val === false) display = "No";
                else if (val !== null && val !== undefined) display = String(val);
                return (
                  <td key={f.key} className={cn(
                    "px-2.5 py-1.5",
                    f.type === "number" ? "text-foreground text-right font-mono" : "text-foreground"
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

- [ ] **Step 2: Update the `shotTable` widget render to pass `session`**

This was already done in Task 2 Step 1 when we added `requires` — the render changed to:
```js
  shotTable: { label: "Shot Table", default: false, requires: [], render: (s, vs) => <ShotTable shots={vs} session={s} /> },
```

Verify this is in place. If not, update the `shotTable` entry in `WIDGETS`:

Find:
```js
  shotTable:   { label: "Shot Table", default: false, render: (s, vs) => <ShotTable shots={vs} /> },
```

Change to:
```js
  shotTable:   { label: "Shot Table", default: false, requires: [], render: (s, vs) => <ShotTable shots={vs} session={s} /> },
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: dynamic Shot Table widget renders columns from session fields"
```

---

### Task 5: Update Results Page `validShots` and CSV Export

**Files:**
- Modify: `src/App.jsx`

The Results page still filters `validShots` with hardcoded `fps`/`x`/`y`. Update it and the CSV export to work dynamically.

- [ ] **Step 1: Update `exportMasterCsv` for dynamic fields**

Find the `exportMasterCsv` function (line ~112):
```js
function exportMasterCsv(log,vars){const h=["Serial #",...vars.map(v=>v.label),"X (in)","Y (in)","Chrono FPS","Weight (g)","Time Stamp","Date","Notes"];const rows=[rowC(h)];log.forEach(s=>{s.shots.forEach(sh=>{rows.push(rowC([sh.serial,...vars.map(v=>s.config[v.key]||""),sh.x,sh.y,sh.fps,sh.weight||"",sh.timestamp||"",s.config.date||"",s.config.notes||""]));});});dl(rows.join("\n"),"Ballistic_Master.csv","text/csv");}
```

Replace with:
```js
function exportMasterCsv(log,vars){
  // Build union of all fields across sessions
  const allFieldKeys = [];
  const allFieldLabels = {};
  log.forEach(s => {
    const sf = s.config.fields || DEFAULT_FIELDS;
    sf.forEach(f => {
      if (!allFieldKeys.includes(f.key)) {
        allFieldKeys.push(f.key);
        allFieldLabels[f.key] = f.unit ? `${f.label} (${f.unit})` : f.label;
      }
    });
  });
  const h=["Serial #",...vars.map(v=>v.label),...allFieldKeys.map(k=>allFieldLabels[k]),"Time Stamp","Date","Notes"];
  const rows=[rowC(h)];
  log.forEach(s=>{
    s.shots.forEach(sh=>{
      const d = sh.data || sh;
      rows.push(rowC([
        sh.serial,
        ...vars.map(v=>s.config[v.key]||""),
        ...allFieldKeys.map(k => {
          const val = d[k];
          if (val === true) return "Yes";
          if (val === false) return "No";
          return val ?? "";
        }),
        sh.timestamp||"",s.config.date||"",s.config.notes||""
      ]));
    });
  });
  dl(rows.join("\n"),"Ballistic_Master.csv","text/csv");
}
```

- [ ] **Step 2: Verify build passes**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: dynamic CSV export with session-specific measurement fields"
```
