# Unified Fire Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the Fire page and Edit page into a single unified Fire page with inline shot editing, collapsible config editor, and auto-save.

**Architecture:** Enhance the existing Fire phase in `src/App.jsx` to support two modes (new session / edit existing). Add a debounced auto-save `useEffect` that persists changes when `continuingSessionId` is set. Remove the `P.EDIT` phase and all its associated state/UI code entirely. The `continueSession` function (used by both `+ Shots` and `Edit`) loads the session into Fire mode without deleting it.

**Tech Stack:** React 19, Vite 8, Tailwind CSS v4, Supabase (via `src/lib/db.js`)

---

### Task 1: Add inline edit/delete to Fire page shot log

The Fire page shot log table (lines 2400-2455 in `src/App.jsx`) currently only has a Delete button. Add Edit button + inline editing, reusing the pattern from the Edit page.

**Files:**
- Modify: `src/App.jsx` — Fire page shot log table (~lines 2400-2455), `startEdit`/`saveEdit` functions (~line 2020-2021)

- [ ] **Step 1: Update `saveEdit` to be field-aware**

The existing `saveEdit` (line 2021) hardcodes fps/x/y validation. Replace it with field-aware logic matching `esSaveEdit`:

```js
const saveEdit = () => {
  if (editIdx === null) return;
  const sf = cfg.fields || fields;
  const parsed = {};
  for (const f of sf) {
    const raw = editVal[f.key];
    if (f.type === "number") {
      const n = parseFloat(raw);
      if (f.required && isNaN(n)) return;
      parsed[f.key] = isNaN(n) ? null : n;
    } else if (f.type === "yesno") {
      parsed[f.key] = raw === "yes" || raw === true ? true : raw === "no" || raw === false ? false : null;
    } else {
      if (f.required && !raw && raw !== false) return;
      parsed[f.key] = raw || null;
    }
  }
  const data = { ...((shots[editIdx] || {}).data || {}), ...parsed };
  setShots(p => p.map((s, i) => i === editIdx ? {
    ...s, ...parsed,
    fps: parsed.fps ?? s.fps, x: parsed.x ?? s.x, y: parsed.y ?? s.y, weight: parsed.weight ?? s.weight,
    data,
  } : s));
  setEditIdx(null);
};
```

Find and replace the existing one-line `saveEdit` (starts with `const saveEdit = () => { if (editIdx === null) return; const fps = parseFloat`).

- [ ] **Step 2: Add Edit button and inline edit mode to Fire page shot log rows**

In the Fire page shot log `<tbody>` (lines ~2421-2450), replace the simple row with a conditional that shows edit inputs when `editIdx === i`:

```jsx
{shots.map((s, i) => (
  <tr key={s.id || s.serial || `new-${i}`} className="border-b border-border">
    {editIdx === i ? (
      <>
        <td className="text-muted-foreground px-2 py-1.5">{s.shotNum}</td>
        <td className="text-muted-foreground px-2 py-1.5 font-mono text-[11px]">{s.serial}</td>
        {sf.map(f => (
          <td key={f.key} className="px-1.5 py-1">
            <TblInput value={editVal[f.key] ?? ""} onChange={e => setEditVal(p => ({ ...p, [f.key]: e.target.value }))} />
          </td>
        ))}
        <td className="text-muted-foreground px-2 py-1.5">{s.timestamp}</td>
        <td className="px-2 py-1.5">
          <ShotAttachBtn
            shotId={s.id}
            sessionId={continuingSessionId}
            serial={s.serial}
            pendingCount={(pendingAttachments[s.serial] || []).length}
            onQueue={queueAttachment}
            onError={setDbError} />
        </td>
        <td className="px-2 py-1 text-right whitespace-nowrap">
          <button onClick={saveEdit} className="text-primary text-xs font-semibold bg-transparent border-none cursor-pointer mr-2">Save</button>
          <button onClick={() => setEditIdx(null)} className="text-muted-foreground text-xs bg-transparent border-none cursor-pointer">✕</button>
        </td>
      </>
    ) : (
      <>
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
            shotId={s.id}
            sessionId={continuingSessionId}
            serial={s.serial}
            pendingCount={(pendingAttachments[s.serial] || []).length}
            onQueue={queueAttachment}
            onError={setDbError} />
        </td>
        <td className="px-2 py-1.5 text-right whitespace-nowrap">
          <button onClick={() => startEdit(i)} className="text-muted-foreground text-xs bg-transparent border-none cursor-pointer mr-2">Edit</button>
          <button onClick={() => delShot(i)} className="text-destructive text-xs bg-transparent border-none cursor-pointer">Del</button>
        </td>
      </>
    )}
  </tr>
))}
```

