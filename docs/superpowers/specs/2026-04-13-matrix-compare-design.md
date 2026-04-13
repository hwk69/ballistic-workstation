# Matrix Compare

**Date:** 2026-04-13
**Scope:** Add a Matrix Compare tab that displays a 2D grid of sessions organized by two user-selected variables, with color-coded metric cells and click-to-expand detail.

## Context

The user runs structured test campaigns where sessions vary across two dimensions (e.g., Sleeve Type × Tail Type). The existing Compare view shows flat session-to-session comparisons but can't visualize a full test matrix. The Matrix Compare tab lets users pick any two variables as axes and instantly see which combination performed best.

## Navigation

New **MATRIX** tab in the top nav menu. New phase constant `P.MATRIX = 7`. Accessible to all users (no preconditions). The nav item shows alongside the existing tabs (SETUP, FIRE, RESULTS, HISTORY, COMPARE, EDIT, LIBRARY).

## Page Layout

The Matrix page has three sections:

### 1. Axis Picker (top bar)

Two dropdowns side by side:
- **Row Variable** — populated from the user's `vars` array (Rifle Rate, Sleeve Type, Tail Type, etc.)
- **Column Variable** — same list, excluding the one selected as Row Variable

A **Metric** dropdown to the right of the axis pickers:
- Standard metrics: CEP (50%), R90, Mean Radius, Ext. Spread, SD X, SD Y, Mean FPS, SD FPS, ES FPS — filtered to only include metrics that at least one matched session supports (based on session fields having x/y for accuracy metrics, fps for velocity metrics)
- Custom field stats: For each common custom field across matched sessions:
  - Number fields: "Mean {label}" (e.g., "Mean Hole Size")
  - Yes/No fields: "{label} %" (e.g., "Attainment %")
  - Dropdown fields: not shown as a single metric (they don't reduce to one number)

Default metric: CEP (50%) if accuracy fields exist, otherwise Mean FPS if velocity exists, otherwise the first available custom number field.

**Metric key format:** Standard metrics use their stat key (e.g., `"cep"`, `"meanV"`). Custom number fields use `"fieldMean:{key}"` (e.g., `"fieldMean:hole_size"`). Yes/No fields use `"fieldPct:{key}"` (e.g., `"fieldPct:attainment"`).

### 2. The Grid

A table where:
- **Row headers** (left column): unique values of the Row Variable found across all sessions in `log` (e.g., "Steel", "Aluminum", "Plastic")
- **Column headers** (top row): unique values of the Column Variable found across all sessions in `log`
- **Cells**: display the selected metric value for the session(s) matching that row/column combination

**Cell contents:**
- Large text showing the metric value (e.g., "0.42 in", "285.3 fps", "80%")
- Small text below showing session count if multiple sessions were averaged: "2 sessions"
- Background color: green-to-red gradient based on rank across all populated cells
  - For `LOWER_BETTER` metrics (CEP, R90, SD, Ext. Spread): lower value = greener
  - For all other metrics (Mean FPS, yes/no percentage, custom number means): higher value = greener
  - Use opacity-based coloring: best cell gets strong green tint, worst gets strong red tint, others interpolated
- Empty cells (no matching session): show "—" with a muted/neutral background, no color coding

**Multiple sessions per cell:** When more than one session matches a row/column combination, stats are averaged:
- Numeric stats (CEP, R90, Mean FPS, SD FPS, custom number means, etc.): arithmetic mean of the values across sessions
- Yes/No fields: average the percentages across sessions
- The cell shows the averaged value with a small "N sessions" label

**Row/column ordering:** Values are sorted alphabetically. If the values look numeric (e.g., "1-6", "1-8"), sort numerically by the first number.

### 3. Detail Panel

Clicking a populated cell opens a detail panel below the grid showing:
- Session name, date, shot count (or "Average of N sessions" if multiple)
- Full stat block: all standard metrics (accuracy + velocity) + all custom field stats
- Each stat shown as label + value, similar to the Key Metrics widget layout
- A "View Session" button that navigates to that session's Results page (if single session)
- Click again or click another cell to switch. Click the same cell to close.

If the cell represents averaged data from multiple sessions, the detail panel shows:
- The averaged stats
- A list of the contributing session names with dates
- No "View Session" button (since it's multiple sessions)

## State

New state variables in App():
```
const [matrixRowVar, setMatrixRowVar] = useState(null);    // key of row variable
const [matrixColVar, setMatrixColVar] = useState(null);    // key of column variable  
const [matrixMetric, setMatrixMetric] = useState(null);    // selected metric key
const [matrixDetail, setMatrixDetail] = useState(null);    // { row, col } of expanded cell, or null
```

These are local state only — not persisted to the database. The matrix is computed fresh from `log` + `vars` each render.

## Data Flow

1. User selects Row Variable and Column Variable from dropdowns
2. Extract unique values: `rowValues = [...new Set(log.map(s => s.config[rowVar]).filter(Boolean))]`, same for columns
3. Build a lookup map: `grid[rowVal][colVal] = [array of matching sessions]`
4. For each cell, compute stats:
   - Single session: use `session.stats` directly, plus `session.stats.fieldStats` for custom fields
   - Multiple sessions: average the numeric stat values, average yes/no percentages
   - No sessions: null (empty cell)
5. Build the metric options list by scanning fields across all sessions that appear in the grid
6. Color-code cells by ranking the selected metric value across all populated cells

## Averaging Logic

For a cell with N matching sessions:

**Standard numeric stats** (cep, r90, mr, es, sdX, sdY, sdR, mpiX, mpiY, meanV, sdV, esV):
```js
averagedStat = sessions.reduce((sum, s) => sum + s.stats[key], 0) / sessions.length
```

**Custom number field stats** (mean, sd, es):
```js
averagedMean = sessions.reduce((sum, s) => sum + (s.stats.fieldStats?.[fieldKey]?.mean || 0), 0) / sessions.length
```

**Yes/No field stats:**
```js
averagedPct = sessions.reduce((sum, s) => sum + (s.stats.fieldStats?.[fieldKey]?.pct || 0), 0) / sessions.length
```

## Color Coding

Use a simple rank-based approach across all populated cells:

1. Collect all non-null metric values from the grid
2. Sort them (ascending for LOWER_BETTER, descending for others)
3. Map each cell's position in the ranking to a color:
   - Rank 1 (best): `rgba(34, 197, 94, 0.25)` (green tint)
   - Rank last (worst): `rgba(239, 68, 68, 0.25)` (red tint)
   - Interpolate between green and red for middle ranks
4. Empty cells: `rgba(255, 255, 255, 0.03)` (neutral)

## Out of Scope

- Persisting matrix axis selections to database
- Exporting the matrix as an image
- More than two axes (3D matrix)
- Custom row/column ordering (always auto-sorted)
- Filtering sessions by date range or other criteria before building the matrix
