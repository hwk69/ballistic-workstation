# Compare View Custom Field Widgets

**Date:** 2026-04-13
**Scope:** Add auto-generated comparison widgets for custom measurement fields in the Compare view.

## Context

The Results page now auto-generates chart widgets for custom fields (NumberFieldChart, DonutChart, FieldBarChart). The Compare view already shows custom field data in two places — the Metrics Table (mean for numbers, yes/no counts) and the Shot Log (all values). But there are no dedicated chart widgets for visually comparing custom fields across sessions.

## Approach

Extend the Compare view's `CMP_WIDGET_DEFS` to dynamically include comparison widgets for common custom fields. Follow the existing "side-by-side, one per session" pattern used by `velCompare` for number and yes/no fields. Use a new grouped bar chart for dropdown fields.

## Widget Generation Rules

Custom comparison widgets are generated from `commonFields` — the intersection of fields across all selected sessions. Only fields shared by all compared sessions get widgets.

| Field Type | Widget | Visualization |
|---|---|---|
| **number** (not fps/x/y) | Side-by-side histograms | Grid of `NumberFieldChart` (histogram mode), one per session in session color. Same layout as `velCompare`. |
| **yesno** | Side-by-side donuts | Grid of `DonutChart`, one per session in session color. Session name label above each. |
| **dropdown** | Grouped bar chart | New `GroupedBarChart` component. X-axis: dropdown options. Each option has one vertical bar per session, colored in session color. Y-axis: count. Legend shows session names. |
| **text** | No widget | — |

### Widget Keys and Labels

- Key: `cmp_custom_{field.key}` (e.g., `cmp_custom_hole_size`)
- Label: `{field.label} Comparison` (e.g., "Hole Size Comparison")
- Requires: `[field.key]`
- Not in default compare layout — users add from the widget dropdown.

## New Component: GroupedBarChart

A D3 vertical grouped bar chart for comparing dropdown field distributions across sessions.

**Props:** `{ sessions, fieldKey, width, options }`

Where `sessions` is an array of `{ name, color, counts }` objects (one per compared session), and `options` is the array of dropdown option strings from the field definition.

**Layout:**
- X-axis: dropdown options, with grouped bars within each option
- Each bar colored in the session's assigned color
- Y-axis: count (integer)
- Legend below showing session name + color swatch
- Bar width: `groupWidth / sessions.length` with small gap between bars in a group
- Follows existing chart styling: `CHART_BG`, `TICK_CLR`, `AXIS_CLR`

## CMP_WIDGET_DEFS Changes

The static `CMP_WIDGET_DEFS` object gains dynamic entries after iteration over `commonFields`:

```js
// After static defs...
const customCmpFields = commonFields.filter(f => !["fps","x","y"].includes(f.key) && f.type !== "text");
for (const f of customCmpFields) {
  CMP_WIDGET_DEFS[`cmp_custom_${f.key}`] = {
    label: `${f.label} Comparison`,
    requires: [f.key],
  };
}
```

## renderWidgetContent Changes

Add handling for `cmp_custom_*` keys. Extract the field definition from `commonFields` using the key suffix, then render based on field type:

**Number fields:** Same grid pattern as `velCompare`:
```jsx
<div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(resolved.length, 3)}, 1fr)` }}>
  {resolved.map(r => (
    <div>
      <div className="text-xs font-semibold mb-2" style={{ color: r.color }}>{r.session.config.sessionName}</div>
      <NumberFieldChart shots={r.shots} fieldKey={f.key} label={f.label} unit={f.unit} width={280} color={r.color} mode="histogram" />
    </div>
  ))}
</div>
```

**Yes/No fields:** Same grid pattern with donuts:
```jsx
<div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(resolved.length, 3)}, 1fr)` }}>
  {resolved.map(r => {
    const fs = r.stats.fieldStats?.[f.key];
    return (
      <div>
        <div className="text-xs font-semibold mb-2" style={{ color: r.color }}>{r.session.config.sessionName}</div>
        <DonutChart yesCount={fs?.yes || 0} noCount={(fs?.total || 0) - (fs?.yes || 0)} total={fs?.total || 0} label={f.label} width={180} color={r.color} />
      </div>
    );
  })}
</div>
```

**Dropdown fields:** Single grouped bar chart:
```jsx
<GroupedBarChart
  sessions={resolved.map(r => ({
    name: r.session.config.sessionName,
    color: r.color,
    counts: r.stats.fieldStats?.[f.key]?.counts || {},
  }))}
  fieldKey={f.key}
  options={f.options || Object.keys(resolved[0]?.stats.fieldStats?.[f.key]?.counts || {})}
  width={w - 8}  /* via AutoSizeChart wrapper */
/>
```

## availableCmpWidgets

The existing filtering logic already checks `CMP_WIDGET_DEFS[k].requires.every(r => commonKeys.has(r))`. Since custom widgets set `requires: [field.key]` and `commonKeys` contains all common field keys, filtering works without changes. The only exception is the `rankings` special case which remains unchanged.

## Out of Scope

- Custom widgets in default compare layout
- Tracking mode for compare (histogram only for numbers)
- Scatter plots between two custom fields