Note: `ShotAttachBtn` now passes `shotId={s.id}` and `sessionId={continuingSessionId}` so attachments work for saved shots. For new unsaved shots, `s.id` will be undefined and it falls back to the pending queue.

- [ ] **Step 3: Add the Edit column header**

The shot log `<thead>` (lines ~2406-2418) needs an extra empty header cell for the Edit button column. Update the header row to include headers for `#`, `Serial`, each field, `Time`, attachments (empty `<th>`), and actions (empty `<th>`). The existing code already has the empty `<th>` columns but verify the count matches the new row structure.

- [ ] **Step 4: Build and verify**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add inline shot editing to Fire page shot log"
```

---

### Task 2: Add collapsible config editor to Fire page

Add a collapsible "Session Config" section to the Fire page between the session header and the shot entry form.

**Files:**
- Modify: `src/App.jsx` — Fire page JSX (~lines 2283-2350), add state for collapse toggle

- [ ] **Step 1: Add config collapse state**

Near the other state declarations (line ~1741), add:

```js
const [configOpen, setConfigOpen] = useState(false);
```

- [ ] **Step 2: Add collapsible config section to Fire page**

Insert after the session header `<div>` (after line ~2304, before the shot entry `<div>`), add this collapsible config section:

```jsx
{/* Collapsible config editor */}
<div className="bg-card border border-border rounded-xl mb-5 overflow-hidden">
  <button
    onClick={() => setConfigOpen(p => !p)}
    className="w-full flex items-center justify-between px-5 py-3 bg-transparent border-none cursor-pointer text-left">
    <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Session Config</span>
    <ChevronDown size={14} className={cn("text-muted-foreground transition-transform", configOpen && "rotate-180")} />
  </button>
  {configOpen && (
    <div className="px-5 pb-5 border-t border-border">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
        {vars.map(vr => (
          <SmartSelect key={vr.key} label={vr.label} value={cfg[vr.key] || ""} onChange={v => up(vr.key, v)} options={opts[vr.key] || []} onAddOption={v => addOption(vr.key, v)} />
        ))}
        {[["Session Name","sessionName","text"],["Date","date","date"],["Notes","notes","text"]].map(([lb,k,t]) => (
          <div key={k} className="flex flex-col">
            <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{lb}</label>
            <input type={t} value={cfg[k] || ""} onChange={e => up(k, e.target.value)} className={inp} />
          </div>
        ))}
        <div className="flex flex-col">
          <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Shot Count</label>
          <input type="number" min="1" value={cfg.shotCount || ""} onChange={e => up("shotCount", e.target.value)} className={inp} />
        </div>
      </div>
    </div>
  )}
</div>
```

Note: Verify that `ChevronDown` is imported from lucide-react at the top of the file. If not, add it to the existing import.

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add collapsible config editor to Fire page"
```

---

### Task 3: Add auto-save mechanism

Add a debounced `useEffect` that auto-saves the session to the DB whenever `shots` or `cfg` change, but only when `continuingSessionId` is set.

**Files:**
- Modify: `src/App.jsx` — add auto-save useEffect, add save status state, update `addShot` for first-shot save

- [ ] **Step 1: Add save status state**

