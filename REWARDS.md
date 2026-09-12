# Points now; dollar values later

Open **Score** from the Home points badge or More. It uses the shared family workspace. The current screen collects points; it does not set dollar values, approve new cash, or record payments.

## What earns points

- A physical **front / side sticker** earns **25 points** when its placement is confirmed. The matching **lid sticker** earns another **25 points**. Each position counts once per crate ID, across all helpers.
- A saved batch of **new inventory contents** earns **25 points** for the chosen helper. A batch may contain one item record or several; it is not 25 points per item. Editing or moving previously recorded contents earns no additional credit.
- A helpful photo earns **25 points** after an explicit useful-photo review. Saving or uploading it alone awards nothing.
- A completed cleanup mission earns **100 points** once it is assigned to a helper.

A new view of crate contents, an object’s location, a real change, a parking space, or a tape measurement can be useful. Repeated or unclear shots can stay uncredited. Each observation can receive one immutable photo award. Outside and contents photos are separate observations and may each be reviewed.

Score combines sticker, inventory, reviewed-photo, and cleanup points and shows all four parts. **View score for** changes the displayed helper; **Who’s helping?** chooses the name remembered for future work. A first name or nickname is enough, and taking photos without a name stays available. Original device-local task XP is separate.

## Sticker and inventory credit

In **Label & photograph**, choose the helper and confirm **Front / side sticker** or **Lid sticker** only after placing that sticker. Each confirmation is permanent; another helper cannot claim the same position. Wait for **Saved with the family** before continuing on another device.

For a registered crate, choose a name under **Inventory points go to…** or **Choose your name for inventory points**, then add actual new contents. The item records and their one batch credit save together. Anonymous inventory entry stays available but earns no credit. Existing records can be corrected or moved without earning again. **Sticker & inventory points** lists the receipts.

## Review useful photos

Expand **For John · review useful photos**. Check the photo and notes, choose the helper, check **This adds useful information, not a repeat**, then tap **Award 25 points**. An anonymous photo can be credited to the correct helper during review without rewriting who originally captured it.

**Who finished each cleanup?** assigns completed missions to helpers. Earlier approved mission records retain their original assignment. **Reviewed photo points** shows recorded awards.

Everyone with the family link can use these controls; there is no separately protected parent account. The family convention is to leave point review to John. Wait for the shared save before reviewing another item or switching devices. On conflict, download the device draft before loading the shared version.

## Existing records

The underlying rewards book, mission assignments, earlier approvals, and payment records are preserved. If earlier approved records exist, **Earlier cash records** displays them read-only. They do not establish a conversion between current points and future dollars. The current Score screen imports no cash-approval or payment mutation functions.

Helper registration uses the existing player structure, initializing its default book when necessary. This is storage compatibility, not activation of a visible cash plan. Photo credit is a separate optional `Workspace.photoAwards` array: `{observationId, helperId, points: 25, reviewedAt}`. It requires a real observation, an existing helper, and a review timestamp no earlier than the capture. Duplicate, removed, or rewritten awards are rejected by the model/server rules.

Sticker and inventory credits use the separate optional Workspace.activityCredits ledger. Sticker IDs are deterministic per code and surface. Inventory receipts name the actual new item IDs and preserve the stored crate code, including custom codes. New inventory receipts must accompany those newly added item IDs in the same workspace write. Existing receipts stay immutable when items later move. These credits leave cash and photo awards unchanged.

## Verification

Run from this app directory:

```sh
npm run typecheck
node src/rewards/photoPoints.test.mjs
node src/rewards/activityPoints.test.mjs
node src/rewards/helperProfile.test.mjs
node src/rewards/model.test.mjs
npm run test:crates
npm run test:server
npm run test:vercel
npm run build
```

The activity tests cover separate front/lid credit, retries, duplicate and overlapping inventory batches, helper reassignment, invalid inputs, custom crate codes, later item movement, and unchanged cash/photo/volume records. The photo-points tests cover one-time credit, duplicate and reassigned attempts, outside/contents observations, missing helpers/photos, invalid timestamps, unchanged source records, and unchanged cash/volume summaries. Use isolated local fixtures for browser review: award one useful photo, verify the selected helper gains 25 points after the shared save, reload, and confirm a second award is unavailable. Verify cleanup assignment adds 100 points and no money-action controls are present.
