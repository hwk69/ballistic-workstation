# Mobile Responsive Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app functional on mobile devices via CSS-only responsive fixes, with no new components or touch interaction changes.

**Architecture:** All changes are in `src/App.jsx`. We add a `menuOpen` state to `AppNavBar`, swap inline padding for Tailwind classes on `AppShell`, add mobile breakpoints to grids, wrap the FIRE phase DispersionChart in `AutoSizeChart`, hide the resize grip on small screens, and stack the compare view on mobile.

**Tech Stack:** React, Tailwind CSS v4 (responsive prefixes: `sm:` 640px, `md:` 768px, `lg:` 1024px)

---

### Task 1: Hamburger Nav Menu

**Files:**
- Modify: `src/App.jsx:944-992` (AppNavBar component)

- [ ] **Step 1: Add `useState` and hamburger button to AppNavBar**

Change the `AppNavBar` function signature to use local state, hide nav items on mobile, and add a hamburger toggle:

```jsx
function AppNavBar({ phase, navItems, sessionCount }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 w-full" style={{ background: "#111118", borderBottom: "1px solid #222230" }}>
      <nav className="mx-auto flex h-[52px] w-full max-w-6xl items-stretch justify-between px-4 sm:px-6">
        {/* Wordmark */}
        <div className="flex items-center gap-3 shrink-0 pr-4 sm:pr-6" style={{ borderRight: "1px solid rgba(255,255,255,0.08)" }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: "#FFDF00" }} className="shrink-0">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.5"/>
            <line x1="8" y1="1" x2="8" y2="15" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <div className="flex items-center gap-1.5 leading-none">
            <span className="text-[11px] font-black tracking-[0.22em] uppercase px-1.5 py-0.5" style={{ background: "#FFDF00", color: "#000" }}>AXON</span>
            <span className="text-[11px] font-bold tracking-[0.18em] uppercase hidden sm:inline" style={{ color: "rgba(255,255,255,0.55)" }}>BALLISTIC</span>
          </div>
        </div>
        {/* Nav items — desktop */}
        <div className="hidden md:flex items-stretch flex-1 pl-2">
          {navItems.map(item => {
            const isActive = phase === item.ph;
            return (
              <button
                key={item.label}
                disabled={item.disabled}
                onClick={item.disabled ? undefined : item.onClick}
                className={cn(
                  "relative px-3.5 text-[11px] font-bold uppercase tracking-[0.1em] transition-colors duration-150 cursor-pointer",
                  "bg-transparent border-0 outline-none",
                  item.disabled && "opacity-20 cursor-not-allowed pointer-events-none"
                )}
                style={{ color: isActive ? "#ffffff" : "rgba(255,255,255,0.38)" }}>
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 left-1 right-1 h-[2px]" style={{ background: "#FFDF00" }} />
                )}
              </button>
            );
          })}
        </div>
        {/* Session count — desktop */}
        <div className="hidden md:flex items-center shrink-0 pl-5" style={{ borderLeft: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="text-[10px] font-bold tracking-[0.16em] uppercase" style={{ color: "rgba(255,255,255,0.22)" }}>
            {sessionCount} {sessionCount === 1 ? "session" : "sessions"}
          </span>
        </div>
        {/* Hamburger — mobile */}
        <button
          className="md:hidden flex items-center ml-auto bg-transparent border-none cursor-pointer p-2"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle menu">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            {menuOpen
              ? <path d="M5 5L15 15M15 5L5 15" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round"/>
              : <path d="M3 5h14M3 10h14M3 15h14" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round"/>}
          </svg>
        </button>
      </nav>
      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/5" style={{ background: "#111118" }}>
          <div className="flex flex-col px-4 py-2">
            {navItems.map(item => {
              const isActive = phase === item.ph;
              return (
                <button
                  key={item.label}
                  disabled={item.disabled}
                  onClick={() => { if (!item.disabled) { item.onClick(); setMenuOpen(false); } }}
                  className={cn(
                    "text-left px-2 py-2.5 text-[12px] font-bold uppercase tracking-[0.1em] transition-colors duration-150 cursor-pointer",
                    "bg-transparent border-0 outline-none rounded",
                    item.disabled && "opacity-20 cursor-not-allowed pointer-events-none"
                  )}
                  style={{ color: isActive ? "#ffffff" : "rgba(255,255,255,0.38)" }}>
                  {item.label}
                  {isActive && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full ml-2 align-middle" style={{ background: "#FFDF00" }} />
                  )}
                </button>
              );
            })}
            <div className="border-t border-white/5 mt-1 pt-2 pb-1 px-2">
              <span className="text-[10px] font-bold tracking-[0.16em] uppercase" style={{ color: "rgba(255,255,255,0.22)" }}>
                {sessionCount} {sessionCount === 1 ? "session" : "sessions"}
              </span>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
```

- [ ] **Step 2: Verify in browser**

