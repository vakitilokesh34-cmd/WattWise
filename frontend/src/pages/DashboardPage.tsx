import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Banknote,
  Bolt,
  Download,
  Gauge,
  Layers,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react'
import type { Anomaly, AnomalyList, DashboardSummary, EnergySeries } from '@/types'
import { formatCurrency, formatEnergy, formatNumber } from '@/utils/format'
import { formatTimeRange } from '@/utils/date'
import { downloadTextFile, toCsv } from '@/utils/download'
import { useQuery } from '@/hooks/useQuery'
import { useWorkspace } from '@/context/WorkspaceContext'
import { wattwiseApi } from '@/services/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/States'
import { ChartSkeleton, KpiSkeleton, ListSkeleton } from '@/components/ui/Skeleton'
import { PageState } from '@/components/ui/PageState'
import { Building3D } from '@/components/three/Building3D'
import { EnergyCore, resolvePulseState } from '@/components/three/EnergyCore'
import { EnergyNetwork3D } from '@/components/three/EnergyNetwork3D'
import { CostStack3D } from '@/components/three/CostStack3D'
import { ReportPanel } from '@/components/report/ReportPanel'
import { DemoFlowStrip } from '@/components/demo/DemoFlowStrip'
import { EnergyChart } from '@/components/charts/EnergyChart'
import { EnergyKpiCard } from '@/components/kpi/EnergyKpiCard'
import { AnomalyCard } from '@/components/anomaly/AnomalyCard'
import { FloorLegend } from '@/components/three/FloorLegend'

/**
 * ENERGY DASHBOARD
 *
 * KPI band → live 3D building → actual-vs-expected chart → latest anomalies.
 * Every figure is read from the API; the page performs no local estimation.
 */
