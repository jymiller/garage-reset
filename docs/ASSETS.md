# Garage Reset — Game Art Assets

Where to drop generated images and how they should look so they drop straight into the game.

## Where

Put files in `public/art/`. Everything there is served at `/art/...` and ships with the
deploy. Use these folders + filenames (the names must match the in-code IDs so I can wire
them automatically):

| Folder | Files (exact names) | Used for |
|---|---|---|
| `public/art/trophies/` | `first.png` `streak.png` `quarter.png` `half.png` `zone.png` `quarterm.png` `boss.png` | The 7 achievement badges in the HUD trophy case |
| `public/art/players/` | `john.png` `griffin.png` `lj.png` | Player avatars (leaderboard, Players screen) |
| `public/art/zones/` | `griffin-workshop.png` `griffin-fitness.png` `lj-clothing.png` `john-table.png` `shared-storage.png` `exit-zone.png` | Zone icons |
| `public/art/ui/` | `logo.png`, `title.png`, plus any chrome | Pixel wordmark / title-screen art |
| `public/art/sprites/` | anything (`coin.png`, …) | Misc sprites |
| `public/art/incoming/` | dump anything unsorted here | I'll crop, resize, rename, and wire it in |

Don't know the right name? Drop it in `incoming/` and tell me what it is.

## How they should look

- **Format:** PNG with a **transparent background** (assets sit on near-black `#07070e`).
- **True pixel art:** nearest-neighbor, **no anti-aliasing, no gradients, no blur, no glow.**
  Hard pixel edges. The app already renders with `image-rendering: pixelated`, so small
  art scales up crisp.
- **Shape/size:** badges, avatars, zone icons = **square, 64×64** source (128×128 if you
  want more detail). Logo/title = transparent, wide (~256×64).
- **Palette — match the game's neons** on transparency:
  - green `#2bd14a` · magenta `#ff3ca6` · yellow `#ffd23f` · cyan `#36e0e0`
  - soft white `#e8e8f5` · outlines near-black `#07070e`
  - Keep each asset to a tight handful of colors. Reward/trophy art leans **yellow**.
- **Player colors are fixed:** John = cyan, Griffin = yellow, LJ = pink — tint their
  avatars accordingly.
- Keep files small (a few KB each).

## Generation prompts

### Style block — prepend to every subject

```
8-bit arcade pixel art, single centered object, flat hard-edged pixels, NO anti-aliasing,
no gradients, no blur, no soft shadows, bold near-black outline. Vibrant limited neon
palette: electric green #2bd14a, hot magenta #ff3ca6, arcade yellow #ffd23f, cyan #36e0e0,
soft white #e8e8f5, on a solid near-black #07070e background. 1980s arcade-cabinet look,
crisp and readable at small size, 1:1 square. Subject:
```

If your tool supports transparent PNG, enable it. Otherwise leave the `#07070e`
background — it matches the app and gets knocked out in processing.

### Subjects (one per file)

Trophies (lean gold/yellow):
- `first.png` — a glowing first-place star medal
- `streak.png` — a blazing pixel flame
- `quarter.png` — a thermometer a quarter full, warming up
- `half.png` — a gleaming trophy cup, half-lit
- `zone.png` — a shield with a big checkmark and a star
- `quarterm.png` — an open treasure chest spilling loot
- `boss.png` — a golden crown with a tiny skull

Players (head-and-shoulders avatars, tinted to the player color):
- `john.png` — arcade hero avatar, cyan palette
- `griffin.png` — arcade hero avatar, yellow palette
- `lj.png` — arcade hero avatar, magenta/pink palette

Zones:
- `griffin-workshop.png` — crossed wrench and screwdriver
- `griffin-fitness.png` — a dumbbell
- `lj-clothing.png` — a t-shirt and a sneaker
- `john-table.png` — a folding work table
- `shared-storage.png` — a stack of storage totes on a shelf
- `exit-zone.png` — a recycling/trash bin with arrows

Logo (`ui/logo.png`): the words "GARAGE RESET" as a chunky two-line 8-bit logo,
electric-green letters with a magenta block-shadow, wide banner.

### Title / attract screen (`ui/title.png`)

```
Retro arcade TITLE SCREEN, vertical/portrait composition for a phone. Top third: a big
chunky 8-bit "GARAGE RESET" logo, electric-green letters with a magenta block-shadow.
Middle: a pixel-art scene of a cluttered garage interior — wire shelves of stacked totes,
a workbench, a bike leaning, a car silhouette — lit by neon green and magenta. Bottom:
blinking-style arcade text "PRESS START" in yellow and "INSERT COIN" in cyan. Full CRT
scanline texture, near-black #07070e background, flat neon palette, crisp hard pixels,
NO anti-aliasing, 1980s arcade attract-mode aesthetic. 9:16 aspect.
```

The animated "playing until they tap" behavior (blinking text, moving scanlines,
tap-to-start) is implemented in code over this still — not a GIF — so it stays sharp
and adds almost no weight.

### Output

Generate at any size (1024×1024 is fine); art gets downscaled to crisp 64/128 px with
nearest-neighbor, backgrounds knocked out, palette-snapped, and renamed. Unsure of a
filename? Drop it in `incoming/`.

## After you drop them

Tell me they're in and I'll wire them up — trophy badges replace the `???` boxes, player
avatars appear in the leaderboard, and `logo.png` can replace the text title on the HUD.
