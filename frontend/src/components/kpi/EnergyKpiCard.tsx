import { memo, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber'

export type KpiTone = 'default' | 'flux' | 'watt' | 'alert' | 'crit' | 'iris'

const TONES: Record<KpiTone, { icon: string; glow: string; value: string }> = {
  default: { icon: 'text-ink-300 border-white/10 bg-white/[0.04]', glow: '', value: 'text-ink-50' },
  flux: { icon: 'text-flux-300 border-flux-400/25 bg-flux-500/10', glow: 'hover:shadow-glow-flux', value: 'text-ink-50' },
  watt: { icon: 'text-watt-300 border-watt-400/25 bg-watt-400/10', glow: '', value: 'text-ink-50' },
  alert: { icon: 'text-alert-300 border-alert-500/30 bg-alert-500/10', glow: 'hover:shadow-glow-alert', value: 'text-alert-300' },
  crit: { icon: 'text-crit-300 border-crit-500/30 bg-crit-500/10', glow: 'hover:shadow-glow-crit', value: 'text-crit-300' },
  iris: { icon: 'text-iris-300 border-iris-400/25 bg-iris-400/10', glow: '', value: 'text-ink-50' },
}

export interface EnergyKpiCardProps {
  label: string
  value: number
  /** Decimal places for the animated readout. */
  precision?: number
  /** Suffix rendered after the number, e.g. "kWh". */
  unit?: string
  /** Full formatter override (used for currency). */
  format?: (value: number) => string
  icon: ReactNode
  tone?: KpiTone
  /** Period-over-period change reported by the backend. */
  deltaPercent?: number | null
  /** Set when a rising delta is a *bad* thing (cost, excess). */
  invertDelta?: boolean
  hint?: ReactNode
  /** Optional mini-series for the inline sparkline. */
  spark?: number[]
  className?: string
  onClick?: () => void
  index?: number
}

/**
 * KPI card with an eased numeric transition.
 *
 * All numbers come from the API. The only client-side behaviour is the
 * count-up animation between values.
 */
function EnergyKpiCardComponent({
  label,
  value,
  precision = 0,
  unit,
  format,
  icon,
  tone = 'default',
  deltaPercent,
  invertDelta = false,
  hint,
  spark,
  className,
  onClick,
  index = 0,
}: EnergyKpiCardProps) {
  const animated = useAnimatedNumber(Number.isFinite(value) ? value : 0)
  const styles = TONES[tone]

  const display = format
    ? format(animated)
    : new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      }).format(animated)

  const hasDelta = deltaPercent !== null && deltaPercent !== undefined && Number.isFinite(deltaPercent)
  const rising = hasDelta && (deltaPercent as number) > 0
  const flat = hasDelta && Math.abs(deltaPercent as number) < 0.05
  const good = hasDelta ? (invertDelta ? !rising : rising) : true

  const DeltaIcon = flat ? Minus : rising ? ArrowUpRight : ArrowDownRight

  const shellClass = cn(
    'glass glass-hover group h-full p-5 text-left transition-shadow duration-300',
    styles.glow,
    onClick && 'cursor-pointer',
  )

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-muted truncate">{label}</p>

          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className={cn('tnum text-[1.75rem] font-semibold leading-none tracking-tight', styles.value)}>
              {display}
            </span>
            {unit ? <span className="text-xs font-medium text-ink-500">{unit}</span> : null}
          </div>
        </div>

        <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl border', styles.icon)}>
          {icon}
        </span>
      </div>

      {hasDelta || hint ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {hasDelta ? (
            <span
              className={cn(
                'tnum inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-2xs font-semibold',
                flat
                  ? 'bg-white/[0.05] text-ink-400'
                  : good
                    ? 'bg-watt-400/10 text-watt-300'
                    : 'bg-crit-500/10 text-crit-300',
              )}
            >
              <DeltaIcon size={11} />
              {Math.abs(deltaPercent as number).toFixed(1)}%
            </span>
          ) : null}
          {hint ? <span className="truncate text-2xs text-ink-500">{hint}</span> : null}
        </div>
      ) : null}

      {spark && spark.length > 1 ? <Sparkline values={spark} tone={tone} /> : null}
    </>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className={cn('h-full', className)}
    >
      {onClick ? (
        <button type="button" onClick={onClick} className={shellClass}>
          {body}
        </button>
      ) : (
        <div className={shellClass}>{body}</div>
      )}
    </motion.div>
  )
}

/** Lightweight CSS sparkline — avoids mounting another chart library instance. */
function Sparkline({ values, tone }: { values: number[]; tone: KpiTone }) {
  const max = Math.max(...values, 1)
  const colour =
    tone === 'crit'
      ? 'bg-crit-400/60'
      : tone === 'alert'
        ? 'bg-alert-400/60'
        : tone === 'watt'
          ? 'bg-watt-400/60'
          : 'bg-flux-400/60'

  return (
    <div className="mt-4 flex h-8 items-end gap-[3px]" aria-hidden="true">
      {values.slice(-28).map((value, index) => (
        <span
          key={index}
          className={cn('flex-1 rounded-t-[2px] transition-all duration-500', colour)}
          style={{ height: `${Math.max(8, (value / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

export const EnergyKpiCard = memo(EnergyKpiCardComponent)
