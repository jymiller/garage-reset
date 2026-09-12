# Points and cash rewards

Open `#score` from Home’s **Score & cash** card, the points badge, Missions, or More. This board uses the shared workspace, so the same player records appear on phone and laptop. Original device-local task XP remains separate.

## Set up the plan

The proposed starting plan is **10 approved photo missions = $100 per person**. Each finished mission earns 100 points and is worth $10 after review. Before the first approval, the plan can instead use 20 missions ($5 each) or one shared $100 pool. The starting screen asks you to save the plan; viewing it does not approve work or record a payment.

Griff is the starting player. Add friends by name, choose who is playing, and start a photo mission. Player selection is remembered on that device. Each player can have their own unfinished mission. Old unassigned missions need an explicit player assignment before counting toward that player’s reward.

## Read the score

- **Points:** 100 for each completed photo mission assigned to the player.
- **Awaiting review:** a possible cash reward, subject to review and the plan’s remaining cap.
- **Approved:** cash recorded as earned after John reviews the before/after photos and description.
- **Paid:** approved cash recorded as already paid outside the app.
- **Still to pay:** approved cash minus recorded payments.

Points can keep increasing after the cash limit is reached. In a shared pool, approved rewards consume the pool in approval order. Cash settings lock after the first approval to keep previously approved amounts stable.

## Review and pay

The **For John** controls let the family review a completed mission, approve its reward, and record payment with a separate confirmation. Finishing a mission never marks it paid. The app does not transfer money or connect to a bank.

These controls use the existing shared family access. They are not a separate parent account or a protected parent-only role: everyone with the family link can use them. Review the work together and keep the link within the group.

Wait for the shared/saved status before moving to another device. Approval and payment controls wait for a saved workspace. An offline draft or conflicting edit is not confirmation that the shared cash record has changed; export the draft and use the existing conflict review controls.

## Compatibility

Rewards are an optional addition to the existing version-1 workspace. Existing containers, photos, missions, and spatial annotations retain their formats. Older writes cannot silently remove an existing reward ledger. Approved reward and payment records are protected against rewrites; this is a family reward record, not a payroll system.

## Verification

The release checks passed: 44 model/mission/spatial/rewards tests, 32 Node/Vercel storage tests, 12 player-mission tests, and 25 label/sync/access tests (113 total). Coverage includes per-player and shared caps, duplicate reward/payment calls, unpaid versus paid amounts, missing player references, old snapshots, stale writes, protected history, and unrelated inventory edits.

An isolated browser preview checked explicit plan setup, adding a friend, two players retaining separate unfinished missions, duplicate-open blocking, review approval, payment cancellation/confirmation, player selection, and persisted totals after reload. A fresh localhost origin with separate browser storage loaded the same shared points and payment totals. Completion records for cash-review testing used synthetic local fixtures. No plan or cash record was created in the real hosted workspace during QA. Score, Home, Missions and their task-score links fit at 320px, 390px and 1366px. Native iPhone camera capture still needs to be exercised on the physical phone.
