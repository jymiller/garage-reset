---
type: atlas
title: Bootstrap Chain
last_analyzed: 2026-07-03
bootstrap_chain:
  - step: 1
    file: index.html
    role: Loads Google Fonts (Press Start 2P, VT323), sets viewport/theme-color, mounts #root, loads /src/main.tsx as an ES module.
  - step: 2
    file: src/main.tsx
    role: React root creation; wires a one-time first-gesture listener that primes/unlocks the audio engine; renders <StoreProvider><App/></StoreProvider> in StrictMode.
  - step: 3
    file: src/store.tsx
    role: StoreProvider reads localStorage (garage-reset-v1) into initialState(), re-attaches seed step definitions, exposes state + actions via React Context, and registers the persist-on-change effect.
  - step: 4
    file: src/App.tsx
    role: Gates on `started`; shows TitleScreen until the first tap, then renders the active tab screen + BottomNav; watches for 100% completion to auto-route to FinalStandings.
  - step: 5
    file: src/index.css
    role: Global 8-bit theme — CSS color tokens, arcade component classes, CRT scanline overlay, pixel fonts (loaded via Tailwind v4's @import).
---

# Bootstrap Chain

What happens from "browser opens the page" to "app is interactive." This is a client-only
SPA, so the whole chain runs in the browser — there is no server-side render, no API
handshake, no auth.

```
1. index.html
   ├─ <link> Google Fonts: Press Start 2P + VT323 (display=swap)
   ├─ <meta viewport ... viewport-fit=cover>  +  theme-color #07070e
   ├─ <div id="root">
   └─ <script type="module" src="/src/main.tsx">
                    │
                    ▼
2. src/main.tsx
   ├─ createRoot(document.getElementById('root'))
   ├─ addEventListener('pointerdown', () => { sound.prime() }, { once })   ← iOS audio unlock
   └─ root.render(
        <React.StrictMode>
          <StoreProvider>      ← step 3
            <App />            ← step 4
          </StoreProvider>
        </React.StrictMode>)
                    │
                    ▼
3. src/store.tsx — StoreProvider
   ├─ useState(initialState)
   │    └─ initialState(): read localStorage['garage-reset-v1']
   │         ├─ JSON.parse → Partial<State>
   │         ├─ re-attach steps[] from seedTasks() by task id (backfill done tasks to all-cleared)
   │         └─ per-field fallback to seed / null / 0 on missing or corrupt data
   ├─ build the `value: Store` (state + setTaskStatus, toggleStep, addItem,
   │    setItemDecision, deleteItem, resetAll)
   └─ useEffect([state]): localStorage.setItem('garage-reset-v1', JSON.stringify(state))
                    │
                    ▼
4. src/App.tsx
   ├─ useStore() → { tasks }
   ├─ if (!started) → render <TitleScreen onStart={ prime(); start(); setStarted(true) }>
   ├─ else → render active tab (<Dashboard|People|Snowball|Zones|Capture|Garage|SoundTest|FinalStandings>)
   │          + <BottomNav>
   └─ useEffect: if (started && allCleared(tasks) && !shownResults) → tab='results'
                    │
                    ▼
5. Interactive — every user action calls a store action → setState → persist effect fires.
```

## Key startup facts

- **Audio must be unlocked by a user gesture.** Browsers block `AudioContext` until the
  user interacts. `main.tsx` attaches a one-shot `pointerdown` handler that calls
  `sound.prime()`; the `TitleScreen` tap also calls `prime()` + `start()`. Without this,
  iOS in particular plays nothing. See [ADR-0006](../decisions/0006-web-audio-chiptune.md).
- **State hydration is defensive.** `initialState()` wraps the parse in `try/catch` and
  falls back field-by-field, so a partial or older save never crashes the app — this is how
  new counters (`combo`, `weekTag`, `stepDone`…) were added without a migration.
- **Step definitions are code, not data.** On load the store re-attaches `steps[]` from
  `seedTasks()` by task id, so saved tasks pick up newly authored sub-steps without losing
  `status`/`stepDone`.
- **`StrictMode` double-invokes updaters in dev.** This is why the store computes sound
  side-effects *outside* `setState` (updaters must stay pure and must not double-fire SFX).
  See [maps/quests-progression](../maps/quests-progression/index.md).
- **No route table.** "Routing" is a `tab` string in `App` state switched by `BottomNav`;
  there is no URL router, no history, no deep links.
