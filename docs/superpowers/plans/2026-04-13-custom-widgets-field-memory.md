# Custom Field Widgets & Field Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-generate chart widgets for custom measurement fields and remember custom field definitions for quick reuse in future sessions.

**Architecture:** Replace the static `WIDGETS` object with a `buildWidgets(sessionFields)` function that returns both the existing static widgets and dynamically generated widgets for custom fields. Add a `customPresets` array to `app_settings` that accumulates user-created field definitions for the preset dropdown. Three new D3 chart components handle the visualizations: `NumberFieldChart` (tracking + histogram toggle), `DonutChart` (yes/no), and `BarChart` (dropdown).

**Tech Stack:** React 19, D3 v7, Tailwind CSS v4, Supabase (JSONB)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/App.jsx` | All changes — new chart components, `buildWidgets()` function, updated widget consumers, field memory state/UI |

This codebase uses a single-file architecture. All components, state, and logic live in `src/App.jsx`. Follow this pattern.

---

### Task 1: NumberFieldChart Component

**Files:**
- Modify: `src/App.jsx:792-793` (insert new component after `FpsTrack`)

This component renders a D3 tracking chart or histogram for any custom number field, toggled via a mode prop.

- [ ] **Step 1: Add the NumberFieldChart component**

Insert this component immediately after the closing `}` of the `FpsTrack` component (after line 792 in `src/App.jsx`). The component goes between `FpsTrack` and `XYTrack`:

```jsx
function NumberFieldChart({ shots, fieldKey, label, unit, width = 360, color = G, mode = "tracking", onModeChange }) {
  const ref = useRef();
  const [tip, setTip] = useState(null);
  const vals = useMemo(() =>
    shots.map((s, i) => ({ i: i + 1, v: (s.data || s)[fieldKey] }))
      .filter(d => d.v !== null && d.v !== undefined && !isNaN(d.v)),
    [shots, fieldKey]
  );

  useEffect(() => {
    if (!ref.current || vals.length < 2) return;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();

    if (mode === "tracking") {
      // Line chart: value over shot number (same pattern as FpsTrack)
      const m = { t: 15, r: 15, b: 30, l: 42 }, w = width - m.l - m.r, h = 125 - m.t - m.b;
      const x = d3.scaleLinear().domain([1, vals.length]).range([0, w]);
      const y = d3.scaleLinear().domain([d3.min(vals, d => d.v) - (d3.max(vals, d => d.v) - d3.min(vals, d => d.v)) * 0.1 || 1, d3.max(vals, d => d.v) + (d3.max(vals, d => d.v) - d3.min(vals, d => d.v)) * 0.1 || 1]).range([h, 0]);
      const gg = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
      gg.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(Math.min(vals.length, 10)).tickFormat(d3.format("d"))).selectAll("text").attr("fill", TICK_CLR).attr("font-size", 9);
      gg.append("g").call(d3.axisLeft(y).ticks(4)).selectAll("text").attr("fill", TICK_CLR).attr("font-size", 9);
      gg.selectAll(".domain,.tick line").attr("stroke", AXIS_CLR);
      const mv = mean(vals.map(d => d.v));
      gg.append("line").attr("x1", 0).attr("x2", w).attr("y1", y(mv)).attr("y2", y(mv))
        .attr("stroke", color).attr("stroke-width", 1).attr("stroke-dasharray", "4,3").attr("stroke-opacity", .45);
      gg.append("path").datum(vals).attr("fill", "none").attr("stroke", color).attr("stroke-width", 1.5)
        .attr("d", d3.line().x(d => x(d.i)).y(d => y(d.v)).curve(d3.curveMonotoneX));
      gg.selectAll("circle").data(vals).join("circle")
        .attr("cx", d => x(d.i)).attr("cy", d => y(d.v)).attr("r", 4)
        .attr("fill", color).attr("stroke", "rgba(255,255,255,0.3)").attr("stroke-width", .4)
        .attr("cursor", "crosshair")
        .on("mouseenter", function(ev, d) {
          d3.select(this).attr("r", 6);
          setTip({ x: ev.clientX, y: ev.clientY, lines: [`Shot\u00a0#${d.i}`, `${label}\u00a0${d.v}${unit ? "\u00a0" + unit : ""}`] });
        })
        .on("mousemove", (ev) => setTip(t => t ? { ...t, x: ev.clientX, y: ev.clientY } : t))
        .on("mouseleave", function() { d3.select(this).attr("r", 4); setTip(null); });
      svg.append("text").attr("x", width / 2).attr("y", 122).attr("text-anchor", "middle")
        .attr("fill", TICK_CLR).attr("font-size", 10).attr("font-weight", "500").text(`Shot # → ${label}${unit ? " (" + unit + ")" : ""}`);
    } else {
      // Histogram: distribution of values (same pattern as VelHist)
      const m = { t: 20, r: 15, b: 34, l: 38 }, w = width - m.l - m.r, h = 145 - m.t - m.b;
      const raw = vals.map(d => d.v);
      const x = d3.scaleLinear().domain([Math.min(...raw) - (Math.max(...raw) - Math.min(...raw)) * 0.1 || -1, Math.max(...raw) + (Math.max(...raw) - Math.min(...raw)) * 0.1 || 1]).range([0, w]);
      const bins = d3.bin().domain(x.domain()).thresholds(Math.min(vals.length, 14))(raw);
      const y = d3.scaleLinear().domain([0, d3.max(bins, d => d.length)]).nice().range([h, 0]);
      const gg = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
      gg.selectAll("rect").data(bins).join("rect")
        .attr("x", d => x(d.x0) + 1).attr("y", d => y(d.length))
        .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 2)).attr("height", d => h - y(d.length))
        .attr("fill", color).attr("fill-opacity", .7).attr("rx", 2);
      gg.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).ticks(5)).selectAll("text").attr("fill", TICK_CLR).attr("font-size", 9);
      gg.append("g").call(d3.axisLeft(y).ticks(3)).selectAll("text").attr("fill", TICK_CLR).attr("font-size", 9);
      gg.selectAll(".domain,.tick line").attr("stroke", AXIS_CLR);
      // KDE curve
      const bw = std(raw) * .6 || 5;
      const kde = x.ticks(50).map(t => [t, raw.reduce((s2, vi) => s2 + Math.exp(-.5 * ((t - vi) / bw) ** 2), 0) / (raw.length * bw * Math.sqrt(2 * Math.PI))]);
      const yK = d3.scaleLinear().domain([0, d3.max(kde, d => d[1])]).range([h, 0]);
      gg.append("path").datum(kde).attr("fill", "none").attr("stroke", "rgba(255,255,255,0.45)").attr("stroke-width", 1.5)
        .attr("d", d3.line().x(d => x(d[0])).y(d => yK(d[1])).curve(d3.curveBasis));
      svg.append("text").attr("x", width / 2).attr("y", 142).attr("text-anchor", "middle")
        .attr("fill", TICK_CLR).attr("font-size", 10).attr("font-weight", "500").text(`${label}${unit ? " (" + unit + ")" : ""}`);
    }
  }, [vals, width, color, mode, label, unit]);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <svg ref={ref} width={width} height={mode === "tracking" ? 125 : 145} style={{ background: CHART_BG, borderRadius: 10 }} />
      <ChartTooltip tip={tip} />
    </div>
  );
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: Build succeeds with no errors. The component is defined but not yet used.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add NumberFieldChart component with tracking and histogram modes"
```

---

### Task 2: DonutChart Component

**Files:**
- Modify: `src/App.jsx` (insert after NumberFieldChart, before `XYTrack`)

This component renders a D3 donut/arc chart for yes/no fields showing Yes vs No distribution.

- [ ] **Step 1: Add the DonutChart component**

Insert immediately after the `NumberFieldChart` component:

```jsx
function DonutChart({ yesCount, noCount, total, label, width = 360, color = G }) {
  const ref = useRef();
  useEffect(() => {
    if (!ref.current || total === 0) return;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    const size = Math.min(width, 180);
    const radius = size / 2 - 10;
    const innerRadius = radius * 0.55;
    const gg = svg.append("g").attr("transform", `translate(${width / 2},${90})`);

    const data = [
      { label: "Yes", value: yesCount, color: color },
      { label: "No", value: noCount, color: "rgba(255,255,255,0.15)" },
    ].filter(d => d.value > 0);

    const pie = d3.pie().value(d => d.value).sort(null).padAngle(0.03);
    const arc = d3.arc().innerRadius(innerRadius).outerRadius(radius);

    gg.selectAll("path").data(pie(data)).join("path")
      .attr("d", arc)
      .attr("fill", d => d.data.color)
      .attr("stroke", "rgba(0,0,0,0.3)")
      .attr("stroke-width", 1);

    // Center percentage text
    const pct = total > 0 ? Math.round(yesCount / total * 100) : 0;
    gg.append("text").attr("text-anchor", "middle").attr("dy", "-0.1em")
      .attr("fill", "#fff").attr("font-size", 22).attr("font-weight", "700")
      .text(`${pct}%`);
    gg.append("text").attr("text-anchor", "middle").attr("dy", "1.3em")
      .attr("fill", TICK_CLR).attr("font-size", 10)
      .text("Yes");

    // Legend below
    const legend = svg.append("g").attr("transform", `translate(${width / 2 - 60},${175})`);
    const items = [
      { label: `Yes: ${yesCount}`, color: color },
      { label: `No: ${noCount}`, color: "rgba(255,255,255,0.15)" },
    ];
    items.forEach((item, i) => {
      const g = legend.append("g").attr("transform", `translate(${i * 80},0)`);
      g.append("rect").attr("width", 10).attr("height", 10).attr("rx", 2).attr("fill", item.color);
      g.append("text").attr("x", 14).attr("y", 9).attr("fill", TICK_CLR).attr("font-size", 10).text(item.label);
    });
  }, [yesCount, noCount, total, width, color]);

  return <svg ref={ref} width={width} height={200} style={{ background: CHART_BG, borderRadius: 10 }} />;
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add DonutChart component for yes/no field visualization"
```

---

### Task 3: BarChart Component

**Files:**
- Modify: `src/App.jsx` (insert after DonutChart, before `XYTrack`)

This component renders a D3 horizontal bar chart for dropdown fields showing count per option.

- [ ] **Step 1: Add the BarChart component**

Insert immediately after the `DonutChart` component:

```jsx
function FieldBarChart({ counts, total, label, width = 360, color = G }) {
  const ref = useRef();
  useEffect(() => {
    if (!ref.current || total === 0) return;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const barH = 22, gap = 4, m = { t: 10, r: 15, b: 10, l: 90 };
    const h = m.t + entries.length * (barH + gap) + m.b;
    const w = width - m.l - m.r;

    svg.attr("height", h);
    const gg = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);

    const x = d3.scaleLinear().domain([0, d3.max(entries, d => d[1])]).nice().range([0, w]);

    entries.forEach(([opt, cnt], i) => {
      const y = i * (barH + gap);
      const opacity = 0.9 - (i * 0.12);
      gg.append("rect")
        .attr("x", 0).attr("y", y)
        .attr("width", x(cnt)).attr("height", barH)
        .attr("fill", color).attr("fill-opacity", Math.max(opacity, 0.3)).attr("rx", 3);

      // Count label inside bar (or to the right if bar is too small)
      const countX = x(cnt) > 30 ? x(cnt) - 6 : x(cnt) + 6;
      const countAnchor = x(cnt) > 30 ? "end" : "start";
      gg.append("text")
        .attr("x", countX).attr("y", y + barH / 2 + 1)
        .attr("text-anchor", countAnchor).attr("dominant-baseline", "middle")
        .attr("fill", x(cnt) > 30 ? "rgba(0,0,0,0.8)" : TICK_CLR)
        .attr("font-size", 11).attr("font-weight", "600")
        .text(cnt);

      // Option label to the left
      gg.append("text")
        .attr("x", -6).attr("y", y + barH / 2 + 1)
        .attr("text-anchor", "end").attr("dominant-baseline", "middle")
        .attr("fill", TICK_CLR).attr("font-size", 11)
        .text(opt.length > 12 ? opt.slice(0, 11) + "…" : opt);
    });
  }, [counts, total, width, color]);

  const entryCount = Object.keys(counts).length;
  const h = 10 + entryCount * 26 + 10;
  return <svg ref={ref} width={width} height={Math.max(h, 60)} style={{ background: CHART_BG, borderRadius: 10 }} />;
}
```

Note: The component is named `FieldBarChart` (not `BarChart`) to avoid potential conflicts with any generic name.

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add FieldBarChart component for dropdown field visualization"
```

