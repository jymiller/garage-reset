---
type: migration_assessment
scope: system-wide
last_analyzed: 2026-07-03
---

# Domain Boundaries

Each domain classified by how cleanly it could be lifted into a shared-backend / multiplayer
future, with a recommended phased order.

## Classification

| Domain | Coupling | Boundary | Effort | Verdict |
|--------|:--------:|:--------:|:------:|---------|
| Audio Engine | 0.10 | **clean** | small | Extractable as-is; publishable package. |
| Spatial Garage | 0.15 | **clean** | medium | Isolated from game state; needs an *authoring/persist* path, not a backend, to evolve. |
| Capture & Inventory | 0.25 | **clean** | small | Textbook CRUD; easy to move to a synced collection. |
| Quests & Progression | 0.35 | **partial** | large | The core; ready in spirit but needs a data seam + identity. |
| Arcade Shell | 0.50 | **partial** | medium | Composition root; main gap is real routing (URL/history). |

No domain is **entangled** — the codebase has no red-zone areas.

### Audio Engine — clean

Zero dependencies, zero app-state coupling. The only thing tying it to the app is that
callers `import { sound }` directly. **To extract:** nothing required; optionally accept an
injected instance for testability.

### Spatial Garage — clean (but static)

Reads no store; shares only types. Its limitation is the opposite of coupling: it's *too*
static — the `garage` model is hardcoded and not persisted. **To evolve:** lift `garage` into
state, add drag-to-move + a persistence path. Independent of the backend track. three.js is
already quarantined behind lazy loading.

### Capture & Inventory — clean

Three CRUD actions over one array. **To evolve:** split `items` into its own synced collection
keyed by owner; the action surface maps 1:1 to backend commands.

### Quests & Progression — partial

The rules are pure and portable; the leaderboard/level/rank all derive from a small state
blob, which is ideal for sync. **Blockers:** (a) no repository seam — `store.tsx` derives *and*
persists; (b) no identity in the schema; (c) no conflict handling; (d) no tests over the math.

### Arcade Shell — partial

Presentational but reaches every domain by nature of being the root. **Blocker:** routing is
an in-memory `tab` string — no URL state, deep links, or refresh-to-screen. A real router is
the shell-level prerequisite for a shareable/linkable multiplayer app.

## Recommended phased order

**Phase 0 — Safety net (no refactor):**
- Add a test suite for `game.ts` + `lib.ts`. Highest value, lowest risk.

**Phase 1 — Data seam:**
- Extract a `Persistence` interface (`load()` / `save(state)`) behind `store.tsx`; default
  impl wraps today's `localStorage`. No behavior change.

**Phase 2 — Identity & versioning:**
- Add device/user id + a `version` field to the schema, using the existing `?? default`
  hydration convention. Establishes ownership for multiplayer.

**Phase 3 — Backend + sync:**
- Swap the persistence impl for a synced backend; add a conflict strategy (start with
  last-writer-wins per field). Capture's `items` becomes its own collection here.

**Parallel track — Editable map:**
- Make the Spatial Garage layout draggable and persisted. Fully independent of Phases 1–3.

**Phase 4 — Shell modernization (optional):**
- Introduce a URL router so screens are linkable and refresh-safe — needed once multiple
  players share sessions.

This order keeps each step small and reversible, and front-loads the test coverage that makes
the store refactor safe.
