---
type: card
module: spatial-garage
file: src/garage/model.ts
complexity: medium
lines: 183
last_analyzed: 2026-07-03
migration:
  global_refs: []
  session_keys_read: []
  session_keys_written: []
  db_tables_touched: []
  side_effects: []
  singleton_pattern: true
  extractable: true
  extraction_notes: >
    A hardcoded static model exported as a const. To make the map interactive it must become
    editable, persisted state rather than a code constant.
---

# src/garage/model.ts — the spatial model

The hand-authored floor plan, shared by the 2D and 3D renderers.

## Types
- **`Box`** = `{ x, y, w, d }` — a footprint; `(x,y)` is the **north-west corner**, `w` is
  E–W extent, `d` is N–S extent, all in **feet**.
- **`PlacedObject`** = `{ id, label, owner, zone, decision, now: Box, plan: Box, note? }` —
  a moveable object with current (`now`) and target (`plan`) placement.
- **`GarageModel`** = section dimensions + fixed features + `objects[]`.

## The `garage` const
- **Section:** 34 (W→E) × 24 (N→S) × 10.5 ft ceiling; origin `(0,0)` at the NW corner; a
  faded 9 ft shared strip east of the allotment line.
- **Fixed features:** people door + window (west wall), oak cabinets, mini-fridge, water
  heater (cylinder), stairs.
- **12 objects:** storage racks, tool chest, weight bench, bikes, dresser (marooned
  mid-floor), white folding table + banker boxes (both currently **over the line**), recycle
  bins, car, etc. Each carries an `owner`/`zone`/`decision` reusing the game's types.

## Notes
- **Not connected to game state.** It shares `ZoneId`/`PersonId`/`Decision` with `types.ts`
  but has no `Task`/`Item` link and is never persisted or written.
- Positions were inferred from photos (see the on-screen "positions are a draft" footer);
  they are a starting point to correct, not ground truth.
