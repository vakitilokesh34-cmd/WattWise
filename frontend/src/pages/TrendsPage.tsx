import { useMemo, useState } from 'react'
import { Activity, Download, LineChart as LineChartIcon, Thermometer, Users } from 'lucide-react'
import type { AnomalyList, EnergySeries } from '@/types'
import { cn } from '@/utils/cn'
import { formatEnergy, formatNumber, formatPercent } from '@/utils/format'
import { formatHour, formatTimeRange } from '@/utils/date'
import { downloadTextFile, toCsv } from '@/utils/download'
import { useQuery } from '@/hooks/useQuery'
import { useWorkspace } from '@/context/WorkspaceContext'
import { wattwiseApi } from '@/services/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { ChartSkeleton } from '@/components/ui/Skeleton'
import { PageState } from '@/components/ui/PageState'
import { EnergyChart } from '@/components/charts/EnergyChart'
import { ExcessEnergyChart, ProfileChart, RankingBars } from '@/components/charts/SecondaryCharts'

type IntervalView = 'excess' | 'temperature' | 'occupancy'

const INTERVAL_OPTIONS: Array<{ key: IntervalView; label: string; icon: typeof Activity }> = [
  { key: 'excess', label: 'Excess energy', icon: Activity },
  { key: 'temperature', label: 'Temperature', icon: Thermometer },
  { key: 'occupancy', label: 'Occupancy', icon: Users },
]

/**
 * TRENDS
 *
 * Long-range analysis of actual vs expected consumption: the full chart, the
 * excess per interval, the hourly load profile and floor ranking. Aggregations
 * are arithmetic reductions of the API series — no new detection logic.
 */
