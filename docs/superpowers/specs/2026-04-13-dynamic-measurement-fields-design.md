# Dynamic Measurement Fields

**Date:** 2026-04-13
**Scope:** Make the Setup and Fire pages configurable so users can define what data gets recorded per shot, enabling different test types (ballistic accuracy, spearhead penetration, etc.)

## Context

Currently every session records the same four hardcoded shot fields: FPS (required), X (required), Y (required), Weight (optional). The stats engine, charts, and widgets are all built around this shape. This doesn't work for test types like spearhead testing, which measures attainment, hole size, and tear size — none of which map to x/y/fps.

## Approach

Separate "measurement fields" (per-shot data) from "config variables" (session-level metadata like rifle rate, sleeve type). Introduce a `fields` array that defines what gets recorded per shot. The current four fields become the default set, but all are optional and removable. Users can add new fields of four types: number, yes/no, text, and dropdown.

## Data Model

### Measurement Field Definition

```js
{
  key: "fps",          // unique identifier, auto-generated kebab-case from label
  label: "FPS",        // display name
  type: "number",      // "number" | "yesno" | "text" | "dropdown"
  required: true,      // must be filled to record a shot
  options: [],         // for "dropdown" type only, e.g. ["Pass", "Fail", "Partial"]
  unit: "fps",         // optional display unit, only for "number" type
}
```

### Default Fields

When creating a new session, these fields are pre-populated (all removable):

| Key | Label | Type | Required | Unit |
|-----|-------|------|----------|------|
| `fps` | FPS | number | yes | fps |
| `x` | X | number | yes | in |
| `y` | Y | number | yes | in |
| `weight` | Weight | number | no | g |

Users can remove any of these and add custom fields before starting a session.

### Shot Data Shape

Measurement values move from dedicated properties into a generic `data` object:

```js
{
  serial: "SP1-03 1-6RR 03",
  shotNum: 1,
  timestamp: "14:32",
  data: {
    fps: 188,
    x: -2,
    y: -8,
    weight: 117.5,
  }
}
```

Spearhead example:
```js
{
  serial: "SH-01 03",
  shotNum: 1,
  timestamp: "14:32",
  data: {
    attainment: true,
    hole_size: 12.5,
    tear_size: 3.2,
  }
}
```

### Session Config

Each session's `config` object gets a `fields` array snapshotted at session creation time. This ensures the Results page knows what fields a session was recorded with, even if the user changes their defaults later.

```js
session.config = {
  rifleRate: "1-6",
  sleeveType: "Brass (14.65)",
  // ... other config vars ...
  fields: [
    { key: "fps", label: "FPS", type: "number", required: true, unit: "fps" },
    { key: "x", label: "X", type: "number", required: true, unit: "in" },
    // ...
  ]
}
```

## Setup Page

### New "Measurement Fields" Card

Added between the Configuration card and Session Details card. Displays the current `fields` list. Each field shows as a row with:

- Label (e.g. "FPS")
- Type badge (number / yes·no / text / dropdown)
- Required indicator
- Remove button (×)

Below the list, an **"+ Add Field"** button expands an inline form:

- **Name** — text input (becomes `label`; `key` auto-generated as kebab-case)
- **Type** — dropdown: Number, Yes/No, Text, Dropdown
- **Required** — checkbox
- **Options** — only visible when type is "Dropdown", add-one-at-a-time pattern (same as SmartSelect)
- **Unit** — optional text input, only visible when type is Number
- **Add** / **Cancel** buttons

Fields are persisted to `app_settings.fields` so defaults are remembered across sessions. When a session begins, the current fields are snapshotted into `session.config.fields`.

### Existing Cards

- **Configuration** card — unchanged (config variables)
- **Session Details** card — unchanged (name, date, notes)
- Variable management (+ Add Variable) — unchanged, manages config variables only

## Fire Page

### Dynamic Shot Entry Form

The shot entry form is dynamically generated from the session's `fields` array instead of being hardcoded. Each field renders based on its `type`:

