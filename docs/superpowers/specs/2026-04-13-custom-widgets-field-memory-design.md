# Custom Field Widgets & Field Memory

**Date:** 2026-04-13
**Scope:** Auto-generate chart widgets for custom measurement fields, and remember custom field definitions for quick reuse in future sessions.

## Context

The Dynamic Measurement Fields system (Phases 1–4) lets users define custom per-shot fields. However, custom fields only show stats in Key Metrics — they don't get their own chart widgets. Users also have to re-enter custom field definitions from scratch each session because the preset dropdown only contains the 4 standard fields (FPS, X, Y, Weight).

## Feature 1: Auto-Generated Widgets

### Approach

Replace the static `WIDGETS` object with a `buildWidgets(sessionFields)` function that returns the standard widget set plus dynamically generated widgets for each custom field. The existing `availableWidgets` filtering (checking `requires` arrays against session field keys) stays unchanged — it just operates on the expanded registry.

### Widget Generation Rules

| Field Type | Widget | Chart Component |
|-----------|--------|-----------------|
| **number** (not fps/x/y) | Combined tracking + histogram with toggle | `NumberFieldChart` |
| **yesno** | Donut chart (Yes vs No) | `DonutChart` |
| **dropdown** | Horizontal bar chart (count per option) | `BarChart` |
| **text** | No widget | — |

All auto-generated widgets:
- Key: `custom_{field.key}` (e.g., `custom_hole_size`)
- Label: `{field.label} Chart` (e.g., "Hole Size Chart")
- Requires: `[field.key]`
- Default: `false` (user adds from the Add Widget dropdown)

### New Chart Components

#### NumberFieldChart

A combined tracking chart and histogram for custom number fields, toggled via a button inside the widget.

**Tracking mode (default):** D3 line chart — value over shot number. Same layout and styling as `FpsTrack`: monotone curve, dot per shot, mean dashed line, hover tooltip showing shot # and value with unit. Axes: shot # (x), field value (y).

**Histogram mode:** D3 bar chart — distribution of values. Same layout and styling as `VelHist`: vertical bars, bin count on y-axis, value range on x-axis.

**Toggle:** A small button group at top of widget: "Tracking" | "Distribution". Uses existing `Toggle` pattern but as a mode switch.

**Props:** `{ shots, fieldKey, label, unit, width, color }`

The component extracts values via `shots.map(s => (s.data || s)[fieldKey])`, filtering nulls/undefined/NaN. Needs at least 2 shots to render either chart.

#### DonutChart

D3 arc chart for yes/no fields. Two slices (Yes and No), each labeled with count and percentage. Color: Yes uses the widget accent color, No uses a muted gray.

**Props:** `{ yesCount, noCount, total, label, width, color }`

Centered text showing the percentage (e.g., "80%"). Legend below showing "Yes: 8" and "No: 2".

#### BarChart

D3 horizontal bar chart for dropdown fields. One bar per option, labeled with option name and count. Bars sorted by count descending. Color: widget accent color with decreasing opacity per bar.

**Props:** `{ counts, total, label, width, color }`

Where `counts` is `{ optionName: count, ... }` from `fieldStats`.

### Widget Registry Changes

```js
// Before (static)
const WIDGETS = { dispersion: {...}, velHist: {...}, ... };

// After (dynamic)
function buildWidgets(sessionFields) {
  const base = { dispersion: {...}, velHist: {...}, ... };  // same static widgets
  if (!sessionFields) return base;

  for (const f of sessionFields) {
    // Skip built-in fields that already have dedicated widgets
    if (["fps", "x", "y"].includes(f.key)) continue;
    // Skip text fields (no meaningful visualization)
    if (f.type === "text") continue;

    const wKey = `custom_${f.key}`;

    if (f.type === "number") {
      base[wKey] = {
        label: `${f.label} Chart`,
        default: false,
        requires: [f.key],
        render: (s, vs, st, opts, toggle, setOpt) => (
          <AutoSizeChart render={(w) => (
            <NumberFieldChart
              shots={vs} fieldKey={f.key} label={f.label}
              unit={f.unit} width={w - 8} color={opts.color || G}
              mode={opts.chartMode || "tracking"}
              onModeChange={m => setOpt("chartMode", m)}
            />
          )} />
        ),
      };
    }

    if (f.type === "yesno") {
      const fs = st.fieldStats?.[f.key];
      base[wKey] = {
        label: `${f.label} Chart`,
        default: false,
        requires: [f.key],
        render: (s, vs, st, opts) => (
          <DonutChart
            yesCount={st.fieldStats?.[f.key]?.yes || 0}
            noCount={(st.fieldStats?.[f.key]?.total || 0) - (st.fieldStats?.[f.key]?.yes || 0)}
            total={st.fieldStats?.[f.key]?.total || 0}
            label={f.label} color={opts.color || G}
          />
        ),
      };
    }

    if (f.type === "dropdown") {
      base[wKey] = {
        label: `${f.label} Chart`,
        default: false,
        requires: [f.key],
        render: (s, vs, st, opts) => (
          <BarChart
            counts={st.fieldStats?.[f.key]?.counts || {}}
            total={st.fieldStats?.[f.key]?.total || 0}
            label={f.label} color={opts.color || G}
          />
        ),
      };
    }
  }

  return base;
}
```

