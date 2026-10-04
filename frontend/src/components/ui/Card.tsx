import type { HTMLAttributes, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** Adds hover affordance — use for interactive cards only. */
  interactive?: boolean
  /** Luminous border tint tied to a semantic state. */
  tone?: 'default' | 'flux' | 'alert' | 'crit' | 'watt'
  padded?: boolean
}

const TONES = {
  default: '',
  flux: 'border-flux-400/25 shadow-glow-flux',
  alert: 'border-alert-500/25 shadow-glow-alert',
  crit: 'border-crit-500/25 shadow-glow-crit',
  watt: 'border-watt-400/25',
} as const

export function Card({
  children,
  interactive = false,
  tone = 'default',
  padded = true,
  className,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        'glass',
        padded && 'p-5',
        TONES[tone],
        interactive && 'glass-hover cursor-pointer',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  className?: string
}

export function CardHeader({ title, subtitle, icon, actions, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-flux-300">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink-50">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs leading-relaxed text-ink-400">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/** Numeric readout block used inside cards. */
export function MetricBlock({
  label,
  value,
  hint,
  tone = 'default',
  className,
}: {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  tone?: 'default' | 'alert' | 'crit' | 'flux'
  className?: string
}) {
  const tones = {
    default: 'text-ink-50',
    flux: 'text-flux-300',
    alert: 'text-alert-300',
    crit: 'text-crit-300',
  } as const
  return (
    <div className={cn('min-w-0', className)}>
      <div className="label-muted">{label}</div>
      <div className={cn('tnum mt-1 text-lg font-semibold tracking-tight', tones[tone])}>{value}</div>
      {hint ? <div className="mt-0.5 text-2xs text-ink-500">{hint}</div> : null}
    </div>
  )
}

/** Framer-motion container for staggered lists. Respect reduced motion. */
export function StaggerList({
  children,
  className,
  delay = 0.04,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
        },
      }}
    >
      {children}
    </motion.div>
  )
}
