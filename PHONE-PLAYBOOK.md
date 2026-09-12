# Garage Reset on your phone

Open the existing family link on each device. New visits start at Home; existing `#layout`, `#pickup`, and other saved links still open their original tools. Tap **Home** in the persistent navigation to choose what to do next.

## Put it on your iPhone Home Screen

Open your working family link in **Safari**. Wait for your changes to sync. Tap **Share** (possibly inside Safari’s **More** menu), choose **Add to Home Screen**, leave **Open as Web App** enabled if shown, then tap **Add**. Launch the new **Garage Reset** icon. Full illustrated steps are in **More** and [Apple’s iPhone guide](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios).

This is the standalone Home Screen web app, served by the existing Vercel deployment. It has its own garage icon and starts at Home. Crates, photos, missions and scores use the same family workspace. If the new app asks for access, paste the existing family link once. Finish syncing before installation and retain the original browser: unsent drafts, original task records and device-only planning settings may remain there. A connection is needed to open the app, upload photos and sync. This update adds no service worker, offline cache, native camera plugin, notifications, App Store package or new authentication flow.

The manifest uses the stable app ID `/`, start URL `/#home`, scope `/`, and `standalone` display. The icon files are opaque PNGs at 180, 192 and 512 pixels plus the vector source; none contain personal photos or family credentials. Native TestFlight/App Store packaging is a separate path requiring Apple signing and an iOS build.

## The five destinations

- **Home:** the next small mission, resume an unfinished round, the next crate needing attention, photo-mission XP, and the registered-volume goal.
- **Missions:** choose Clear a floor area, Sort a shelf, or Sort a crate; choose 5, 10, or 15 minutes; take a before photo; sort and count; take an after photo; confirm parking clearance; finish for 100 XP. Camera and existing-photo controls are separate. With a reward plan, each player can have one unfinished round; choose who is playing so friends can work separately.
- **Crates:** register a container, give it a shelf address and photo, record its contents, assign decisions/destinations, and confirm the repacked fill. The phone puts the working container ahead of the volume report. Home directs unfinished repacks to their fill check and unrecorded occupied crates to their contents step.
- **Garage:** the photo-linked 3D model and spatial catalog. The laptop retains its larger planning workbench.
- **More:** Score & cash, Yellow Sack pickup, Crew, Task board, Item list, Task progress, Team standings, Sound controls, and the phone playbook.

The game shell uses system fonts, clear touch controls, a bottom bar on phones, and a top bar on laptops. Illustrated icons show a house, mission camera, smiling crate, garage, and toolbox; every destination keeps its text label. Phone navigation icons are 38px with 74px minimum-height buttons. Home tool icons are 54px, and mission choices show a broom, shelf, or crate at 44–48px. Navigation participates in browser Back/Forward. Returning to an active mission or crate preserves its local view; the mission board and All containers controls return to their respective lists.

## Choose a mission in 3D

On **Missions**, use **3D garage** to look around before choosing work. Drag on a laptop to rotate; use the rotate, zoom and reset buttons for easier control. On a phone, turn on **Enable touch rotation** to orbit with one finger or zoom with two, then **Done rotating** to scroll the page normally. The area list works without touching the model.

Select a rack or identified item, then choose **Use this area**. This fills the mission type, location and linked crate (when one is registered). Check those fields and take a before photo to create the mission. Selecting a shape alone does not start a mission, move an object or award points. Changing the registered crate clears the previous location so it cannot keep another crate’s address. Cars and utility references are for viewing and do not offer a cleanup mission.

Switch to **Reference photo** to compare the model with the selected object’s photo. These are static photographs. The 3D view uses the June floor scan and September 9 object references, with estimated object positions and dimensions. Illustrative totes are not individually identified inventory. Identify and link real containers in **Garage** to select them by their registered crate ID. Corrections to the layout are remembered on this device; identified items and crate inventory use the shared workspace.

## Label boxes before sorting

In **Crates**, choose **Download 32 blank labels**. The four-page PDF is made for ordinary US Letter paper: eight labels per page, actual size / 100%, single-sided. Cut on the borders and tape to the container body, facing the aisle. Print a second copy for matching lid labels if useful. Test one printed QR with the iPhone Camera before attaching the full set.

