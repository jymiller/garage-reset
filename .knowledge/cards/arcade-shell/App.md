---
type: card
module: arcade-shell
file: src/App.tsx
complexity: medium
lines: 63
last_analyzed: 2026-07-03
migration:
  global_refs: [sound]
  session_keys_read: ["garage-reset-v1 (via useStore)"]
  session_keys_written: []
  db_tables_touched: ["garage-reset-v1"]
  side_effects: [plays start SFX, primes audio]
  singleton_pattern: false
  extractable: false
  extraction_notes: The composition root; imports every screen. Routing is an in-memory tab string.
---

# src/App.tsx — the router / composition root

Gates the app, picks the active screen, and mounts the nav.

## Gates & state
- `started` — until the first `TitleScreen` tap, only the title renders. The tap calls
  `sound.prime()` + `sound.start()` then `setStarted(true)`.
- `tab` — one of 8 strings; selects which screen renders.
- `shownResults` — an effect watches `allCleared(tasks)`; on reaching 100% it sets
  `tab = 'results'` once (auto-route to FinalStandings), and resets if the game becomes
  incomplete again.

## Screen table
`dashboard→Dashboard`, `people→People`, `zones→Zones`, `snowball→Snowball`,
`capture→Capture`, `layout→Garage`, `sound→SoundTest`, `results→FinalStandings`. `BottomNav`
renders below (except on the title screen).

## Notes
- No router library, no URL/history — "routing" is component state. This is the main
  shell-level limitation for a shareable/multiplayer future (see
  [ADR-0001](../../decisions/0001-single-context-store.md) and
  [migration/domain-boundaries.md](../../migration/domain-boundaries.md)).
