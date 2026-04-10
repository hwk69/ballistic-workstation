# Compare Page — Zone Layout Design Spec

**Goal:** Replace react-grid-layout with a simple three-zone CSS flexbox layout on the Compare page. Widgets are assigned to a zone (main, sidebar, or full-width) via a button in each widget's header. No drag-and-drop. Column split between main and sidebar is toggled via a toolbar preset.

---

## Layout Structure

```
[ Main zone (left)     ] [ Sidebar zone (right) ]
                         [ Sidebar widget 2     ]
[ Full-width widget                             ]
[ Full-width widget 2                           ]
```

The main + sidebar row is a flex row with `align-items: stretch`. Both columns are exactly the same height — determined by whichever is taller. Sidebar widgets each get `flex: 1` so they split the available height equally. This ensures dark widget backgrounds align at the bottom.

If the main zone is empty, sidebar widgets expand to fill the full row width. If the sidebar is empty, the main widget fills the full row width. If both are empty, only full-width widgets are shown.

---

## Column Split

A toggle button in the Compare toolbar (beside "+ Add Widget") cycles through three presets:

| Label | Main | Sidebar |
|-------|------|---------|
| `1/2` | 50%  | 50%     |
| `2/3` | 67%  | 33%     |
| `3/4` | 75%  | 25%     |

Default: `2/3`.

Persisted to settings via `saveLayoutAll({ cmpSplit })`.

---

## Zone Button

Each widget header has two controls on the right side:

1. **Zone button** — cycles Main → Sidebar → Full → Main. Displays the current zone as a small label (`M` / `S` / `F`). Updates the widget's `zone` field in `cmpLayout` and persists.
2. **Remove button** — `✕`, same as before.

---

## Data Model

### State

```js
cmpLayout: Array<{ i: string, zone: 'main' | 'sidebar' | 'full' }>
cmpSplit: '1/2' | '2/3' | '3/4'
```

### Default layout

```js
const DEFAULT_CMP_LAYOUT = [
  { i: 'overlay',         zone: 'main'    },
  { i: 'velRanking',      zone: 'sidebar' },
  { i: 'accuracyRanking', zone: 'sidebar' },
  { i: 'metrics',         zone: 'full'    },
];
const DEFAULT_CMP_SPLIT = '2/3';
```

### Active widget keys

```js
cmpLayout.map(item => item.i)
```

---

## Migration

When loading settings or a saved comparison, convert old formats:

```js
// Old cmpLayout with {i, x, y, w, h} — strip to zone with defaults
if (Array.isArray(saved) && saved[0]?.x !== undefined) {
  return saved.map(item => ({
    i: item.i,
    zone: DEFAULT_ZONE[item.i] ?? 'full',
  }));
}

// Old cmpWidgets string array
if (Array.isArray(saved) && typeof saved[0] === 'string') {
  return saved.map(k => ({ i: k, zone: DEFAULT_ZONE[k] ?? 'full' }));
}
```

Where:

```js
const DEFAULT_ZONE = {
  overlay:         'main',
  velRanking:      'sidebar',
  accuracyRanking: 'sidebar',
  metrics:         'full',
  velCompare:      'full',
  shotLog:         'full',
  attachments:     'full',
};
```

---

## Render Logic

```jsx
const mainItems    = cmpLayout.filter(item => item.zone === 'main');
const sidebarItems = cmpLayout.filter(item => item.zone === 'sidebar');
const fullItems    = cmpLayout.filter(item => item.zone === 'full');

const splitMap  = { '1/2': '50%', '2/3': '67%', '3/4': '75%' };
const mainWidth = splitMap[cmpSplit];
const zoneLabel = { main: 'M', sidebar: 'S', full: 'F' };
```

