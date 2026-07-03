---
type: decision
id: ADR-0001
title: One React Context store, persisted to localStorage (local-first, no backend)
status: inferred
date_inferred: 2026-07-03
scope: system-wide
affects: [quests-progression, capture-inventory, arcade-shell]
migration_impact: high
migration_notes: The single localStorage read/write in store.tsx is the exact seam a backend swaps behind; also the source of the "no identity/no sync" limitation.
---

# ADR-0001 — Single Context store, local-first

## Context
The app is a family utility that should work instantly with zero setup, offline, on a phone,
with no accounts. It has modest state (a handful of tasks/items + counters).

## Decision
Hold all mutable state in one React Context (`StoreProvider` / `useStore()` in `store.tsx`)
and persist the whole object to a single `localStorage` key (`garage-reset-v1`) via one
effect. No Redux/Zustand, no backend, no API, no auth.

## Why (inferred)
- **Zero-friction & offline** matches the product: open the URL and play.
- **Small state** doesn't justify a state library or a server.
- **One hub** keeps mutations and persistence in a single, obvious place.

## Consequences
- ➕ Trivial to reason about; one place to look for state; instant load.
- ➕ New mechanics extend the blob with `?? default` fallbacks — no migrations.
- ➖ Single-user, single-device: no identity, no sync, no conflict handling.
- ➖ The store both derives and persists; there's no repository seam.

## Migration impact — high
This is *the* boundary for any backend/multiplayer future. The good news: writes funnel
through one effect in one file, so the swap is contained. The work is adding a persistence
interface, identity, and a conflict strategy. See
[migration/readiness-overview.md](../migration/readiness-overview.md).
