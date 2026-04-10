# Ballistic Workstation — Supabase Migration, Attachments & Redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the app from localStorage to Supabase, add per-shot file attachments with a library view, then redesign the UI to Axon brand standards.

**Architecture:** Three sequential phases: (1) replace the `ld`/`sv` localStorage helpers with a `src/lib/db.js` Supabase data-access module and add an auth gate; (2) add attachment upload/view feature and a Library page; (3) redesign using the `frontend-design` skill. Each phase must be complete and working before starting the next.

**Tech Stack:** React 19, Vite 8, Tailwind v4, `@supabase/supabase-js`, Vercel deployment.

**Spec:** `docs/superpowers/specs/2026-04-10-supabase-migration-redesign-design.md`

---

## File Map

### New files
- `src/lib/supabase.js` — Supabase client singleton
- `src/lib/db.js` — all DB/storage operations (thin wrappers over Supabase)
- `src/components/LoginScreen.jsx` — full-screen auth gate
- `src/components/AttachmentWidget.jsx` — attachment widget for Results page
- `src/components/LibraryPage.jsx` — Library page with filter bar + attachment grid
- `.env` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `vercel.json` — SPA routing config

### Modified files
- `package.json` — add `@supabase/supabase-js`
- `src/App.jsx` — replace localStorage calls, add auth state, add attachment + library state, add Library nav item

---

## Phase 1 — Supabase Backend Migration

---

### Task 1: Install dependencies and create env files

**Files:**
- Modify: `package.json`
- Create: `.env`
- Create: `vercel.json`

- [ ] **Step 1: Install Supabase JS client**

```bash
npm install @supabase/supabase-js
```

Expected output: `added 1 package` (or similar, no errors)

- [ ] **Step 2: Create `.env`**

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

> You will fill in real values after creating the Supabase project in Task 2.

- [ ] **Step 3: Create `vercel.json`**

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 4: Add `.env` to `.gitignore`**

Open `.gitignore` (create it if it doesn't exist) and add:

```
.env
.env.local
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vercel.json .gitignore
git commit -m "feat: install supabase-js, add vercel config"
```

---

### Task 2: Create Supabase project and schema (manual)

**This task has no code — it is performed in the Supabase dashboard at supabase.com.**

- [ ] **Step 1: Create a new Supabase project**

Go to `supabase.com → New project`. Name it `ballistic-workstation`. Note the Project URL and anon key from Settings → API.

- [ ] **Step 2: Fill in `.env`**

Replace placeholder values in `.env` with your actual Project URL and anon key.

- [ ] **Step 3: Run schema SQL in Supabase SQL editor**

Go to `SQL Editor` in the Supabase dashboard and run:

```sql
-- Sessions
CREATE TABLE sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text,
  config      jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

-- Shots
CREATE TABLE shots (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid        REFERENCES sessions(id) ON DELETE CASCADE,
  serial      text,
  x           float,
  y           float,
  fps         float,
  weight      float,
  shot_num    int,
  timestamp   text
);

-- Attachments (used in Phase 2)
CREATE TABLE attachments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shot_id      uuid        REFERENCES shots(id) ON DELETE CASCADE,
  session_id   uuid        REFERENCES sessions(id) ON DELETE CASCADE,
  storage_path text,
  file_name    text,
  file_url     text,
  file_type    text,
  file_size    int,
  created_at   timestamptz DEFAULT now()
);

-- Comparisons
CREATE TABLE comparisons (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text,
  data        jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

-- App settings (single row)
CREATE TABLE app_settings (
  id      int         PRIMARY KEY DEFAULT 1,
  opts    jsonb       DEFAULT '{}',
  vars    jsonb       DEFAULT '[]',
  layout  jsonb       DEFAULT '{}'
);

-- Enable RLS on all tables
ALTER TABLE sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE shots        ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparisons  ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Single policy: authenticated users can do everything
CREATE POLICY "auth_users_all" ON sessions     FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_users_all" ON shots        FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_users_all" ON attachments  FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_users_all" ON comparisons  FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_users_all" ON app_settings FOR ALL USING (auth.uid() IS NOT NULL);
```

- [ ] **Step 4: Create the shared team account**

Go to `Authentication → Users → Add user`. Enter the shared team email and password. Share credentials with the team.

- [ ] **Step 5: Verify tables exist**

In the Supabase Table Editor, confirm all 5 tables are visible: `sessions`, `shots`, `attachments`, `comparisons`, `app_settings`.

---

### Task 3: Create Supabase client singleton

**Files:**
- Create: `src/lib/supabase.js`

- [ ] **Step 1: Create `src/lib/supabase.js`**

```js
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(url, key);
```

- [ ] **Step 2: Verify the import resolves**

Run `npm run dev`. The app should still load (no console errors about missing env vars, assuming `.env` is filled in).

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase.js
git commit -m "feat: add supabase client singleton"
```

---

### Task 4: Create data access module

**Files:**
- Create: `src/lib/db.js`

- [ ] **Step 1: Create `src/lib/db.js`**

```js
import { supabase } from './supabase.js';

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export async function getSettings() {
  const { data } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', 1)
    .single();
  return data || { opts: null, vars: null, layout: null };
}

export async function saveSettings(patch) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ id: 1, ...patch }, { onConflict: 'id' });
  if (error) throw error;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────
