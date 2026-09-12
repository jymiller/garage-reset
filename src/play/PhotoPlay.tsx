import { useEffect, useRef, useState } from 'react'
import type { Tab } from '../App'
import type { CleanupMission } from '../crates/model'
import { uploadCratePhoto, useWorkspace } from '../crates/useWorkspace'
import { completeMission, missionElapsedSeconds, missionProgress, pauseMission, resumeMission, reviewMission, startMission } from './mission'
import { sound } from '../sound'
import './play.css'
import { GarageIcon } from '../components/GarageIcons'
import { openMissionsForPlayer, savePlayerMissionSetup } from './playerMissions'

type Kind = CleanupMission['kind']
type CountKey = 'kept' | 'bagged' | 'donated' | 'ask'
const modes = [
  { kind: 'floor' as Kind, icon: 'floor' as const, title: 'Clear a floor area', subtitle: 'Choose a small area and put the loose items away.', area: 'Tool corner · one small floor area', photo: '/evidence/2026-09-09/IMG_1927.jpg', tips: ['Choose a small floor area you can clear in one mission.', 'Put each item away, set it aside to leave, or ask its owner.', 'Leave the white parking line and both car routes clear.'] },
  { kind: 'shelf' as Kind, icon: 'shelf' as const, title: 'Sort a shelf', subtitle: 'Organize the items on one shelf.', area: 'Storage racks · one shelf section', photo: '/evidence/2026-09-09/IMG_1930.jpg', tips: ['Choose one exposed shelf section. Leave the rest in place.', 'Put the items you are keeping into suitable containers.', 'Put the finished containers back behind the parking line.'] },
  { kind: 'crate' as Kind, icon: 'crate' as const, title: 'Sort a crate', subtitle: 'Record what is inside, then pack what you are keeping.', area: 'One crate · record its shelf address', photo: '/evidence/2026-09-09/IMG_1928.jpg', tips: ['Photograph the open crate, including its label.', 'Keep related things together; put unresolved things in one holding tote.', 'Open Crates after this mission to record the contents and new fill.'] },
]
const countLabels: {key:CountKey;label:string;verb:string;symbol:string}[] = [
  {key:'kept',label:'Put away',verb:'items put away',symbol:'⌂'},
  {key:'bagged',label:'Put in sack',verb:'items put in the sack',symbol:'↓'},
  {key:'donated',label:'Set aside to donate',verb:'items set aside to donate',symbol:'↗'},
  {key:'ask',label:'Ask the owner',verb:'items needing an owner decision',symbol:'?'},
]
const clock = (seconds:number) => `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`
const statusText = {connecting:'Connecting…',shared:'Shared workspace',saving:'Saving…',offline:'Draft saved on this device',conflict:'Draft needs review',error:'Save needs attention'}
const PLAYER_KEY = 'garage-reset-current-player-v1'
const rememberedPlayer = () => { try { return localStorage.getItem(PLAYER_KEY) || '' } catch { return '' } }

