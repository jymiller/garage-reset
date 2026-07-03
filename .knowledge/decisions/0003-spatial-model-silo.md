---
type: decision
id: ADR-0003
title: The spatial garage is a decoupled silo, lazy-loaded
status: inferred
date_inferred: 2026-07-03
scope: domain
affects: [spatial-garage]
migration_impact: medium
migration_notes: Isolation lets the map evolve independently; the real work is making it editable/persisted, and three.js is quarantined behind a lazy import.
---

# ADR-0003 — Spatial garage as a lazy-loaded silo

## Context
Visualizing the physical garage in 2D and 3D needs three.js — a large dependency — and a
spatial data model that doesn't map onto the quest/leaderboard game.

## Decision
Keep the spatial system self-contained: a hardcoded `GarageModel` (`garage/model.ts`), a 2D
SVG + a 3D `Plan3D`, all in `src/garage/` + `Garage.tsx`. It reuses the shared
`ZoneId`/`PersonId`/`Decision` types but reads **no game state**. `Plan3D` (and thus three.js)
is `React.lazy`-loaded only when the MAP tab opens.

## Why (inferred)
- **Different problem shape** — placement/geometry, not scoring — warrants its own model.
- **Bundle cost** — three.js shouldn't load for players who never open the map.
- **Independence** — the map can change without touching the game loop.

## Consequences
- ➕ Near-zero coupling to the rest of the app; smallest initial bundle.
- ➕ 2D and 3D share one model + one `selected` id, so they stay consistent.
- ➖ The model is static and not persisted — there's no way to edit or save the layout.
- ➖ Object positions are photo-inferred drafts, not authoritative.

## Migration impact — medium
The natural evolution isn't a backend but **interactivity**: lift `garage` into state, allow
drag-to-move, and persist it. That's independent of the multiplayer track. See
[migration/domain-boundaries.md](../migration/domain-boundaries.md).
