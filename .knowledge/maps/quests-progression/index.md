---
type: module
name: quests-progression
display_name: Quests & Progression
status: active
file_locations:
  entry_points: [src/screens/Dashboard.tsx, src/screens/Snowball.tsx]
  controllers: [src/store.tsx]
  models: [src/types.ts, src/data.ts]
  views: [src/screens/Dashboard.tsx, src/screens/People.tsx, src/screens/Snowball.tsx, src/screens/Zones.tsx, src/screens/FinalStandings.tsx, src/components/TaskCard.tsx, src/components/ProgressBar.tsx]
  services: [src/game.ts, src/lib.ts]
  tests: []
  config: []
dependencies:
  internal: [audio-engine]
  external: [react]
  database_tables: [garage-reset-v1 (localStorage)]
patterns:
  - type: pure game-logic module
    count: 2
    example: src/game.ts
  - type: React Context store
    count: 1
    example: src/store.tsx
  - type: presentational screen
    count: 5
    example: src/screens/Dashboard.tsx
migration:
  coupling_score: 0.35
  session_dependencies: 1
  global_dependencies: 2
  singleton_dependencies: [sound, StoreCtx]
  pattern_consistency: 0.85
  abstraction_boundary: partial
  testability: medium
  estimated_effort: large
  blockers:
    - State + persistence + derivation all funnel through one Context (store.tsx); no repository layer to swap for a backend.
    - Single-user/single-device model; no user or device identity in the schema.
    - Zero test coverage over the progression math.
---

# Quests & Progression

The heart of Garage Reset. This domain turns cleanup chores into an arcade game: **tasks
are quests**, completing them awards **weighted XP**, and that XP (plus a handful of scalar
counters) drives everything the player sees — levels, ranks, streaks, combos, the daily
mission, the weekly team goal, the leaderboard, and achievements.

## Architecture in one picture

```
      pure, no React / no storage                  React Context                 presentational
  ┌───────────────────────────────┐        ┌────────────────────────┐     ┌────────────────────────┐
  │ game.ts   XP·level·rank·streak │        │ store.tsx              │     │ Dashboard  (HUD)       │
  │ lib.ts    nextTasks·progress   │◄───────│  State + actions        │────►│ People     (per player)│
  │ data.ts   seed people/zones    │  reads │  localStorage persist   │     │ Snowball   (play loop) │
  │ types.ts  Task·Item vocab      │        │  fires SFX on complete  │     │ Zones      (by zone)   │
  └───────────────────────────────┘        └────────────────────────┘     │ FinalStandings (results)│
                                                       │                    │ TaskCard / ProgressBar │
                                                       ▼                    └────────────────────────┘
                                              sound singleton (audio-engine)
```

## Files

