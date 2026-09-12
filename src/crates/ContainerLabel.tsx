import { useMemo } from 'react'
import qrcode from 'qrcode-generator'
import { crateLabelUrl } from './labelLinks'
import './labels.css'

type LabelProps = { code: string; name?: string; location?: string; owner?: string }

/** The QR contains a container URL only; generation never sends data to a service. */
export function qrMatrixForLabel(code: string) {
  const payload = crateLabelUrl(code)
  if (payload === null) return null
  const qr = qrcode(0, 'M')
  qr.addData(payload)
  qr.make()
  const count = qr.getModuleCount()
  return { payload, modules: Array.from({ length: count }, (_, row) => Array.from({ length: count }, (_, column) => qr.isDark(row, column))) }
}

function darkModulePath(modules: boolean[][]) {
  const paths: string[] = []
  modules.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      if (!row[x]) { x++; continue }
      const start = x
      while (x < row.length && row[x]) x++
      const width = x - start
      // Four white modules surround every edge, including the quiet corners.
      paths.push(`M${start + 4} ${y + 4}h${width}v1h-${width}z`)
    }
  })
  return paths.join('')
}

export function ContainerLabel({ code, name, location, owner }: LabelProps) {
  const qr = useMemo(() => qrMatrixForLabel(code), [code])
  const path = useMemo(() => qr ? darkModulePath(qr.modules) : '', [qr])
  const size = qr ? qr.modules.length + 8 : 0
  const length = code.length > 22 ? 'long' : code.length > 12 ? 'medium' : 'short'

  return <section className="container-label" aria-label={`Container label ${code}`}>
    <div className="container-label-main">
      <span className="container-label-kicker">GARAGE RESET · PERMANENT ID</span>
      <strong className={`container-label-code ${length}`}>{code}</strong>
      <dl className="container-label-fields">
        <div><dt>Description</dt><dd className="container-label-description" title={name}>{name?.trim() || '\u00a0'}</dd></div>
        <div><dt>Home</dt><dd title={location}>{location?.trim() || '\u00a0'}</dd></div>
        <div><dt>Owner</dt><dd title={owner}>{owner?.trim() || '\u00a0'}</dd></div>
      </dl>
    </div>
    <div className="container-label-scan">
      {qr ? <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Scan to open container ${code}`} shapeRendering="crispEdges">
        <rect width={size} height={size} fill="#fff" />
        <path d={path} fill="#000" />
      </svg> : <p className="container-label-invalid">Enter a valid ID to create its QR.</p>}
      {qr && <span>SCAN TO OPEN</span>}
      <small>Keep this ID.<br />Update the contents.</small>
    </div>
  </section>
}