export function PhotoPlay({onNavigate, initialCrateId, onOpenCrate}:{onNavigate:(tab:Tab)=>void;initialCrateId?:string|null;onOpenCrate:(id:string)=>void}) {
  const workspace = useWorkspace()
  const missions = workspace.data.missions || []
  const rewards = workspace.data.rewards
  const players = rewards?.players ?? []
  const [playerId,setPlayerId] = useState(rememberedPlayer)
  const [editingPlayerId,setEditingPlayerId] = useState('')
  const [selected,setSelected] = useState<string|null>(null)
  const [editingId,setEditingId] = useState<string|null>(null)
  const [lobby,setLobby] = useState(Boolean(initialCrateId))
  const [kind,setKind] = useState<Kind>(initialCrateId?'crate':'floor')
  const [crateId,setCrateId] = useState(initialCrateId || '')
  const [area,setArea] = useState('')
  const [minutes,setMinutes] = useState<5|10|15>(10)
  const [photoBusy,setPhotoBusy] = useState(false)
  const [message,setMessage] = useState('')
  const [now,setNow] = useState(Date.now())
  const [soundOn,setSoundOn] = useState(()=>!sound.isMuted())
  const [resultDraft,setResultDraft] = useState<{id:string;text:string}|null>(null)
  const [backedUp,setBackedUp] = useState(false)
  const selectionRef = useRef<HTMLDivElement>(null)
  const activePlayer = players.find(player=>player.id===playerId)
  const ownerOf = (id:string) => players.find(player=>player.id===rewards?.entries.find(entry=>entry.missionId===id)?.playerId)
  const open = missions.filter(m=>m.phase!=='complete')
  const playerOpen = openMissionsForPlayer(workspace.data, activePlayer?.id ?? null)
  const orderedOpen = rewards ? [...playerOpen,...open.filter(m=>!playerOpen.includes(m))] : open
  const mission = missions.find(m=>m.id===selected) || (!lobby ? playerOpen[0] : undefined)
  const missionPlayer = mission ? ownerOf(mission.id) : undefined
  const missionEntry = rewards?.entries.find(entry=>entry.missionId===mission?.id)
  const setupPlayerId = editingId ? editingPlayerId : playerId
  const setupPlayer = players.find(player=>player.id===setupPlayerId)
  const editingEntry = rewards?.entries.find(entry=>entry.missionId===editingId)
  const blockedMission = openMissionsForPlayer(workspace.data, setupPlayer?.id ?? null).find(m=>m.id!==editingId)
  const needsPlayer = Boolean(rewards && !setupPlayer && (!editingId || editingEntry))
  const template = modes.find(m=>m.kind===(mission?.kind || kind))!
  const linked = workspace.data.crates.find(c=>c.id===(mission ? mission.crateId : kind==='crate' ? crateId : null))
  const resultText = resultDraft?.id===mission?.id ? resultDraft?.text || '' : mission?.summary || ''
  const finished = missions.filter(m=>m.phase==='complete').slice().sort((a,b)=>(b.completedAt||0)-(a.completedAt||0))
  const score = missionProgress(missions)

  useEffect(()=>{if(!mission||mission.runningSince===null)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[mission?.runningSince])
  useEffect(()=>{setMessage('');window.scrollTo(0,0)},[mission?.id,mission?.phase])

  function change(id:string, transform:(m:CleanupMission)=>CleanupMission) {
    let changed=false
    const accepted=workspace.update(d=>{
      const next=(d.missions||[]).map(m=>{
        if(m.id!==id||m.phase==='complete')return m
        const replacement=transform(m)
        changed=replacement!==m
        return replacement
      })
      return changed?{...d,missions:next}:d
    })
    return accepted&&changed
  }
  function patch(id:string, fields:Partial<CleanupMission>) {return change(id,m=>({...m,...fields}))}
  function openRound(id:string) {setSelected(id);setLobby(false);setEditingId(null)}
  function goLobby() {setSelected(null);setLobby(true);setMessage('');setEditingId(null)}
  function choosePlayer(id:string) {
    if(editingId) {setEditingPlayerId(id);return}
    setPlayerId(id)
    try { if(id)localStorage.setItem(PLAYER_KEY,id);else localStorage.removeItem(PLAYER_KEY) } catch { /* Player choice still works for this visit. */ }
  }
  function editBefore() {if(!mission||mission.phase!=='before'||photoBusy)return;setKind(mission.kind);setArea(mission.area);setCrateId(mission.crateId||'');setMinutes(mission.plannedMinutes);setEditingPlayerId(missionEntry?.playerId||'');setEditingId(mission.id);setSelected(null);setLobby(true)}
  function beginRound() {
    const id=editingId||crypto.randomUUID()
    let created=false
    let failure=''
    const accepted=workspace.update(d=>{
      const result=savePlayerMissionSetup(d,{id,editing:Boolean(editingId),kind,area,crateId:crateId||null,plannedMinutes:minutes,playerId:setupPlayerId||null,title:template.title,defaultArea:template.area})
      created=result.missionId!==null
      failure=result.error||''
      return result.data
    })
    if(accepted&&created)openRound(id)
    else setMessage(failure||'The mission could not be saved. Check the fields and try again.')
  }
  async function attach(file:File|undefined, phase:'before'|'after') {
    if(!file||!mission||photoBusy)return
    const id=mission.id
    setPhotoBusy(true);setMessage('')
    try {
      const url=await uploadCratePhoto(file)
      if(change(id,m=>m.phase===(phase==='before'?'before':'review')?{...m,...(phase==='before'?{beforePhoto:url}:{afterPhoto:url})}:m))setMessage('Photo saved. Your original stays unchanged.')
    } catch(e){setMessage(e instanceof Error?e.message:'Photo upload failed. Try again.')} finally{setPhotoBusy(false)}
  }
  function start() {
    if(!mission)return
    let started=false
    const accepted=workspace.update(d=>{const current=(d.missions||[]).find(m=>m.id===mission.id);if(!current)return d;const next=startMission(current,Date.now());if(next===current)return d;started=true;return{...d,missions:(d.missions||[]).map(m=>m.id===current.id?next:m),crates:d.crates.map(c=>c.id===current.crateId?{...c,status:'sorting'}:c)}})
    if(accepted&&started){setNow(Date.now());if(soundOn)sound.start()}
  }
  function finish() {
    if(!mission||mission.phase==='complete')return
    const accepted=change(mission.id,m=>{if(m.phase!=='review')return m;const next=completeMission({...m,summary:resultText.trim()},Date.now());return next.phase==='complete'?next:m})
    if(accepted){setSelected(mission.id);setLobby(false);if(soundOn)sound.levelUp()}
  }
  const elapsed = mission ? missionElapsedSeconds(mission,now) : 0
  const remaining = mission ? Math.max(0,mission.plannedMinutes*60-elapsed) : 0
  const step = !mission?0:mission.phase==='before'?1:mission.phase==='active'?2:3

  return <div className="play-app">
    <header className="play-nav">
      <button className="play-logo" onClick={()=>onNavigate('home')} aria-label="Garage Reset home"><span>G↗</span><b>GARAGE RESET</b></button>
      <nav aria-label="Garage workspace"><button className="selected" onClick={goLobby}>Missions</button><button onClick={()=>onNavigate('crates')}>Crates</button><button onClick={()=>onNavigate('pickup')}>Pickup</button></nav>
      <button type="button" className="play-level" onClick={()=>onNavigate('score')} aria-label="Open points and cash score"><span>LV {score.level}</span><b>{score.points} points</b><span className="play-score-arrow" aria-hidden="true">→</span></button>
    </header>
    <main className="play-main">
      <div className="play-status-row"><span className={`play-sync ${workspace.status}`} role="status">● {workspace.storageError?'Device backup unavailable · export now':statusText[workspace.status]}</span><button onClick={()=>{const enabled=!soundOn;setSoundOn(enabled);sound.setMuted(!enabled);if(enabled)sound.prime()}} aria-pressed={soundOn}>{soundOn?'♪ Sound on':'♪ Sound off'}</button></div>
      {(workspace.error||workspace.status==='offline'||workspace.storageError)&&<div className="play-alert" role="alert">{workspace.error||'This round is a local draft until it reaches the shared server. Photos need a connection.'}<button onClick={()=>workspace.downloadDraft()}>Export backup</button></div>}
      {workspace.conflict&&<div className="play-alert"><b>Another device saved first.</b><p>Your draft is preserved. Export it before loading the shared version.</p><button onClick={()=>{workspace.downloadDraft();setBackedUp(true)}}>Export my draft</button><button disabled={!backedUp} onClick={()=>{workspace.useSharedVersion();setBackedUp(false)}}>Load shared version</button></div>}
      {!mission ? <>
        {rewards ? <section className="play-player-setup" aria-labelledby="play-player-heading">
          <div><h2 id="play-player-heading">Who is playing?</h2><p>{editingId ? 'Choose who this saved mission belongs to. Its current assignment stays unless you change it.' : 'Choose your name before starting. Each player can have one unfinished mission.'}</p></div>
          <div className="play-player-choice"><label htmlFor="play-player">Player for this mission</label><select id="play-player" value={setupPlayer?.id ?? ''} onChange={event=>choosePlayer(event.target.value)}><option value="" disabled={Boolean(editingEntry)}>{editingId && !editingEntry ? 'No player assigned' : 'Choose a player'}</option>{players.map(player=><option key={player.id} value={player.id}>{player.name}</option>)}</select><button type="button" className="play-text-button" onClick={()=>onNavigate('score')}>{players.length ? 'Players & cash rewards →' : 'Add players in Score →'}</button></div>
          <p className="play-player-note">Completing a mission earns 100 points. Cash needs John’s review.</p>
        </section> : <section className="play-reward-note"><div><h2>Play for points. Plan cash rewards.</h2><p>You can start a mission now. Set up players and a reward plan to track cash separately.</p></div><button type="button" className="play-secondary" onClick={()=>onNavigate('score')}>Set up players & cash rewards →</button></section>}
        <section className="play-hero">
          <div className="play-hero-copy"><span className="play-kicker">CLEAN UP ONE AREA AT A TIME</span><h1>Clear a little.<br /><em>See the difference.</em></h1><p>Choose a floor area, shelf, or crate.<br />Take photos before and after you sort.</p><button className="play-primary" onClick={()=>selectionRef.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})}>Choose a mission <span>↗</span></button><div className="play-hero-foot"><span>◎</span> Before photo → sort items → after photo.</div></div>
          <div className="play-hero-photo"><img src="/evidence/2026-09-09/IMG_1930.jpg" alt="Your storage racks behind the white parking-clearance line" /><div className="play-photo-shade"/><span className="play-photo-caption">YOUR GARAGE · SEPT 9 REFERENCE</span><div className="play-photo-reticle"><i/><span>ONE SMALL AREA<br /><b>YOU’VE GOT THIS.</b></span><i/></div><div className="play-photo-sticker"><span>YOUR NEXT MISSION</span><b>Choose one<br />area to clear.</b><span>+100 points / FINISHED MISSION</span></div></div>
        </section>
        {orderedOpen.length>0&&<section className="play-open-missions" aria-label="Saved missions by player">{orderedOpen.map(saved=>{
          const owner=ownerOf(saved.id)
          return <article key={saved.id} className={`play-resume${owner && owner.id===activePlayer?.id ? ' play-resume-own' : ''}`}><div><span className="play-mission-player">{owner?.name ?? 'No player assigned'}</span><h2>{saved.title}</h2><p>{saved.area} · {saved.phase==='before' ? saved.beforePhoto ? 'Ready to start' : 'Before photo needed' : saved.phase==='active' ? saved.runningSince===null ? 'Timer paused' : 'Mission in progress' : 'After photo and review'}</p></div><button className="play-primary" onClick={()=>openRound(saved.id)}>{owner ? `Continue ${owner.name}’s mission` : 'Continue unassigned mission'} →</button></article>
        })}</section>}
        <section className="play-selection" ref={selectionRef}>
          <div className="play-section-heading"><div><span className="play-kicker">CHOOSE A MISSION</span><h2>What will you work on?</h2></div><span>{rewards ? 'One unfinished mission per player. Keep both car spaces clear.' : 'Finish one mission at a time. Keep both car spaces clear.'}</span></div>
          <div className="play-mode-grid">{modes.map((mode,index)=><button key={mode.kind} className={`play-mode ${kind===mode.kind?'chosen':''}`} aria-pressed={kind===mode.kind} onClick={()=>{setKind(mode.kind);setArea('')}}><span className="play-mode-top"><GarageIcon name={mode.icon} className="play-choice-icon"/><b>0{index+1}</b></span><h3>{mode.title}</h3><p>{mode.subtitle}</p><span className="play-mode-select">{kind===mode.kind?'Selected ✓':'Choose'}</span></button>)}</div>
          <div className="play-setup">
            <div><label>Where will you work?<input aria-label="Round location" value={area} maxLength={160} placeholder={kind==='crate'&&linked?.location?linked.location:template.area} onChange={e=>setArea(e.target.value)} /></label>{kind==='crate'&&<label>Choose a registered crate<select value={crateId} onChange={e=>setCrateId(e.target.value)}><option value="">Crate not registered yet</option>{workspace.data.crates.map(c=><option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}</select></label>}</div>
            <div><span className="play-field-label">How long will you work?</span><div className="play-minutes" role="group" aria-label="Round length">{([5,10,15] as const).map(n=><button key={n} aria-pressed={minutes===n} onClick={()=>setMinutes(n)}>{n}<small>MIN</small></button>)}</div><p className="play-fine">You can pause the timer or finish early.</p></div>
            <button className="play-primary" disabled={needsPlayer || Boolean(blockedMission) || workspace.status==='connecting'} onClick={beginRound}>{editingId?'Save changes & take before photo':'Take before photo'} <CameraIcon /></button>
          </div>
          {needsPlayer && <p className="play-fine">Choose a registered player above before starting a new mission.</p>}{blockedMission && <p className="play-fine">{setupPlayer ? `${setupPlayer.name} already has an unfinished mission.` : 'An unfinished mission is waiting.'} Continue it above before starting another for the same player.</p>}
        </section>
        <section className="play-wins"><div className="play-section-heading"><div><span className="play-kicker">YOUR BEFORE-AND-AFTER PHOTOS</span><h2>Completed missions</h2></div><span>{finished.length} missions finished · {score.roundsToNextLevel} to level {score.level+1}</span></div>{!finished.length?<div className="play-empty-wall"><span>✦</span><p>Your completed missions will appear here.<br /><b>Each one saves your before and after photos.</b></p></div>:<div className="play-win-grid">{finished.map(m=><button key={m.id} className="play-win-card" onClick={()=>openRound(m.id)}><div><img src={m.beforePhoto!} alt={`Before: ${m.area}`} loading="lazy"/><img src={m.afterPhoto!} alt={`After: ${m.area}`} loading="lazy"/><span>+100 points</span></div><h3>{m.title}</h3><p>{m.summary}</p><small><strong className="play-history-player">{ownerOf(m.id)?.name ?? 'No player assigned'}</strong>{new Date(m.completedAt!).toLocaleDateString()} · Compare the photos ↗</small></button>)}</div>}</section>
        <div className="play-badges" aria-label="Earned photo mission badges">{score.badges.map(b=><span key={b}>✦ {b}</span>)}</div><div className="play-bottom-note"><span>✳</span><p>Each completed mission earns 100 points. The <button onClick={()=>onNavigate('crates')}>50% volume goal</button> comes from the fill estimates you confirm in Crates.</p><button onClick={()=>onNavigate('score')}>Points & cash score ↗</button></div>
      </> : <>
        <div className="play-round-heading"><button className="play-back" onClick={goLobby}>← All missions</button><span>{missionPlayer?.name ?? 'No player assigned'} · {mission.area}</span></div>
        <div className="play-round-title"><div><span className="play-kicker">{mission.phase==='complete'?'MISSION COMPLETE':`${mission.plannedMinutes}-MINUTE MISSION`}</span><h1>{mission.phase==='complete'?'Mission complete':mission.title}</h1></div><span className="play-round-prize">{mission.phase==='complete'?'EARNED':'ON COMPLETION'}<b>+100 points</b></span></div>
        <div className="play-steps" aria-label="Photo mission progress">{['Before photo','Sort items','After photo'].map((label,index)=><div className={step>=index+1?'reached':''} key={label}><span>{step>index+1||mission.phase==='complete'?'✓':`0${index+1}`}</span>{label}</div>)}</div>
        {mission.phase==='before'&&<section className="play-round-grid">
          <PhotoCapture photo={mission.beforePhoto} label="Before photo" title="Take a before photo" subtitle="Photograph the area before you start. Take the after photo from the same place." busy={photoBusy} onFile={file=>void attach(file,'before')} />
          <aside className="play-coach"><span className="play-kicker">BEFORE YOU START</span><h2>Choose a small area<br />you can finish.</h2><ol>{template.tips.map(t=><li key={t}>{t}</li>)}</ol>{linked?.photo&&!mission.beforePhoto&&<button className="play-secondary" onClick={()=>patch(mission.id,{beforePhoto:linked.photo})}>Use {linked.code}’s saved photo</button>}<div className="play-time-ticket"><span>YOUR TIMER</span><b>{mission.plannedMinutes}<small>min</small></b><p>You can pause<br />at any time.</p></div><button className="play-primary" disabled={!mission.beforePhoto||photoBusy} onClick={start}>Start sorting <span>▶</span></button><p className="play-fine">Add the before photo first. Both photos will be saved with this mission.</p><button className="play-text-button" disabled={photoBusy} onClick={editBefore}>Edit mission & player</button></aside>
        </section>}
        {mission.phase==='active'&&<section className="play-active-grid">
          <div><div className="play-timer-card"><span className="play-kicker">{mission.runningSince===null?'TIMER PAUSED':remaining?'TIME REMAINING':'PLANNED TIME FINISHED'}</span><div className="play-timer"><b>{clock(remaining)}</b><span>{remaining?'left in your mission':'Finish when you are ready.'}</span></div><div className="play-timer-track"><i style={{width:`${Math.min(100,elapsed/(mission.plannedMinutes*60)*100)}%`}}/></div><button className="play-secondary" onClick={()=>{change(mission.id,m=>m.runningSince!==null?pauseMission(m,Date.now()):resumeMission(m,Date.now()));setNow(Date.now())}}>{mission.runningSince!==null?'Ⅱ Pause':'▶ Resume'}</button></div><div className="play-active-before"><img src={mission.beforePhoto!} alt="Your before photo for this round"/><span>YOUR STARTING POINT</span></div></div>
          <div className="play-action-panel"><span className="play-kicker">SORT AND COUNT YOUR ITEMS</span><h2>What did you do with it?</h2><p>After sorting an item, tap + in the right category. You can count related items as one group; use the same approach throughout this mission.</p><div className="play-counters">{countLabels.map(c=><div key={c.key} className={`play-counter ${c.key}`}><span className="play-counter-label"><i>{c.symbol}</i>{c.label}</span><div><button aria-label={`Remove one from ${c.label}`} disabled={mission[c.key]<=0} onClick={()=>change(mission.id,m=>({...m,[c.key]:Math.max(0,m[c.key]-1)}))}>−</button><b aria-live="polite">{mission[c.key]}</b><button aria-label={`Add one to ${c.label}`} disabled={mission[c.key]>=100000} onClick={()=>{change(mission.id,m=>({...m,[c.key]:m[c.key]+1}));if(soundOn)sound.tap()}}>+</button></div></div>)}</div><div className="play-coach-note"><b>Keep both car spaces clear.</b><p>Put approved waste in the Yellow Sack. Keep donations and items needing an owner decision in separate containers. Put the items you are keeping away.</p></div><button className="play-primary" onClick={()=>{change(mission.id,m=>reviewMission(m,Date.now()));setNow(Date.now())}}>Take after photo <CameraIcon /></button><p className="play-fine">You can finish early. Items in the sack or donation box still occupy space until they leave the property.</p></div>
        </section>}
        {mission.phase==='review'&&<section className="play-round-grid">
          <div><PhotoCapture photo={mission.afterPhoto} label="After photo" title="Take an after photo" subtitle="Stand where you took the before photo. Show the area you sorted and leave the parking boundary clear." busy={photoBusy} onFile={file=>void attach(file,'after')} /><div className="play-before-guide"><img src={mission.beforePhoto!} alt="Before photo to match your framing"/><p>Use the same angle.<br /><b>Your before photo</b></p></div></div>
          <aside className="play-finish-panel"><span className="play-kicker">REVIEW AND FINISH</span><h2>What changed?</h2><p>Describe what you put away, removed, or decided.</p><label>What changed in this mission?<textarea aria-label="Round result" maxLength={4000} rows={4} value={resultText} placeholder="Cleared the tool corner. Cables are back in their crate; one box is ready to donate." onChange={e=>{setResultDraft({id:mission.id,text:e.target.value});patch(mission.id,{summary:e.target.value.trim()})}}/></label><div className="play-round-counts">{countLabels.map(c=><span key={c.key}><b>{mission[c.key]}</b>{c.verb}</span>)}</div><label className="play-parking-check"><input type="checkbox" checked={mission.parkingClear} onChange={e=>patch(mission.id,{parkingClear:e.target.checked})}/><span>I’ve finished sorting, put everything in its place, and left both car spaces and access routes clear.</span></label><button className="play-primary" disabled={!mission.afterPhoto||!resultText.trim()||!mission.parkingClear||photoBusy} onClick={finish}>Finish mission <span>✦ +100 points</span></button><button className="play-text-button" disabled={photoBusy} onClick={()=>change(mission.id,m=>m.phase==='review'?resumeMission({...m,phase:'active',parkingClear:false,afterPhoto:null},Date.now()):m)}>← Continue sorting</button></aside>
        </section>}
        {mission.phase==='complete'&&<section className="play-complete"><div className="play-victory-banner"><span className="play-victory-star">✦</span><div><span className="play-kicker">BEFORE AND AFTER SAVED</span><h2>{mission.summary}</h2><p>{mission.area} · {clock(missionElapsedSeconds(mission))} on the timer · +100 points recorded once</p></div><div className="play-victory-level"><span>LEVEL</span><b>{score.level}</b></div></div><section className="play-cash-review" aria-label="Mission points and cash review"><div><h3>100 points earned{missionPlayer ? ` for ${missionPlayer.name}` : ''}.</h3><p>{!rewards ? 'Cash rewards are not set up. Your mission points are saved separately.' : !missionEntry ? 'No player is assigned to this mission. John can review its player and cash reward in Score.' : missionEntry.paidAt!==null ? 'Cash payment is recorded in Score.' : missionEntry.approvedAt!==null ? 'John has approved this mission. Check Score for its cash allocation and payment status.' : 'Cash needs John’s review. Finishing this mission does not approve a payment.'}</p></div><button type="button" className="play-primary" onClick={()=>onNavigate('score')}>View points & cash score →</button></section><div className="play-badges" aria-label="Earned photo mission badges">{score.badges.map(b=><span key={b}>✦ {b}</span>)}</div><BeforeAfter before={mission.beforePhoto!} after={mission.afterPhoto!}/><div className="play-finish-actions"><div><h3>Your mission is saved.</h3><p>Compare your photos to see what changed. If you sorted a crate, confirm its new fill in Crates to update the volume goal.</p></div><button className="play-primary" onClick={goLobby}>Choose another mission ↗</button></div>{mission.crateId&&<button className="play-crate-bridge" onClick={()=>onOpenCrate(mission.crateId!)}><GarageIcon name="crate" className="play-choice-icon"/><div><b>Finish {workspace.data.crates.find(c=>c.id===mission.crateId)?.code || 'this crate'}’s inventory and fill check.</b><p>Your photo mission is complete. Open Crates to record its contents and confirm the new fill estimate.</p></div><span>→</span></button>}</section>}
      </>}
      {message&&<div className="play-message" role="status">{message}</div>}
    </main>
  </div>
}

