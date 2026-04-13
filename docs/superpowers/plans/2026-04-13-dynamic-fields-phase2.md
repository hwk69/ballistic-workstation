# Dynamic Measurement Fields — Phase 2: Dynamic Fire Page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Fire page render its shot entry form dynamically from the session's `fields` array, store measurement values in the `data` JSONB property, and adapt live charts/stats based on which fields are present.

**Architecture:** Replace the hardcoded `cur` state (fps/x/y/weight) with a dynamic object built from `fields`. Replace the hardcoded shot entry grid with a dynamic renderer that maps field types to input controls. Update `addShot` to build the `data` object. Update `validShots` to validate based on required fields. Adapt live charts section to conditionally show dispersion/stats based on field presence. Update the shot log table to show dynamic columns.

**Tech Stack:** React 19, Tailwind CSS v4

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `src/App.jsx` | Main app — Fire phase UI, shot state, validation | Modify: dynamic cur state, dynamic form, dynamic addShot, dynamic validShots, dynamic live charts, dynamic shot log |

---

### Task 1: Dynamic `cur` State and `addShot`

**Files:**
- Modify: `src/App.jsx`

This task changes the shot entry state from hardcoded `{ fps, x, y, weight }` to a dynamic object built from `fields`, and updates `addShot` to produce shots with a `data` property.

- [ ] **Step 1: Change `cur` state initialization**

Find line 1260:
```js
  const [cur, setCur]       = useState({ fps: "", x: "", y: "", weight: "" });
```

Change to:
```js
  const [cur, setCur]       = useState(() => Object.fromEntries(fields.map(f => [f.key, ""])));
```

- [ ] **Step 2: Update `newSession` to reset `cur` dynamically**

Find the `newSession` function (around line 1497):
```js
  const newSession = () => { setPhase(P.SETUP); setShots([]); setCur({ fps: "", x: "", y: "", weight: "" }); setCfg(p => ({ ...p, sessionName: "", notes: "", date: new Date().toISOString().split("T")[0] })); };
```

Change to:
```js
  const newSession = () => { setPhase(P.SETUP); setShots([]); setCur(Object.fromEntries(fields.map(f => [f.key, ""]))); setCfg(p => ({ ...p, sessionName: "", notes: "", date: new Date().toISOString().split("T")[0] })); };
```

- [ ] **Step 3: Update `continueSession` to reset `cur` dynamically**

Find the `continueSession` function (around line 1537). It has:
```js
    setCur({ fps: "", x: "", y: "", weight: s.shots[0]?.weight || "" });
```

Change to:
```js
    const sessionFields = s.config.fields || fields;
    setCur(Object.fromEntries(sessionFields.map(f => [f.key, ""])));
```

- [ ] **Step 4: Replace `addShot` with dynamic version**

Find the `addShot` function (around line 1469):
```js
  const addShot = useCallback(() => { const fps = parseFloat(cur.fps), x = parseFloat(cur.x), y = parseFloat(cur.y); if (isNaN(fps) || isNaN(x) || isNaN(y)) return; setShots(p => [...p, { fps, x, y, weight: cur.weight, serial: makeSerial(cfg, p.length + 1, existingCount), shotNum: p.length + 1, timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]); setCur(p => ({ fps: "", x: "", y: "", weight: p.weight })); setTimeout(() => fpsRef.current?.focus(), 50); }, [cur, shots, cfg, existingCount]);
```

Replace with:
```js
  const addShot = useCallback(() => {
    // Validate required fields
    const sessionFields = cfg.fields || fields;
    for (const f of sessionFields) {
      if (f.required) {
        if (f.type === "number" && isNaN(parseFloat(cur[f.key]))) return;
        if (f.type !== "number" && !cur[f.key] && cur[f.key] !== false) return;
      }
    }
    // Build data object
    const data = {};
    for (const f of sessionFields) {
      const v = cur[f.key];
      if (f.type === "number") {
        data[f.key] = v !== "" ? parseFloat(v) : null;
      } else if (f.type === "yesno") {
        data[f.key] = v === "yes" ? true : v === "no" ? false : null;
      } else {
        data[f.key] = v || null;
      }
    }
    // Build shot with legacy fields for backwards compat
    const shot = {
      fps: data.fps ?? null,
      x: data.x ?? null,
      y: data.y ?? null,
      weight: data.weight ?? cur.weight ?? null,
      data,
      serial: makeSerial(cfg, shots.length + 1, existingCount),
      shotNum: shots.length + 1,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setShots(p => [...p, shot]);
    // Clear fields — keep number field values for repeat entry
    setCur(prev => {
      const next = {};
      for (const f of sessionFields) {
        next[f.key] = f.type === "number" ? prev[f.key] : "";
      }
      return next;
    });
    setTimeout(() => fpsRef.current?.focus(), 50);
  }, [cur, shots, cfg, existingCount, fields]);
```

