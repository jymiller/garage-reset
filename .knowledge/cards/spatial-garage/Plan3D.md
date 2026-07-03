---
type: card
module: spatial-garage
file: src/garage/Plan3D.tsx
complexity: high
lines: 177
last_analyzed: 2026-07-03
migration:
  global_refs: [garage (model)]
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: []
  side_effects: [WebGL rendering]
  singleton_pattern: false
  extractable: true
  extraction_notes: >
    Pure view over props + the static model. three.js is heavy but already quarantined behind
    the lazy import in Garage.tsx.
---

# src/garage/Plan3D.tsx — the 3D scene

The three.js rendering of the garage, lazy-loaded on demand.

## Stack
`@react-three/fiber` `<Canvas>` with `@react-three/drei` helpers (`OrbitControls`, `Html`,
`Edges`) over `three@0.185`.

## Scene (`Scene`)
- **Lighting:** ambient (0.75) + a shadow-casting directional light.
- **Ground:** your-section plane + a lighter shared strip + a `gridHelper`.
- **Walls:** back/north/south at 50% opacity (open to the east at the allotment line).
- **Allotment line:** an emissive amber bar — the visual "your line."
- **People door:** a translucent panel on the west wall.
- **Objects:** one `<ObjectBox>` per `garage.objects` entry.
- **Controls:** `OrbitControls` — rotate + zoom (`enablePan={false}`), clamped polar angle.

## `ObjectBox`
- Computes a world-space center from the `now` or `plan` `Box` (feet → recentered coords) and
  a per-object height (`HEIGHTS` lookup).
- `useFrame` **lerps** position toward the target each frame (0.14) so NOW↔PLAN animates
  smoothly; selection scales it 1.08×.
- Material color from `zoneColors`; `<Edges>` outline; a floating `<Html>` badge label.
- `onClick` selects (stops propagation); the Canvas `onPointerMissed` clears selection.

## Notes
- Reads **only** props (`mode`, `selected`, `onSelect`) and the static `garage` model — no
  store.
- Camera is a fixed isometric-ish `[20,19,22]`, fov 42.
