# Vercel deployment

The production configuration targets [Garage Reset](https://garage-reset.vercel.app). Pushing `main` triggers the connected Vercel build and deployment workflow. This guide describes the configuration and runtime; production checks still determine whether a particular release is verified.

`vercel.json` builds the Vite app into `dist/` and routes the shared API and protected images through `api/garage.js`, backed by `server/vercel.mjs`. The postbuild guard, `scripts/private-build.mjs`, keeps private evidence out of the static deployment. Personal photos must remain outside tracked public source and static build assets. `render.yaml` is an unused alternate-host configuration; no Render deployment or service was created.

## Family access

Each family device opens a privately shared bookmark whose fragment contains `access=<family key>`. The ordinary production address shows **Open your family link** until that browser is authorized. It also accepts a pasted full family link or key.

1. The browser reads the fragment locally and exchanges only `{ key }` with same-origin `POST /api/access`. Pasted links never cause requests to another host.
2. A valid exchange sets the signed `__Host-garage-family` cookie with `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, and a one-year maximum age.
3. The browser confirms authorization with `GET /api/access`, replaces the fragment with `#layout`, and opens the app. An authorized browser can then use the ordinary address and normal screen links.

Set `GARAGE_ACCESS_KEY` only in Vercel's server environment settings. The key is not kept in local storage or placed in the public bundle. Keep the actual family bookmark out of source, documentation and deployment output. Workspace and image requests require the signed cookie; the access screen and application code can load before authorization.

To rotate access, replace `GARAGE_ACCESS_KEY` and deploy the updated environment. Once the new runtime is active, previous device cookies and old family bookmarks no longer authorize access. Share a new bookmark privately.

## Private storage

Connect a private Vercel Blob store and provide `BLOB_READ_WRITE_TOKEN` to the server runtime. Neither the token nor private evidence belongs in Git, `public/`, or `dist/`.

| Data | Private Blob path | Browser route |
| --- | --- | --- |
| Shared workspace and revision | `garage/workspace.json` | `/api/workspace` |
| New crate and mission photos | `garage/photos/<generated filename>` | `/api/photos/<filename>` |
| Original reference evidence | `garage/evidence/<relative path>` | `/evidence/<relative path>` |

The reference set was uploaded privately as **22 files**: the 17 September 9 photographs and five earlier reference images, including the Polycam floor plan. Relative paths are preserved for existing photo links. These uploads are separate from public source and build artifacts; a Git push does not upload the evidence again.

Workspace reads bypass the Blob CDN cache. Before saving, the server reads the authoritative workspace and its ETag, validates the incoming revision, and conditionally writes against that exact ETag. The initial write is create-only. A competing write returns `409` with the latest workspace instead of overwriting it. Separate function instances therefore do not rely on a local file or process-level lock.

Workspace, uploaded photos and reference evidence are separate objects. An in-app draft export downloads workspace JSON, not image bytes. Back up all three kinds of private objects for a complete copy. Existing browser-only planner/game data and local layout corrections are not automatically migrated into the shared workspace.

## Saving and upload limits

Visible, mounted workspace screens refresh shared data every **30 seconds** on hosted addresses. Loopback development uses **four seconds**. Hidden tabs skip background reads; leaving the workspace screen stops its refresh loop. Offline drafts remain on the device when browser storage is available, while photo uploads need a connection.

The browser converts accepted photos to JPEG and progressively reduces quality or dimensions until the encoded body fits within **3,500,000 bytes**. If it cannot fit, it requests a smaller or cropped image before upload.

| Limit | Vercel adapter | Local Node server |
| --- | --- | --- |
| Workspace JSON | 2 MiB | 2 MiB |
| Raw photo upload | 3.5 MiB | 8 MiB |
| Browser-generated JPEG | 3,500,000 bytes | 3,500,000 bytes |

Bounding-box dimensions, crate contents-volume estimates and photo-mission points keep their separate meanings after deployment. Hosting does not introduce measured geometry or object detection.

## Release checks

Run `npm run build`, `npm run test:access`, `npm run test:vercel`, and the relevant feature suites before pushing. The build includes the private-evidence postbuild guard. Tests exercise the runtime; they do not establish that a selected production deployment is healthy.

After Vercel reports the deployment ready, check the production address in a fresh browser: the family-link screen should appear, and unauthorized workspace/evidence requests should be denied. Open the private bookmark without publishing it, confirm the fragment becomes `#layout`, and check a protected reference photo. Check persistence and conflicting edits from two authorized devices, then confirm a return visit works with the device cookie.

For loopback development and the standalone Node API, see [server/README.md](server/README.md).