| File | Lines | Role | Card |
|------|-------|------|------|
| [`src/store.tsx`](../../../src/store.tsx) | 221 | The state hub: `State` + all actions; hydration, persistence, completion side-effects. | [card](../../cards/quests-progression/store.md) |
| [`src/game.ts`](../../../src/game.ts) | 117 | Pure progression math: `xp`, `level`, `rankTitle`, `flameTier`, `dailyMission`, `leaderboard`, `achievements`, combo/weekly constants. | [card](../../cards/quests-progression/game.md) |
| [`src/lib.ts`](../../../src/lib.ts) | 28 | Pure task selection/progress: `nextTasks`, `progress`, `cheer`. | [card](../../cards/quests-progression/lib.md) |
| [`src/data.ts`](../../../src/data.ts) | 72 | Seed data: `people`, `zones`, `seedTasks()`, plus `personName`/`zoneName`. | [card](../../cards/quests-progression/data.md) |
| [`src/types.ts`](../../../src/types.ts) | 44 | Domain vocabulary: `Task`, `Item`, `PersonId`, `ZoneId`, `TaskStatus`, `Decision`. | [card](../../cards/quests-progression/types.md) |
| [`src/components/TaskCard.tsx`](../../../src/components/TaskCard.tsx) | 121 | A quest row: master checkbox or gated sub-step checklist + segmented mini-bar. | [card](../../cards/quests-progression/TaskCard.md) |
| [`src/components/ProgressBar.tsx`](../../../src/components/ProgressBar.tsx) | 22 | The blocky arcade progress bar. | — |
| [`src/screens/Dashboard.tsx`](../../../src/screens/Dashboard.tsx) | 203 | HUD: XP/level bar, streak flame, combo, daily mission, weekly goal, leaderboard, next quests, trophies. | [card](../../cards/quests-progression/Dashboard.md) |
| [`src/screens/Snowball.tsx`](../../../src/screens/Snowball.tsx) | 111 | The play loop: pick a player, clear quests one at a time. | — |
| [`src/screens/People.tsx`](../../../src/screens/People.tsx) | 74 | Per-player stats and quest list. | — |
| [`src/screens/Zones.tsx`](../../../src/screens/Zones.tsx) | 87 | Quests + loot grouped by zone, with clear-a-zone stars. | — |
| [`src/screens/FinalStandings.tsx`](../../../src/screens/FinalStandings.tsx) | 72 | End-of-game leaderboard + rematch. | — |

## The progression system (what's built)

All of the below is **derived** from `tasks` + scalar counters; none of it is stored
directly. Constants live in `game.ts`.

- **XP & levels** — `taskXp = (weight ?? 1) × 50`; level = `floor(totalXp/150)+1`.
- **Ranks** — 5 bands over levels: ROOKIE → GREASE MONKEY → SHELF JOCKEY → CREW CHIEF →
  MASTER ORGANIZER. Crossing a band fires the grander `rankUp` fanfare.
- **Daily mission** — one quest chosen deterministically per day (`hash(dayKey) % n`); first
  completion of it grants `MISSION_BONUS` (25) XP once per day.
- **Streak & flame** — consecutive-day completions; visualized as a growing campfire
  (SPARK → FLAME → BONFIRE → INFERNO via `flameTier`).
- **Combo** — completions within a 3-minute window chain ×1→×3, each step adding
  `COMBO_BONUS` (25) XP.
- **Weekly goal** — a shared team bar: clear 5 quests this week (`WEEKLY_GOAL`), reset by
  `weekKey()`.
- **Quest weight & sub-steps** — quests carry a 1–3 effort weight (XP multiplier) and,
  optionally, 2–4 checkable sub-steps that gate completion (see
  [ROADMAP.md](../../../docs/ROADMAP.md) "Wave 3b").
- **Leaderboard & achievements** — per-person XP ranking; 7 unlockable trophies.

## Key patterns & gotchas

- **Pure core, thin store, dumb views.** `game.ts`/`lib.ts` are the single source of rules
  and are trivially testable in isolation. Screens only read state and call actions.
- **SFX computed outside `setState`, state inside.** `setTaskStatus` and `toggleStep` fire
  celebration sounds from the render-time snapshot *before* calling `setState`, whose
  updater stays pure. This is deliberate — React `StrictMode` double-invokes updaters in dev
  and would otherwise double-play sounds or double-count combos. Preserve this split when
  adding completion-like actions.
- **Extend, don't migrate.** Every wave of mechanics added a pure function (and sometimes a
  `?? default` counter) rather than a storage migration. Old saves keep working.

## Backend/multiplayer readiness

`coupling_score 0.35 · partial · effort large.` The rules are cleanly extractable, but state,
derivation, and persistence all live behind one Context with no repository seam, and the
schema has no notion of *which user on which device*. Going multiplayer means introducing a
sync/repository boundary in `store.tsx` and adding identity to the schema — the derived-XP
design (see [ADR-0002](../../decisions/0002-derived-progression.md)) actually helps, since
only `tasks` + counters need to sync. See
[migration/domain-boundaries.md](../../migration/domain-boundaries.md).
