import { useState } from 'react'
import type { Tab } from '../App'
import { GarageIcon } from '../components/GarageIcons'
import { useWorkspace } from '../crates/useWorkspace'
import { findCrateByCode } from '../crates/labelLinks'
import { observationHasLabel } from '../crates/model'
import { HelperIdentity, readHelperPlayerId } from '../rewards/HelperIdentity'
import { stickerCredit } from '../rewards/activityPoints'
import './label-quest.css'

type Role = 'outside' | 'contents'
export function LabelQuest({ initialCode, onCaptureLabel, onNavigate, onOpenCrate }: {
  initialCode?: string | null
  onCaptureLabel: (code: string, role: Role) => void
  onNavigate: (tab: Tab) => void
  onOpenCrate: (id: string) => void
}) {
  const workspace = useWorkspace()
  const observations = workspace.data.observations ?? []
  const labels = Array.from({ length: 32 }, (_, index) => `C-${String(index + 1).padStart(3, '0')}`)
  const [code, setCode] = useState(initialCode && /^C-(?!000)\d{3}$/.test(initialCode.toUpperCase()) ? initialCode.toUpperCase() : 'C-001')
  const [input, setInput] = useState(code)
  const [error, setError] = useState('')
  const [helperId, setHelperId] = useState(readHelperPlayerId)
  const [notice, setNotice] = useState('')
  const helper = workspace.data.rewards?.players.find(player => player.id === helperId)
  const stickers = (workspace.data.activityCredits ?? []).filter(credit => credit.kind === 'sticker' && credit.labelCode === code)
  function confirmSticker(surface: 'front' | 'lid') {
    if (!shared || !helper || input.trim().toUpperCase() !== code) return
    let changed = false
    const accepted = workspace.update(data => { const next = stickerCredit(data, code, surface, helper.id); changed = next !== data; return next })
    setNotice(accepted && changed ? `${helper.name} +25 points.` : 'Already counted, or save needs attention.')
  }
  const shared = workspace.status === 'shared' && !workspace.dirty && !workspace.conflict && !workspace.storageError
  const saving = workspace.status === 'saving' || (workspace.status === 'shared' && workspace.dirty)
  const photosForLabel = (label: string) => observations.filter(photo => observationHasLabel(photo, label, workspace.data.crates))
  const photos = photosForLabel(code)
  const outside = photos.filter(photo => photo.photoRole === 'outside')
  const contents = photos.filter(photo => photo.photoRole === 'contents')
  const crate = findCrateByCode(workspace.data.crates, code)
  const documented = labels.filter(label => { const found = photosForLabel(label); return found.some(photo => photo.photoRole === 'outside') && found.some(photo => photo.photoRole === 'contents') }).length
  const photographed = labels.filter(label => photosForLabel(label).length > 0).length
  function pick(value: string) { history.replaceState(null,'',`#labels?code=${encodeURIComponent(value)}`); setCode(value); setInput(value); setError(''); setNotice('') }
  function next() {
    const index = labels.indexOf(code)
    const nextLabel = [...labels.slice(index + 1), ...labels.slice(0, index + 1)].find(label => { const found = photosForLabel(label); return !(found.some(photo => photo.photoRole === 'contents') && found.some(photo => photo.photoRole === 'outside')) })
    pick(nextLabel ?? labels[(index + 1) % labels.length]); window.scrollTo({ top: 0, behavior: 'auto' })
  }
  return <main className="label-quest">
    <header><span className="label-quest-mark"><GarageIcon name="crate" /></span><h1>Label a crate</h1></header>
    <div className="label-quest-status" role="status">{shared ? 'Saved' : saving ? 'Saving…' : workspace.status === 'connecting' ? 'Loading…' : 'Save needs attention'}<span>{photographed} / 32 photographed</span></div>
    {!shared && !saving && workspace.status !== 'connecting' && <p className="label-quest-alert">{workspace.error || 'Check the shared save to continue.'}<button onClick={() => onNavigate('observations')}>Review photos →</button></p>}
    {initialCode && !/^C-(?!000)\d{3}$/.test(initialCode.toUpperCase()) && <p role="alert" className="label-quest-alert">{initialCode} isn’t a printed ID. Choose the ID on your sticker.</p>}
    <section className="label-quest-select" aria-label="Choose crate"><form onSubmit={event => { event.preventDefault(); const value = input.trim().toUpperCase(); const normalized = /^\d{1,3}$/.test(value) ? `C-${value.padStart(3, '0')}` : value; if (!/^C-(?!000)\d{3}$/.test(normalized)) { setError('Enter C-001, or just 1.'); return } pick(normalized) }}><label>Crate ID<input value={input} onChange={event => setInput(event.target.value)} maxLength={8} autoCapitalize="characters" autoCorrect="off" spellCheck={false} /></label><button type="submit">Choose</button></form>{error && <p role="alert">{error}</p>}{input.trim().toUpperCase()!==code && <p role="status">Tap Choose to use this ID.</p>}</section>
    <section className="label-quest-current" aria-labelledby="current-label"><div className="label-quest-current-title"><span id="current-label">{code}</span>{crate && <div><h2>{crate.name}</h2>{crate.location && <p>{crate.location}</p>}</div>}</div>{photos.length > 0 && <p className="label-quest-existing">{photos.length} photos saved. Same box? Keep this ID.</p>}
      <section className="label-quest-stickers" aria-label="Sticker points"><h3>Stick the labels</h3><details><summary>{helper ? `${helper.name} · change` : 'Choose your name for points'}</summary><HelperIdentity workspace={workspace} selectedPlayerId={helperId} onSelectPlayer={setHelperId}/></details><div>{(['front', 'lid'] as const).map(surface => { const credit = stickers.find(item => item.kind === 'sticker' && item.surface === surface); const name = workspace.data.rewards?.players.find(player => player.id === credit?.helperId)?.name; return <button key={surface} className={credit ? 'credited' : ''} disabled={!!credit || !shared || !helper || input.trim().toUpperCase() !== code} onClick={() => confirmSticker(surface)}><GarageIcon name="crate"/><span><strong>{surface === 'front' ? 'Front / side' : 'Lid'}</strong><small>{credit ? `✓ +25 · ${name}` : 'I stuck it · +25'}</small></span></button> })}</div>{notice && <p role="status">{notice} {workspace.dirty ? 'Saving…' : shared ? 'Saved.' : 'Check the save above.'}</p>}</section>
      <div className="label-quest-steps">{([{ role: 'outside', title: 'Outside', photos: outside }, { role: 'contents', title: 'Contents', photos: contents }] as const).map(step => <article key={step.role}><div className="label-quest-step-heading"><h3>{step.title}{step.photos.length ? ' ✓' : ''}</h3></div>{step.photos.length > 0 && <img src={step.photos[step.photos.length - 1].photo} alt={`${code} ${step.role}`} />}<button disabled={!shared || input.trim().toUpperCase() !== code} aria-label={`${step.photos.length ? 'Add' : 'Take'} ${step.role} photo`} onClick={() => onCaptureLabel(code, step.role)}><GarageIcon name="missions"/>{step.photos.length ? 'Add photo' : 'Take photo'}</button></article>)}</div>
      <div className="label-quest-finish">{outside.length > 0 && contents.length > 0 && <strong>Both photos saved ✓</strong>}<button onClick={next}>Next crate →</button></div>
      <details className="label-quest-notes"><summary>Saved notes</summary>{photos.length ? photos.map(photo => <article key={photo.id}><b>{photo.photoRole === 'outside' ? 'Outside' : photo.photoRole === 'contents' ? 'Contents' : 'Photo'} · {new Date(photo.createdAt).toLocaleDateString()}</b>{(photo.location || photo.helperId) && <p>{photo.location}{photo.helperId && workspace.data.rewards?.players.find(player => player.id === photo.helperId) ? ` · ${workspace.data.rewards.players.find(player => player.id === photo.helperId)!.name}` : ''}</p>}{photo.notes && <p>{photo.notes}</p>}</article>) : <p>No notes yet.</p>}{crate && <button onClick={() => onOpenCrate(crate.id)}>Open inventory →</button>}</details>
    </section>
    <details className="label-quest-labels"><summary>Other crates</summary><div>{labels.map(label => <button key={label} aria-pressed={label === code} onClick={() => pick(label)}>{label}{photosForLabel(label).length ? ' •' : ''}</button>)}</div></details>
    <details className="label-quest-help"><summary>Help & points</summary><p>Match the lid and front / side IDs. Tap each sticker button after placing it: 25 points, once per sticker.</p><p>Photograph the label and surroundings, then the contents. A useful photo earns 25 points after John’s review. New inventory entries earn 25 per saved batch.</p><p>Keep both car spaces clear. Skip crates that are hard to reach or open.</p><p>{documented} / 32 crates have both photos. Photos don’t identify items automatically.</p></details>
    <footer><button onClick={() => onNavigate('observations')}>All photos →</button></footer>
  </main>
}
