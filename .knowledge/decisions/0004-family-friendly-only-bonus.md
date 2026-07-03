---
type: decision
id: ADR-0004
title: Family-friendly "only-ever-bonus, gentle-losing" mechanics
status: inferred
date_inferred: 2026-07-03
scope: system-wide
affects: [quests-progression, audio-engine, arcade-shell]
migration_impact: none
migration_notes: A product/design constraint, not a technical one; preserve it through any refactor.
---

# ADR-0004 — Only-ever-bonus, gentle-losing

## Context
The players are a family (including kids). The app must motivate cleaning without creating
anxiety, punishment, or a guilt-inducing backlog.

## Decision
Every mechanic **only adds**: missions, combos, streaks, and weekly goals grant bonus XP but
never subtract. Losing is soft — last place on the final standings gets a comedic "wah-wah"
(`sound.loser`), never a penalty. The UI always surfaces the next small action and celebrates
wins. Arcade vocabulary stays in the chrome; real task names stay in natural case.

## Why (inferred)
Stated directly in `DESIGN.md` as the core ethos ("momentum, never overwhelm"). It's a
deliberate product stance, reinforced by the roadmap's backlog framing.

## Consequences
- ➕ Safe and encouraging for all ages; drives intrinsic motivation.
- ➕ Constrains feature design in a healthy way (rules out score loss, timers-as-pressure, shame).
- ➖ No "stakes" in the punitive sense — tension comes only from the friendly leaderboard/race.

## Migration impact — none
Purely a design invariant. Any refactor or backend must keep it: no subtractive scoring, no
punishment states, gentle failure. See [conventions.md](../atlas/conventions.md) and
[DESIGN.md](../../DESIGN.md).
