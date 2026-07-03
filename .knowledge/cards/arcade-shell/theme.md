---
type: card
module: arcade-shell
file: src/theme.ts
complexity: low
lines: 52
last_analyzed: 2026-07-03
migration:
  global_refs: []
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: []
  side_effects: []
  singleton_pattern: false
  extractable: true
  extraction_notes: Pure token maps; portable.
---

# src/theme.ts — design-token maps

Maps domain values → colors/classes so meaning is encoded consistently. Six exports:

| Export | Keyed by | Provides |
|--------|----------|----------|
| `statusMeta` | `TaskStatus` | label + dot + chip classes (slate/amber/emerald/rose) |
| `decisionMeta` | `Decision` | label + Tailwind chip classes |
| `arcDecision` | `Decision` | arcade neon `{ label, color }` — keep=green, move=cyan, donate=pink, trash=red, undecided=gray |
| `zoneColors` | `ZoneId \| 'car'` | SVG `{ fill, stroke }` hex for the floor plan |
| `arcPerson` | `PersonId` | neon hex — John=cyan, Griffin=yellow, LJ=pink |
| `personMeta` | `PersonId` | Tailwind class variants (bar/dot/soft/text/ring) |

The **player** and **fate** color assignments are product constants (see
[conventions.md](../../atlas/conventions.md)); don't reassign them ad hoc. `zoneColors` is the
one map used by SVG/3D rather than the arcade neon palette.
