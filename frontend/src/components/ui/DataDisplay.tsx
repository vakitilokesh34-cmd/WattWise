import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export function ProgressBar({
  value,
  className,
  tone = 'flux',
  showGlow = true,
  height = 'h-1.5',
}: {
  /** Omit for an indeterminate bar (used while a request is in flight). */
  value?: number
  className?: string
  tone?: 'flux' | 'alert' | 'crit' | 'watt'
  showGlow?: boolean
  height?: string
}) {
  const tones = {
    flux: 'from-flux-500 to-flux-300',
    watt: 'from-watt-500 to-watt-300',
    alert: 'from-alert-500 to-alert-300',
    crit: 'from-crit-600 to-crit-400',
  } as const

  const indeterminate = value === undefined || !Number.isFinite(value)
  const clamped = indeterminate ? 0 : Math.max(0, Math.min(100, value))

  return (
    <div
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('relative w-full overflow-hidden rounded-full bg-white/[0.06]', height, className)}
    >
      {indeterminate ? (
        <div
          className={cn(
            'absolute inset-y-0 w-2/5 animate-shimmer rounded-full bg-gradient-to-r',
            tones[tone],
            showGlow && 'shadow-[0_0_12px_-2px_currentColor]',
          )}
        />
      ) : (
        <div
          className={cn(
            'relative h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-spring',
            tones[tone],
            showGlow && 'shadow-[0_0_12px_-2px_currentColor]',
          )}
          style={{ width: `${clamped}%` }}
        />
      )}
    </div>
  )
}

/** Horizontal magnitude bar used in lists (excess energy per anomaly, etc.). */
export function MagnitudeBar({
  value,
  max,
  tone = 'flux',
  className,
}: {
  value: number
  max: number
  tone?: 'flux' | 'alert' | 'crit' | 'watt'
  className?: string
}) {
  const pct = max > 0 ? Math.max(2, Math.min(100, (value / max) * 100)) : 0
  const tones = {
    flux: 'bg-flux-400/70',
    watt: 'bg-watt-400/70',
    alert: 'bg-alert-400/70',
    crit: 'bg-crit-400/80',
  } as const
  return (
    <div className={cn('h-1 w-full overflow-hidden rounded-full bg-white/[0.06]', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-spring', tones[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/** Deviation pill: +X% above baseline. */
export function DeviationPill({
  percent,
  className,
}: {
  percent: number | null | undefined
  className?: string
}) {
  if (percent === null || percent === undefined || !Number.isFinite(percent)) {
    return <span className={cn('text-2xs text-ink-500', className)}>—</span>
  }
  const positive = percent >= 0
  return (
    <span
      className={cn(
        'tnum inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-semibold',
        positive ? 'bg-crit-500/10 text-crit-300' : 'bg-watt-400/10 text-watt-300',
        className,
      )}
    >
      {positive ? '+' : ''}
      {percent.toFixed(1)}%
    </span>
  )
}

export function KeyValueRow({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  tone?: 'default' | 'alert' | 'crit' | 'flux'
}) {
  const tones = {
    default: 'text-ink-50',
    flux: 'text-flux-300',
    alert: 'text-alert-300',
    crit: 'text-crit-300',
  } as const
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] py-2.5 last:border-0">
      <div className="min-w-0">
        <div className="text-2xs font-medium uppercase tracking-[0.12em] text-ink-500">{label}</div>
        {hint ? <div className="mt-0.5 text-2xs text-ink-500">{hint}</div> : null}
      </div>
      <div className={cn('tnum shrink-0 text-right text-sm font-semibold', tones[tone])}>{value}</div>
    </div>
  )
}
