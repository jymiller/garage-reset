---
type: decision
id: ADR-0002
title: Progression is derived, not stored
status: inferred
date_inferred: 2026-07-03
scope: domain
affects: [quests-progression]
migration_impact: low
migration_notes: Derivation keeps the syncable state tiny (tasks + a few counters), which helps a future backend rather than hurting it.
---

# ADR-0002 — Derived progression

## Context
The game shows XP, levels, ranks, a leaderboard, streaks, combos, missions, weekly goals, and
achievements — a lot of numbers that must always agree.

## Decision
Store only the primitives (`tasks`, `items`, and scalar counters like `streak`, `bonusXp`,
`combo`, `weekDone`). Compute everything else on the fly with pure functions in `game.ts` /
`lib.ts`. XP is never persisted — it's `xp(tasks) + bonusXp` recomputed each render.

## Why (inferred)
- **One source of truth** — no denormalized aggregates to keep in sync or repair.
- **Testable rules** — pure functions with no React/storage.
- **Forward-compatible saves** — new derived mechanics need no data migration.

## Consequences
- ➕ Unmarking a task automatically removes its XP; no bug-prone bookkeeping.
- ➕ The save file stays tiny and stable across feature waves.
- ➖ Everything recomputes on each render (irrelevant at this scale).
- ➖ Non-derivable extras (mission/combo bonuses) still need their own counters — handled with
  the separate `bonusXp` field.

## Migration impact — low (helpful)
Because only a small, well-defined blob is authoritative, a sync layer moves less data and
avoids cache-coherency bugs. This decision makes the multiplayer path easier.
