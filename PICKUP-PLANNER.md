# Garage Reset pickup planner

The app now opens to `#pickup`. The existing garage map, task game, crew and inventory remain available from the workspace navigation. The garage map expands on laptop screens.

## Use

- **Photo:** the user's exterior photo, with an approximate area to measure. The yellow outline is not a scaled bag. It is independent of the editable model.
- **3D / Plan:** a movable Large or Medium Yellowsack with rotation, numeric placement and example outdoor geometry. Click the apron in 3D; click or drag in Plan. The truck is illustrative and never extends the reach calculation.
- **Measure:** enter frontage width, road-to-roof distance, road width and the pedestrian strip's extent from the road. Dimensions start as examples and require the user's explicit on-site confirmation.
- **Check:** whole footprint on the drawn frontage, sidewalk clear, less than 20 ft to the modeled road edge, road at least 14 ft wide, chosen four-foot center carry lane clear. The carry lane is a planning preference, not a vehicle turning/access simulation.
- **Field checks:** open sky, allowed ground/slope/utility and vehicle access, truck access and lifting handles. Position/size/rotation edits invalidate spatial confirmations; geometry edits invalidate all confirmations. Even a complete checklist is a candidate, not provider approval.
- **Persistence:** planner state is saved separately as `garage-reset-pickup-v1` in the current browser's localStorage. Existing task/inventory storage remains `garage-reset-v1`. There is no cross-device synchronization.
- **Export:** downloads a plain-text plan with dimensions, outstanding checks and official links. It does not book or contact the pickup provider.

## Evidence and limits

The user supplied three exterior photos September 9, 2026. They show an apron between the covered garage and road, a pedestrian route, utility access covers in a pale concrete strip, a parked vehicle and overhead wires toward the street. Photos do not establish scale, legal property boundaries, apron slope in degrees, wire height/position or truck maneuverability. The source photo and its visual annotation remain local assets.

Candidate to test: outside the doorway, right of center facing the street and left of the pale utility strip, with the long side parallel to the curb. Measure a 6 ft 7 in by 3 ft 3 in rectangle for the large bag. Verify pedestrian/vehicle access, utility covers, ownership permission, slope and crane clearance before filling. If it does not fit, do not infer permission to use the sidewalk or roadway.

The interior 3D model remains the earlier approximate rear-section model; it is not an outdoor survey. The original Polycam floor plan is linked as evidence.

Official sources consulted: [placement](https://yellowsack.com/how-to-use), [dimensions/access](https://yellowsack.com/faq), [waste rules](https://yellowsack.com/pricing), [propane disposal](https://calrecycle.ca.gov/propane/).

## Development

Run `npm run dev`, `npm run typecheck`, `npm run test:pickup`, and `npm run build` in this app directory. The existing dependencies are sufficient. The 3D view is lazy-loaded with a 2D fallback; new Three.js rendering uses demand mode.

## September 9 current-condition update

All 11 user-supplied HEICs, IMG_1908 through IMG_1918, are reviewed in the Pickup workspace. Their capture metadata spans September 9, 2026, 10:46–10:47 AM. Browser-compatible JPEG previews live in `public/evidence/2026-09-09`; original HEICs remain unchanged. These photos show the branded sack inside by the rear cabinets, loose floor items and leaning panels around the approach, and the SUV occupying the central floor. The photo review provides staging suggestions, not ownership or disposal decisions. It does not replace the older 3D coordinates with unmeasured positions.

The collection workflow now distinguishes storage from set-out: sort indoors, confirm the allowed collection location and pickup window, then place the empty sack and load it outside close to collection. Yellowsack's [how-to-use page](https://yellowsack.com/how-to-use) says public-sidewalk placement requires pickup to be scheduled right away. No blanket private-property overnight ban was found on the reviewed how-to-use, FAQ or terms pages. SF Public Works separately states that debris boxes cannot be placed on sidewalks without prior permission; its [permit guidance](https://sfpublicworks.org/services/permits/debris-box-permit) should be checked with the provider/Public Works for this flexible household-cleanup sack and exact location. Scheduling pickup does not establish permission to occupy public space.

## Afternoon photo update and two-car constraint

Added IMG_1927–IMG_1932 (EXIF capture September 9, 2026, 13:49–13:50). The gallery now separates six latest landscape views from the eleven morning reference photos. Original HEICs are unchanged; 1600px JPEG previews are local app assets. The intake manifest holds source and preview metadata.

John confirmed that the white floor line visible in IMG_1929 and IMG_1930 is the parking clearance boundary. Treat the two vehicle spaces and their access as protected, with one small sorting batch and four destinations: assigned keep storage, approved bag-compatible waste to the outdoor sack, one donation box, and one owner-decision tote. The latest photos show labeled wall totes, loose upper-shelf gear, floor cords, a chair/carton/stool cluster and floor jacks. Only one SUV is shown, so no measured two-car fit or exact vehicle position has been inferred. The older 3D model remains unchanged.

The user has stated that the road is more than 14 feet wide. This is a user report, not an exact numeric survey, so the illustrative geometry and measurement confirmations have not been silently changed. Copy now reflects the user's outdoor-sack workflow; loading shortly before collection is no longer presented as the default requirement for private property.
