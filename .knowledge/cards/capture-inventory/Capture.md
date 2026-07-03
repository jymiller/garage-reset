---
type: card
module: capture-inventory
file: src/screens/Capture.tsx
complexity: medium
lines: 145
last_analyzed: 2026-07-03
migration:
  global_refs: []
  session_keys_read: ["garage-reset-v1 (via useStore)"]
  session_keys_written: ["garage-reset-v1"]
  db_tables_touched: ["garage-reset-v1 (items[])"]
  side_effects: [addItem / setItemDecision / deleteItem]
  singleton_pattern: false
  extractable: true
  extraction_notes: Self-contained CRUD screen; maps 1:1 to backend item commands.
---

# src/screens/Capture.tsx — the LOOT screen

Log physical items and set each one's fate.

## Structure
- **Add form** — local `useState` for `name`, `owner`, `zone`, `decision`; Enter or ADD calls
  `addItem({...})` then clears the name.
- **Inventory list** — newest first; each row shows an owner color dot (`arcPerson`), zone
  label, and a fate badge (`arcDecision`). Tapping the badge cycles the decision
  (`setItemDecision`); the trash icon calls `deleteItem`.
- **Helpers** — local `Field` (labeled group) and `Chip` (selectable pill) components.

## Notes
- Owner/zone chips are optional (`null` allowed).
- No game-logic imports — the only progression tie-in is indirect (the Quartermaster
  achievement counts `items.length`).
- The cleanest CRUD surface in the app; see [map](../../maps/capture-inventory/index.md).
