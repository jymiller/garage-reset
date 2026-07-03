#!/usr/bin/env node
/**
 * Garage Reset — Knowledge Base server.
 *
 * Serves this .knowledge/ directory, rendering .md files as styled dark-theme HTML with a
 * sticky nav and a link-type legend. Zero dependencies (Node built-ins only).
 *
 *   node .knowledge/_server.js         # http://localhost:4600
 *   PORT=8080 node .knowledge/_server.js
 *
 * The output dir name is auto-detected from this file's parent, so a copy renamed
 * .knowledge-pilot/ still works.
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const KB_NAME = path.basename(ROOT)
const PORT = process.env.PORT || 4600

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Inline: `code`, **bold**, [text](href). Operates on already-escaped text. */
function inline(s) {
  return s
    .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
}

/** A small, dependency-free Markdown → HTML renderer covering what these docs use. */
function renderMarkdown(md) {
  // strip YAML frontmatter into a collapsible block
  let front = ''
  const fm = md.match(/^---\n([\s\S]*?)\n---\n?/)
  if (fm) {
    front =
      `<details class="fm"><summary>frontmatter</summary><pre>${esc(fm[1])}</pre></details>`
    md = md.slice(fm[0].length)
  }

  const lines = md.split('\n')
  const out = []
  let i = 0
  const flushParaBuffer = (buf) => {
    if (buf.length) out.push(`<p>${inline(esc(buf.join(' ')))}</p>`)
    buf.length = 0
  }
  const para = []

  while (i < lines.length) {
    const line = lines[i]

    // fenced code block
    if (/^```/.test(line)) {
      flushParaBuffer(para)
      const body = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++])
      i++
      out.push(`<pre><code>${esc(body.join('\n'))}</code></pre>`)
      continue
    }

    // heading
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      flushParaBuffer(para)
      const lvl = h[1].length
      out.push(`<h${lvl}>${inline(esc(h[2]))}</h${lvl}>`)
      i++
      continue
    }

    // horizontal rule
    if (/^---\s*$/.test(line)) {
      flushParaBuffer(para)
      out.push('<hr>')
      i++
      continue
    }

    // table (header row + separator)
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      flushParaBuffer(para)
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      const head = cells(line)
      i += 2
      const rows = []
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(cells(lines[i]))
        i++
      }
      let t = '<table><thead><tr>'
      head.forEach((c) => (t += `<th>${inline(esc(c))}</th>`))
      t += '</tr></thead><tbody>'
      rows.forEach((r) => {
        t += '<tr>'
        r.forEach((c) => (t += `<td>${inline(esc(c))}</td>`))
        t += '</tr>'
      })
      t += '</tbody></table>'
      out.push(t)
      continue
    }

    // blockquote
    if (/^>\s?/.test(line)) {
      flushParaBuffer(para)
      const body = []
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ''))
      out.push(`<blockquote>${inline(esc(body.join(' ')))}</blockquote>`)
      continue
    }

    // lists (unordered or ordered) — flat
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      flushParaBuffer(para)
      const ordered = /^\s*\d+\.\s+/.test(line)
      const items = []
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''))
        i++
      }
      const tag = ordered ? 'ol' : 'ul'
      out.push(`<${tag}>${items.map((it) => `<li>${inline(esc(it))}</li>`).join('')}</${tag}>`)
      continue
    }

    // blank line ends a paragraph
    if (/^\s*$/.test(line)) {
      flushParaBuffer(para)
      i++
      continue
    }

    para.push(line)
    i++
  }
  flushParaBuffer(para)
  return front + out.join('\n')
}

function page(title, bodyHtml, relBack) {
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} — ${esc(KB_NAME)}</title>
<style>
  :root{--bg:#0f1117;--surface:#1a1d27;--surface2:#232733;--border:#2e3345;--text:#e1e4ed;
    --text-dim:#8b90a0;--accent:#6c8aff;--accent2:#a78bfa;--green:#4ade80;--orange:#fb923c;--red:#f87171;--cyan:#22d3ee;}
  *{box-sizing:border-box;} body{margin:0;background:var(--bg);color:var(--text);
    font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;line-height:1.65;}
  a{color:var(--accent);text-decoration:none;} a:hover{text-decoration:underline;}
  .nav{background:var(--surface);border-bottom:1px solid var(--border);padding:.7rem 1.5rem;
    display:flex;gap:.75rem;align-items:center;position:sticky;top:0;z-index:10;flex-wrap:wrap;}
  .nav a{padding:.3rem .8rem;border-radius:6px;background:var(--surface2);color:var(--text-dim);font-size:.85rem;}
  .nav a:hover{background:var(--accent);color:#fff;text-decoration:none;}
  .nav .path{color:var(--text-dim);font-size:.82rem;font-family:'JetBrains Mono',monospace;margin-left:auto;}
  main{max-width:900px;margin:0 auto;padding:2rem 1.5rem 4rem;}
  h1,h2,h3,h4{line-height:1.25;} h1{font-size:1.9rem;margin:.5rem 0 1rem;}
  h2{font-size:1.4rem;margin:2.2rem 0 .8rem;border-bottom:1px solid var(--border);padding-bottom:.3rem;}
  h3{font-size:1.1rem;margin:1.6rem 0 .6rem;} p{margin:.8rem 0;}
  code{font-family:'JetBrains Mono',monospace;background:var(--surface2);padding:1px 6px;border-radius:4px;font-size:.85em;}
  pre{background:#0c0e14;border:1px solid var(--border);border-radius:8px;padding:1rem 1.2rem;overflow-x:auto;
    font-size:.83rem;line-height:1.6;color:#c5cad6;} pre code{background:none;padding:0;}
  table{border-collapse:collapse;width:100%;margin:1rem 0;font-size:.9rem;display:block;overflow-x:auto;}
  th,td{border:1px solid var(--border);padding:.5rem .8rem;text-align:left;vertical-align:top;}
  th{background:var(--surface2);color:var(--text);} tr:nth-child(even) td{background:rgba(255,255,255,.015);}
  blockquote{border-left:3px solid var(--accent);margin:1rem 0;padding:.4rem 1rem;color:var(--text-dim);
    background:rgba(108,138,255,.05);border-radius:0 6px 6px 0;}
  hr{border:none;border-top:1px solid var(--border);margin:2rem 0;}
  ul,ol{padding-left:1.4rem;} li{margin:.3rem 0;}
  details.fm{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:.4rem .9rem;margin:0 0 1.5rem;}
  details.fm summary{cursor:pointer;color:var(--text-dim);font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;}
  details.fm pre{margin:.6rem 0 .2rem;background:#0c0e14;font-size:.78rem;}
  .legend{display:flex;gap:1.5rem;flex-wrap:wrap;font-size:.82rem;color:var(--text-dim);
    margin-top:2.5rem;border-top:1px solid var(--border);padding-top:1rem;}
  .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;}
  a[href$=".md"]::after{content:'';display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--green);margin-left:5px;vertical-align:middle;}
  a[href$=".html"]::after{content:'';display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--accent);margin-left:5px;vertical-align:middle;}
  .nav a::after,a[href^="http"]::after,.legend a::after{content:none !important;}
</style></head><body>
<nav class="nav">
  <a href="${relBack}index.html">Portal</a>
  <a href="${relBack}index.md">Agent index</a>
  <a href="javascript:history.back()">Back</a>
  <span class="path">${esc(KB_NAME)}</span>
</nav>
<main>
${bodyHtml}
<div class="legend">
  <span><span class="dot" style="background:var(--accent)"></span>Blue dot = HTML page</span>
  <span><span class="dot" style="background:var(--green)"></span>Green dot = Markdown doc</span>
</div>
</main></body></html>`
}

function relBackFor(reqPath) {
  // reqPath like /maps/quests-progression/index.md → depth 2 → ../../
  const depth = reqPath.replace(/^\/+/, '').split('/').length - 1
  return depth > 0 ? '../'.repeat(depth) : './'
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0])
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html'

  // resolve against ROOT, guard against traversal
  let filePath = path.normalize(path.join(ROOT, urlPath))
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden')
    return
  }

  // fallback: allow bare paths that omit an existing extension already handled by normalize
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(page('404', `<h1>404</h1><p>Not found: <code>${esc(urlPath)}</code></p>`, relBackFor(urlPath)))
    return
  }

  const ext = path.extname(filePath).toLowerCase()

  if (ext === '.md') {
    const md = fs.readFileSync(filePath, 'utf8')
    const title = (md.match(/^#\s+(.*)$/m) || [, path.basename(filePath)])[1]
    const html = page(title, renderMarkdown(md), relBackFor(urlPath))
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
    return
  }

  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
  fs.createReadStream(filePath).pipe(res)
})

server.listen(PORT, () => {
  console.log(`\n  ${KB_NAME} knowledge base`)
  console.log(`  → http://localhost:${PORT}/  (portal)`)
  console.log(`  → http://localhost:${PORT}/index.md  (agent index)\n`)
})
