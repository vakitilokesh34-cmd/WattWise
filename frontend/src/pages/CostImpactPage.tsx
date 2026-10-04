import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banknote, CalendarDays, Download, Info, Receipt, TrendingUp, TriangleAlert } from 'lucide-react'
import type { CostImpact as CostImpactPayload, TopCostPeriod } from '@/types'
import { formatCurrency, formatEnergy, formatNumber, SEVERITY_LABEL } from '@/utils/format'
import { formatDate, formatShortDateTime } from '@/utils/date'
import { downloadTextFile, toCsv } from '@/utils/download'
import { cn } from '@/utils/cn'
import { useQuery } from '@/hooks/useQuery'
import { useWorkspace } from '@/context/WorkspaceContext'
import { wattwiseApi } from '@/services/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { ChartSkeleton } from '@/components/ui/Skeleton'
import { PageState } from '@/components/ui/PageState'
import { CostCard } from '@/components/cost/CostCard'
import { CostTrendChart, RankingBars } from '@/components/charts/SecondaryCharts'

type Granularity = 'daily' | 'weekly' | 'monthlyProjection'

const GRANULARITY: Array<{ key: Granularity; label: string; hint: string }> = [
  { key: 'daily', label: 'Daily', hint: 'Actual excess in the selected window' },
  { key: 'weekly', label: 'Weekly', hint: 'Actual excess grouped by week' },
  { key: 'monthlyProjection', label: 'Projection', hint: 'Forward-looking estimate — not an invoice' },
]

/**
 * COST IMPACT
 *
 * Money view of the detected waste. Everything is an *estimate* derived from the
 * building tariff; the backend disclaimer is always rendered verbatim and the
 * projection tab is labelled as forward-looking.
 */