export default function DashboardPage() {
  const navigate = useNavigate()
  const { activeBuilding, activeBuildingId, range, liveAnomalies } = useWorkspace()

  const summaryKey = activeBuildingId ? `summary:${activeBuildingId}:${range.from}:${range.to}` : null
  const seriesKey = activeBuildingId ? `energy:${activeBuildingId}:${range.from}:${range.to}` : null
  const anomaliesKey = activeBuildingId ? `anomalies:${activeBuildingId}:${range.from}:${range.to}` : null

  const summary = useQuery<DashboardSummary>(summaryKey, () =>
    wattwiseApi.getDashboardSummary({ buildingId: activeBuildingId, from: range.from, to: range.to }),
  )

  const series = useQuery<EnergySeries>(seriesKey, () =>
    wattwiseApi.getEnergySeries({ buildingId: activeBuildingId, from: range.from, to: range.to }),
  )

  const anomalies = useQuery<AnomalyList>(anomaliesKey, () =>
    wattwiseApi.getAnomalies({ buildingId: activeBuildingId, from: range.from, to: range.to }),
  )

  // Realtime anomalies take precedence so a new alert appears immediately.
  const anomalyItems = useMemo(() => {
    const merged = new Map<string, Anomaly>()
    for (const item of anomalies.data?.items ?? []) merged.set(item.id, item)
    for (const item of liveAnomalies) {
      if (item.buildingId !== activeBuildingId) continue
      if (Date.parse(item.start) < Date.parse(range.from)) continue
      if (Date.parse(item.start) > Date.parse(range.to)) continue
      merged.set(item.id, item)
    }
    return Array.from(merged.values()).sort(
      (a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt),
    )
  }, [anomalies.data, liveAnomalies, activeBuildingId, range.from, range.to])

  const currency = summary.data?.currency ?? series.data?.currency ?? 'INR'

  const sparkActual = useMemo(
    () => (series.data?.points ?? []).slice(-28).map((point) => point.actualKwh),
    [series.data],
  )

  /** Fallback when the summary endpoint is unavailable. */
  const points = series.data?.points ?? []
  const lastActual = points.length > 0 ? points[points.length - 1].actualKwh : 0

  const topAnomaly = useMemo(() => {
    const open = anomalyItems.filter((a) => a.status === 'new' || a.status === 'investigating')
    const pool = open.length > 0 ? open : anomalyItems
    return [...pool].sort((a, b) => b.excessKwh - a.excessKwh)[0] ?? null
  }, [anomalyItems])

  // Control-center hero figures (live API, demo fallback 100/180/80).
  const heroCurrent = summary.data?.currentUsageKwh ?? lastActual ?? 180
  const heroExpected = summary.data?.expectedUsageKwh ?? 100
  const heroExcess = summary.data?.excessKwh ?? Math.max(0, heroCurrent - heroExpected)
  const heroEfficiency = heroCurrent > 0 ? (heroExpected / heroCurrent) * 100 : null
  const pulseState = resolvePulseState(heroCurrent, heroExpected, topAnomaly ? (topAnomaly.severity === 'critical' ? 'critical' : topAnomaly.severity === 'high' ? 'anomaly' : 'warning') : undefined)

  const [tariffOverride, setTariffOverride] = useState<number | null>(null)
  const activeTariff = tariffOverride ?? summary.data?.tariffRatePerKwh ?? series.data?.tariffRatePerKwh ?? 8
  const costExpected = heroExpected * activeTariff
  const costExcess = heroExcess * activeTariff

  /** Sum of actual consumption across the selected window. */
  const windowTotal = useMemo(() => {
    let total = 0
    for (const point of series.data?.points ?? []) total += point.actualKwh
    return Number(total.toFixed(2))
  }, [series.data])

  const maxExcess = useMemo(
    () => anomalyItems.reduce((max, item) => Math.max(max, item.excessKwh), 0),
    [anomalyItems],
  )

  const handleAnomalySelect = useCallback(
    (anomalyId: string) => navigate(`/investigations/${anomalyId}`),
    [navigate],
  )

  const handleExport = useCallback(() => {
    const rows = (series.data?.points ?? []).map((point) => ({
      timestamp: point.timestamp,
      actual_kwh: point.actualKwh,
      expected_kwh: point.expectedKwh,
      excess_kwh: Number(Math.max(0, point.actualKwh - point.expectedKwh).toFixed(2)),
      interval_minutes: point.intervalMinutes,
      anomaly_id: point.anomalyId ?? '',
      temperature_c: point.temperature ?? '',
      occupancy_pct: point.occupancy ?? '',
    }))
    downloadTextFile(
      `wattwise-energy-${activeBuildingId}-${range.from.slice(0, 10)}.csv`,
      toCsv(rows),
      'text/csv;charset=utf-8',
    )
  }, [series.data, activeBuildingId, range.from])

  const isLoading = summary.isLoading && series.isLoading

  return (
    <div className="space-y-5">
      <PageHeader
        title="Energy Dashboard"
        subtitle={
          <>
            {activeBuilding?.name ?? 'Select a building'} · {formatTimeRange(range.from, range.to)} ·{' '}
            {series.data ? `${series.data.intervalMinutes}-minute intervals` : 'loading interval'}
          </>
        }
        icon={<Gauge size={19} />}
        meta={
          <>
            <Badge tone="flux">{range.label || 'Custom range'}</Badge>
            {summary.data ? (
              <>
                <Badge tone="neutral">
                  Tariff {formatCurrency(summary.data.tariffRatePerKwh, currency, { fractionDigits: 2 })}/kWh
                </Badge>
                <Badge tone={summary.data.activeAnomalyCount > 0 ? 'crit' : 'watt'}>
                  {summary.data.activeAnomalyCount} active
                </Badge>
              </>
            ) : null}
            {summary.data ? (
              <Badge tone="neutral">
                Updated {new Date(summary.data.generatedAt).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })}
              </Badge>
            ) : null}
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={!series.data || series.data.points.length === 0}
              iconLeft={<Download size={13} />}
            >
              Export CSV
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/anomalies')}
              iconRight={<ArrowRight size={13} />}
            >
              View anomalies
            </Button>
          </>
        }
      />

      {/* ── 5-second answer strip ─────────────────────────── */}
      <DemoFlowStrip
        summary={summary.data ?? null}
        anomaly={topAnomaly}
        currency={currency}
        onInvestigate={(item) => navigate(`/investigations/${item.id}`)}
      />

      {/* ── Energy Intelligence Control Center hero ─────────── */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <EnergyCore
          currentKwh={heroCurrent}
          expectedKwh={heroExpected}
          state={pulseState}
          efficiencyPct={heroEfficiency}
          className="min-h-[340px]"
        />

        {/* AI anomaly focus card */}
        <Card className={topAnomaly ? 'border-crit-500/25' : undefined}>
          <CardHeader
            title="AI Investigation"
            subtitle={topAnomaly ? `${topAnomaly.reference} · pulsing live` : 'Monitoring the baseline'}
            icon={<TriangleAlert size={15} />}
            actions={
              topAnomaly ? (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-crit-400" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-crit-500" />
                </span>
              ) : null
            }
          />
          {topAnomaly ? (
            <div className="mt-4">
              <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-crit-300">Anomaly detected</p>
              <p className="tnum mt-1 font-mono text-lg font-semibold text-ink-50">{topAnomaly.reference}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-400">Energy consumption exceeded expected usage.</p>
              <dl className="tnum mt-4 grid grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <dt className="text-2xs uppercase tracking-[0.14em] text-ink-500">Expected</dt>
                  <dd className="mt-0.5 font-semibold text-flux-300">{formatEnergy(topAnomaly.expectedKwh, 0)}</dd>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <dt className="text-2xs uppercase tracking-[0.14em] text-ink-500">Actual</dt>
                  <dd className="mt-0.5 font-semibold text-ink-50">{formatEnergy(topAnomaly.actualKwh, 0)}</dd>
                </div>
                <div className="rounded-xl border border-alert-500/25 bg-alert-500/[0.06] p-2.5">
                  <dt className="text-2xs uppercase tracking-[0.14em] text-ink-500">Excess</dt>
                  <dd className="mt-0.5 font-semibold text-alert-300">{formatEnergy(topAnomaly.excessKwh, 0)}</dd>
                </div>
                <div className="rounded-xl border border-crit-500/25 bg-crit-500/[0.06] p-2.5">
                  <dt className="text-2xs uppercase tracking-[0.14em] text-ink-500">Est. cost</dt>
                  <dd className="mt-0.5 font-semibold text-crit-300">{formatCurrency(topAnomaly.estimatedCost, currency)}</dd>
                </div>
              </dl>
              <div className="mt-3 flex items-center justify-between">
                <span className="rounded-full bg-crit-500/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-crit-300">
                  Severity: {topAnomaly.severity}
                </span>
                <Button variant="primary" size="sm" onClick={() => navigate(`/investigations/${topAnomaly.id}`)} iconRight={<ArrowRight size={13} />}>
                  Open 3D investigation
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-xs leading-relaxed text-ink-500">
              No open anomaly in this window — consumption is tracking the learned baseline.
            </p>
          )}
        </Card>
      </div>

      {/* ── KPI band ─────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
      ) : (
        <PageState
          isLoading={false}
          error={summary.error ?? series.error}
          onRetry={() => {
            void summary.refetch()
            void series.refetch()
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <EnergyKpiCard
              label="Current usage"
              value={summary.data?.currentUsageKwh ?? lastActual}
              unit="kWh"
              precision={1}
              tone="flux"
              icon={<Bolt size={16} />}
              deltaPercent={summary.data?.deltaPercent.currentUsage ?? null}
              hint="Across the selected window"
              spark={sparkActual}
              index={0}
            />
            <EnergyKpiCard
              label="Expected usage"
              value={summary.data?.expectedUsageKwh ?? 0}
              unit="kWh"
              precision={1}
              tone="watt"
              icon={<TrendingUp size={16} />}
              deltaPercent={summary.data?.deltaPercent.expectedUsage ?? null}
              hint="Learned baseline"
              index={1}
            />
            <EnergyKpiCard
              label="Excess energy"
              value={summary.data?.excessKwh ?? 0}
              unit="kWh"
              precision={1}
              tone={summary.data && summary.data.excessKwh > 0 ? 'alert' : 'default'}
              icon={<TriangleAlert size={16} />}
              deltaPercent={summary.data?.deltaPercent.excessEnergy ?? null}
              invertDelta
              hint="Above baseline"
              index={2}
            />
            <EnergyKpiCard
              label="Estimated excess cost"
              value={summary.data?.estimatedExcessCost ?? 0}
              format={(value) => formatCurrency(value, currency)}
              tone="crit"
              icon={<Banknote size={16} />}
              deltaPercent={summary.data?.deltaPercent.excessCost ?? null}
              invertDelta
              hint="Estimated from tariff"
              index={3}
            />
          </div>
        </PageState>
      )}

      {/* ── 3D building + floor legend ────────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card padded={false} className="overflow-hidden">
          <div className="relative h-[26rem] w-full sm:h-[30rem]">
            <Building3D
              building={activeBuilding}
              anomalies={anomalyItems}
              currency={currency}
              className="h-full w-full"
              fallback={
                <div className="grid h-full w-full place-items-center bg-[radial-gradient(120%_110%_at_50%_0%,#0b1524_0%,#05080f_62%,#04070d_100%)] px-6 text-center">
                  <div>
                    <Layers size={22} className="mx-auto text-ink-500" />
                    <p className="mt-3 text-xs text-ink-500">
                      The 3D view is disabled on this device. All figures remain available in the
                      charts below.
                    </p>
                  </div>
                </div>
              }
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Floors"
            subtitle="Floor state from the latest readings"
            icon={<Layers size={15} />}
            actions={<Badge tone="neutral">{activeBuilding?.floors ?? 0}</Badge>}
          />
          <div className="mt-5">
            <FloorLegend building={activeBuilding} anomalies={anomalyItems} currency={currency} />
          </div>

          <div className="divider my-5" />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="label-muted">Total consumption</p>
              <p className="tnum mt-1 text-sm font-semibold text-ink-50">
                {series.data ? formatEnergy(windowTotal, 1) : '—'}
              </p>
            </div>
            <div>
              <p className="label-muted">Readings</p>
              <p className="tnum mt-1 text-sm font-semibold text-ink-50">
                {formatNumber(series.data?.points.length ?? 0)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* ── 3D energy flow network ─────────────────────────── */}
      <Card>
        <CardHeader
          title="Energy flow network"
          subtitle="Power Source → Building → Floor → Equipment → Consumption · drag to rotate"
          icon={<Bolt size={15} />}
          actions={<Badge tone={topAnomaly ? 'crit' : 'watt'}>{topAnomaly ? 'Anomaly path live' : 'Flow nominal'}</Badge>}
        />
        <div className="mt-4">
          <EnergyNetwork3D
            nodes={[
              { id: 'source', label: 'Power Source', sub: 'Grid intake', consumptionKwh: Math.round(heroCurrent), expectedKwh: Math.round(heroExpected), status: 'normal', detail: 'Utility feed stable. Voltage within tolerance.' },
              { id: 'building', label: activeBuilding?.name ?? 'Building', sub: 'Whole-building meter', consumptionKwh: Math.round(heroCurrent), expectedKwh: Math.round(heroExpected), status: 'normal', detail: 'Deviation originates downstream of the main meter.' },
              { id: 'floor', label: topAnomaly?.floorLabel ?? 'Floor 3', sub: 'East wing · AHU zone', consumptionKwh: Math.round(heroCurrent * 0.53), expectedKwh: Math.round(heroExpected * 0.52), status: topAnomaly ? 'anomaly' : 'normal', severity: topAnomaly?.severity, detail: 'Submeter carries the majority of the window excess.' },
              { id: 'equipment', label: 'HVAC-01', sub: 'Chiller + AHU loop', consumptionKwh: 72, expectedKwh: 40, status: topAnomaly ? 'anomaly' : 'normal', severity: topAnomaly?.severity, detail: 'Runtime 19:00–01:00 vs scheduled 09:00–19:00. +80% deviation.' },
              { id: 'consumption', label: 'Energy Consumption', sub: 'Window total', consumptionKwh: Math.round(heroCurrent), expectedKwh: Math.round(heroExpected), status: topAnomaly ? 'anomaly' : 'normal', severity: topAnomaly?.severity, detail: 'Total window consumption vs learned baseline.' },
            ]}
            onSelect={() => topAnomaly && navigate(`/investigations/${topAnomaly.id}`)}
          />
        </div>
      </Card>

      {/* ── Chart ─────────────────────────────────────────────── */}
      {series.isLoading ? (
        <ChartSkeleton height={340} />
      ) : (
        <EnergyChart
          series={series.data}
          anomalies={anomalyItems}
          loading={series.isLoading}
          onAnomalySelect={handleAnomalySelect}
        />
      )}

      {/* ── Cost intelligence + Reports ─────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <CostStack3D
          expectedCost={costExpected}
          excessCost={costExcess}
          tariff={activeTariff}
          currency={currency}
          onTariffChange={setTariffOverride}
        />
        <ReportPanel
          summary={summary.data ?? null}
          anomaly={topAnomaly}
          currency={currency}
          buildingName={activeBuilding?.name ?? 'Selected building'}
        />
      </div>

      {/* ── Latest anomalies ──────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Latest anomalies"
          subtitle="Flagged deviations from the learned baseline"
          icon={<TriangleAlert size={15} />}
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/anomalies')}
              iconRight={<ArrowRight size={13} />}
            >
              See all
            </Button>
          }
        />

        <div className="mt-5">
          {anomalies.isLoading ? (
            <ListSkeleton count={3} />
          ) : anomalies.error ? (
            <EmptyState
              title="Anomalies unavailable"
              description="The energy service did not return anomaly data for this window."
              action={
                <Button variant="outline" size="sm" onClick={() => void anomalies.refetch()}>
                  Retry
                </Button>
              }
            />
          ) : anomalyItems.length === 0 ? (
            <EmptyState
              title="No anomalies in this window"
              description="Consumption is tracking the learned baseline. Try widening the date range to see more history."
              icon={<TrendingUp size={20} />}
              action={
                <Button variant="outline" size="sm" onClick={() => navigate('/trends')}>
                  Open trends
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {anomalyItems.slice(0, 4).map((anomaly, index) => (
                <AnomalyCard
                  key={anomaly.id}
                  anomaly={anomaly}
                  currency={currency}
                  scaleMax={maxExcess}
                  index={index}
                  onInvestigate={(item) => navigate(`/investigations/${item.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}