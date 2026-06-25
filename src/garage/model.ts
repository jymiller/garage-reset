import type { PersonId, ZoneId, Decision } from '../types'

/**
 * Spatial model of JOHN'S SECTION of a long shared garage — the back area where
 * the family's stuff lives. Scoped from the Polycam LiDAR scan + John's notes:
 * the full garage is ~25 m long; the front is shared parking, John's part is the
 * back, ending at the line where the south-wall cabinet aligns with the north-wall
 * jut-out. Laundry is NOT John's (they have one in the apartment) — it sits just
 * past the line and is shown only as faded context.
 *
 * Top-down plan, units = feet. Section ≈ 34 ft deep × 24 ft wide, 10.5 ft ceiling.
 *   x: 0 = WEST / back wall (backyard door + window + cabinets)
 *      → width = the ALLOTMENT LINE; beyond it (parkingBeyond) = shared space.
 *   y: 0 = NORTH wall (fitness, bikes, stairs)  →  depth = SOUTH wall (storage racks).
 * A Box's (x, y) is its north-west corner; w = east-west, d = north-south.
 */

export interface Box {
  x: number
  y: number
  w: number
  d: number
}

export interface PlacedObject {
  id: string
  label: string
  owner: PersonId | null
  zone: ZoneId | null
  decision: Decision
  now: Box
  plan: Box
  note?: string
}

export interface GarageModel {
  width: number // x: back wall → allotment line (depth of John's section), feet
  depth: number // y: north → south wall (width), feet
  ceiling: number // feet
  parkingBeyond: number // faded shared strip drawn east of the allotment line
  features: {
    peopleDoor: { y: number; h: number } // WEST / back wall — to the backyard
    window: { y: number; h: number } // WEST / back wall
    cabinets: Box // oak uppers + counter, back wall
    miniFridge: Box
    waterHeater: { cx: number; cy: number; r: number } // back NW corner
    stairs: Box // shared stairs, north wall near the line
  }
  objects: PlacedObject[]
}

export const garage: GarageModel = {
  width: 34,
  depth: 24,
  ceiling: 10.5,
  parkingBeyond: 9,
  features: {
    peopleDoor: { y: 9, h: 2.6 },
    window: { y: 14, h: 4 },
    cabinets: { x: 0, y: 3, w: 1.6, d: 5 },
    miniFridge: { x: 0.2, y: 15.5, w: 1.3, d: 1.3 },
    waterHeater: { cx: 1.3, cy: 1.3, r: 1.1 },
    stairs: { x: 29, y: 0, w: 3.2, d: 3 },
  },
  objects: [
    {
      id: 'storage-shelf',
      label: 'Storage racks (totes)',
      owner: null,
      zone: 'shared-storage',
      decision: 'keep',
      now: { x: 5, y: 21.4, w: 20, d: 2.2 },
      plan: { x: 4, y: 21.4, w: 17, d: 2.2 },
      note: 'The long rack run of black/red totes, banker boxes, holiday bins — south wall.',
    },
    {
      id: 'tool-chest',
      label: 'Red tool chest',
      owner: 'griffin',
      zone: 'griffin-workshop',
      decision: 'keep',
      now: { x: 27.5, y: 21, w: 2.2, d: 2 },
      plan: { x: 24, y: 21, w: 2.2, d: 2 },
    },
    {
      id: 'parts-cabinet',
      label: 'Parts / mechanics cabinet',
      owner: 'griffin',
      zone: 'griffin-workshop',
      decision: 'keep',
      now: { x: 30, y: 20.6, w: 2.6, d: 2.4 },
      plan: { x: 26.5, y: 20.6, w: 2.6, d: 2.4 },
    },
    {
      id: 'weight-bench',
      label: 'Weight bench + plates',
      owner: 'griffin',
      zone: 'griffin-fitness',
      decision: 'keep',
      now: { x: 14, y: 0.4, w: 4, d: 2.6 },
      plan: { x: 15, y: 0.3, w: 4, d: 2.6 },
    },
    {
      id: 'bikes',
      label: 'Bikes (×2)',
      owner: 'griffin',
      zone: 'griffin-fitness',
      decision: 'keep',
      now: { x: 9, y: 0.4, w: 3.2, d: 2.2 },
      plan: { x: 5, y: 0.3, w: 3.2, d: 2.2 },
    },
    {
      id: 'dresser',
      label: 'Oak dresser + lamp',
      owner: 'griffin',
      zone: 'griffin-fitness',
      decision: 'undecided',
      now: { x: 10.5, y: 11, w: 2, d: 1.8 },
      plan: { x: 20, y: 0.4, w: 2, d: 1.8 },
      note: 'Currently marooned mid-floor; decide keep-against-north-wall or donate.',
    },
    {
      id: 'gray-wardrobe',
      label: 'Gray standing wardrobe',
      owner: 'lj',
      zone: 'lj-clothing',
      decision: 'keep',
      now: { x: 2.5, y: 0.6, w: 3, d: 3.2 },
      plan: { x: 2.5, y: 0.6, w: 3, d: 3.2 },
      note: "LJ's gray standing clothing closet — the 'gray wardrobe' to sort.",
    },
    {
      id: 'oak-wardrobe',
      label: 'Oak wardrobe',
      owner: null,
      zone: 'shared-storage',
      decision: 'undecided',
      now: { x: 0.6, y: 4.5, w: 2, d: 2.2 },
      plan: { x: 0.6, y: 20, w: 2, d: 2.2 },
      note: 'Decide: keep for storage or donate.',
    },
    {
      id: 'white-table',
      label: 'White folding table',
      owner: 'john',
      zone: 'john-table',
      decision: 'keep',
      now: { x: 35, y: 17.5, w: 3.6, d: 2.2 },
      plan: { x: 0.7, y: 17.5, w: 3.6, d: 2 },
      note: 'Right now it has drifted PAST your line into shared space — pull it back in.',
    },
    {
      id: 'banker-boxes',
      label: 'Banker boxes',
      owner: 'john',
      zone: 'john-table',
      decision: 'undecided',
      now: { x: 35.6, y: 14, w: 2, d: 2 },
      plan: { x: 30.5, y: 21, w: 2, d: 2 },
      note: 'Also over the line — scan / archive / trash, then most leave via the exit.',
    },
    {
      id: 'ne-clutter',
      label: 'Lumber / garden tools / propane',
      owner: null,
      zone: 'exit-zone',
      decision: 'undecided',
      now: { x: 4, y: 0.5, w: 2.4, d: 2 },
      plan: { x: 0.6, y: 0.6, w: 2, d: 1.8 },
      note: 'Long boards, rakes/shovels, propane — sort keep vs donate vs trash.',
    },
    {
      id: 'recycle-bins',
      label: 'Recycle + trash bins',
      owner: null,
      zone: 'exit-zone',
      decision: 'keep',
      now: { x: 32, y: 2, w: 2, d: 2.2 },
      plan: { x: 31.5, y: 2, w: 1.8, d: 2 },
      note: 'Stage at the line as the donate / trash / exit lane.',
    },
  ],
}
