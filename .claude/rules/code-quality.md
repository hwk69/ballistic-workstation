---
description: "Code quality: immutability, error handling, validation, file organization"
alwaysApply: true
---
# Code Quality Rules

## Immutability (CRITICAL)

ALWAYS create new objects, NEVER mutate existing ones:
- Use spread operator for updates: `{ ...obj, field: newVal }`
- Use `.map()`, `.filter()` instead of mutating arrays
- React state must ALWAYS use setter with new object/array

## Error Handling

ALWAYS handle errors comprehensively:
- Wrap async operations in try/catch
- Show user-friendly error messages in UI (use `setDbError` pattern)
- Never silently swallow errors — at minimum log them
- Provide fallback UI for error states

## Input Validation

ALWAYS validate at boundaries:
- Validate form inputs before saving (check required fields, types)
- Guard against null/undefined when accessing nested data: `s.data || s`
- Use `??` and `||` for safe defaults
- Parse numbers with `parseFloat()` and check `isNaN()`

## Before Marking Work Complete

- [ ] All field values handled for both new and existing data
- [ ] No mutation of state objects
- [ ] Error states handled with user feedback
- [ ] Edge cases considered (empty arrays, null values, missing fields)
- [ ] No hardcoded values that should be configurable
