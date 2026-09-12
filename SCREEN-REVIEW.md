# Screen consistency review

The complete route set was reviewed at 320px for horizontal overflow and pixel font usage. Every route fit the viewport, and no rendered text used Press Start 2P or VT323. The six refreshed tool pages also fit at 390px and 1366px; phone and laptop screenshots were inspected for readable controls and wrapping. The external font links, CRT overlay, pixel typography, block progress bars, and arcade styling were removed. Existing photo/3D workbenches retain their dark green canvas; older tools now share Home’s cream/sage treatment.

| Route | Screen | Data scope |
| --- | --- | --- |
| `#home` | Home | Shared crate and photo-mission progress |
| `#play` | Missions | Shared workspace |
| `#crates` | Containers and QR labels | Shared workspace |
| `#layout` | Garage model and photo catalog | Shared catalog; local footprint corrections |
| `#pickup` | Yellow Sack pickup | Existing local planner |
| `#more` | Tools and help | Navigation |
| `#dashboard` | Task progress | Existing device-local tasks and scores |
| `#people` | Crew | Existing device-local tasks |
| `#zones` | Tasks by area | Existing device-local tasks and items |
| `#capture` | Item list | Existing device-local items |
| `#sound` | Sounds | Browser sound preference |
| `#results` | Team standings | Existing device-local tasks |
| `#snowball` | Alias to Missions | Shared workspace |

Local interaction checks covered crew switching, all task statuses and undo, a weighted task’s 150 XP display, expanded areas, adding a named/owned/located item, changing its decision, and canceling item deletion. Task standings were verified with an unfinished task list, so there is no automatic physical-clearance claim. All test records were confined to a separate local preview.

The production build and 59 existing label, mission, crate, sync, family-access, and Vercel adapter tests passed. The tests cover those existing systems; screen layout is checked in the browser. Physical iPhone/Safari camera behavior was not part of this visual refresh.

Reset controls were reviewed in code after replacing the native browser confirmation with an in-page, two-step action. A native dialog from the earlier local preview blocked automated click checks for the replacement reset and sound toggle; neither was recorded as an interaction-test pass.
