---
description: "React 19 patterns for this Vite + Supabase project"
globs: ["**/*.jsx", "**/*.js"]
alwaysApply: true
---
# React Patterns

## State Updates

ALWAYS use functional updates when new state depends on previous:
```js
// WRONG
setShots([...shots, newShot])

// CORRECT
setShots(prev => [...prev, newShot])
```

## useEffect Rules

- Always include correct dependencies
- Use refs to break infinite loops (like `autoSaveIdUpdate.current`)
- Clean up timers and subscriptions in the return function
- Never call setState in a loop without batching

## Component Keys

- NEVER use array index as key for lists that can reorder/add/remove
- Use stable IDs: `s.id || s.serial || \`new-\${i}\``
- Changing keys causes remounts — this destroys component state (including attachments, inputs)

## Data Access Pattern

This project stores shot data in two places — always check both:
```js
const value = (s.data || s)[fieldKey];  // data object first, then top-level
```

When loading data for editing, merge both sources:
```js
const merged = { ...shot, ...(shot.data || {}) };
```

## Auto-Save Pattern

- Debounce with `setTimeout` (800ms in this project)
- Use a ref flag to skip effect cycles triggered by the save itself
- Always update the `log` state to keep History in sync

## Conditional Rendering

- Guard against null/undefined sessions, empty arrays
- Use `useMemo` for expensive derived data
- Avoid inline object creation in JSX props (causes re-renders)
