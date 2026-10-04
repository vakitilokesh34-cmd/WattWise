import { memo } from 'react'
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  HelpCircle,
  Info,
  Layers,
  Lightbulb,
  Loader2,
  Receipt,
  TrendingUp,
  Wrench,
} from 'lucide-react'
import type { Investigation } from '@/types'
import { cn } from '@/utils/cn'
import {
  FACTOR_CATEGORY_LABEL,
  formatCurrency,
  formatEnergy,
  formatPercent,
  formatScore,
} from '@/utils/format'
import { formatDateTime, formatDuration, formatTimeRange } from '@/utils/date'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge, SeverityBadge } from '@/components/ui/Badge'
import { KeyValueRow, ProgressBar } from '@/components/ui/DataDisplay'
import { AnomalyTimeline } from '@/components/anomaly/AnomalyTimeline'
import { ErrorState } from '@/components/ui/States'

const FACTOR_ICONS: Record<string, typeof Lightbulb> = {
  hvac: Layers,
  lighting: Lightbulb,
  equipment: Wrench,
  operation: CalendarClock,
  occupancy: TrendingUp,
  data: Receipt,
}

const EVIDENCE_TONES: Record<string, string> = {
  metric: 'text-flux-300 border-flux-500/25 bg-flux-500/8',
  baseline: 'text-iris-300 border-iris-400/25 bg-iris-400/8',
  correlation: 'text-alert-300 border-alert-500/25 bg-alert-500/8',
  context: 'text-ink-300 border-white/10 bg-white/[0.04]',
}

const FACTOR_STATUS: Record<string, { label: string; className: string }> = {
  unverified: { label: 'Unverified', className: 'text-ink-400 bg-white/[0.05] border-white/10' },
  corroborated: { label: 'Corroborated', className: 'text-watt-300 bg-watt-400/10 border-watt-400/25' },
  ruled_out: { label: 'Ruled out', className: 'text-ink-500 bg-white/[0.03] border-white/5 line-through' },
}

export interface InvestigationPanelProps {
  investigation: Investigation | undefined
  loading: boolean
  error: unknown
  onRetry?: () => void
  buildingName: string
  className?: string
}

/**
 * INVESTIGATION CENTER detail panel.
 *
 * Shows *what* the deviation was and *what to check* — never an asserted root
 * cause. Every factor is labelled with its verification status.
 */
