/**
 * Tiny chiptune SFX engine — original 8-bit-style sounds synthesized with the
 * Web Audio API (no copyrighted samples). Square/triangle oscillators with short
 * envelopes, in the spirit of classic arcade machines.
 */

let ctx: AudioContext | null = null
let muted = false
try {
  muted = localStorage.getItem('arcade-muted') === '1'
} catch {
  /* ignore */
}

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new Ctor()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function blip(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.14, delay = 0) {
  const c = ac()
  if (!c) return
  const t0 = c.currentTime + delay
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(vol, t0 + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g)
  g.connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

function seq(notes: number[], step: number, dur: number, type: OscillatorType, vol: number) {
  notes.forEach((f, i) => blip(f, dur, type, vol, i * step))
}

export const sound = {
  isMuted: () => muted,
  setMuted(m: boolean) {
    muted = m
    try {
      localStorage.setItem('arcade-muted', m ? '1' : '0')
    } catch {
      /* ignore */
    }
    if (!m) blip(880, 0.05) // little confirmation chirp
  },
  toggle() {
    this.setMuted(!muted)
  },

  /** Task completed — coin / power-up pickup. */
  done() {
    if (muted) return
    seq([988, 1319], 0.07, 0.12, 'square', 0.16)
  },
  /** Level up — rising fanfare. */
  levelUp() {
    if (muted) return
    seq([523, 659, 784, 1047, 1319], 0.08, 0.14, 'square', 0.18)
  },
  /** Achievement unlocked — sparkly chime. */
  unlock() {
    if (muted) return
    seq([784, 1047, 1568], 0.09, 0.16, 'triangle', 0.2)
  },
  /** Menu / nav tap. */
  tap() {
    if (muted) return
    blip(196, 0.04, 'square', 0.08)
  },
  /** Player / option select. */
  select() {
    if (muted) return
    seq([523, 784], 0.05, 0.08, 'square', 0.12)
  },
  /** Back / cancel. */
  back() {
    if (muted) return
    seq([392, 261], 0.05, 0.08, 'square', 0.1)
  },
  /** Battle start — Space-Invaders-style descending march. */
  start() {
    if (muted) return
    seq([196, 185, 175, 165], 0.1, 0.13, 'square', 0.16)
  },
}
