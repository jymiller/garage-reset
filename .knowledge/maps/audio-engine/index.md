---
type: module
name: audio-engine
display_name: Audio Engine
status: active
file_locations:
  entry_points: [src/sound.ts]
  controllers: []
  models: []
  views: [src/screens/SoundTest.tsx]
  services: [src/sound.ts]
  tests: []
  config: []
dependencies:
  internal: []
  external: []
  database_tables: [arcade-muted (localStorage)]
patterns:
  - type: module singleton with private state
    count: 1
    example: src/sound.ts
  - type: oscillator synthesis primitive (blip/seq)
    count: 2
    example: src/sound.ts
migration:
  coupling_score: 0.1
  session_dependencies: 1
  global_dependencies: 1
  singleton_dependencies: [sound]
  pattern_consistency: 0.95
  abstraction_boundary: clean
  testability: medium
  estimated_effort: small
  blockers:
    - It is a module-level singleton imported directly by callers (no injection), which is convenient but couples callers to the concrete module.
---

# Audio Engine

A self-contained chiptune synthesizer. Every sound in the app is generated at runtime from
Web Audio oscillators — **there are no audio files**. Exposed as the `sound` singleton,
imported directly wherever feedback is needed.

## Files

| File | Lines | Role | Card |
|------|-------|------|------|
| [`src/sound.ts`](../../../src/sound.ts) | 162 | The `sound` singleton: AudioContext lifecycle, iOS unlock, mute (persisted to `arcade-muted`), `blip`/`seq` primitives, and ~19 named SFX methods. | [card](../../cards/audio-engine/sound.md) |
| [`src/screens/SoundTest.tsx`](../../../src/screens/SoundTest.tsx) | 74 | A debug screen listing every SFX with a play button + mute toggle. | — |

## How synthesis works

- **Two primitives.** `blip(freq, dur, type, vol, delay)` plays one oscillator with a fast
  attack / exponential decay envelope; `seq(notes, step, dur, type, vol)` fires a run of
  blips staggered by `step`. Every named effect is built from these.
- **Waveforms carry mood.** `square` for bright arcade hits; `triangle` for softer cues
  (`unlock`, `loser`).
- **Mute is global + persisted.** State lives in module scope and `localStorage['arcade-muted']`;
  every method early-returns when muted.

## The SFX vocabulary

| Method | When | Shape |
|--------|------|-------|
| `done(weight)` | quest completed | coin; sequence grows 2→4 notes with weight |
| `subTick()` | sub-step ticked | one quiet high blip |
| `combo(step)` | combo chained | ratchet, pitch rises with the multiplier |
| `levelUp()` / `rankUp()` | level / rank-band up | 5-note / grander 7-note rising fanfare |
| `unlock()` | achievement | 3-note triangle sparkle |
| `mission()` | daily mission cleared | 4-note jingle |
| `weeklyClear()` | weekly goal hit | 6-note fanfare |
| `comeback()` | (reserved) welcome-back | 3-note rise |
| `winner()` / `loser()` | final standings | 8-note champion fanfare / gentle 4-note "wah-wah" |
| `start()` | quest/game start | Space-Invaders descending march |
| `tap()` / `select()` / `back()` | UI nav | single / rising / falling blip |
| `prime()` | first gesture | wakes the AudioContext (iOS unlock) |
| `toggle()` / `setMuted()` / `isMuted()` | mute control | — |

## iOS handling

`prime()` plays a silent 1-sample buffer to satisfy autoplay policy and attempts
`navigator.audioSession.type = 'playback'` so sound plays through the hardware silent switch.
This is why `main.tsx` and `TitleScreen` both call `prime()` on first interaction. See
[ADR-0006](../../decisions/0006-web-audio-chiptune.md).

## The store integration that matters

Celebration SFX (`done`, `combo`, `rankUp`/`levelUp`, `mission`, `unlock`, `weeklyClear`) are
**fired from the store's completion path**, not the components — so the sound always matches
the exact state transition and never double-fires under `StrictMode`. See
[ADR-0005](../../decisions/0005-sound-fired-from-store.md).

## Backend/multiplayer readiness

`coupling_score 0.1 · clean · effort small.` The single cleanest unit in the codebase — zero
dependencies, zero app-state coupling, a tidy method surface. It could be published as a
standalone npm package almost unchanged. The only "coupling" is that callers import the
concrete singleton directly rather than receiving it via injection.