Near the other state declarations (around line 1742 near `saving`), add:

```js
const [saveStatus, setSaveStatus] = useState("saved"); // "saved" | "saving" | "unsaved"
```

- [ ] **Step 2: Add debounced auto-save useEffect**

After the existing `useEffect` blocks (after `loadAllData` and its useEffect), add:

```js
// Auto-save: debounce writes to DB when session exists
useEffect(() => {
  if (!continuingSessionId) return;
  setSaveStatus("unsaved");
  const timer = setTimeout(async () => {
    setSaveStatus("saving");
    try {
      const name = cfg.sessionName || vars.map(v => cfg[v.key]).filter(Boolean).join(" | ");
      const saved = await db.updateSession(continuingSessionId, {
        config: { ...cfg, sessionName: name, fields: cfg.fields || fields },
        shots: [...shots],
      });
      const entry = { ...saved, stats: calcStats(saved.shots, saved.config.fields || fields) };
      setLog(p => p.map(s => s.id === continuingSessionId ? entry : s));
      setSaveStatus("saved");
    } catch (err) {
      setDbError("Auto-save failed: " + err.message);
      setSaveStatus("unsaved");
    }
  }, 800);
  return () => clearTimeout(timer);
}, [continuingSessionId, shots, cfg, vars, fields]);
```

- [ ] **Step 3: Update `addShot` to save session on first shot**

The existing `addShot` function (line ~1976) just pushes to the local `shots` array. When `continuingSessionId` is null and this is the first shot, we need to save the session to the DB first. Wrap the end of `addShot` (after `setShots(p => [...p, shot])`) with logic to create the session on the first shot:

After the existing `setShots(p => [...p, shot]);` line in `addShot`, add:

```js
// On first shot of a new session, save to DB so auto-save can take over
if (!continuingSessionId && shots.length === 0) {
  (async () => {
    try {
      const name = cfg.sessionName || vars.map(v => cfg[v.key]).filter(Boolean).join(" | ");
      const saved = await db.saveSession({ config: { ...cfg, sessionName: name, fields }, shots: [shot] });
      // Upload any pending attachments
      const pending = Object.entries(pendingAttachments);
      if (pending.length > 0) {
        await Promise.allSettled(
          pending.flatMap(([serial, files]) => {
            const sh = saved.shots.find(s => s.serial === serial);
            return files.map(file => db.uploadAttachment(file, sh?.id ?? null, saved.id));
          })
        );
        setPendingAttachments({});
      }
      setContinuingSessionId(saved.id);
      setShots(saved.shots.map(sh => ({ ...sh })));
      const entry = { ...saved, stats: calcStats(saved.shots, saved.config.fields || fields) };
      setLog(p => [entry, ...p]);
      setViewId(saved.id);
      setSaveStatus("saved");
    } catch (err) {
      setDbError("Failed to save session: " + err.message);
    }
  })();
}
```

Note: `continuingSessionId` and `shots` are captured by closure at call time. `shots.length === 0` means this is the first shot being added.

- [ ] **Step 4: Add save indicator to Fire page session header**

In the Fire page session header row (lines ~2286-2303), add a save status indicator next to the shot count:

```jsx
<div className="text-right shrink-0">
  <div className="text-[26px] font-bold leading-none tracking-tight">
    <span className="text-primary">{shots.length}</span>
    <span className="text-lg font-normal text-muted-foreground"> / {total}</span>
  </div>
  <div className="text-muted-foreground text-[11px] mt-1.5 font-mono">
    Next: {makeSerial(cfg, shots.length + 1, existingCount)}
  </div>
  {continuingSessionId && (
    <div className={cn("text-[10px] mt-1", saveStatus === "saving" ? "text-yellow-500" : saveStatus === "saved" ? "text-emerald-500" : "text-muted-foreground")}>
      {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "Unsaved"}
    </div>
  )}
</div>
```

