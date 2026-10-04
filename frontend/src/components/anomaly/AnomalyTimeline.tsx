import { memo } from 'react'
import { motion } from 'framer-motion'
import { Activity, ArrowDownToLine, CircleDot, Flag, TrendingUp } from 'lucide-react'
import type { TimelineEvent, TimelineEventKind } from '@/types'
import { cn } from '@/utils/cn'
import { formatTime } from '@/utils/date'

const KIND_META: Record<
  TimelineEventKind,
  { label: string; icon: typeof CircleDot; dot: string; text: string; ring: string }
> = {
  normal: {
    label: 'Normal',
    icon: CircleDot,
    dot: 'bg-watt-400',
    text: 'text-watt-300',
    ring: 'ring-watt-400/20',
  },
  anomaly_start: {
    label: 'Anomaly started',
    icon: Flag,
    dot: 'bg-alert-400',
    text: 'text-alert-300',
    ring: 'ring-alert-500/25',
  },
  peak: {
    label: 'Peak deviation',
    icon: TrendingUp,
    dot: 'bg-crit-400',
    text: 'text-crit-300',
    ring: 'ring-crit-500/25',
  },
  normalised: {
    label: 'Normalized',
    icon: ArrowDownToLine,
    dot: 'bg-flux-400',
    text: 'text-flux-300',
    ring: 'ring-flux-500/20',
  },
  info: {
    label: 'Info',
    icon: Activity,
    dot: 'bg-ink-400',
    text: 'text-ink-300',
    ring: 'ring-white/10',
  },
}

export interface AnomalyTimelineProps {
  events: TimelineEvent[]
  className?: string
  /** Horizontal layout is used on wide screens, vertical on mobile. */
  orientation?: 'vertical' | 'auto'
}

/**
 * ANOMALY TIMELINE
 *
 * 18:00 Normal → 20:00 Normal → 22:00 Anomaly Started → 23:00 Peak → 00:00 Normalized
 *
 * Events come from `GET /api/anomalies/{id}/investigation`.
 */
function AnomalyTimelineComponent({ events, className }: AnomalyTimelineProps) {
  if (events.length === 0) {
    return (
      <p className={cn('py-6 text-center text-xs text-ink-500', className)}>
        No timeline events were reported for this anomaly.
      </p>
    )
  }

  return (
    <ol className={cn('relative', className)}>
      {/* Spine */}
      <span
        aria-hidden="true"
        className="absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-white/5 via-white/12 to-white/5 sm:left-[13px]"
      />

      {events.map((event, index) => {
        const meta = KIND_META[event.kind] ?? KIND_META.info
        const Icon = meta.icon
        const isPeak = event.kind === 'peak'

        return (
          <motion.li
            key={event.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex gap-3 pb-5 pl-0 last:pb-0 sm:gap-4"
          >
            <span className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
              <span
                className={cn(
                  'absolute inset-0 rounded-full ring-4 ring-base-950',
                  isPeak && 'animate-pulse',
                )}
              />
              <span
                className={cn(
                  'grid h-[22px] w-[22px] place-items-center rounded-full ring-1',
                  meta.dot,
                  meta.ring,
                )}
              >
                <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-base-950">
                  <Icon size={11} className={meta.text} />
                </span>
              </span>
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <span className="tnum text-2xs font-semibold text-ink-400">{formatTime(event.timestamp)}</span>
                <span className={cn('text-xs font-semibold', meta.text)}>{event.label || meta.label}</span>
                {typeof event.deviationPercent === 'number' && Math.abs(event.deviationPercent) > 0.5 ? (
                  <span
                    className={cn(
                      'tnum rounded px-1.5 py-0.5 text-[10px] font-semibold',
                      event.deviationPercent > 0
                        ? 'bg-crit-500/10 text-crit-300'
                        : 'bg-watt-400/10 text-watt-300',
                    )}
                  >
                    {event.deviationPercent > 0 ? '+' : ''}
                    {event.deviationPercent.toFixed(1)}%
                  </span>
                ) : null}
              </div>
              {event.detail ? (
                <p className="mt-1 text-2xs leading-relaxed text-ink-400">{event.detail}</p>
              ) : null}
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}

export const AnomalyTimeline = memo(AnomalyTimelineComponent)
