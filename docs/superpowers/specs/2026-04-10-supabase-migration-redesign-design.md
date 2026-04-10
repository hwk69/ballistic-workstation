# Ballistic Workstation — Supabase Migration, Attachment Feature & UI Redesign

**Date:** 2026-04-10  
**Status:** Approved  

---

## Overview

Migrate Ballistic Workstation from a localStorage-only single-user app to a Supabase-backed, Vercel-deployed team tool. A single shared account provides access control. All sessions, shots, comparisons, settings, and file attachments are stored in Supabase. The UI is redesigned to match Axon's professional brand aesthetic.

Existing localStorage data does not need to be migrated — the team will start fresh.

---

## Phase 1 — Supabase Backend Migration

### Authentication

- Single shared Supabase email/password account
- On app load, check Supabase auth session. If not authenticated, render a full-screen login form (email + password). Nothing else renders until authenticated.
- `signIn`, `signOut` via Supabase Auth JS client
- Supabase URL and anon key stored as Vite env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- No per-user scoping — all authenticated users see and share the same data

### Data Layer

Replace the two localStorage helpers (`ld` / `sv`) with a Supabase JS client. All reads/writes go through a thin data-access module (`src/lib/db.js`) that wraps Supabase calls. React state management in `App.jsx` stays the same shape — only the persistence layer changes.

Concurrent edits: no real-time sync. Team members refresh manually. The app does not push updates to other open tabs. No data is lost on refresh because all state is persisted to Supabase immediately on change (same pattern as the current localStorage writes).

### Database Schema

All tables are in the public schema. Row-level security (RLS) is enabled on all tables with a single policy: `auth.uid() IS NOT NULL` allows all operations. Since there is one shared account, no per-user row filtering is needed.

**`sessions`**
```sql
id          uuid        PRIMARY KEY DEFAULT gen_random_uuid()
name        text
config      jsonb       -- rifleRate, sleeveType, tailType, combustionChamber, load22,
                        --   shotCount, notes, sessionName, date + any custom vars
created_at  timestamptz DEFAULT now()
```

**`shots`**
```sql
id          uuid        PRIMARY KEY DEFAULT gen_random_uuid()
session_id  uuid        REFERENCES sessions(id) ON DELETE CASCADE
serial      text
x           float
y           float
fps         float
weight      float
timestamp   text
```

**`attachments`**
```sql
id           uuid        PRIMARY KEY DEFAULT gen_random_uuid()
shot_id      uuid        REFERENCES shots(id) ON DELETE CASCADE
session_id   uuid        REFERENCES sessions(id) ON DELETE CASCADE  -- denormalized
file_name    text
file_url     text        -- Supabase Storage signed/public URL
file_type    text        -- MIME type (image/*, video/*, application/pdf, etc.)
file_size    int         -- bytes
created_at   timestamptz DEFAULT now()
```

**`comparisons`**
```sql
id          uuid        PRIMARY KEY DEFAULT gen_random_uuid()
title       text
data        jsonb       -- { slots, filters, by, metrics, widgets } — same shape as today
created_at  timestamptz DEFAULT now()
```

**`app_settings`**
```sql
id      int         PRIMARY KEY DEFAULT 1  -- always a single row
opts    jsonb       -- dropdown option lists
vars    jsonb       -- custom variable definitions
layout  jsonb       -- widget layout, dispOpts, cmpWidgets, cmpMetrics
```
Single-row upsert pattern: `INSERT ... ON CONFLICT (id) DO UPDATE SET ...`

### Supabase Storage

- Bucket name: `attachments`
- Bucket access: private (signed URLs, valid for 1 hour, refreshed on view)
- Upload path: `{session_id}/{shot_id}/{filename}`
- Max file size enforced client-side: warn (not block) if video > 500MB

### Data Access Module (`src/lib/db.js`)

Thin wrapper exporting async functions matching the current read/write surface:

