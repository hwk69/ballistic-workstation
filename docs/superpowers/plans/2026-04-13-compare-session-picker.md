# Compare Session Picker Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Compare view's overwhelming chip-wall session picker with a clean "Add Session" button and searchable dropdown.

**Architecture:** Remove the collapsible panel, filter chips, "Comparing by" dropdown, and hover tooltip. Replace with a selected-sessions strip + "+ Add" button that opens a searchable dropdown popover. Net reduction in state variables and code.

**Tech Stack:** React 19, Tailwind CSS v4

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/App.jsx` | All changes — remove old picker state/UI, add new dropdown state/UI, update save/load |

---

### Task 1: Remove Old State and Update Save/Load

**Files:**
- Modify: `src/App.jsx:1746-1757` (state declarations)
- Modify: `src/App.jsx:1776-1783` (filter auto-deselect useEffect)
- Modify: `src/App.jsx:1854` (CMP phase reset useEffect)
- Modify: `src/App.jsx:1879-1895` (loadComparison)
- Modify: `src/App.jsx:2983` (saveComparison call)

Remove obsolete state, add new state, and update save/load to stop using filters/by.

- [ ] **Step 1: Update cmpSlots initial value and remove old state**

Find these lines (around line 1746-1757):

```js
  const [cmpSlots, setCmpSlots] = useState([{ id: null, color: PALETTE[0] }, { id: null, color: PALETTE[1] }]);
  const [cmpDispOpts, setCmpDispOpts] = useState(DEF_DISP);
  const [cmpMetricsOpen, setCmpMetricsOpen] = useState(false);
  const [cmpPickerOpen, setCmpPickerOpen] = useState(true);
  const [savedComparisons, setSavedComparisons] = useState([]);
  const [cmpMetrics, setCmpMetrics] = useState(DEF_CMP_METRICS);
  const [cmpLayout, setCmpLayout] = useState(DEFAULT_CMP_LAYOUT);
  const [cmpSplit, setCmpSplit] = useState(DEFAULT_CMP_SPLIT);
  const [cmpTitle, setCmpTitle] = useState("");
  const [cmpBy, setCmpBy] = useState("");
  const [cmpFilters, setCmpFilters] = useState({});
  const [cmpHoverTip, setCmpHoverTip] = useState(null);
```

Replace with:

```js
  const [cmpSlots, setCmpSlots] = useState([]);
  const [cmpDispOpts, setCmpDispOpts] = useState(DEF_DISP);
  const [cmpMetricsOpen, setCmpMetricsOpen] = useState(false);
  const [cmpDropdownOpen, setCmpDropdownOpen] = useState(false);
  const [cmpSearch, setCmpSearch] = useState("");
  const [savedComparisons, setSavedComparisons] = useState([]);
  const [cmpMetrics, setCmpMetrics] = useState(DEF_CMP_METRICS);
  const [cmpLayout, setCmpLayout] = useState(DEFAULT_CMP_LAYOUT);
  const [cmpSplit, setCmpSplit] = useState(DEFAULT_CMP_SPLIT);
  const [cmpTitle, setCmpTitle] = useState("");
```

- [ ] **Step 2: Remove the filter auto-deselect useEffect**

Find and remove this entire block (around line 1776-1783):

```js
  // Auto-deselect sessions that no longer match active filters
  useEffect(() => {
    setCmpSlots(p => p.filter(sl => {
      const s = log.find(x => x.id === sl.id);
      if (!s) return false;
      return Object.entries(cmpFilters).every(([k, v]) => !v || s.config[k] === v);
    }));
  }, [cmpFilters]);
```

- [ ] **Step 3: Update CMP phase reset useEffect**

Find this line (around line 1854):

```js
  useEffect(() => { if (phase === P.CMP) { setCmpDispOpts(DEF_DISP); setCmpTitle(""); } }, [phase]);
```

Replace with:

```js
  useEffect(() => { if (phase === P.CMP) { setCmpDispOpts(DEF_DISP); setCmpTitle(""); setCmpDropdownOpen(false); setCmpSearch(""); } }, [phase]);
```

- [ ] **Step 4: Update loadComparison to remove filter/by references**

Find the `loadComparison` callback (around line 1879). Find these two lines inside it:

```js
    setCmpFilters(c.filters || {});
    setCmpBy(c.by || "");
