# Garage Reset on your phone

Open the existing family link on each device. New visits start at Home; existing `#layout`, `#pickup`, and other saved links still open their original tools. Tap **Home** in the persistent navigation to choose what to do next.

## The five destinations

- **Home:** the next small mission, resume an unfinished round, the next crate needing attention, photo-mission XP, and the registered-volume goal.
- **Missions:** choose Clear a floor area, Sort a shelf, or Sort a crate; choose 5, 10, or 15 minutes; take a before photo; sort and count; take an after photo; confirm parking clearance; finish for 100 XP. Camera and existing-photo controls are separate. One unfinished round is resumed before another is created.
- **Crates:** register a container, give it a shelf address and photo, record its contents, assign decisions/destinations, and confirm the repacked fill. The phone puts the working container ahead of the volume report. Home directs unfinished repacks to their fill check and unrecorded occupied crates to their contents step.
- **Garage:** the photo-linked 3D model and spatial catalog. The laptop retains its larger planning workbench.
- **More:** Yellow Sack pickup, crew, original task board/inventory/game scores, sound controls, and the phone playbook.

The game shell uses system fonts, clear touch controls, a bottom bar on phones, and a top bar on laptops. Navigation participates in browser Back/Forward. Returning to an active mission or crate preserves its local view; the mission board and All containers controls return to their respective lists.

## Label boxes before sorting

In **Crates**, choose **Download 32 blank labels**. The four-page PDF is made for ordinary US Letter paper: eight labels per page, actual size / 100%, single-sided. Cut on the borders and tape to the container body, facing the aisle. Print a second copy for matching lid labels if useful. Test one printed QR with the iPhone Camera before attaching the full set.

IDs **C-001 through C-032** stay with their boxes. Match existing app IDs before using a label; never give two boxes the same ID. Write a short contents description and a separate home such as **Right rack · middle shelf**. A move changes the home, not the box ID.

The iPhone Camera opens a QR link to `#crates?code=C-001` on the public app. A registered code opens its container. An unused code offers **Register C-001** with the ID already filled in; blank labels do not automatically create inventory. A new device first needs the family's private link, then returns to the scanned box. QR labels contain only the public address and container ID, never the family access key. Existing containers also have a **QR label** preview with a one-label print action.

For tomorrow: label one box, scan it, name it, record its home, then take a photo and open it. Dictate a short list of contents, one item or group per line. Choose keep / donate / sell / recycle / trash / ask, put keepers in a named home, and update how full the box is. Keep one box open at a time and keep the parking boundary clear. A photo records evidence; contents entry is manual, not automatic object recognition.

Phone instructions and main buttons use 16px or larger text. Form fields, mission choices and before/after actions are sized for a narrow phone screen.

## What the numbers mean

Photo-mission XP comes only from validated completed rounds: 100 XP per round, three rounds per level. It does not use the original game’s device-local scores and does not trigger cash payouts.

The 50% goal uses registered container capacity × fill estimates. Home suppresses volume-progress claims while any crate is being sorted and labels an unlocked baseline as in progress. Missing contents records do not imply an empty crate. The goal is not a measured whole-garage result until the baseline covers the intended storage.

## Verification

The production build and 59 relevant label, mission, crate, sync, access, and Vercel adapter tests pass. Local browser checks covered the five primary destinations at 320px, the mission setup/camera step and Home resume at 390px, crate registration and contents/repack controls at 320px, browser Back, and the laptop layout at 1366px. No horizontal overflow was observed in the five main screens. The label update also checked unknown-code registration, saved-code reopening after reload, and the single-label preview at 390px. Every QR on all four PDF pages was decoded from rendered pages and matched its expected public container link. Navigation targets are at least 58px high; main phone buttons use 16px type, crate fields 18px, and mission headings at least 24px. CSS accounts for device safe areas and reduced-motion preferences.

Browser resizing is not a physical iPhone/Safari test. Native camera permission and capture must still be exercised on the phone. QA mission/container records were confined to a separate local server and did not enter the hosted workspace.
