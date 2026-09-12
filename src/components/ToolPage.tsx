import type { ReactNode } from 'react'
import { GarageIcon } from './GarageIcons'
import type { GarageIconName } from './GarageIcons'
import './tools.css'

export function ToolPage({title, description, icon, children, actions, localData=false}: {
  title: string; description?: string; icon: GarageIconName; children: ReactNode; actions?: ReactNode; localData?: boolean
}) {
  return <main className="tool-page">
    <header className="tool-header"><span className="tool-header-icon"><GarageIcon name={icon}/></span><div className="tool-heading-copy"><p className="tool-eyebrow">GARAGE RESET</p><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="tool-header-actions">{actions}</div>}</header>
    {localData && <p className="tool-notice">These task and item records are saved on this device. Use Crates and Missions for records shared with your phone and laptop.</p>}
    <div className="tool-content">{children}</div>
  </main>
}
