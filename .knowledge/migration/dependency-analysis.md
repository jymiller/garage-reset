---
type: migration_assessment
scope: system-wide
last_analyzed: 2026-07-03
---

# Dependency Analysis

How the five domains depend on each other, and where shared/global state concentrates.

## Domain × domain coupling matrix

Rows depend on columns. `●` = direct import/usage, `○` = shared types only, blank = none.

| depends ↓ / on → | quests | capture | spatial | shell | audio |
|------------------|:------:|:-------:|:-------:|:-----:|:-----:|
| **quests-progression** | — | | | | ● |
| **capture-inventory** | ● | — | | | |
| **spatial-garage** | ○ | ○ | — | ● | |
| **arcade-shell** | ● | ● | ● | — | ● |
| **audio-engine** | | | | | — |

Reading the matrix:

- **audio-engine** depends on nothing — a true leaf. It is depended on by quests-progression
  (celebration SFX from the store) and arcade-shell (`tap` on nav, `start`/`prime`).
- **quests-progression** depends only on audio. `capture-inventory` reuses its store + types.
- **spatial-garage** imports the shell's `theme.ts` and shares `types.ts` (`ZoneId`,
  `PersonId`, `Decision`) but touches **no game state** — the `○` marks type-only reuse.
- **arcade-shell** is the composition root, so it imports every domain (that's expected of a
  root and is why its coupling score is highest at 0.5).

There are **no cycles**. The dependency graph is a shallow DAG rooted at the shell.

## Shared / global state hotspots

| Global | Kind | Read by | Written by | Notes |
|--------|------|---------|-----------|-------|
| `garage-reset-v1` | localStorage blob | `store.tsx` (hydrate) | `store.tsx` (persist effect) | The whole game save. Single reader/writer — clean. |
| `arcade-muted` | localStorage bool | `sound.ts` | `sound.ts` | Sound preference. Single owner. |
| `sound` | module singleton | store + ~5 screens (`Dashboard`, `Snowball`, `BottomNav`, `SoundTest`, `FinalStandings`, `App`/`main`) | itself | Imported directly everywhere; the most widely-referenced singleton. |
| `StoreCtx` | React Context | every game screen via `useStore()` | `StoreProvider` | The state hub. |
| `garage` | const model | `Garage.tsx`, `Plan3D.tsx` | never | Static; not persisted. |
| `muted` | module var (in `sound.ts`) | `sound.*` methods | `setMuted` | Backed by `arcade-muted`. |

**Concentration is healthy:** each piece of shared state has exactly one owner/writer. The
two localStorage keys are each read and written in a single file. The only "spread" is that
the `sound` singleton is imported by many callers — a convenience coupling, not a state-sharing
hazard.

## Implication for evolution

Because writes to the game save funnel through **one effect in one file**, the seam for a
backend is singular and obvious: replace `store.tsx`'s `localStorage.getItem`/`setItem` with a
persistence interface. Nothing else in the app reads or writes the save. The widely-imported
`sound` singleton is unaffected by a data-layer change. See
[domain-boundaries.md](domain-boundaries.md) for the recommended order.
