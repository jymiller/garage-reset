# Garage Reset on your phone

Open the existing family link on each device. New visits start at Home; existing `#layout`, `#pickup`, and other saved links still open their original tools. Tap **Home** in the persistent navigation to choose what to do next.

## The five destinations

- **Home:** the next small mission, resume an unfinished round, the next crate needing attention, photo-mission XP, and the registered-volume goal.
- **Missions:** choose Clear a floor area, Sort a shelf, or Sort a crate; choose 5, 10, or 15 minutes; take a before photo; sort and count; take an after photo; confirm parking clearance; finish for 100 XP. Camera and existing-photo controls are separate. With a reward plan, each player can have one unfinished round; choose who is playing so friends can work separately.
- **Crates:** register a container, give it a shelf address and photo, record its contents, assign decisions/destinations, and confirm the repacked fill. The phone puts the working container ahead of the volume report. Home directs unfinished repacks to their fill check and unrecorded occupied crates to their contents step.
- **Garage:** the photo-linked 3D model and spatial catalog. The laptop retains its larger planning workbench.
- **More:** Score & cash, Yellow Sack pickup, Crew, Task board, Item list, Task progress, Team standings, Sound controls, and the phone playbook.

The game shell uses system fonts, clear touch controls, a bottom bar on phones, and a top bar on laptops. Illustrated icons show a house, mission camera, smiling crate, garage, and toolbox; every destination keeps its text label. Phone navigation icons are 38px with 74px minimum-height buttons. Home tool icons are 54px, and mission choices show a broom, shelf, or crate at 44–48px. Navigation participates in browser Back/Forward. Returning to an active mission or crate preserves its local view; the mission board and All containers controls return to their respective lists.

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
