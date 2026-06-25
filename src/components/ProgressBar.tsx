export function ProgressBar({
  pct,
  bar = 'bg-emerald-500',
  className = '',
}: {
  pct: number
  bar?: string
  className?: string
}) {
  return (
    <div className={`h-3 w-full overflow-hidden rounded-full bg-slate-200 ${className}`}>
      <div
        className={`h-full rounded-full ${bar} transition-all duration-500 ease-out`}
        style={{ width: `${Math.max(pct, pct > 0 ? 6 : 0)}%` }}
      />
    </div>
  )
}
