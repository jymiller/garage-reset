/**
 * Photo observations aligned schematically with the June Polycam plan.
 * Metres: x increases from the street/front (0) to the yard/rear (~25.2);
 * y increases from the long rack wall (0) toward the opposite stepped wall.
 * x/y are footprint minimum corners; w/d/h are drawing envelopes, NOT measured
 * object dimensions. No object, parking clearance, ownership or disposal
 * decision can be certified from these illustrative coordinates.
 *
 * `photo` means visible in the latest afternoon set. `reference` means only
 * established in the earlier morning set and awaiting a current check.
 * Neither confidence value describes the accuracy of the drawn footprint.
 * R1–R4 are proposed map labels for groups of shelving, not installed labels
 * or a claim that the garage contains exactly four physical rack bays.
 */
export type LayoutObject = {
  id: string
  label: string
  kind: 'rack' | 'cabinet' | 'vehicle' | 'table' | 'wardrobe' | 'bike' | 'heater' | 'bins' | 'loose' | 'bag'
  x: number
  y: number
  w: number
  d: number
  h: number
  color: string
  photoIds: string[]
  observed: string
  nextStep: string
  confidence: 'photo' | 'reference'
  lastSeen: string
}

export const currentObjects: LayoutObject[] = [
  {
    id: 'suv-latest', label: 'SUV · latest position', kind: 'vehicle',
    x: 11.1, y: 1.2, w: 4.6, d: 1.9, h: 1.7, color: '#525d69',
    photoIds: ['IMG_1932'], confidence: 'photo', lastSeen: '2026-09-09T13:50:02-07:00',
    observed: 'One SUV is visible toward the vehicle entrance, in front of the black cabinet and rack run. Its footprint and position here are approximate; a second car position is not established.',
    nextStep: 'Mark both intended car positions in person, including mirrors, opening doors and the driving route. Measure before treating any gap as usable storage.',
  },
  {
    id: 'rack-front-black-cabinet', label: 'Black cabinet · front of racks', kind: 'cabinet',
    x: 15.55, y: 0.15, w: 0.85, d: 0.65, h: 1.85, color: '#303740',
    photoIds: ['IMG_1931', 'IMG_1932'], confidence: 'photo', lastSeen: '2026-09-09T13:50:02-07:00',
    observed: 'A tall black cabinet with boxes above stands at the vehicle-facing end of the rack run. This is separate from the smaller dark cabinet beside the heater in the morning photos.',
    nextStep: 'Check that the cabinet doors open without entering the required car clearance, and record what belongs inside before relocating anything.',
  },
  {
    id: 'rack-r1', label: 'R1 · paper goods / totes', kind: 'rack',
    x: 16.6, y: 0.15, w: 1.4, d: 0.7, h: 2.05, color: '#677f79',
    photoIds: ['IMG_1931', 'IMG_1930'], confidence: 'photo', lastSeen: '2026-09-09T13:49:59-07:00',
    observed: 'Paper goods, cartons and black totes occupy shelving beside the black cabinet; floor jacks sit at the front. R1 is a suggested map label, and this drawn group is not a surveyed bay boundary.',
    nextStep: 'Start with one exposed shelf. Read the existing tote labels and record contents while keeping the floor on the vehicle side of the white line clear.',
  },
  {
    id: 'rack-r2', label: 'R2 · games / soft gear', kind: 'rack',
    x: 18.05, y: 0.15, w: 1.45, d: 0.7, h: 2.05, color: '#6e8b82',
    photoIds: ['IMG_1930', 'IMG_1931'], confidence: 'photo', lastSeen: '2026-09-09T13:49:59-07:00',
    observed: 'Board games, soft gear, paper boxes and labeled totes are visible in the next part of the rack run. R2 is a proposed working label; the grouped footprint is approximate.',
    nextStep: 'Inventory one related group directly at the shelf. Keep anything needing another person’s decision together without assigning an owner from the photograph.',
  },
  {
    id: 'rack-r3', label: 'R3 · rods / mixed gear', kind: 'rack',
    x: 19.55, y: 0.15, w: 1.45, d: 0.7, h: 2.05, color: '#77948a',
    photoIds: ['IMG_1930', 'IMG_1929'], confidence: 'photo', lastSeen: '2026-09-09T13:49:54-07:00',
    observed: 'Fishing rods and paper boxes lie above soft gear and stacked totes. R3 groups this photographed area for navigation; the label, dimensions and division from its neighbors need confirmation.',
    nextStep: 'Secure the long rods before handling the shelf below. Match loose gear to existing labeled containers one small batch at a time.',
  },
  {
    id: 'rack-r4', label: 'R4 · camping / holiday totes', kind: 'rack',
    x: 21.05, y: 0.15, w: 1.45, d: 0.7, h: 1.8, color: '#819e92',
    photoIds: ['IMG_1928', 'IMG_1929', 'IMG_1927'], confidence: 'photo', lastSeen: '2026-09-09T13:49:50-07:00',
    observed: 'Camping and Christmas labels are visible on totes near the tool chest. Loose gear and orange and pink cords occupy the upper shelves and front. R4 is a proposed map label, not an established physical bay ID.',
    nextStep: 'Coil and secure the cords, then review one open shelf section without spreading a sorting pile into the parking area.',
  },
  {
    id: 'rack-front-jacks', label: 'Floor jacks / cases', kind: 'loose',
    x: 16.8, y: 1.0, w: 1.35, d: 0.55, h: 0.85, color: '#778493',
    photoIds: ['IMG_1931', 'IMG_1930'], confidence: 'photo', lastSeen: '2026-09-09T13:49:59-07:00',
    observed: 'Floor jacks, an upright jack handle and cases occupy the floor at the rack fronts. Their shared envelope is schematic and does not establish the remaining walkway width.',
    nextStep: 'Choose a stable floor-level home on the storage side of the parking boundary, then check the carry route with the equipment in place.',
  },
  {
    id: 'rack-floor-cords', label: 'Pink / orange cords', kind: 'loose',
    x: 21.15, y: 1.0, w: 1.4, d: 0.85, h: 0.08, color: '#df7991',
    photoIds: ['IMG_1927', 'IMG_1928', 'IMG_1929', 'IMG_1930'], confidence: 'photo', lastSeen: '2026-09-09T13:49:54-07:00',
    observed: 'A pink cord trails from the racks onto the floor, and an orange cord is draped above. The white parking boundary is visible in the wider views, but its exact offset is not measured.',
    nextStep: 'Check what each cord connects to, then coil and secure it clear of feet, wheels and the parking boundary.',
  },
  {
    id: 'folded-tables', label: 'Folded tables / panels', kind: 'table',
    x: 22.55, y: 0.25, w: 0.25, d: 0.7, h: 1.15, color: '#d5d1c7',
    photoIds: ['IMG_1927', 'IMG_1928', 'IMG_1929'], confidence: 'photo', lastSeen: '2026-09-09T13:49:50-07:00',
    observed: 'Folded white tables or panels stand upright between the rack end and red tool chest. Their drawn envelope represents the stored bundle, not an opened work surface.',
    nextStep: 'Secure the folded bundle so it cannot tip into the route. Measure an actual table before selecting it as the wall-side sorting surface.',
  },
  {
    id: 'rear-tool-chest', label: 'Red tool chest', kind: 'cabinet',
    x: 22.9, y: 0.15, w: 0.7, d: 0.65, h: 1.15, color: '#b64549',
    photoIds: ['IMG_1927', 'IMG_1928', 'IMG_1929'], confidence: 'photo', lastSeen: '2026-09-09T13:49:50-07:00',
    observed: 'The red tool chest is beside the tall oak cupboard at the rear end of the rack run. The photos place this group near the rear window, not at the vehicle entrance.',
    nextStep: 'Clear room to open the drawers and identify tools before deciding what to move. Confirm the chest’s offset from the rear wall.',
  },
  {
    id: 'rear-oak-cupboard', label: 'Tall oak cupboard', kind: 'cabinet',
    x: 23.7, y: 0.15, w: 1.25, d: 0.7, h: 2.0, color: '#b89562',
    photoIds: ['IMG_1927', 'IMG_1928', 'IMG_1914'], confidence: 'photo', lastSeen: '2026-09-09T13:49:45-07:00',
    observed: 'A tall oak cupboard with lower drawers stands beside the red tool chest, near the rear window and upright long tools. Items also rest on top; no ownership or contents are established here.',
    nextStep: 'Open the approach before inspecting the cupboard. Record its real width, depth and door swing from the rear corner.',
  },
  {
    id: 'cupboard-floor-group', label: 'Chair, carton / power station', kind: 'loose',
    x: 23.05, y: 1.05, w: 1.15, d: 1.0, h: 1.0, color: '#c39d78',
    photoIds: ['IMG_1927', 'IMG_1928'], confidence: 'photo', lastSeen: '2026-09-09T13:49:45-07:00',
    observed: 'A folding chair and carton occupy the cupboard approach, beside a stool carrying a black-and-orange Jackery device. This grouping records floor occupation, not a disposal pile.',
    nextStep: 'Fold the chair and select a stable temporary home for the carton and stool, keeping the electrical device and box contents for individual decisions.',
  },
  {
    id: 'rear-cart', label: 'Rear rolling cart', kind: 'table',
    x: 23.65, y: 2.15, w: 0.7, d: 0.75, h: 1.0, color: '#566c69',
    photoIds: ['IMG_1927', 'IMG_1914'], confidence: 'photo', lastSeen: '2026-09-09T13:49:41-07:00',
    observed: 'A crowded black rolling cart sits by the cupboard and low rear cabinets. Cases, cartons and mixed objects cover it, so no clear work surface is established.',
    nextStep: 'Review one tray or surface at a time, then determine whether the cart can serve as a small sorting station without blocking the rear door.',
  },
  {
    id: 'rear-window-cabinets', label: 'Low cabinets under window', kind: 'cabinet',
    x: 24.45, y: 1.3, w: 0.65, d: 1.65, h: 0.85, color: '#987d5b',
    photoIds: ['IMG_1914', 'IMG_1927'], confidence: 'photo', lastSeen: '2026-09-09T13:49:41-07:00',
    observed: 'Low wooden cabinets sit below the rear window with crates, cases and other objects on the worktop. Their drawn extent stops short of the door but is not a measured clearance.',
    nextStep: 'Measure the cabinet ends against the window and rear door. Clear only a small usable surface while keeping the door approach open.',
  },
  {
    id: 'rear-upright-tools', label: 'Long tools / boards', kind: 'loose',
    x: 24.5, y: 0.95, w: 0.55, d: 0.25, h: 1.75, color: '#b88c63',
    photoIds: ['IMG_1927', 'IMG_1914'], confidence: 'photo', lastSeen: '2026-09-09T13:49:41-07:00',
    observed: 'Long-handled tools, boards and orange items lean beside the cupboard near the rear window. The photograph does not establish how they are restrained.',
    nextStep: 'Secure the upright group before working on the nearby cart or cupboard, and keep access to the rear door available.',
  },
  {
    id: 'wall-panel-block', label: 'Plywood panel / block', kind: 'loose',
    x: 14.3, y: 0.2, w: 0.85, d: 0.45, h: 0.95, color: '#a9997f',
    photoIds: ['IMG_1932'], confidence: 'photo', lastSeen: '2026-09-09T13:50:02-07:00',
    observed: 'A plywood panel and concrete block sit against the wall beside the SUV, ahead of the black cabinet. The footprint represents the photographed group only.',
    nextStep: 'Secure the leaning panel and check the block’s purpose before moving it. Keep the car’s door and driving route clear.',
  },
  {
    id: 'side-bins-reference', label: 'Green / blue bins · morning', kind: 'bins',
    x: 17.2, y: 5.65, w: 1.2, d: 0.8, h: 1.1, color: '#638d8b',
    photoIds: ['IMG_1908'], confidence: 'reference', lastSeen: '2026-09-09T10:46:48-07:00',
    observed: 'Green and blue wheeled bins are visible beside the side-door and utility enclosure in the morning set. Their present position was not rechecked in the afternoon views.',
    nextStep: 'Confirm their current homes and measure the side-door approach with the bins in place; do not use the doorway as a sorting area.',
  },
  {
    id: 'rug-frame-reference', label: 'Rolled rug / leaning frames', kind: 'loose',
    x: 18.6, y: 5.5, w: 0.8, d: 0.6, h: 1.45, color: '#a59b8b',
    photoIds: ['IMG_1908', 'IMG_1909'], confidence: 'reference', lastSeen: '2026-09-09T10:46:53-07:00',
    observed: 'A rolled rug lies on the floor near leaning frames and panels at the utility corner. This is a morning reference; the combined envelope is approximate.',
    nextStep: 'Check the current position, secure the leaning pieces, and choose a location clear of the heater and side door before moving the rug.',
  },
  {
    id: 'water-heater-reference', label: 'Water heater · morning', kind: 'heater',
    x: 19.5, y: 6.55, w: 0.55, d: 0.6, h: 1.85, color: '#bbc2c4',
    photoIds: ['IMG_1908', 'IMG_1909'], confidence: 'reference', lastSeen: '2026-09-09T10:46:53-07:00',
    observed: 'A water heater and its connected pipes are visible in the utility recess, beside a dark cabinet. This marker is an orientation reference, not a measured service-clearance boundary.',
    nextStep: 'Photograph and measure the utility recess and retain access to the equipment. Do not plan storage from the size of this schematic marker.',
  },
  {
    id: 'utility-cabinet-reference', label: 'Dark cabinet by heater', kind: 'cabinet',
    x: 20.15, y: 6.5, w: 0.8, d: 0.65, h: 1.5, color: '#67615c',
    photoIds: ['IMG_1909'], confidence: 'reference', lastSeen: '2026-09-09T10:46:53-07:00',
    observed: 'A dark two-door cabinet stands beside the water heater in the morning photograph. It is distinct from the tall black cabinet at the front of the rack run.',
    nextStep: 'Check the cabinet’s current position and open-door clearance while retaining access to the adjacent heater.',
  },
  {
    id: 'bicycle-reference', label: 'Bicycle · morning', kind: 'bike',
    x: 21.05, y: 6.1, w: 1.45, d: 0.6, h: 1.2, color: '#7b8b95',
    photoIds: ['IMG_1909', 'IMG_1910'], confidence: 'reference', lastSeen: '2026-09-09T10:46:55-07:00',
    observed: 'A bicycle is clearly visible beside the fabric wardrobe and dark utility cabinet. Its morning position is shown approximately; the upright bicycle in the rear corner is noted with that corner’s stored items.',
    nextStep: 'Confirm the bicycle’s current home and access route, then measure the usable footprint including the handlebars.',
  },
  {
    id: 'fabric-wardrobe-reference', label: 'Gray fabric wardrobe', kind: 'wardrobe',
    x: 22.55, y: 6.4, w: 1.35, d: 0.7, h: 1.85, color: '#8a8e9f',
    photoIds: ['IMG_1909', 'IMG_1910'], confidence: 'reference', lastSeen: '2026-09-09T10:46:55-07:00',
    observed: 'A gray fabric wardrobe stands along the opposite wall in the morning set, with a folded chair and soft bags nearby. The image does not establish the owner or contents.',
    nextStep: 'Confirm its current location and measure its depth, then open one small section for a contents record without using the parking floor.',
  },
  {
    id: 'white-bench-reference', label: 'White shag bench', kind: 'table',
    x: 21.7, y: 5.4, w: 1.35, d: 0.55, h: 0.5, color: '#dedbd1',
    photoIds: ['IMG_1909', 'IMG_1910'], confidence: 'reference', lastSeen: '2026-09-09T10:46:55-07:00',
    observed: 'A small white shag-covered bench sits in front of the wardrobe and bicycle in the morning photographs. This marker represents the photographed bench, not the weight-bench assumption in the old layout.',
    nextStep: 'Check its current location and choose a stable position that leaves the wardrobe and bicycle accessible; its intended use remains a user decision.',
  },
  {
    id: 'rear-stacked-storage-reference', label: 'Rear boxes / small shelving', kind: 'loose',
    x: 24.0, y: 6.0, w: 0.8, d: 1.0, h: 1.7, color: '#ad9580',
    photoIds: ['IMG_1910', 'IMG_1911', 'IMG_1912'], confidence: 'reference', lastSeen: '2026-09-09T10:47:05-07:00',
    observed: 'Boxes, totes, small shelving, folded items and an upright bicycle fill the corner between the gray wardrobe and rear oak cabinets in the morning set. The corner is grouped until individual floor positions can be measured; contents and later positions are unverified.',
    nextStep: 'Take a current corner photograph, then register one identifiable box or container before rearranging the stack.',
  },
  {
    id: 'rear-oak-worktop-reference', label: 'Rear oak worktop / uppers', kind: 'cabinet',
    x: 24.45, y: 4.5, w: 0.65, d: 1.35, h: 2.1, color: '#aa8155',
    photoIds: ['IMG_1910', 'IMG_1911'], confidence: 'reference', lastSeen: '2026-09-09T10:46:59-07:00',
    observed: 'Oak upper cabinets and a crowded worktop are visible on the rear wall behind the yellow sack in the morning set, on the other side of the rear door from the window group.',
    nextStep: 'Confirm this corner with a current photograph and record the worktop’s actual extent without narrowing the rear-door route.',
  },
  {
    id: 'yellow-sack-morning-reference', label: 'Yellowsack · morning only', kind: 'bag',
    x: 22.8, y: 4.35, w: 1.5, d: 0.9, h: 0.65, color: '#dfc843',
    photoIds: ['IMG_1910', 'IMG_1911', 'IMG_1912'], confidence: 'reference', lastSeen: '2026-09-09T10:47:05-07:00',
    observed: 'An open yellow sack is visible under the garage roof by the rear oak cabinets in the morning photographs. The illustration does not establish its actual size, contents, load or present position.',
    nextStep: 'Recheck the sack and its label. Confirm the outdoor collection position before adding material; do not assume a loaded sack can be moved.',
  },
]

