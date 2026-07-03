---
type: atlas
title: System Overview
last_analyzed: 2026-07-03
modules:
  - name: quests-progression
    display_name: Quests & Progression
    file_count: 11
    role: The core game loop — tasks become quests, completing them awards XP and drives levels, ranks, streaks, combos, missions, weekly goals, the leaderboard, and achievements.
    depends_on: [audio-engine]
    entry_points: [src/screens/Dashboard.tsx, src/screens/Snowball.tsx]
    handlers: [src/store.tsx]
    migration:
      complexity: high
      coupling_score: 0.35
      session_dependencies: 1
      global_dependencies: 2
  - name: capture-inventory
    display_name: Capture & Inventory
    file_count: 1
    role: Log physical items ("loot") found while cleaning and assign each a fate (keep / move / donate / trash).
    depends_on: [quests-progression]
    entry_points: [src/screens/Capture.tsx]
    handlers: [src/store.tsx]
    migration:
      complexity: low
      coupling_score: 0.25
      session_dependencies: 1
      global_dependencies: 1
  - name: spatial-garage
    display_name: Spatial Garage
    file_count: 3
    role: A standalone 2D/3D floor-plan of the garage showing NOW vs. PLAN object placement. A parallel data model, not wired to the game state.
    depends_on: []
    entry_points: [src/screens/Garage.tsx]
    handlers: [src/garage/model.ts]
    migration:
      complexity: medium
      coupling_score: 0.15
      session_dependencies: 0
      global_dependencies: 1
  - name: arcade-shell
    display_name: Arcade Shell
    file_count: 8
    role: App shell — React mount, screen routing, title/attract screen, bottom nav, and the 8-bit design system (CSS + color tokens).
    depends_on: [quests-progression, audio-engine]
    entry_points: [src/main.tsx, src/App.tsx]
    handlers: [src/App.tsx]
    migration:
      complexity: medium
      coupling_score: 0.5
      session_dependencies: 0
      global_dependencies: 1
  - name: audio-engine
    display_name: Audio Engine
    file_count: 2
    role: A self-contained Web Audio chiptune synthesizer exposed as the `sound` singleton, plus a sound-test screen.
    depends_on: []
    entry_points: [src/sound.ts]
    handlers: [src/sound.ts]
    migration:
      complexity: low
      coupling_score: 0.1
      session_dependencies: 1
      global_dependencies: 1
---

# System Overview

**Garage Reset** is a local-first, single-page React app that gamifies cleaning out a
shared family garage. Each cleanup chore is a **quest**; finishing quests earns XP that
feeds an arcade progression system (levels, ranks, streaks, combos, daily missions,
weekly goals) and a three-player leaderboard (John, Griffin, LJ). A separate 3D view
models the physical garage. There is **no backend**: the entire game state is one JSON
blob in `localStorage`.

- **Stack:** React 19 + TypeScript (strict) + Vite 6 + Tailwind CSS v4, plus three.js /
  react-three-fiber for the 3D garage. See [tech-stack.md](tech-stack.md).
- **Size:** ~2,500 lines of TS/TSX across 24 source files.
- **Persistence:** two `localStorage` keys — `garage-reset-v1` (game state) and
  `arcade-muted` (sound preference). See [data-model.md](data-model.md).
- **Audio:** all sound effects are synthesized at runtime from Web Audio oscillators —
  there are no audio asset files.

## The five domains

Domains are grouped by **what they do for the player**, not by folder. `src/store.tsx`
is the shared state hub that several domains read and write, but its home is
**Quests & Progression**.

| # | Domain | Files | Coupling | Boundary | Notes |
|---|--------|-------|----------|----------|-------|
| 1 | [Quests & Progression](../maps/quests-progression/index.md) | 11 | 0.35 | partial | The heart of the app. Pure game math (`game.ts`, `lib.ts`) + the state store + five screens. |
| 2 | [Capture & Inventory](../maps/capture-inventory/index.md) | 1 | 0.25 | clean | Simple CRUD over an `items[]` array. One screen. |
| 3 | [Spatial Garage](../maps/spatial-garage/index.md) | 3 | 0.15 | clean | Isolated 2D/3D floor plan from a hardcoded model. Reads no game state. |
| 4 | [Arcade Shell](../maps/arcade-shell/index.md) | 8 | 0.50 | partial | Composition root: routing, title screen, nav, design system. |
| 5 | [Audio Engine](../maps/audio-engine/index.md) | 2 | 0.10 | clean | Self-contained chiptune singleton. Extractable as a library. |

> **Coupling score** here is adapted to a local-first app: it measures how hard the domain
> would be to lift into a shared **backend / multiplayer** future (0 = drop-in extractable,
> 1 = entangled). See [migration/readiness-overview.md](../migration/readiness-overview.md).

## How the pieces fit

```
                         index.html
                             │
                        src/main.tsx  ── prime()/unlock ──►  sound (singleton)
                             │                                    ▲
                     <StoreProvider>  ── localStorage             │ celebration SFX
                             │            (garage-reset-v1)        │
                          src/App.tsx  ── tab router ──────────────┘
                             │
     ┌───────────┬───────────┼───────────┬───────────┬─────────────┐
  Dashboard   People      Snowball     Zones      Capture        Garage
   (HUD)     (PLAYERS)     (PLAY)     (ZONES)      (LOOT)         (MAP)
     └───────────┴───────────┴───────────┴──────┬────┘              │
                    read/write via useStore()   │                   │ reads static
                                                 ▼                   ▼ garage model
                         game.ts (pure) · lib.ts (pure) · data.ts (seed)   garage/model.ts
```

- **State** lives in one React Context (`src/store.tsx`) and is auto-persisted to
  `localStorage` on every change.
- **Game rules** are pure functions in `src/game.ts` and `src/lib.ts` — no React, no storage.
- **Screens** are presentational; they read state and call store actions.
- **The audio engine** is a global singleton imported directly wherever a sound is needed;
  crucially, the store fires all *celebration* SFX from its completion path so the rules and
  the feedback stay in sync (see [ADR-0005](../decisions/0005-sound-fired-from-store.md)).
- **The spatial garage is a silo** — it shares the `ZoneId`/`PersonId`/`Decision` types but
  keeps its own hardcoded object positions and never touches the store.

## Where to go next

- **Understand the data:** [data-model.md](data-model.md)
- **Understand startup:** [bootstrap-chain.md](bootstrap-chain.md)
- **Follow a request end to end:** [data-flows.md](data-flows.md)
- **Coding conventions:** [conventions.md](conventions.md)
- **Evolve toward a backend:** [migration/readiness-overview.md](../migration/readiness-overview.md)
