# Garage Reset — Knowledge Base

> Agent entry point. This knowledge base documents **Garage Reset**, a local-first,
> 8-bit arcade-styled web app that gamifies decluttering a shared family garage.
> Humans should open [index.html](index.html) for the visual portal.

## What this app is

A single-page React app where a family (John, Griffin, LJ) turns "clean out the garage"
into an arcade game: each cleanup chore is a **quest** worth XP, players compete on a
**leaderboard**, and progression is dressed up with ranks, streaks, combos, daily
missions, and a chiptune soundtrack. There is **no backend** — all state lives in the
browser's `localStorage` under a single key (`garage-reset-v1`). A separate 3D "garage
plan" view models the physical space.

## Lookup order (for agents)

1. **Start here:** [atlas/overview.md](atlas/overview.md) — the module inventory and how the 5 domains relate.
2. **Data model:** [atlas/data-model.md](atlas/data-model.md) — the persisted state shape (the "database" is one localStorage blob).
3. **Boot sequence:** [atlas/bootstrap-chain.md](atlas/bootstrap-chain.md) — process start → rendered app.
4. **Runtime paths:** [atlas/data-flows.md](atlas/data-flows.md) — traced end-to-end flows (complete a quest, capture loot, etc.).
5. **A specific domain:** `maps/<domain>/index.md` — file inventory + patterns for that domain.
6. **A specific file:** `cards/<domain>/<file>.md` — per-file annotations for the important files.
7. **Why it's built this way:** [decisions/](decisions/) — inferred architecture decision records.
8. **Evolving it:** [migration/readiness-overview.md](migration/readiness-overview.md) — backend/multiplayer extraction readiness.

## The 5 domains

| Domain | What it does | Map |
|---|---|---|
| **Quests & Progression** | The core game loop: tasks, XP, levels, ranks, streaks, combos, missions, weekly goals, leaderboard, achievements. | [maps/quests-progression/index.md](maps/quests-progression/index.md) |
| **Capture & Inventory** | Log physical items ("loot") and assign each a fate: keep / move / donate / trash. | [maps/capture-inventory/index.md](maps/capture-inventory/index.md) |
| **Spatial Garage** | A standalone 2D/3D floor-plan model of the garage showing NOW vs. PLAN object layout. | [maps/spatial-garage/index.md](maps/spatial-garage/index.md) |
| **Arcade Shell** | App shell: routing, title/attract screen, bottom nav, and the 8-bit design system. | [maps/arcade-shell/index.md](maps/arcade-shell/index.md) |
| **Audio Engine** | A self-contained Web Audio chiptune synthesizer (`sound` singleton) + sound-test screen. | [maps/audio-engine/index.md](maps/audio-engine/index.md) |

## Key facts an agent should know before editing

- **State is a single React Context** (`StoreProvider` in `src/store.tsx`) persisted to one `localStorage` key. There is no server, no auth, no database.
- **Game math is pure** and lives in `src/game.ts` (XP, levels, ranks, streaks, combos, missions) and `src/lib.ts` (task selection, progress). These have no React or storage dependencies.
- **Sound is a global singleton** (`src/sound.ts`) imported directly by the store and screens; celebration SFX are fired from the store's completion path, not the components.
- **The 3D garage model is a parallel data model** (`src/garage/model.ts`) — it is NOT wired to the quest/zone/item state. Treat it as its own mini-app.
- **The design language is strict** (see `DESIGN.md`): 8-bit arcade, mobile-first, family-friendly (gentle losing, only-ever-bonus mechanics).

_Last analyzed: 2026-07-03._
