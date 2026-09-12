export function ProgressBar({pct, color = '#62834c', className = ''}: {pct:number;color?:string;className?:string}) {
  const value=Number.isFinite(pct)?Math.max(0,Math.min(100,pct)):0
  return <div className={`tool-meter ${className}`} role="progressbar" aria-label="Task progress" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
    <div className="tool-meter-fill" style={{width:`${value}%`,backgroundColor:color}}/>
  </div>
}
