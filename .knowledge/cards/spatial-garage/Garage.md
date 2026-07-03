---
type: card
module: spatial-garage
file: src/screens/Garage.tsx
complexity: high
lines: 288
last_analyzed: 2026-07-03
migration:
  global_refs: [garage (model)]
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: []
  side_effects: [lazy-loads three.js chunk]
  singleton_pattern: false
  extractable: true
  extraction_notes: Reads the static model + theme + name lookups; no store. Self-contained MAP screen.
---

# src/screens/Garage.tsx — the MAP screen

Hosts both renderings of the spatial model and the controls around them.

## Local state
- `mode`: `'now' | 'plan'` — current vs. planned placement.
- `view`: `'2d' | '3d'` — SVG floor plan vs. lazy `Plan3D`.
- `selected`: object id (shared with both renderers).

## 2D SVG (default)
- 15 px/ft top-down plan; `px(box)` maps feet → pixels.
- Draws the shared strip, your-section floor, dashed amber allotment line, back-wall
  door/window, direction labels, and fixed features (via `FeatureRect` + a water-heater
  circle).
- Objects render as clickable rects colored by `zoneColors`; **over-the-line** objects get a
  red dashed stroke; NOW/PLAN transitions animate via CSS easing; non-selected fade when one
  is selected.

## 3D (opt-in)
- `React.lazy(() => import('../garage/Plan3D'))` inside `<Suspense fallback="LOADING 3D…">`,
  so three.js only downloads when the player switches to 3D.

## Around the map
- **Detail panel** for the selected object (label, zone, owner, decision badge, note).
- **Legend** listing every object (except the car) with a color swatch — clicking selects.
- Footer: "inferred from photos — positions are a draft."

## Data sources
`garage` model + `zoneName`/`personName` (data.ts) + `zoneColors`/`arcDecision` (theme.ts).
**No store usage.**
