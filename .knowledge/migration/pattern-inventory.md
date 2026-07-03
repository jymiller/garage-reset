---
type: migration_assessment
scope: system-wide
last_analyzed: 2026-07-03
---

# Pattern Inventory

The recurring code patterns in the app, where they appear, and how each behaves under a
future backend/multiplayer evolution.

## 1. Pure derivation function

**What:** stateless functions that compute a value from `tasks`/`items`/counters.
**Where:** all of `game.ts` (`xp`, `level`, `rankTitle`, `flameTier`, `leaderboard`,
`achievements`, `dailyMission`) and `lib.ts` (`nextTasks`, `progress`, `cheer`).
**Count:** ~15 functions.

```ts
export const xp = (tasks: Task[], person?: PersonId) =>
  doneTasks(tasks, person).reduce((sum, t) => sum + taskXp(t), 0)
```

**Evolution path:** *Best-in-class.* Fully portable to a server or shared package as-is.
This is where tests should start.

## 2. React Context store (single hub)

**What:** one provider holds all state + actions; `useStore()` reads it.
**Where:** `store.tsx`. **Count:** 1 (with 6 actions).

**Evolution path:** Keep the hub, but insert a persistence interface behind it so the
`localStorage` calls become swappable. The action surface itself is already backend-shaped
(command-like: `setTaskStatus`, `addItem`…).

## 3. Compute-SFX-outside / mutate-inside

**What:** completion actions read the render-time snapshot to fire sound *before* calling a
pure `setState` updater — so `StrictMode`'s double-invoke doesn't double-play or double-count.
**Where:** `store.tsx` `setTaskStatus`, `toggleStep` (via `playCompletionSfx` + `applyCompletion`).
**Count:** 2 actions, 2 shared helpers.

```ts
if (completing) playCompletionSfx(state, id)   // side-effects: closure snapshot
setState((s) => applyCompletion(s, id))        // pure state transition
```

**Evolution path:** On a server, side-effects (notifications, sound-trigger events) similarly
belong outside the reducer. This split generalizes well; preserve it.

## 4. Presentational screen reading `useStore()`

**What:** a full-screen view that pulls fields from the store and calls actions; layout via
Tailwind + `.arc-*` classes. **Where:** all `src/screens/*` except `Garage`/`SoundTest`/`TitleScreen`.
**Count:** ~5.

**Evolution path:** Unaffected by a backend swap as long as the store's interface holds.

## 5. Static domain model as a singleton const

**What:** a hardcoded data object imported directly. **Where:** `garage` in `garage/model.ts`;
also `people`/`zones`/seed in `data.ts`. **Count:** 2.

**Evolution path:** `people`/`zones` are legitimate reference data (fine to keep in code or
move to config). The `garage` model, by contrast, wants to become *editable, persisted state*
if the map is ever made interactive.

## 6. Module singleton with private state

**What:** a module that owns private mutable state and exposes methods. **Where:** `sound.ts`
(`muted`, AudioContext). **Count:** 1.

**Evolution path:** Trivially extractable as a package. For testability, an injected instance
would be cleaner than a direct import, but this is low priority.

## 7. Lazy-loaded heavy subtree

**What:** `React.lazy(() => import(...))` + `Suspense` to defer a heavy dependency.
**Where:** `Garage.tsx` deferring `Plan3D` (and thus three.js). **Count:** 1.

**Evolution path:** Good practice already in place; extend to any other heavy/rare screens.

## 8. String-literal union as an enum

**What:** domain vocab as `'a' | 'b'` unions rather than TS enums. **Where:** `types.ts`
(`PersonId`, `ZoneId`, `TaskStatus`, `Decision`). **Count:** 4.

**Evolution path:** Serialize cleanly to JSON and map directly to DB columns/enums. No change
needed.

## 9. Extend-don't-migrate state growth

**What:** new mechanics add a pure function and, if needed, a scalar counter with a
`?? default` fallback in `initialState()` — never a destructive migration. **Where:** every
"wave" in `docs/ROADMAP.md`. **Count:** ongoing.

**Evolution path:** This convention is exactly what makes a schema-versioned backend
migration low-risk; formalize it with an explicit `version` field when identity is added.
