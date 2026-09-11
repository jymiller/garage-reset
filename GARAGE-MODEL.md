# Garage model

Open `#layout` for the laptop planning workspace: a selectable 3D cutaway, a floor plan, and the source photos. Back-section and whole-garage views share the same geometry.

The fixed shell comes from the existing June 25, 2026 Polycam DXF/CSV. It preserves the stepped outline, interior wall projection, five door openings and rear window. Interior bounding dimensions are approximately 25.1 × 7.3 metres, with a scanned ceiling estimate of 3.2 metres. The garage is not rectangular. See `src/garage/SCAN-GEOMETRY.md` for extraction and provenance.

The 26 object markers use September 9 photo observations. Latest afternoon observations are distinguished from morning references. Their coordinates, sizes and silhouettes are estimates, not photogrammetry. Rack labels R1–R4 are suggested working groups, not verified physical bay counts or existing labels. Tote counts are illustrative. Ownership and disposal decisions are not assigned by the model.

The white line’s meaning—parking clearance—is user-confirmed. Its exact position and both car footprints remain unmeasured. The optional parking tint is only a provisional reminder, not a fit check. The latest photographed SUV is shown once; a second car location is not fabricated. The front of the full plan has architecture but no current contents survey.

## Identify an item in a photo and in 3D

Choose **Identify another item**, then **Identify an item** on the source photo and drag a rectangle around an individual object. Name it, choose its reference area, and enter outside length, depth and height in inches. Initial sizes and placement are placeholders. Select **I measured all three outside dimensions** only after measuring them; changing a size returns the record to estimated. Use **Place the box in 3D** to enter offsets from the area and its height above the floor. New boxes use any local correction to their parent area, while saved boxes retain their absolute coordinates.

Saving creates one shared `spatialItems` record with its photo ID, normalized rectangle, name, dimensions, position and optional crate association. The catalog, photo outline, 3D box and linked Crate lab record refer to that same item. Select its label or outline to return to its 3D position. **Redraw selected item** replaces that item's photo rectangle; **Identify another item** starts a separate record. Thin reference outlines are manually suggested areas, not detected objects. Individual boxes use a visible overlay so they can be selected through the schematic rack or tote.

Outer box volume is length × depth × height, shown in litres, cubic feet and cubic metres. It includes empty space and is not a mesh volume, a contents measurement or cleanup progress. Crate lab separately estimates contents using capacity × fill. Boxes are not summed into a garage total because containers and their contents can overlap. Linking a crate does not copy its volume into the box or double-count it. One crate may have one 3D marker.

Item records use the same private workspace API, local draft cache and revision conflict handling as Crate lab. Editing a stale item cannot overwrite a newer record silently. Existing workspaces without `spatialItems` remain valid. The Vercel runtime targets [Garage Reset](https://garage-reset.vercel.app) and saves shared records to private Blob storage with conditional ETag writes. Family access protects the workspace and image routes. See [VERCEL-DEPLOYMENT.md](VERCEL-DEPLOYMENT.md) for runtime configuration and production verification. The currently identifiable evidence set is the 17 September photos, included among the 22 privately uploaded reference files; automatic recognition and importing new image sets are not implemented.

Visible hosted workspace screens refresh every 30 seconds; loopback development uses four seconds, and hidden tabs skip background reads. Browser photos compress to at most 3,500,000 bytes before upload. The postbuild guard, `scripts/private-build.mjs`, excludes private evidence from static assets.

## Corrections

Select an object and open **Correct this footprint**. Enter dimensions and offsets in metres or feet, with an optional measurement note. X starts at the street end; Y starts at the long rack wall. Saved footprints must remain inside the irregular floor and clear of walls. Positive overlaps with other object estimates are flagged, but this is not a door, driving-route or equipment-service clearance calculation.

Corrections persist under `garage-layout-corrections-v1` in this browser only. Export creates a JSON backup; per-object restoration returns to its photo estimate. These edits do not sync to Crate lab and do not change occupied-volume progress. Real photographs stay on the existing protected evidence routes; no raw scan or photo assets are added to tracked public source.

## Next capture

The in-app capture checklist covers a fresh Polycam Space Mode scan, a textured GLB or complete glTF package, rack photos and measured anchors. LiDAR-capable devices can include floor-plan output. Capture the boundary at both ends and bends, both normal car positions and door space, each rack’s dimensions, door openings, utilities and hidden corners. The app currently renders the extracted floor plan; it does not yet import a new textured scan or automatically infer crate contents.

`npm run test:spatial` checks item validation, photo rectangles, volume calculations, crate links, sanitation and client/server parity. `npm run test:layout` checks the source geometry, open door gaps, polygon bounds, invalid edits, wall intrusion and object overlaps. `npm run build` checks all TypeScript and the production bundle.
