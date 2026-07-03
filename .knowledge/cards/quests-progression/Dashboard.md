---
type: card
module: quests-progression
file: src/screens/Dashboard.tsx
complexity: high
lines: 203
last_analyzed: 2026-07-03
migration:
  global_refs: []
  session_keys_read: ["garage-reset-v1 (via useStore)"]
  session_keys_written: ["garage-reset-v1 (resetAll)"]
  db_tables_touched: ["garage-reset-v1"]
  side_effects: [plays sound, resetAll]
  singleton_pattern: false
  extractable: true
  extraction_notes: Presentational aggregator; renders from derived game.ts values.
---

# src/screens/Dashboard.tsx — the HUD

The home screen (HUD tab). A read-mostly dashboard that composes nearly every derived value
in the app.

## Reads
`tasks`, `items`, `streak`, `bonusXp`, `weekDone`, `combo`, `resetAll` from the store; and
`nextTasks`, `progress`, `xp`, `level`, `leaderboard`, `achievements`, `rankTitle`,
`dailyMission`, `todayKey`, `MISSION_BONUS`, `WEEKLY_GOAL`, `allCleared`, `flameTier` from
game/lib.

## Sections (top → bottom)
- Header with mute toggle (`sound.toggle()`) + streak flame (`flameTier`)
- Combo banner (only when `combo >= 2`)
- XP / level bar + rank title
- Daily mission panel (yellow until cleared; shows `+MISSION_BONUS`)
- Weekly goal bar (`weekDone`/`WEEKLY_GOAL`)
- **PLAY** button → Snowball (swaps to **FINAL STANDINGS** when `allCleared`)
- Leaderboard (top 3)
- Next quests (via `nextTasks`, rendered as `TaskCard`s)
- Trophies grid (7 achievements; locked show `???`)
- Footer: **SOUND TEST** link and confirm-guarded **RESET GAME** (`resetAll`)

## Notes
- Local `useState` only tracks the `muted` label mirror; all game state is derived.
- Dynamic tagline keyed to progress percent ("BOSS DEFEATED!" at 100%, "PRESS PLAY" at 0%…).
- The highest-fan-in screen — a good place to see how the derived-progression design pays off
  (no stored aggregates to keep in sync).
