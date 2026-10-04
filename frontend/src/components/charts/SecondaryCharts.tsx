import { memo, useMemo } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { CostBucket } from '@/types'
import { cn } from '@/utils/cn'
import { formatCurrency, formatNumber } from '@/utils/format'
import { AXIS_STYLE, CHART } from './chartTheme'

/* ── Cost trend (daily / weekly) ────────────────────────────── */

export interface CostTrendChartProps {
  data: CostBucket[]
  currency: string
  height?: number
  showEnergy?: boolean
  className?: string
}

function CostTrendChartComponent({
  data,
  currency,
  height = 260,
  showEnergy = true,
  className,
}: CostTrendChartProps) {
  const maxCost = useMemo(() => data.reduce((max, b) => Math.max(max, b.estimatedCost), 0), [data])

  return (
    <div className={cn('glass p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-50">Excess energy &amp; estimated cost</h3>
          <p className="mt-0.5 text-xs text-ink-400">Derived from anomalies in the selected period</p>
        </div>
        <span className="hidden items-center gap-3 text-2xs text-ink-400 sm:flex">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: CHART.crit }} />
            Cost
          </span>
          {showEnergy ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: CHART.flux }} />
              Excess kWh
            </span>
          ) : null}
        </span>
      </div>

      <div className="mt-5" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -14 }}>
            <defs>
              <linearGradient id="ww-cost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART.crit} stopOpacity={0.5} />
                <stop offset="100%" stopColor={CHART.crit} stopOpacity={0.04} />
              </linearGradient>
              <linearGradient id="ww-excessfill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART.flux} stopOpacity={0.35} />
                <stop offset="100%" stopColor={CHART.flux} stopOpacity={0.03} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="label" {...AXIS_STYLE} minTickGap={24} />
            <YAxis
              {...AXIS_STYLE}
              width={56}
              tickFormatter={(value: number) => formatCurrency(value, currency, { compact: true })}
            />
            <RechartsTooltip content={<CostTooltip currency={currency} />} />

            {showEnergy ? (
              <Area
                type="monotone"
                dataKey="excessKwh"
                name="Excess energy"
                stroke={CHART.flux}
                strokeWidth={1.6}
                fill="url(#ww-excessfill)"
                dot={false}
                isAnimationActive={false}
              />
            ) : null}

            <Area
              type="monotone"
              dataKey="estimatedCost"
              name="Estimated cost"
              stroke={CHART.crit}
              strokeWidth={2}
              fill="url(#ww-cost)"
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 4, fill: CHART.crit, stroke: '#04070d', strokeWidth: 2 }}
            />

            {maxCost > 0 ? (
              <ReferenceLine
                y={maxCost}
                stroke={CHART.axis}
                strokeDasharray="4 4"
                label={{ value: 'peak', position: 'right', fill: CHART.axis, fontSize: 9 }}
              />
            ) : null}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function CostTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean
  payload?: Array<{ payload: CostBucket }>
  currency: string
}) {
  const bucket = payload?.[0]?.payload
  if (!active || !bucket) return null
  return (
    <div
      style={{ background: CHART.tooltipBg }}
      className="rounded-xl border border-white/10 px-3 py-2.5 shadow-lift backdrop-blur-xl"
    >
      <p className="text-2xs font-semibold text-ink-100">{bucket.label}</p>
      <p className="tnum mt-1.5 text-2xs text-ink-200">
        {formatCurrency(bucket.estimatedCost, currency)} estimated
      </p>
      <p className="tnum mt-0.5 text-2xs text-ink-400">
        {formatNumber(bucket.excessKwh, 1)} kWh excess
      </p>
    </div>
  )
}

export const CostTrendChart = memo(CostTrendChartComponent)

/* ── Horizontal ranking (top anomaly periods) ───────────────── */

export interface RankingBarProps {
  items: Array<{ id: string; label: string; value: number; caption?: string }>
  formatValue: (value: number) => string
  emptyLabel?: string
  className?: string
}

export function RankingBars({ items, formatValue, emptyLabel = 'Nothing to rank yet.', className }: RankingBarProps) {
  const max = items.reduce((acc, item) => Math.max(acc, item.value), 0)

  if (items.length === 0) {
    return <p className={cn('py-6 text-center text-xs text-ink-500', className)}>{emptyLabel}</p>
  }

  return (
    <ul className={cn('space-y-3', className)}>
      {items.map((item) => (
        <li key={item.id}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-xs font-medium text-ink-100">{item.label}</span>
            <span className="tnum shrink-0 text-2xs font-semibold text-ink-200">
              {formatValue(item.value)}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-crit-600 to-crit-400 transition-[width] duration-700 ease-spring"
              style={{ width: `${max > 0 ? Math.max(3, (item.value / max) * 100) : 0}%` }}
            />
          </div>
          {item.caption ? <p className="mt-1 text-2xs text-ink-500">{item.caption}</p> : null}
        </li>
      ))}
    </ul>
  )
}

/* ── Compact excess-energy column chart (Trends page) ───────── */

