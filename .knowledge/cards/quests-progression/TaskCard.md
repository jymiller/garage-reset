---
type: card
module: quests-progression
file: src/components/TaskCard.tsx
complexity: medium
lines: 121
last_analyzed: 2026-07-03
migration:
  global_refs: []
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: ["garage-reset-v1 (via useStore)"]
  side_effects: [calls setTaskStatus / toggleStep]
  singleton_pattern: false
  extractable: true
  extraction_notes: Presentational; depends only on the store interface + theme.
---

# src/components/TaskCard.tsx — a quest row

Renders one quest and its completion controls. Used by `Zones`, `People`, and `Dashboard`.

## Two modes

- **Simple quest (no `steps`)** — a master checkbox toggles `setTaskStatus(id, 'done' | 'not-started')`,
  plus manual `IN PROGRESS` / `BLOCKED` status chips.
- **Sub-step quest (`steps[]`)** — the master checkbox becomes a **read-only completion
  indicator**; below it, a segmented mini-bar + a tappable checklist drive
  `toggleStep(id, i)`. Manual status chips are hidden (the checklist owns status). Shows an
  `n/total STEPS` counter.

## Details

- Reads `task.stepDone ?? steps.map(()=>false)` for step state; a step's checkbox flips one
  index.
- XP label shows the **true weighted XP** (`taskXp(task)` → +50/+100/+150), not a hardcoded
  value.
- Effort is shown as 1–3 yellow pips (`task.weight`).
- All completion/combo/streak/SFX consequences happen in the store (see
  [store card](store.md)); this component just calls the actions.
