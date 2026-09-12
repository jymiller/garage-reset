import { useEffect, useId, useRef, useState } from 'react'

export function ResetTaskList({ onReset }: { onReset: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const wasConfirming = useRef(false)
  const headingId = useId()
  const descriptionId = useId()

  useEffect(() => {
    if (!confirming && wasConfirming.current) trigger.current?.focus()
    wasConfirming.current = confirming
  }, [confirming])

  if (!confirming) return <button ref={trigger} type="button" className="tool-button danger" onClick={() => setConfirming(true)}>Reset local tasks and items</button>

  return <section className="tool-card tool-stack" role="group" aria-labelledby={headingId} aria-describedby={descriptionId} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); setConfirming(false) }
  }}>
    <h3 id={headingId}>Reset this device’s task progress?</h3>
    <p id={descriptionId}>This restores the original task list and removes local item records, task XP, and streaks on this device. Your shared photo missions and container inventory will stay saved. This reset cannot be undone.</p>
    <div className="tool-row">
      <button type="button" className="tool-button" autoFocus onClick={() => setConfirming(false)}>Keep my progress</button>
      <button type="button" className="tool-button danger" onClick={() => { setConfirming(false); onReset() }}>Reset local tasks and items</button>
    </div>
  </section>
}
