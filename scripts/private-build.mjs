import { rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Vite copies public/ wholesale in a local build. Private evidence is served by
// the authenticated API, including when a local build is deployed manually.
for (const relative of ['../dist/evidence', '../dist/art/ui/enid image.png']) {
  await rm(fileURLToPath(new URL(relative, import.meta.url)), { recursive: true, force: true })
}
console.log('Private source media excluded from the static build.')