// Returns sessions in the same shape App.jsx expects:
// { id, date, config, shots: [{ id, fps, x, y, weight, serial, shotNum, timestamp }] }
// App.jsx adds stats via calcStats(session.shots)
export async function getSessions() {
  const [{ data: sessions, error: se }, { data: shots, error: she }] = await Promise.all([
    supabase.from('sessions').select('*').order('created_at', { ascending: false }),
    supabase.from('shots').select('*'),
  ]);
  if (se) throw se;
  if (she) throw she;

  return (sessions || []).map(s => ({
    id: s.id,
    date: s.created_at,
    config: s.config,
    shots: (shots || [])
      .filter(sh => sh.session_id === s.id)
      .sort((a, b) => (a.shot_num || 0) - (b.shot_num || 0))
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
  }));
}

// Inserts a new session + its shots. Returns the saved session in App.jsx shape.
export async function saveSession({ config, shots: shotData }) {
  const { data: session, error: se } = await supabase
    .from('sessions')
    .insert({ name: config.sessionName || '', config })
    .select()
    .single();
  if (se) throw se;

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

  const { data: savedShots, error: she } = await supabase
    .from('shots')
    .insert(shotsToInsert)
    .select();
  if (she) throw she;

  return {
    id: session.id,
    date: session.created_at,
    config: session.config,
    shots: (savedShots || []).sort((a, b) => (a.shot_num || 0) - (b.shot_num || 0)).map(sh => ({
      id: sh.id,
      fps: sh.fps, x: sh.x, y: sh.y, weight: sh.weight,
      serial: sh.serial, shotNum: sh.shot_num, timestamp: sh.timestamp,
    })),
  };
}

// Updates session config + replaces all shots (delete old, insert new).
export async function updateSession(id, { config, shots: shotData }) {
  const { error: ue } = await supabase
    .from('sessions')
    .update({ name: config.sessionName || '', config })
    .eq('id', id);
  if (ue) throw ue;

  // Delete old shots (cascade doesn't help here — we need to replace)
  const { error: de } = await supabase.from('shots').delete().eq('session_id', id);
  if (de) throw de;

  const shotsToInsert = shotData.map(sh => ({
    session_id: id,
    serial: sh.serial,
    x: sh.x, y: sh.y, fps: sh.fps, weight: sh.weight,
    shot_num: sh.shotNum, timestamp: sh.timestamp,
  }));

  const { data: savedShots, error: she } = await supabase
    .from('shots')
    .insert(shotsToInsert)
    .select();
  if (she) throw she;

  const { data: session, error: se } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .single();
  if (se) throw se;

  return {
    id: session.id,
    date: session.created_at,
    config: session.config,
    shots: (savedShots || []).sort((a, b) => (a.shot_num || 0) - (b.shot_num || 0)).map(sh => ({
      id: sh.id,
      fps: sh.fps, x: sh.x, y: sh.y, weight: sh.weight,
      serial: sh.serial, shotNum: sh.shot_num, timestamp: sh.timestamp,
    })),
  };
}

export async function deleteSession(id) {
  const { error } = await supabase.from('sessions').delete().eq('id', id);
  if (error) throw error;
}

// ─── Comparisons ──────────────────────────────────────────────────────────────
export async function getComparisons() {
  const { data, error } = await supabase
    .from('comparisons')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(c => ({
    id: c.id,
    name: c.title || 'Comparison',
    title: c.title,
    ...(c.data || {}),
  }));
}

export async function saveComparison({ title, slots, filters, by, metrics, widgets }) {
  const { data, error } = await supabase
    .from('comparisons')
    .insert({ title, data: { slots, filters, by, metrics, widgets } })
    .select()
    .single();
  if (error) throw error;
  return { id: data.id, name: title || 'Comparison', title, slots, filters, by, metrics, widgets };
}

export async function deleteComparison(id) {
  const { error } = await supabase.from('comparisons').delete().eq('id', id);
  if (error) throw error;
}

