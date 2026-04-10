# Compare Page — Drag/Resize Grid Layout & Export Design Spec

**Goal:** Replace the fixed vertical widget stack on the Compare page with a draggable, resizable 6-column grid. Add a clean PNG export that includes session title and widget labels but strips all interactive controls.

**Approach:** `react-grid-layout` for the grid, `html-to-image` for PNG export.

---

## Dependencies

Add to `package.json`:
- `react-grid-layout` — drag/resize grid (battle-tested, purpose-built for this)
- `html-to-image` — DOM-to-PNG capture

CSS imports required in `src/App.jsx` (or `src/index.css`):
```js
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
```

---

## Data Model Change

### Before
```js
cmpWidgets: string[]  // e.g. ["overlay", "metrics", "velRanking"]
```

### After
```js
cmpLayout: Array<{ i: string, x: number, y: number, w: number, h: number }>
```
Each item maps to one widget: `i` = widget key, `x`/`y` = grid position, `w`/`h` = grid span (out of 6 columns, rowHeight = 120px).

Active widget keys = `cmpLayout.map(item => item.i)`.

### Default sizes per widget key
```js
const WIDGET_DEFAULTS = {
  overlay:         { w: 4, h: 4 },
  metrics:         { w: 6, h: 3 },
  velCompare:      { w: 4, h: 3 },
  shotLog:         { w: 6, h: 4 },
  attachments:     { w: 6, h: 3 },
  velRanking:      { w: 3, h: 3 },
  accuracyRanking: { w: 3, h: 3 },
};
```

### Migration from old `cmpWidgets` saves
When loading settings, if `cmpLayout` is absent but `cmpWidgets` exists, convert:
```js
const cmpLayout = settings.cmpLayout
  ?? (settings.cmpWidgets ?? ['overlay', 'metrics']).map((k, i) => ({
       i: k,
       x: 0,
       y: i * (WIDGET_DEFAULTS[k]?.h ?? 3),
       w: WIDGET_DEFAULTS[k]?.w ?? 6,
       h: WIDGET_DEFAULTS[k]?.h ?? 3,
     }));
```

---

## Grid Layout

**Library:** `ReactGridLayout` from `react-grid-layout`

**Config:**
- `cols={6}` — 6-column grid
- `rowHeight={120}` — each row unit = 120px tall
- `draggableHandle=".rgl-drag-handle"` — only drag from the handle, not the whole widget
- `resizeHandles={['se']}` — resize from bottom-right corner only
- `onLayoutChange={handleLayoutChange}` — persist on every change

**Layout change handler:**
```js
function handleLayoutChange(layout) {
  setCmpLayout(layout);
  saveLayoutAll({ cmpLayout: layout });
}
```

---

## Widget Panel Structure

Every widget in the grid gets the same wrapper structure. The widget-specific content lives below the header.

```jsx
<div key={key}> {/* required by ReactGridLayout */}
  <div className="widget-panel">
    <div className="widget-header">
      <div className="rgl-drag-handle">
        <GripVertical size={13} />
        <span>{CMP_WIDGET_DEFS[key].label}</span>
      </div>
      <button className="rgl-remove-btn" onClick={() => removeFromLayout(key)}>
        <X size={13} />
      </button>
    </div>
    <div className="widget-body overflow-auto">
      {renderWidgetContent(key)}
    </div>
  </div>
</div>
```

**`renderWidgetContent(key)`** — a function that returns the widget's inner content (chart, table, ranking, etc.) with no outer wrapper or header. This is a refactor of the existing `cmpWidgets.map(key => {...})` render, extracting just the content portion.

**Note on D3 charts:** `DispersionMulti` and the velocity comparison chart use fixed pixel `size` props. In this implementation they render at their native size and are centered in their grid cell. The cell can be resized to accommodate. Full responsive resizing of D3 charts is out of scope.

---

## Add Widget

`toggleCmpWidget` is renamed `addToLayout(key)` / `removeFromLayout(key)`:

```js
function addToLayout(key) {
  const item = {
    i: key,
    x: 0,
    y: Infinity, // react-grid-layout packs to bottom
    w: WIDGET_DEFAULTS[key]?.w ?? 6,
    h: WIDGET_DEFAULTS[key]?.h ?? 3,
  };
  setCmpLayout(prev => {
    const next = [...prev, item];
    saveLayoutAll({ cmpLayout: next });
    return next;
  });
}

function removeFromLayout(key) {
  setCmpLayout(prev => {
    const next = prev.filter(item => item.i !== key);
    saveLayoutAll({ cmpLayout: next });
    return next;
  });
}
```

`WidgetAdder` receives `available = Object.keys(CMP_WIDGET_DEFS).filter(k => !cmpLayout.some(item => item.i === k))`.

---

## Remove Ranking Widget Pair Special Case

The current code has special-case logic that renders `velRanking` and `accuracyRanking` side-by-side when both are active. With the grid, the user positions them manually. **Remove this special case entirely.** Each widget renders independently at its default `w=3` width; when both are added they default to half-width and can be dragged side by side.

---

## Export Feature

### UI
Add an **"Export Image"** button to the Compare page toolbar (top-right, alongside "+ Add Widget"). Style: `bg-primary text-primary-foreground` (gold/black, matches app accent).

### Export target
Wrap the entire export region in a `ref`:
```jsx
const exportRef = useRef();
// ...
<div ref={exportRef} className="export-root">
  <div className="export-header"> {/* session title — hidden normally */}
    <span className="session-names">{sessionNames}</span>
    <span className="export-date">{date}</span>
  </div>
  <ReactGridLayout ...>...</ReactGridLayout>
</div>
```

### Export header content
```jsx
const sessionNames = resolved.map(r => r.session.config.sessionName).join(' · ');
const exportDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
```

### Export handler
```js
import { toPng } from 'html-to-image';

async function handleExport() {
  const el = exportRef.current;
  el.classList.add('export-mode');
  try {
    const dataUrl = await toPng(el, { backgroundColor: '#f7f7fa', pixelRatio: 2 });
    const a = document.createElement('a');
    a.download = `compare-${Date.now()}.png`;
    a.href = dataUrl;
    a.click();
  } finally {
    el.classList.remove('export-mode');
  }
}
```

`pixelRatio: 2` produces a retina-quality image.

### Export mode CSS
```css
/* Export header: hidden normally, shown during export */
.export-root .export-header { display: none; }
.export-root.export-mode .export-header { display: block; }

/* Hide interactive controls during export */
.export-root.export-mode .rgl-drag-handle .grip-icon { display: none; }
.export-root.export-mode .rgl-remove-btn { display: none; }
.export-root.export-mode .react-resizable-handle { display: none; }
.export-root.export-mode .widget-add-bar { display: none; }
```

The widget **title text** stays visible in export mode — only the grip icon and ✕ button are hidden.

---

## Persistence

`saveLayoutAll({ cmpLayout })` stores the full layout array to the existing Supabase settings field. The field name changes from `cmpWidgets` to `cmpLayout`. Old saves with `cmpWidgets` are handled by the migration logic above.

---

## File Changes

| File | Change |
|------|--------|
| `package.json` | Add `react-grid-layout`, `html-to-image` |
| `src/App.jsx` | All changes — see sections above |
| `src/index.css` | Export mode CSS rules |

No new component files. All grid logic stays in `App.jsx` alongside the existing compare page code.

---

## What Does NOT Change

- `CMP_WIDGET_DEFS` object — same keys, same labels
- Widget content components (DispersionMulti, metrics table, VelRankingWidget, etc.)
- Results page — untouched
- Auth, Supabase schema, data model