export const captureSteps: { id: string; title: string; detail: string }[] = [
  {
    id: 'two-car-positions', title: 'Mark both car positions',
    detail: 'Photograph both intended parked positions from the entrance and rear. Measure each car’s outer footprint, mirror width, door-opening space and route in or out. The second car is not placed on this map yet.',
  },
  {
    id: 'parking-boundary', title: 'Locate the white parking boundary',
    detail: 'Measure from the rack wall to the white line at each end and any bend. Add a photo with the tape visible and identify the exact endpoints; do not assume the line is parallel to the wall.',
  },
  {
    id: 'racks-and-width', title: 'Measure the wall and rack fronts',
    detail: 'At the rear corner, start a tape along the rack wall. Record the cupboard, tool chest and each real rack bay’s start, width and depth, plus the clear room width at the opposite wall steps. R1–R4 are temporary map labels.',
  },
  {
    id: 'doors-and-corners', title: 'Capture doors, utilities and corners',
    detail: 'Take overlapping photos from all four rear-area corners. Show the rear door and window, side-door recess, heater, wardrobe and floor; record door openings and swings and one measured reference in each view.',
  },
  {
    id: 'refresh-morning', title: 'Recheck the morning references',
    detail: 'Take one current photo of the sack and the wardrobe/bench/bins side. Note what has moved since the morning set so the map does not mix old and current positions.',
  },
]
