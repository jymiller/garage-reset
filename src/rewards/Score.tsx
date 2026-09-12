import { useEffect, useId, useRef, useState } from 'react'
import type { Tab } from '../App'
import type { CleanupMission, Workspace } from '../crates/model'
import { useWorkspace } from '../crates/useWorkspace'
import { GarageIcon } from '../components/GarageIcons'
import { ToolPage } from '../components/ToolPage'
import { addRewardPlayer, approveMission, assignMission, defaultRewards, markMissionPaid, rewardSummary, updateRewardSettings } from './model'
import type { RewardBook } from './model'
import './score.css'

const PLAYER_KEY = 'garage-reset-current-player-v1'
type Change = (transform: (data: Workspace) => Workspace, message: string) => boolean
const cash = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100)
const initialPlayer = () => { try { return localStorage.getItem(PLAYER_KEY) } catch { return null } }
const rememberPlayer = (id: string) => { try { localStorage.setItem(PLAYER_KEY, id) } catch { /* The picker still works without a local preference. */ } }
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0]).join('')
const statusText = { connecting: 'Connecting to your shared score…', shared: 'Score shared with the family', saving: 'Saving this reward change…', offline: 'Offline · showing this device’s draft', conflict: 'Another device saved changes', error: 'This save needs attention' }

