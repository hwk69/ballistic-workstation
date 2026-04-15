---
description: "Pre-push verification checklist — run before every push"
alwaysApply: true
---
# Verification Before Push

## Before claiming work is done, ALWAYS verify:

### 1. Build Check
Run `vite build` and confirm zero errors. The pre-push hook does this automatically,
but check manually if making complex changes.

### 2. Data Flow Check
For any feature touching shots/sessions/attachments:
- [ ] New sessions: Does data save correctly on first shot?
- [ ] Existing sessions (edit/continue): Does data load correctly?
- [ ] Do field values round-trip through the DB? (save -> load -> display)
- [ ] Are attachments preserved across all operations?

### 3. UI State Check
- [ ] Edit mode: Do inputs populate with existing values?
- [ ] Save/submit: Does validation pass for all field types?
- [ ] Navigation: Can you move between pages without losing state?
- [ ] Empty states: What happens with 0 shots, 0 attachments, no config?

### 4. Backward Compatibility
- [ ] Old sessions (without new fields) still display correctly
- [ ] New fields show as blank/empty on old data, not errors
- [ ] The `data` JSON column handles both old and new field shapes

### 5. Security Quick Check
- [ ] No API keys or secrets in committed code
- [ ] No `console.log` with sensitive data
- [ ] User inputs are validated before DB operations

## When Uncertain

If unsure whether something will work:
- Say so explicitly: "I'm ~80% confident this works, but the edge case of X needs testing"
- Never claim "this is done" without checking the data flow
- Ask the user to test specific scenarios you can't verify
