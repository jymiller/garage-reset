export function ProgressBar({
  pct,
  color = '#2bd14a',
  className = '',
}: {
  pct: number
  color?: string
  className?: string
}) {
  return (
    <div className={`arc-bar ${className}`} style={{ borderColor: color }}>
      <div
        className="h-full"
        style={{
          width: `${pct}%`,
          background: `repeating-linear-gradient(90deg, ${color} 0 9px, #0d0d18 9px 12px)`,
          transition: 'width 0.4s steps(8)',
        }}
      />
    </div>
  )
}