```
getSessions()          → sessions[] with shots[]
saveSession(session)   → upsert session + shots
deleteSession(id)
getSettings()          → { opts, vars, layout }
saveSettings(patch)    → upsert app_settings row 1
getComparisons()       → comparisons[]
saveComparison(data)
deleteComparison(id)
uploadAttachment(file, shotId, sessionId) → attachment row
getAttachments(filters)  → attachments[]
deleteAttachment(id)
```

---

## Phase 2 — Attachment Feature

### Attachment Widget (Results Page)

A new widget `attachments` added to `WIDGETS`:
- Label: "Attachments"
- Default: off
- Renders a grid of file cards for all shots in the current session, grouped by shot serial
- Each card: thumbnail (images) or file-type icon + filename (videos/docs), shot serial label, file size
- "+ Add File" button opens native file picker (any file type), uploads to Supabase Storage, inserts `attachments` row
- Delete button (×) on each card removes from Storage and DB
- Clicking an image opens it fullscreen in an overlay; clicking a video plays it inline in the overlay

### Library Page (`P.LIBRARY`)

New top-level page, added to nav as "Library". Phase constant `P.LIBRARY = 6` (appended after existing `P.EDIT = 5` — no renumbering needed).

**Layout:**
- Filter bar at top — filter chips for each session variable (rifle rate, sleeve type, etc.) + date range picker. Same chip pattern used on History page.
- Attachment grid below — cards showing preview thumbnail (images) or type icon (video/doc), filename, session name, shot serial, date
- Clicking a card opens fullscreen viewer/player overlay

**Pre-filtering via navigation:**
- Results page: "Library →" button in widget toolbar navigates to `P.LIBRARY` with a pre-applied filter scoped to the current session's `id` — shows only that session's attachments
- Compare page: "Library →" button navigates to `P.LIBRARY` pre-filtered to show attachments belonging to any of the sessions currently in the comparison slots

### Nav Update

Add "Library" tab to `AppNavBar`. Disabled state: when no attachments exist yet (zero rows in `attachments` table, checked on load).

---

## Phase 3 — UI Redesign

### Brand Reference

Axon (axon.com): black/dark backgrounds, white text, yellow/gold primary accent, clean bold sans-serif, authoritative minimalism. The current app's color tokens (`#FFDF00` primary, dark BG) already align — this phase is about execution quality, not a rebrand.

### Typography

- Use `Geist` (already installed via `@fontsource-variable/geist`) as the sole typeface
- Clear hierarchy: bold 22–28px section headers, 14px medium labels, 12px monospace for data values
- Consistent uppercase tracking for section labels (already present, keep it)

### Component Overhaul

- **Cards** — sharper, more intentional. Consistent border weight. Remove redundant `rounded-xl` where it makes things look toy-like. Use subtle left-border accents (already done on SB cards — extend this pattern).
- **Buttons** — three clear tiers: primary (gold fill), secondary (outline), ghost. Nothing ambiguous.
- **Nav** — cleaner top bar. Gold active state. Session count badge styled more intentionally. Axon wordmark or crosshair icon positioned with more authority.
- **Forms** — Setup/Fire page inputs tightened. Labels clearly separated from inputs. Better visual grouping.
- **Data widgets** — Widget headers use a single consistent style. Metrics grid feels like a professional dashboard, not a homework assignment.
- **Spacing** — Audit every `p-6` / `px-4` for consistency. Define a spacing scale and use it throughout.
- **Empty states** — Rewrite placeholder copy to be professional and on-brand.

### Implementation

Phase 3 is implemented using the `frontend-design` skill, with axon.com provided as the brand reference. The skill is invoked after Phase 2 is complete and all data/feature work is stable.

---

## Error Handling

- **Upload failure** — show inline error on the attachment card, retry button
- **Auth failure** — redirect to login screen, do not lose any in-memory state if possible
- **DB write failure** — show a toast error, do not clear UI state (user can retry)
- **Session not found** (e.g., deleted by teammate) — graceful redirect to History page with a message

---

## Out of Scope

- Per-user accounts or individual data ownership
- Real-time collaborative editing
- Offline mode
- Attachment versioning
- Search within attachment contents
