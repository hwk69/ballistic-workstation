# Unified Fire Page — Live Edit Design

## Summary

Merge the Fire page and Edit page into a single unified Fire page that handles both new sessions and editing existing ones. Eliminates the separate Edit phase, adds inline shot editing to the Fire page, adds a collapsible config editor, and introduces auto-save so data persists immediately.

## Motivation

- The `+ Shots` button deletes and recreates sessions, destroying attachments
- Edit and `+ Shots` do overlapping things on separate pages
- Users want a single workflow: fire, review, fix, add more — all in one place

## Two Modes

### New Session Mode (Setup → Begin Firing)

- `continuingSessionId` is null — no session in DB yet
- First shot recorded triggers `db.saveSession()`, creating the session in DB
- Sets `continuingSessionId` to the new session's ID, adds it to `log`
- From that point, auto-save handles all subsequent changes
- No Abort button — if the user navigates away before recording a shot, nothing is in the DB

### Edit Mode (Results/History → Edit)

- `continuingSessionId` is set to the existing session's ID
- Shots loaded from existing session with real IDs (preserves attachments)
- All changes auto-save immediately
- No Abort button — data is already saved, user just navigates away

Both modes share identical UI.

## Fire Page UI

### Shot Entry Form (existing, unchanged)

- Field inputs generated from session fields
- Record button (Enter to submit)
- Shot count display (current / total)

### Shot Log Table (enhanced)

- Existing columns: #, Serial, field values, Time, Attachment button, Delete button
- **New: Edit button** on each row (next to Delete)
- Clicking Edit switches that row to inline input mode (TblInput fields for each value)
- Save/Cancel buttons on the editing row
- Only one row in edit mode at a time
- Save triggers auto-save to persist immediately
- Row keys use `shot.id || shot.serial` for stability (no index-based keys)

### Collapsible Config Editor (new)

- Below session header, above shot entry form
- Toggle button/chevron labeled "Session Config"
- Collapsed by default in both modes
- When expanded, shows:
  - Session Name, Date, Notes fields
  - Variable values (rifle rate, sleeve type, etc.)
- Changes auto-save with debounce

### Action Buttons

- **"View Results →"** — replaces "Finish Session", just navigates to Results (data already saved)
- **No Abort button** — sessions are deleted from History if needed

## Auto-Save Mechanism

- `useEffect` watches `shots` and `cfg` for changes
- Debounced at ~800ms to batch rapid changes
- Only fires when `continuingSessionId` is set (session exists in DB)
- Calls `db.updateSession(continuingSessionId, { config, shots })`
- Updates the `log` entry in-place after each save
- Save indicator in session header: "Saved" / "Saving..."

### First Shot in New Session Mode

- `addShot` calls `db.saveSession()` instead of just updating local state
- Sets `continuingSessionId` to new session ID
- Adds to `log`
- Auto-save takes over from there

### Inline Shot Edit

- Updated shot array triggers auto-save via the same `useEffect`

## Navigation Changes

### Results Page

- Remove `+ Shots` button
- `Edit` button calls `continueSession(id)` → goes to Fire page

### History Page

- Remove `+ Shots` button
- Existing edit actions go to Fire page

### Nav Bar

- Remove Edit nav item
- Remove `P.EDIT` phase entirely

## Code Removal

The following are deleted:

- `P.EDIT` phase and all Edit page JSX (~150 lines)
- Functions: `openEditSession`, `saveEditSession`, `esAddShot`, `esSaveEdit`, `esDelShot`, `esStartEdit`
- State: `esCfg`, `esShots`, `esNewShot`, `esShotEdit`, `esShotEditVal`
- Derived: `esStats`, `esFieldSet`, `esHasXY`, `esValid`

## Code Changes

- `continueSession` — no longer deletes session, just loads state and sets `continuingSessionId`
- `finishSession` — becomes simple navigation to Results
- `newSession` — resets `continuingSessionId` to null
- Fire page shot log — add Edit/Save/Cancel per-row
- Fire page — add collapsible config editor section
- Fire page — add auto-save useEffect with debounce
- Fire page — add save indicator ("Saved" / "Saving...")

## Edge Cases

- **Navigating away mid-edit:** Auto-saved, no data loss, no warning needed
- **Attachments before first save:** Queued via `pendingAttachments`, uploaded in the initial `saveSession` call (existing flow)
- **Deleting a shot:** Removed locally, auto-save persists the change
- **Shot count limit:** `shots.length >= total` check still applies; user can change shot count via config section
- **No Abort:** Users delete sessions from History if needed