// ─── Attachments (Phase 2) ────────────────────────────────────────────────────
export async function uploadAttachment(file, shotId, sessionId) {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
  const uniqueName = `${Date.now()}${ext ? '.' + ext : ''}`;
  const storagePath = `${sessionId}/${shotId}/${uniqueName}`;

  const { error: ue } = await supabase.storage
    .from('attachments')
    .upload(storagePath, file, { upsert: false });
  if (ue) throw ue;

  const { data: urlData } = supabase.storage
    .from('attachments')
    .getPublicUrl(storagePath);

  const { data, error } = await supabase
    .from('attachments')
    .insert({
      shot_id: shotId,
      session_id: sessionId,
      storage_path: storagePath,
      file_name: file.name,
      file_url: urlData.publicUrl,
      file_type: file.type,
      file_size: file.size,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getAttachments(filters = {}) {
  let query = supabase.from('attachments').select('*').order('created_at', { ascending: false });
  if (filters.sessionId)  query = query.eq('session_id', filters.sessionId);
  if (filters.sessionIds) query = query.in('session_id', filters.sessionIds);
  if (filters.shotId)     query = query.eq('shot_id', filters.shotId);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function deleteAttachment(id, storagePath) {
  await supabase.storage.from('attachments').remove([storagePath]);
  const { error } = await supabase.from('attachments').delete().eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/db.js
git commit -m "feat: add Supabase data access module"
```

---

### Task 5: Create LoginScreen component

**Files:**
- Create: `src/components/LoginScreen.jsx`

- [ ] **Step 1: Create `src/components/LoginScreen.jsx`**

```jsx
import { useState } from 'react';
import { signIn } from '../lib/db.js';

export function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      onLogin();
    } catch (err) {
      setError(err.message || 'Sign in failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <span className="text-primary font-bold text-xs tracking-[0.12em] uppercase">Ballistic WS</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Sign in</h1>
        <p className="text-sm text-muted-foreground mb-8">Access restricted to authorized team members.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none transition-colors"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-primary text-black font-semibold text-sm disabled:opacity-50 cursor-pointer hover:bg-primary/90 transition-colors">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/LoginScreen.jsx
git commit -m "feat: add LoginScreen component"
```

---

### Task 6: Add auth gate to App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add imports at top of `src/App.jsx`**

Add to the existing import block (after the last import):

```js
import { LoginScreen } from './components/LoginScreen.jsx';
import * as db from './lib/db.js';
```

- [ ] **Step 2: Add auth state to the App component**

In `App()`, after the existing `useState` declarations (around line 920), add:

```js
const [authed, setAuthed] = useState(false);
const [authChecked, setAuthChecked] = useState(false);
const [dbError, setDbError] = useState(null);
```

- [ ] **Step 3: Add auth check on mount**

Replace the existing `useEffect` that loads localStorage data (the one at line ~968 that calls `ld(SK)`, `ld(OK)`, etc.) with this new version:

```js
useEffect(() => {
  (async () => {
    // Check existing Supabase session
    const session = await db.getSession();
    if (session) {
      setAuthed(true);
      await loadAllData();
    }
    setAuthChecked(true);
  })();
}, []);

const loadAllData = async () => {
  try {
    const [settings, sessions, comparisons] = await Promise.all([
      db.getSettings(),
      db.getSessions(),
      db.getComparisons(),
    ]);
    if (settings.opts)   setOpts(p => ({ ...p, ...settings.opts }));
    if (settings.vars)   setVars(settings.vars);
    if (settings.layout) {
      if (settings.layout.layout)     setLayout(settings.layout.layout);
      if (settings.layout.dispOpts)   setDispOpts(settings.layout.dispOpts);
      if (settings.layout.cmpMetrics) setCmpMetrics(settings.layout.cmpMetrics);
      if (settings.layout.cmpWidgets) setCmpWidgets(settings.layout.cmpWidgets);
    }
    setLog(sessions.map(s => ({ ...s, stats: calcStats(s.shots) })));
    setSavedComparisons(comparisons);
  } catch (err) {
    setDbError('Failed to load data: ' + err.message);
  }
};
```

- [ ] **Step 4: Add auth gate at the start of the App return**

At the very beginning of the App component's render logic (before the `if (phase === P.SETUP)` block), add:

```js
if (!authChecked) return (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <span className="text-muted-foreground text-sm">Loading…</span>
  </div>
);

if (!authed) return (
  <LoginScreen onLogin={() => { setAuthed(true); loadAllData(); }} />
);
```

- [ ] **Step 5: Add toast for DB errors**

In `AppShell` (or directly in the return of each page phase), add at the top:

```jsx
{dbError && (
  <div className="fixed bottom-4 right-4 z-[400] bg-destructive text-white text-sm px-4 py-3 rounded-lg shadow-xl flex items-center gap-3">
    <span>{dbError}</span>
    <button onClick={() => setDbError(null)} className="font-bold opacity-70 hover:opacity-100 cursor-pointer bg-transparent border-none text-white">✕</button>
  </div>
)}
```

Add `{dbError && ...}` inside each phase's `AppShell` return, directly before `</AppShell>`.

- [ ] **Step 6: Verify**

Run `npm run dev`. The app should show a spinner briefly, then the login form. Sign in with the credentials you created in Task 2. After signing in, the app should reach the Setup page.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add Supabase auth gate to App"
```

---

### Task 7: Replace settings persistence

**Files:**
- Modify: `src/App.jsx`

This task replaces `sv(OK, ...)`, `sv(CVK, ...)`, and `saveLayoutAll` calls with `db.saveSettings`.

- [ ] **Step 1: Replace `saveLayoutAll`**

Find the existing `saveLayoutAll`:
```js
const saveLayoutAll = useCallback(async upd => { const c = { layout, dispOpts, cmpMetrics, cmpWidgets, ...upd }; await sv(LK, c); }, [layout, dispOpts, cmpMetrics, cmpWidgets]);
```

Replace with:
```js
const saveLayoutAll = useCallback(async upd => {
  const c = { layout, dispOpts, cmpMetrics, cmpWidgets, ...upd };
  try { await db.saveSettings({ layout: c }); } catch (err) { setDbError('Settings save failed: ' + err.message); }
}, [layout, dispOpts, cmpMetrics, cmpWidgets]);
```

- [ ] **Step 2: Replace `addOption`**

Find:
```js
const addOption = useCallback(async (key, val) => { setOpts(p => { const n = { ...p, [key]: [...(p[key] || []), val] }; sv(OK, n); return n; }); }, []);
```

Replace with:
```js
const addOption = useCallback(async (key, val) => {
  setOpts(p => {
    const n = { ...p, [key]: [...(p[key] || []), val] };
    db.saveSettings({ opts: n }).catch(err => setDbError('Options save failed: ' + err.message));
    return n;
  });
}, []);
```

- [ ] **Step 3: Replace `addVar`**

Find the line `await sv(CVK, nv);` inside `addVar` and replace it with:
```js
await db.saveSettings({ vars: nv });
```

Find `sv(CVK, n)` inside `removeVar` and replace with:
```js
db.saveSettings({ vars: n }).catch(err => setDbError('Var save failed: ' + err.message));
```

- [ ] **Step 4: Verify**

Add a new dropdown option in Setup. Refresh the browser. Confirm the new option persists (now from Supabase, not localStorage). Check the Supabase `app_settings` table — row 1 should have `opts` populated.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: replace settings localStorage with Supabase"
```

---

### Task 8: Replace sessions and shots persistence

**Files:**
- Modify: `src/App.jsx`

This task replaces `updateLog` with specific `db.*` calls.

- [ ] **Step 1: Remove `updateLog`**

Delete the line:
```js
const updateLog = async nl => { setLog(nl); await sv(SK, nl); };
```

- [ ] **Step 2: Replace `finishSession`**

Replace:
```js
const finishSession = async () => { const name = cfg.sessionName || vars.map(v => cfg[v.key]).filter(Boolean).join(" | "); const id = Date.now(); await updateLog([...log, { id, date: new Date().toISOString(), config: { ...cfg, sessionName: name }, shots: [...shots], stats: { ...stats } }]); setViewId(id); setPhase(P.RESULTS); };
```

With:
```js
const finishSession = async () => {
  const name = cfg.sessionName || vars.map(v => cfg[v.key]).filter(Boolean).join(" | ");
  try {
    const saved = await db.saveSession({ config: { ...cfg, sessionName: name }, shots: [...shots] });
    const entry = { ...saved, stats: calcStats(saved.shots) };
    setLog(p => [entry, ...p]);
    setViewId(saved.id);
    setPhase(P.RESULTS);
  } catch (err) {
    setDbError('Failed to save session: ' + err.message);
  }
};
```

- [ ] **Step 3: Replace `delSession`**

Replace:
```js
const delSession = async id => updateLog(log.filter(s => s.id !== id));
```

With:
```js
const delSession = async id => {
  try {
    await db.deleteSession(id);
    setLog(p => p.filter(s => s.id !== id));
  } catch (err) {
    setDbError('Failed to delete session: ' + err.message);
  }
};
```

- [ ] **Step 4: Replace `saveEditSession`**

Replace:
```js
const saveEditSession = async () => { const st = calcStats(esShots); const name = esCfg.sessionName || vars.map(v => esCfg[v.key]).filter(Boolean).join(" | "); await updateLog(log.map(s => s.id === editSessionId ? { ...s, config: { ...esCfg, sessionName: name }, shots: [...esShots], stats: st } : s)); setViewId(editSessionId); setPhase(P.RESULTS); };
```

With:
```js
const saveEditSession = async () => {
  const name = esCfg.sessionName || vars.map(v => esCfg[v.key]).filter(Boolean).join(" | ");
  try {
    const saved = await db.updateSession(editSessionId, { config: { ...esCfg, sessionName: name }, shots: [...esShots] });
    const entry = { ...saved, stats: calcStats(saved.shots) };
    setLog(p => p.map(s => s.id === editSessionId ? entry : s));
    setViewId(editSessionId);
    setPhase(P.RESULTS);
  } catch (err) {
    setDbError('Failed to update session: ' + err.message);
  }
};
```

- [ ] **Step 5: Replace `continueSession`**

Replace:
```js
const continueSession = id => { const s = log.find(x => x.id === id); if (!s) return; setCfg({ ...s.config }); setShots(s.shots.map(sh => ({ ...sh }))); setCur({ fps: "", x: "", y: "", weight: s.shots[0]?.weight || "" }); updateLog(log.filter(x => x.id !== id)); setPhase(P.FIRE); setTimeout(() => fpsRef.current?.focus(), 100); };
```

With:
```js
const continueSession = async id => {
  const s = log.find(x => x.id === id);
  if (!s) return;
  setCfg({ ...s.config });
  setShots(s.shots.map(sh => ({ ...sh })));
  setCur({ fps: "", x: "", y: "", weight: s.shots[0]?.weight || "" });
  try {
    await db.deleteSession(id);
    setLog(p => p.filter(x => x.id !== id));
  } catch (err) {
    setDbError('Failed to continue session: ' + err.message);
  }
  setPhase(P.FIRE);
  setTimeout(() => fpsRef.current?.focus(), 100);
};
```

- [ ] **Step 6: Replace `handleImport`**

Replace:
```js
const handleImport = async e => { const file = e.target.files?.[0]; if (!file) return; try { const data = JSON.parse(await file.text()); if (Array.isArray(data) && data.length) { await updateLog([...log, ...data]); alert("Imported " + data.length); } else alert("No sessions."); } catch (err) { alert("Error: " + err.message); } e.target.value = ""; };
```

With:
```js
const handleImport = async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data) || !data.length) { setDbError('No sessions found in file.'); return; }
    const saved = await Promise.all(data.map(s => db.saveSession({ config: s.config, shots: s.shots || [] })));
    const entries = saved.map(s => ({ ...s, stats: calcStats(s.shots) }));
    setLog(p => [...entries, ...p]);
  } catch (err) {
    setDbError('Import failed: ' + err.message);
  }
  e.target.value = "";
};
```

- [ ] **Step 7: Verify**

Run `npm run dev`. Create a new session by going through Setup → Fire → finish. Confirm the session appears in History. Refresh the browser — confirm it persists. Check `sessions` and `shots` tables in Supabase dashboard.

Delete a session. Confirm it disappears from both the UI and Supabase.

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx
git commit -m "feat: replace session/shot localStorage with Supabase"
```

---

### Task 9: Replace comparisons persistence

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Replace `saveComparison`**

Find the existing `saveComparison` callback and replace it:

```js
const saveComparison = useCallback(async (title, slots, filters, by, metrics, widgets) => {
  try {
    const saved = await db.saveComparison({ title, slots, filters, by, metrics, widgets });
    setSavedComparisons(p => [saved, ...p]);
  } catch (err) {
    setDbError('Failed to save comparison: ' + err.message);
  }
}, []);
```

- [ ] **Step 2: Replace `deleteComparison`**

```js
const deleteComparison = useCallback(async (id) => {
  try {
    await db.deleteComparison(id);
    setSavedComparisons(p => p.filter(c => c.id !== id));
  } catch (err) {
    setDbError('Failed to delete comparison: ' + err.message);
  }
}, []);
```

- [ ] **Step 3: Remove the old `sv(CK, ...)` calls**

Search for `sv(CK,` in App.jsx and confirm there are none remaining (the old `saveComparison` and `deleteComparison` used these — they should be gone after steps 1-2 above).

- [ ] **Step 4: Remove the old localStorage helpers and storage keys**

Delete these lines from the top of `src/App.jsx`:
```js
const SK="bw-vB",OK="bw-opts-vB",CVK="bw-cvars-vB",LK="bw-layout-vB",CK="bw-cmp-saves-vB";
async function ld(k){try{const r=localStorage.getItem(k);return r?JSON.parse(r):null;}catch{return null;}}
async function sv(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){console.error(e);}}
```

- [ ] **Step 5: Verify no remaining `ld(` or `sv(` calls**

```bash
grep -n "ld(\|sv(" src/App.jsx
```

Expected output: no matches. If there are matches, fix them before proceeding.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: replace comparisons localStorage with Supabase, remove ld/sv helpers"
```

---

## Phase 2 — Attachment Feature

---

### Task 10: Create Supabase Storage bucket (manual)

- [ ] **Step 1: Create the Storage bucket**

In Supabase dashboard → Storage → New bucket:
- Name: `attachments`
- Public bucket: **Yes** (checked) — this makes URLs permanent without expiry, suitable for a team tool

- [ ] **Step 2: Verify**

In Storage, the `attachments` bucket should appear. The bucket access should show as Public.

---

### Task 11: Create AttachmentWidget component

**Files:**
- Create: `src/components/AttachmentWidget.jsx`

- [ ] **Step 1: Create `src/components/AttachmentWidget.jsx`**

```jsx
import { useState, useEffect, useRef } from 'react';
import { uploadAttachment, getAttachments, deleteAttachment } from '../lib/db.js';

const FILE_ICONS = {
  video: '▶',
  image: null, // shows thumbnail
  application: '📄',
  default: '📎',
};

function fileIconChar(fileType) {
  const kind = (fileType || '').split('/')[0];
  return FILE_ICONS[kind] ?? FILE_ICONS.default;
}

function AttachmentCard({ att, onDelete, onClick }) {
  const isImage = att.file_type?.startsWith('image/');
  const isVideo = att.file_type?.startsWith('video/');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm(`Delete ${att.file_name}?`)) return;
    setDeleting(true);
    await onDelete(att.id, att.storage_path);
  };

  return (
    <div
      onClick={onClick}
      className="relative group bg-secondary border border-border rounded-lg overflow-hidden cursor-pointer hover:border-primary/30 transition-colors">
      <div className="aspect-square flex items-center justify-center bg-card/50">
        {isImage ? (
          <img src={att.file_url} alt={att.file_name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="text-3xl select-none">{fileIconChar(att.file_type)}</span>
        )}
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-white text-2xl">▶</span>
          </div>
        )}
      </div>
      <div className="px-2 py-1.5">
        <p className="text-[11px] text-foreground truncate font-medium">{att.file_name}</p>
        <p className="text-[10px] text-muted-foreground">{att.serial || '—'} · {(att.file_size / 1024).toFixed(0)} KB</p>
      </div>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="absolute top-1.5 right-1.5 size-5 rounded bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none hover:bg-destructive/80">
        ✕
      </button>
    </div>
  );
}

