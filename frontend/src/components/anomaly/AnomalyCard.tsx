import { memo, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, MapPin, Sparkles, TriangleAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Anomaly } from '@/types'
import { cn } from '@/utils/cn'
import { formatCurrency, formatEnergy, formatNumber, formatScore } from '@/utils/format'
import { formatDuration, formatShortDateTime, formatTimeRange } from '@/utils/date'
import { Badge, SeverityBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DeviationPill, MagnitudeBar } from '@/components/ui/DataDisplay'

export interface AnomalyCardProps {
  anomaly: Anomaly
  currency?: string
  /** Relative magnitude bar width — pass the largest excess in the list. */
  scaleMax?: number
  /** Renders the "Investigate" button. */
  onInvestigate?: (anomaly: Anomaly) => void
  /** Highlights cards that arrived via the realtime stream. */
  isLive?: boolean
  variant?: 'default' | 'compact'
  index?: number
  className?: string
  /** Overrides the default navigate-to-investigation behaviour. */
  footerExtra?: ReactNode
}

/**
 * ANOMALY CARD
 *
 * Expected / Actual / Excess / Estimated cost / Score, plus a deep link into
 * the Investigation Center. Every figure is rendered exactly as the API
 * reported it.
 */
function AnomalyCardComponent({
  anomaly,
  currency = 'INR',
  scaleMax,
  onInvestigate,
  isLive = false,
  variant = 'default',
  index = 0,
  className,
  footerExtra,
}: AnomalyCardProps) {
  const navigate = useNavigate()
  const compact = variant === 'compact'

  const deviationPercent =
    anomaly.expectedKwh > 0 ? (anomaly.excessKwh / anomaly.expectedKwh) * 100 : null

  const durationHours = Math.max(
    0.25,
    (Date.parse(anomaly.end) - Date.parse(anomaly.start)) / 3_600_000,
  )
  const excessPerHour = anomaly.excessKwh / durationHours

  const handleInvestigate = () => {
    if (onInvestigate) {
      onInvestigate(anomaly)
      return
    }
    navigate(`/investigations?anomaly=${anomaly.id}`)
  }

  const severityBorder =
    anomaly.severity === 'critical' || anomaly.severity === 'high'
      ? 'border-crit-500/25'
      : anomaly.severity === 'medium'
        ? 'border-alert-500/25'
        : 'border-flux-500/20'

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.035, ease: [0.22, 1, 0.36, 1] }}
      className={cn('glass glass-hover group relative overflow-hidden p-5', severityBorder, className)}
    >
      {/* Severity rail */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-0 left-0 w-[3px]',
          anomaly.severity === 'critical' || anomaly.severity === 'high'
            ? 'bg-gradient-to-b from-crit-400 to-crit-600'
            : anomaly.severity === 'medium'
              ? 'bg-gradient-to-b from-alert-300 to-alert-500'
              : 'bg-gradient-to-b from-flux-300 to-flux-600',
        )}
      />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-ink-50">{anomaly.reference}</h3>
            <SeverityBadge severity={anomaly.severity} pulse={anomaly.severity !== 'low'} />
            {isLive ? (
              <Badge tone="flux" pulse>
                <Sparkles size={9} />
                Live
              </Badge>
            ) : null}
            {anomaly.status !== 'new' ? (
              <Badge tone="neutral">{anomaly.status}</Badge>
            ) : null}
          </div>

          <p className="tnum mt-2 text-xs font-medium text-ink-200">
            {formatTimeRange(anomaly.start, anomaly.end)}
          </p>
          <p className="mt-0.5 text-2xs text-ink-500">
            {formatShortDateTime(anomaly.start)} · {formatDuration(anomaly.start, anomaly.end)}
          </p>
        </div>

        <div className="text-right">
          <div className="label-muted">Anomaly score</div>
          <div className="tnum mt-1 flex items-center justify-end gap-2">
            <span
              className={cn(
                'text-xl font-semibold leading-none',
                anomaly.score >= 0.9
                  ? 'text-crit-300'
                  : anomaly.score >= 0.75
                    ? 'text-alert-300'
                    : 'text-flux-300',
              )}
            >
              {formatScore(anomaly.score)}
            </span>
            {deviationPercent !== null ? <DeviationPill percent={deviationPercent} /> : null}
          </div>
        </div>
      </header>

      {!compact ? (
        <div className="mt-4">
          <MagnitudeBar
            value={anomaly.excessKwh}
            max={scaleMax ?? anomaly.excessKwh}
            tone={anomaly.severity === 'medium' ? 'alert' : 'crit'}
          />
        </div>
      ) : null}

      <dl className={cn('grid gap-x-4 gap-y-3', compact ? 'mt-4 grid-cols-2' : 'mt-4 grid-cols-2 sm:grid-cols-4')}>
        <Stat label="Expected" value={formatEnergy(anomaly.expectedKwh, 1)} />
        <Stat label="Actual" value={formatEnergy(anomaly.actualKwh, 1)} tone="flux" />
        <Stat label="Excess" value={formatEnergy(anomaly.excessKwh, 1)} tone="crit" />
        <Stat label="Estimated cost" value={formatCurrency(anomaly.estimatedCost, currency)} tone="alert" />
      </dl>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-ink-500">
          {anomaly.floorLabel ? (
            <span className="inline-flex items-center gap-1">
              <MapPin size={10} />
              {anomaly.floorLabel}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <TriangleAlert size={10} />
              Building-wide deviation
            </span>
          )}
          <span className="tnum">{formatNumber(excessPerHour, 1)} kWh/h avg excess</span>
        </div>

        <div className="flex items-center gap-2">
          {footerExtra}
          <Button
            variant="outline"
            size="sm"
            onClick={handleInvestigate}
            iconRight={<ArrowRight size={13} className="transition-transform duration-200 group-hover:translate-x-0.5" />}
          >
            Investigate
          </Button>
        </div>
      </footer>
    </motion.article>
  )
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'flux' | 'crit' | 'alert'
}) {
  const tones = {
    default: 'text-ink-100',
    flux: 'text-flux-300',
    crit: 'text-crit-300',
    alert: 'text-alert-300',
  } as const
  return (
    <div className="min-w-0">
      <dt className="text-2xs font-medium uppercase tracking-[0.12em] text-ink-500">{label}</dt>
      <dd className={cn('tnum mt-1 truncate text-sm font-semibold', tones[tone])}>{value}</dd>
    </div>
  )
}

export const AnomalyCard = memo(AnomalyCardComponent)
