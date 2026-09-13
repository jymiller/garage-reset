# Shared Garage workspace runtimes

The selected production configuration targets [Garage Reset on Vercel](https://garage-reset.vercel.app). It uses family-link access and private Blob storage through `api/garage.js`, `server/access.mjs` and `server/vercel.mjs`. See [VERCEL-DEPLOYMENT.md](../VERCEL-DEPLOYMENT.md) for server environment settings, private evidence, conditional ETag writes and production release checks. Pushing `main` triggers the connected Vercel deployment workflow; these runtime files alone do not verify a deployed release. No Render deployment was created.

`server/app.mjs` remains the local development server and standalone Node API. Two devices share data only when they open the same shared runtime; a laptop-only loopback address is not a phone URL.

## Local development

Run `npm run dev` after installing dependencies. It starts `node server/app.mjs --dev`, listens only on `127.0.0.1:5173`, and uses Vite middleware with React and Tailwind. Set `PORT` to select another local port. `GARAGE_PASSWORD` is optional for this loopback preview. The frontend skips family access only for explicit loopback hosts. Vite live updates use the same loopback HTTP port; there is no separate WebSocket listener or fixed port 24678.

The local server stores workspace and photos under `GARAGE_DATA_DIR`, defaulting to `.garage-data/` in the app root. Keep the directory out of version control. It must not be inside `public/` or `dist/`; the server rejects those locations. Original evidence can be supplied privately under `GARAGE_DATA_DIR/evidence/`, preserving subdirectories. Development can fall back to `public/evidence/` when private evidence is absent, but those files must remain untracked and outside release artifacts. `scripts/private-build.mjs` provides the postbuild guard against private evidence in static deployment assets.

## Hosted family access and storage

On Vercel, `GET /api/access` returns `{ authorized: true | false }`. A private family bookmark supplies a fragment key that the browser exchanges with `POST /api/access` as `{ key }`. A valid exchange sets a signed, one-year `HttpOnly; Secure; SameSite=Lax` device cookie. The client confirms the cookie and clears the fragment to `#home` before opening the app. Keys and storage tokens stay in server environment settings, not source or local storage.

Workspace, uploaded photos and original evidence require that cookie. The 22 reference files were transferred privately to Blob storage; the public repository and build do not contain the images. The runtime reads the authoritative workspace without CDN caching and saves conditionally against its ETag. A create race or stale conditional write returns the latest revision as a conflict. Separate function instances do not rely on a shared local file or in-memory lock.

Visible hosted workspace screens refresh every 30 seconds. Loopback uses four seconds; hidden tabs skip background reads, and unmounted screens stop their refresh loops. Rotating `GARAGE_ACCESS_KEY` and deploying the new environment invalidates cookies signed with the previous key; distribute the replacement family bookmark privately.

## API contract and size limits

- `GET /api/workspace` returns `{ revision, data }`. A new store starts at revision `0` with the empty version-1 workspace.
- `PUT /api/workspace` accepts that envelope as JSON, up to 2 MiB. A matching revision is saved and incremented. A stale revision receives `409` with the current envelope; it never replaces the saved workspace. Invalid schema receives `400`. Vercel also uses an authoritative Blob ETag for the conditional write. The client preserves edits for conflict review.
- `POST /api/photos` accepts a raw JPEG, PNG or WebP body. The Vercel adapter limit is 3.5 MiB; the standalone/local Node limit remains 8 MiB. Image signatures and content types are checked. Success returns `{ url, src, filename }` with a generated protected `/api/photos/…` URL. These checks identify the file format, not its contents.
- New clients use `POST /api/photos` with `X-Garage-Photo-Operation: begin | chunk | finish` to preserve selected originals up to **50 MiB** in **2 MiB parts**. Each action requires the same authorization and origin checks as other photo writes. Finalization verifies SHA-256 and size, then stores immutable original bytes and metadata alongside a separate JPEG preview. Repeated matching parts/finalization are idempotent. Completed temporary parts are removed.
- JPEG previews are capped at **3,500,000 bytes**. Unsupported browser decoding produces a labeled placeholder, while valid HEIC/HEIF original bytes are retained. These placeholders are not sent to image analysis. Legacy raw one-shot uploads remain supported.
- New photo URLs support authenticated `?original=1` download and `?metadata=1` inspection. Original bytes, filename, file-modification time, and digest are preserved; embedded metadata stays in the original. Older uploads have no recoverable original unless supplied separately.
- `GET /api/photos/:filename` and `HEAD` return an uploaded image after authorization. `/evidence/<relative path>` serves original reference images through the protected runtime. There is no photo deletion endpoint.

The schema matches `src/crates/model.ts`; the backend additionally rejects unknown object properties. Notes and labels must be trimmed. Optional `missions`, `spatialItems`, and `rewards` preserve compatibility with older workspaces that omit them. Missions record user-confirmed sessions; spatial records associate a photo rectangle with a named box and optional crate link. Neither changes occupied contents-volume progress automatically.

Photo files are separate from workspace revisions: a successful upload followed by a canceled edit can leave an unused private image. Invalid stored state is preserved instead of silently reset. Exporting workspace JSON does not include image bytes; back up private workspace, photo and evidence objects separately.

## Standalone Node runtime

`npm run build` followed by `node server/app.mjs` serves `dist/` under Node 22 or later. Without `--dev`, this alternate runtime requires `GARAGE_PASSWORD` and applies Basic Auth to its routes. It stores data in private `GARAGE_DATA_DIR` and serializes writes within one process; it must not share its JSON store across replicas.

This Basic Auth server is separate from the selected family-link hosted runtime. It does not implement `/api/access`, so hosting it on a non-loopback address alone does not satisfy the current frontend gate. Use the configured Vercel adapter for hosted family access. `render.yaml` remains an unused alternate configuration.

## Verification

- `npm run test:server` checks the Node server with temporary directories and ephemeral loopback ports, including revision conflicts, restart persistence, request limits, schema compatibility, private images and the Vite development path.
- `npm run test:access` checks family-cookie access plus client link parsing, authorization failures and photo encoding limits.
- `npm run test:vercel` checks the hosted adapter, authoritative storage and conditional-write races without establishing production deployment health.
- `npm run build` checks TypeScript, the production bundle and the private-evidence postbuild guard.

`createGarageServer(options)` is an async factory returning an unbound Node HTTP server. Tests or integrations should bind it explicitly and call `await server.closeGarage()` to close its listener and development middleware.

The optional rewards ledger assigns photo missions to named players and stores manual approval/payment timestamps. Both storage adapters enforce the same reward contract: unique attribution, fixed $100 caps, no duplicate payments, immutable approved mission evidence and records, and no removal by an older client. After the first approval the cash rate and budget mode are fixed. Stale writes still return 409; an otherwise current write that removes or rewrites protected rewards returns 400. Everyone with family access shares the same controls; there is no separate parent role or money transfer. See REWARDS.md.
