import { useState } from 'react'
import type { Tab } from '../App'
import { GarageIcon } from '../components/GarageIcons'
import { useWorkspace } from '../crates/useWorkspace'
import { findCrateByCode } from '../crates/labelLinks'
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
    setNotice(accepted && changed ? `${helper.name} earned 25 points for the ${surface === 'front' ? 'front / side' : 'lid'} sticker.` : 'This sticker was already credited, or the save needs attention.')
  }
  const shared = workspace.status === 'shared' && !workspace.dirty && !workspace.conflict && !workspace.storageError
  const saving = workspace.status === 'saving' || (workspace.status === 'shared' && workspace.dirty)
  const photos = observations.filter(photo => photo.labelCode ? photo.labelCode === code : Boolean(photo.crateId && workspace.data.crates.find(crate => crate.id === photo.crateId)?.code.toUpperCase() === code))
  const outside = photos.filter(photo => photo.photoRole === 'outside')
  const contents = photos.filter(photo => photo.photoRole === 'contents')
  const crate = findCrateByCode(workspace.data.crates, code)
  const documented = labels.filter(label => observations.some(photo => photo.labelCode === label && photo.photoRole === 'outside') && observations.some(photo => photo.labelCode === label && photo.photoRole === 'contents')).length
  const photographed = labels.filter(label => observations.some(photo => photo.labelCode === label)).length
  function pick(value: string) { history.replaceState(null,'',`#labels?code=${encodeURIComponent(value)}`); setCode(value); setInput(value); setError(''); setNotice('') }
  function next() {
    const index = labels.indexOf(code)
    const nextLabel = [...labels.slice(index + 1), ...labels.slice(0, index + 1)].find(label => !(observations.some(photo => photo.labelCode === label && photo.photoRole === 'contents') && observations.some(photo => photo.labelCode === label && photo.photoRole === 'outside')))
    pick(nextLabel ?? labels[(index + 1) % labels.length]); window.scrollTo({ top: 0, behavior: 'auto' })
  }
  return <main className="label-quest">
    <header><span className="label-quest-mark"><GarageIcon name="crate" /></span><div><p className="home-eyebrow">A SMALL EXPLORING MISSION</p><h1>Label it. Show what’s inside.</h1><p>One crate, two photos. No timer. No sorting decisions yet.</p></div></header>
    <div className="label-quest-status" role="status">{shared ? 'Saved with the family' : saving ? 'Saving with the family…' : workspace.status === 'connecting' ? 'Opening the shared crate photos…' : 'Shared progress needs attention'}<span>{photographed} / 32 photographed · {documented} with both views</span></div>
    {!shared && !saving && workspace.status !== 'connecting' && <p className="label-quest-alert">{workspace.error || 'Open your photo collection to review the shared save before continuing.'}<button onClick={() => onNavigate('observations')}>Review saved photos →</button></p>}
    {initialCode && !/^C-(?!000)\d{3}$/.test(initialCode.toUpperCase()) && <p role="alert" className="label-quest-alert">{initialCode} is not one of the printed IDs. Choose the actual printed label below before taking photos, or return to Crates for its existing inventory record.</p>}
    <section className="label-quest-select" aria-labelledby="label-step-title"><div><span className="label-step-number">1</span><h2 id="label-step-title">Attach the matching stickers</h2></div><p>Use the same crate ID on the front or side and on the lid. If the box already has a label, keep that ID.</p><form onSubmit={event => { event.preventDefault(); const value = input.trim().toUpperCase(); const normalized = /^\d{1,3}$/.test(value) ? `C-${value.padStart(3, '0')}` : value; if (!/^C-(?!000)\d{3}$/.test(normalized)) { setError('Use a label ID like C-001, or just type 1.'); return } pick(normalized) }}><label>Which label is on this crate?<input value={input} onChange={event => setInput(event.target.value)} maxLength={8} autoCapitalize="characters" autoCorrect="off" spellCheck={false} /></label><button type="submit">Use this label</button></form>{error && <p role="alert">{error}</p>}{input.trim().toUpperCase()!==code && <p role="status">Tap “Use this label” to confirm the ID before taking a photo.</p>}<p className="label-quest-tip">Or scan its QR with your iPhone Camera and tap the link. Then choose “Label & photograph”.</p></section>
    <section className="label-quest-current" aria-labelledby="current-label"><div className="label-quest-current-title"><span id="current-label">{code}</span><div><h2>{crate?.name || 'Let’s meet this crate.'}</h2><p>{crate?.location || 'Optional: say where it lives when you save the photo.'}</p></div></div>{photos.length > 0 && <p className="label-quest-existing">This ID already has {photos.length} saved {photos.length === 1 ? 'photo' : 'photos'}. Check they show the same box before adding more.</p>}
      <section className="label-quest-stickers" aria-label="Sticker points"><h3>Sticker on? Collect your points.</h3><p>25 points for each sticker you actually place. Each position counts once for this crate.</p><details><summary>{helper ? `Playing as ${helper.name} · change name` : 'Choose your name to collect sticker points'}</summary><HelperIdentity workspace={workspace} selectedPlayerId={helperId} onSelectPlayer={setHelperId}/></details><div>{(['front', 'lid'] as const).map(surface => { const credit = stickers.find(item => item.kind === 'sticker' && item.surface === surface); const name = workspace.data.rewards?.players.find(player => player.id === credit?.helperId)?.name; return <button key={surface} className={credit ? 'credited' : ''} disabled={!!credit || !shared || !helper || input.trim().toUpperCase() !== code} onClick={() => confirmSticker(surface)}><GarageIcon name="crate"/><span><strong>{surface === 'front' ? 'Front / side sticker' : 'Lid sticker'}</strong><small>{credit ? `✓ 25 points · ${name}` : 'I placed this sticker · +25'}</small></span></button> })}</div>{!helper && <p>You can still take photos below. Choose your name above when you want sticker points.</p>}{notice && <p role="status">{notice} {workspace.dirty ? 'Waiting to save with the family.' : shared ? 'Saved with the family.' : 'Check the shared save above.'}</p>}</section>
      <div className="label-quest-steps">{([{ role: 'outside', number: 2, title: 'Photo of the labeled crate', prompt: 'Stand back a little. Show the ID and the shelf or floor around it.', photos: outside }, { role: 'contents', number: 3, title: 'Open it. Photograph the contents.', prompt: 'Keep the label in view if you can. Say what you see using your keyboard’s microphone. Close it when done.', photos: contents }] as const).map(step => <article key={step.role}><div className="label-quest-step-heading"><span className="label-step-number">{step.photos.length ? '✓' : step.number}</span><h3>{step.title}</h3></div>{step.photos.length > 0 && <img src={step.photos[step.photos.length - 1].photo} alt={`${code} ${step.role}`} />}<p>{step.prompt}</p><button disabled={!shared || input.trim().toUpperCase() !== code} onClick={() => onCaptureLabel(code, step.role)}><GarageIcon name="missions"/>{step.photos.length ? 'Add another photo' : step.role === 'outside' ? 'Take outside photo' : 'Take contents photo'}</button>{step.photos.length > 0 && <small>{step.photos.length} saved {step.photos.length === 1 ? 'photo' : 'photos'}</small>}</article>)}</div>
      <div className="label-quest-finish"><div><strong>{outside.length && contents.length ? 'This crate has both views. Nice work.' : outside.length || contents.length ? 'One view is already useful.' : 'Two photos will give this crate a useful record.'}</strong><p>Leave both car spaces clear. If a crate is hard to reach or open, leave it closed and move on.</p></div><button onClick={next}>Next crate →</button></div>
      <details className="label-quest-notes"><summary>See saved notes & contents</summary>{photos.length ? photos.map(photo => <article key={photo.id}><b>{photo.photoRole === 'outside' ? 'Outside' : photo.photoRole === 'contents' ? 'Contents' : 'Photo'} · {new Date(photo.createdAt).toLocaleDateString()}</b><p>{photo.location || 'Location not added'}{photo.helperId && workspace.data.rewards?.players.find(player => player.id === photo.helperId) ? ` · by ${workspace.data.rewards.players.find(player => player.id === photo.helperId)!.name}` : ''}</p><p>{photo.notes || 'Photo saved without a note.'}</p></article>) : <p>Your saved photos and notes will appear here.</p>}{crate && <button onClick={() => onOpenCrate(crate.id)}>Open this crate’s inventory →</button>}</details>
    </section>
    <details className="label-quest-labels"><summary>Choose another of your 32 labels</summary><div>{labels.map(label => <button key={label} aria-pressed={label === code} onClick={() => pick(label)}>{label}{observations.some(photo => photo.labelCode === label) ? ' •' : ''}</button>)}</div></details>
    <footer><p>Photos and your descriptions build the crate photo catalog. Stickers earn 25 points each; useful photos earn 25 after review. Adding new contents to a registered crate earns 25 per saved batch. Volume estimates can wait; taking a photo doesn’t automatically identify or discard anything.</p><button onClick={() => onNavigate('observations')}>See all photos & measurements →</button></footer>
  </main>
}
