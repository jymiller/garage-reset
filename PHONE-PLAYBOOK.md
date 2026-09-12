# Garage Reset on your phone

Open the existing family link on each device. New visits start at Home; existing `#layout`, `#pickup`, and other saved links still open their original tools. Tap **Home** in the persistent navigation to reach base camp.

## The five destinations

- **Home:** the next small mission, resume an unfinished round, the next crate needing attention, photo-mission XP, and the registered-volume goal.
- **Missions:** pick a floor patch, shelf, or crate; choose 5, 10, or 15 minutes; take the before shot; sort and count; take the after shot; confirm parking clearance; finish for 100 XP. Camera and existing-photo controls are separate. One unfinished round is resumed before another is created.
- **Crates:** register a container, give it a shelf address and photo, record its contents, assign decisions/destinations, and confirm the repacked fill. The phone puts the working container ahead of the volume report. Home directs unfinished repacks to their fill check and unrecorded occupied crates to their contents step.
- **Garage:** the photo-linked 3D model and spatial catalog. The laptop retains its larger planning workbench.
- **More:** Yellow Sack pickup, crew, original task board/inventory/game scores, sound controls, and the phone playbook.

The game shell uses system fonts, clear touch controls, a bottom bar on phones, and a top bar on laptops. Navigation participates in browser Back/Forward. Returning to an active mission or crate preserves its local view; the mission board and All containers controls return to their respective lists.

## What the numbers mean

Photo-mission XP comes only from validated completed rounds: 100 XP per round, three rounds per level. It does not use the original game’s device-local scores and does not trigger cash payouts.

The 50% goal uses registered container capacity × fill estimates. Home suppresses volume-progress claims while any crate is being sorted and labels an unlocked baseline as in progress. Missing contents records do not imply an empty crate. The goal is not a measured whole-garage result until the baseline covers the intended storage.

## Verification

The production build and 35 relevant mission, crate, sync, and access tests pass. Local browser checks covered the five primary destinations at 320px, the mission setup/camera step and Home resume at 390px, crate registration and contents/repack controls at 320px, browser Back, and the laptop layout at 1366px. No horizontal overflow was observed in the five main screens. Navigation targets are at least 55px high; phone form inputs use 16px type. CSS accounts for device safe areas and reduced-motion preferences.

Browser resizing is not a physical iPhone/Safari test. Native camera permission and capture must still be exercised on the phone. QA mission/container records were confined to a separate local server and did not enter the hosted workspace.
