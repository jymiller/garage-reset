import { useState } from 'react'
import type { Tab } from '../App'
import { useStore } from '../store'
import { sound } from '../sound'
import { nextTasks, progress } from '../lib'
import {
  xp,
  level,
  leaderboard,
  achievements,
  rankTitle,
  dailyMission,
  todayKey,
  MISSION_BONUS,
  WEEKLY_GOAL,
  allCleared,
} from '../game'
import { arcPerson } from '../theme'
import { ProgressBar } from '../components/ProgressBar'
import { TaskCard } from '../components/TaskCard'

const RANK = ['1ST', '2ND', '3RD']

function tagline(pct: number) {
  if (pct >= 100) return 'BOSS DEFEATED!'
  if (pct === 0) return 'INSERT COIN — PRESS PLAY'
  if (pct < 34) return 'COMBO BUILDING...'
  if (pct < 67) return 'NICE RUN. KEEP GOING'
  return 'FINAL STRETCH!'
}

export function Dashboard({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { tasks, items, streak, bonusXp, weekDone, resetAll } = useStore()
  const [muted, setMuted] = useState(sound.isMuted())
  const weekPct = Math.min(100, Math.round((weekDone / WEEKLY_GOAL) * 100))
  const cleared = allCleared(tasks)
  const overall = progress(tasks)
  const totalXp = xp(tasks) + bonusXp
  const lv = level(totalXp)
  const board = leaderboard(tasks)
  const trophies = achievements(tasks, items, streak)
  const upNext = nextTasks(tasks, 3)
  const mission = dailyMission(tasks, todayKey())
  const missionDone = mission?.status === 'done'

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-pixel text-base leading-relaxed text-[#2bd14a]">GARAGE RESET</h1>
          <p className="arc-vt mt-1 text-[#ffd23f]">{tagline(overall.pct)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <button
            onClick={() => {
              sound.toggle()
              setMuted(sound.isMuted())
            }}
            className="font-pixel text-[7px]"
            style={{ color: muted ? '#5a5a70' : '#2bd14a' }}
            aria-label="Toggle sound"
          >
            {muted ? 'SFX OFF' : 'SFX ON'}
          </button>
          <div className="arc-panel arc-panel-yellow px-2 py-1.5 text-center">
            <p className="font-pixel text-[7px] text-[#ffd23f]">STREAK</p>
            <p className="arc-vt mt-0.5 text-2xl leading-none text-[#ffd23f]">{streak}</p>
          </div>
        </div>
      </header>

      <section className="arc-panel p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="font-pixel text-sm text-[#2bd14a]">LV.{lv.lvl}</p>
            <p className="font-pixel mt-1.5 text-[8px] text-[#6cf08a]">{rankTitle(lv.lvl)}</p>
          </div>
          <p className="arc-vt text-xl text-[#ffd23f]">{totalXp} XP</p>
        </div>
        <ProgressBar pct={lv.pct} className="mt-3" />
        <p className="arc-vt mt-2 text-[#8a8aa6]">
          {overall.done}/{overall.total} CLEARED · {overall.pct}% · {lv.per - lv.into} XP TO LV.{lv.lvl + 1}
        </p>
      </section>

      {mission && (
        <section className={`arc-panel p-3 ${missionDone ? 'arc-panel-dim' : 'arc-panel-yellow'}`}>
          <div className="flex items-center justify-between">
            <p className="font-pixel text-[9px] text-[#ffd23f]">TODAY'S MISSION</p>
            <span className="font-pixel text-[8px] text-[#ffd23f]">+{MISSION_BONUS} XP</span>
          </div>
          <p className="arc-vt mt-1.5 text-[#e8e8f5]">
            {missionDone ? 'MISSION CLEAR ✓' : mission.title}
          </p>
        </section>
      )}

      <section className="arc-panel arc-panel-dim p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-pixel text-[8px] text-[#36e0e0]">WEEKLY GOAL</p>
          <p className="arc-vt text-[#36e0e0]">
            {weekDone >= WEEKLY_GOAL ? 'CLEARED ★' : `${weekDone}/${WEEKLY_GOAL} QUESTS`}
          </p>
        </div>
        <ProgressBar pct={weekPct} color="#36e0e0" />
      </section>

      {cleared ? (
        <button onClick={() => onNavigate('results')} className="arc-btn w-full py-4 text-base">
          ★ FINAL STANDINGS
        </button>
      ) : (
        <button
          onClick={() => {
            sound.start()
            onNavigate('snowball')
          }}
          className="arc-btn w-full py-4 text-base"
        >
          ▶ PLAY
        </button>
      )}

      <section>
        <h2 className="font-pixel mb-2 text-[10px] text-[#ff3ca6]">LEADERBOARD</h2>
        <div className="arc-panel space-y-3 p-4">
          {board.map((p, i) => (
            <button key={p.id} onClick={() => onNavigate('people')} className="block w-full text-left">
              <div className="mb-1 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="font-pixel text-[8px] text-[#8a8aa6]">{RANK[i]}</span>
                  <span className="arc-vt text-lg" style={{ color: arcPerson[p.id] }}>
                    {p.name.toUpperCase()}
                  </span>
                </span>
                <span className="arc-vt text-lg text-[#ffd23f]">{p.points} XP</span>
              </div>
              <ProgressBar pct={p.total ? Math.round((p.done / p.total) * 100) : 0} color={arcPerson[p.id]} />
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-pixel mb-2 text-[10px] text-[#36e0e0]">NEXT QUESTS</h2>
        {upNext.length === 0 ? (
          <p className="arc-panel arc-vt p-4 text-center text-[#6cf08a]">ALL QUESTS CLEAR. GG.</p>
        ) : (
          <div className="space-y-2">
            {upNext.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-pixel mb-2 text-[10px] text-[#ffd23f]">TROPHIES</h2>
        <div className="grid grid-cols-2 gap-2">
          {trophies.map((a) => (
            <div
              key={a.id}
              className={`arc-panel p-2.5 ${a.unlocked ? 'arc-panel-yellow' : 'arc-panel-dim opacity-60'}`}
            >
              <p className={`font-pixel text-[8px] ${a.unlocked ? 'text-[#ffd23f]' : 'text-[#5a5a70]'}`}>
                {a.unlocked ? a.name.toUpperCase() : '???'}
              </p>
              <p className="arc-vt mt-1 text-[#8a8aa6]">{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="flex items-center justify-center gap-5 pt-1">
        <button onClick={() => onNavigate('sound')} className="font-pixel text-[8px] text-[#36e0e0]">
          ♪ SOUND TEST
        </button>
        <button
          onClick={() => {
            if (confirm('RESET ALL PROGRESS?')) resetAll()
          }}
          className="font-pixel text-[8px] text-[#4f4f66]"
        >
          RESET GAME
        </button>
      </footer>
    </div>
  )
}
