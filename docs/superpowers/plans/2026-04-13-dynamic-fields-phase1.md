# Dynamic Measurement Fields — Phase 1: Data Model, DB & Setup Page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce configurable measurement fields that persist to settings and are snapshotted into each session's config, with a new "Measurement Fields" card on the Setup page for adding/removing/configuring fields.

**Architecture:** Add a `DEFAULT_FIELDS` constant and `fields` state to App.jsx. Extend `db.js` to read/write `fields` from `app_settings` and include `data` JSONB on shots. Add a Measurement Fields card to the Setup page between Configuration and Session Details. Old sessions get fields injected on load. The Fire page, stats engine, and widgets are NOT changed in this phase — they continue to use the hardcoded fps/x/y/weight properties.

**Tech Stack:** React 19, Tailwind CSS v4, Supabase (JSONB columns)

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `src/App.jsx` | Main app — constants, state, Setup UI | Modify: add DEFAULT_FIELDS, fields state, MeasurementFieldsCard component, wire into Setup phase |
| `src/lib/db.js` | Database layer — Supabase queries | Modify: read/write `fields` from settings, add `data` JSONB to shot save/load, migration fallback |
| `supabase/migrations/add_dynamic_fields.sql` | DB migration | Create: add `data` JSONB column to shots, `fields` JSONB to app_settings |

---

### Task 1: Database Migration SQL

**Files:**
- Create: `supabase/migrations/add_dynamic_fields.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Add data JSONB column to shots table for dynamic measurement fields
ALTER TABLE shots ADD COLUMN IF NOT EXISTS data JSONB;

-- Backfill existing shots: populate data from dedicated columns
UPDATE shots SET data = jsonb_build_object(
  'fps', fps, 'x', x, 'y', y, 'weight', weight
) WHERE data IS NULL;

-- Add fields JSONB column to app_settings for default field definitions
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS fields JSONB;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/add_dynamic_fields.sql
git commit -m "feat: add database migration for dynamic measurement fields"
```

Note: Run this migration against your Supabase instance before testing the app changes. The app-layer fallback (Task 2) ensures the app still works if the migration hasn't run yet.

---

### Task 2: Update db.js — Settings & Shot Data Layer

**Files:**
- Modify: `src/lib/db.js`

- [ ] **Step 1: Update `getSettings` return to include fields**

In `src/lib/db.js`, change line 26 from:

```js
  return data || { opts: null, vars: null, layout: null };
```

to:

```js
  return data || { opts: null, vars: null, layout: null, fields: null };
```

- [ ] **Step 2: Update `getSessions` to read `data` JSONB with fallback**

In `src/lib/db.js`, replace the shot mapping in `getSessions` (lines 55-63) from:

```js
      .map(sh => ({
        id: sh.id,
        fps: sh.fps,
        x: sh.x,
        y: sh.y,
        weight: sh.weight,
        serial: sh.serial,
        shotNum: sh.shot_num,
        timestamp: sh.timestamp,
      })),
```

to:

```js
      .map(sh => ({
        id: sh.id,
        fps: sh.fps,
        x: sh.x,
        y: sh.y,
        weight: sh.weight,
        serial: sh.serial,
        shotNum: sh.shot_num,
        timestamp: sh.timestamp,
        data: sh.data || { fps: sh.fps, x: sh.x, y: sh.y, weight: sh.weight },
      })),
```

- [ ] **Step 3: Update `saveSession` to write `data` JSONB**

In `src/lib/db.js`, replace the `shotsToInsert` mapping in `saveSession` (lines 77-86) from:

```js
  const shotsToInsert = shotData.map(sh => ({
    session_id: session.id,
    serial: sh.serial,
    x: sh.x,
    y: sh.y,
    fps: sh.fps,
    weight: sh.weight,
    shot_num: sh.shotNum,
    timestamp: sh.timestamp,
  }));
```

to:

```js
  const shotsToInsert = shotData.map(sh => ({
    session_id: session.id,
    serial: sh.serial,
    x: sh.x,
    y: sh.y,
    fps: sh.fps,
    weight: sh.weight,
    shot_num: sh.shotNum,
    timestamp: sh.timestamp,
    data: sh.data || { fps: sh.fps, x: sh.x, y: sh.y, weight: sh.weight },
  }));
```

And update the return shot mapping (lines 98-102) from:

