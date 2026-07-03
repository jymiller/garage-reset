---
type: card
module: quests-progression
file: src/game.ts
complexity: medium
lines: 117
last_analyzed: 2026-07-03
migration:
  global_refs: [Date]
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: []
  side_effects: []
  singleton_pattern: false
  extractable: true
  extraction_notes: >
    100% pure, no React, no storage. Portable to a server or shared package as-is. This is
    where a test suite should start.
---

# src/game.ts — pure progression math

The rulebook. Every progression value is a pure function of `tasks` / `items` / counters;
nothing here reads or writes state.

## Exports

**XP & levels**
- `XP_PER_TASK = 50`, `taskXp(t) = (weight ?? 1) × 50`
- `xp(tasks, person?)` — sum of done-task XP
- `level(totalXp)` → `{ lvl, into, per: 150, pct }`
- `allCleared(tasks)`

**Ranks**
- `RANKS` (5) + `rankIndex(lvl)` (band 0–4 over levels 1/3/5/7/10) + `rankTitle(lvl)`

**Streak / flame**
- `flameTier(streak)` → `{ name, color }` across NO STREAK → SPARK → FLAME → BONFIRE → INFERNO

**Combo & weekly constants**
- `COMBO_WINDOW = 180000` (3 min), `COMBO_MAX = 3`, `COMBO_BONUS = 25`
- `WEEKLY_GOAL = 5`, `weekKey(date?)` → `"YYYY-Wnn"`

**Mission**
- `MISSION_BONUS = 25`, `todayKey()`, `dailyMission(tasks, dayKey)` — deterministic pick via a
  small string `hash()` mod task count

**Aggregates**
- `leaderboard(tasks)` — per-person `{ points, done, total }`, sorted desc
- `achievements(tasks, items, streak)` — 7 predicates (First Blood, On Fire, Warming Up,
  Halfway Hero, Zone Wipe, Quartermaster, Boss Defeated)

## Notes

- Uses `new Date()` / `Date.now()` for day/week keys and combo timing — the only
  environmental input; everything else is a pure transform of its arguments.
- Because these functions are the single source of the game's numbers, they should be the
  first (and easiest) thing to unit-test. Currently untested.
