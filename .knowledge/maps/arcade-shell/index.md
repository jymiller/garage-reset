---
type: module
name: arcade-shell
display_name: Arcade Shell
status: active
file_locations:
  entry_points: [src/main.tsx, src/App.tsx]
  controllers: [src/App.tsx]
  models: [src/theme.ts]
  views: [src/screens/TitleScreen.tsx, src/components/BottomNav.tsx, src/components/icons.tsx]
  services: []
  tests: []
  config: [index.html, src/index.css]
dependencies:
  internal: [quests-progression, audio-engine]
  external: [react, react-dom]
  database_tables: []
patterns:
  - type: tab-string router in component state
    count: 1
    example: src/App.tsx
  - type: design-token maps
    count: 1
    example: src/theme.ts
  - type: SVG icon component
    count: 10
    example: src/components/icons.tsx
migration:
  coupling_score: 0.5
  session_dependencies: 0
  global_dependencies: 1
  singleton_dependencies: [StoreCtx, sound]
  pattern_consistency: 0.8
  abstraction_boundary: partial
  testability: medium
  estimated_effort: medium
  blockers:
    - Routing is an in-memory tab string with no URL/history; deep links and refresh-to-screen don't exist.
    - App.tsx is the composition root and imports every screen, so it touches all domains.
---

# Arcade Shell

The frame everything else hangs on: the React mount, the "attract screen" gate, screen
routing, the bottom navigation, and the 8-bit design system (CSS theme + color-token maps).

## Files

| File | Lines | Role | Card |
|------|-------|------|------|
| [`src/main.tsx`](../../../src/main.tsx) | 17 | React root; one-shot audio unlock on first gesture; renders `<StoreProvider><App/></StoreProvider>` in StrictMode. | — |
| [`src/App.tsx`](../../../src/App.tsx) | 63 | The router: `started` gate → TitleScreen; `tab` state → active screen + BottomNav; auto-route to FinalStandings at 100%. | [card](../../cards/arcade-shell/App.md) |
| [`src/components/BottomNav.tsx`](../../../src/components/BottomNav.tsx) | 39 | Fixed 6-tab nav bar (HUD/PLAYERS/PLAY/MAP/ZONES/LOOT); `sound.tap()` on switch. | — |
| [`src/components/icons.tsx`](../../../src/components/icons.tsx) | 94 | 10 inline SVG icons (Home, Users, Grid, Bolt, Plus, Map, Flame, Check, Chevron, Trash). | — |
| [`src/screens/TitleScreen.tsx`](../../../src/screens/TitleScreen.tsx) | 25 | Full-screen "PRESS START" attract screen over `art/ui/title.png`. | — |
| [`src/theme.ts`](../../../src/theme.ts) | 52 | Design-token maps: `statusMeta`, `decisionMeta`, `zoneColors`, `arcDecision`, `arcPerson`, `personMeta`. | [card](../../cards/arcade-shell/theme.md) |
| [`src/index.css`](../../../src/index.css) | — | The arcade theme: `--arc-*` color vars, `.arc-panel/.arc-btn/.arc-bar/.arc-input`, CRT scanline overlay, blink/shadow effects, pixel-font setup. | [card](../../cards/arcade-shell/index-css.md) |
| [`index.html`](../../../index.html) | — | Fonts, viewport, theme-color, `#root`, module entry. | — |

## Routing model

There is no router library. `App` holds a `tab` string
(`'dashboard' | 'people' | 'zones' | 'snowball' | 'capture' | 'layout' | 'sound' | 'results'`)
and renders the matching screen. Two gates wrap it:

1. **`started`** — until the first tap on `TitleScreen`, only the title renders (this also
   unlocks audio).
2. **`shownResults`** — an effect watches `allCleared(tasks)`; on reaching 100% it auto-sets
   `tab = 'results'` (FinalStandings) once.

`BottomNav` exposes 6 of the tabs; `'sound'` (SoundTest) and `'results'` (FinalStandings) are
reached programmatically (Dashboard footer / auto-trigger).

| Nav label | Tab | Screen | Domain |
|-----------|-----|--------|--------|
| HUD | `dashboard` | Dashboard | quests-progression |
| PLAYERS | `people` | People | quests-progression |
| PLAY | `snowball` | Snowball | quests-progression |
| MAP | `layout` | Garage | spatial-garage |
| ZONES | `zones` | Zones | quests-progression |
| LOOT | `capture` | Capture | capture-inventory |

## Design system

See [DESIGN.md](../../../DESIGN.md) and [conventions.md](../../atlas/conventions.md).
`index.css` provides the arcade primitives (dark bg, 2px neon borders, hard offset shadows,
CRT scanlines, `steps()` motion, Press Start 2P + VT323). `theme.ts` maps domain values to
colors so meaning is encoded consistently (player, fate, zone, status, reward).

## Backend/multiplayer readiness

`coupling_score 0.5 · partial · effort medium.` As the composition root, `App.tsx` imports
every screen and both singletons, so it naturally has the widest reach — but it's almost
entirely presentational. The real limitation is routing: an in-memory `tab` string means no
URL state, no deep links, no refresh-to-screen. A move to a real router would be the main
shell-level change in any larger evolution. See
[ADR-0001](../../decisions/0001-single-context-store.md).
