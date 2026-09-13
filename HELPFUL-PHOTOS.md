# Helpful photos: developer contract

Home's **Add photo** action and the **Add photo** navigation item open QuickCapture at #discover with kind:general. The camera and photo library are available immediately; a note, category, helper name, crate link, and measurements are optional. Specific crate, placement, parking, and measurement flows remain available. #observations opens the collection directly. LabelQuest at #labels selects a printed ID and outside/contents role; timed cleanup missions remain at #play.

## Data and meaning

Workspace.observations is optional; legacy workspaces remain valid. Each record has an ID, kind (general, crate, placement, parking, or measurement), protected photo URL, notes, location, nullable crateId, nullable measurement, and capture timestamp. A general photo needs no category decision or related record: crateId and measurement can both be null, notes and location can be empty, and optional metadata can be absent. Optional metadata is labelCode, photoRole (outside/contents), and helperId. The model and both server adapters validate the records and their links. Unknown kinds are rejected; general is preserved as general during recovery and shared saves.

A label identifies a physical box independently of full inventory. The printed set is C-001–C-032; supported canonical IDs are C-001–C-999, excluding C-000. Unknown labels can have crateId:null. Where both identifiers exist, QuickCapture and appendObservation require the crate’s canonical code to match. LabelQuest prefers explicit label identity over legacy crate-ID fallback.

Photos do not create inventory, infer capacity, recognize contents, alter volume, move 3D objects, or make disposal decisions. Placement photos record where an object is now. Parking photos do not certify vehicle or door clearance.

Measurements are manual: value, unit, endpoint label, and basis:'user-measured'. Values must be finite, positive, and at most 1,000,000; units are cm, m, in, or ft. A blank reading retains measurement:null and a pending-reading note. Do not infer distances or parallel boundaries from an image.

## Persistence and retry

- One active route owns one useWorkspace hook. HelperIdentity receives that instance instead of mounting a competing hook.
- Selecting a photo makes a local preview. **Save photo** retains the exact selected original and a separate display preview through uploadCratePhoto, then appends its observation. Protected /api/photos/... paths are reused.
- A stable draft ID prevents duplicate observations. An in-memory map shares concurrent uploads for that ID; a successful uploaded URL is reused after a failed workspace save. appendObservation rechecks the latest workspace and preserves unrelated fields.
- sessionStorage key garage-quick-capture-draft-v1 stores the form and uploaded URL, never raw image bytes. It supports same-tab navigation/reload, not cross-device recovery. An unuploaded original may need reselection. Restored drafts identify their prior type, label, and link.
- An upload finishing after unmount preserves its URL without letting the old component update the workspace or overwrite a newer form.
- Shared success requires the record to exist, status:'shared', and dirty:false. Only then is the session draft removed. Upload completion is not shared-save confirmation.
- Conflict recovery exports the device draft before loading the shared version. The photo form remains for an explicit retry. An uploaded, unappended photo also has a separate draft export. Unrelated edits are not automatically merged.

Revision checks protect concurrent saves. Older clients cannot silently drop observations or saved label/role/helper metadata; the server returns 409 with the current snapshot. A lost upload response may leave an unreferenced private photo, but must not create duplicate observation records.

## Identity and points

The explicit helper preference uses garage-reset-current-player-v1. Attribution resolves it against current shared players; anonymous capture remains valid. Joining reuses a normalized name or adds one, initializing the existing default rewards book when absent. Previous work is not retroactively assigned.

Workspace.photoAwards separately stores observationId, helperId, points:25, and reviewedAt. One explicit review credits one known photo to one existing helper; the timestamp cannot precede capture. This includes general uploads and requires the same useful-information review as other photos. Awards are immutable. Score combines these points with sticker, inventory, and completed cleanup points and shows the breakdown.

No automatic points, cash approvals, or payment records come from capture or joining. Score currently collects points only. The legacy cash ledger remains intact and may be displayed read-only; no dollar conversion is set.

## Sticker and inventory receipts

Workspace.activityCredits is a separate optional immutable ledger. A sticker receipt has id, kind: "sticker", helperId, points: 25, createdAt, canonical labelCode, and surface: "front" | "lid". Its ID is exactly `sticker:<labelCode>:<surface>`, so each physical position can earn once across helpers. The UI requires explicit placement confirmation; a scan alone earns nothing.

An inventory receipt has id, kind: "inventory", helperId, points: 25, createdAt, the stored labelCode, and 1–100 itemIds. Custom crate code spelling is preserved. The inventoryCredit helper receives the candidate workspace after the actual new contents have been appended. **Save the new items and receipt in the same workspace.update call.** The server rejects new receipts for IDs already present in the previous snapshot. IDs cannot overlap another inventory receipt; new batches earn 25 total, not 25 per item. Later edits and moves preserve the old receipt and earn nothing more.

Both credit kinds require a known helper and preserve all unrelated workspace data, including photo awards and the legacy cash ledger. stickerCredit and inventoryCredit return the original workspace on invalid or duplicate requests. activityPointsForPlayer returns separate sticker/inventory counts and points plus their combined points. Capture and label photos still do not create inventory records automatically.

## Invitations and verification

ShareFamilyLink prepares an authenticated invitation only after **Invite a helper**. Another click opens sharing or copies it. The private link stays in the panel’s memory until closed. Never log it or put it in public assets, manifests, or container QR codes.

Run from this app directory:

~~~sh
npm run typecheck
node src/discover/observationDraft.test.mjs
node src/rewards/helperProfile.test.mjs
node src/rewards/photoPoints.test.mjs
node src/rewards/activityPoints.test.mjs
npm run test:crates
npm run test:labels
npm run test:server
npm run test:vercel
npm run test:access
npm run build
~~~

Use isolated browser fixtures for both labeled roles, unknown labels, mismatched links, anonymous/named capture, manual/pending readings, duplicate Save, navigation during upload, reload, and 409 recovery. Physical iPhone camera, AirDrop, and Home Screen installation require device testing.

## Multiple photos and unchanged originals

**Choose from photos** accepts multiple image files on phone or laptop. A selection of two or more opens a batch queue with optional notes per photo, **Save photos**, **Add more photos**, and retry of unsaved entries. Up to 50 photos fit in a queue. The current capture's crate/label/role/location context is retained; a missing registered crate can be unlinked explicitly. Existing unfinished single-photo drafts must be finished before switching to a batch.

IndexedDB stores each queued original File and its metadata until the user removes it or taps **Done** after confirmed shared saves. Storage failures visibly fall back to memory; the user must keep that page open. This is browser-local recovery, not background upload or a family backup. The app must remain open while saving. Notes persist as they are typed. Stable observation IDs and remembered uploaded URLs prevent retries from duplicating existing shared records. Individual file failures do not stop later files, and **Saved** appears only after a shared workspace acknowledgement.

All new photo upload paths retain the selected original bytes and embedded metadata, its filename, file-modification time, and SHA-256. Originals up to 50 MiB upload in 2 MiB parts, then the server checks the assembled bytes before confirming success. A JPEG preview is separate; a browser that cannot decode HEIC receives a clearly labeled placeholder while the HEIC original is preserved. Placeholder previews are excluded from image analysis. Originals and manifests remain behind family access in existing private app storage. Expanded new-photo cards offer original and metadata downloads. Older JPEG-only uploads are unchanged; their original camera files cannot be reconstructed.

The retained source is the file provided by the device picker. This does not recover metadata or companion files that the device omitted before handing the file to the app. Pilot archiving remains separate, and automatic photo analysis remains disabled pending its existing provider approval.
