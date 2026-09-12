import { ToolPage } from '../components/ToolPage'

export function TitleScreen({ onStart }: { onStart: () => void }) {
  return <ToolPage title="Let’s make some room." description="Choose one small area. Sort it. See your progress." icon="garage">
    <section className="tool-card tool-stack"><h2>Your garage, one step at a time.</h2><p>Take a photo, give each item a home, and keep both car spaces clear.</p><button className="tool-button" onClick={onStart}>Open your garage →</button></section>
  </ToolPage>
}
