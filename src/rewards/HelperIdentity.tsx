import { useId, useRef, useState } from 'react'
import type { useWorkspace } from '../crates/useWorkspace'
import { GarageIcon } from '../components/GarageIcons'
import { joinHelper, normalizeHelperName } from './helperProfile'
import './helper-identity.css'

export const HELPER_PLAYER_KEY = 'garage-reset-current-player-v1'

export function readHelperPlayerId(): string | null {
  try { return localStorage.getItem(HELPER_PLAYER_KEY) || null }
  catch { return null }
}

/** A device preference, shared with Missions and Score; never a new account. */
export function rememberHelperPlayerId(id: string | null): boolean {
  try {
    if (id) localStorage.setItem(HELPER_PLAYER_KEY, id)
    else localStorage.removeItem(HELPER_PLAYER_KEY)
    return true
  } catch { return false }
}

type IdentityWorkspace = Pick<ReturnType<typeof useWorkspace>, 'data' | 'update' | 'status' | 'dirty' | 'conflict' | 'storageError' | 'retry'>
export type HelperIdentityProps = {
  workspace: IdentityWorkspace
  selectedPlayerId: string | null
  onSelectPlayer: (id: string | null) => void
}
type Notice = { type: 'selected' | 'added' | 'error'; text: string; playerId?: string }
const normalizedName = normalizeHelperName

/** Uses the parent's workspace so Home and this card never race separate caches. */
export function HelperIdentity({ workspace, selectedPlayerId, onSelectPlayer }: HelperIdentityProps) {
  const id = useId()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const saving = useRef(false)
  const players = workspace.data.rewards?.players ?? []
  const selected = players.find(player => player.id === selectedPlayerId)
  const canRegister = workspace.status === 'shared'
    && !workspace.dirty && !workspace.conflict && !workspace.storageError

  function choose(playerId: string | null, newName?: string) {
    const person = players.find(player => player.id === playerId)
    if (playerId !== null && !person && !newName) return
    const remembered = rememberHelperPlayerId(playerId)
    onSelectPlayer(playerId)
    setNotice({ type: 'selected', text: playerId === null
      ? 'Photos will save without a name.'
      : `${newName ?? person!.name} selected.${remembered ? '' : ' Choose again next visit; this browser could not remember.'}` })
  }

  function addName() {
    const entered = normalizedName(name)
    if (!entered || entered.length > 80 || saving.current) return
    const existing = players.find(player => normalizedName(player.name).toLowerCase() === entered.toLowerCase())
    if (existing) { choose(existing.id); setAdding(false); setName(''); return }
    if (!canRegister) { setNotice({ type: 'error', text: 'Wait for the save, then try again. Photos still work.' }); return }
    saving.current = true
    try {
      const newId = crypto.randomUUID()
      let resolvedId: string | null = null
      let resolvedName = entered
      let changed = false
      const accepted = workspace.update(current => {
        const result = joinHelper(current, entered, newId)
        resolvedId = result.playerId
        resolvedName = result.data.rewards?.players.find(player => player.id === resolvedId)?.name ?? entered
        changed = result.data !== current
        return result.data
      })
      if (!accepted || !resolvedId) {
        setNotice({ type: 'error', text: 'Name not saved. Wait for the save, then try again.' })
        return
      }
      choose(resolvedId, resolvedName)
      if (changed) setNotice({ type: 'added', text: resolvedName, playerId: resolvedId })
      setAdding(false); setName('')
    } catch {
      setNotice({ type: 'error', text: 'Name not saved. Try again.' })
    } finally { saving.current = false }
  }

  const noticeText = notice?.type === 'added'
    ? workspace.status === 'shared' && !workspace.dirty && players.some(player => player.id === notice.playerId)
      ? `${notice.text} selected and saved.`
      : workspace.conflict
        ? `${notice.text} is on this device. Resolve the save conflict.`
        : `Saving ${notice.text}…`
    : notice?.text

  return <section className="helper-identity" aria-labelledby={id + '-heading'}>
    <div className="helper-identity-heading"><GarageIcon name="crew" /><div><h2 id={id + '-heading'}>Your name</h2></div></div>
    <>
      <div className="helper-identity-choice"><label htmlFor={id + '-player'}><span className="helper-identity-sr-only">Choose your name</span><select id={id + '-player'} value={selected?.id ?? ''} onChange={event => choose(event.target.value || null)}><option value="">No name yet</option>{players.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label><button type="button" className="helper-identity-add" aria-expanded={adding} aria-controls={id + '-add'} onClick={() => { setAdding(value => !value); setNotice(null) }}>{adding ? 'Cancel' : 'Add name'}</button></div>
      {adding && <form id={id + '-add'} className="helper-identity-form" onSubmit={event => { event.preventDefault(); addName() }}><label htmlFor={id + '-name'}>Name<input id={id + '-name'} value={name} maxLength={80} autoComplete="given-name" autoCapitalize="words" onChange={event => setName(event.target.value)} placeholder="First name or nickname" required /></label><button type="submit" disabled={!normalizedName(name) || !canRegister}>Save</button>{!canRegister && <p>{workspace.status === 'offline' || workspace.status === 'error' ? 'Save paused. Your name stays here.' : 'Waiting for the save…'}</p>}{!workspace.conflict && (workspace.status === 'offline' || workspace.status === 'error') && <button type="button" onClick={workspace.retry}>Retry save</button>}</form>}
    </>
    {noticeText && <p className={'helper-identity-notice ' + (notice?.type ?? '')} role={notice?.type === 'error' ? 'alert' : 'status'}>{noticeText}</p>}
  </section>
}