- [ ] **Step 5: Update `validShots` to use dynamic validation**

Find (around line 1454):
```js
  const validShots = useMemo(() => shots.filter(s => !isNaN(s.fps) && !isNaN(s.x) && !isNaN(s.y)), [shots]);
```

Change to:
```js
  const validShots = useMemo(() => {
    const sessionFields = cfg.fields || fields;
    const requiredNumeric = sessionFields.filter(f => f.required && f.type === "number").map(f => f.key);
    if (requiredNumeric.length === 0) return shots;
    return shots.filter(s => {
      const d = s.data || s;
      return requiredNumeric.every(k => d[k] !== null && d[k] !== undefined && !isNaN(d[k]));
    });
  }, [shots, cfg.fields, fields]);
```

- [ ] **Step 6: Verify build passes**

Run: `npm run build`

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat: dynamic cur state, addShot, and validShots for measurement fields"
```

---

### Task 2: Dynamic Shot Entry Form

**Files:**
- Modify: `src/App.jsx`

Replace the hardcoded 4-field shot entry grid with a dynamic renderer.

- [ ] **Step 1: Replace the shot entry grid**

In the FIRE phase JSX, find the hardcoded shot entry grid (around line 1699):
```jsx
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[["FPS *", "fps", "188"], ["X (in) *", "x", "−2"], ["Y (in) *", "y", "−8"], ["Weight (g)", "weight", "117.5"]].map(([lb, k, ph], i) => (
            <div key={k} className="flex flex-col">
              <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{lb}</label>
              <input ref={i === 0 ? fpsRef : null} type="number" step={k === "weight" ? "0.01" : "0.5"} value={cur[k]} onChange={e => setCur(p => ({ ...p, [k]: e.target.value }))} placeholder={ph} className={inp} autoFocus={i === 0} />
            </div>
          ))}
        </div>
