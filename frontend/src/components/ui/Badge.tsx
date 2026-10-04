import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'
import type { Severity } from '@/types'
import { SEVERITY_LABEL, SEVERITY_STYLES } from '@/utils/format'

type Tone = 'neutral' | 'flux' | 'watt' | 'alert' | 'crit' | 'iris'

const TONES: Record<Tone, string> = {
  neutral: 'bg-white/[0.05] text-ink-300 border-white/10',
  flux: 'bg-flux-500/10 text-flux-300 border-flux-500/25',
  watt: 'bg-watt-400/10 text-watt-300 border-watt-400/25',
  alert: 'bg-alert-500/10 text-alert-300 border-alert-500/25',
  crit: 'bg-crit-500/10 text-crit-300 border-crit-500/25',
  iris: 'bg-iris-400/10 text-iris-300 border-iris-400/25',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  icon?: ReactNode
  pulse?: boolean
  children: ReactNode
}

export function Badge({ tone = 'neutral', icon, pulse = false, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-2xs font-semibold uppercase tracking-[0.1em]',
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {pulse ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      ) : null}
      {icon}
      {children}
    </span>
  )
}

/** Severity pill with a leading severity dot. */
export function SeverityBadge({
  severity,
  pulse = false,
  className,
}: {
  severity: Severity
  pulse?: boolean
  className?: string
}) {
  const styles = SEVERITY_STYLES[severity]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-2xs font-semibold uppercase tracking-[0.1em]',
        styles.bg,
        styles.text,
        styles.border,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', styles.dot, pulse && 'animate-pulse')} />
      {SEVERITY_LABEL[severity]}
    </span>
  )
}

/** Pill-shaped segment group used for filters and toggles. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
  ariaLabel,
}: {
  options: Array<{ value: T; label: string; icon?: ReactNode }>
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  className?: string
  ariaLabel?: string
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-xl border border-white/[0.07] bg-white/[0.03] p-1',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg font-medium transition duration-200',
              size === 'sm' ? 'h-7 px-2.5 text-2xs' : 'h-8 px-3 text-xs',
              active
                ? 'bg-flux-500/15 text-flux-200 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.3)]'
                : 'text-ink-400 hover:bg-white/[0.05] hover:text-ink-200',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
