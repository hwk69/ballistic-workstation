# Mobile Responsive Fixes

**Date:** 2026-04-13
**Scope:** CSS-only responsive fixes to make the app functional on mobile devices
**Primary use case:** Recording shots on a phone during the FIRE phase

## Context

The app has partial responsive support (Tailwind breakpoints on some grids, viewport meta tag), but several issues make it broken/unusable on mobile:
- Navbar overflows horizontally
- Some grids don't stack on small screens
- Hardcoded chart size in FIRE phase
- Main container padding is too generous for mobile
- Resize handles don't work on touch (visual clutter)
- Compare view doesn't stack

## Changes

### 1. Hamburger Nav (< 768px)

Add a hamburger menu to `AppNavBar` for screens below `md` breakpoint:
- Hide the horizontal nav items (`hidden md:flex`)
- Show a hamburger button (`md:hidden`) in the header
- Toggle a full-width dropdown with nav items stacked vertically
- New React state: `menuOpen` boolean in `AppNavBar`
- Wordmark and session count remain visible in collapsed header

### 2. Layout Stacking

- **SETUP phase** Configuration grid: `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`
- **SETUP phase** Session Details grid: `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`
- **FIRE phase** Live charts: already `grid-cols-1 lg:grid-cols-2` — no change
- **FIRE phase** DispersionChart: replace hardcoded `size={350}` with `AutoSizeChart` wrapper
- **RESULTS phase** Widgets: already `w-full lg:w-1/2` — no change
- **Compare view** Main+sidebar flex: add `flex-col md:flex-row` so it stacks on mobile

### 3. Padding & Spacing

`AppShell` main element: replace inline `padding` style with Tailwind classes:
- Mobile: `px-4 pt-5 pb-10`
- Desktop: `sm:px-7 sm:pt-10 sm:pb-15`

### 4. Hide Resize Grip on Mobile

`SortableWidget` resize handle: add `hidden sm:block` so it's invisible on touch devices where it doesn't function anyway.

### 5. Out of Scope (Approach 1)

- Touch-friendly chart tooltips (D3 mouseenter/mousemove events)
- Touch drag-to-reorder widgets
- Mobile-optimized FIRE input (large targets, auto-advance)
- Bottom sheet patterns
- Swipe gestures