```js
    shots: (savedShots || []).sort((a, b) => (a.shot_num || 0) - (b.shot_num || 0)).map(sh => ({
      id: sh.id,
      fps: sh.fps, x: sh.x, y: sh.y, weight: sh.weight,
      serial: sh.serial, shotNum: sh.shot_num, timestamp: sh.timestamp,
    })),
```

to:

```js
    shots: (savedShots || []).sort((a, b) => (a.shot_num || 0) - (b.shot_num || 0)).map(sh => ({
      id: sh.id,
      fps: sh.fps, x: sh.x, y: sh.y, weight: sh.weight,
      serial: sh.serial, shotNum: sh.shot_num, timestamp: sh.timestamp,
      data: sh.data || { fps: sh.fps, x: sh.x, y: sh.y, weight: sh.weight },
    })),
```

- [ ] **Step 4: Update `updateSession` shot mappings for `data` JSONB**

In `src/lib/db.js`, update the existing shot update call (line 131-132) from:

```js
    supabase.from('shots')
      .update({ serial: sh.serial, x: sh.x, y: sh.y, fps: sh.fps, weight: sh.weight, shot_num: sh.shotNum, timestamp: sh.timestamp })
```

to:

```js
    supabase.from('shots')
      .update({ serial: sh.serial, x: sh.x, y: sh.y, fps: sh.fps, weight: sh.weight, shot_num: sh.shotNum, timestamp: sh.timestamp, data: sh.data || { fps: sh.fps, x: sh.x, y: sh.y, weight: sh.weight } })
```

Update the insert mapping for new shots (lines 143-147) from:

```js
    .insert(toInsert.map(sh => ({
        session_id: id,
        serial: sh.serial,
        x: sh.x, y: sh.y, fps: sh.fps, weight: sh.weight,
        shot_num: sh.shotNum, timestamp: sh.timestamp,
      })))
```

to:

```js
    .insert(toInsert.map(sh => ({
        session_id: id,
        serial: sh.serial,
        x: sh.x, y: sh.y, fps: sh.fps, weight: sh.weight,
        shot_num: sh.shotNum, timestamp: sh.timestamp,
        data: sh.data || { fps: sh.fps, x: sh.x, y: sh.y, weight: sh.weight },
      })))
```

Update the return mapping (lines 170-174) from:

```js
    shots: updatedShots.map(sh => ({
      id: sh.id,
      fps: sh.fps, x: sh.x, y: sh.y, weight: sh.weight,
      serial: sh.serial, shotNum: sh.shot_num, timestamp: sh.timestamp,
    })),
```

to:

```js
    shots: updatedShots.map(sh => ({
      id: sh.id,
      fps: sh.fps, x: sh.x, y: sh.y, weight: sh.weight,
      serial: sh.serial, shotNum: sh.shot_num, timestamp: sh.timestamp,
      data: sh.data || { fps: sh.fps, x: sh.x, y: sh.y, weight: sh.weight },
    })),
```

- [ ] **Step 5: Verify build passes**

Run: `npm run build`
Expected: Clean build, no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.js
git commit -m "feat: add data JSONB support to db layer with fallback for old shots"
```

---

### Task 3: Add DEFAULT_FIELDS Constant and Fields State to App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add DEFAULT_FIELDS constant**

After the `DEF_VARS` constant (line 62), add:

```js
const DEFAULT_FIELDS = [
  { key: "fps", label: "FPS", type: "number", required: true, options: [], unit: "fps" },
  { key: "x", label: "X", type: "number", required: true, options: [], unit: "in" },
  { key: "y", label: "Y", type: "number", required: true, options: [], unit: "in" },
  { key: "weight", label: "Weight", type: "number", required: false, options: [], unit: "g" },
];
```

- [ ] **Step 2: Add `fields` state to the App component**

In the App component, after the `[opts, setOpts]` state declaration (around line 1060), add:

```js
const [fields, setFields] = useState(DEFAULT_FIELDS);
```

- [ ] **Step 3: Load fields from settings on startup**

In the `loadAllData` function, after the line `if (settings.vars?.length) setVars(settings.vars);` (around line 1177), add:

```js
      if (settings.fields?.length) setFields(settings.fields);
```

- [ ] **Step 4: Inject default fields into old sessions on load**

In the `loadAllData` function, where sessions are mapped into `log` (the line `setLog(sessions.map(s => ({ ...s, stats: calcStats(s.shots) })));`), change to:

```js
      setLog(sessions.map(s => ({
        ...s,
        config: { ...s.config, fields: s.config.fields || DEFAULT_FIELDS },
        stats: calcStats(s.shots),
      })));
