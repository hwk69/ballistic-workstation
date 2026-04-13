# Compare Session Picker Redesign

**Date:** 2026-04-13
**Scope:** Replace the Compare view's chip-wall session picker with a clean "Add Session" button and searchable dropdown.

## Context

The Compare view currently shows all sessions as toggleable chips the moment you navigate to it. With many sessions, this is overwhelming. The "Comparing by" variable filter and filter chips add complexity without proportional value. Users need a calmer entry point that lets them either search for specific sessions or scroll a well-organized list.

## What Changes

### Removed

- **`cmpPickerOpen` state** — no more collapsible panel
- **`cmpBy` state** — "Comparing by" variable filter dropdown is removed
- **`cmpFilters` state** — filter chips are removed
- **`cmpHoverTip` state** — hover tooltip on session chips is removed
- **The `useEffect` that auto-deselects sessions when `cmpFilters` change** (lines 1776-1783)
- **The entire session chips grid** — the `filteredLog.map(...)` that renders all sessions as toggleable pill buttons
- **The collapsible "Sessions — N selected" panel** wrapping the chips

### Added

- **`cmpDropdownOpen` state** (`boolean`, default `false`) — controls whether the Add Session dropdown is visible
- **`cmpSearch` state** (`string`, default `""`) — the search text inside the dropdown

### Changed

- **`cmpSlots` initial value** — changes from `[{ id: null, color: PALETTE[0] }, { id: null, color: PALETTE[1] }]` to `[]` (empty array). The old design pre-allocated two empty slots for the chip picker; the new design starts empty and adds slots on demand via the dropdown.

### Kept As-Is

- `cmpSlots` — same `[{ id, color }]` structure (just different initial value)
- Color picker on each selected session in the strip
- All comparison widgets (overlay, metrics, rankings, custom widgets, etc.)
- Save/load/delete comparison functionality
- `cmpTitle`, `cmpMetrics`, `cmpLayout`, `cmpSplit`, `cmpDispOpts`, `cmpMetricsOpen`

## UI Layout

The Compare page header area becomes:

### 1. Selected Sessions Strip

A horizontal flex-wrap row showing the currently selected sessions. Each selected session shows:
- A color dot (using the session's assigned PALETTE color)
- Session name (truncated to ~120px)
- ColorPicker component (same as current)
- ✕ button to remove

After the last selected session: an **"+ Add"** button styled as a secondary/ghost button.

When no sessions are selected: just the "+ Add" button with helper text "Add sessions to compare".

A **"Clear all"** link appears at the end of the strip when 2+ sessions are selected.

### 2. Add Session Dropdown

Opens below the "+ Add" button when clicked. Implemented as a positioned popover/overlay.

**Search input:** Text input at the top, auto-focused on open. Placeholder: "Search by name, date, or variable…"

**Session list:** Scrollable list below the input, max-height 300px. Shows all sessions from `log` that are NOT already in `cmpSlots`, sorted by date (newest first). Each row shows:
- **Session name** (bold, left-aligned)
- **Date** (muted text, right-aligned on same line)
- **Variable values** on a second line in small muted text, formatted as "value · value · value" from the session's variable config values (e.g., "1-8 · Steel · Tapered")

**Search behavior:** Case-insensitive substring matching against:
- Session name (`s.config.sessionName`)
- Formatted date string (e.g., "4/13/2026" or "Apr 13")
- All variable values from `s.config` (matched against each `vars` key's value)

When the search input is empty, the full list is shown (scrollable).

When search has no matches: show "No sessions found" muted text.

**Selection:** Clicking a row adds the session to `cmpSlots` with the next auto-assigned PALETTE color, clears the search, and closes the dropdown.

**Dismissal:** Clicking outside the dropdown or pressing Escape closes it and clears the search.

## Save/Load Comparison Adjustments

**Saving:** The `saveComparison` call no longer passes `filters` or `by`. Change to: `saveComparison(cmpTitle, cmpSlots, {}, "", cmpMetrics, cmpLayout)`. The DB schema already stores these as part of the `data` JSONB — passing empty values is backward-compatible.

**Loading:** `loadComparison` currently sets `cmpFilters` and `cmpBy` from the saved data. These state variables are removed, so those lines are deleted. The function still sets `cmpSlots`, `cmpTitle`, `cmpMetrics`, and `cmpLayout` as before.

## CMP Phase Reset

The existing reset on entering CMP (`useEffect` at line 1854) currently resets `cmpDispOpts` and `cmpTitle`. Add resetting `cmpDropdownOpen` to false and `cmpSearch` to "".

The existing `navItems` onClick for Compare currently resets `cmpSlots` to `[]`. This is kept — user starts fresh with an empty strip and the "+ Add" button.

## Out of Scope

- Persisting the "Comparing by" filter (it's being removed entirely)
- Multi-select in the dropdown (add one at a time — keeps it simple)
- Keyboard navigation in the dropdown list (arrow keys, enter to select)
- Grouping or sorting options in the dropdown (always newest-first)
