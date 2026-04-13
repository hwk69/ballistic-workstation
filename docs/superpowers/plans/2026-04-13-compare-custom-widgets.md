# Compare View Custom Field Widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auto-generated comparison widgets for custom measurement fields (number, yes/no, dropdown) in the Compare view.

**Architecture:** Extend the Compare view's `CMP_WIDGET_DEFS` with dynamic entries for common custom fields, add a new `GroupedBarChart` D3 component for dropdown comparisons, and add `renderWidgetContent` cases for the new widget keys. Number and yes/no fields use the existing side-by-side pattern; dropdown fields use the grouped bar chart.

**Tech Stack:** React 19, D3 v7, Tailwind CSS v4

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/App.jsx` | All changes — new GroupedBarChart component, dynamic CMP_WIDGET_DEFS, renderWidgetContent cases |

---

### Task 1: GroupedBarChart Component

**Files:**
- Modify: `src/App.jsx` (insert after `FieldBarChart`, before `XYTrack`)

A D3 vertical grouped bar chart that compares dropdown field distributions across sessions. X-axis shows dropdown options, each with one bar per session colored in that session's color.

- [ ] **Step 1: Add the GroupedBarChart component**

Find the `FieldBarChart` component (search for `function FieldBarChart`). Insert the new component immediately after it, before `function XYTrack`. The exact insertion point is after the closing `}` of FieldBarChart's function body.

```jsx
function GroupedBarChart({ sessions, fieldKey, options, width = 360 }) {
  const ref = useRef();
  useEffect(() => {
    if (!ref.current || !sessions.length || !options.length) return;
    const svg = d3.select(ref.current); svg.selectAll("*").remove();
    const m = { t: 15, r: 15, b: 50, l: 38 }, w = width - m.l - m.r, h = 160 - m.t - m.b;
    const maxCount = d3.max(sessions, s => d3.max(options, o => s.counts[o] || 0)) || 1;

    const x0 = d3.scaleBand().domain(options).range([0, w]).paddingInner(0.25).paddingOuter(0.1);
    const x1 = d3.scaleBand().domain(sessions.map((_, i) => i)).range([0, x0.bandwidth()]).padding(0.08);
    const y = d3.scaleLinear().domain([0, maxCount]).nice().range([h, 0]);

    const gg = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);

    // Axes
    gg.append("g").attr("transform", `translate(0,${h})`)
      .call(d3.axisBottom(x0).tickSize(0))
      .selectAll("text").attr("fill", TICK_CLR).attr("font-size", 9)
      .attr("transform", "rotate(-25)").attr("text-anchor", "end");
    gg.append("g").call(d3.axisLeft(y).ticks(4).tickFormat(d3.format("d")))
      .selectAll("text").attr("fill", TICK_CLR).attr("font-size", 9);
    gg.selectAll(".domain,.tick line").attr("stroke", AXIS_CLR);

    // Bars
    options.forEach(opt => {
      sessions.forEach((s, si) => {
        const cnt = s.counts[opt] || 0;
        gg.append("rect")
          .attr("x", x0(opt) + x1(si))
          .attr("y", y(cnt))
          .attr("width", x1.bandwidth())
          .attr("height", h - y(cnt))
          .attr("fill", s.color)
          .attr("fill-opacity", 0.85)
          .attr("rx", 2);
        // Count label above bar if there's room
        if (cnt > 0 && h - y(cnt) > 12) {
          gg.append("text")
            .attr("x", x0(opt) + x1(si) + x1.bandwidth() / 2)
            .attr("y", y(cnt) + 12)
            .attr("text-anchor", "middle")
            .attr("fill", "rgba(0,0,0,0.7)")
            .attr("font-size", 9).attr("font-weight", "600")
            .text(cnt);
        }
      });
    });

    // Legend
    const legend = svg.append("g").attr("transform", `translate(${m.l},${m.t + h + 35})`);
    sessions.forEach((s, i) => {
      const g = legend.append("g").attr("transform", `translate(${i * Math.min(120, w / sessions.length)},0)`);
      g.append("rect").attr("width", 8).attr("height", 8).attr("rx", 1.5).attr("fill", s.color);
      g.append("text").attr("x", 12).attr("y", 7).attr("fill", TICK_CLR).attr("font-size", 9)
        .text(s.name.length > 14 ? s.name.slice(0, 13) + "…" : s.name);
    });
  }, [sessions, fieldKey, options, width]);

  return <svg ref={ref} width={width} height={180} style={{ background: CHART_BG, borderRadius: 10 }} />;
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: Build succeeds. Component is defined but not yet used.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add GroupedBarChart component for dropdown field comparison"
```

---

### Task 2: Dynamic CMP_WIDGET_DEFS

**Files:**
- Modify: `src/App.jsx:2560-2567` (the `CMP_WIDGET_DEFS` object and `availableCmpWidgets` filter)

Add dynamic widget entries for custom common fields after the static definitions.

- [ ] **Step 1: Add dynamic entries to CMP_WIDGET_DEFS**

Find the `CMP_WIDGET_DEFS` object (around line 2560). After the static entries and the closing `};`, add the dynamic generation loop. Replace this block:

```js
    const CMP_WIDGET_DEFS = {
      overlay:    { label: "Dispersion Overlay", requires: ["x", "y"] },
      metrics:    { label: "Metrics Table", requires: [] },
      velCompare: { label: "Velocity Comparison", requires: ["fps"] },
      shotLog:    { label: "Shot Log", requires: [] },
      attachments:{ label: "Attachments", requires: [] },
      rankings:   { label: "Rankings", requires: [] },
    };