```

Remove both lines.

- [ ] **Step 5: Update saveComparison call to stop passing filters/by**

Find this line (around line 2983):

```js
            <Btn v="secondary" onClick={() => saveComparison(cmpTitle, cmpSlots, cmpFilters, cmpBy, cmpMetrics, cmpLayout)}>
```

Replace with:

```js
            <Btn v="secondary" onClick={() => saveComparison(cmpTitle, cmpSlots, {}, "", cmpMetrics, cmpLayout)}>
```

- [ ] **Step 6: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds. The Compare page will look broken (picker UI removed but not yet replaced) — that's expected and will be fixed in Task 2.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "refactor: remove old Compare picker state (cmpBy, cmpFilters, cmpPickerOpen, cmpHoverTip)"
```

---

### Task 2: Replace Picker UI with Session Strip and Add Button

**Files:**
- Modify: `src/App.jsx` — the session picker section inside the CMP phase block (lines ~3017-3157)

Replace the entire collapsible panel (chips, filters, "Comparing by") with the new selected-sessions strip and "+ Add" button.

- [ ] **Step 1: Replace the session picker UI**

Find the session picker block. It starts with this comment and div (around line 3017):

```jsx
          {/* Session picker */}
          <div className="export-hide bg-secondary border-b border-border">
            <button
              onClick={() => setCmpPickerOpen(o => !o)}
```

And ends around line 3157 with:

```jsx
          </div>{/* end collapsible content */}
          </div>{/* end session picker */}
```

Replace the entire block (from `{/* Session picker */}` through `</div>{/* end session picker */}`) with:

```jsx
          {/* Session picker */}
          <div className="export-hide bg-secondary border-b border-border px-6 py-3">
            <div className="flex items-center gap-3 flex-wrap">
              {cmpSlots.map(sl => {
                const s = log.find(x => x.id === sl.id);
                if (!s) return null;
                return (
                  <div key={sl.id} className="inline-flex items-center gap-1.5 bg-card/60 border border-border rounded-md px-2 py-1">
                    <ColorPicker color={sl.color} onChange={c => setCmpSlots(p => p.map(x => x.id === sl.id ? { ...x, color: c } : x))} />
                    <span className="text-xs text-foreground truncate max-w-[120px]">{s.config.sessionName || "Session"}</span>
                    <button
                      onClick={() => setCmpSlots(p => p.filter(x => x.id !== sl.id))}
                      className="text-muted-foreground/50 hover:text-destructive cursor-pointer bg-transparent border-none transition-colors ml-0.5 p-0">
                      <X size={12} />
                    </button>
                  </div>
                );
              })}

              {/* Add button + dropdown */}
              <div className="relative">
                <button
                  onClick={() => { setCmpDropdownOpen(o => !o); setCmpSearch(""); }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-md border border-dashed border-border hover:border-foreground/30 cursor-pointer bg-transparent transition-colors">
                  + Add
                </button>

                {cmpDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-[340px] bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                    <div className="p-2 border-b border-border">
                      <input
                        autoFocus
                        value={cmpSearch}
                        onChange={e => setCmpSearch(e.target.value)}
                        onKeyDown={e => { if (e.key === "Escape") { setCmpDropdownOpen(false); setCmpSearch(""); } }}
                        placeholder="Search by name, date, or variable…"
                        className="w-full bg-secondary border border-border rounded-md px-2.5 py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/50"
                      />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      {(() => {
                        const selectedIds = new Set(cmpSlots.map(sl => sl.id));
                        const available = log.filter(s => !selectedIds.has(s.id));
                        const q = cmpSearch.toLowerCase().trim();
                        const filtered = q
                          ? available.filter(s => {
                              const name = (s.config.sessionName || "").toLowerCase();
                              const date = new Date(s.date).toLocaleDateString();
                              const varVals = vars.map(v => s.config[v.key] || "").join(" ").toLowerCase();
                              return name.includes(q) || date.toLowerCase().includes(q) || varVals.includes(q);
                            })
                          : available;
                        const sorted = [...filtered].sort((a, b) => new Date(b.date) - new Date(a.date));
                        if (sorted.length === 0) return (
                          <div className="px-3 py-6 text-center text-xs text-muted-foreground">No sessions found</div>
                        );
                        return sorted.map(s => (
                          <button
                            key={s.id}
                            onClick={() => {
                              setCmpSlots(p => [...p, { id: s.id, color: PALETTE[p.length % PALETTE.length] }]);
                              setCmpDropdownOpen(false);
                              setCmpSearch("");
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-secondary/80 cursor-pointer bg-transparent border-none transition-colors border-b border-border last:border-b-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-foreground truncate mr-2">{s.config.sessionName || "Session"}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">{new Date(s.date).toLocaleDateString()}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">
                              {vars.map(v => s.config[v.key]).filter(Boolean).join(" · ")}
                            </div>
                          </button>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {cmpSlots.length === 0 && (
                <span className="text-xs text-muted-foreground">Add sessions to compare</span>
              )}

              {cmpSlots.length >= 2 && (
                <button onClick={() => setCmpSlots([])}
                  className="text-xs text-muted-foreground hover:text-destructive cursor-pointer bg-transparent border-none transition-colors ml-auto">
                  Clear all
                </button>
              )}
            </div>
          </div>{/* end session picker */}
```

