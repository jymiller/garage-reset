# Garage Reset — Design Characteristics

A reference for human and AI designers. Garage Reset is a local-first, mobile web app
that turns cleaning a shared family garage into an 8-bit arcade game. This document
captures the visual language, motion, audio, game design, and voice so anyone can
extend it consistently.

---

## 1. Concept & ethos

- **One job: momentum.** The app's only goal is to make the next small action obvious
  and rewarding. Never overwhelm; always surface "the next thing."
- **Chores as a game.** Real tasks are *quests*; finishing them earns XP, levels,
  streaks, and trophies. The game framing is the motivation engine, not decoration.
- **For a family, not a project manager.** Three players (John, Griffin, LJ) share one
  garage. It should feel encouraging and fun, never like enterprise software.
- **Aesthetic:** retro arcade cabinet — black screen, neon glow-free pixels, chunky
  borders, CRT scanlines, chiptune blips.

---

## 2. Color

Dark-only palette. Black canvas, a few saturated neons used to **encode meaning**, not
for rainbow decoration.

### Core tokens (CSS variables, `src/index.css`)

| Token | Hex | Role |
|---|---|---|
| `--arc-bg` | `#07070e` | App background (near-black) |
| `--arc-panel` | `#0d0d18` | Panel / card fill |
| `--arc-green` | `#2bd14a` | Primary action, "go", borders, XP |
| `--arc-green-dim` | `#6cf08a` | Done/secondary green text |
| `--arc-pink` | `#ff3ca6` | Section headers, alerts, "danger-lite" |
| `--arc-yellow` | `#ffd23f` | Rewards, XP totals, streak, highlights |
| `--arc-cyan` | `#36e0e0` | Info, "in progress", secondary toggle |
| `--arc-white` | `#e8e8f5` | Primary body text (soft white, not pure) |
| `--arc-mute` | `#8a8aa6` | Muted/secondary text |
| (red) | `#ff5a5a` | Trash / destructive only |

Dim structure tones: borders `#25253a`/`#1d1d2e`, muted text steps `#6a6a82` → `#5a5a70` → `#4f4f66`.

### Semantic encodings (don't reassign these)

- **Players:** John = cyan `#36e0e0`, Griffin = yellow `#ffd23f`, LJ = pink `#ff3ca6`.
- **Item fate:** Keep = green, Move = cyan, Donate = pink, Trash = red, Undecided = mute gray.
- **Reward = yellow.** XP, streaks, trophies, cleared-zone stars are always yellow.

### Contrast rule

Text on a colored fill uses **near-black** (`#07070e`/`#04210d`), never white. White/neon
text only on the dark panel/bg.

---

## 3. Typography

Two pixel fonts, two jobs. Both from Google Fonts.

| Font | Use | Notes |
|---|---|---|
| **Press Start 2P** | Titles, labels, buttons, nav, badges, stats | True 8-bit. Very wide — use **tiny** sizes: 7–13px. Always UPPERCASE. Keep strings short. |
| **VT323** | Body, task titles, list rows, values | Tall, condensed, very readable at size. Base 18px; hero quest titles up to ~48px. |

- **Case:** Press Start 2P is always ALL CAPS. VT323 keeps natural case for real content
  (task titles, item names) and UPPERCASE for labels/values.
- **Two weights only** in spirit — the fonts are single-weight; emphasis comes from
  color and size, not boldness.
- **Layering caveat (implementation):** the `.arc-vt` helper sets font-family only; base
  size lives on `body` (18px) so Tailwind `text-*` sizes still win.

---

## 4. Surfaces, components & shape

Everything is **square-cornered** (no border-radius) and **flat** (no gradients, no blur,
no soft drop-shadows). Depth comes from hard offset shadows and 2px neon borders.

| Component | Spec |
|---|---|
| **Panel** (`.arc-panel`) | Fill `#0d0d18`, **2px solid** neon border (green default; pink/yellow/dim variants), square corners. The universal container. |
| **Button** (`.arc-btn`) | Green fill, near-black text, Press Start 2P, **hard shadow `5px 5px 0`**. On press: translate `+3,+3` and shrink the shadow to `2px` (physical "click in"). Pink variant for alt actions. |
| **XP / progress bar** (`.arc-bar`) | 2px neon border, inner fill is a **blocky repeating gradient** (solid 9px / gap 3px) so it reads as pixel segments, not a smooth bar. |
| **Input** (`.arc-input`) | `#05050a` fill, 2px green border (yellow on focus), VT323 ~24px. |
| **Chip / badge** | Small Press Start 2P (7–8px) on a solid color fill = selected; transparent with colored border = unselected. |
| **Number badge** | Square, Press Start 2P, color-coded to its category. |

