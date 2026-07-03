---
type: atlas
title: Data Model (localStorage "database")
last_analyzed: 2026-07-03
---

# Data Model

There is no database. All persistent state is a single JSON object written to
`localStorage` under the key **`garage-reset-v1`**, plus one boolean under
**`arcade-muted`**. This page is the schema of record.

## Storage keys

| Key | Owner | Shape | Written by |
|-----|-------|-------|-----------|
| `garage-reset-v1` | `src/store.tsx` | The full `State` object (below) | `StoreProvider` effect, on every state change |
| `arcade-muted` | `src/sound.ts` | `"0"` or `"1"` | `sound.setMuted()` |

## The `State` object

Defined in [`src/store.tsx`](../../src/store.tsx) (`interface State`). Serialized whole on
each change; re-hydrated (with per-field fallbacks) on load.

```ts
interface State {
  tasks: Task[]          // the quests — seeded on first run, mutated as they progress
  items: Item[]          // captured "loot"
  streak: number         // consecutive-day completion streak
  lastDay: string | null // day-string of the last completion ("YYYY-M-D")
  bonusXp: number        // XP from missions + combos, tracked separately from task XP
  missionDay: string | null // day the daily mission was claimed (dedupes the bonus)
  weekTag: string | null    // week-key the weekly counter belongs to ("YYYY-Wnn")
  weekDone: number          // quests cleared this week (toward WEEKLY_GOAL = 5)
  combo: number             // current combo multiplier (1..COMBO_MAX=3)
  lastDoneAt: number | null // epoch ms of the last completion (drives the combo window)
}
```

### Entities

#### `Task` (a quest) — `src/types.ts`
```ts
interface Task {
  id: string            // "seed-<n>"
  title: string         // shown to the player, natural case
  person: PersonId      // owner: 'john' | 'griffin' | 'lj'
  zone: ZoneId          // one of 6 zones
  status: TaskStatus    // 'not-started' | 'in-progress' | 'done' | 'blocked'
  order: number         // sort order within a zone / the seed
  weight?: number       // 1–3 effort tier → 50/100/150 XP (defaults to 1)
  steps?: string[]      // pit-stop sub-step labels (static; re-attached from seed on load)
  stepDone?: boolean[]  // per-step completion, parallels steps (runtime)
}
```
Seeded by `seedTasks()` in [`src/data.ts`](../../src/data.ts) — 10 quests across 3 people.

#### `Item` (loot) — `src/types.ts`
```ts
interface Item {
  id: string            // crypto.randomUUID()
  name: string
  owner: PersonId | null
  zone: ZoneId | null
  decision: Decision    // 'undecided' | 'keep' | 'move' | 'donate' | 'trash'
  createdAt: number     // epoch ms
}
```

#### Reference data (not persisted; defined in code)
- **People** (`src/data.ts`): `john`, `griffin`, `lj`.
- **Zones** (`src/data.ts`): `griffin-workshop`, `griffin-fitness`, `lj-clothing`,
  `john-table`, `shared-storage`, `exit-zone`.

## Derived state (never stored)

Everything in the progression system is **computed on the fly** from `tasks` + the scalar
counters — nothing about levels, ranks, or the leaderboard is persisted. See
[`src/game.ts`](../../src/game.ts):

| Value | Source | Formula |
|-------|--------|---------|
| Task XP | `taskXp(t)` | `(weight ?? 1) × 50` |
| Total XP | `xp(tasks)` + `bonusXp` | sum of done-task XP + bonuses |
| Level | `level(totalXp)` | `floor(totalXp / 150) + 1` |
| Rank | `rankTitle(lvl)` | 5 bands: ROOKIE → GREASE MONKEY → SHELF JOCKEY → CREW CHIEF → MASTER ORGANIZER |
| Flame tier | `flameTier(streak)` | NO STREAK → SPARK → FLAME → BONFIRE → INFERNO |
| Leaderboard | `leaderboard(tasks)` | per-person XP + done/total, sorted desc |
| Achievements | `achievements(tasks, items, streak)` | 7 unlock predicates |
| Daily mission | `dailyMission(tasks, dayKey)` | deterministic pick by `hash(dayKey) % tasks.length` |

Because the progression is derived, **the "save file" is small and forward-compatible**:
new mechanics (ranks, combos, sub-steps) were added by introducing new pure functions and,
where needed, new scalar counters — old saves re-hydrate via the per-field `?? default`
fallbacks in `initialState()`.

## The parallel spatial model

The 3D garage uses a **separate, static, non-persisted** model in
[`src/garage/model.ts`](../../src/garage/model.ts): a `GarageModel` with section dimensions
(34 × 24 × 10.5 ft), fixed features (cabinets, water heater, stairs…), and 12 `PlacedObject`
entries each with a `now` and a `plan` footprint (`Box`). It reuses the `ZoneId`, `PersonId`,
and `Decision` types but is **not** connected to `tasks`/`items` and is never written back.
See [maps/spatial-garage](../maps/spatial-garage/index.md).

## Migration note

The persistence surface is tiny and localized (one read + one write in `store.tsx`), which
makes swapping `localStorage` for a synced backend a **contained** change — but the schema
is a single-user, single-device blob with no IDs for users or devices and no conflict
handling. See [migration/readiness-overview.md](../migration/readiness-overview.md).
