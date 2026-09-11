# Crate lab

Open `/#crates` or choose **Crate lab** in the pickup planner. Laptop and phone use the same responsive workspace: the laptop shows the container list beside the selected crate; a phone focuses on one crate at a time.

## First session

1. Preserve the white parking-clearance boundary and access to both cars. Work on one container at a time.
2. Register a real container and put its ID (for example C-001) on it. Record its shelf address, owner, capacity and starting fill. The suggested 60 L is an example, not a measurement.
3. Take or attach a photo. In **Open & sort**, type or use the phone keyboard's dictation, with one item or group per line. `3x camping mugs` records a quantity of three. Labels and quantities can be corrected afterward.
4. Choose keep, donate, sell, recycle, trash or undecided. Record the destination. Mark an outgoing batch as departed only after it physically leaves the garage.
5. Consolidate keepers. Moving a contents record between containers puts both containers back into sorting so both fill estimates must be checked. In **Repack**, record the new fill and confirm that transferred material is accounted for and the parking area is clear.

The app records your descriptions and decisions. It does not infer hidden contents, ownership, volume or disposal suitability from photos. A photo and the contents list can be used in the accompanying cleanup conversation to decide the next batch.

## Half the occupied volume

Baseline occupied contents volume is container capacity × starting fill. Current occupied contents volume uses your confirmed repacking fill. Decisions alone do not reduce volume. While a container is being sorted, the headline result is pending. Register the full area being measured before locking the baseline; early results cover only the registered containers.

Partly empty boxes still occupy shelf space. To reclaim usable storage, consolidate retained material into fewer containers and remove the empty containers from active storage. The percentage estimates contents volume, not a measured 3D scan or reclaimed floor area.

After locking the baseline, new containers start empty and can receive transfers. Reopen the baseline when registering previously unrecorded material or correcting starting measurements.

## Devices and saving

`npm run dev` serves the frontend and shared API at `http://127.0.0.1:5173`. This is a laptop-only preview. A hosted HTTPS address is required for convenient access from the phone away from the laptop. The Vercel production configuration targets [Garage Reset](https://garage-reset.vercel.app), with shared family access and private Blob storage. Open the privately shared family bookmark on each browser. See [VERCEL-DEPLOYMENT.md](VERCEL-DEPLOYMENT.md) for configuration and release verification.

Crate records save to the shared server and are cached locally. Visible hosted workspace screens refresh shared changes every 30 seconds; loopback uses four seconds, and hidden tabs skip background reads. Hosted writes use authoritative Blob ETags to protect concurrent saves across function instances. If two devices edit the same revision, the app preserves the local draft and asks you to export it before loading the shared version; it does not silently merge or overwrite concurrent edits. A disconnected loaded page can retain drafts, but photos require a connection. There is no offline app installation or automatic backup import UI.

**Export backup** downloads the crate workspace JSON. Uploaded photos are separate; back up private Blob workspace, photo and evidence objects for Vercel, or the private data directory for local Node use. Browser photo uploads are compressed to at most 3,500,000 bytes before upload. Previous game/capture and pickup-planner local data remain separate from this new crate inventory and are not automatically synchronized or migrated.

## Private hosting

The selected hosted runtime uses Vercel family access and private Blob storage. The 22 reference evidence files were uploaded privately and remain outside public source and static build assets; `scripts/private-build.mjs` enforces the postbuild exclusion. Workspace and image routes require the family device cookie. `GARAGE_ACCESS_KEY` and the Blob token belong only in server environment settings. Git pushes to `main` trigger Vercel; verify the resulting release using [VERCEL-DEPLOYMENT.md](VERCEL-DEPLOYMENT.md). No Render deployment was created.

## Verification

- `npm run build`
- `npm run test:crates` — model and shared-state race regressions
- `npm run test:server` — auth, persistence, conflicts, photo storage, validation and development serving
- `npm run test:pickup` — existing bag placement checks

Browser checks use a separate temporary inventory on port 5174. Test crates are not added to the real workspace.
