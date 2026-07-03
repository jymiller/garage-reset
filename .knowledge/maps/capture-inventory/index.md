---
type: module
name: capture-inventory
display_name: Capture & Inventory
status: active
file_locations:
  entry_points: [src/screens/Capture.tsx]
  controllers: [src/store.tsx]
  models: [src/types.ts]
  views: [src/screens/Capture.tsx]
  services: []
  tests: []
  config: []
dependencies:
  internal: [quests-progression]
  external: [react]
  database_tables: [garage-reset-v1 (localStorage, items[])]
patterns:
  - type: array CRUD via store actions
    count: 3
    example: src/store.tsx
  - type: local-form-state screen
    count: 1
    example: src/screens/Capture.tsx
migration:
  coupling_score: 0.25
  session_dependencies: 1
  global_dependencies: 1
  singleton_dependencies: [StoreCtx]
  pattern_consistency: 0.9
  abstraction_boundary: clean
  testability: medium
  estimated_effort: small
  blockers:
    - Items share the same single-blob persistence as everything else; no separate collection or IDs beyond a client UUID.
---

# Capture & Inventory

A lightweight loot logger. While clearing the garage, a player captures physical **items**
and assigns each a **fate**: keep, move, donate, or trash. This is the app's simplest,
cleanest domain — pure CRUD over one array.

## Files

| File | Lines | Role | Card |
|------|-------|------|------|
| [`src/screens/Capture.tsx`](../../../src/screens/Capture.tsx) | 145 | The LOOT screen: add-item form (name + owner + zone + fate chips) and the inventory list with cycle-fate and delete. Includes local `Field`/`Chip` helper components. | [card](../../cards/capture-inventory/Capture.md) |

Backed by three store actions in [`src/store.tsx`](../../../src/store.tsx):

| Action | Signature | Effect |
|--------|-----------|--------|
| `addItem` | `({ name, owner, zone, decision }) => void` | Prepend a new `Item` (`crypto.randomUUID()`, `createdAt`) to `items`. |
| `setItemDecision` | `(id, decision) => void` | Update one item's fate (cycled on tap). |
| `deleteItem` | `(id) => void` | Remove an item. |

## Data

An `Item` (see [types.ts](../../../src/types.ts)):

```ts
interface Item {
  id: string; name: string;
  owner: PersonId | null; zone: ZoneId | null;
  decision: Decision;          // 'undecided' | 'keep' | 'move' | 'donate' | 'trash'
  createdAt: number;
}
```

Fate colors come from `arcDecision` in [theme.ts](../../../src/theme.ts):
undecided=gray, keep=green, move=cyan, donate=pink, trash=red.

## Ties to the rest of the app

- Items are surfaced as **LOOT counts** on the [Zones](../../../src/screens/Zones.tsx) screen
  (grouped by `zone`) and in the [Garage](../../../src/screens/Garage.tsx) map's object
  metadata (via shared `Decision`/`zone` semantics — though the map uses its own object set).
- The only progression hook is the **Quartermaster** achievement (`items.length >= 5`) in
  `game.ts`.
- Capture does **not** award XP or affect the leaderboard.

## Backend/multiplayer readiness

`coupling_score 0.25 · clean · effort small.` The action surface is a textbook CRUD trio, so
turning `items` into a synced collection is straightforward. The only wrinkle is that items
live inside the same single `garage-reset-v1` blob as the game state — a real backend would
likely split them into their own collection keyed by owner.