```

With:

```js
    const CMP_WIDGET_DEFS = {
      overlay:    { label: "Dispersion Overlay", requires: ["x", "y"] },
      metrics:    { label: "Metrics Table", requires: [] },
      velCompare: { label: "Velocity Comparison", requires: ["fps"] },
      shotLog:    { label: "Shot Log", requires: [] },
      attachments:{ label: "Attachments", requires: [] },
      rankings:   { label: "Rankings", requires: [] },
    };
    // Dynamic comparison widgets for custom fields
    for (const f of commonFields) {
      if (["fps", "x", "y"].includes(f.key)) continue;
      if (f.type === "text") continue;
      CMP_WIDGET_DEFS[`cmp_custom_${f.key}`] = {
        label: `${f.label} Comparison`,
        requires: [f.key],
      };
    }
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: Build succeeds. The dynamic entries are added but `renderWidgetContent` doesn't handle them yet (it will return `null` for unknown keys, which is fine).

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add dynamic CMP_WIDGET_DEFS entries for custom common fields"
```

---

### Task 3: renderWidgetContent Cases for Custom Widgets

**Files:**
- Modify: `src/App.jsx` — the `renderWidgetContent(key)` function in the Compare section

Add handling for `cmp_custom_*` keys that renders the appropriate chart based on field type.

- [ ] **Step 1: Add custom widget rendering**

Find the `renderWidgetContent` function (search for `function renderWidgetContent(key)`). Find the line `return null;` at the end of the function (around line 2817). Insert the custom widget handler **before** the `return null;`:

```jsx
      // Custom field comparison widgets
      if (key.startsWith('cmp_custom_')) {
        const fieldKey = key.replace('cmp_custom_', '');
        const f = commonFields.find(cf => cf.key === fieldKey);
        if (!f) return null;

        if (f.type === "number") {
          return (
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(resolved.length, 3)}, 1fr)` }}>
              {resolved.map((r, i) => (
                <div key={i}>
                  <div className="text-xs font-semibold mb-2" style={{ color: r.color }}>{r.session.config.sessionName}</div>
                  <NumberFieldChart shots={r.shots} fieldKey={f.key} label={f.label} unit={f.unit || ""} width={280} color={r.color} mode="histogram" />
                </div>
              ))}
            </div>
          );
        }

        if (f.type === "yesno") {
          return (
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(resolved.length, 3)}, 1fr)` }}>
              {resolved.map((r, i) => {
                const fs = r.stats.fieldStats?.[f.key];
                return (
                  <div key={i}>
                    <div className="text-xs font-semibold mb-2" style={{ color: r.color }}>{r.session.config.sessionName}</div>
                    <DonutChart
                      yesCount={fs?.yes || 0}
                      noCount={(fs?.total || 0) - (fs?.yes || 0)}
                      total={fs?.total || 0}
                      label={f.label} width={180} color={r.color}
                    />
                  </div>
                );
              })}
            </div>
          );
        }

        if (f.type === "dropdown") {
          const allOptions = f.options?.length
            ? f.options
            : [...new Set(resolved.flatMap(r => Object.keys(r.stats.fieldStats?.[f.key]?.counts || {})))];
          return (
            <AutoSizeChart render={(w) => (
              <GroupedBarChart
                sessions={resolved.map(r => ({
                  name: r.session.config.sessionName || 'Session',
                  color: r.color,
                  counts: r.stats.fieldStats?.[f.key]?.counts || {},
                }))}
                fieldKey={f.key}
                options={allOptions}
                width={w - 8}
              />
            )} />
          );
        }

        return null;
      }
```

- [ ] **Step 2: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: render custom field comparison widgets (histogram, donut, grouped bar)"
```

---

### Task 4: Update renderWidget for Custom Widget Padding

**Files:**
- Modify: `src/App.jsx` — the `renderWidget(item)` function in the Compare section

The existing `renderWidget` function has a special case that removes padding for the `rankings` widget. Custom widgets should have normal padding. Check that the padding logic doesn't accidentally strip padding from custom widgets.

- [ ] **Step 1: Verify the padding logic**

Find the `renderWidget` function (around line 2580). Look at the line:

```jsx
<div className={key === 'rankings' ? '' : 'p-4'}>
```

This already works correctly — custom widget keys (`cmp_custom_*`) are not `'rankings'`, so they get `p-4` padding. **No change needed.**

- [ ] **Step 2: Manual integration test**

Start the dev server: `npm run dev`

1. Create two sessions with the same custom fields:
   - Session A: Add a custom number field "Hole Size" (mm), a yes/no field "Attainment", and a dropdown field "Result" (Pass/Fail/Partial). Record 5+ shots.
   - Session B: Same fields, different data. Record 5+ shots.
2. Go to Compare view, select both sessions.
3. Open "Add Widget" dropdown — verify you see "Hole Size Comparison", "Attainment Comparison", "Result Comparison".
4. Add "Hole Size Comparison" — verify side-by-side histograms, one per session in session colors.
5. Add "Attainment Comparison" — verify side-by-side donuts with correct Yes/No counts.
6. Add "Result Comparison" — verify grouped bar chart with bars for Pass/Fail/Partial, one bar per session per option, colored in session colors, with legend.
7. Compare two sessions that have NO custom fields in common — verify custom widgets don't appear in the dropdown.

- [ ] **Step 3: Final build check**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit any fixes**

If any issues were found during testing:
```bash
git add src/App.jsx
git commit -m "fix: address integration test issues for compare custom widgets"
```