function MediaViewer({ att, onClose }) {
  if (!att) return null;
  const isImage = att.file_type?.startsWith('image/');
  const isVideo = att.file_type?.startsWith('video/');

  return (
    <div
      className="fixed inset-0 z-[500] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 size-8 rounded-full bg-white/10 text-white flex items-center justify-center cursor-pointer border-none text-lg hover:bg-white/20">
        ✕
      </button>
      <div onClick={e => e.stopPropagation()} className="max-w-full max-h-full">
        {isImage && <img src={att.file_url} alt={att.file_name} className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />}
        {isVideo && <video src={att.file_url} controls autoPlay className="max-h-[90vh] max-w-[90vw] rounded-lg" />}
        {!isImage && !isVideo && (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <p className="text-4xl mb-4">{fileIconChar(att.file_type)}</p>
            <p className="text-foreground font-medium mb-4">{att.file_name}</p>
            <a href={att.file_url} target="_blank" rel="noreferrer"
              className="text-primary text-sm underline">Open file ↗</a>
          </div>
        )}
      </div>
    </div>
  );
}

export function AttachmentWidget({ session, onError }) {
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [viewer, setViewer] = useState(null);
  const fileInputRef = useRef();

  useEffect(() => {
    if (!session?.id) return;
    getAttachments({ sessionId: session.id })
      .then(setAttachments)
      .catch(err => onError?.('Failed to load attachments: ' + err.message));
  }, [session?.id]);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // Warn on large videos (>500MB) but don't block
    const large = files.find(f => f.size > 500 * 1024 * 1024);
    if (large && !confirm(`${large.name} is over 500MB. Upload anyway?`)) {
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      // Each file uploads to the first shot's id (or session-level if no shots)
      // If user wants per-shot: they select the shot in a future iteration
      const shotId = session.shots?.[0]?.id || session.id;
      const saved = await Promise.all(files.map(f => uploadAttachment(f, shotId, session.id)));
      setAttachments(p => [...saved, ...p]);
    } catch (err) {
      onError?.('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id, storagePath) => {
    try {
      await deleteAttachment(id, storagePath);
      setAttachments(p => p.filter(a => a.id !== id));
    } catch (err) {
      onError?.('Delete failed: ' + err.message);
    }
  };

  // Group by shot serial (using shot_id for grouping)
  const grouped = attachments.reduce((acc, att) => {
    const key = att.shot_id || 'session';
    if (!acc[key]) acc[key] = [];
    acc[key].push(att);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50 transition-colors">
          {uploading ? 'Uploading…' : '+ Add Files'}
        </button>
        <span className="text-[11px] text-muted-foreground">{attachments.length} file{attachments.length !== 1 ? 's' : ''}</span>
      </div>

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">No attachments yet. Add photos or videos of the shots.</p>
      ) : (
        Object.entries(grouped).map(([shotId, atts]) => {
          const shotRef = session.shots?.find(s => s.id === shotId);
          return (
            <div key={shotId} className="mb-4">
              {shotRef && (
                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">{shotRef.serial}</p>
              )}
              <div className="grid grid-cols-3 gap-2">
                {atts.map(att => (
                  <AttachmentCard key={att.id} att={att} onDelete={handleDelete} onClick={() => setViewer(att)} />
                ))}
              </div>
            </div>
          );
        })
      )}

      <MediaViewer att={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AttachmentWidget.jsx
git commit -m "feat: add AttachmentWidget component"
```

---

### Task 12: Add attachments widget to Results page

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Import `AttachmentWidget` in `src/App.jsx`**

Add to the imports block:
```js
import { AttachmentWidget } from './components/AttachmentWidget.jsx';
```

- [ ] **Step 2: Add `attachments` entry to `WIDGETS`**

In the `WIDGETS` object (around line 800, after `shotTable`), add:

```js
attachments: { label: "Attachments", default: false, render: (s) => (
  <AttachmentWidget session={s} onError={setDbError} />
)},
```

Note: The `render` function signature is `(s, vs, st, opts, toggle, setOpt)` — here `s` is the full session object which includes `s.shots` with their DB ids.

- [ ] **Step 3: Verify**

Go to Results page for any session. Click "+ Add Widget" and add "Attachments". The widget should appear with a "+ Add Files" button. Upload a test image. Confirm it appears in the grid. Check the `attachments` table and `attachments` Storage bucket in Supabase — the row and file should both be present.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add attachments widget to Results page"
```

---

### Task 13: Create LibraryPage component

**Files:**
- Create: `src/components/LibraryPage.jsx`

- [ ] **Step 1: Create `src/components/LibraryPage.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { getAttachments, deleteAttachment } from '../lib/db.js';

const FILE_TYPES = {
  image: 'Images',
  video: 'Videos',
  application: 'Documents',
};

function fileKind(fileType) {
  return (fileType || '').split('/')[0];
}

function MediaViewer({ att, onClose }) {
  if (!att) return null;
  const isImage = att.file_type?.startsWith('image/');
  const isVideo = att.file_type?.startsWith('video/');
  return (
    <div className="fixed inset-0 z-[500] bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 size-8 rounded-full bg-white/10 text-white flex items-center justify-center cursor-pointer border-none text-lg hover:bg-white/20">✕</button>
      <div onClick={e => e.stopPropagation()} className="max-w-full max-h-full">
        {isImage && <img src={att.file_url} alt={att.file_name} className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />}
        {isVideo && <video src={att.file_url} controls autoPlay className="max-h-[90vh] max-w-[90vw] rounded-lg" />}
        {!isImage && !isVideo && (
          <div className="bg-card border border-border rounded-lg p-8 text-center">
            <p className="text-foreground font-medium mb-4">{att.file_name}</p>
            <a href={att.file_url} target="_blank" rel="noreferrer" className="text-primary text-sm underline">Open file ↗</a>
          </div>
        )}
        <p className="text-white/60 text-xs text-center mt-3">{att.session_name} · {att.serial} · {new Date(att.created_at).toLocaleDateString()}</p>
      </div>
    </div>
  );
}

export function LibraryPage({ log, vars, preFilterSessionIds, onError }) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [viewer, setViewer] = useState(null);

  // Load all attachments, enriched with session name and shot serial
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const atts = await getAttachments(
          preFilterSessionIds ? { sessionIds: preFilterSessionIds } : {}
        );
        // Enrich with session/shot data from the log
        const enriched = atts.map(att => {
          const session = log.find(s => s.id === att.session_id);
          const shot = session?.shots?.find(sh => sh.id === att.shot_id);
          return {
            ...att,
            session_name: session?.config?.sessionName || 'Unknown Session',
            serial: shot?.serial || '—',
            session_config: session?.config || {},
          };
        });
        setAttachments(enriched);
      } catch (err) {
        onError?.('Failed to load library: ' + err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [preFilterSessionIds]);

  const handleDelete = async (id, storagePath) => {
    if (!confirm('Delete this attachment?')) return;
    try {
      await deleteAttachment(id, storagePath);
      setAttachments(p => p.filter(a => a.id !== id));
    } catch (err) {
      onError?.('Delete failed: ' + err.message);
    }
  };

  // Filter by session variables
  const filtered = attachments.filter(att => {
    return Object.entries(filters).every(([k, v]) => {
      if (!v) return true;
      if (k === 'sessionId') return att.session_id === v;
      return att.session_config?.[k] === v;
    });
  });

  // Build filter options from vars
  const varFilterOptions = vars.map(v => {
    const vals = [...new Set(attachments.map(a => a.session_config?.[v.key]).filter(Boolean))];
    return { ...v, vals };
  }).filter(v => v.vals.length >= 2);

  return (
    <div>
      {/* Filter bar */}
      {varFilterOptions.length > 0 && (
        <div className="flex flex-wrap gap-x-5 gap-y-2 mb-6 p-4 bg-card border border-border rounded-xl">
          {varFilterOptions.map(v => (
            <div key={v.key} className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{v.label}:</span>
              <button
                onClick={() => setFilters(p => { const n = { ...p }; delete n[v.key]; return n; })}
                className={`text-[11px] px-2 py-0.5 rounded border cursor-pointer transition-colors ${!filters[v.key] ? 'bg-primary/15 text-primary border-primary/30 font-semibold' : 'bg-transparent text-muted-foreground border-border hover:text-foreground'}`}>
                All
              </button>
              {v.vals.map(val => (
                <button key={val}
                  onClick={() => setFilters(p => ({ ...p, [v.key]: val }))}
                  className={`text-[11px] px-2 py-0.5 rounded border cursor-pointer transition-colors ${filters[v.key] === val ? 'bg-primary/15 text-primary border-primary/30 font-semibold' : 'bg-transparent text-muted-foreground border-border hover:text-foreground'}`}>
                  {val}
                </button>
              ))}
            </div>
          ))}
          {Object.keys(filters).length > 0 && (
            <button onClick={() => setFilters({})} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none ml-auto">Clear filters</button>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Loading attachments…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-sm">No attachments found.</p>
          <p className="text-muted-foreground/60 text-xs mt-1">Add files via the Attachments widget on the Results page.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map(att => {
            const isImage = att.file_type?.startsWith('image/');
            const isVideo = att.file_type?.startsWith('video/');
            return (
              <div key={att.id} onClick={() => setViewer(att)}
                className="group relative bg-secondary border border-border rounded-lg overflow-hidden cursor-pointer hover:border-primary/30 transition-colors">
                <div className="aspect-square flex items-center justify-center bg-card/50">
                  {isImage ? (
                    <img src={att.file_url} alt={att.file_name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <span className="text-3xl">{isVideo ? '▶' : '📎'}</span>
                  )}
                  {isVideo && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <span className="text-white text-2xl">▶</span>
                    </div>
                  )}
                </div>
                <div className="px-2 py-1.5">
                  <p className="text-[11px] text-foreground truncate font-medium">{att.file_name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{att.session_name}</p>
                  <p className="text-[10px] text-muted-foreground">{att.serial} · {new Date(att.created_at).toLocaleDateString()}</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(att.id, att.storage_path); }}
                  className="absolute top-1.5 right-1.5 size-5 rounded bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none hover:bg-destructive/80">
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      <MediaViewer att={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/LibraryPage.jsx
git commit -m "feat: add LibraryPage component"
```

---

### Task 14: Wire Library page into App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Import `LibraryPage`**

Add to the imports block:
```js
import { LibraryPage } from './components/LibraryPage.jsx';
```

- [ ] **Step 2: Add `P.LIBRARY` phase constant**

Find:
```js
const P = { SETUP: 0, FIRE: 1, RESULTS: 2, HISTORY: 3, CMP: 4, EDIT: 5 };
```

Replace with:
```js
const P = { SETUP: 0, FIRE: 1, RESULTS: 2, HISTORY: 3, CMP: 4, EDIT: 5, LIBRARY: 6 };
```

- [ ] **Step 3: Add library filter state**

In the App component state declarations, add:
```js
const [libraryFilterSessionIds, setLibraryFilterSessionIds] = useState(null);
const [hasAttachments, setHasAttachments] = useState(false);
```

- [ ] **Step 4: Check attachment count on data load**

In the `loadAllData` function (Task 6, Step 3), update the `Promise.all` call to also load attachment count:

```js
const [settings, sessions, comparisons, allAtts] = await Promise.all([
  db.getSettings(),
  db.getSessions(),
  db.getComparisons(),
  db.getAttachments(),
]);
// ... existing setters ...
setHasAttachments(allAtts.length > 0);
```

- [ ] **Step 5: Add Library nav item**

Find the `navItems` array (around line 1041). Add:
```js
{ label: "Library", ph: P.LIBRARY, disabled: !hasAttachments, onClick: () => { setLibraryFilterSessionIds(null); setPhase(P.LIBRARY); } },
```

- [ ] **Step 6: Add Library page render block**

After the EDIT phase block (around line 1436), add:

```jsx
// ─── LIBRARY ─────────────────────────────────────────────────────────────────
if (phase === P.LIBRARY) return (
  <AppShell phase={phase} navItems={navItems} sessionCount={log.length} maxW="1200px">
    <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight text-foreground mb-1">Attachment Library</h1>
        <p className="text-sm text-muted-foreground">
          {libraryFilterSessionIds ? `Filtered to ${libraryFilterSessionIds.length} session${libraryFilterSessionIds.length !== 1 ? 's' : ''}` : 'All attachments'}
          {libraryFilterSessionIds && (
            <button onClick={() => setLibraryFilterSessionIds(null)} className="ml-2 text-primary text-xs cursor-pointer bg-transparent border-none hover:underline">Show all</button>
          )}
        </p>
      </div>
    </div>
    <LibraryPage
      log={log}
      vars={vars}
      preFilterSessionIds={libraryFilterSessionIds}
      onError={setDbError} />
    {dbError && (
      <div className="fixed bottom-4 right-4 z-[400] bg-destructive text-white text-sm px-4 py-3 rounded-lg shadow-xl flex items-center gap-3">
        <span>{dbError}</span>
        <button onClick={() => setDbError(null)} className="font-bold opacity-70 hover:opacity-100 cursor-pointer bg-transparent border-none text-white">✕</button>
      </div>
    )}
  </AppShell>
);
```

- [ ] **Step 7: Verify**

Upload an attachment via the Results page Attachments widget. The Library nav item should become enabled. Click Library — the attachment should appear in the grid. Clicking it should open the media viewer.

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add Library page and nav item"
```

---

### Task 15: Add Library links from Results and Compare pages

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add "Library →" button to Results toolbar**

In the RESULTS phase, find the toolbar div (the `<div className="flex justify-end items-center mb-6 flex-wrap gap-2">`). Add a button:

```jsx
<Btn v="secondary" onClick={() => { setLibraryFilterSessionIds([s.id]); setPhase(P.LIBRARY); }}>
  Library →
</Btn>
```

Place it after the "Export CSV" button.

- [ ] **Step 2: Add "Library →" button to Compare toolbar**

In the COMPARE phase, find the right-side toolbar buttons (the `<div className="flex items-center gap-2">`). Add:

```jsx
<Btn v="secondary" onClick={() => {
  const ids = cmpSlots.map(sl => sl.id).filter(Boolean);
  setLibraryFilterSessionIds(ids.length ? ids : null);
  setPhase(P.LIBRARY);
}}>
  Library →
</Btn>
```

- [ ] **Step 3: Verify**

Go to Results for a session that has attachments. Click "Library →". The Library page should open showing only that session's attachments. Go to Compare with 2 sessions selected. Click "Library →". Library should show only attachments from those two sessions. "Show all" link should clear the filter.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add Library navigation links from Results and Compare"
```

---

## Phase 3 — UI Redesign

---

### Task 16: Run frontend-design skill

- [ ] **Step 1: Invoke the skill**

Run the `frontend-design` skill with this context:

> Redesign the Ballistic Workstation app to match Axon's professional brand. Reference: axon.com — black/dark backgrounds, white text, yellow/gold (`#FFDF00`) primary accent, clean bold sans-serif (Geist, already installed), authoritative minimalism.
>
> Current state: React 19 + Vite + Tailwind v4 (no config file). Single-file app in `src/App.jsx` (~2000 lines). Dark theme already in place. Gold primary already `#FFDF00`.
>
> What needs to change: typography hierarchy (Geist as sole font), component polish (cards, buttons, nav, forms, data widgets), spacing consistency, empty state copy, and overall professional feel. The current version looks like a school project — make it look like a product built by a serious company.
>
> Do NOT change: color palette, chart components (D3), data model, feature logic, or component names.

- [ ] **Step 2: Commit the redesign**

After the frontend-design skill completes its changes:

```bash
git add -A
git commit -m "design: Axon brand redesign — typography, components, spacing"
```

---

## Post-Completion Checklist

- [ ] `npm run build` completes with no errors
- [ ] Login screen appears on fresh load (incognito window)
- [ ] Create a session end-to-end: Setup → Fire → Results
- [ ] Session persists after browser refresh
- [ ] Delete a session — gone from Supabase
- [ ] Upload an attachment — appears in Results widget and Library page
- [ ] Library → link from Results pre-filters correctly
- [ ] Saved comparisons persist after refresh
- [ ] Settings (vars, dropdown options, widget layout) persist after refresh
- [ ] Deploy to Vercel: `vercel --prod` or connect GitHub repo in Vercel dashboard
- [ ] Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Vercel environment variables
