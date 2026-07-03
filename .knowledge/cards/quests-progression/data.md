---
type: card
module: quests-progression
file: src/data.ts
complexity: low
lines: 72
last_analyzed: 2026-07-03
migration:
  global_refs: []
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: []
  side_effects: []
  singleton_pattern: false
  extractable: true
  extraction_notes: Reference/seed data. Candidate to move to config or a backend "campaign" definition.
---

# src/data.ts — reference & seed data

The fixed cast and the starting quests.

- **`people`** — 3 `Person`s: John, Griffin, LJ.
- **`zones`** — 6 `Zone`s: Griffin Workshop, Griffin Fitness/Personal, LJ Clothing & Shoes,
  John White Table, Shared Storage, Donate/Trash/Exit Zone.
- **`personName(id)` / `zoneName(id)`** — id → display-name lookups (used across screens and
  the garage map).
- **`seedTasks()`** — builds the 10 starting `Task`s (`seed-<i>`) with `person`, `zone`,
  `weight` (1–3), and — for four heavier quests — `steps[]` (pit-stop sub-steps). Called on
  first run and on `resetAll()`.

The seed's `steps` are the canonical sub-step definitions; the store re-attaches them to saved
tasks on load. In a backend world, `people`/`zones`/seed become a "campaign" definition rather
than hardcoded arrays.
