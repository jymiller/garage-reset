---
type: module
name: spatial-garage
display_name: Spatial Garage
status: active
file_locations:
  entry_points: [src/screens/Garage.tsx]
  controllers: []
  models: [src/garage/model.ts]
  views: [src/screens/Garage.tsx, src/garage/Plan3D.tsx]
  services: []
  tests: []
  config: []
dependencies:
  internal: [arcade-shell]
  external: [react, three, "@react-three/fiber", "@react-three/drei"]
  database_tables: []
patterns:
  - type: static domain model (singleton const)
    count: 1
    example: src/garage/model.ts
  - type: lazy-loaded 3D canvas
    count: 1
    example: src/garage/Plan3D.tsx
  - type: dual 2D-SVG / 3D-canvas renderer of one model
    count: 1
    example: src/screens/Garage.tsx
migration:
  coupling_score: 0.15
  session_dependencies: 0
  global_dependencies: 1
  singleton_dependencies: [garage]
  pattern_consistency: 0.9
  abstraction_boundary: clean
  testability: medium
  estimated_effort: medium
  blockers:
    - The model is hardcoded and not persisted; there is no editing/authoring path and no link to tasks/items.
    - three.js is a heavy dependency, isolated to this domain via lazy loading.
---

# Spatial Garage

A **standalone** floor-plan of the physical garage (John's back section), rendered two ways
— a 2D SVG top-down view and a lazy-loaded 3D scene — from one hand-authored model. It shows
each object's **NOW** (current, often spilling past the allotment line) vs. **PLAN** (tidy,
contained) placement.

> **This is a silo.** It reuses the `ZoneId` / `PersonId` / `Decision` types but keeps its
> own object set and positions. It reads **no game state** and never writes anything. Treat
> it as a self-contained mini-app inside the shell.

## Files

| File | Lines | Role | Card |
|------|-------|------|------|
| [`src/garage/model.ts`](../../../src/garage/model.ts) | 183 | The static `GarageModel`: section dimensions, fixed features, and 12 `PlacedObject`s each with a `now` and `plan` `Box`. | [card](../../cards/spatial-garage/model.md) |
| [`src/garage/Plan3D.tsx`](../../../src/garage/Plan3D.tsx) | 177 | The three.js scene: floor/walls/allotment line, one animated `ObjectBox` mesh per object, `OrbitControls`, `Html` labels. | [card](../../cards/spatial-garage/Plan3D.md) |
| [`src/screens/Garage.tsx`](../../../src/screens/Garage.tsx) | 288 | The MAP screen: 2D SVG floor-plan, NOW/PLAN + 2D/3D toggles, selection, detail panel, object legend. Lazy-loads `Plan3D`. | [card](../../cards/spatial-garage/Garage.md) |

## The spatial model

- **Units:** feet. Section is **34 (W→E) × 24 (N→S) × 10.5 ft** ceiling; a faded 9 ft
  "shared" strip extends east past the allotment line.
- **Origin:** `(0,0)` = north-west corner (back wall meets north wall).
- **`Box`** = a footprint given as its NW corner `(x,y)` plus `w` (E–W) and `d` (N–S).
- **`PlacedObject`** = `{ id, label, owner, zone, decision, now: Box, plan: Box, note? }`.
- **Fixed features** (not moveable): oak cabinets, mini-fridge, water heater (cylinder),
  stairs, a people-door and a window on the west wall.
- **12 objects** include the white folding table and banker boxes (both currently **over the
  line**), storage racks, tool chest, weight bench, bikes, an "marooned" dresser, recycle
  bins, and the car.

## Rendering

- **2D (default):** an SVG at 15 px/ft. Objects render as colored rects (`zoneColors`);
  anything whose center is past the allotment line gets a **red dashed** stroke. NOW/PLAN
  animates position with CSS easing. Selecting an object opens a detail panel + highlights it
  in the legend.
- **3D (opt-in):** `React.lazy(() => import('./Plan3D'))` behind `Suspense` so three.js only
  downloads on demand. Boxes lerp smoothly between NOW and PLAN each frame; `OrbitControls`
  gives rotate + zoom (no pan); `Html` badges float above each box.
- **Shared selection:** `selected` object id is owned by `Garage.tsx` and passed to both
  renderers, so selecting in 2D or via the legend stays consistent.

## Backend/multiplayer readiness

`coupling_score 0.15 · clean · effort medium.` Extremely decoupled from the game (reads no
store), so it can move independently — but it's also the *least* dynamic: the model is
hardcoded and not persisted, so there is no authoring/editing path today. The realistic
"evolution" here isn't a backend so much as making the layout **editable and saved** (drag
objects, persist positions), which would mean lifting `garage` into state. three.js is the
one heavy dependency and is already quarantined behind lazy loading. See
[ADR-0003](../../decisions/0003-spatial-model-silo.md).
