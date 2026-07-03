---
type: decision
id: ADR-0006
title: Synthesize all sound at runtime (Web Audio), ship no audio files
status: inferred
date_inferred: 2026-07-03
scope: domain
affects: [audio-engine]
migration_impact: none
migration_notes: Self-contained; portable as a package. No asset pipeline to move.
---

# ADR-0006 — Runtime chiptune, no audio assets

## Context
An 8-bit arcade app needs a lot of little sounds (coins, fanfares, taps). Shipping audio files
adds weight, licensing, and an asset pipeline.

## Decision
Generate every sound at runtime from Web Audio oscillators (`sound.ts`): two primitives
(`blip`, `seq`) compose ~19 named effects. No `.mp3`/`.wav` assets exist. Mute is persisted to
`localStorage['arcade-muted']`. iOS autoplay is handled with a gesture-triggered `prime()`
(silent-buffer unlock + `audioSession = 'playback'`).

## Why (inferred)
- **Tiny & license-free** — no binary assets, no attribution, near-zero bytes.
- **On-brand** — pure square/triangle tones *are* the chiptune aesthetic.
- **Parametric** — effects scale with game state (e.g. `done(weight)`, `combo(step)`).

## Consequences
- ➕ Zero-dependency, self-contained, publishable module; instant to add a new SFX.
- ➕ No asset loading, no CDN, works offline.
- ➖ Requires a user gesture to unlock audio (handled in `main.tsx` + TitleScreen).
- ➖ Timbre is limited to what oscillators + envelopes can do (intentional here).

## Migration impact — none
The audio engine is the most portable unit in the repo. See the
[audio-engine map](../maps/audio-engine/index.md) and [sound card](../cards/audio-engine/sound.md).
