import { useEffect } from 'react'
import type { Tab } from '../App'
import { useStore } from '../store'
import { leaderboard } from '../game'
import { arcPerson } from '../theme'
import { sound } from '../sound'

export function FinalStandings({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { tasks, resetAll } = useStore()
  const board = leaderboard(tasks)

  useEffect(() => {
    sound.winner()
    const t = setTimeout(() => sound.loser(), 1700)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="space-y-6">
      <header className="pt-4 text-center">
        <h1 className="font-pixel text-base leading-relaxed text-[#ffd23f]">GARAGE CLEARED!</h1>
        <p className="arc-vt mt-2 text-[#8a8aa6]">FINAL STANDINGS</p>
      </header>

      <div className="space-y-3">
        {board.map((p, i) => {
          const champ = i === 0
          const last = i === board.length - 1
          const place = champ ? '★ CHAMPION' : i === 1 ? '2ND' : '3RD'
          return (
            <div
              key={p.id}
              className={`arc-panel p-4 ${champ ? 'arc-panel-yellow' : 'arc-panel-dim'}`}
              style={champ ? { borderColor: '#ffd23f' } : undefined}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="font-pixel text-[10px]" style={{ color: champ ? '#ffd23f' : '#8a8aa6' }}>
                    {place}
                  </span>
                  <span className="arc-vt text-2xl" style={{ color: arcPerson[p.id] }}>
                    {p.name.toUpperCase()}
                  </span>
                </span>
                <span className="arc-vt text-xl text-[#ffd23f]">{p.points} XP</span>
              </div>
              <p className="arc-vt mt-1 text-[#6cf08a]">
                {champ ? 'STAGE CLEAR · WINNER' : last ? 'GOOD GAME — REMATCH?' : 'STAGE CLEAR'}
              </p>
            </div>
          )
        })}
      </div>

      <button
        onClick={() => {
          if (confirm('REMATCH? This resets the garage for a fresh cleanup.')) {
            sound.start()
            resetAll()
            onNavigate('dashboard')
          }
        }}
        className="arc-btn w-full py-4 text-base"
      >
        ▶ REMATCH
      </button>
      <button onClick={() => onNavigate('dashboard')} className="font-pixel block w-full text-center text-[8px] text-[#8a8aa6]">
        ◀ BACK TO HUD
      </button>
    </div>
  )
}
