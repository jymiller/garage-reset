import { useState } from 'react'
import type { Tab } from '../App'
import { sound } from '../sound'

const SFX: { label: string; sub: string; play: () => void; color: string }[] = [
  { label: 'COIN', sub: 'task done · +50 XP', play: () => sound.done(), color: '#ffd23f' },
  { label: 'SUB-TICK', sub: 'sub-step done', play: () => sound.subTick(), color: '#ffd23f' },
  { label: 'COMBO', sub: 'back-to-back x3', play: () => sound.combo(3), color: '#ffd23f' },
  { label: 'LEVEL UP', sub: 'fill the XP bar', play: () => sound.levelUp(), color: '#2bd14a' },
  { label: 'RANK UP', sub: 'new rank title', play: () => sound.rankUp(), color: '#2bd14a' },
  { label: 'TROPHY', sub: 'achievement unlock', play: () => sound.unlock(), color: '#36e0e0' },
  { label: 'MISSION', sub: 'daily mission clear', play: () => sound.mission(), color: '#36e0e0' },
  { label: 'WINNER', sub: 'champion!', play: () => sound.winner(), color: '#ffd23f' },
  { label: 'LOSER', sub: 'good game · rematch', play: () => sound.loser(), color: '#ff3ca6' },
  { label: 'COMEBACK', sub: 'welcome back', play: () => sound.comeback(), color: '#36e0e0' },
  { label: 'BATTLE START', sub: 'press PLAY', play: () => sound.start(), color: '#ff3ca6' },
  { label: 'SELECT', sub: 'pick a player', play: () => sound.select(), color: '#2bd14a' },
  { label: 'BACK', sub: 'cancel', play: () => sound.back(), color: '#8a8aa6' },
  { label: 'BLIP', sub: 'menu tap', play: () => sound.tap(), color: '#8a8aa6' },
]

export function SoundTest({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const [muted, setMuted] = useState(sound.isMuted())

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <button
          onClick={() => {
            sound.back()
            onNavigate('dashboard')
          }}
          className="font-pixel text-[8px] text-[#8a8aa6]"
        >
          ◀ HUD
        </button>
        <h1 className="font-pixel text-sm text-[#2bd14a]">SOUND TEST</h1>
        <span className="w-10" />
      </header>

      <p className="arc-vt text-[#8a8aa6]">TAP A SOUND TO HEAR IT. THE FIRST TAP TURNS AUDIO ON.</p>

      <button
        onClick={() => {
          sound.toggle()
          setMuted(sound.isMuted())
        }}
        className="arc-panel w-full p-3.5 text-center"
        style={{ borderColor: muted ? '#5a5a70' : '#2bd14a' }}
      >
        <span className="font-pixel text-[10px]" style={{ color: muted ? '#8a8aa6' : '#2bd14a' }}>
          {muted ? 'SFX: OFF — TAP TO ENABLE' : 'SFX: ON'}
        </span>
      </button>

      <div className="space-y-2.5">
        {SFX.map((s) => (
          <button
            key={s.label}
            onClick={s.play}
            disabled={muted}
            className="arc-panel flex w-full items-center justify-between p-4 text-left transition active:translate-x-1 disabled:opacity-40"
            style={{ borderColor: s.color }}
          >
            <span className="arc-vt text-2xl" style={{ color: s.color }}>
              ▶ {s.label}
            </span>
            <span className="arc-vt text-[#8a8aa6]">{s.sub.toUpperCase()}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