```jsx
{/* Main + Sidebar row */}
{(mainItems.length > 0 || sidebarItems.length > 0) && (
  <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
    {/* Main column */}
    {mainItems.length > 0 && (
      <div style={{ width: sidebarItems.length > 0 ? mainWidth : '100%', flexShrink: 0 }}>
        {mainItems.map(item => renderWidget(item))}
      </div>
    )}
    {/* Sidebar column */}
    {sidebarItems.length > 0 && (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {sidebarItems.map(item => (
          <div key={item.i} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {renderWidget(item)}
          </div>
        ))}
      </div>
    )}
  </div>
)}

{/* Full-width zone */}
{fullItems.map(item => renderWidget(item))}
```

`renderWidget(item)` renders the full widget card (header + body) for a given layout item.

---

## Widget Card Structure

Each widget renders as:

```jsx
<div className="widget-card border-b border-border">
  <div className="widget-header flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/40">
    <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
      {CMP_WIDGET_DEFS[key].label}
    </span>
    <div className="flex items-center gap-1">
      <button className="zone-btn" onClick={() => cycleZone(key)} title="Change zone">
        {zoneLabel[item.zone]}  {/* 'M' | 'S' | 'F' */}
      </button>
      <button className="rgl-remove-btn" onClick={() => removeWidget(key)} title="Remove widget">
        <X size={13} />
      </button>
    </div>
  </div>
  <div className="widget-body p-4">
    {renderWidgetContent(key)}
  </div>
</div>
```

No `overflow-hidden` on the card. No fixed height. Widget body is auto-height (content determines height). The `renderWidgetContent(key)` function is unchanged from the current implementation.

---

## Zone and Widget Helpers

```js
function cycleZone(key) {
  const order = ['main', 'sidebar', 'full'];
  setCmpLayout(prev => {
    const next = prev.map(item =>
      item.i === key
        ? { ...item, zone: order[(order.indexOf(item.zone) + 1) % order.length] }
        : item
    );
    saveLayoutAll({ cmpLayout: next });
    return next;
  });
}

function removeWidget(key) {
  setCmpLayout(prev => {
    const next = prev.filter(item => item.i !== key);
    saveLayoutAll({ cmpLayout: next });
    return next;
  });
}
```

## Add Widget

`addWidget(key)` adds `{ i: key, zone: DEFAULT_ZONE[key] ?? 'full' }` to `cmpLayout` and persists.

`WidgetAdder` receives `available = Object.keys(CMP_WIDGET_DEFS).filter(k => !cmpLayout.some(item => item.i === k))`. Unchanged.

---

## Persistence

`saveLayoutAll({ cmpLayout, cmpSplit })` — same Supabase call as before. Field name `cmpLayout` is reused (the migration handles old formats).

`saveComparison` passes `cmpLayout` as before. No schema change.

---

## Cleanup

Remove from `src/App.jsx`:
- `WIDGET_DEFAULTS` constant
- `DEFAULT_CMP_LAYOUT` grid-position version (replace with zone version above)
- `handleLayoutChange`, `addToLayout`, `removeFromLayout` — replace with `addWidget`, `removeWidget`, `cycleZone`
- `rglContainerRef`, `rglWidth`, `useContainerWidth` hook usage
- `GridLayout` import and usage

Remove from `src/index.css`:
- All react-grid-layout transition/placeholder CSS rules (the grid layout section)
- Keep export mode rules (unchanged)

`react-grid-layout` can be uninstalled: `npm uninstall react-grid-layout`  
`html-to-image` stays (used for export).

---

## Export

No changes to export logic. The `export-mode` CSS class already hides `.zone-btn`, `.rgl-remove-btn`, and `.widget-add-bar`. The `export-header` and `toPng` call are unchanged.

One addition to export CSS:
```css
.export-root.export-mode .zone-btn { display: none; }
```

---

## File Changes

| File | Change |
|------|--------|
| `package.json` | Remove `react-grid-layout` |
| `src/App.jsx` | Replace grid layout state/render with zone layout |
| `src/index.css` | Remove grid CSS, add `.zone-btn` export rule |
