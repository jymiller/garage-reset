---
type: atlas
title: Conventions
last_analyzed: 2026-07-03
---

# Conventions

Inferred from the code and from [`DESIGN.md`](../../DESIGN.md) / [`docs/ASSETS.md`](../../docs/ASSETS.md).

## Code organization

- **Flat, feature-light layout.** `src/screens/*` = one file per full-screen view;
  `src/components/*` = shared presentational pieces; `src/garage/*` = the 3D silo;
  everything else (`store`, `game`, `lib`, `data`, `types`, `theme`, `sound`) is a
  single-purpose module at `src/` root.
- **Pure logic is separated from React.** Game math (`game.ts`), task selection/progress
  (`lib.ts`), and seed/reference data (`data.ts`) import no React and touch no storage.
  This is the app's most important structural convention.
- **One state store.** All mutable game state flows through the `useStore()` context in
  `store.tsx`. Screens never touch `localStorage` directly.
- **Types live in one file.** `src/types.ts` owns the domain vocabulary (`PersonId`,
  `ZoneId`, `TaskStatus`, `Decision`, `Task`, `Item`, `Person`, `Zone`). Import from there.

## Naming

- **Files:** `PascalCase.tsx` for components/screens, `camelCase.ts` for logic modules.
- **IDs:** seeded tasks are `seed-<n>`; items use `crypto.randomUUID()`; zones/people use
  kebab-case string-literal unions (`griffin-workshop`, not an enum).
- **Design tokens:** arcade colors are `--arc-*` CSS vars and `arc*` TS maps (`arcPerson`,
  `arcDecision`); SVG/floor-plan colors are `zoneColors`. Tailwind-class maps are
  `statusMeta` / `decisionMeta` / `personMeta`.

## Styling

- **8-bit arcade, dark only.** See [DESIGN.md](../../DESIGN.md). Two fonts: `Press Start 2P`
  (`.font-pixel`, UPPERCASE chrome, 7–13px) and `VT323` (`.arc-vt`, body/quests, 18px+).
- **Component classes, not utilities, for the arcade look:** `.arc-panel`, `.arc-btn`,
  `.arc-bar`, `.arc-input` in `index.css` carry the borders/shadows; Tailwind utilities
  handle layout and one-off spacing/color.
- **Color encodes meaning.** Player: John=cyan, Griffin=yellow, LJ=pink. Fate: keep=green,
  move=cyan, donate=pink, trash=red. Reward/XP=yellow. Don't decorate with arbitrary color.
- **Motion is snappy and physical.** Buttons press inward (~50ms); bars fill in discrete
  `steps()`; only the floor-plan objects use smooth easing.

## Voice & UX ethos

- **Arcade vocabulary in chrome** (QUEST, LOOT, PLAYER, HUD, STAGE CLEAR, GG, BOSS
  DEFEATED); **real content stays natural case** (quest titles, item names).
- **Only-ever-bonus, gentle-losing.** Mechanics only add (missions, combos, streaks give
  bonus XP); last place gets a comedic "wah-wah," never a punishment. This is a hard product
  constraint — see [ADR-0004](../decisions/0004-family-friendly-only-bonus.md).
- **Always surface the next small action** and celebrate wins; never show a guilt-inducing
  backlog.

## State & side-effects

- **Actions compute SFX outside `setState`, state inside.** Because React `StrictMode`
  double-invokes updaters, sound is fired from the closure snapshot before `setState`, while
  the state transition happens in a pure functional updater. Follow this pattern when adding
  completion-like actions (see `setTaskStatus` / `toggleStep` in `store.tsx`).
- **Persistence is automatic.** A single `useEffect([state])` writes the whole blob; you
  never call `setItem` yourself.
- **New mechanics extend, they don't migrate.** Add a pure function in `game.ts` and, if
  needed, a scalar counter to `State` with a `?? default` in `initialState()`.

## Git / workflow

- Feature work lands as "waves" (`Gamify wave 1…3b`) with a running plan in
  [`docs/ROADMAP.md`](../../docs/ROADMAP.md).
- Privacy-sensitive source photos (`garage-photos/`, `garage-scan/`, `garage-video/`) are
  git-ignored and never imported by the app; the spatial model was hand-derived from them.