export interface ExcessEnergyChartProps {
  data: Array<{ label: string; excessKwh: number; actualKwh: number; expectedKwh: number }>
  height?: number
  className?: string
  /** Highlights deviation percentage above this value. */
  alertAbovePercent?: number
}

function ExcessEnergyChartComponent({
  data,
  height = 240,
  className,
  alertAbovePercent = 60,
}: ExcessEnergyChartProps) {
  return (
    <div className={cn('glass p-5', className)}>
      <h3 className="text-sm font-semibold text-ink-50">Excess energy by interval</h3>
      <p className="mt-0.5 text-xs text-ink-400">
        Bars turn red when consumption exceeds the baseline by {alertAbovePercent}%
      </p>

      <div className="mt-5" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }} barCategoryGap="18%">
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="label" {...AXIS_STYLE} minTickGap={40} />
            <YAxis {...AXIS_STYLE} width={46} tickFormatter={(v: number) => formatNumber(v)} />
            <RechartsTooltip
              cursor={{ fill: 'rgba(148,163,196,0.06)' }}
              content={<ExcessTooltip />}
            />
            <Bar dataKey="excessKwh" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {data.map((entry) => {
                const deviation =
                  entry.expectedKwh > 0 ? (entry.excessKwh / entry.expectedKwh) * 100 : 0
                return (
                  <Cell
                    key={`${entry.label}-${entry.excessKwh}`}
                    fill={deviation >= alertAbovePercent ? CHART.crit : CHART.flux}
                    fillOpacity={deviation >= alertAbovePercent ? 0.85 : 0.55}
                  />
                )
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function ExcessTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: { label: string; excessKwh: number; actualKwh: number; expectedKwh: number } }>
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div
      style={{ background: CHART.tooltipBg }}
      className="rounded-xl border border-white/10 px-3 py-2.5 shadow-lift backdrop-blur-xl"
    >
      <p className="text-2xs font-semibold text-ink-100">{point.label}</p>
      <p className="tnum mt-1.5 text-2xs text-ink-200">{formatNumber(point.excessKwh, 1)} kWh excess</p>
      <p className="tnum mt-0.5 text-2xs text-ink-400">
        {formatNumber(point.actualKwh, 1)} / {formatNumber(point.expectedKwh, 1)} kWh
      </p>
    </div>
  )
}

export const ExcessEnergyChart = memo(ExcessEnergyChartComponent)

/* ── Profile / load-shape line chart ────────────────────────── */

export interface ProfileChartProps {
  data: Array<{ label: string; expectedKwh: number; actualKwh: number }>
  height?: number
  className?: string
  title?: string
  subtitle?: string
}

function ProfileChartComponent({
  data,
  height = 220,
  className,
  title = 'Load profile',
  subtitle = 'Average consumption by hour across the selected period',
}: ProfileChartProps) {
  return (
    <div className={cn('glass p-5', className)}>
      <h3 className="text-sm font-semibold text-ink-50">{title}</h3>
      <p className="mt-0.5 text-xs text-ink-400">{subtitle}</p>

      <div className="mt-5" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="ww-profile" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART.iris} stopOpacity={0.32} />
                <stop offset="100%" stopColor={CHART.iris} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="label" {...AXIS_STYLE} minTickGap={8} />
            <YAxis {...AXIS_STYLE} width={48} tickFormatter={(v: number) => formatNumber(v)} />
            <RechartsTooltip content={<ProfileTooltip />} />
            <Line
              type="monotone"
              dataKey="expectedKwh"
              stroke={CHART.expected}
              strokeWidth={1.4}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="actualKwh"
              stroke={CHART.flux}
              strokeWidth={2}
              fill="url(#ww-profile)"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function ProfileTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: { label: string; actualKwh: number; expectedKwh: number } }>
}) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null

  const deviation = point.expectedKwh > 0
    ? ((point.actualKwh - point.expectedKwh) / point.expectedKwh) * 100
    : null

  return (
    <div
      style={{ background: CHART.tooltipBg }}
      className="rounded-xl border border-white/10 px-3 py-2.5 shadow-lift backdrop-blur-xl"
    >
      <p className="text-2xs font-semibold text-ink-100">{point.label}</p>
      <div className="mt-1.5 space-y-0.5">
        <p className="tnum text-2xs text-ink-200">
          Actual {formatNumber(point.actualKwh, 1)} kWh
        </p>
        <p className="tnum text-2xs text-ink-400">
          Expected {formatNumber(point.expectedKwh, 1)} kWh
        </p>
      </div>
      {deviation !== null && Math.abs(deviation) > 1 ? (
        <p
          className={cn(
            'tnum mt-2 text-2xs font-semibold',
            deviation > 0 ? 'text-crit-300' : 'text-watt-300',
          )}
        >
          {deviation > 0 ? '+' : ''}
          {deviation.toFixed(1)}% vs baseline
        </p>
      ) : null}
    </div>
  )
}

export const ProfileChart = memo(ProfileChartComponent)