IDs **C-001 through C-032** stay with their boxes. Match existing app IDs before using a label; never give two boxes the same ID. Write a short contents description and a separate home such as **Right rack · middle shelf**. A move changes the home, not the box ID.

The iPhone Camera opens a QR link to `#crates?code=C-001` on the public app. A registered code opens its container. An unused code offers **Register C-001** with the ID already filled in; blank labels do not automatically create inventory. A new device first needs the family's private link, then returns to the scanned box. QR labels contain only the public address and container ID, never the family access key. Existing containers also have a **QR label** preview with a one-label print action.

For tomorrow: label one box, scan it, name it, record its home, then take a photo and open it. Dictate a short list of contents, one item or group per line. Choose keep / donate / sell / recycle / trash / ask, put keepers in a named home, and update how full the box is. Keep one box open at a time and keep the parking boundary clear. A photo records evidence; contents entry is manual, not automatic object recognition.

Phone instructions and main buttons use 16px or larger text. Form fields, mission choices and before/after actions are sized for a narrow phone screen.

## One consistent interface

The former arcade pages now use the same system type, cream background, green text, illustrated icons, rounded cards, and large phone controls as Home. **Crew** switches between people and shows assigned tasks. **Task board** opens tasks and items by area. **Item list** uses explicit owner, area, and decision fields. **Task progress** and **Team standings** show task completion and scores without implying that the physical garage is clear. **Sounds** has a mute switch and labeled previews.

Those task and loose-item records still use the existing device-local store. Crates and photo missions continue using the shared workspace. Styling does not migrate, reset, or combine these records. Item deletion and task reset require a second action inside the page.

## What the numbers mean

Photo-mission XP comes only from validated completed rounds: 100 XP per round, three rounds per level. Individual reward scores use the missions explicitly assigned to that player. It does not use the original game’s device-local scores and does not send money. Open **Score & cash** to assign missions to players, set a $100 reward plan, review earned cash, and record payments made outside the app.

The 50% goal uses registered container capacity × fill estimates. Home suppresses volume-progress claims while any crate is being sorted and labels an unlocked baseline as in progress. Missing contents records do not imply an empty crate. The goal is not a measured whole-garage result until the baseline covers the intended storage.

## Verification

The production build and 59 relevant label, mission, crate, sync, access, and Vercel adapter tests pass. Local browser checks covered the five primary destinations at 320px, the mission setup/camera step and Home resume at 390px, crate registration and contents/repack controls at 320px, browser Back, and the laptop layout at 1366px. No horizontal overflow was observed in the five main screens. The label update also checked unknown-code registration, saved-code reopening after reload, and the single-label preview at 390px. Every QR on all four PDF pages was decoded from rendered pages and matched its expected public container link. Navigation targets are at least 58px high; main phone buttons use 16px type, crate fields 18px, and mission headings at least 24px. CSS accounts for device safe areas and reduced-motion preferences.

Browser resizing is not a physical iPhone/Safari test. Native camera permission and capture must still be exercised on the phone. QA mission/container records were confined to a separate local server and did not enter the hosted workspace.

### Mission world verification

The 3D mission picker passed the production build and 51 mission, player-setup, area-mapping, scan, layout and spatial tests. Local browser checks covered rotation/zoom/reset, rear/whole framing, source-photo switching, protected reference objects, linked crate mission creation, shelf mission editing and reload persistence. At 320px and 390px the picker has no horizontal overflow, 16px camera labels, and a touch-rotation gate that restores page scrolling when disabled. The existing Garage view still renders at 320px. A separate local fixture supplied the QA crate and mission; the live workspace was not changed. Phone resizing verifies layout and toggle behavior, not physical iPhone multitouch gestures.

### Home Screen installation verification

The production build passed. Built metadata was checked for stable standalone launch, a credential-free manifest, correct icon paths and exact PNG sizes. Browser checks covered Home → installation guide, the data explanation, and readable 16px instructions at 320px, 390px and 1366px without horizontal overflow. The browser error log was empty on the guide. Physical Safari Home Screen installation, camera permissions, and app-to-browser data handoff still need exercising on the iPhone; this desktop session cannot install it on that device.
