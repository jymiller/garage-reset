---
type: card
module: quests-progression
file: src/store.tsx
complexity: high
lines: 221
last_analyzed: 2026-07-03
migration:
  global_refs: [localStorage, sound, crypto.randomUUID, Date.now]
  session_keys_read: ["garage-reset-v1"]
  session_keys_written: ["garage-reset-v1"]
  db_tables_touched: ["garage-reset-v1 (localStorage)"]
  side_effects: [localStorage read/write, plays sound on completion]
  singleton_pattern: true
  extractable: false
  extraction_notes: >
    The single seam between the app and its persistence. To back it with a server, insert a
    load()/save() persistence interface here and add identity/versioning to State. The action
    surface is already command-shaped.
---

# src/store.tsx — the state hub

The one place all mutable game state lives, is derived alongside, is persisted, and fires
completion side-effects. Exposed via `StoreProvider` + `useStore()` (React Context).

## Shape

- **`interface State`** — `tasks`, `items`, and the progression counters (`streak`, `lastDay`,
  `bonusXp`, `missionDay`, `weekTag`, `weekDone`, `combo`, `lastDoneAt`). See
  [data-model.md](../../atlas/data-model.md).
- **`interface Store extends State`** — the actions: `setTaskStatus`, `toggleStep`, `addItem`,
  `setItemDecision`, `deleteItem`, `resetAll`.

## Lifecycle

1. **`initialState()`** — reads `localStorage['garage-reset-v1']`, `JSON.parse`, re-attaches
   `steps[]` from `seedTasks()` by id (backfilling done tasks to all-cleared), then falls back
   field-by-field on anything missing/corrupt. Wrapped in `try/catch`.
2. **`useEffect([state])`** — serializes the whole `State` back to localStorage on every change.
3. **Actions** build a fresh `value: Store` each render.

## The completion machinery (the important part)

Two helpers keep the completion logic DRY and `StrictMode`-safe:

- **`playCompletionSfx(state, id)`** — pure-read of the render-time snapshot; projects the
  task as done, compares before/after `level`/`rankIndex`/`achievements`, checks
  mission/weekly/combo, and fires the right sounds. Called **outside** `setState`.
- **`applyCompletion(state, id)`** — the pure state transition: mark task done, `bumpStreak`,
  add mission + combo bonus XP, roll `weekTag`/`weekDone`/`combo`/`lastDoneAt`. Called
  **inside** the `setState` updater.

`setTaskStatus` (for the `done` transition) and `toggleStep` (when the final sub-step clears)
both funnel through this pair. The updater recomputes `justCompleting` from the live `s` to
guard against stale-closure double counts.

## Gotchas

- **Never move SFX into the `setState` updater** — React `StrictMode` double-invokes updaters
  in dev; sounds would double-fire and combos could double-count. Side-effects stay in the
  closure snapshot before `setState`.
- **`steps` is a definition, not save data.** It's re-attached from the seed on load; only
  `status`/`stepDone` are authoritative from storage.
- **XP is never stored.** Unmarking a task removes its XP automatically because XP is derived.

## Migration note

This file *is* the data-layer boundary. It currently derives and persists in one place with no
repository seam and no identity in the schema — the top two blockers for multiplayer. See
[migration/readiness-overview.md](../../migration/readiness-overview.md).
