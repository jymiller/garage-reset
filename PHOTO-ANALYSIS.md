# Photo analysis

New photos keep their immediate shared save. On Vercel, each successful image upload also creates a private analysis record and sends a durable queue message. The worker reads the protected image from Blob, calls Vercel AI Gateway with runtime OIDC authentication, validates structured results, and persists the findings separately from the family workspace. Closing the phone does not stop the worker.

Results appear after capture and on saved photo cards. Expand **What’s here** for visible objects, readable labels, relative placement, uncertainty and questions for a better photo. **Download analysis JSON** exports the persisted record. Missing or failed analysis has a retry action. Older photos can be submitted through the same protected retry endpoint.

Analysis is evidence for review. It does not add inventory items, change item counts, award points, infer contents of closed crates, measure dimensions or volume, move objects in the 3D model, or confirm that cars fit. Model guesses are separate from human-entered notes and measurements. The source image hash, analysis version, model, timestamps and status stay with each record.

## Storage and endpoints

- Private Blob records: `garage/analysis/<photo-filename>.json`.
- Protected read: `GET /api/analysis?photo=<photo-filename>`.
- Protected enqueue/retry: `POST /api/analysis/retry` with `{ "photo": "<photo-filename>" }`.
- Private Vercel Queue consumer: `api/photo-analysis-worker.js` for topic `garage-photo-analysis`.
- Local Node uses separate analysis files under the configured garage data directory.

Only validated internal photo filenames are accepted. The provider receives server-read image bytes; no family bookmark, access cookie, or public private-image URL is sent. Blob conditional writes protect worker claims and reject stale completions. Failures retain the image and a retryable record when storage is available. Repeated deliveries do not duplicate a completed analysis.

Production uses `@vercel/oidc` at request time. No developer machine API key or copied development OIDC token is deployed. Vercel AI Gateway access and available credits must be active; provider and queue failures surface as analysis failures while the original photo remains saved.

Milbird is a separate optional archive integration. Creating its `garage-reset` collection does not automatically copy app photos or their metadata. A matching account import rule is required before uploads; the family app's private analysis remains available independently.
