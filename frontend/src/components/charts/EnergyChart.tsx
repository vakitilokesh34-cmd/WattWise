import { memo, useMemo, useState } from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { TriangleAlert } from 'lucide-react'
import type { Anomaly, EnergySeries } from '@/types'
import { cn } from '@/utils/cn'
import { formatEnergy, formatNumber } from '@/utils/format'
import { formatTime, formatTimeRange } from '@/utils/date'
import { SegmentedControl } from '@/components/ui/Badge'
import { ChartSkeleton } from '@/components/ui/Skeleton'
import { CHART, SEVERITY_HEX, AXIS_STYLE, niceCeiling, severityFill, timeTickFormatterFor, toBands, toChartData } from './chartTheme'

type ViewMode = 'compare' | 'excess'

export interface EnergyChartProps {
  series: EnergySeries | undefined
  anomalies: Anomaly[]
  loading?: boolean
  height?: number
  className?: string
  /** Called when an anomaly band, marker or chip is activated. */
  onAnomalySelect?: (anomalyId: string) => void
  maxPoints?: number
}

/**
 * ACTUAL VS EXPECTED ENERGY.
 *
 * - Area  → learned expected baseline
 * - Line  → actual metered consumption
 * - Bands → anomaly windows, tinted by severity
 * - Bar   → excess energy per interval (toggleable "Excess" view)
 *
 * Memoised so realtime ticks do not re-render the whole page.
 */
function EnergyChartComponent({
  series,
  anomalies,
  loading = false,
  height = 340,
  className,
  onAnomalySelect,
  maxPoints = 420,
}: EnergyChartProps) {
  const [view, setView] = useState<ViewMode>('compare')

  const data = useMemo(() => (series ? toChartData(series.points, maxPoints) : []), [series, maxPoints])
  const bands = useMemo(() => toBands(anomalies), [anomalies])
  const tickFormatter = useMemo(() => timeTickFormatterFor(data), [data])

  /** Anomaly index keyed by the chart's bucket timestamp for click resolution. */
  const tsToAnomaly = useMemo(() => {
    const map = new Map<number, string>()
    for (const point of data) {
      if (point.anomalyId && !map.has(point.ts)) map.set(point.ts, point.anomalyId)
    }
    return map
  }, [data])

  const maxValue = useMemo(() => {
    let max = 0
    for (const point of data) {
      max = Math.max(max, point.actualKwh, point.expectedKwh)
    }
    return niceCeiling(max * 1.12)
  }, [data])

  if (loading) return <ChartSkeleton height={height} />

  if (!series || data.length === 0) return null

  const currency = series.currency

  return (
    <div className={cn('glass p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-50">Actual vs Expected Energy</h3>
          <p className="mt-0.5 text-xs text-ink-400">
            {formatTimeRange(series.from, series.to)} · {series.intervalMinutes}-minute intervals
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Legend />
          <SegmentedControl
            size="sm"
            ariaLabel="Chart view"
            value={view}
            onChange={setView}
            options={[
              { value: 'compare', label: 'Compare' },
              { value: 'excess', label: 'Excess' },
            ]}
          />
        </div>
      </div>

      <div className="mt-5" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 6, right: 8, bottom: 0, left: -14 }}
            onClick={(state) => {
              const raw = state?.activeLabel
              const ts = typeof raw === 'number' ? raw : Number(raw)
              const anomalyId = tsToAnomaly.get(ts)
              if (anomalyId) onAnomalySelect?.(anomalyId)
            }}
          >
            <defs>
              <linearGradient id="ww-expected" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART.expected} stopOpacity={0.28} />
                <stop offset="100%" stopColor={CHART.expected} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="ww-actual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART.actual} stopOpacity={0.3} />
                <stop offset="100%" stopColor={CHART.actual} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="ww-excess" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART.crit} stopOpacity={0.85} />
                <stop offset="100%" stopColor={CHART.crit} stopOpacity={0.15} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke={CHART.grid} vertical={false} />

            <XAxis
              dataKey="ts"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              {...AXIS_STYLE}
              tickFormatter={tickFormatter}
              minTickGap={32}
            />
            <YAxis
              {...AXIS_STYLE}
              domain={[0, maxValue]}
              width={52}
              tickFormatter={(value: number) => formatNumber(value)}
              label={{
                value: 'kWh',
                position: 'insideTopLeft',
                offset: -2,
                fill: CHART.axis,
                fontSize: 10,
              }}
            />

            <RechartsTooltip
              cursor={{ stroke: CHART.flux, strokeOpacity: 0.28, strokeDasharray: '4 4' }}
              content={<EnergyTooltip currency={currency} onAnomalySelect={onAnomalySelect} />}
            />

            {/* Anomaly windows */}
            {bands.map((band) => (
              <ReferenceArea
                key={band.id}
                x1={band.fromMs}
                x2={band.toMs}
                fill={severityFill(band.severity, view === 'excess' ? 0.16 : 0.1)}
                stroke={SEVERITY_HEX[band.severity]}
                strokeOpacity={0.42}
                strokeDasharray="3 3"
                label={{
                  value: band.reference,
                  position: 'insideTop',
                  fill: SEVERITY_HEX[band.severity],
                  fontSize: 9,
                  fontWeight: 700,
                }}
              />
            ))}

            {view === 'compare' ? (
              <>
                <Area
                  type="monotone"
                  dataKey="expectedKwh"
                  name="Expected"
                  stroke={CHART.expected}
                  strokeWidth={1.4}
                  strokeDasharray="5 4"
                  fill="url(#ww-expected)"
                  dot={false}
                  isAnimationActive={false}
                  activeDot={{ r: 3, fill: CHART.expected }}
                />
                <Area
                  type="monotone"
                  dataKey="actualKwh"
                  name="Actual"
                  stroke={CHART.actual}
                  strokeWidth={2}
                  fill="url(#ww-actual)"
                  dot={false}
                  isAnimationActive={false}
                  activeDot={{ r: 4, fill: CHART.actual, stroke: '#04070d', strokeWidth: 2 }}
                />
              </>
            ) : (
              <Bar
                dataKey="excessKwh"
                name="Excess energy"
                fill="url(#ww-excess)"
                radius={[3, 3, 0, 0]}
                maxBarSize={14}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Clickable anomaly chips — the accessible path to anomaly details. */}
      {anomalies.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4">
          <span className="label-muted">Anomalies</span>
          {anomalies.slice(0, 8).map((anomaly) => (
            <button
              key={anomaly.id}
              type="button"
              onClick={() => onAnomalySelect?.(anomaly.id)}
              className={cn(
                'group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-2xs font-semibold transition duration-200 hover:brightness-125',
                anomaly.severity === 'medium'
                  ? 'border-alert-500/30 bg-alert-500/10 text-alert-300'
                  : anomaly.severity === 'low'
                    ? 'border-flux-500/30 bg-flux-500/10 text-flux-300'
                    : 'border-crit-500/30 bg-crit-500/10 text-crit-300',
              )}
            >
              <TriangleAlert size={10} className="opacity-70" />
              {anomaly.reference}
              <span className="tnum opacity-70">
                {formatEnergy(anomaly.excessKwh, 0)}
              </span>
            </button>
          ))}
          {anomalies.length > 8 ? (
            <span className="text-2xs text-ink-500">+{anomalies.length - 8} more</span>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 border-t border-white/[0.06] pt-4 text-2xs text-ink-500">
          No anomalies flagged in this window. Consumption is tracking the learned baseline.
        </p>
      )}
    </div>
  )
}