- [ ] **Step 2: Remove the hover tooltip render block**

Find the hover tooltip block (around line 3206). It starts with:

```jsx
        {cmpHoverTip && (() => {
```

And ends with:

```jsx
            </div>
          );
        })()}
```

Remove the entire block (from `{cmpHoverTip && (() => {` through the matching `})()}`).

- [ ] **Step 3: Add click-outside handler for the dropdown**

Find the CMP phase block's return statement. It starts around line 2964:

```jsx
    return (
      <AppShell phase={phase} navItems={navItems}
```

Insert this `useEffect` just before that `return` statement:

```jsx
    // Close dropdown on outside click
    const dropdownRef = useRef();
    useEffect(() => {
      if (!cmpDropdownOpen) return;
      const handler = (e) => {
        if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
          setCmpDropdownOpen(false);
          setCmpSearch("");
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [cmpDropdownOpen]);

```

Then update the `<div className="relative">` wrapper around the Add button to use this ref. Find:

```jsx
              <div className="relative">
                <button
                  onClick={() => { setCmpDropdownOpen(o => !o); setCmpSearch(""); }}
```

Replace with:

```jsx
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => { setCmpDropdownOpen(o => !o); setCmpSearch(""); }}
```

- [ ] **Step 4: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: replace Compare session picker with searchable Add Session dropdown"
```

---

### Task 3: Update Nav onClick and Test

**Files:**
- Modify: `src/App.jsx` — the navItems Compare entry (around line 2129)

The Compare nav item currently resets `cmpSlots` to `[]` which is already the right behavior for the new design. Verify it still works and do a final build check.

- [ ] **Step 1: Verify the nav item onClick**

Find the Compare nav item (around line 2129):

```js
    { label: "Compare", ph: P.CMP,     disabled: log.length < 2, onClick: () => { setCmpSlots([]); setPhase(P.CMP); } },
```

This already resets `cmpSlots` to `[]`, which is correct. **No change needed.**

- [ ] **Step 2: Final build check**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Manual integration test**

Start the dev server: `npm run dev`

1. Navigate to the **Compare** tab.
2. Verify you see an empty strip with just the "+ Add" button and "Add sessions to compare" helper text.
3. Click "+ Add" — verify the dropdown opens with a search input (auto-focused) and a scrollable list of all sessions sorted newest-first.
4. Verify each session row shows the name (bold), date (right), and variable values (small text below).
5. Type a session name fragment — verify the list filters.
6. Type a variable value (e.g., "steel") — verify sessions with that variable value appear.
7. Type a date fragment (e.g., "4/13") — verify matching sessions appear.
8. Clear the search — verify the full list returns.
9. Click a session — verify it's added to the strip with a color dot, color picker, and ✕ button. Dropdown closes.
10. Click "+ Add" again — verify the just-added session is NOT in the dropdown list.
11. Add a second session — verify "Clear all" link appears. Comparison widgets render below.
12. Click ✕ on a session — verify it's removed from the strip and comparison.
13. Click "Clear all" — verify all sessions removed, back to empty state.
14. Load a saved comparison — verify sessions populate the strip correctly.
15. Click outside the dropdown while it's open — verify it closes.
16. Press Escape while the search input is focused — verify the dropdown closes.

- [ ] **Step 4: Commit any fixes**

If any issues were found during testing:
```bash
git add src/App.jsx
git commit -m "fix: address Compare session picker integration test issues"
```
