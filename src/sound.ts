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
      // iOS: declare playback audio so the hardware silent switch doesn't mute us.
      try {
        const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
        if (session) session.type = 'playback'
      } catch {
        /* not supported on this OS */
      }
      // iOS unlock: play a 1-sample silent buffer inside the user gesture.
      try {
        const buf = ctx.createBuffer(1, 1, 22050)
        const src = ctx.createBufferSource()
        src.buffer = buf
        src.connect(ctx.destination)
        src.start(0)
      } catch {
        /* ignore */
      }
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
  /** Unlock/prime the audio engine on the first user gesture (iOS). */
  prime() {
    ac()
  },
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

  /** Task completed — coin pickup; escalates with quest weight (1-3). */
  done(weight = 1) {
    if (muted) return
    const notes = [988, 1319, 1568, 1976].slice(0, Math.max(2, Math.min(4, weight + 1)))
    seq(notes, 0.06, 0.11, 'square', 0.16)
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
  /** Champion / everyone-finished winner fanfare. */
  winner() {
    if (muted) return
    seq([523, 659, 784, 1047, 1319, 1047, 1319, 1568], 0.11, 0.2, 'square', 0.18)
  },
  /** Gentle last-place "wah-wah" — comedic, not harsh. */
  loser() {
    if (muted) return
    seq([349, 311, 277, 220], 0.18, 0.34, 'triangle', 0.16)
  },
  /** Combo step — rising ratchet, pitches up with the multiplier. */
  combo(step: number) {
    if (muted) return
    const base = 440 + step * 130
    seq([base, base * 1.5], 0.05, 0.08, 'square', 0.13)
  },
  /** Sub-step ticked — a small, quieter coin pip. */
  subTick() {
    if (muted) return
    blip(1175, 0.045, 'square', 0.09)
  },
  /** Promotion to a new rank — grander than a level-up. */
  rankUp() {
    if (muted) return
    seq([392, 494, 587, 784, 988, 1319, 1568], 0.08, 0.16, 'square', 0.18)
  },
  /** Daily mission cleared. */
  mission() {
    if (muted) return
    seq([784, 1047, 784, 1319], 0.07, 0.11, 'square', 0.15)
  },
  /** Comeback / free-credit welcome. */
  comeback() {
    if (muted) return
    seq([659, 880, 1319], 0.09, 0.15, 'square', 0.16)
  },
  /** Weekly team goal cleared. */
  weeklyClear() {
    if (muted) return
    seq([523, 784, 1047, 1568, 1047, 1568], 0.09, 0.16, 'square', 0.18)
  },
}
