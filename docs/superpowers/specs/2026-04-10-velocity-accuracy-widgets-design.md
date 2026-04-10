# Velocity & Accuracy Comparison Widgets — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add two new addable widgets — "Best Velocity" and "Best Accuracy" — to both the Results page and the Compare page, making it visually obvious at a glance which session wins on each metric.

**Design decision:** The user's boss flagged that plain numbers don't communicate relative values quickly enough. The solution: winner row glows and is full-size, runners-up fade progressively, and inline bars show the relative gap between sessions.

---

## Widget 1 — Best Velocity

**Purpose:** Rank sessions by mean FPS. Higher = better. No SD shown here.

**Visual design:**
- Dark card interior (`#111118`) matching existing chart backgrounds, inside the standard light-theme card/border shell
- One row per session, sorted descending by mean FPS
- **Winner row:** green glow border (`rgba(105,219,124,0.25)`), green background tint, large FPS number (22px monospace), dot with green box-shadow, "✦ BEST" label
- **2nd place:** dimmed — smaller number (18px), muted color at 60% opacity, delta shown as `−33` in small muted text
- **3rd+ place:** further dimmed — 45% opacity, even smaller delta
- **Inline bar:** full-width bar below each row. Best session bar = 100% width at full color. Others scaled proportionally to the range `(fps - min) / (max - min)`. Bar height 6–8px, rounded.
- Footer note: "bars show relative gap"

**Single-session (Results page):** Show a single row with the mean FPS prominently, no ranking needed. The bar fills to 100%. Label changes to "This Session."

---

## Widget 2 — Best Accuracy

**Purpose:** Rank sessions across three metrics — CEP, SD X, SD Y. Lower = better for all three.

**Visual design:**
- Same dark card interior as Widget 1
- Grid layout: session name column + one column per metric (CEP, SD X, SD Y)
- **Winner row:** green glow border, green background tint, all three values in bright green at 13px bold monospace
- **Runners-up:** progressively dimmed, 12px, muted color
- **Inline bar per cell:** thin bar (4px) below each value. Bar fills proportionally to how bad the value is: `(value - best) / (worst - best)`. Best = shortest bar (near 0). Worst = full bar. Color matches session color at reduced opacity. This means the winner's bars are almost invisible (tiny) and losers have longer bars — visually reinforcing "shorter = better."
- Footer note: "bars fill toward worst — shorter = better"

**Single-session (Results page):** Show all three metrics in a single row, no ranking. No bars needed (nothing to compare). Just CEP / SD X / SD Y with labels.

---

## Integration

**Results page (`WIDGETS` object in `src/App.jsx`):**
- Add `velRanking: { label: "Best Velocity", default: false, render: ... }`
- Add `accuracyRanking: { label: "Best Accuracy", default: false, render: ... }`
- On Results page, `s` (the session object) and `st` (stats) are available. No multi-session ranking — single-session display mode.

**Compare page (`CMP_WIDGET_DEFS` in `src/App.jsx`):**
- Add `velRanking: { label: "Best Velocity" }`
- Add `accuracyRanking: { label: "Best Accuracy" }`
- `resolved` array provides all selected sessions with `.session`, `.stats`, and `.color`. Sort by the relevant metric for ranking.

**Both widgets are implemented as pure React components** (no D3 — pure CSS bars and layout). They live in `src/App.jsx` alongside the other chart components, or optionally extracted to `src/components/VelRankingWidget.jsx` and `src/components/AccuracyRankingWidget.jsx`.

---

## Theme

- Card shell: standard `bg-card border border-border rounded-xl` (light theme)
- Chart interior: `background: #111118` (matches existing `CHART_BG`)
- Winner accent: `#69db7c` (green — distinct from gold, signals "best")
- Gold `#FFDF00` reserved for the app's primary brand accent, not used as a "winner" color here
- Session colors: inherit from `PALETTE` / Compare slot colors
- Typography: Inter Variable, monospace numbers via `font-family: ui-monospace, monospace`

---

## Scope

- No new dependencies
- No changes to data model or Supabase schema
- Widget state (visible/hidden) persists via existing `layout` and `cmpWidgets` Supabase settings
- Not default-on — users add them via the existing "+ Add widget" button
