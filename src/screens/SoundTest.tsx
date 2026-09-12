import { useState } from 'react'
import type { Tab } from '../App'
import { sound } from '../sound'
import { GarageIcon } from '../components/GarageIcons'
import { ToolPage } from '../components/ToolPage'
import './inventory-sound.css'

const previews: { name: string; description: string; play: () => void }[] = [
  { name: 'Task complete', description: 'A bright two-note chime.', play: () => sound.done() },
  { name: 'Small step', description: 'A short, quiet tick.', play: () => sound.subTick() },
  { name: 'Three in a row', description: 'A rising pair of notes.', play: () => sound.combo(3) },
  { name: 'Level reached', description: 'A short upward fanfare.', play: () => sound.levelUp() },
  { name: 'New rank', description: 'A longer celebration.', play: () => sound.rankUp() },
  { name: 'Achievement', description: 'A soft, sparkling chime.', play: () => sound.unlock() },
  { name: 'Daily mission', description: 'A quick victory melody.', play: () => sound.mission() },
  { name: 'Round complete', description: 'The full celebration tune.', play: () => sound.winner() },
  { name: 'Try again', description: 'A gentle descending tune.', play: () => sound.loser() },
  { name: 'Welcome back', description: 'Three warm, rising notes.', play: () => sound.comeback() },
  { name: 'Round starting', description: 'A four-note countdown.', play: () => sound.start() },
  { name: 'Selection', description: 'A quick confirmation.', play: () => sound.select() },
  { name: 'Back or cancel', description: 'Two short downward notes.', play: () => sound.back() },
  { name: 'Button tap', description: 'A subtle low note.', play: () => sound.tap() },
]

export function SoundTest({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const [muted, setMuted] = useState(sound.isMuted())

  return <ToolPage title="Sounds" description="Choose a little encouragement, or keep your cleanup quiet." icon="sound" actions={<button className="tool-button secondary" onClick={() => { sound.back(); onNavigate('home') }}>Back to Home</button>}>
    <section className={'tool-card sound-setting ' + (muted ? 'is-muted' : '')} aria-labelledby="sound-setting-title">
      <span className="sound-setting-icon"><GarageIcon name="sound" /></span>
      <div className="sound-setting-copy"><h2 id="sound-setting-title">{muted ? 'Sounds are off.' : 'Sounds are on.'}</h2><p className="tool-muted">Your sound preference is remembered in this browser.</p></div>
      <button className={'tool-button ' + (muted ? '' : 'secondary')} role="switch" aria-checked={!muted} aria-label="Cleanup sounds" onClick={() => { sound.toggle(); setMuted(sound.isMuted()) }}>{muted ? 'Turn sounds on' : 'Mute sounds'}</button>
    </section>

    <section className="tool-stack sound-preview-section" aria-labelledby="sound-preview-title">
      <div className="tool-section-heading"><h2 id="sound-preview-title">Preview sounds</h2><span className="tool-chip">{previews.length} sounds</span></div>
      <p className="tool-muted">{muted ? 'Turn sounds on to hear a preview.' : 'Tap a sound to hear it. Previews do not change your progress.'}</p>
      <div className="tool-grid sound-previews">
        {previews.map(preview => <button key={preview.name} className="sound-preview" disabled={muted} onClick={preview.play} aria-label={'Preview ' + preview.name.toLowerCase()}>
          <span className="sound-play-icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5a1 1 0 0 1 1.5-.86l10 6.5a1 1 0 0 1 0 1.72l-10 6.5A1 1 0 0 1 8 18.5Z" /></svg></span>
          <span><strong>{preview.name}</strong><span>{preview.description}</span></span>
        </button>)}
      </div>
    </section>
  </ToolPage>
}
