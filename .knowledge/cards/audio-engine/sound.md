---
type: service
name: sound
file: src/sound.ts
pattern: singleton
complexity: medium
public_api:
  - name: prime
    signature: "() => void"
    description: Wake the AudioContext on first gesture; iOS silent-buffer unlock + audioSession playback.
  - name: done
    signature: "(weight = 1) => void"
    description: Quest-complete coin; sequence grows 2→4 notes with the effort weight.
  - name: subTick
    signature: "() => void"
    description: One quiet high blip for a ticked sub-step.
  - name: combo
    signature: "(step: number) => void"
    description: Ratchet whose pitch rises with the combo multiplier.
  - name: levelUp
    signature: "() => void"
    description: 5-note rising fanfare on a level gain.
  - name: rankUp
    signature: "() => void"
    description: Grander 7-note fanfare on crossing a rank band.
  - name: unlock
    signature: "() => void"
    description: 3-note triangle sparkle for an achievement.
  - name: mission
    signature: "() => void"
    description: 4-note jingle for the daily mission.
  - name: weeklyClear
    signature: "() => void"
    description: 6-note fanfare for the weekly team goal.
  - name: comeback
    signature: "() => void"
    description: 3-note welcome-back rise (reserved for the Comeback Coin feature).
  - name: winner
    signature: "() => void"
    description: 8-note champion fanfare (final standings).
  - name: loser
    signature: "() => void"
    description: Gentle 4-note triangle "wah-wah" for last place.
  - name: start
    signature: "() => void"
    description: Space-Invaders descending march on quest/game start.
  - name: "tap / select / back"
    signature: "() => void"
    description: UI nav blips (single / rising / falling).
  - name: "toggle / setMuted / isMuted"
    signature: "() => void | (m) => void | () => boolean"
    description: Global mute control, persisted to arcade-muted.
dependencies:
  globals: [AudioContext, localStorage, navigator.audioSession]
  session_keys: [arcade-muted]
  database_tables: []
  services: []
migration:
  extractable: true
  coupling_score: 0.1
  extraction_notes: >
    Zero app-state coupling. Publishable as a standalone chiptune package almost unchanged; the
    only "coupling" is that callers import the concrete singleton rather than an injected instance.
---

# src/sound.ts — chiptune synth singleton

Runtime-synthesized sound. No audio files anywhere.

## Internals
- **`ac()`** — lazily creates/returns the AudioContext (webkit fallback).
- **`blip(freq, dur, type='square', vol=0.14, delay=0)`** — one oscillator, fast attack /
  exponential decay.
- **`seq(notes, step, dur, type, vol)`** — a staggered run of blips.
- **`muted`** — module-scope flag mirrored to `localStorage['arcade-muted']`; every method
  early-returns when muted.

## iOS
`prime()` plays a silent 1-sample buffer and sets `navigator.audioSession.type = 'playback'`
so audio survives the hardware silent switch. Must be triggered by a user gesture — wired in
`main.tsx` and on the TitleScreen tap.

## Integration
The celebration SFX (`done`, `combo`, `levelUp`/`rankUp`, `mission`, `unlock`, `weeklyClear`)
are called from the **store's** completion path so sound tracks the exact state transition and
never double-fires under StrictMode. See [ADR-0005](../../decisions/0005-sound-fired-from-store.md).
The full catalog is auditable on the **SoundTest** screen.
