---
type: card
module: arcade-shell
file: src/index.css
complexity: medium
lines: 0
last_analyzed: 2026-07-03
migration:
  global_refs: []
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: []
  side_effects: []
  singleton_pattern: false
  extractable: true
  extraction_notes: The 8-bit theme; portable stylesheet.
---

# src/index.css — the 8-bit theme

The hand-written stylesheet that carries the arcade look (Tailwind v4 handles utilities; this
file owns the identity).

## Color tokens (`--arc-*`)
`--arc-bg #07070e`, `--arc-panel #0d0d18`, `--arc-green #2bd14a`, `--arc-green-dim #6cf08a`,
`--arc-pink #ff3ca6`, `--arc-yellow #ffd23f`, `--arc-cyan #36e0e0`, `--arc-white #e8e8f5`,
`--arc-mute #8a8aa6`.

## Component classes
- **`.arc-panel`** (+ `-pink` / `-yellow` / `-dim`) — bordered card.
- **`.arc-btn`** (+ `-pink`) — chunky button with a hard offset shadow that collapses on
  `:active` (~50ms press-in); disabled variant.
- **`.arc-bar`** / **`.arc-bar-fill`** — blocky XP/progress bar; fill is a repeating pixel
  gradient and transitions width in `steps(8)` (ticks, not glide).
- **`.arc-input`** — VT323 text field; focus border turns yellow.
- **`.arc-vt`** / **`.font-pixel`** — VT323 / Press Start 2P font overrides.
- **`.arc-blink`** (choppy 1s `steps(1)` blink) and **`.arc-shadow`** (hard text drop-shadow).

## Global texture
- `body::after` CRT **scanline** overlay (1px line every 3px, `pointer-events: none`).
- `-webkit-font-smoothing: none` for crisp pixel edges.
- `.pb-safe` adds iOS safe-area padding under the fixed nav.
- Dark-only (`color-scheme: dark`), base font VT323 @ 18px.

See [DESIGN.md](../../../DESIGN.md) for the intent behind each choice.