function Legend() {
  return (
    <div className="hidden items-center gap-3 sm:flex">
      <span className="inline-flex items-center gap-1.5 text-2xs text-ink-400">
        <span className="h-0.5 w-4 rounded-full" style={{ background: CHART.actual }} />
        Actual
      </span>
      <span className="inline-flex items-center gap-1.5 text-2xs text-ink-400">
        <span
          className="h-0.5 w-4 rounded-full"
          style={{ backgroundImage: `repeating-linear-gradient(90deg, ${CHART.expected} 0 4px, transparent 4px 7px)` }}
        />
        Expected
      </span>
    </div>
  )
}

interface TooltipPayloadEntry {
  payload?: {
    timestamp: string
    actualKwh: number
    expectedKwh: number
    excessKwh: number
    deviationPercent: number | null
    anomalyId: string | null
    temperature: number | null
    occupancy: number | null
    intervalMinutes: number
  }
}

function EnergyTooltip({
  active,
  payload,
  currency,
  onAnomalySelect,
}: {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  currency: string
  onAnomalySelect?: (id: string) => void
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null

  const deviated = (point.deviationPercent ?? 0) > 0

  return (
    <div
      style={{ background: CHART.tooltipBg }}
      className="rounded-xl border border-white/10 px-3 py-2.5 shadow-lift backdrop-blur-xl"
    >
      <p className="text-2xs font-semibold text-ink-100">{formatTime(point.timestamp)}</p>

      <div className="mt-2 space-y-1">
        <Row
          color={CHART.actual}
          label="Actual"
          value={`${formatNumber(point.actualKwh, 1)} kWh`}
        />
        <Row
          color={CHART.expected}
          label="Expected"
          value={`${formatNumber(point.expectedKwh, 1)} kWh`}
        />
        {point.excessKwh > 0 ? (
          <Row
            color={CHART.crit}
            label="Excess"
            value={`${formatNumber(point.excessKwh, 1)} kWh`}
          />
        ) : null}
      </div>

      {deviated && point.deviationPercent !== null ? (
        <p className="tnum mt-2 text-2xs font-semibold text-crit-300">
          +{point.deviationPercent.toFixed(1)}% vs baseline
        </p>
      ) : null}

      {point.temperature !== null || point.occupancy !== null ? (
        <div className="mt-2 flex gap-3 border-t border-white/[0.08] pt-2 text-2xs text-ink-500">
          {point.temperature !== null ? <span>{point.temperature.toFixed(1)}°C</span> : null}
          {point.occupancy !== null ? <span>{formatNumber(point.occupancy)}% occupied</span> : null}
        </div>
      ) : null}

      {point.anomalyId ? (
        <button
          type="button"
          onClick={() => onAnomalySelect?.(point.anomalyId!)}
          className="mt-2.5 w-full rounded-lg border border-crit-500/30 bg-crit-500/10 py-1.5 text-2xs font-semibold text-crit-300 transition hover:bg-crit-500/20"
        >
          Open investigation
        </button>
      ) : null}
    </div>
  )
}

function Row({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="inline-flex items-center gap-1.5 text-2xs text-ink-400">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="tnum text-2xs font-semibold text-ink-100">{value}</span>
    </div>
  )
}

/** Memoised so realtime ticks do not re-render the whole page. */
export const EnergyChart = memo(EnergyChartComponent)
