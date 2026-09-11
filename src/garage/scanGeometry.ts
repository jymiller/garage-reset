export type ScanPoint = [number, number]
export type ScanWall = { a: ScanPoint; b: ScanPoint }
export type ScanOpening = ScanWall & { id: string; kind: 'door' | 'window'; label: string }

export type ScanShell = {
  outline: ScanPoint[]
  walls: ScanWall[]
  openings: ScanOpening[]
  totalLength: number
  width: number
  height: number
  wallThickness: number
  interiorBounds: { x: number; y: number; length: number; width: number }
  scanAreaM2: number
  date: string
  source: string
  note: string
}

/**
 * June 25 Polycam floor-plan geometry, metres. Front/street is x=0;
 * rear/yard is x=25.209485. The long rack wall is y=0; y increases toward
 * the stepped opposite wall. These are plan directions, not compass bearings.
 *
 * DXF transform: x = sourceX + 12.604742; y = 3.688077 - sourceY.
 * Walls follow the exported wall centerlines. The floor follows their inner
 * faces (0.05 m inside the centerline). Door spans are removed from walls.
 * See SCAN-GEOMETRY.md for source layers and limits.
 */
export const scanShell: ScanShell = {
  outline: [
    [25.159485, 0.05],
    [0.05, 0.05],
    [0.05, 5.307407],
    [6.272743, 5.307407],
    [6.272743, 4.235444],
    [13.336705, 4.235444],
    [13.336705, 7.326154],
    [14.563981, 7.326154],
    [14.563981, 5.387043],
    [16.073299, 5.387043],
    [16.073299, 7.324228],
    [25.159485, 7.324228],
  ],
  walls: [
    { a: [13.286705, 4.285444], b: [13.286705, 6.256503] },
    { a: [13.286705, 7.127491], b: [13.286705, 7.376154] },
    { a: [6.322743, 4.285444], b: [8.929228, 4.285444] },
    { a: [9.781455, 4.285444], b: [13.286705, 4.285444] },
    { a: [14.613981, 5.437043], b: [14.613981, 5.745304] },
    { a: [14.613981, 6.651128], b: [14.613981, 7.376154] },
    { a: [16.023299, 5.437043], b: [16.023299, 7.374228] },
    { a: [0, 0], b: [0, 0.171587] },
    { a: [0, 5.284907], b: [0, 5.357407] },
    { a: [6.322743, 4.285444], b: [6.322743, 5.357407] },
    { a: [13.286705, 7.376154], b: [14.613981, 7.376154] },
    { a: [0, 0], b: [25.209485, 0] },
    { a: [25.209485, 0], b: [25.209485, 3.207501] },
    { a: [25.209485, 3.988119], b: [25.209485, 7.374228] },
    { a: [16.023299, 7.374228], b: [25.209485, 7.374228] },
    { a: [0, 5.357407], b: [6.322743, 5.357407] },
    { a: [14.613981, 5.437043], b: [16.023299, 5.437043] },
    // Short interior wall projection beside the middle step.
    { a: [6.322743, 3.261995], b: [6.322743, 4.285444] },
  ],
  openings: [
    { id: 'front-door', kind: 'door', label: 'Street opening', a: [0, 5.284907], b: [0, 0.171587] },
    { id: 'side-door-1', kind: 'door', label: 'Scanned side doorway', a: [13.286705, 7.127491], b: [13.286705, 6.256503] },
    { id: 'side-door-2', kind: 'door', label: 'Scanned side doorway', a: [14.613981, 6.651128], b: [14.613981, 5.745304] },
    { id: 'rear-door', kind: 'door', label: 'Rear people door', a: [25.209485, 3.988119], b: [25.209485, 3.207501] },
    { id: 'middle-door', kind: 'door', label: 'Scanned middle doorway', a: [8.929228, 4.285444], b: [9.781455, 4.285444] },
    { id: 'rear-window', kind: 'window', label: 'Rear window', a: [25.209485, 2.315696], b: [25.209485, 1.210335] },
  ],
  totalLength: 25.209485,
  width: 7.376154,
  height: 3.2,
  wallThickness: 0.1,
  interiorBounds: { x: 0.05, y: 0.05, length: 25.109485, width: 7.276154 },
  scanAreaM2: 145.4,
  date: '2026-06-25',
  source: 'Polycam floor-plan DXF and CSV, June 25, 2026',
  note: 'Scan-derived shell, not a current measured survey. Furniture, the parking boundary, door swings and opening heights are not reconstructed from this export.',
}