---

### Task 4: buildWidgets Function and Widget Registry Update

**Files:**
- Modify: `src/App.jsx:928-1003` (replace static `WIDGETS` object with `buildWidgets` function)

Replace the static `WIDGETS` constant with a `buildWidgets(sessionFields)` function that returns the same static widgets plus dynamically generated ones for custom fields.

- [ ] **Step 1: Replace the WIDGETS constant and DEF_LAYOUT**

Find this code (around line 928-1003):

```js
// ─── Widget registry ──────────────────────────────────────────────────────────
const WIDGETS = {
  dispersion: { label: "Shot Dispersion", default: true, requires: ["x", "y"], render: (s, vs, st, opts, toggle, setOpt) => (
```

...through to...

```js
};
const DEF_LAYOUT = Object.keys(WIDGETS).filter(k => WIDGETS[k].default);
```

Replace the entire block with:

```jsx
// ─── Widget registry ──────────────────────────────────────────────────────────
const STATIC_WIDGETS = {
  dispersion: { label: "Shot Dispersion", default: true, requires: ["x", "y"], render: (s, vs, st, opts, toggle, setOpt) => (
    <>
      <div className="flex gap-1.5 mb-2.5 flex-wrap items-center">
        {[["showEllipse","Ellipse",OC.ellipse],["showGrid","Grid"]].map(([k,l,c]) => (
          <Toggle key={k} label={l} on={opts[k]} onToggle={() => toggle(k)} color={c} />
        ))}
        <ColorPicker color={opts.color || G} onChange={c => setOpt("color", c)} />
      </div>
      <AutoSizeChart render={(w, h) => <DispersionChart shots={vs} stats={st} size={Math.min(w, h) - 12} opts={opts} color={opts.color || G} />} />
    </>
  )},
  velHist:    { label: "Velocity Distribution", default: true, requires: ["fps"], render: (s, vs, st, opts) => (
    <AutoSizeChart render={(w) => <VelHist shots={vs} width={w - 8} color={opts.color || G} />} />
  )},
  velRad:     { label: "FPS vs Radial", default: true, requires: ["fps", "x", "y"], render: (s, vs) => (
    <AutoSizeChart render={(w) => <VelRad shots={vs} width={w - 8} />} />
  )},
  metrics:    { label: "Key Metrics", default: true, requires: [], render: (s, vs, st, opts, toggle) => {
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
  radTrack:   { label: "Radial Tracking", default: false, requires: ["x", "y"], render: (s, vs, st, opts) => (
    <AutoSizeChart render={(w) => <RadialTrack shots={vs} width={w - 8} color={opts.color || G} />} />
  )},
  fpsTrack:   { label: "FPS Tracking", default: false, requires: ["fps"], render: (s, vs, st, opts) => (
    <AutoSizeChart render={(w) => <FpsTrack shots={vs} width={w - 8} color={opts.color || G} />} />
  )},
  xyTrack:    { label: "X/Y Deviation", default: false, requires: ["x", "y"], render: (s, vs) => (
    <AutoSizeChart render={(w) => <XYTrack shots={vs} width={w - 8} />} />
  )},
  shotTable:   { label: "Shot Table", default: false, requires: [], render: (s, vs) => <ShotTable shots={vs} session={s} /> },
  attachments: { label: "Attachments", default: false, requires: [], render: (s, _vs, _st, _opts, _toggle, _setOpt, onError) => (
    <AttachmentWidget session={s} onError={onError} />
  )},
  velRanking: { label: "Best Velocity", default: false, requires: ["fps"], render: (s, _vs, st) => (
    <VelRankingWidget sessions={[{ name: s.config.sessionName || 'This Session', color: '#FFDF00', stats: st }]} />
  )},
  accuracyRanking: { label: "Best Accuracy", default: false, requires: ["x", "y"], render: (s, _vs, st) => (
    <AccuracyRankingWidget sessions={[{ name: s.config.sessionName || 'This Session', color: '#FFDF00', stats: st }]} />
  )},
};

function buildWidgets(sessionFields) {
  const widgets = { ...STATIC_WIDGETS };
  if (!sessionFields) return widgets;

  for (const f of sessionFields) {
    // Skip built-in fields that already have dedicated widgets
    if (["fps", "x", "y"].includes(f.key)) continue;
    // Skip text fields (no meaningful visualization)
    if (f.type === "text") continue;

    const wKey = `custom_${f.key}`;

    if (f.type === "number") {
      const fieldKey = f.key, fieldLabel = f.label, fieldUnit = f.unit || "";
      widgets[wKey] = {
        label: `${fieldLabel} Chart`,
        default: false,
        requires: [fieldKey],
        render: (s, vs, st, opts, toggle, setOpt) => (
          <>
            <div className="flex gap-1.5 mb-2.5 flex-wrap items-center">
              <Toggle label="Tracking" on={opts.chartMode !== "histogram"} onToggle={() => setOpt("chartMode", opts.chartMode === "histogram" ? "tracking" : "histogram")} />
              <ColorPicker color={opts.color || G} onChange={c => setOpt("color", c)} />
            </div>
            <AutoSizeChart render={(w) => (
              <NumberFieldChart
                shots={vs} fieldKey={fieldKey} label={fieldLabel}
                unit={fieldUnit} width={w - 8} color={opts.color || G}
                mode={opts.chartMode || "tracking"}
                onModeChange={m => setOpt("chartMode", m)}
              />
            )} />
          </>
        ),
      };
    }

    if (f.type === "yesno") {
      const fieldKey = f.key, fieldLabel = f.label;
      widgets[wKey] = {
        label: `${fieldLabel} Chart`,
        default: false,
        requires: [fieldKey],
        render: (s, vs, st, opts) => (
          <AutoSizeChart render={(w) => (
            <DonutChart
              yesCount={st.fieldStats?.[fieldKey]?.yes || 0}
              noCount={(st.fieldStats?.[fieldKey]?.total || 0) - (st.fieldStats?.[fieldKey]?.yes || 0)}
              total={st.fieldStats?.[fieldKey]?.total || 0}
              label={fieldLabel} width={w - 8} color={opts.color || G}
            />
          )} />
        ),
      };
    }

    if (f.type === "dropdown") {
      const fieldKey = f.key, fieldLabel = f.label;
      widgets[wKey] = {
        label: `${fieldLabel} Chart`,
        default: false,
        requires: [fieldKey],
        render: (s, vs, st, opts) => (
          <AutoSizeChart render={(w) => (
            <FieldBarChart
              counts={st.fieldStats?.[fieldKey]?.counts || {}}
              total={st.fieldStats?.[fieldKey]?.total || 0}
              label={fieldLabel} width={w - 8} color={opts.color || G}
            />
          )} />
        ),
      };
    }
  }

  return widgets;
}

const DEF_LAYOUT = Object.keys(STATIC_WIDGETS).filter(k => STATIC_WIDGETS[k].default);
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: Build succeeds. The `buildWidgets` function exists but nothing calls it yet — consumers still reference the old `WIDGETS` constant name which no longer exists. This will cause a build error. That's expected — we fix consumers in the next step.

- [ ] **Step 3: Update all WIDGETS references to use buildWidgets**

There are three consumers of the widget registry that need updating:

**Consumer 1 — Results page (around line 2079).** Find:

```js
const availableWidgets = Object.keys(WIDGETS).filter(k => WIDGETS[k].requires.every(r => sfKeys.has(r)));
```

Replace with:

```js
const widgets = buildWidgets(sf);
const availableWidgets = Object.keys(widgets).filter(k => widgets[k].requires.every(r => sfKeys.has(r)));
```

Then in the same Results page section, every reference to `WIDGETS[k]` must become `widgets[k]`. Search below that line for any `WIDGETS[` references in the Results render block and replace with `widgets[`. Specifically, look for the widget render call — it will be something like `WIDGETS[k].render(...)` — change to `widgets[k].render(...)`, and `WIDGETS[k].label` to `widgets[k].label`.

**Consumer 2 — Add Widget dropdown in Results page.** Find the section that renders the "Add Widget" dropdown options. It filters `Object.keys(WIDGETS)` to show widgets not yet in the layout. Update `WIDGETS` → `widgets` in that filter.

**Consumer 3 — Compare view does NOT use the Results widget registry.** It has its own `CMP_WIDGET_DEFS` object (around line 2288). No changes needed there for now.

- [ ] **Step 4: Verify the app builds and runs**

Run: `npm run build`
Expected: Build succeeds with no errors. The app renders correctly. When viewing Results for a session with only standard fields (FPS, X, Y, Weight), behavior is identical to before. The Weight field now gets a `custom_weight` widget entry in the Add Widget dropdown labeled "Weight Chart".

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: replace static WIDGETS with buildWidgets for dynamic custom field widgets"
```

---

### Task 5: Field Memory — State and Persistence

**Files:**
- Modify: `src/App.jsx` — App component state, loadAllData, and MeasurementFieldsCard

Add `customPresets` state, load it from settings, and save new custom presets when fields are added.

- [ ] **Step 1: Add customPresets state**

In the `App()` function, find the line (around line 1398):

```js
const [fields, setFields] = useState(DEFAULT_FIELDS);
```

Add immediately after it:

```js
const [customPresets, setCustomPresets] = useState([]);
```

- [ ] **Step 2: Load customPresets from settings**

In the `loadAllData` function, find the line (around line 1471):

```js
if (settings.fields?.length) setFields(settings.fields);
```

Add immediately after it:

```js
if (settings.custom_presets?.length) setCustomPresets(settings.custom_presets);
```

- [ ] **Step 3: Add the addCustomPreset callback**

Find the `updateFields` callback (around line 1620):

```js
const updateFields = useCallback(async (newFields) => {
    setFields(newFields);
    try { await db.saveSettings({ fields: newFields }); } catch (err) { setDbError('Fields save failed: ' + err.message); }
  }, []);
```

Add immediately after it:

```js
const addCustomPreset = useCallback(async (field) => {
  // Skip built-in field keys
  if (["fps", "x", "y", "weight"].includes(field.key)) return;
  setCustomPresets(prev => {
    // Skip if already saved
    if (prev.some(p => p.key === field.key)) return prev;
    const updated = [...prev, { key: field.key, label: field.label, type: field.type, required: field.required, unit: field.unit || "", options: field.options || [] }];
    db.saveSettings({ custom_presets: updated }).catch(err => setDbError('Preset save failed: ' + err.message));
    return updated;
  });
}, []);
```

- [ ] **Step 4: Pass customPresets and addCustomPreset to MeasurementFieldsCard**

Find where `MeasurementFieldsCard` is rendered in the SETUP phase. It looks like:

```jsx
<MeasurementFieldsCard fields={fields} onUpdate={updateFields} />
```

Replace with:

```jsx
<MeasurementFieldsCard fields={fields} onUpdate={updateFields} customPresets={customPresets} onAddCustomPreset={addCustomPreset} />
```

- [ ] **Step 5: Verify the app still builds**

Run: `npm run build`
Expected: Build succeeds. The new props are passed but MeasurementFieldsCard doesn't use them yet (React doesn't error on extra props).

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add customPresets state, loading, and persistence for field memory"
```

---

### Task 6: Field Memory — MeasurementFieldsCard UI Updates

**Files:**
- Modify: `src/App.jsx` — MeasurementFieldsCard component (around line 1060)

Update the MeasurementFieldsCard to accept custom presets, show them in the dropdown with grouped sections, and auto-save new custom fields.

- [ ] **Step 1: Update MeasurementFieldsCard signature and preset logic**

Find the component definition (around line 1060):

```js
function MeasurementFieldsCard({ fields, onUpdate }) {
```

Replace with:

```js
function MeasurementFieldsCard({ fields, onUpdate, customPresets = [], onAddCustomPreset }) {
```

- [ ] **Step 2: Update the PRESETS logic to include custom presets**

Find the existing `PRESETS` and `availablePresets` lines (around line 1069-1075):

```js
  const PRESETS = [
    { key: "fps", label: "FPS", type: "number", required: true, unit: "fps" },
    { key: "x", label: "X", type: "number", required: true, unit: "in" },
    { key: "y", label: "Y", type: "number", required: true, unit: "in" },
    { key: "weight", label: "Weight", type: "number", required: false, unit: "g" },
  ];
  const availablePresets = PRESETS.filter(p => !fields.some(f => f.key === p.key));
```

Replace with:

```js
  const STANDARD_PRESETS = [
    { key: "fps", label: "FPS", type: "number", required: true, unit: "fps" },
    { key: "x", label: "X", type: "number", required: true, unit: "in" },
    { key: "y", label: "Y", type: "number", required: true, unit: "in" },
    { key: "weight", label: "Weight", type: "number", required: false, unit: "g" },
  ];
  const ALL_PRESETS = [...STANDARD_PRESETS, ...customPresets.filter(cp => !STANDARD_PRESETS.some(sp => sp.key === cp.key))];
  const availableStandard = STANDARD_PRESETS.filter(p => !fields.some(f => f.key === p.key));
  const availableCustom = customPresets.filter(cp => !fields.some(f => f.key === cp.key) && !STANDARD_PRESETS.some(sp => sp.key === cp.key));
```

- [ ] **Step 3: Update selectPreset to search ALL_PRESETS**

Find the `selectPreset` function (around line 1077):

```js
  const selectPreset = (key) => {
    if (key === "__custom__") {
      setCustomName(true);
      setNewField({ name: "", type: "number", required: false, unit: "", options: [] });
      return;
    }
    const p = PRESETS.find(x => x.key === key);
    if (p) {
      setCustomName(false);
      setNewField({ name: p.label, type: p.type, required: p.required, unit: p.unit, options: [] });
    }
  };
```

Replace with:

```js
  const selectPreset = (key) => {
    if (key === "__custom__") {
      setCustomName(true);
      setNewField({ name: "", type: "number", required: false, unit: "", options: [] });
      return;
    }
    const p = ALL_PRESETS.find(x => x.key === key);
    if (p) {
      setCustomName(false);
      setNewField({ name: p.label, type: p.type, required: p.required, unit: p.unit || "", options: p.options || [] });
    }
  };
```

- [ ] **Step 4: Update addField to call onAddCustomPreset**

Find the `addField` function (around line 1090). After the line `onUpdate([...fields, field]);` (around line 1103), add the custom preset save call. The updated function:

```js
  const addField = () => {
    const name = newField.name.trim();
    if (!name) return;
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    if (fields.find(f => f.key === key)) return;
    const field = {
      key,
      label: name,
      type: newField.type,
      required: newField.required,
      options: newField.type === "dropdown" ? newField.options : [],
      unit: newField.type === "number" ? newField.unit.trim() : "",
    };
    onUpdate([...fields, field]);
    if (onAddCustomPreset) onAddCustomPreset(field);
    setNewField({ name: "", type: "number", required: false, unit: "", options: [] });
    setNewOption("");
    setCustomName(false);
    setAdding(false);
  };
```

- [ ] **Step 5: Update the dropdown UI to show grouped presets**

Find the `<select>` element for field name (around line 1166-1176). Replace the existing select content:

```jsx
{!customName ? (
  <select
    value={newField.name ? PRESETS.find(p => p.label === newField.name)?.key || "" : ""}
    onChange={e => selectPreset(e.target.value)}
    className="w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
    autoFocus>
    <option value="">— Select field —</option>
    {availablePresets.map(p => (
      <option key={p.key} value={p.key}>{p.label} ({p.unit})</option>
    ))}
    <option value="__custom__">Custom…</option>
  </select>
```

Replace with:

```jsx
{!customName ? (
  <select
    value={newField.name ? ALL_PRESETS.find(p => p.label === newField.name)?.key || "" : ""}
    onChange={e => selectPreset(e.target.value)}
    className="w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
    autoFocus>
    <option value="">— Select field —</option>
    {availableStandard.length > 0 && (
      <optgroup label="Standard">
        {availableStandard.map(p => (
          <option key={p.key} value={p.key}>{p.label}{p.unit ? ` (${p.unit})` : ""}</option>
        ))}
      </optgroup>
    )}
    {availableCustom.length > 0 && (
      <optgroup label="Saved">
        {availableCustom.map(p => (
          <option key={p.key} value={p.key}>{p.label}{p.unit ? ` (${p.unit})` : ""}{p.type !== "number" ? ` · ${p.type}` : ""}</option>
        ))}
      </optgroup>
    )}
    <option value="__custom__">Custom…</option>
  </select>
```

- [ ] **Step 6: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat: field memory UI with grouped preset dropdown and auto-save"
```

---

### Task 7: Update getSettings Return Default

**Files:**
- Modify: `src/lib/db.js:26`

Add `custom_presets: null` to the default return value so the app doesn't need to handle `undefined`.

- [ ] **Step 1: Update the getSettings default**

Find line 26 in `src/lib/db.js`:

```js
  return data || { opts: null, vars: null, layout: null, fields: null };
```

Replace with:

```js
  return data || { opts: null, vars: null, layout: null, fields: null, custom_presets: null };
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db.js
git commit -m "feat: add custom_presets to default settings shape"
```

---

### Task 8: Manual Integration Test

**Files:** None (testing only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Test custom number field widget**

1. Go to Setup page
2. Remove all default fields (FPS, X, Y, Weight)
3. Add a custom field: select "Custom…", name it "Hole Size", type Number, unit "mm", not required
4. Add another custom field: "Tear Size", type Number, unit "mm", not required
5. Start a session and record 5+ shots with values for both fields
6. Go to Results page
7. Verify Key Metrics shows "Mean Hole Size", "SD Hole Size", etc.
8. Open "Add Widget" dropdown — verify "Hole Size Chart" and "Tear Size Chart" appear
9. Add "Hole Size Chart" widget
10. Verify it shows a tracking chart by default
11. Click the "Tracking" toggle to switch to histogram mode — verify it switches

- [ ] **Step 3: Test yes/no field widget**

1. Create a new session with a yes/no field called "Attainment"
2. Record 5+ shots with varying yes/no values
3. Go to Results → Add Widget → verify "Attainment Chart" appears
4. Add it — verify a donut chart shows with correct Yes/No counts and percentage

- [ ] **Step 4: Test dropdown field widget**

1. Create a new session with a dropdown field called "Result" with options: Pass, Fail, Partial
2. Record 5+ shots selecting various options
3. Go to Results → Add Widget → verify "Result Chart" appears
4. Add it — verify a horizontal bar chart shows with correct counts per option

- [ ] **Step 5: Test field memory**

1. Go to Setup page for a new session
2. Click "+ Add Field" — verify the dropdown shows "Standard" group (FPS, X, Y, Weight) and "Saved" group with "Hole Size", "Tear Size", "Attainment", "Result" from previous tests
3. Select "Hole Size" from Saved — verify it auto-fills type (Number), unit (mm), required (no)
4. Verify a new custom field added here also appears in the Saved group on the next session setup

- [ ] **Step 6: Test backwards compatibility**

1. View Results for an old session that used default fields (FPS, X, Y, Weight)
2. Verify all original widgets still work correctly
3. Verify the Weight field now has a "Weight Chart" available in Add Widget
4. Verify no errors in the browser console

- [ ] **Step 7: Full build check**

Run: `npm run build`
Expected: Build succeeds with no errors or warnings.

- [ ] **Step 8: Commit any fixes**

If any issues were found and fixed during testing:

```bash
git add src/App.jsx
git commit -m "fix: address integration test issues for custom widgets and field memory"
```