Open the app, resize browser to < 768px width. Confirm:
- Hamburger icon appears, nav items hidden
- Tapping hamburger shows dropdown with all nav items
- Tapping a nav item navigates and closes the menu
- At >= 768px, original horizontal nav shows

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add hamburger nav menu for mobile"
```

---

### Task 2: AppShell Responsive Padding

**Files:**
- Modify: `src/App.jsx:995-1010` (AppShell component)

- [ ] **Step 1: Replace inline padding with Tailwind classes**

Change the `<main>` element in `AppShell` from:

```jsx
<main style={{ maxWidth: maxW, margin: "0 auto", padding: "40px 28px 60px" }}>
```

to:

```jsx
<main className="px-4 pt-5 pb-10 sm:px-7 sm:pt-10 sm:pb-15" style={{ maxWidth: maxW, margin: "0 auto" }}>
```

- [ ] **Step 2: Verify in browser**

Resize browser to < 640px. Confirm padding is tighter. At >= 640px, confirm padding matches original (28px ~ 1.75rem = `px-7`, 40px ~ 2.5rem = `pt-10`, 60px ~ 3.75rem = `pb-15`).

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: responsive padding on AppShell for mobile"
```

---

### Task 3: Stack Setup Phase Grids on Mobile

**Files:**
- Modify: `src/App.jsx:1339` (Configuration grid)
- Modify: `src/App.jsx:1384` (Session Details grid)

- [ ] **Step 1: Add mobile breakpoint to Configuration grid**

Change line 1339 from:

```jsx
<div className="grid grid-cols-2 gap-4">
```

to:

```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
```

- [ ] **Step 2: Add mobile breakpoint to Session Details grid**

Change line 1384 from:

```jsx
<div className="grid grid-cols-2 gap-4">
```

to:

```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
```

- [ ] **Step 3: Verify in browser**

Navigate to SETUP phase, resize to < 640px. Both grids should stack to single column. At >= 640px they should be 2-column.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: stack setup grids on mobile"
```

---

### Task 4: Responsive DispersionChart in FIRE Phase

**Files:**
- Modify: `src/App.jsx:1471-1474` (FIRE phase live dispersion)

- [ ] **Step 1: Wrap DispersionChart in AutoSizeChart**

Change lines 1471-1474 from:

```jsx
<CardSection title="Live Dispersion">
  {validShots.length
    ? <DispersionChart shots={validShots} stats={stats} size={350} />
    : <Empty icon={<Crosshair size={18} />}>Record a shot to see the dispersion chart</Empty>}
</CardSection>
```

to:

```jsx
<CardSection title="Live Dispersion">
  {validShots.length
    ? <AutoSizeChart render={(w, h) => <DispersionChart shots={validShots} stats={stats} size={Math.min(w, h) - 12} />} />
    : <Empty icon={<Crosshair size={18} />}>Record a shot to see the dispersion chart</Empty>}
</CardSection>
```

- [ ] **Step 2: Verify in browser**

Navigate to FIRE phase (need a session in progress with at least 1 shot). Resize browser. The dispersion chart should scale with the container width instead of being fixed at 350px.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: make FIRE phase dispersion chart responsive"
```

---

### Task 5: Hide Resize Grip on Mobile

**Files:**
- Modify: `src/App.jsx:822-828` (SortableWidget resize handle)

- [ ] **Step 1: Add `hidden sm:block` to resize handle**

Change lines 822-828 from:

```jsx
<div onMouseDown={onResizeDown}
  className="absolute bottom-2 right-2 z-10 cursor-se-resize text-muted-foreground/25 hover:text-muted-foreground/70 transition-colors select-none"
  title="Drag to resize">
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
    <path d="M10 1L1 10M7.5 1L1 7.5M10 4L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
</div>
```

to:

```jsx
<div onMouseDown={onResizeDown}
  className="absolute bottom-2 right-2 z-10 cursor-se-resize text-muted-foreground/25 hover:text-muted-foreground/70 transition-colors select-none hidden sm:block"
  title="Drag to resize">
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
    <path d="M10 1L1 10M7.5 1L1 7.5M10 4L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
</div>
```

- [ ] **Step 2: Verify in browser**

Resize to < 640px on RESULTS phase. Resize grip should not be visible. At >= 640px it should appear.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: hide widget resize grip on mobile"
```

---

### Task 6: Stack Compare View on Mobile

**Files:**
- Modify: `src/App.jsx:2140` (Compare view main+sidebar flex)

- [ ] **Step 1: Add responsive flex direction**

Change line 2140 from:

```jsx
<div className="flex items-stretch">
```

to:

```jsx
<div className="flex flex-col md:flex-row md:items-stretch">
```

- [ ] **Step 2: Remove sidebar border on mobile**

Change line 2147 from:

```jsx
<div className="flex-1 flex flex-col border-l border-border min-w-0">
```

to:

```jsx
<div className="flex-1 flex flex-col border-t md:border-t-0 md:border-l border-border min-w-0">
```

- [ ] **Step 3: Prevent main section from overflowing on mobile**

The main section at line 2142 uses a calculated `width` style (e.g. `'66%'`) that can exceed the viewport when the flex container stacks vertically on mobile. Add `maxWidth: '100%'` to cap it:

Change:

```jsx
<div className="shrink-0" style={{ width: sidebarItems.length > 0 ? mainWidth : '100%' }}>
```

to:

```jsx
<div className="shrink-0" style={{ width: sidebarItems.length > 0 ? mainWidth : '100%', maxWidth: '100%' }}>
```

On mobile (stacked via `flex-col`), `maxWidth: '100%'` makes it fill the container. On desktop, the flex row is wide enough that the calculated width still applies normally.

- [ ] **Step 4: Verify in browser**

Navigate to Compare, select 2+ sessions. At < 768px, main and sidebar should stack vertically. At >= 768px, they should be side-by-side.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: stack compare view layout on mobile"
```