---

## 5. Effects & texture

- **CRT scanlines:** a full-screen fixed overlay of 1px dark lines every 3px
  (`repeating-linear-gradient`), pointer-events none. This single touch sells the "old
  monitor" feel across every screen.
- **No anti-aliasing:** `-webkit-font-smoothing: none` for crisp pixel edges.
- **No gradients** except the intentional blocky bar fill. No glow, no neon bloom, no blur.
- **Hard shadows only** (`Npx Npx 0`), never soft.

---

## 6. Motion

Minimal, physical, snappy — never smooth/organic.

- **Buttons** press *into* the screen (translate + shadow collapse), ~50ms.
- **Bars** fill in discrete steps (`transition: width .4s steps(8)`) — they "tick up," not glide.
- **Cards / list rows** nudge `translate-x` on press.
- **Map objects** animate between Now/Plan states (the one place a smooth ease is allowed,
  because it's a spatial diagram, not a control).

---

## 7. Layout

- **Mobile-first**, single column, `max-width: 28rem` centered. Big tap targets.
- **Fixed bottom nav** (6 items): HUD · PLAYERS · PLAY · MAP · ZONES · LOOT, with a 2px
  green top border and tiny pixel labels. Active item = green; inactive = dim.
- Generous vertical spacing; iOS safe-area padding under the nav.
- One primary action per screen, always reachable without scrolling where possible.

---

## 8. Game design

| Real concept | Game term | Mechanic |
|---|---|---|
| Task | **Quest** | Complete = **+50 XP**, plays a coin sound |
| Person | **Player** | Each has a color, level, XP, leaderboard rank |
| Item | **Loot** / **Inventory** | Captured with owner, zone, and a *fate* (keep/move/donate/trash) |
| Dashboard | **HUD** | Level, XP bar, leaderboard, next quests, trophy case |
| Zone | **Zone** | Earns a ★ when every quest in it is cleared |
| Focus mode | **PLAY** | One quest at a time, giant `DONE +50XP` button |

- **Levels:** every 150 XP (3 quests) = level up (fanfare).
- **Streak:** consecutive days with at least one quest cleared (yellow counter on the HUD).
- **Leaderboard:** the three players ranked by XP, color-coded.
- **Trophies (7):** First Blood, On Fire (3-day streak), Warming Up (25%), Halfway Hero
  (50%), Zone Wipe (clear a zone), Quartermaster (capture 5 items), Boss Defeated (100%).
  Locked trophies show as `???`.

---

## 9. Sound

Original **chiptune SFX synthesized in code** (Web Audio square/triangle waves) — no
copyrighted samples. Audio wakes on the first user tap (browser gesture rule). Global
mute, persisted.

| Sound | Fires on | Character |
|---|---|---|
| **Coin** | Quest done | Two-note rising blip |
| **Level up** | XP bar fills a level | 5-note rising fanfare |
| **Trophy** | Achievement unlocks | Sparkly triangle arpeggio |
| **Battle start** | Press PLAY / pick a player | Descending 4-note march (Space-Invaders-flavored) |
| **Select / Back / Blip** | Menu interactions | Short square blips |

There is a dedicated **Sound Test** screen (arcade-authentic) to audition each one.

---

## 10. Voice & tone

- **Arcade vocabulary:** QUEST, LOOT, PLAYER, HUD, STAGE CLEAR, GG, BOSS DEFEATED,
  INSERT COIN, COMBO BUILDING, BATTLE START.
- **Punchy, encouraging, all-caps for chrome.** Real content (task names) stays natural.
- **Always forward:** copy points at the next action and celebrates the last win. No guilt,
  no backlog anxiety.

---

## 11. Principles (do / don't)

**Do**
- Encode color by meaning (player, fate, reward) and keep it consistent.
- Keep pixel-font strings short and uppercase.
- Reward every completion immediately (sound + XP + visible bar movement).
- Square corners, 2px borders, hard shadows, scanlines — everywhere.

**Don't**
- No gradients, glow, blur, or soft shadows (the blocky bar is the only "gradient").
- No rounded corners.
- Don't bury the next action; one clear primary per screen.
- Don't use copyrighted game audio/sprites — synthesize or draw original 8-bit assets.

---

## 12. Tech notes (for implementers)

- React + TypeScript + Vite + Tailwind v4; state in `localStorage`; no backend.
- Design tokens + component classes live in `src/index.css`; semantic color maps in
  `src/theme.ts`; game rules in `src/game.ts`; audio in `src/sound.ts`.
- 3D garage view uses react-three-fiber (lazy-loaded). The 2D/3D map is currently a
  lighter "console" inside the dark frame — a future pass could darken it to full neon.