```

Replace with:
```jsx
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {(cfg.fields || fields).map((f, i) => (
            <div key={f.key} className="flex flex-col">
              <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {f.label}{f.unit ? ` (${f.unit})` : ""}{f.required ? " *" : ""}
              </label>
              {f.type === "number" && (
                <input ref={i === 0 ? fpsRef : null} type="number" inputMode="decimal" step="any"
                  value={cur[f.key] ?? ""} onChange={e => setCur(p => ({ ...p, [f.key]: e.target.value }))}
                  className={inp} autoFocus={i === 0} />
              )}
              {f.type === "yesno" && (
                <select value={cur[f.key] ?? ""} onChange={e => setCur(p => ({ ...p, [f.key]: e.target.value }))}
                  className={inp}>
                  <option value="">—</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              )}
              {f.type === "text" && (
                <input ref={i === 0 ? fpsRef : null} type="text"
                  value={cur[f.key] ?? ""} onChange={e => setCur(p => ({ ...p, [f.key]: e.target.value }))}
                  className={inp} autoFocus={i === 0} />
              )}
              {f.type === "dropdown" && (
                <select value={cur[f.key] ?? ""} onChange={e => setCur(p => ({ ...p, [f.key]: e.target.value }))}
                  className={inp}>
                  <option value="">—</option>
                  {(f.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
```

- [ ] **Step 2: Update the Record button disabled logic**

Find (around line 1708):
```jsx
          <Btn onClick={addShot} disabled={!cur.fps || cur.x === "" || cur.y === "" || shots.length >= total}>Record</Btn>
```

Replace with:
```jsx
          <Btn onClick={addShot} disabled={shots.length >= total || (cfg.fields || fields).some(f => f.required && (cur[f.key] === "" || cur[f.key] === undefined || cur[f.key] === null))}>Record</Btn>
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: dynamic shot entry form renders from fields array"
```

---

### Task 3: Adaptive Live Charts and Running Stats

**Files:**
- Modify: `src/App.jsx`

The live charts section currently always shows DispersionChart and hardcoded stats. Make it conditional on which fields are present.

- [ ] **Step 1: Replace the live charts section**

Find the live charts section in FIRE phase (around line 1714-1727):
```jsx
      {/* Live charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <CardSection title="Live Dispersion">
          {validShots.length
            ? <AutoSizeChart render={(w, h) => <DispersionChart shots={validShots} stats={stats} size={Math.min(w, h) - 12} />} />
            : <Empty icon={<Crosshair size={18} />}>Record a shot to see the dispersion chart</Empty>}
        </CardSection>
        <CardSection title="Running Stats">
          {validShots.length >= 2
            ? <div className="grid grid-cols-2 gap-2">
                {[["CEP", stats.cep.toFixed(2), 0, OC.cep], ["R90", stats.r90.toFixed(2), 0, OC.r90], ["SD X", stats.sdX.toFixed(2)], ["SD Y", stats.sdY.toFixed(2)], ["Mean FPS", stats.meanV.toFixed(1), 1], ["SD FPS", stats.sdV.toFixed(1)], ["ES FPS", stats.esV.toFixed(1)], ["MPI", `${stats.mpiX.toFixed(1)}, ${stats.mpiY.toFixed(1)}`, 0, OC.mpi]].map(([k, v, g, ac]) => <SB key={k} label={k} value={v} gold={g} accentColor={ac} />)}
              </div>
            : <Empty icon={<BarChart2 size={18} />}>Need 2 or more shots for statistics</Empty>}
        </CardSection>
```

Replace with:
```jsx
      {/* Live charts */}
      {(() => {
        const sf = cfg.fields || fields;
        const hasX = sf.some(f => f.key === "x");
        const hasY = sf.some(f => f.key === "y");
        const hasXY = hasX && hasY;
        const hasFps = sf.some(f => f.key === "fps");
        const numericFields = sf.filter(f => f.type === "number" && !["x", "y"].includes(f.key));
        return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {hasXY && (
        <CardSection title="Live Dispersion">
          {validShots.length
            ? <AutoSizeChart render={(w, h) => <DispersionChart shots={validShots} stats={stats} size={Math.min(w, h) - 12} />} />
            : <Empty icon={<Crosshair size={18} />}>Record a shot to see the dispersion chart</Empty>}
        </CardSection>
        )}
        <CardSection title="Running Stats">
          {validShots.length >= 2
            ? <div className="grid grid-cols-2 gap-2">
                {hasXY && <>
                  <SB label="CEP" value={stats.cep.toFixed(2)} accentColor={OC.cep} />
                  <SB label="R90" value={stats.r90.toFixed(2)} accentColor={OC.r90} />
                  <SB label="SD X" value={stats.sdX.toFixed(2)} />
                  <SB label="SD Y" value={stats.sdY.toFixed(2)} />
                  <SB label="MPI" value={`${stats.mpiX.toFixed(1)}, ${stats.mpiY.toFixed(1)}`} accentColor={OC.mpi} />
                </>}
                {hasFps && <>
                  <SB label="Mean FPS" value={stats.meanV.toFixed(1)} gold={1} />
                  <SB label="SD FPS" value={stats.sdV.toFixed(1)} />
                  <SB label="ES FPS" value={stats.esV.toFixed(1)} />
                </>}
                {numericFields.filter(f => f.key !== "fps").map(f => {
                  const vals = validShots.map(s => (s.data || s)[f.key]).filter(v => v !== null && v !== undefined && !isNaN(v));
                  if (vals.length < 2) return null;
                  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
                  const sd = Math.sqrt(vals.reduce((a, v) => a + (v - m) ** 2, 0) / (vals.length - 1));
                  const es = Math.max(...vals) - Math.min(...vals);
                  return <SB key={f.key} label={`Mean ${f.label}`} value={`${m.toFixed(1)}${f.unit ? " " + f.unit : ""}`} />;
                })}
                {sf.filter(f => f.type === "yesno").map(f => {
                  const vals = validShots.map(s => (s.data || s)[f.key]).filter(v => v !== null && v !== undefined);
                  const yesCount = vals.filter(v => v === true).length;
                  return <SB key={f.key} label={f.label} value={`${yesCount}/${vals.length} (${vals.length ? Math.round(yesCount / vals.length * 100) : 0}%)`} />;
                })}
              </div>
            : <Empty icon={<BarChart2 size={18} />}>Need 2 or more shots for statistics</Empty>}
        </CardSection>
```

Note: Keep the closing tags that follow (the shot log section and the rest) unchanged. The `{(() => {` IIFE opens before the grid div and the `return (` wraps the grid. You need to close it after the Running Stats CardSection:

After the `</CardSection>` for Running Stats, add the closing for the IIFE (before the shot log section):
```jsx
      );
      })()}
```

But wait — the shot log is also inside the same grid div. So the IIFE should wrap the entire grid div including the shot log. Let me restructure:

The IIFE should wrap from `{/* Live charts */}` through the closing `</div>` of the grid (which also contains the shot log). The shot log is the third child in the grid. So:

Replace the entire block from `{/* Live charts */}` (line 1714) through the closing `</div>` of the grid just before `</AppShell>` (line 1793) with:

```jsx
      {/* Live charts & shot log */}
      {(() => {
        const sf = cfg.fields || fields;
        const hasX = sf.some(f => f.key === "x");
        const hasY = sf.some(f => f.key === "y");
        const hasXY = hasX && hasY;
        const hasFps = sf.some(f => f.key === "fps");
        return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {hasXY && (
        <CardSection title="Live Dispersion">
          {validShots.length
            ? <AutoSizeChart render={(w, h) => <DispersionChart shots={validShots} stats={stats} size={Math.min(w, h) - 12} />} />
            : <Empty icon={<Crosshair size={18} />}>Record a shot to see the dispersion chart</Empty>}
        </CardSection>
        )}
        <CardSection title="Running Stats">
          {validShots.length >= 2
            ? <div className="grid grid-cols-2 gap-2">
                {hasXY && <>
                  <SB label="CEP" value={stats.cep.toFixed(2)} accentColor={OC.cep} />
                  <SB label="R90" value={stats.r90.toFixed(2)} accentColor={OC.r90} />
                  <SB label="SD X" value={stats.sdX.toFixed(2)} />
                  <SB label="SD Y" value={stats.sdY.toFixed(2)} />
                  <SB label="MPI" value={`${stats.mpiX.toFixed(1)}, ${stats.mpiY.toFixed(1)}`} accentColor={OC.mpi} />
                </>}
                {hasFps && <>
                  <SB label="Mean FPS" value={stats.meanV.toFixed(1)} gold={1} />
                  <SB label="SD FPS" value={stats.sdV.toFixed(1)} />
                  <SB label="ES FPS" value={stats.esV.toFixed(1)} />
                </>}
                {sf.filter(f => f.type === "number" && !["x", "y", "fps"].includes(f.key)).map(f => {
                  const vals = validShots.map(s => (s.data || s)[f.key]).filter(v => v !== null && v !== undefined && !isNaN(v));
                  if (vals.length < 2) return null;
                  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
                  return <SB key={f.key} label={`Mean ${f.label}`} value={`${m.toFixed(1)}${f.unit ? " " + f.unit : ""}`} />;
                })}
                {sf.filter(f => f.type === "yesno").map(f => {
                  const vals = validShots.map(s => (s.data || s)[f.key]).filter(v => v !== null && v !== undefined);
                  const yesCount = vals.filter(v => v === true).length;
                  return <SB key={f.key} label={f.label} value={`${yesCount}/${vals.length} (${vals.length ? Math.round(yesCount / vals.length * 100) : 0}%)`} />;
                })}
              </div>
            : <Empty icon={<BarChart2 size={18} />}>Need 2 or more shots for statistics</Empty>}
        </CardSection>

        {/* Shot log */}
        <div className="bg-card border border-border rounded-xl p-6 lg:col-span-2">
          <SecLabel>Shot Log</SecLabel>
          {shots.length
            ? <div className="overflow-auto max-h-52 mt-3">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2 py-1.5 text-left">#</th>
                      <th className="text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2 py-1.5 text-left">Serial</th>
                      {sf.map(f => (
                        <th key={f.key} className={cn(
                          "text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2 py-1.5",
                          f.type === "number" ? "text-right" : "text-left"
                        )}>{f.label}</th>
                      ))}
                      <th className="text-muted-foreground font-semibold uppercase text-[10px] tracking-wide px-2 py-1.5 text-left">Time</th>
                      <th className="px-2 py-1.5" />
                      <th className="px-2 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {shots.map((s, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="text-muted-foreground px-2 py-1.5">{s.shotNum}</td>
                        <td className="text-muted-foreground px-2 py-1.5 font-mono text-[11px]">{s.serial}</td>
                        {sf.map(f => {
                          const val = (s.data || s)[f.key];
                          let display = "";
                          if (val === true) display = "Yes";
                          else if (val === false) display = "No";
                          else if (val !== null && val !== undefined) display = String(val);
                          return (
                            <td key={f.key} className={cn(
                              "px-2 py-1.5",
                              f.type === "number" ? "text-foreground text-right font-mono" : "text-foreground"
                            )}>{display}</td>
                          );
                        })}
                        <td className="text-muted-foreground px-2 py-1.5">{s.timestamp}</td>
                        <td className="px-2 py-1.5">
                          <ShotAttachBtn
                            serial={s.serial}
                            pendingCount={(pendingAttachments[s.serial] || []).length}
                            onQueue={queueAttachment}
                            onError={setDbError} />
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          <button onClick={() => delShot(i)} className="text-destructive text-xs bg-transparent border-none cursor-pointer">Del</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            : <Empty>No shots recorded yet</Empty>}
        </div>
      </div>
        );
      })()}
```

Note: The inline edit functionality in the shot log is removed in this version because it was hardcoded to fps/x/y fields. Inline editing of dynamic fields is not in scope for this phase — the Edit Session page (P.EDIT) handles corrections. The `startEdit`/`saveEdit`/`editIdx`/`editVal` state remains in the codebase for the EDIT phase but is no longer used in the FIRE shot log.

- [ ] **Step 2: Verify build passes**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: adaptive live charts, running stats, and dynamic shot log for Fire phase"
```

---

### Task 4: Update Edit Session Phase for Dynamic Fields

**Files:**
- Modify: `src/App.jsx`

The EDIT phase (P.EDIT) also has hardcoded shot entry and editing. Update it to work with dynamic fields.

- [ ] **Step 1: Update `openEditSession` to init dynamic cur**

Find `openEditSession` (around line 1520):
```js
  const openEditSession = id => { const s = log.find(x => x.id === id); if (!s) return; setEditSessionId(id); setEsCfg({ ...s.config }); setEsShots(s.shots.map(sh => ({ ...sh }))); setEsNewShot({ fps: "", x: "", y: "", weight: s.shots[0]?.weight || "" }); setEsShotEdit(null); setPhase(P.EDIT); };
```

Change to:
```js
  const openEditSession = id => { const s = log.find(x => x.id === id); if (!s) return; setEditSessionId(id); setEsCfg({ ...s.config }); setEsShots(s.shots.map(sh => ({ ...sh }))); const sf = s.config.fields || fields; setEsNewShot(Object.fromEntries(sf.map(f => [f.key, ""]))); setEsShotEdit(null); setPhase(P.EDIT); };
```

- [ ] **Step 2: Update `esAddShot` for dynamic fields**

Find `esAddShot` (around line 1533):
```js
  const esAddShot = () => { const fps = parseFloat(esNewShot.fps), x = parseFloat(esNewShot.x), y = parseFloat(esNewShot.y); if (isNaN(fps) || isNaN(x) || isNaN(y)) return; setEsShots(p => [...p, { fps, x, y, weight: esNewShot.weight, serial: makeSerial(esCfg, p.length + 1, 0), shotNum: p.length + 1, timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]); setEsNewShot(p => ({ fps: "", x: "", y: "", weight: p.weight })); };
```

Change to:
```js
  const esAddShot = () => {
    const sf = esCfg.fields || fields;
    for (const f of sf) {
      if (f.required) {
        if (f.type === "number" && isNaN(parseFloat(esNewShot[f.key]))) return;
        if (f.type !== "number" && !esNewShot[f.key] && esNewShot[f.key] !== false) return;
      }
    }
    const data = {};
    for (const f of sf) {
      const v = esNewShot[f.key];
      if (f.type === "number") data[f.key] = v !== "" ? parseFloat(v) : null;
      else if (f.type === "yesno") data[f.key] = v === "yes" ? true : v === "no" ? false : null;
      else data[f.key] = v || null;
    }
    setEsShots(p => [...p, {
      fps: data.fps ?? null, x: data.x ?? null, y: data.y ?? null, weight: data.weight ?? null,
      data,
      serial: makeSerial(esCfg, p.length + 1, 0),
      shotNum: p.length + 1,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }]);
    setEsNewShot(prev => {
      const next = {};
      for (const f of sf) { next[f.key] = f.type === "number" ? prev[f.key] : ""; }
      return next;
    });
  };
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: update Edit Session phase for dynamic measurement fields"
```