```

- [ ] **Step 5: Snapshot fields into session config when finishing a session**

In the `finishSession` function, where the session is saved (the line `const saved = await db.saveSession({ config: { ...cfg, sessionName: name }, shots: [...shots] });`), change to:

```js
      const saved = await db.saveSession({ config: { ...cfg, sessionName: name, fields }, shots: [...shots] });
```

- [ ] **Step 6: Verify build passes**

Run: `npm run build`
Expected: Clean build, no errors.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add DEFAULT_FIELDS constant, fields state, and session field snapshotting"
```

---

### Task 4: Measurement Fields Card on Setup Page

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add the MeasurementFieldsCard component**

Above the `AppNavBar` function (around line 944), add a new component:

```jsx
// ─── Measurement Fields Card ────────────────────────────────────────────────
function MeasurementFieldsCard({ fields, onUpdate }) {
  const [adding, setAdding] = useState(false);
  const [newField, setNewField] = useState({ name: "", type: "number", required: false, unit: "", options: [] });
  const [newOption, setNewOption] = useState("");

  const typeLabels = { number: "Number", yesno: "Yes / No", text: "Text", dropdown: "Dropdown" };

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
    setNewField({ name: "", type: "number", required: false, unit: "", options: [] });
    setNewOption("");
    setAdding(false);
  };

  const removeField = (key) => {
    onUpdate(fields.filter(f => f.key !== key));
  };

  const addDropdownOption = () => {
    const opt = newOption.trim();
    if (!opt || newField.options.includes(opt)) return;
    setNewField(p => ({ ...p, options: [...p.options, opt] }));
    setNewOption("");
  };

  const removeDropdownOption = (opt) => {
    setNewField(p => ({ ...p, options: p.options.filter(o => o !== opt) }));
  };

  return (
    <CardSection title="Measurement Fields" className="mb-4">
      <p className="text-xs text-muted-foreground mb-3">
        Define what data gets recorded per shot. These fields appear on the Fire page.
      </p>

      {/* Field list */}
      {fields.length > 0 ? (
        <div className="flex flex-col gap-2 mb-4">
          {fields.map(f => (
            <div key={f.key} className="flex items-center gap-2 bg-secondary border border-border rounded-lg px-3 py-2">
              <span className="text-sm font-medium text-foreground flex-1">{f.label}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-background border border-border rounded px-1.5 py-0.5">
                {typeLabels[f.type] || f.type}
              </span>
              {f.unit && (
                <span className="text-[10px] text-muted-foreground">{f.unit}</span>
              )}
              {f.required && (
                <span className="text-[10px] font-bold text-primary">REQ</span>
              )}
              <button
                onClick={() => removeField(f.key)}
                className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer bg-transparent border-none leading-none text-base ml-1"
                aria-label={`Remove ${f.label}`}>×</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground/60 italic mb-4 py-3 text-center border border-dashed border-border rounded-lg">
          No measurement fields configured. Add at least one field before starting a session.
        </div>
      )}

      {/* Add field form */}
      {adding ? (
        <div className="bg-background border border-border rounded-lg p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div className="flex flex-col">
              <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Field Name</label>
              <input
                value={newField.name}
                onChange={e => setNewField(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => { if (e.key === "Enter") addField(); if (e.key === "Escape") { setAdding(false); setNewField({ name: "", type: "number", required: false, unit: "", options: [] }); } }}
                placeholder="e.g. Hole Size"
                className="w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
                autoFocus />
            </div>
            <div className="flex flex-col">
              <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Type</label>
              <select
                value={newField.type}
                onChange={e => setNewField(p => ({ ...p, type: e.target.value }))}
                className="w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary">
                <option value="number">Number</option>
                <option value="yesno">Yes / No</option>
                <option value="text">Text</option>
                <option value="dropdown">Dropdown</option>
              </select>
            </div>
          </div>

          {/* Number-specific: unit */}
          {newField.type === "number" && (
            <div className="flex flex-col mb-3">
              <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Unit (optional)</label>
              <input
                value={newField.unit}
                onChange={e => setNewField(p => ({ ...p, unit: e.target.value }))}
                placeholder="e.g. mm, in, fps"
                className="w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary max-w-[200px]" />
            </div>
          )}

          {/* Dropdown-specific: options */}
          {newField.type === "dropdown" && (
            <div className="flex flex-col mb-3">
              <label className="block mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Options</label>
              {newField.options.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {newField.options.map(opt => (
                    <span key={opt} className="inline-flex items-center gap-1 bg-secondary border border-border rounded px-2 py-0.5 text-xs">
                      {opt}
                      <button onClick={() => removeDropdownOption(opt)}
                        className="text-muted-foreground hover:text-destructive cursor-pointer bg-transparent border-none text-xs leading-none">×</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-center">
                <input
                  value={newOption}
                  onChange={e => setNewOption(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addDropdownOption(); } }}
                  placeholder="Add an option…"
                  className="w-full rounded-md bg-secondary border border-border px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary max-w-[220px]" />
                <button onClick={addDropdownOption}
                  disabled={!newOption.trim()}
                  className={cn("px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer border-none",
                    newOption.trim() ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground opacity-50 cursor-not-allowed"
                  )}>Add</button>
              </div>
            </div>
          )}

          {/* Required checkbox */}
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              checked={newField.required}
              onChange={e => setNewField(p => ({ ...p, required: e.target.checked }))}
              className="rounded border-border" />
            <span className="text-xs text-muted-foreground">Required field</span>
          </label>

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={addField}
              disabled={!newField.name.trim() || (newField.type === "dropdown" && newField.options.length === 0)}
              className={cn("px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer border-none",
                newField.name.trim() && !(newField.type === "dropdown" && newField.options.length === 0)
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground opacity-50 cursor-not-allowed"
              )}>Add Field</button>
            <button onClick={() => { setAdding(false); setNewField({ name: "", type: "number", required: false, unit: "", options: [] }); setNewOption(""); }}
              className="text-muted-foreground text-sm cursor-pointer bg-transparent border-none">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="text-xs font-bold cursor-pointer bg-transparent border-none p-0 transition-colors uppercase tracking-wider"
          style={{ color: "#6b6b7e" }}
          onMouseEnter={e => e.target.style.color = "#111118"}
          onMouseLeave={e => e.target.style.color = "#6b6b7e"}>
          + Add Field
        </button>
      )}
    </CardSection>
  );
}
```

