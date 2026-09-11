import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { get, put, BlobNotFoundError } from '@vercel/blob'

const directory = process.argv[2]
if (!directory) throw new Error('Provide the private evidence directory. Files are uploaded to the connected private Blob store, never to Git.')
const root = path.resolve(directory)
const types = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
let uploaded = 0, unchanged = 0
async function visit(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) { await visit(file); continue }
    if (!entry.isFile()) continue
    const contentType = types[path.extname(entry.name).toLowerCase()]
    if (!contentType) continue
    const relative = path.relative(root, file).split(path.sep).join('/')
    const pathname = `garage/evidence/${relative}`
    const bytes = await fs.readFile(file)
    let existing
    try { existing = await get(pathname, { access: 'private', useCache: false }) }
    catch (error) { if (!(error instanceof BlobNotFoundError)) throw error }
    if (existing) {
      const stored = Buffer.from(await new Response(existing.stream).arrayBuffer())
      if (hash(stored) !== hash(bytes)) throw new Error(`Existing evidence differs: ${relative}. No overwrite performed.`)
      unchanged++; continue
    }
    await put(pathname, bytes, { access: 'private', contentType, addRandomSuffix: false, allowOverwrite: false })
    uploaded++
    console.log(`Private evidence uploaded: ${relative}`)
  }
}
await visit(root)
console.log(JSON.stringify({ uploaded, unchanged }))
