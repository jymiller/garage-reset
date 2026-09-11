# Photo missions

Open `/#play`, or select **Photo missions** from the pickup planner. Existing PLAY links (`/#snowball`) now open this screen. Previous game statistics and local task data remain available separately.

## A playable round

1. Choose one floor patch, one shelf section, or one crate. Link a registered crate when useful and choose 5, 10 or 15 minutes.
2. Take a before photo with the phone camera, choose an existing photo, or explicitly use a linked crate's saved photo. The mission cannot start without a photo. An unstarted round can be changed from its before-photo screen.
3. Start the timer. Tap the four counters after dealing with an item or group: put away, into the sack, donation box, or ask the owner. The timer can pause and survives reloads. It never forces a completion or awards points for speed.
4. Capture the after photo, describe the result, and confirm that the batch is finished with both car spaces and their access routes clear. Returning to work clears the after photo so it must be taken again.
5. Finish the round to earn 100 XP once. Compare before/after with a slider or side-by-side view, and keep the pair on the victory wall. Every three completed rounds raises the level; badges derive from completed rounds.

The app logs user-confirmed action and photos. It does not identify objects, verify cleanup from pixels, or turn game score into measured volume. Donation-box and sack counts are sorting actions, not confirmation that material has left the property.

Starting a linked crate round marks that crate as sorting. Its inventory and occupied fill must be checked in Crate lab before volume progress is considered confirmed. Finishing the photo mission links directly back to that crate's repacking screen. Completed mission photos remain independent from the crate's replaceable reference photo.

## Saving and limits

Missions use the existing shared workspace API and protected photo storage. Older workspaces without the optional missions field remain valid. Loopback remains a laptop preview. The Vercel production configuration targets [Garage Reset](https://garage-reset.vercel.app): open the privately shared family bookmark on each browser, then use its remembered device access. Mission records and photos use private Blob storage, with conditional ETag writes protecting concurrent revisions. See [VERCEL-DEPLOYMENT.md](VERCEL-DEPLOYMENT.md) for configuration and release checks. No Render deployment was created.

Visible hosted workspace screens refresh every 30 seconds; loopback uses four seconds, and hidden tabs skip background reads. Offline loaded pages retain drafts when browser storage is available; uploads need a connection. The browser compresses photo uploads to JPEG bodies of at most 3,500,000 bytes, with a smaller-image message if no encoding fits. The local Node raw-upload limit remains 8 MiB; the portable browser cap applies on both runtimes. Concurrent edits preserve a conflicting draft for export and review. A late request from a screen that has been closed cannot overwrite the newer screen's local cache.

`npm run test:play` checks photo/completion gates, timers, idempotent points, backwards compatibility, crate links and separation from volume estimates. `npm run test:server` checks persistence and server validation alongside authentication and photo storage.