function CameraIcon(){return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 6.5h4l1.5-3h7l1.5 3h4v14H3z"/><circle cx="12" cy="13" r="4"/></svg>}
function PhotoCapture({photo,label,title,subtitle,busy,onFile}:{photo:string|null;label:string;title:string;subtitle:string;busy:boolean;onFile:(file:File|undefined)=>void}){
  return <div className={`play-photo-capture ${photo?'has-photo':''}`} aria-busy={busy}>{photo?<img src={photo} alt={label}/>:<div className="play-camera-empty"><CameraIcon/><span>{label.toUpperCase()}</span><h2>{title}</h2><p>{subtitle}</p></div>}<div className="play-capture-controls"><label className={`play-primary ${busy?'busy':''}`}><CameraIcon/>{busy?'Saving photo…':`${photo?'Retake':'Take'} ${label.toLowerCase()}`}<input aria-label={`${label} camera`} type="file" accept="image/*" capture="environment" disabled={busy} onChange={e=>{onFile(e.target.files?.[0]);e.target.value=''}}/></label><label className={`play-photo-library ${busy?'busy':''}`}>Choose from photos<input aria-label={`${label} library`} type="file" accept="image/*" disabled={busy} onChange={e=>{onFile(e.target.files?.[0]);e.target.value=''}}/></label><small>{photo?'Photo saved with this mission':'Phone opens its camera or photo picker. Laptop opens files.'}</small></div></div>
}
function BeforeAfter({before,after}:{before:string;after:string}) {
  const [position,setPosition] = useState(50)
  const [view,setView] = useState<'wipe'|'side'>('wipe')
  return <div className="play-comparison"><div className="play-compare-heading"><h3>Compare your photos</h3><div><button aria-pressed={view==='wipe'} onClick={()=>setView('wipe')}>Slide to compare</button><button aria-pressed={view==='side'} onClick={()=>setView('side')}>Side by side</button></div></div>{view==='wipe'?<><div className="play-compare-image"><img src={before} alt="Before the cleanup round"/><img src={after} alt="After the cleanup round" style={{clipPath:`inset(0 0 0 ${position}%)`}}/><span className="before-label">BEFORE</span><span className="after-label">AFTER</span><div className="play-compare-divider" style={{left:`${position}%`}}><span>↔</span></div></div><label className="play-wipe-control">Move the slider to compare<input aria-label="Before and after comparison" type="range" min="0" max="100" value={position} onChange={e=>setPosition(Number(e.target.value))}/></label></>:<div className="play-side-photos"><figure><img src={before} alt="Before the cleanup round"/><figcaption>BEFORE</figcaption></figure><figure><img src={after} alt="After the cleanup round"/><figcaption>AFTER</figcaption></figure></div>}</div>
}
