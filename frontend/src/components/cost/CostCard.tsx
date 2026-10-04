import { memo, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Info } from 'lucide-react'
import { cn } from '@/utils/cn'

export type CostTone = 'default' | 'crit' | 'alert' | 'flux' | 'iris'

const TONES: Record<CostTone, { value: string; rail: string; chip: string }> = {
  default: { value: 'text-ink-50', rail: 'from-flux-400/70 to-flux-600/30', chip: 'text-ink-400' },
  crit: { value: 'text-crit-300', rail: 'from-crit-500/80 to-crit-600/20', chip: 'text-crit-300' },
  alert: { value: 'text-alert-300', rail: 'from-alert-400/80 to-alert-500/20', chip: 'text-alert-300' },
  flux: { value: 'text-flux-300', rail: 'from-flux-500/80 to-flux-600/20', chip: 'text-flux-300' },
  iris: { value: 'text-iris-300', rail: 'from-iris-400/80 to-iris-500/20', chip: 'text-iris-300' },
}

export interface CostCardProps {
  label: string
  value: string
  /** Sub-label such as the window the figure covers. */
  caption?: ReactNode
  icon?: ReactNode
  tone?: CostTone
  /** Renders a proportion bar (0–100). */
  proportion?: number
  /** Disclaimers rendered under the figure. */
  note?: string
  index?: number
  className?: string
  onClick?: () => void
}

/**
 * Cost figure card.
 *
 * Language is deliberately conservative — "estimated excess cost" only. The
 * `note` prop surfaces the backend disclaimer verbatim.
 */
function CostCardComponent({
  label,
  value,
  caption,
  icon,
  tone = 'default',
  proportion,
  note,
  index = 0,
  className,
  onClick,
}: CostCardProps) {
  const styles = TONES[tone]

  const shellClass = cn(
    'glass glass-hover relative h-full overflow-hidden p-5 text-left',
    onClick && 'cursor-pointer',
  )

  const body = (
    <>
      <span
        aria-hidden="true"
        className={cn('absolute inset-x-0 top-0 h-px bg-gradient-to-r', styles.rail)}
      />

      <div className="flex items-start justify-between gap-3">
        <p className="label-muted">{label}</p>
        {icon ? <span className="shrink-0 text-ink-500">{icon}</span> : null}
      </div>

      <p className={cn('tnum mt-3 text-[1.6rem] font-semibold leading-none tracking-tight', styles.value)}>
        {value}
      </p>

      {caption ? <p className="mt-2 text-2xs text-ink-400">{caption}</p> : null}

      {typeof proportion === 'number' ? (
        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={cn(
                'h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-spring',
                styles.rail,
              )}
              style={{ width: `${Math.max(0, Math.min(100, proportion))}%` }}
            />
          </div>
        </div>
      ) : null}

      {note ? (
        <p className="mt-4 flex items-start gap-1.5 border-t border-white/[0.06] pt-3 text-[10px] leading-relaxed text-ink-500">
          <Info size={10} className="mt-0.5 shrink-0" />
          {note}
        </p>
      ) : null}
    </>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
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

export const CostCard = memo(CostCardComponent)