| Field Type | Input Control |
|-----------|---------------|
| `number` | `<input type="number">` with `inputmode="decimal"` |
| `yesno` | `<select>` with options: —, Yes, No |
| `text` | `<input type="text">` |
| `dropdown` | `<select>` populated from `field.options` |

**Layout:** Same responsive grid as today (`grid-cols-2 sm:grid-cols-4`). More than 4 fields wrap naturally.

**Validation:** Required fields must have values to enable the Record button. Required fields show an asterisk in their label.

**Auto-clear behavior:** After recording, all fields clear. Number fields retain their value across shots (same as current Weight behavior) to speed up repeated entries.

**Shot count and progress:** Unchanged — set in Setup, progress counter works the same.

### Live Charts During Fire

Adapts based on which fields are present:

- **X + Y fields present:** show live DispersionChart and accuracy stats (CEP, R90, etc.)
- **FPS field present:** show velocity stats (mean, SD, ES)
- **Neither X/Y nor FPS:** show a live shot table with recorded fields plus a count
- **Running Stats card:** shows whatever summary stats are computable from the fields present

## Results Page & Stats Engine

### Dynamic Stats Computation

Replace the hardcoded `calcStats` with a dynamic engine that computes stats based on field types:

- **Number fields:** mean, SD, min, max, ES (extreme spread = max − min)
- **Yes/No fields:** count of Yes, count of No, percentage Yes
- **Dropdown fields:** count per option
- **Text fields:** no stats

**Special accuracy stats (CEP, R90, MPI, covariance ellipse):** Computed only when both `x` and `y` fields are present. The engine checks for fields with keys `x` and `y`.

### Widget Visibility

Widgets conditionally appear based on available fields:

| Widget | Requires |
|--------|----------|
| Dispersion chart | `x` + `y` |
| Velocity histogram | `fps` |
| FPS vs Radial | `fps` + `x` + `y` |
| Radial Tracking | `x` + `y` |
| FPS Tracking | `fps` |
| X/Y Deviation | `x` + `y` |
| Key Metrics | always — shows available stats |
| Shot Table | always — shows all fields |
| Attachments | always |

Widgets without their required fields are excluded from the widget registry for that session — they don't appear in the "Add Widget" dropdown and aren't in the default layout.

### Key Metrics Widget

Renders dynamically:

1. **Accuracy stats** (if x + y present): CEP, R90, MPI, SD X, SD Y, Ext Spread
2. **Per number field:** Mean, SD, ES (e.g. "Mean Hole Size: 12.3 mm")
3. **Per yes/no field:** count and percentage (e.g. "Attainment: 8/10 (80%)")
4. **Per dropdown field:** count per option
5. **Text fields:** not shown in metrics

## Compare View

- Sessions that share common measurement fields can be compared. Widgets only render when compared sessions share the relevant fields.
- The metrics comparison table dynamically shows metrics for fields common across all selected sessions.
- If no fields overlap between selected sessions: "Selected sessions have no common measurement fields to compare."
- Session picker unchanged.

## Database Migration

### Schema Changes

- **`shots` table:** Add `data JSONB` column (nullable, default null)
- **`app_settings` table:** Add `fields JSONB` column for default field definitions

### Migration Strategy

**One-time backfill:** Populate `data` from dedicated columns for existing shots:
```sql
UPDATE shots SET data = jsonb_build_object(
  'fps', fps, 'x', x, 'y', y, 'weight', weight
) WHERE data IS NULL;
```

**On load (app layer fallback):**
- If a session's config has no `fields` array: inject the default four-field definition
- If a shot has no `data` object: construct from dedicated columns `{ fps, x, y, weight }`

**Dedicated columns (`fps`, `x`, `y`, `weight`):** Kept in place, not dropped. New sessions write to `data` JSONB only. Old sessions continue to work via the app-layer fallback.

## Out of Scope

- Session templates (save/load named field configurations) — easy to add later
- Custom chart types for custom fields (e.g. scatter plots of hole size vs tear size)
- Touch-friendly mobile optimizations for the dynamic form
- Bulk field import/export