- [ ] **Step 5: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add auto-save with debounce and save status indicator"
```

---

### Task 4: Update `finishSession` and action buttons

Replace "Finish Session" with "View Results" and remove Abort. Update `finishSession` to just navigate (data is already auto-saved).

**Files:**
- Modify: `src/App.jsx` — `finishSession` function (~line 2023), Fire page buttons (~line 2346-2349)

- [ ] **Step 1: Replace `finishSession` with simple navigation**

Replace the entire `finishSession` function (lines ~2023-2061) with:

```js
const finishSession = () => {
  if (!continuingSessionId) return; // Can't view results if session hasn't been saved yet
  setViewId(continuingSessionId);
  setPhase(P.RESULTS);
};
```

- [ ] **Step 2: Update Fire page action buttons**

Replace the button row (lines ~2346-2349):

```jsx
<div className="flex gap-2">
  <Btn onClick={addShot} disabled={shots.length >= total || (cfg.fields || fields).some(f => f.required && (cur[f.key] === "" || cur[f.key] === undefined || cur[f.key] === null))}>Record</Btn>
  <Btn v="secondary" onClick={finishSession} disabled={!continuingSessionId || saveStatus === "saving"}>View Results →</Btn>
</div>
```

This removes the Abort button entirely and changes "Finish Session" to "View Results →". The button is disabled until the session exists in the DB (first shot has been recorded and saved) and auto-save isn't in progress.

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: replace Finish Session with View Results, remove Abort"
```

---

### Task 5: Update navigation — merge Edit into Fire

Make the Edit button everywhere call `continueSession` (which goes to Fire page), remove `+ Shots` buttons, and remove the Edit nav item.

**Files:**
- Modify: `src/App.jsx` — Results page buttons (~line 2473-2475), History page actions (~line 3625-3628), nav items (~line 2168-2176), `P` constant (line 1328)

- [ ] **Step 1: Update Results page toolbar**

On the Results page toolbar (lines ~2473-2481), remove the `+ Shots` button and change `Edit` to call `continueSession`:

Replace:
```jsx
<Btn v="secondary" onClick={() => openEditSession(s.id)}>Edit</Btn>
<Btn v="secondary" onClick={() => continueSession(s.id)}>+ Shots</Btn>
```

With:
```jsx
<Btn v="secondary" onClick={() => continueSession(s.id)}>Edit</Btn>
```

- [ ] **Step 2: Update History page actions**

On the History page (lines ~3625-3628), remove the `+ Shots` button and change `Edit` to call `continueSession`:

Replace the two buttons:
```jsx
<button onClick={() => openEditSession(s.id)} className="...">Edit</button>
<button onClick={() => continueSession(s.id)} className="...">+&nbsp;Shots</button>
```

With a single button:
```jsx
<button onClick={() => continueSession(s.id)} className="h-full px-3 py-3 text-[11px] font-medium cursor-pointer border-none border-l border-border transition-colors bg-transparent text-muted-foreground hover:text-foreground">Edit</button>
```

- [ ] **Step 3: Update nav items — enable Fire tab when continuing**

In the `navItems` array (lines ~2168-2176), update the Fire nav item so it's enabled when `continuingSessionId` is set (allowing navigation back to Fire from other pages):

Replace:
```js
{ label: "Fire",    ph: P.FIRE,    disabled: phase !== P.FIRE },
```

With:
```js
{ label: "Fire",    ph: P.FIRE,    disabled: phase !== P.FIRE && !continuingSessionId, onClick: () => { if (continuingSessionId) setPhase(P.FIRE); } },
```

