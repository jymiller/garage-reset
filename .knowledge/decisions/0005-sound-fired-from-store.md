---
type: decision
id: ADR-0005
title: Celebration SFX fire from the store, outside the setState updater
status: inferred
date_inferred: 2026-07-03
scope: domain
affects: [quests-progression, audio-engine]
migration_impact: low
migration_notes: The side-effect/reducer split generalizes to a server; keep effects out of the pure transition.
---

# ADR-0005 — SFX from the store, outside the updater

## Context
Completing a quest should play the right sound (coin, combo, level-up vs. rank-up, mission,
weekly-clear) that matches the exact state transition. React `StrictMode` **double-invokes**
state updaters in development, and updaters must be pure.

## Decision
In `store.tsx`, completion actions (`setTaskStatus`, `toggleStep`) compute and fire sound via
`playCompletionSfx(state, id)` **before** `setState`, using the render-time snapshot. The
`setState` updater (`applyCompletion`) performs only the pure state transition.

## Why (inferred)
- **Correctness** — the store knows the full before/after (level, rank, achievements, mission,
  weekly, combo), so it can pick the single right sound; a component can't.
- **StrictMode safety** — firing sound inside the updater would double-play and could
  double-count combos in dev.

## Consequences
- ➕ Sound always tracks the real transition; components stay dumb.
- ➕ Adding a completion-like action means reusing the same two helpers.
- ➖ A little duplication between the snapshot read and the updater (guarded by recomputing
  `justCompleting` from live state to avoid stale-closure double counts).

## Migration impact — low
The "effects outside, pure transition inside" split is exactly how a server reducer +
event/notification emitter should be organized. Preserve it. See the
[store card](../cards/quests-progression/store.md).
