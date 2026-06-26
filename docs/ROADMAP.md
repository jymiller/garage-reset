# Garage Reset — Gamification Roadmap

Backlog of gamification ideas (from a multi-lens design panel) plus build status.
Goal: the app finishes too fast — add depth (sub-steps), stakes (the horse race),
and ritual, all 8-bit, mobile, local-first (no backend), and family-friendly.

Status: ✅ built & live · ▶ next · ⬜ backlog

---

## ✅ Shipped

### Wave 1 — Quick Spice + sounds
- **Rank Ladder** — named ranks ROOKIE → GREASE MONKEY → SHELF JOCKEY → CREW CHIEF →
  MASTER ORGANIZER over `level()`; grander rank-up fanfare on crossing a band.
- **Daily Mission** — one quest/day featured (deterministic by date) for **+25 XP** and a
  "MISSION GET" jingle; HUD shows it + MISSION CLEAR state.
- **New SFX** — winner, loser (soft wah-wah), combo, sub-tick, rank-up, mission, comeback,
  weekly-clear; all auditable on the **Sound Test** screen.

### Wave 2 — The Horse Race
- **Quest Weight** — each quest is a 1–3 effort tier (yellow pips) worth 50/100/150 XP;
  `xp()` sums weights so the leaderboard reflects real effort.
- **Final Standings** — at 100%, auto-roll to a results screen: champion + winner fanfare,
  gentle "GOOD GAME — REMATCH?" for last, STAGE CLEAR stamps, REMATCH (reset) button.
- **Weekly Goal** — shared "CLEAR 5 QUESTS THIS WEEK" team bar with its own fanfare.
- Completion **coin escalates** with quest weight.

### Wave 3a — Combo + Flame
- **Combo Meter** — back-to-back completions within ~3 min chain x2 → x3 for +25 bonus XP
  per step, a flashing "COMBO xN!" banner, and an escalating ratchet sound.
- **Flame Stakes** — the streak is now a growing campfire: SPARK → FLAME → BONFIRE →
  INFERNO (flame icon + escalating color) on the HUD.

---

## ▶ Next

### Wave 3b — Pit-Stop Sub-Steps  (effort L, impact high) — John's original ask
Break a heavy quest into 2–4 checkable sub-steps (e.g. *Clear the white table* → wipe down /
sort papers / box electronics / haul trash), each a quieter coin pip filling a segmented
mini-bar; the quest only counts done when all steps clear. One quest becomes several
satisfying ticks. Fits the segmented `.arc-bar` and the "surface the next small action" ethos.
Planned simplest model: the checklist drives/gates completion; full weighted XP awarded when
the quest completes (no per-step XP rework). SFX: SUB-TICK (already added).

---

## ⬜ Backlog (ranked-ish)

### Comeback Coin  (S, med)
If away 2+ days, the next return shows a warm "WELCOME BACK — FREE CREDIT" screen granting
one-time **double XP on the next quest** — a no-guilt re-onboarding from the existing
`lastDay`. SFX: comeback chime (already added); double-XP quest plays the coin twice.

### Game Over / Session Summary  (M, med)
After a quest is done and the player goes idle, an arcade "GAME OVER" card tallies XP this
session, quests cleared, current flame, and "NEXT MISSION: <quest>". Closes each visit on a
forward-pointing beat. Compute the delta from a session-start XP snapshot. SFX: gentle
descending "nice run" coda + "INSERT COIN" blip.

### Streak Shield  (M, med)
Earn 1 shield per full active week; a missed day auto-spends a shield instead of zeroing the
streak. Gentle, never-toxic. Store a shield count, consume it in `bumpStreak`. Pairs with
Flame Stakes. SFX: "SHIELD SAVED!" metallic clink on reopen.

### Token Vault — cosmetic unlocks  (L, med)
Level-ups and cleared zones drop coins that buy cosmetic packs in a LOOT/SHOP screen: alt
title-screen variants (NEON NIGHT, SUNSET DRIVE-IN), neon palette swaps, CRT-vs-clean toggle.
Pure CSS-token swaps (index.css/theme.ts), no pay-to-win. Gives XP a long-tail sink. SFX:
"cha-CHING" purchase + theme-apply whoosh.

### Prestige — New Game+  (M, med)
At 100% (Boss Defeated), offer a PRESTIGE RESET back to fresh quests but stamp a permanent
gold ★ PRESTIGE badge on the title screen and bump a "Cleanups Cleared" counter. (REMATCH
already resets; prestige adds the badge + counter.) A garage re-clutters, so this is the
natural seasonal loop. SFX: rare dramatic 8-note "NEW GAME+" sting.

---

## Packages (how to bundle)
- **Quick Spice** *(S)* — Rank Ladder + Daily Mission + Comeback Coin. *(2/3 built)*
- **The Horse Race** *(M)* — Final Standings + Quest Weight + Weekly Goal. *(built)*
- **Make It Last** *(L)* — Sub-Steps + Combo Meter + Flame Stakes. *(2/3 built; sub-steps next)*
- **Full Arcade Cabinet** *(XL roadmap)* — all of the above + Game Over + Streak Shield +
  Token Vault + Prestige, sequenced.

## Design constraints (apply to every idea)
8-bit arcade aesthetic (see `DESIGN.md`); mobile-first; local-first (localStorage, no
backend); family-friendly (gentle losing, only-ever-bonus mechanics); core ethos = momentum,
never overwhelm, always surface the next small action. New art per `docs/ASSETS.md`.
