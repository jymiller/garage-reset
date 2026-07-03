---
type: migration_assessment
scope: system-wide
last_analyzed: 2026-07-03
overall_readiness: 0.55
scores:
  dependency_injection: 0.3
  test_coverage: 0.0
  separation_of_concerns: 0.75
  api_surface_clarity: 0.75
  data_layer_isolation: 0.45
global_state_inventory:
  session_keys_total: 2
  global_variables: ["sound (singleton, src/sound.ts)", "garage (const model, src/garage/model.ts)", "muted (module scope, src/sound.ts)"]
  singletons: ["sound", "StoreCtx (React Context)"]
---

# Migration / Evolution Readiness

> **Framing.** This is a healthy local-first app, not a legacy system in need of rescue.
> "Migration" here means the app's most likely next chapter: **moving from single-device
> `localStorage` to a shared backend so the family plays together in real time** (and,
> relatedly, making the garage layout editable/saved). The scores below measure readiness
> for *that* evolution.

## System scores

| Dimension | Score | Reading |
|-----------|-------|---------|
| Separation of concerns | **0.75** | Strong. Pure game rules (`game.ts`/`lib.ts`) are fully divorced from React and storage; screens are presentational. |
| API surface clarity | **0.75** | Strong. The store exposes a small, explicit `Store` interface; `game.ts` exports are named and pure. |
| Data-layer isolation | **0.45** | Mixed. Persistence is localized to one read + one write in `store.tsx`, but there is no repository seam — the store both derives and persists. |
| Dependency injection | **0.30** | Weak. `sound` and the `garage` model are hard singletons; the store is a hardcoded Context. Nothing is injected/mockable. |
| Test coverage | **0.00** | None. No test runner, no tests. The pure core is highly testable but untested. |
| **Overall** | **0.55** | A contained, well-structured codebase that's *ready to be evolved* but needs a data seam, identity, and tests first. |

## What makes it ready

- **Derived progression.** XP, levels, ranks, and the leaderboard are computed from `tasks`
  + a few counters, so a sync layer only needs to move a small, well-defined state blob —
  not a sprawling denormalized cache. (See [ADR-0002](../decisions/0002-derived-progression.md).)
- **One state hub.** All mutations go through `store.tsx`, so the seam for a backend is
  obvious and singular.
- **Clean, isolated units.** The audio engine and the spatial model have near-zero coupling
  and can move independently.

## What blocks it

1. **No identity in the schema.** The save is a single-user, single-device blob. There is no
   user id, device id, or per-player ownership of the *save* (only of individual tasks/items
   via `person`). Multiplayer needs identity added to the data model.
2. **No repository/data seam.** `store.tsx` both derives state and calls `localStorage`
   directly. A backend swap wants a small persistence interface to slot behind the store.
3. **No conflict handling.** Two devices editing the same blob would clobber each other;
   there's no versioning, merge, or last-writer-wins strategy.
4. **Zero tests.** Before refactoring the store's seam, the pure progression math should get
   a test suite (it's the easiest, highest-value coverage in the repo).
5. **Weak DI.** Hard singletons (`sound`, `garage`) and a hardcoded Context make unit
   isolation awkward.

## Recommended sequence (lowest risk first)

1. **Add tests for the pure core** (`game.ts`, `lib.ts`) — no refactor required, immediate safety net.
2. **Introduce a persistence interface** behind `store.tsx` (`load()` / `save(state)`), defaulting to the current `localStorage` impl.
3. **Add identity to the schema** (device/user id; per-save ownership) with a `?? default` migration, matching the existing extend-don't-migrate convention.
4. **Swap the persistence impl for a synced backend**, adding a conflict strategy (start with last-writer-wins per field).
5. **(Parallel track)** make the spatial garage editable and persist its model — independent of the above.

See per-domain detail in [domain-boundaries.md](domain-boundaries.md) and the coupling matrix
in [dependency-analysis.md](dependency-analysis.md).
