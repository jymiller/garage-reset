---
type: card
module: quests-progression
file: src/types.ts
complexity: low
lines: 44
last_analyzed: 2026-07-03
migration:
  global_refs: []
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: []
  side_effects: []
  singleton_pattern: false
  extractable: true
  extraction_notes: The shared vocabulary; string-literal unions map cleanly to JSON/DB enums.
---

# src/types.ts — domain vocabulary

The single source of the app's domain types. Import from here.

- **`PersonId`** = `'john' | 'griffin' | 'lj'`
- **`ZoneId`** = 6 zone literals (`griffin-workshop` … `exit-zone`)
- **`TaskStatus`** = `'not-started' | 'in-progress' | 'done' | 'blocked'`
- **`Decision`** = `'undecided' | 'keep' | 'move' | 'donate' | 'trash'`
- **`Person`**, **`Zone`** — `{ id, name }`
- **`Task`** — id, title, person, zone, status, order, optional `weight`, `steps[]`,
  `stepDone[]`
- **`Item`** — id, name, owner, zone, decision, createdAt

These string-literal unions (not TS `enum`s) serialize directly to JSON and would map 1:1 to
DB enum columns. The same `PersonId`/`ZoneId`/`Decision` types are reused by the spatial
garage model.