Also remove any Edit nav item if it exists (it doesn't currently appear in navItems, but verify).

- [ ] **Step 4: Update `newSession` to reset `continuingSessionId`**

In the `newSession` function (line ~2062), ensure it resets `continuingSessionId`:

Replace:
```js
const newSession = () => { setPhase(P.SETUP); setShots([]); setCur(Object.fromEntries(fields.map(f => [f.key, ""]))); setCfg(p => ({ ...p, sessionName: "", notes: "", date: new Date().toISOString().split("T")[0] })); };
```

With:
```js
const newSession = () => { setContinuingSessionId(null); setSaveStatus("saved"); setPhase(P.SETUP); setShots([]); setCur(Object.fromEntries(fields.map(f => [f.key, ""]))); setCfg(p => ({ ...p, sessionName: "", notes: "", date: new Date().toISOString().split("T")[0] })); };
```

- [ ] **Step 5: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: merge Edit and +Shots into Fire page, update navigation"
```

---

### Task 6: Remove Edit phase and dead code

Delete the `P.EDIT` phase, all Edit page JSX, and all `es*` state variables and functions.

**Files:**
- Modify: `src/App.jsx` — remove P.EDIT, remove Edit phase block, remove es* state/functions

- [ ] **Step 1: Remove `P.EDIT` from the phase constant**

On line 1328, change:
```js
const P = { SETUP: 0, FIRE: 1, RESULTS: 2, HISTORY: 3, CMP: 4, EDIT: 5, LIBRARY: 6, MATRIX: 7 };
```

To:
```js
const P = { SETUP: 0, FIRE: 1, RESULTS: 2, HISTORY: 3, CMP: 4, LIBRARY: 6, MATRIX: 7 };
```

(Keep the same numeric values to avoid breaking any stored state.)

- [ ] **Step 2: Remove Edit page state variables**

Remove these state declarations (around lines 1737, 1749-1753):
```js
const [editSessionId, setEditSessionId] = useState(null);
```
```js
const [esCfg, setEsCfg]   = useState({});
const [esShots, setEsShots] = useState([]);
const [esNewShot, setEsNewShot] = useState({ fps: "", x: "", y: "", weight: "" });
const [esShotEdit, setEsShotEdit]   = useState(null);
const [esShotEditVal, setEsShotEditVal] = useState({});
```

And the derived values (line ~2165):
```js
const esStats = useMemo(() => calcStats(esShots, esCfg.fields || fields), [esShots, esCfg.fields, fields]);
```

- [ ] **Step 3: Remove Edit page functions**

Remove these functions:
- `openEditSession` (line ~2085)
- `saveEditSession` (lines ~2086-2097)
- `esAddShot` (lines ~2098-2125)
- `esDelShot` (line ~2126)
- `esStartEdit` (line ~2127)
- `esSaveEdit` (lines ~2128-2152)

- [ ] **Step 4: Remove the entire Edit phase block**

Delete the entire `if (phase === P.EDIT) { ... }` block (lines ~2548-2662), which includes the Edit page JSX.

- [ ] **Step 5: Build and verify**

Run: `npm run build`
Expected: Build succeeds with no errors. There should be no remaining references to `esCfg`, `esShots`, `esNewShot`, `esShotEdit`, `esShotEditVal`, `editSessionId`, `openEditSession`, `saveEditSession`, `esAddShot`, `esDelShot`, `esStartEdit`, `esSaveEdit`, or `P.EDIT`.

Verify with: `grep -n "esCfg\|esShots\|esNewShot\|esShotEdit\|esShotEditVal\|editSessionId\|openEditSession\|saveEditSession\|esAddShot\|esDelShot\|esStartEdit\|esSaveEdit\|P\.EDIT" src/App.jsx`
Expected: No matches.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "refactor: remove Edit phase and all dead es* code"
```

---

### Task 7: Final integration test and push

Verify everything works end to end and push.

**Files:**
- No file changes — testing and pushing only

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: Clean build, no errors.

- [ ] **Step 2: Verify no dead references**

Run: `grep -n "P\.EDIT\|openEditSession\|esCfg\|esShots\|esNewShot\|esShotEdit\|esShotEditVal\|editSessionId" src/App.jsx`
Expected: No matches.

- [ ] **Step 3: Push**

```bash
git push
```

- [ ] **Step 4: Report completion**

Report to user that all changes are pushed and ready to test.
