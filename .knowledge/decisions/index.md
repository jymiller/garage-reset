# Architecture Decision Records

Inferred decisions — reconstructed from the code, `DESIGN.md`, and `docs/ROADMAP.md`, not from
a written record. Each explains what the pattern is, why it was likely chosen, and its impact
on a future backend/multiplayer evolution.

| ADR | Title | Scope | Migration impact |
|-----|-------|-------|:----------------:|
| [0001](0001-single-context-store.md) | One React Context store, persisted to localStorage (local-first) | system-wide | high |
| [0002](0002-derived-progression.md) | Progression is derived, not stored | domain | low |
| [0003](0003-spatial-model-silo.md) | The spatial garage is a decoupled silo, lazy-loaded | domain | medium |
| [0004](0004-family-friendly-only-bonus.md) | Family-friendly "only-ever-bonus, gentle-losing" mechanics | system-wide | none |
| [0005](0005-sound-fired-from-store.md) | Celebration SFX fire from the store, outside the setState updater | domain | low |
| [0006](0006-web-audio-chiptune.md) | Synthesize all sound at runtime (Web Audio), ship no audio files | domain | none |
