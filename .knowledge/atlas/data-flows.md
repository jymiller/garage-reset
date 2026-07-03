---
type: atlas
title: Data Flows
last_analyzed: 2026-07-03
data_flows:
  - name: Complete a quest
    path: [src/screens/Snowball.tsx, src/store.tsx, src/game.ts, src/sound.ts, localStorage]
    description: Marking a task done awards weighted XP and rolls streak/combo/mission/weekly state, firing celebration SFX, then persists.
  - name: Tick a sub-step
    path: [src/components/TaskCard.tsx, src/store.tsx, src/game.ts, src/sound.ts]
    description: Checking sub-steps drives a quest through in-progress and only completes it (full XP) when all steps clear.
  - name: Capture loot
    path: [src/screens/Capture.tsx, src/store.tsx, localStorage]
    description: Add an item, then cycle its keep/move/donate/trash fate.
  - name: Finish the game
    path: [src/App.tsx, src/screens/FinalStandings.tsx, src/store.tsx]
    description: Reaching 100% auto-routes to final standings; a rematch resets all state.
---

# Data Flows

Traced end-to-end execution paths for the app's key interactions. Because there is no
server, every "flow" is: **user event → store action → pure recompute → setState → persist
effect → re-render**.

---

## 1. Complete a quest (the core loop)

Trigger: player taps **DONE +XP** on the current quest in `Snowball` (or the master
checkbox on a `TaskCard`).

```
Snowball.tsx  onClick ──► setTaskStatus(top.id, 'done')                  [store.tsx]
                              │
   ── BEFORE setState (reads the render-time `state` snapshot) ──────────
      playCompletionSfx(state, id):                                       [store.tsx]
         project tasks with this one 'done'
         level(before) vs level(after)   ← game.ts: xp(), level()
         rankIndex(before) vs (after)     ← game.ts
         achievements(before) vs (after)  ← game.ts
         claimsMission? weeklyDoneAfter? comboActive?
         └─► sound.done(weight)                       [sound.ts]  coin, longer w/ weight
             + sound.combo(n) if combo≥2
             + sound.rankUp()/levelUp()/mission()/unlock() (first that applies)
             + sound.weeklyClear() if weekDone hits 5
                              │
   ── setState (pure functional updater) ─────────────────────────────────
      if (justCompleting) applyCompletion(s, id):                         [store.tsx]
         tasks: mark id 'done'
         streak: bumpStreak(streak, lastDay)          ← +1 if lastDay was yesterday
         bonusXp += mission bonus (25) + combo bonus ((combo-1)×25)
         missionDay, weekTag, weekDone, combo, lastDoneAt updated
                              │
                              ▼
   useEffect([state]) ──► localStorage.setItem('garage-reset-v1', …)      [persist]
                              │
                              ▼
   Dashboard / People / leaderboard re-render from derived game.ts values
```

Key point: **XP is not stored** — it's recomputed by `xp(tasks) + bonusXp` on every render.
Completing a task changes `status`; the leaderboard, level, and rank fall out of that.
See [ADR-0002](../decisions/0002-derived-progression.md).

---

## 2. Tick a sub-step (gated completion)

Trigger: player taps a sub-step checkbox on a `TaskCard` for a quest that has `steps`.

```
TaskCard.tsx  onClick ──► toggleStep(id, index)                          [store.tsx]
                              │
   compute next stepDone array (toggle index)
   allDone = next.every(Boolean)
   completing = allDone && task.status !== 'done'
                              │
   ┌── completing? ───────────────────────────────────────────────┐
   │  YES → playCompletionSfx(state, id)   (same as flow 1)        │
   │  NO  → next[index] ? sound.subTick() : (silent on uncheck)    │
   └───────────────────────────────────────────────────────────────┘
                              │
   setState:                                                            [store.tsx]
      if all steps done & not already done → applyCompletion(withSteps, id)   → full weighted XP
      else status = someDone ? 'in-progress' : 'not-started'  (no XP)
                              │
                              ▼
   persist + re-render (segmented mini-bar fills; on final tick, the coin + combo fire)
```

The checklist **drives and gates** completion; there is no per-step XP — the whole weighted
value lands once on the final tick. Unchecking a step on a done quest reopens it and the
derived XP disappears. See [maps/quests-progression](../maps/quests-progression/index.md).

---

## 3. Capture loot

Trigger: player fills the form on the `Capture` (LOOT) screen and presses Enter / ADD.

```
Capture.tsx (local useState: name, owner, zone, decision)
   ADD ──► addItem({ name, owner, zone, decision })                      [store.tsx]
              └─ items: [{ id: crypto.randomUUID(), createdAt: Date.now(), …input }, ...items]
                              │
                              ▼  (persist effect writes the blob)
   Inventory list re-renders (newest first)

   Later, tap an item's fate badge:
   Capture.tsx ──► setItemDecision(id, nextDecision)                     [store.tsx]
              └─ items.map(i => i.id===id ? {…i, decision} : i)
   Tap trash icon:
   Capture.tsx ──► deleteItem(id)                                        [store.tsx]
```

Items are pure CRUD; nothing about capture feeds the XP/leaderboard system (though captured
items also surface as "LOOT" counts in `Zones`). The **Quartermaster** achievement unlocks at
5 captured items — the only progression tie-in.

---

## 4. Finish the game → Final Standings → Rematch

Trigger: the last quest is completed, making `allCleared(tasks)` true.

```
completion (flow 1) sets a task 'done'
                              │
App.tsx useEffect([started, done, shownResults])                        [App.tsx]
   done = allCleared(tasks)         ← game.ts
   if (started && done && !shownResults) → setTab('results'); setShownResults(true)
                              │
                              ▼
FinalStandings.tsx mounts:                                              [FinalStandings.tsx]
   useEffect: sound.winner();  setTimeout(sound.loser, 1700)
   render leaderboard(tasks) — champion in yellow, others dim
                              │
   REMATCH ──► resetAll()                                               [store.tsx]
              └─ state ← fresh seed (tasks reseeded, all counters zeroed)
              └─ onNavigate('dashboard')
```

`resetAll()` is the only full-reset path; `Dashboard` also exposes a confirm-guarded
**RESET GAME**. Because state is reseeded from `seedTasks()`, sub-step definitions and
weights come back fresh.

---

## Cross-cutting: audio unlock

Every flow that plays sound depends on the AudioContext already being unlocked by a user
gesture. That happens once at startup (`main.tsx` `pointerdown` → `sound.prime()`) and again
on the TitleScreen tap. After that, `sound.*` calls are synchronous oscillator bursts. See
[bootstrap-chain.md](bootstrap-chain.md) and [ADR-0006](../decisions/0006-web-audio-chiptune.md).