### Consumers

Every place that references `WIDGETS` or `DEF_LAYOUT` needs to use the dynamic registry:

- **Results page:** `const widgets = buildWidgets(sf);` then `availableWidgets = Object.keys(widgets).filter(...)` — already filters by `requires`
- **Fire page live charts:** No change needed — Fire page renders charts inline based on field presence, not from the widget registry
- **Compare view:** `buildWidgets(commonFields)` — generates widgets only for fields common across compared sessions
- **Add Widget dropdown:** Populated from `availableWidgets`, which now includes custom widget keys
- **DEF_LAYOUT:** Still `Object.keys(widgets).filter(k => widgets[k].default)` — custom widgets have `default: false`, so they don't auto-appear. Users add them manually.
- **Layout persistence:** Saved layouts may contain `custom_*` keys. If a later session doesn't have that field, the key is filtered out by `activeLayout = layout.filter(k => availableWidgets.includes(k))`, which already handles this.

## Feature 2: Field Memory

### Approach

Accumulate custom field definitions in `app_settings.custom_presets`. When a user creates a custom field, its definition is saved automatically. The preset dropdown shows both built-in and custom presets.

### Data Model

```js
// Stored in app_settings.custom_presets (JSONB)
[
  { key: "hole_size", label: "Hole Size", type: "number", required: false, unit: "mm", options: [] },
  { key: "tear_size", label: "Tear Size", type: "number", required: false, unit: "mm", options: [] },
  { key: "attainment", label: "Attainment", type: "yesno", required: true, unit: "", options: [] },
]
```

Same shape as a measurement field definition. No new database columns needed — `custom_presets` is a new key on the existing `app_settings` row, handled by the existing `getSettings` / `saveSettings` functions.

### State

```js
const [customPresets, setCustomPresets] = useState([]);
```

Loaded from `settings.custom_presets` on mount (alongside fields, opts, vars, layout). Persisted via `saveSettings({ custom_presets: updated })` whenever a new custom preset is added.

### Accumulation Logic

In the `addField` handler inside `MeasurementFieldsCard`, after adding the field to the session's fields array:

1. Check if the field's key matches any built-in preset (FPS, X, Y, Weight) — if so, skip (it's already in the dropdown).
2. Check if the field's key already exists in `customPresets` — if so, skip (already saved).
3. Otherwise, append the field definition to `customPresets` and persist.

### Dropdown UI Changes

The preset dropdown in `MeasurementFieldsCard` currently shows:

```
FPS
X
Y
Weight
Custom...
```

Updated to show:

```
── Standard ──
FPS
X
Y
Weight
── Saved ──         (only if customPresets has entries)
Hole Size
Tear Size
Attainment
──
Custom...
```

Implementation: `<optgroup>` elements for visual grouping. Both standard and custom presets are filtered to exclude fields already in the session. The "Saved" group only appears if there are custom presets that aren't already in the session.

When a custom preset is selected, it auto-fills name, type, required, unit, and options — same behavior as selecting a standard preset today.

### MeasurementFieldsCard Props

Add two new props:
- `customPresets` — the array of saved custom field definitions
- `onAddCustomPreset` — callback to save a new custom preset

The parent component handles persistence (same pattern as `onUpdate` for fields).

## Out of Scope

- Preset management UI (edit, delete, reorder custom presets)
- Custom chart types (scatter plots of field A vs field B)
- Auto-generated widgets appearing in default layout
- Custom widget sizing/positioning preferences
