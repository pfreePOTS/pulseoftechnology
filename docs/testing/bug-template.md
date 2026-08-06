# Bug Report Template

Copy this into `docs/testing/active-bugs.md` (summary row) and optionally expand below the table for complex bugs.

---

## Status vocabulary

| Status | When to use it |
|--------|----------------|
| `Open` | Not fixed yet. |
| `Fixed` | A failing-then-passing automated test is named in the row (preferred). |
| `Manual verification required` | An automated test is genuinely impossible. Name `Owner:` and an ISO date. |
| `Deferred (<reason>)` | Deliberately not being worked; state the reason. |
| `Superseded by PULSE-NNN` | Folded into another bug. |

**Severity** must be one of: `Blocking` · `Critical` · `Major` · `Minor` · `Trivial` · `Enhancement`.

---

## Bug Report: PULSE-NNN

**ID:** PULSE-NNN  
**Reported:** YYYY-MM-DD  
**Status:** Open  
**Severity:** Minor  
**Assigned:** Unassigned  
**Source:** (PR council / audit / user report / …)

### Summary

One sentence describing the bug.

### Reproduction

**Preconditions:**
- …

**Steps:**
1. …
2. …

**Actual:** …  
**Expected:** …

### Files involved

| File | Why |
|------|-----|
| `path/to/file` | … |

### Analysis (optional)

**Root cause hypothesis:** …  
**Suggested fix:** …  

### Verification

**To verify:**
1. …

**Related tests:**
- `docker compose exec -T backend pytest …`