export default function CostImpactPage() {
  const navigate = useNavigate()
  const { activeBuilding, activeBuildingId, range } = useWorkspace()
  const [granularity, setGranularity] = useState<Granularity>('daily')

  const queryKey = activeBuildingId ? `cost:${activeBuildingId}:${range.from}:${range.to}` : null
  const cost = useQuery<CostImpactPayload>(queryKey, () =>
    wattwiseApi.getCostImpact({ buildingId: activeBuildingId, from: range.from, to: range.to }),
  )

  const data = cost.data
  const currency = data?.currency ?? activeBuilding?.currency ?? 'INR'

  const buckets = useMemo(() => {
    if (!data) return []
    return data[granularity] ?? []
  }, [data, granularity])

  const bucketsTotal = useMemo(
    () =>
      buckets.reduce(
        (acc, bucket) => ({
          excessKwh: acc.excessKwh + bucket.excessKwh,
          estimatedCost: acc.estimatedCost + bucket.estimatedCost,
        }),
        { excessKwh: 0, estimatedCost: 0 },
      ),
    [buckets],
  )

const worstPeriod = useMemo<TopCostPeriod | null>(
    () =>
      (data?.topPeriods ?? []).reduce<TopCostPeriod | null>(
        (worst, period) => (!worst || period.estimatedCost > worst.estimatedCost ? period : worst),
        null,
      ),
    [data],
  )

  const handleExport = () => {
    if (!data) return
    downloadTextFile(
      `wattwise-cost-${activeBuildingId}-${range.from.slice(0, 10)}.csv`,
      toCsv(
        data.daily.map((bucket) => ({
          date: bucket.date,
          label: bucket.label,
          excess_kwh: bucket.excessKwh,
          estimated_cost: bucket.estimatedCost,
          estimated: true,
        })),
      ),
      'text/csv;charset=utf-8',
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cost Impact"
        subtitle="Estimated excess cost of detected waste, derived from the building tariff."
        icon={<Banknote size={19} />}
        meta={
          <>
            <Badge tone="crit">Estimates only</Badge>
            {data ? (
              <Badge tone="neutral">
                Tariff {formatCurrency(data.tariffRatePerKwh, currency, { fractionDigits: 2 })}/kWh
              </Badge>
            ) : null}
          </>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!data || data.daily.length === 0}
            iconLeft={<Download size={13} />}
          >
            Export CSV
          </Button>
        }
      />

      <PageState
        isLoading={cost.isLoading}
        error={cost.error}
        onRetry={() => void cost.refetch()}
        skeleton={
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="glass h-32 animate-pulse" />
            ))}
          </div>
        }
        isEmpty={!data || data.daily.length + data.weekly.length === 0}
        emptyTitle="No cost impact in this window"
        emptyDescription="No anomalies were detected in the selected range, so there is no excess cost to estimate."
        emptyIcon={<Receipt size={20} />}
      >
        {/* ── Totals ────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <CostCard
            label="Daily excess (estimated)"
            value={data ? formatCurrency(data.totals.dailyExcessCost, currency) : '—'}
            caption={data ? `${formatEnergy(data.totals.dailyExcessKwh, 1)} above baseline` : undefined}
            icon={<CalendarDays size={16} />}
            tone="crit"
            index={0}
            note="Average per day in the selected window."
          />
          <CostCard
            label="Weekly excess (estimated)"
            value={data ? formatCurrency(data.totals.weeklyExcessCost, currency) : '—'}
            caption={data ? `${formatEnergy(data.totals.weeklyExcessKwh, 1)} above baseline` : undefined}
            icon={<TrendingUp size={16} />}
            tone="alert"
            index={1}
            note="Sum of detected excess grouped by week."
          />
          <CostCard
            label="Monthly projection (estimated)"
            value={data ? formatCurrency(data.totals.monthlyProjectedExcessCost, currency) : '—'}
            caption={data ? `${formatEnergy(data.totals.monthlyProjectedExcessKwh, 1)} projected` : undefined}
            icon={<Banknote size={16} />}
            tone="flux"
            index={2}
            note="Forward-looking projection from the current rate, not a committed saving."
          />
          <CostCard
            label="Tariff in use"
            value={data ? `${formatCurrency(data.tariffRatePerKwh, currency, { fractionDigits: 2 })}/kWh` : '—'}
            caption={`Currency ${currency}`}
            icon={<Receipt size={16} />}
            tone="default"
            index={3}
            note="Reported by the API for this building."
          />
        </div>

        {/* ── Granularity switch ─────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-1.5">
          {GRANULARITY.map((option) => {
            const active = granularity === option.key
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={active}
                onClick={() => setGranularity(option.key)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-2xs font-medium transition duration-200',
                  active
                    ? 'border-flux-400/35 bg-flux-500/12 text-flux-200'
                    : 'border-white/[0.07] bg-white/[0.02] text-ink-500 hover:border-white/15 hover:text-ink-300',
                )}
              >
                {option.label}
              </button>
            )
          })}
          <p className="ml-2 text-2xs text-ink-500">
            {GRANULARITY.find((option) => option.key === granularity)?.hint}
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          {cost.isFetching ? (
            <ChartSkeleton height={260} />
          ) : (
            <CostTrendChart data={buckets} currency={currency} height={260} />
          )}

          <Card>
            <CardHeader
              title="Costliest periods"
              subtitle="Anomaly windows with the highest estimated excess cost"
              icon={<TriangleAlert size={15} />}
              actions={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/anomalies')}
                  iconRight={<TriangleAlert size={12} />}
                >
                  Explore
                </Button>
              }
            />
            <div className="mt-5">
              <RankingBars
                items={(data?.topPeriods ?? []).map((period) => ({
                  id: period.anomalyId,
                  label: `${period.reference} · ${SEVERITY_LABEL[period.severity]}`,
                  value: period.estimatedCost,
                  caption: `${formatDate(period.start)} · ${formatEnergy(period.excessKwh, 1)} excess`,
                }))}
                formatValue={(value) => formatCurrency(value, currency)}
                emptyLabel="No costliest periods in this window."
              />
            </div>
          </Card>
        </div>

        {/* ── Bucket table ───────────────────────────────────── */}
        <Card padded={false} className="overflow-hidden">
          <div className="border-b border-white/[0.06] p-5">
            <CardHeader
              title="Breakdown"
              subtitle={`${buckets.length} ${granularity === 'monthlyProjection' ? 'projected ' : ''}bucket${buckets.length === 1 ? '' : 's'} · ${formatEnergy(bucketsTotal.excessKwh, 1)} excess · ${formatCurrency(bucketsTotal.estimatedCost, currency)} estimated`}
              icon={<CalendarDays size={15} />}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-2xs uppercase tracking-[0.12em] text-ink-500">
                  <th className="px-5 py-3 font-medium">Period</th>
                  <th className="px-5 py-3 text-right font-medium">Excess energy</th>
                  <th className="px-5 py-3 text-right font-medium">Estimated cost</th>
                  <th className="px-5 py-3 text-right font-medium">Share</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map((bucket) => {
                  const share =
                    bucketsTotal.estimatedCost > 0
                      ? (bucket.estimatedCost / bucketsTotal.estimatedCost) * 100
                      : 0
                  return (
                    <tr key={`${bucket.date}-${bucket.label}`} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-5 py-3">
                        <span className="font-medium text-ink-100">{bucket.label}</span>
                        <span className="mt-0.5 block text-2xs text-ink-500">{formatShortDateTime(bucket.date)}</span>
                      </td>
                      <td className="tnum px-5 py-3 text-right text-ink-200">{formatEnergy(bucket.excessKwh, 1)}</td>
                      <td className="tnum px-5 py-3 text-right font-semibold text-crit-300">
                        {formatCurrency(bucket.estimatedCost, currency)}
                      </td>
                      <td className="tnum px-5 py-3 text-right text-ink-400">
                        {share > 0 ? `${share.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ── Disclaimer + worst period ─────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Card className="border-alert-500/20">
            <CardHeader title="How these numbers are produced" icon={<Info size={15} />} />
            <p className="mt-3 text-xs leading-relaxed text-ink-400">
              {data?.disclaimer ??
                'Estimated excess cost is derived from detected excess energy and the building tariff.'}
            </p>
            <ul className="mt-3 space-y-1.5 text-2xs leading-relaxed text-ink-500">
              <li>· Estimates are not invoices and are not a guarantee of savings.</li>
              <li>· Tariff changes, demand charges and taxes are not modelled by the frontend.</li>
              <li>· A window with no detected anomalies reports zero estimated cost, not zero waste.</li>
            </ul>
          </Card>

          {worstPeriod ? (
            <CostCard
              label="Costliest single period"
              value={formatCurrency(worstPeriod.estimatedCost, currency)}
              caption={`${worstPeriod.reference} · ${SEVERITY_LABEL[worstPeriod.severity]} · ${formatEnergy(worstPeriod.excessKwh, 1)}`}
              icon={<TriangleAlert size={16} />}
              tone="crit"
              index={0}
              note="Open the investigation to review the supporting evidence."
              onClick={() => navigate(`/investigations/${worstPeriod.anomalyId}`)}
            />
          ) : null}
        </div>

        <p className="tnum text-2xs text-ink-500">
          {formatNumber(data?.topPeriods.length ?? 0)} costliest periods reported · totals are sums of the
          detected anomalies, not of total building consumption.
        </p>
      </PageState>
    </div>
  )
}