export function Score({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const workspace = useWorkspace()
  const [previewBook] = useState(() => defaultRewards())
  const [selectedId, setSelectedId] = useState<string | null>(initialPlayer)
  const [message, setMessage] = useState<{ text: string; awaitingSave: boolean } | null>(null)
  const [backedUp, setBackedUp] = useState(false)
  const controls = useRef<HTMLDetailsElement>(null)
  const changePending = useRef(false)
  const book = workspace.data.rewards
  const summary = rewardSummary(workspace.data)
  const players = book?.players ?? previewBook.players
  const selected = players.find(player => player.id === selectedId) ?? players[0]
  const playerScore = summary.players.find(player => player.id === selected?.id)
  const plan = book ?? previewBook
  const sharedGoal = plan.budgetMode === 'shared'
  const progressCash = book ? sharedGoal ? summary.approvedCents : playerScore?.approvedCents ?? 0 : 0
  const remaining = Math.max(0, plan.goalCents - progressCash)
  const progress = Math.min(100, progressCash / plan.goalCents * 100)
  const rate = plan.goalCents / plan.missionsForGoal
  const finished = (workspace.data.missions ?? []).filter(mission => mission.phase === 'complete').slice().sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
  const entries = new Map(summary.entries.map(entry => [entry.missionId, entry]))
  const unassigned = finished.filter(mission => !entries.has(mission.id)).length
  const reviewCount = finished.filter(mission => entries.get(mission.id)?.approvedAt == null).length
  const canChange = workspace.status === 'shared' && !workspace.dirty && !workspace.conflict
  const needsAttention = workspace.status === 'offline' || workspace.status === 'error' || Boolean(workspace.error) || workspace.storageError

  useEffect(() => { if (!workspace.dirty) changePending.current = false }, [workspace.dirty])
  useEffect(() => { setBackedUp(false) }, [workspace.conflict])

  const change: Change = (transform, notice) => {
    if (!canChange || changePending.current) { setMessage({ text: 'Wait for the shared score to finish saving before making another change.', awaitingSave: false }); return false }
    if (transform(workspace.data) === workspace.data) { setMessage({ text: 'That change is not available. Check the player, mission, and reward plan. Player names must be unique.', awaitingSave: false }); return false }
    changePending.current = true
    let changed = false
    const accepted = workspace.update(current => {
      const next = transform(current)
      changed = next !== current
      return next
    })
    if (!accepted || !changed) {
      changePending.current = false
      setMessage({ text: 'The reward change was not accepted. Your existing records are still here.', awaitingSave: false })
      return false
    }
    setMessage({ text: notice, awaitingSave: true })
    return true
  }

  function openControls() {
    if (!controls.current) return
    controls.current.open = true
    controls.current.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }
  function selectPlayer(id: string) {
    setSelectedId(id)
    if (book?.players.some(player => player.id === id)) rememberPlayer(id)
  }
  function startMission() {
    if (book && selected) rememberPlayer(selected.id)
    onNavigate('play')
  }

  return <ToolPage title="Score" description="Finish photo missions. Build your points and rewards." icon="trophy">
    <div className="score-content">
      <div className={'score-sync ' + workspace.status} role="status"><span aria-hidden="true" />{workspace.storageError ? 'Device backup unavailable · export your draft' : workspace.dirty ? 'Reward draft · waiting for a shared save' : statusText[workspace.status]}</div>
      {needsAttention && <div className="score-alert" role="alert">
        <p>{workspace.error || (workspace.storageError ? 'This browser could not save a backup. Export your draft before leaving.' : 'Cash changes need a connection. Your score is showing the version on this device.')}</p>
        <div className="tool-row"><button className="tool-button secondary" onClick={workspace.downloadDraft}>Export backup</button>{!workspace.dirty && !workspace.conflict && !workspace.storageError && <button className="tool-button secondary" onClick={() => window.location.reload()}>Reload score</button>}</div>
      </div>}
      {workspace.conflict && <div className="score-alert">
        <h2>Keep your draft before reloading.</h2><p>Another device saved first. Export your draft, then load the shared score to review the latest approvals.</p>
        <div className="tool-row"><button className="tool-button secondary" onClick={() => { workspace.downloadDraft(); setBackedUp(true) }}>Export my draft</button><button className="tool-button secondary" disabled={!backedUp} onClick={() => { workspace.useSharedVersion(); setBackedUp(false); setMessage(null) }}>Load shared version</button></div>
      </div>}
      {workspace.dirty && <p className="score-draft-note" role="status">This reward change is not confirmed on the shared score yet. Approval and payment controls will unlock after it saves.</p>}

      <section className="score-players" aria-label="Choose a player">
        {players.map(player => {
          const totals = summary.players.find(value => value.id === player.id)
          return <button className={'score-player ' + (selected?.id === player.id ? 'selected' : '')} key={player.id} aria-pressed={selected?.id === player.id} onClick={() => selectPlayer(player.id)}>
            <span className="score-avatar" aria-hidden="true">{initials(player.name)}</span><span><strong>{player.name}</strong><small>{totals?.points ?? 0} points · {cash(totals?.approvedCents ?? 0)} approved</small></span><span className="score-player-check" aria-hidden="true">{selected?.id === player.id ? '✓' : ''}</span>
          </button>
        })}
      </section>

      <section className="score-hero" aria-labelledby="score-goal-title">
        <div className="score-hero-top"><span className="score-eyebrow">{book ? sharedGoal ? 'ONE SHARED CASH GOAL' : (selected?.name ?? 'Your') + '’S CASH GOAL' : 'YOUR REWARD PLAN · PREVIEW'}</span><span className="score-trophy"><GarageIcon name="trophy" /></span></div>
        <h2 id="score-goal-title">{book && remaining === 0 ? 'You reached the goal.' : 'Small wins add up.'}</h2>
        <div className="score-big-cash"><strong>{cash(progressCash)}</strong><span>/ {cash(plan.goalCents)}</span></div>
        <p className="score-hero-caption">{book ? 'Approved rewards, including anything already paid.' : 'A suggested goal. Save the reward plan below to activate it.'}</p>
        <div className="score-cash-track" role="progressbar" aria-label={sharedGoal ? 'Approved cash toward the shared goal' : 'Approved cash toward the selected player’s goal'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-valuetext={cash(progressCash) + ' approved out of ' + cash(plan.goalCents)}><span style={{ width: progress + '%' }} /></div>
        <div className="score-hero-progress"><span>{sharedGoal ? 'Shared pool: ' : ''}{cash(remaining)} left to approve</span><span>{plan.missionsForGoal} missions to {cash(plan.goalCents)}</span></div>
        <div className="score-hero-bottom"><p>{cash(rate)} per approved mission{sharedGoal ? ', within the shared cap.' : ', up to $100 per player.'}<br /><span>Every finished mission earns 100 points.</span></p><button className="score-start" onClick={book ? startMission : openControls}>{book ? 'Start a mission' : 'Set up rewards'} <span aria-hidden="true">↗</span></button></div>
      </section>

      <section className="score-stats" aria-label={(selected?.name ?? 'Player') + ' score breakdown'}>
        <div className="score-stat points"><span>Points</span><strong>{playerScore?.points ?? 0}<small>XP</small></strong><p>{playerScore?.completedCount ?? 0} finished {playerScore?.completedCount === 1 ? 'mission' : 'missions'}</p></div>
        <div className="score-stat pending"><span>Pending estimate</span><strong>{cash(playerScore?.potentialCents ?? 0)}</strong><p>Needs John’s review. Not owed yet.</p></div>
        <div className="score-stat approved"><span>Approved, not paid</span><strong>{cash(playerScore?.unpaidCents ?? 0)}</strong><p>Recorded for {selected?.name ?? 'this player'}.</p></div>
        <div className="score-stat paid"><span>Paid</span><strong>{cash(playerScore?.paidCents ?? 0)}</strong><p>Marked as paid outside this app.</p></div>
      </section>
      {book && sharedGoal && <p className="score-explainer">The {cash(plan.goalCents)} goal above is shared by everyone. These four cards show {selected?.name ?? 'the selected player'}’s part.</p>}
      <div className="score-next-step"><span className="score-next-icon"><GarageIcon name="missions" /></span><div><h2>Photo. Sort. Photo.</h2><p>Finish the before-and-after mission to earn 100 points. Cash waits for a review.</p></div>{book && <button className="tool-button secondary" onClick={startMission}>Choose a mission</button>}</div>
      {unassigned > 0 && <div className="score-unassigned"><p><strong>{unassigned} finished {unassigned === 1 ? 'mission needs' : 'missions need'} a player.</strong> John can match them to the right person below before they count here.</p><button className="tool-button secondary" onClick={openControls}>Review missions</button></div>}
      {message && <p className="score-message" role="status">{message.awaitingSave ? workspace.dirty ? message.text + ' Waiting for the shared save.' : message.text + ' Shared score updated.' : message.text}</p>}

      <details className="score-john" ref={controls}>
        <summary><span><strong>For John</strong><small>Plan, players, mission reviews, and payment records</small></span><span aria-hidden="true">＋</span></summary>
        <div className="score-john-content">
          <p className="score-control-note">Everyone with the family link can use these controls. This records approval/payment; it does not send money.</p>
          {!canChange && <p className="score-control-note">Connect to the shared score and finish any pending save before changing rewards.</p>}
          <RewardPlan key={(book ? 'saved' : 'new') + '-' + plan.missionsForGoal + '-' + plan.budgetMode} book={book} preview={previewBook} locked={summary.settingsLocked} canChange={canChange} onChange={change} />
          {book && <AddPlayer canChange={canChange} onChange={change} />}
          <section className="score-review-section" aria-labelledby="score-review-title">
            <div className="score-section-heading"><div><h2 id="score-review-title">Review finished missions</h2><p>{reviewCount} waiting for a name or approval</p></div></div>
            <p className="score-explainer">Check the before and after photos and who did the work. Approval fixes the player and reward for that mission. Points continue after the cash cap is reached. Pending estimates can change as missions are approved.</p>
            {!book ? <p className="score-review-empty">Save the reward plan first to assign players and review rewards.</p> : !finished.length ? <p className="score-review-empty">Finished photo missions will appear here. No cash has been approved or paid automatically.</p> : <div className="score-reviews">{finished.map(mission => <MissionReview key={mission.id} data={workspace.data} book={book} mission={mission} canChange={canChange} onChange={change} />)}</div>}
          </section>
        </div>
      </details>
    </div>
  </ToolPage>
}

function RewardPlan({ book, preview, locked, canChange, onChange }: { book?: RewardBook; preview: RewardBook; locked: boolean; canChange: boolean; onChange: Change }) {
  const id = useId()
  const [missionsForGoal, setMissionsForGoal] = useState<10 | 20>((book ?? preview).missionsForGoal)
  const [budgetMode, setBudgetMode] = useState<RewardBook['budgetMode']>((book ?? preview).budgetMode)
  return <section className="tool-card score-plan"><h2>{book ? 'Reward plan' : 'Set up the reward plan'}</h2>
    {locked ? <><p>{book?.missionsForGoal} approved missions to $100 · {cash(10000 / (book?.missionsForGoal ?? 10))} per mission.</p><p>{book?.budgetMode === 'shared' ? 'Everyone shares one $100 cash limit.' : 'Each player has their own $100 cash limit.'}</p><p className="score-explainer">The first approval locks the rate and cash limit so existing rewards stay consistent.</p></> : <form onSubmit={event => { event.preventDefault(); onChange(data => book ? updateRewardSettings(data, { missionsForGoal, budgetMode }) : data.rewards ? data : { ...data, rewards: { ...defaultRewards(), missionsForGoal, budgetMode } }, book ? 'Reward plan changed.' : 'Reward plan set up.') }}>
      <fieldset disabled={!canChange}><legend>How many missions earn $100?</legend><div className="score-plan-options">{([10, 20] as const).map(count => <label className={missionsForGoal === count ? 'selected' : ''} key={count}><input type="radio" name={id + '-rate'} value={count} checked={missionsForGoal === count} onChange={() => setMissionsForGoal(count)} /><span><strong>{count} missions</strong><small>{cash(10000 / count)} each</small></span></label>)}</div></fieldset>
      <label className="score-field" htmlFor={id + '-budget'}>Cash limit<select id={id + '-budget'} value={budgetMode} disabled={!canChange} onChange={event => setBudgetMode(event.target.value as RewardBook['budgetMode'])}><option value="per-player">$100 for each player</option><option value="shared">$100 shared by everyone</option></select></label>
      <p className="score-explainer">{budgetMode === 'shared' ? 'Everyone shares one $100 cash limit.' : 'Each added player has a separate $100 goal.'} Pending amounts are estimates until a mission is approved.</p>
      <button className="tool-button" type="submit" disabled={!canChange || Boolean(book && book.missionsForGoal === missionsForGoal && book.budgetMode === budgetMode)}>{book ? 'Save reward plan' : 'Set up reward plan'}</button>
      <p className="score-explainer">Saving the plan does not approve a mission or record a payment. Rates can change until the first approval.</p>
    </form>}
  </section>
}

function AddPlayer({ canChange, onChange }: { canChange: boolean; onChange: Change }) {
  const id = useId()
  const [name, setName] = useState('')
  return <section className="tool-card score-add-player"><h2>Add a friend</h2><p>Give each helper their own name so their work goes to the right score.</p><form onSubmit={event => { event.preventDefault(); const playerId = crypto.randomUUID(); if (onChange(data => addRewardPlayer(data, { id: playerId, name: name.trim() }), 'Player added.')) setName('') }}><label className="score-field" htmlFor={id}>Friend’s name<input id={id} value={name} maxLength={80} required autoComplete="off" disabled={!canChange} onChange={event => setName(event.target.value)} placeholder="First name" /></label><button className="tool-button secondary" type="submit" disabled={!canChange || !name.trim()}>Add friend</button></form></section>
}

function MissionReview({ data, book, mission, canChange, onChange }: { data: Workspace; book: RewardBook; mission: CleanupMission; canChange: boolean; onChange: Change }) {
  const id = useId()
  const [confirmPaid, setConfirmPaid] = useState(false)
  const entry = rewardSummary(data).entries.find(value => value.missionId === mission.id)
  const approved = entry?.approvedAt != null
  const paid = entry?.paidAt != null
  const person = book.players.find(player => player.id === entry?.playerId)
  const projected = entry && !approved ? approveMission(data, mission.id) : data
  const approvalCash = rewardSummary(projected).entries.find(value => value.missionId === mission.id)?.allocatedCents ?? 0
  const status = !entry ? 'Needs a player' : paid ? 'Paid' : approved ? entry.allocatedCents > 0 ? 'Approved · not paid' : 'Approved · cash cap reached' : 'Pending review'

  return <article className="score-review">
    <div className="score-review-heading"><div><h3>{mission.title}</h3><p>{mission.area} · {new Date(mission.completedAt ?? mission.createdAt).toLocaleDateString()}</p></div><span className={'score-entry-status ' + (paid ? 'paid' : approved ? 'approved' : 'pending')}>{status}</span></div>
    <div className="score-review-photos">{([['Before', mission.beforePhoto], ['After', mission.afterPhoto]] as const).map(([label, src]) => <figure key={label}>{src ? <a href={src} target="_blank" rel="noreferrer" aria-label={'Open ' + label.toLowerCase() + ' photo for ' + mission.title}><img src={src} alt={label + ': ' + mission.area} loading="lazy" /></a> : <div className="score-photo-missing">Photo unavailable</div>}<figcaption>{label} <span>Open photo ↗</span></figcaption></figure>)}</div>
    {mission.summary && <p className="score-review-summary">{mission.summary}</p>}
    <div className="score-review-controls"><label className="score-field" htmlFor={id}>Who did this mission?<select id={id} value={entry?.playerId ?? ''} disabled={!canChange || approved} onChange={event => { if (event.target.value) onChange(current => assignMission(current, mission.id, event.target.value), 'Mission assigned.') }}><option value="" disabled>Choose a player</option>{book.players.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label>
      {!approved ? <button className="tool-button" disabled={!canChange || !entry || projected === data} onClick={() => onChange(current => approveMission(current, mission.id), 'Mission approved.')}>{approvalCash ? 'Approve ' + cash(approvalCash) : 'Approve · points only'}</button> : !paid && entry && entry.allocatedCents > 0 ? <button className="tool-button secondary" disabled={!canChange} onClick={() => setConfirmPaid(true)}>Mark {cash(entry.allocatedCents)} paid</button> : <span className="score-review-points">100 points{entry && entry.allocatedCents > 0 ? ' · ' + cash(entry.allocatedCents) + ' paid' : ''}</span>}
    </div>
    {confirmPaid && approved && !paid && entry && <div className="score-pay-confirm"><h4>Record a payment?</h4><p>Confirm you already paid {person?.name ?? 'this player'} {cash(entry.allocatedCents)} outside this app. This payment record cannot be undone, and no money is sent.</p><div className="tool-row"><button className="tool-button" disabled={!canChange} onClick={() => { if (onChange(current => markMissionPaid(current, mission.id), 'Payment recorded.')) setConfirmPaid(false) }}>Yes, record as paid</button><button className="tool-button secondary" onClick={() => setConfirmPaid(false)}>Cancel</button></div></div>}
  </article>
}