export default function TrendsPage() {
  const { activeBuilding, activeBuildingId, range } = useWorkspace()
  const [intervalView, setIntervalView] = useState<IntervalView>('excess')

  const seriesKey = activeBuildingId ? `energy:${activeBuildingId}:${range.from}:${range.to}` : null
  const series = useQuery<EnergySeries>(seriesKey, () =>
    wattwiseApi.getEnergySeries({ buildingId: activeBuildingId, from: range.from, to: range.to }),
  )

  const anomaliesKey = activeBuildingId
    ? `anomalies:${activeBuildingId}:${range.from}:${range.to}`
    : null
  const anomalies = useQuery<AnomalyList>(anomaliesKey, () =>
    wattwiseApi.getAnomalies({ buildingId: activeBuildingId, from: range.from, to: range.to }),
  )

  const points = series.data?.points ?? []
  const currency = series.data?.currency ?? activeBuilding?.currency ?? 'INR'

  const totals = useMemo(() => {
    let actual = 0
    let expected = 0
    let maxExcess = 0
    let peakIndex = -1
    points.forEach((point, index) => {
      actual += point.actualKwh
      expected += point.expectedKwh
      const excess = point.actualKwh - point.expectedKwh
      if (excess > maxExcess) {
        maxExcess = excess
        peakIndex = index
      }
    })
    return {
      actual: Number(actual.toFixed(2)),
      expected: Number(expected.toFixed(2)),
      excess: Number(Math.max(0, actual - expected).toFixed(2)),
      deviationPercent: expected > 0 ? ((actual - expected) / expected) * 100 : null,
      peakPoint: peakIndex >= 0 ? points[peakIndex] : null,
    }
  }, [points])

  /** Mean consumption per hour-of-day, the classic load profile. */
  const profile = useMemo(() => {
    const buckets = Array.from({ length: 24 }, () => ({ actual: 0, expected: 0, count: 0 }))
    for (const point of points) {
      const hour = new Date(point.timestamp).getHours()
      const bucket = buckets[hour]
      bucket.actual += point.actualKwh
      bucket.expected += point.expectedKwh
      bucket.count += 1
    }
    return buckets.map((bucket, hour) => ({
      label: `${String(hour).padStart(2, '0')}:00`,
      actualKwh: bucket.count ? Number((bucket.actual / bucket.count).toFixed(2)) : 0,
      expectedKwh: bucket.count ? Number((bucket.expected / bucket.count).toFixed(2)) : 0,
    }))
  }, [points])

  const intervalSeries = useMemo(() => {
    if (intervalView === 'excess') {
      return {
        suffix: 'kWh',
        available: true,
        emptyLabel: 'No readings in this window.',
      }
    }
    if (intervalView === 'temperature') {
      return {
        suffix: '°C',
        available: points.some((point) => typeof point.temperature === 'number'),
        emptyLabel: 'No temperature readings were reported for this window.',
      }
    }
    return {
      suffix: '%',
      available: points.some((point) => typeof point.occupancy === 'number'),
      emptyLabel: 'No occupancy readings were reported for this window.',
    }
  }, [points, intervalView])

  const excessByInterval = useMemo(
    () =>
      points.slice(-36).map((point) => ({
        label: formatHour(point.timestamp),
        excessKwh: Number(Math.max(0, point.actualKwh - point.expectedKwh).toFixed(2)),
        actualKwh: point.actualKwh,
        expectedKwh: point.expectedKwh,
      })),
    [points],
  )

  const contextSeries = useMemo(() => {
    if (intervalView === 'excess') {
      return points.slice(-48).map((point) => ({
        label: formatHour(point.timestamp),
        value: Number(Math.max(0, point.actualKwh - point.expectedKwh).toFixed(2)),
      }))
    }
    if (intervalView === 'temperature') {
      return points
        .filter((point) => typeof point.temperature === 'number')
        .slice(-48)
        .map((point) => ({
          label: formatHour(point.timestamp),
          value: point.temperature as number,
        }))
    }
    return points
      .filter((point) => typeof point.occupancy === 'number')
      .slice(-48)
      .map((point) => ({
        label: formatHour(point.timestamp),
        value: point.occupancy as number,
      }))
  }, [points, intervalView])

  const handleExport = () => {
    downloadTextFile(
      `wattwise-profile-${activeBuildingId}-${range.from.slice(0, 10)}.csv`,
      toCsv(profile.map((row) => ({
        hour: row.label,
        actual_kwh: row.actualKwh,
        expected_kwh: row.expectedKwh,
        deviation_percent:
          row.expectedKwh > 0
            ? Number((((row.actualKwh - row.expectedKwh) / row.expectedKwh) * 100).toFixed(2))
            : '',
      }))),
      'text/csv;charset=utf-8',
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Trends"
        subtitle="Actual versus expected consumption over time, with hourly load profile."
        icon={<LineChartIcon size={19} />}
        meta={
          <span className="text-2xs text-ink-500">
            {activeBuilding?.name ?? 'No building selected'} · {formatTimeRange(range.from, range.to)}
          </span>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={points.length === 0}
            iconLeft={<Download size={13} />}
          >
            Export profile
          </Button>
        }
      />

      <PageState
        isLoading={series.isLoading}
        error={series.error}
        onRetry={() => void series.refetch()}
        skeleton={<ChartSkeleton height={340} />}
        isEmpty={points.length === 0}
        emptyTitle="No readings in this window"
        emptyDescription="Widen the date range or upload a CSV to populate the energy series."
      >
        {/* ── Headline numbers ──────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <p className="label-muted">Actual consumption</p>
            <p className="tnum mt-2 text-xl font-semibold text-ink-50">{formatEnergy(totals.actual, 1)}</p>
            <p className="mt-1.5 text-2xs text-ink-500">
              {formatNumber(points.length)} intervals
            </p>
          </Card>
          <Card>
            <p className="label-muted">Expected baseline</p>
            <p className="tnum mt-2 text-xl font-semibold text-ink-50">{formatEnergy(totals.expected, 1)}</p>
            <p className="mt-1.5 text-2xs text-ink-500">Model {series.data ? `${series.data.intervalMinutes}m buckets` : '—'}</p>
          </Card>
          <Card>
            <p className="label-muted">Net deviation</p>
            <p
              className={cn(
                'tnum mt-2 text-xl font-semibold',
                totals.excess > 0 ? 'text-crit-300' : 'text-watt-300',
              )}
            >
              {formatPercent(totals.deviationPercent)}
            </p>
            <p className="mt-1.5 text-2xs text-ink-500">
              {totals.excess > 0 ? `${formatEnergy(totals.excess, 1)} above baseline` : 'At or below baseline'}
            </p>
          </Card>
          <Card>
            <p className="label-muted">Peak interval</p>
            <p className="tnum mt-2 text-xl font-semibold text-ink-50">
              {totals.peakPoint ? formatEnergy(Math.max(0, totals.peakPoint.actualKwh - totals.peakPoint.expectedKwh), 1) : '—'}
            </p>
            <p className="mt-1.5 text-2xs text-ink-500">
              {totals.peakPoint ? formatHour(totals.peakPoint.timestamp) : 'No readings'}
            </p>
          </Card>
        </div>

        <EnergyChart series={series.data} anomalies={anomalies.data?.items ?? []} height={360} />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <ExcessEnergyChart data={excessByInterval} height={250} />

          <Card>
            <CardHeader
              title="Interval detail"
              subtitle={intervalSeries.suffix === '%' ? 'Reported occupancy share' : intervalSeries.suffix === '°C' ? 'Reported ambient temperature' : 'Actual minus expected'}
              icon={<Activity size={15} />}
            />

            <div className="mt-4 flex flex-wrap gap-1.5">
              {INTERVAL_OPTIONS.map((option) => {
                const Icon = option.icon
                const active = intervalView === option.key
                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setIntervalView(option.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-medium transition duration-200',
                      active
                        ? 'border-flux-400/35 bg-flux-500/12 text-flux-200'
                        : 'border-white/[0.07] bg-white/[0.02] text-ink-500 hover:border-white/15 hover:text-ink-300',
                    )}
                  >
                    <Icon size={11} />
                    {option.label}
                  </button>
                )
              })}
            </div>

            <div className="mt-4">
              <RankingBars
                items={[...contextSeries]
                  .reverse()
                  .slice(0, 8)
                  .map((row) => ({
                    id: `${row.label}`,
                    label: row.label,
                    value: row.value,
                    caption:
                      intervalView === 'excess' && row.value > 0 ? 'Above baseline' : undefined,
                  }))}
                formatValue={(value) =>
                  `${formatNumber(value, intervalSeries.suffix === '°C' ? 1 : 2)} ${intervalSeries.suffix}`
                }
                emptyLabel={intervalSeries.emptyLabel}
                className="max-h-[15rem] overflow-y-auto pr-1"
              />
            </div>
          </Card>
        </div>

        <ProfileChart data={profile} height={240} />

        <Card>
          <CardHeader
            title="How to read this"
            subtitle="Interpretation notes for the numbers above"
            icon={<LineChartIcon size={15} />}
          />
          <ul className="mt-4 space-y-2 text-xs leading-relaxed text-ink-400">
            <li>
              Expected values are the baseline reported by the backend model; the frontend never
              recomputes them.
            </li>
            <li>
              Excess energy is the positive difference between actual and expected. Negative readings
              mean consumption was below baseline and are shown as zero excess.
            </li>
            <li>
              The hourly profile averages every interval sharing the same hour of day, so a single busy
              hour is not comparable across differently sized ranges.
            </li>
            <li>
              Cost figures are estimates derived from the building tariff and are not billing amounts
              (see Cost Impact for the mandatory disclaimer).
            </li>
          </ul>
          <p className="tnum mt-4 text-2xs text-ink-500">
            Building currency {currency} · tariff{' '}
            {series.data ? `${formatNumber(series.data.tariffRatePerKwh, 2)}/kWh` : '—'}
          </p>
        </Card>
      </PageState>
    </div>
  )
}