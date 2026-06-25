import type { PersonId, ZoneId, Decision } from '../types'

/**
 * Garage spatial model, inferred from the 26 photos in /garage-photos and
 * corrected against John's bearings. Top-down plan, NORTH is up. Units = feet.
 *
 *   x: 0 = WEST wall (people door + window + cabinets, faces the backyard)
 *      → width = EAST wall (the double garage door)
 *   y: 0 = NORTH wall (gray standing wardrobe + fitness: weights, bikes, dresser)
 *      → depth = SOUTH wall (the well-organized storage racks)
 *
 * A Box's (x, y) is its north-west corner; w = east-west size, d = north-south size.
 * The car normally parks nose-East toward the door; it was moved out for the photos.
 * Dimensions are still a best guess — confirm the real footprint.
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
  width: number // east-west feet
  depth: number // north-south feet
  features: {
    garageDoor: { y: number; h: number } // along EAST wall
    peopleDoor: { y: number; h: number } // along WEST wall
    window: { y: number; h: number } // along WEST wall
    cabinets: Box // oak uppers + counter, WEST wall
    miniFridge: Box
    waterHeater: { cx: number; cy: number; r: number } // NW corner
    soffit: Box // low under-stair bulkhead, NW
  }
  objects: PlacedObject[]
}

export const garage: GarageModel = {
  width: 26,
  depth: 20,
  features: {
    garageDoor: { y: 2, h: 16 },
    peopleDoor: { y: 14.4, h: 2.6 },
    window: { y: 8, h: 4 },
    cabinets: { x: 0, y: 5.5, w: 1.6, d: 6 },
    miniFridge: { x: 0.2, y: 12.7, w: 1.3, d: 1.3 },
    waterHeater: { cx: 1.5, cy: 1, r: 1.1 },
    soffit: { x: 4.5, y: 0, w: 3, d: 3.5 },
  },
  objects: [
    {
      id: 'car',
      label: 'Car',
      owner: null,
      zone: null,
      decision: 'keep',
      now: { x: 11, y: 6, w: 13, d: 6 },
      plan: { x: 9, y: 7, w: 14, d: 6 },
      note: 'Normally parks nose-East toward the door; pulled out for the photos.',
    },
    {
      id: 'tool-chest',
      label: 'Red tool chest',
      owner: 'griffin',
      zone: 'griffin-workshop',
      decision: 'keep',
      now: { x: 18.5, y: 17.2, w: 2, d: 2.2 },
      plan: { x: 16, y: 17.2, w: 2, d: 2.2 },
    },
    {
      id: 'parts-cabinet',
      label: 'Parts / mechanics cabinet',
      owner: 'griffin',
      zone: 'griffin-workshop',
      decision: 'keep',
      now: { x: 20.8, y: 16.8, w: 2.2, d: 2.6 },
      plan: { x: 18.3, y: 16.8, w: 2.2, d: 2.6 },
    },
    {
      id: 'storage-shelf',
      label: 'Storage racks (totes)',
      owner: null,
      zone: 'shared-storage',
      decision: 'keep',
      now: { x: 2.5, y: 17.3, w: 13, d: 2.2 },
      plan: { x: 2.5, y: 17.3, w: 11.5, d: 2.2 },
      note: 'The organized rack run along the south wall — totes, banker boxes, holiday bins.',
    },
    {
      id: 'white-table',
      label: 'White folding table',
      owner: 'john',
      zone: 'john-table',
      decision: 'keep',
      now: { x: 8, y: 9.5, w: 2.2, d: 4 },
      plan: { x: 21, y: 15.8, w: 2, d: 3.6 },
      note: 'Currently mid-floor; goal is cleared and tucked against a wall.',
    },
    {
      id: 'banker-boxes',
      label: 'Banker boxes',
      owner: 'john',
      zone: 'john-table',
      decision: 'undecided',
      now: { x: 11, y: 13, w: 2, d: 2 },
      plan: { x: 22.6, y: 4.4, w: 2, d: 2 },
      note: 'Scan / archive / trash — most should leave via the exit zone.',
    },
    {
      id: 'dresser',
      label: 'Oak dresser + lamp',
      owner: 'griffin',
      zone: 'griffin-fitness',
      decision: 'undecided',
      now: { x: 8, y: 6.5, w: 1.8, d: 2 },
      plan: { x: 6.5, y: 0.4, w: 1.8, d: 2 },
      note: 'Decide: keep against the north wall, or donate.',
    },
    {
      id: 'weight-bench',
      label: 'Weight bench + plates',
      owner: 'griffin',
      zone: 'griffin-fitness',
      decision: 'keep',
      now: { x: 11, y: 1.4, w: 4, d: 2.6 },
      plan: { x: 12.5, y: 0.2, w: 4, d: 2.6 },
    },
    {
      id: 'bikes',
      label: 'Bikes (×2)',
      owner: 'griffin',
      zone: 'griffin-fitness',
      decision: 'keep',
      now: { x: 7.5, y: 0.4, w: 3.2, d: 2.2 },
      plan: { x: 4, y: 0, w: 2.6, d: 2.2 },
    },
    {
      id: 'gray-wardrobe',
      label: 'Gray standing wardrobe',
      owner: 'lj',
      zone: 'lj-clothing',
      decision: 'keep',
      now: { x: 1.8, y: 2.4, w: 3, d: 3.4 },
      plan: { x: 1.8, y: 2.4, w: 3, d: 3.4 },
      note: "LJ's gray standing clothing closet — north side. The 'gray wardrobe' to sort.",
    },
    {
      id: 'oak-wardrobe',
      label: 'Oak wardrobe',
      owner: null,
      zone: 'shared-storage',
      decision: 'undecided',
      now: { x: 0.4, y: 2.8, w: 2.2, d: 2 },
      plan: { x: 0.5, y: 17.4, w: 2.2, d: 2 },
      note: 'Decide: keep for storage or donate.',
    },
    {
      id: 'ne-clutter',
      label: 'Lumber / garden tools / propane',
      owner: null,
      zone: 'exit-zone',
      decision: 'undecided',
      now: { x: 2.8, y: 0.4, w: 2.4, d: 2 },
      plan: { x: 0.4, y: 0.2, w: 2, d: 1.8 },
      note: 'Long boards, rakes/shovels, propane tank — sort keep vs donate vs trash.',
    },
    {
      id: 'recycle-bins',
      label: 'Recycle + trash bins',
      owner: null,
      zone: 'exit-zone',
      decision: 'keep',
      now: { x: 19.5, y: 1.2, w: 2.2, d: 2 },
      plan: { x: 22.6, y: 6.7, w: 2, d: 1.8 },
      note: 'Stage near the door as the donate / trash / exit lane.',
    },
  ],
}