- [ ] **Step 2: Add `updateFields` handler in App component**

In the App component, after the `removeVar` function (around line 1269), add:

```js
  const updateFields = useCallback(async (newFields) => {
    setFields(newFields);
    try { await db.saveSettings({ fields: newFields }); } catch (err) { setDbError('Fields save failed: ' + err.message); }
  }, []);
```

- [ ] **Step 3: Wire MeasurementFieldsCard into the Setup phase**

In the SETUP phase JSX (around line 1378), after the closing `</CardSection>` of the Configuration card and before the `<CardSection title="Session Details">`, add:

```jsx
      <MeasurementFieldsCard fields={fields} onUpdate={updateFields} />
```

- [ ] **Step 4: Disable "Begin Firing Session" when no fields**

Update the disabled condition on the "Begin Firing Session" button. Find the line (around line 1453):

```jsx
        disabled={!cfg.rifleRate || !cfg.sleeveType || !total} cls="w-full py-3 text-base">
```

Change to:

```jsx
        disabled={!cfg.rifleRate || !cfg.sleeveType || !total || fields.length === 0} cls="w-full py-3 text-base">
```

- [ ] **Step 5: Verify build passes**

Run: `npm run build`
Expected: Clean build, no errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add Measurement Fields card to Setup page with add/remove/configure"
```

---

### Task 5: Verify End-to-End Flow

**Files:** None — this is a manual verification task.

- [ ] **Step 1: Run the Supabase migration**

Execute the SQL migration from Task 1 against your Supabase instance (via Supabase dashboard SQL editor or CLI).

- [ ] **Step 2: Start the dev server and verify**

Run: `npm run dev`

Verify the following:

1. **Setup page loads** — the Measurement Fields card appears between Configuration and Session Details
2. **Default fields shown** — FPS, X, Y, Weight are listed with correct types and required badges
3. **Remove a field** — click × on Weight, it disappears from the list
4. **Add a custom field** — click "+ Add Field", enter "Hole Size", type Number, unit "mm", required checked. Click Add. It appears in the list.
5. **Add a dropdown field** — click "+ Add Field", enter "Attainment", type Dropdown, add options "Yes", "No". Click Add. It appears.
6. **Refresh the page** — fields persist (loaded from `app_settings.fields` in Supabase)
7. **Old sessions still load** — History shows existing sessions with stats calculated correctly
8. **Start a session and finish** — the session config in Supabase should include a `fields` array
9. **Begin Firing** button disabled when no fields present — remove all fields, button should be disabled

- [ ] **Step 3: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix: address issues found during e2e verification"
```
