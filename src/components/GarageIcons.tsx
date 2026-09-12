import type { ReactNode } from 'react'

export type GarageIconName = 'home' | 'missions' | 'crate' | 'garage' | 'more' | 'floor' | 'shelf' | 'pickup' | 'crew' | 'board' | 'trophy' | 'sound' | 'measure' | 'placement'

const ink = '#294b3c'
const cream = '#f7edcf'
const wood = '#dcae73'
const gold = '#e9c866'
const sage = '#a8c2a0'
const blue = '#a9c9ca'

const drawings: Record<GarageIconName, ReactNode> = {
  home: <>
    <path d="M10 22v18h28V22L24 10Z" fill={cream} />
    <path d="m5 23 17-16a3 3 0 0 1 4 0l17 16-4 4L24 13 9 27Z" fill={sage} />
    <path d="M20 40V29a4 4 0 0 1 8 0v11" fill={wood} />
    <path d="M12 29h4v6h-4Z" fill={blue} />
    <path d="M7 41h34" />
    <circle cx="25" cy="34" r="1" fill={ink} stroke="none" />
  </>,
  missions: <>
    <path d="M6 16h8l3-6h13l3 6h7a3 3 0 0 1 3 3v19a3 3 0 0 1-3 3H8a4 4 0 0 1-4-4V19a3 3 0 0 1 2-3Z" fill={sage} />
    <circle cx="23" cy="28" r="9" fill={cream} />
    <circle cx="23" cy="28" r="5" fill={blue} />
    <path d="M10 21h2" />
    <circle cx="37" cy="12" r="8" fill={gold} />
    <path d="m33.5 12 2.5 2.5 4.5-5" />
  </>,
  crate: <>
    <path d="M7 15 12 8h24l5 7v23a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3Z" fill={wood} />
    <path d="M7 15h34M12 8l3 7M36 8l-3 7" fill={cream} />
    <path d="M8 24h32M8 33h32" stroke="#956c49" />
    <path d="M7 15h6v26h-3a3 3 0 0 1-3-3ZM35 15h6v23a3 3 0 0 1-3 3h-3Z" fill={cream} />
    <circle cx="20" cy="27" r="1.8" fill={ink} stroke="none" />
    <circle cx="29" cy="27" r="1.8" fill={ink} stroke="none" />
    <path d="M21 32q3.5 4 7 0" />
    <path d="M10 19v1M38 19v1M10 36v1M38 36v1" strokeWidth="1.8" />
  </>,
  placement: <>
    <path d="M9 17h23l-2 22H11Z" fill={sage}/><path d="M7 13h27v5H7ZM16 13V9h9v4" fill={gold}/>
    <path d="M16 22v11m8-11v11"/><circle cx="13" cy="41" r="2" fill={ink}/><circle cx="28" cy="41" r="2" fill={ink}/>
    <path d="M33 28h11m-4-4 4 4-4 4"/>
  </>,
  measure: <>
    <path d="m8 33 25-25 9 9-25 25Z" fill={gold} />
    <path d="m29 12 5 5m-10 0 3 3m-8 2 5 5m-10 0 3 3" />
    <circle cx="16" cy="34" r="1.5" fill={ink} stroke="none" />
  </>,
  garage: <>
    <path d="M7 19 24 7l17 12v22H7Z" fill={sage} />
    <path d="m4 20 20-15 20 15" />
    <path d="M12 20h24v21H12Z" fill={cream} />
    <path d="M13 25h22M13 29h22" stroke="#829579" strokeWidth="1.8" />
    <path d="m17 32 2-4h10l2 4 3 2v6H14v-6Z" fill={blue} />
    <path d="M18 32h12" />
    <path d="M17 40v2M31 40v2" strokeWidth="3" />
    <path d="M18 36h1M29 36h1" stroke={cream} strokeWidth="2.6" />
  </>,
  more: <>
    <path d="M17 15v-4a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v4" fill="none" strokeWidth="3" />
    <rect x="5" y="15" width="38" height="26" rx="5" fill={wood} />
    <path d="M5 21v5a38 38 0 0 0 38 0v-5" fill={sage} />
    <rect x="20" y="24" width="8" height="8" rx="2" fill={cream} />
    <path d="M11 36h6" stroke="#956c49" />
  </>,
  floor: <>
    <path d="M7 34h34l4 9H3Z" fill={cream} />
    <path d="m16 34-2 9M32 34l2 9M5 39h38" stroke="#b6b59b" strokeWidth="1.6" />
    <path d="m32 6-12 23" stroke={ink} strokeWidth="6" />
    <path d="m32 6-12 23" stroke={wood} strokeWidth="2" />
    <path d="m17 24 11 5-2 4-13-6Z" fill={sage} />
    <path d="m13 27 13 6-3 8-17-8Z" fill={gold} />
    <path d="m14 31-3 4m8-2-3 4m8-2-3 4" stroke="#a78644" strokeWidth="1.6" />
    <path d="M39 15v6m-3-3h6" stroke={ink} />
  </>,
  shelf: <>
    <path d="M7 7v35M41 7v35" strokeWidth="3.2" />
    <rect x="11" y="9" width="12" height="12" rx="2" fill={wood} />
    <path d="M15 13h4" />
    <path d="M28 9h8v12h-8Z" fill={blue} />
    <path d="M28 12h8" stroke="#658f91" strokeWidth="1.6" />
    <path d="M6 22h36" strokeWidth="3" />
    <rect x="11" y="29" width="10" height="11" rx="2" fill={sage} />
    <rect x="25" y="27" width="12" height="13" rx="2" fill={gold} />
    <path d="M29 31h4" />
    <path d="M6 41h36" strokeWidth="3" />
  </>,
  pickup: <>
    <path d="M12 19v-7a5 5 0 0 1 10 0v7M27 19v-7a5 5 0 0 1 10 0v7" fill="none" strokeWidth="3" />
    <path d="M8 18q16-6 32 0l2 19a4 4 0 0 1-4 5H10a4 4 0 0 1-4-5Z" fill={gold} />
    <ellipse cx="24" cy="18" rx="16" ry="4.5" fill="#b9a355" />
    <path d="m12 22 2 15m22-15-2 15" stroke="#b08c3b" strokeWidth="1.8" />
    <path d="M19 29h10v7H19Z" fill={cream} strokeWidth="1.8" />
  </>,
  crew: <>
    <circle cx="11" cy="19" r="5" fill={wood} />
    <circle cx="37" cy="19" r="5" fill={wood} />
    <path d="M3 39v-8a8 8 0 0 1 16 0v8Z" fill={blue} />
    <path d="M29 39v-8a8 8 0 0 1 16 0v8Z" fill={sage} />
    <circle cx="24" cy="13" r="7" fill={cream} />
    <path d="M13 42v-9a11 11 0 0 1 22 0v9Z" fill={gold} />
    <path d="M19 42v-7m10 7v-7" strokeWidth="1.8" />
  </>,
  board: <>
    <rect x="9" y="8" width="30" height="35" rx="4" fill={wood} />
    <rect x="13" y="12" width="22" height="27" rx="2" fill={cream} strokeWidth="1.8" />
    <path d="M18 8a6 6 0 0 1 12 0v5H18Z" fill={sage} />
    <path d="m17 23 2 2 4-4M26 23h5m-14 9 2 2 4-4M26 32h5" />
  </>,
  trophy: <>
    <path d="M13 10H6v6a10 10 0 0 0 12 10m17-16h7v6a10 10 0 0 1-12 10" fill={cream} />
    <path d="M13 7h22v12a11 11 0 0 1-22 0Z" fill={gold} />
    <path d="M24 30v7" strokeWidth="4" />
    <path d="M17 37h14l3 5H14Z" fill={wood} />
    <path d="m24 12 2 4 4.5.6-3.3 3.2.8 4.5-4-2.1-4 2.1.8-4.5-3.3-3.2L22 16Z" fill={cream} strokeWidth="1.6" />
  </>,
  sound: <>
    <path d="M7 18h9L28 8v32L16 30H7a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" fill={sage} />
    <path d="M16 18v12" />
    <path d="M34 17a10 10 0 0 1 0 14m5-20a18 18 0 0 1 0 26" fill="none" strokeWidth="2.5" />
  </>,
}

/** Decorative illustrations; the surrounding button or link supplies its name. */
export function GarageIcon({ name, className }: { name: GarageIconName; className?: string }) {
  return <svg className={className} width="48" height="48" viewBox="0 0 48 48" aria-hidden="true" focusable="false" fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{drawings[name]}</svg>
}
