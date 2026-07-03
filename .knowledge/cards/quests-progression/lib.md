---
type: card
module: quests-progression
file: src/lib.ts
complexity: low
lines: 28
last_analyzed: 2026-07-03
migration:
  global_refs: []
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: []
  side_effects: []
  singleton_pattern: false
  extractable: true
  extraction_notes: Pure helpers; portable as-is.
---

# src/lib.ts — task selection & progress

Small pure helpers used by the play/HUD screens.

- **`nextTasks(tasks, n, person?)`** — the next `n` actionable quests: excludes done/blocked,
  optionally filters by person, sorts in-progress first then by `order`. Drives Snowball's
  "current quest" and the Dashboard "NEXT QUESTS" list.
- **`progress(tasks, person?)`** → `{ done, total, pct }` for a scope (overall, per-person,
  or — as called in `Zones` — a pre-filtered zone slice).
- **`cheer(pct)`** — a motivational tagline string keyed to completion percent.

No React, no storage. `activeRank()` is a private helper ordering in-progress ahead of
not-started.