function InvestigationPanelComponent({
  investigation,
  loading,
  error,
  onRetry,
  buildingName,
  className,
}: InvestigationPanelProps) {
  if (loading) return <InvestigationSkeleton />

  if (error) {
    return (
      <ErrorState
        error={error as Error}
        onRetry={onRetry}
        title="Investigation unavailable"
      />
    )
  }

  if (!investigation) {
    return (
      <Card className={className}>
        <div className="flex flex-col items-center py-10 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-ink-400">
            <ClipboardList size={18} />
          </span>
          <h3 className="mt-4 text-sm font-semibold text-ink-100">Select an anomaly to investigate</h3>
          <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-ink-400">
            Choose an anomaly from the list to load its evidence, timeline and recommended checks.
          </p>
        </div>
      </Card>
    )
  }

  const deviationPercent =
    investigation.expectedKwh > 0
      ? (investigation.excessKwh / investigation.expectedKwh) * 100
      : 0

  return (
    <div className={cn('space-y-4', className)}>
      {/* ── Header ─────────────────────────────────────────── */}
      <Card tone={investigation.severity === 'medium' ? 'alert' : investigation.severity === 'low' ? 'flux' : 'crit'}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-ink-50">{investigation.reference}</h2>
              <SeverityBadge severity={investigation.severity} pulse={investigation.severity !== 'low'} />
              <Badge tone="neutral">Model {investigation.modelVersion}</Badge>
            </div>
            <p className="mt-2 text-xs text-ink-300">{buildingName}</p>
            <p className="tnum mt-0.5 text-2xs text-ink-500">
              {formatDateTime(investigation.start)} → {formatTimeRange(investigation.start, investigation.end)} ·{' '}
              {formatDuration(investigation.start, investigation.end)}
            </p>
          </div>

          <div className="text-right">
            <div className="label-muted">Anomaly score</div>
            <div className="tnum mt-1 text-2xl font-semibold leading-none text-ink-50">
              {formatScore(investigation.score)}
            </div>
            <div className="tnum mt-1.5 text-2xs text-ink-400">
              {formatPercent(deviationPercent, 0)} above baseline
            </div>
          </div>
        </div>

        <div className="divider my-4" />

        {/* What happened */}
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-flux-500/25 bg-flux-500/10 text-flux-300">
            <AlertTriangle size={13} />
          </span>
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-ink-50">What happened?</h3>
            {investigation.summary ? (
              <p className="mt-1 text-xs leading-relaxed text-ink-200">{investigation.summary}</p>
            ) : null}
            {investigation.observation ? (
              <p className="mt-2 text-xs leading-relaxed text-ink-400">{investigation.observation}</p>
            ) : null}
          </div>
        </div>
      </Card>

      {/* ── Figures ────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader
            title="Consumption"
            subtitle="Reported against the learned baseline"
            icon={<TrendingUp size={15} />}
          />
          <div className="mt-4">
            <KeyValueRow label="Expected" value={formatEnergy(investigation.expectedKwh, 1)} />
            <KeyValueRow label="Actual" value={formatEnergy(investigation.actualKwh, 1)} tone="flux" />
            <KeyValueRow label="Excess energy" value={formatEnergy(investigation.excessKwh, 1)} tone="crit" />
            <KeyValueRow
              label="Estimated cost"
              value={formatCurrency(investigation.estimatedCost, investigation.currency)}
              tone="alert"
              hint={`Tariff ${formatCurrency(investigation.tariffRatePerKwh, investigation.currency, {
                fractionDigits: 2,
              })}/kWh`}
            />
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-2xs text-ink-500">
              <span>Actual vs expected</span>
              <span className="tnum">{formatPercent(deviationPercent, 0)} over</span>
            </div>
            <ProgressBar value={Math.min(100, deviationPercent)} tone="crit" />
          </div>
        </Card>

        {/* ── Evidence ──────────────────────────────────────── */}
        <Card>
          <CardHeader
            title="Evidence"
            subtitle="Measurements supporting this deviation"
            icon={<Info size={15} />}
            actions={<Badge tone="neutral">{investigation.evidence.length}</Badge>}
          />
          {investigation.evidence.length === 0 ? (
            <p className="mt-4 text-xs text-ink-500">No evidence items were returned for this anomaly.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {investigation.evidence.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-2xs font-medium uppercase tracking-[0.12em] text-ink-500">
                      {item.label}
                    </span>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                        EVIDENCE_TONES[item.kind] ?? EVIDENCE_TONES.context,
                      )}
                    >
                      {item.kind}
                    </span>
                  </div>
                  <p className="tnum mt-1 text-sm font-semibold text-ink-50">{item.value}</p>
                  {item.detail ? (
                    <p className="mt-1 text-2xs leading-relaxed text-ink-400">{item.detail}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ── Possible factors + recommended checks ──────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Possible factors to investigate"
            subtitle="Hypotheses only — confirm with facilities data"
            icon={<HelpCircle size={15} />}
          />

          {investigation.possibleFactors.length === 0 ? (
            <p className="mt-4 text-xs text-ink-500">The service did not return any candidate factors.</p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {investigation.possibleFactors.map((factor) => {
                const Icon = FACTOR_ICONS[factor.category] ?? Lightbulb
                const status = FACTOR_STATUS[factor.status] ?? FACTOR_STATUS.unverified
                return (
                  <li
                    key={factor.id}
                    className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                  >
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-ink-300">
                      <Icon size={13} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-ink-50">{factor.label}</span>
                        <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-ink-500">
                          {FACTOR_CATEGORY_LABEL[factor.category] ?? factor.category}
                        </span>
                        <span
                          className={cn(
                            'rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider',
                            status.className,
                          )}
                        >
                          {status.label}
                        </span>
                      </div>
                      {factor.rationale ? (
                        <p className="mt-1.5 text-2xs leading-relaxed text-ink-400">{factor.rationale}</p>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          {investigation.confidenceNote ? (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-flux-500/20 bg-flux-500/[0.06] px-3 py-2.5 text-2xs leading-relaxed text-flux-200">
              <Info size={12} className="mt-0.5 shrink-0" />
              {investigation.confidenceNote}
            </p>
          ) : null}
        </Card>

        <Card>
          <CardHeader
            title="Recommended checks"
            subtitle="Actions to confirm or rule out each factor"
            icon={<ClipboardList size={15} />}
          />

          {investigation.recommendedChecks.length === 0 ? (
            <p className="mt-4 text-xs text-ink-500">No recommended checks were returned.</p>
          ) : (
            <ol className="mt-4 space-y-2">
              {investigation.recommendedChecks.map((check, index) => (
                <li key={check.id} className="flex items-start gap-3">
                  <span className="tnum mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-2xs font-semibold text-ink-300">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1 pb-1">
                    <p className="text-xs leading-relaxed text-ink-100">{check.label}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-2xs text-ink-500">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 font-semibold uppercase tracking-wider',
                          check.priority === 'high'
                            ? 'bg-crit-500/10 text-crit-300'
                            : check.priority === 'medium'
                              ? 'bg-alert-500/10 text-alert-300'
                              : 'bg-white/[0.05] text-ink-400',
                        )}
                      >
                        {check.priority} priority
                      </span>
                      {check.owner ? <span>{check.owner}</span> : <span>Unassigned</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {/* ── Timeline ───────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Anomaly timeline"
          subtitle="How the deviation developed and normalised"
          icon={<CalendarClock size={15} />}
        />
        <div className="mt-5">
          <AnomalyTimeline events={investigation.timeline} />
        </div>
      </Card>
    </div>
  )
}

function InvestigationSkeleton() {
  return (
    <div className="space-y-4">
      <div className="glass p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="w-full space-y-2">
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-3 w-56" />
            <div className="skeleton h-3 w-40" />
          </div>
          <div className="skeleton h-10 w-20 shrink-0" />
        </div>
        <div className="divider my-4" />
        <div className="space-y-2">
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-11/12" />
          <div className="skeleton h-3 w-4/5" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="glass space-y-3 p-5">
            <div className="skeleton h-3 w-32" />
            {Array.from({ length: 5 }).map((_, row) => (
              <div key={row} className="skeleton h-8 w-full rounded-xl" />
            ))}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 py-2 text-xs text-ink-500">
        <Loader2 size={13} className="animate-spin" />
        Loading investigation from the energy service…
      </div>
    </div>
  )
}

export const InvestigationPanel = memo(InvestigationPanelComponent)
