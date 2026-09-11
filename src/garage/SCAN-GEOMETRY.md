# Garage shell provenance

`scanGeometry.ts` reconstructs the fixed shell from the existing local exports `[Polycam Floor Plan] 6_25_2026.dxf` and `.csv` in the canonical repository's `garage-scan/` directory. The original files remain unchanged and are not copied into public assets. Personal address and location metadata are omitted from this derived module.

The DXF `Poly-Rooms` polyline begins at line 2365. Its twelve unique vertices describe the stepped shell. `Poly-Walls` contains thirteen distinct wall segments, including a short interior projection; the file repeats those walls later, so duplicate geometry was removed. `Poly-Doors` supplies five opening spans and `Poly-Windows` supplies one. Door spans are cut out of the exported `walls` list; window spans remain separately available for rendering. Vertical opening positions, heights and door swings have not been inferred.

Coordinates are metres, transformed as `x = DXF.x + 12.604742` and `y = 3.688077 - DXF.y`. The street/front is left at x=0; the rear/yard is right at x=25.209485. The long rack wall is at y=0, with the stepped opposite side below it. This alignment follows the plan and photo interpretation; it does not assert compass bearings.

`totalLength` (25.209485 m) and `width` (7.376154 m) describe the wall-centerline bounding box. The floor `outline` follows the inner faces, offset 0.05 m from those centerlines using the export's 0.10 m wall thickness. Its clear bounding rectangle is 25.109485 × 7.276154 m; the actual floor is not rectangular. The polygon area is approximately 145.36 m², consistent with the CSV's rounded 145.4 m² floor area. The short internal wall is rendered separately. Door thresholds and swing clearance are not included in a clearance calculation.

CSV lines 8–10 report floor area 145.4 m², bounding dimensions 25.1 × 7.3 m, and an inscribed rectangle 25.1 × 4.2 m. Line 15 gives the 3.2 m ceiling height. Line 58 gives the modeled wall thickness. These are scan estimates from June 25, 2026, not on-site tape measurements; retaining six decimal places preserves the exported shape without claiming millimetre accuracy.

June furnishings are deliberately excluded. Current furniture locations, the user-confirmed white parking-clearance line, vehicle access and two-car fit require their own dated evidence or measurements. The source is a floor-plan export, not a textured mesh or point cloud.

Run `node --test src/garage/scanGeometry.test.mjs` to check the nonrectangular outline, opening gaps, duplicate removal and agreement with the exported area and bounding dimensions.
