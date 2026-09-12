import { useId, useState } from 'react'
import type { PersonId, ZoneId, Decision } from '../types'
import { useStore } from '../store'
import { people, zones, personName, zoneName } from '../data'
import { GarageIcon } from '../components/GarageIcons'
import { ToolPage } from '../components/ToolPage'
import './inventory-sound.css'

const decisions: Decision[] = ['undecided', 'keep', 'move', 'donate', 'trash']
const decisionLabels: Record<Decision, string> = {
  undecided: 'Decide later', keep: 'Keep', move: 'Move to another area', donate: 'Donate', trash: 'Trash',
}

export function Capture() {
  const { items, addItem, setItemDecision, deleteItem } = useStore()
  const formId = useId()
  const [name, setName] = useState('')
  const [owner, setOwner] = useState<PersonId | null>(null)
  const [zone, setZone] = useState<ZoneId | null>(null)
  const [decision, setDecision] = useState<Decision>('undecided')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const undecided = items.filter(item => item.decision === 'undecided').length

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    addItem({ name: trimmed, owner, zone, decision })
    setName('')
    setDecision('undecided')
    setMessage('Added ' + trimmed + ' to the item list.')
  }

  return <ToolPage title="Item list" description="Keep track of loose items and decide where they belong." icon="crate" localData>
    <div className="tool-stats" aria-label="Item list summary">
      <div className="tool-stat"><span>Items listed</span><strong>{items.length}</strong></div>
      <div className="tool-stat"><span>Still to decide</span><strong>{undecided}</strong></div>
      <div className="tool-stat"><span>Decisions made</span><strong>{items.length - undecided}</strong></div>
    </div>

    <div className="inventory-layout">
      <section className="tool-card inventory-add" aria-labelledby={formId + '-heading'}>
        <div className="tool-section-heading"><h2 id={formId + '-heading'}>Add an item</h2></div>
        <p className="tool-muted">A name is enough to start. Add an owner, area, or decision when you know.</p>
        <form className="inventory-form" onSubmit={event => { event.preventDefault(); submit() }}>
          <label htmlFor={formId + '-name'}>Item name
            <input id={formId + '-name'} value={name} onChange={event => setName(event.target.value)} placeholder="For example, folding chair" required />
          </label>
          <div className="tool-grid inventory-fields">
            <label htmlFor={formId + '-owner'}>Owner
              <select id={formId + '-owner'} value={owner ?? ''} onChange={event => setOwner((event.target.value || null) as PersonId | null)}>
                <option value="">Unassigned</option>
                {people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </label>
            <label htmlFor={formId + '-area'}>Area
              <select id={formId + '-area'} value={zone ?? ''} onChange={event => setZone((event.target.value || null) as ZoneId | null)}>
                <option value="">Not chosen yet</option>
                {zones.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
              </select>
            </label>
          </div>
          <label htmlFor={formId + '-decision'}>Decision
            <select id={formId + '-decision'} value={decision} onChange={event => setDecision(event.target.value as Decision)}>
              {decisions.map(value => <option key={value} value={value}>{decisionLabels[value]}</option>)}
            </select>
          </label>
          <button className="tool-button inventory-submit" type="submit" disabled={!name.trim()}>Add item <span aria-hidden="true">+</span></button>
          <p className="inventory-feedback" role="status">{message}</p>
        </form>
      </section>

      <section className="tool-stack inventory-list" aria-labelledby={formId + '-list-heading'}>
        <div className="tool-section-heading"><h2 id={formId + '-list-heading'}>Your items</h2><span className="tool-chip">{items.length}</span></div>
        {items.length === 0 ? <div className="tool-card inventory-empty">
          <span className="inventory-empty-icon"><GarageIcon name="crate" /></span>
          <h3>Start with one thing.</h3>
          <p className="tool-muted">Add an item you found while sorting. You can decide what to do with it now or come back later.</p>
        </div> : items.map(item => <article key={item.id} className="tool-card inventory-item">
          <div className="inventory-item-heading"><h3>{item.name}</h3><span className={'inventory-decision-dot ' + item.decision} aria-hidden="true" /></div>
          <dl className="inventory-item-meta">
            <div><dt>Owner</dt><dd>{item.owner ? personName(item.owner) : 'Unassigned'}</dd></div>
            <div><dt>Area</dt><dd>{zoneName(item.zone)}</dd></div>
          </dl>
          <div className="inventory-item-controls">
            <label htmlFor={formId + '-decision-' + item.id}>Decision
              <select id={formId + '-decision-' + item.id} aria-label={'Decision for ' + item.name} value={item.decision} onChange={event => setItemDecision(item.id, event.target.value as Decision)}>
                {decisions.map(value => <option key={value} value={value}>{decisionLabels[value]}</option>)}
              </select>
            </label>
            {pendingDelete !== item.id && <button type="button" className="tool-button secondary inventory-delete" onClick={() => setPendingDelete(item.id)} aria-label={'Delete ' + item.name}>Delete</button>}
          </div>
          {pendingDelete === item.id && <div className="inventory-delete-confirm" role="group" aria-label={'Confirm deletion of ' + item.name}>
            <p>Delete this item from the list?</p>
            <div className="tool-row">
              <button className="tool-button danger" type="button" onClick={() => { deleteItem(item.id); setPendingDelete(null); setMessage('Deleted ' + item.name + ' from the item list.') }}>Delete item</button>
              <button className="tool-button secondary" type="button" autoFocus onClick={() => setPendingDelete(null)}>Cancel</button>
            </div>
          </div>}
        </article>)}
      </section>
    </div>
  </ToolPage>
}
