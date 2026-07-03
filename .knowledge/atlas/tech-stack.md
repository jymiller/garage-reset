---
type: atlas
title: Tech Stack
last_analyzed: 2026-07-03
---

# Tech Stack

A modern, minimal, all-client front-end stack. No server, no database, no build-time data.

## Runtime

| Layer | Choice | Version | Notes |
|-------|--------|---------|-------|
| Language | TypeScript | ~5.6.3 | `strict` mode, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `isolatedModules` |
| UI library | React | ^19.0.0 | Function components + hooks; one Context for state |
| DOM renderer | react-dom | ^19.0.0 | `createRoot`, `StrictMode` |
| 3D | three | ^0.185.0 | WebGL renderer for the garage view |
| 3D/React bridge | @react-three/fiber | ^9.6.1 | React reconciler for three.js |
| 3D helpers | @react-three/drei | ^10.7.7 | `OrbitControls`, `Html`, `Edges` |
| Styling | Tailwind CSS | ^4.0.0 | v4 (Vite plugin, no PostCSS config) + a hand-written `index.css` theme |

## Build & tooling

| Tool | Version | Role |
|------|---------|------|
| Vite | ^6.0.0 | Dev server + bundler |
| @vitejs/plugin-react | ^4.3.4 | JSX/TSX + Fast Refresh |
| @tailwindcss/vite | ^4.0.0 | Tailwind v4 integration |
| @types/{react,react-dom,three} | matched | Type definitions |

**`vite.config.ts`** dedupes and pre-bundles `react`, `react-dom`, `three`,
`@react-three/fiber`, `@react-three/drei` (`resolve.dedupe` + `optimizeDeps.include`) so the
heavy 3D deps resolve to single copies and split cleanly.

## Scripts (`package.json`)

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `vite` | Local dev server (HMR) |
| `build` | `tsc --noEmit && vite build` | Type-check, then production bundle |
| `preview` | `vite preview` | Serve the built bundle locally |
| `typecheck` | `tsc --noEmit` | Types only, no output |

## Fonts & assets

- **Fonts** are loaded from Google Fonts in `index.html`: **Press Start 2P** (8-bit chip
  font, for chrome/labels) and **VT323** (monospace, for body/quest text).
- **Art** is static PNG pixel art under `public/art/{trophies,players,zones,ui,sprites,incoming}/`,
  served at `/art/...`. Only `ui/title.png` is currently wired in; the rest is a spec (see
  [`docs/ASSETS.md`](../../docs/ASSETS.md)) awaiting generated assets.
- **Audio** has **no asset files** — every SFX is synthesized from Web Audio oscillators at
  runtime ([`src/sound.ts`](../../src/sound.ts)).

## What's notably absent

- No test runner, no tests (0% coverage).
- No linter config committed (TypeScript strict is the only static gate).
- No router, no state library (Redux/Zustand) — a single React Context suffices.
- No backend, API client, auth, or database.
- No CI config in-repo.

## Deployment target

A static bundle (`vite build` → `dist/`). Any static host works; there is nothing to run
server-side. `dist/` is git-ignored. The 3D garage is lazy-loaded (`React.lazy` +
`Suspense`) so three.js only downloads when the MAP tab is opened.

## Currency of the stack

Everything is current as of mid-2026: React 19, Vite 6, Tailwind v4, TypeScript 5.6. Nothing
is deprecated or on a legacy track.
