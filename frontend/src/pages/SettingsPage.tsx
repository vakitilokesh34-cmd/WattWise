import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Bell,
  Boxes,
  Check,
  CloudCog,
  Database,
  Gauge,
  Radio,
  RefreshCw,
  Settings2,
  Sparkles,
  Trash2,
  Wifi,
} from 'lucide-react'
import type { Building, DashboardSummary } from '@/types'
import { formatNumber } from '@/utils/format'
import { formatRelative } from '@/utils/date'
import { apiConfig, getHealthReport, invalidate, wattwiseApi } from '@/services/api'
import { describeConfig } from '@/services/config'
import { useDeviceProfile } from '@/hooks/useDeviceProfile'
import { useQuery } from '@/hooks/useQuery'
import { useWorkspace } from '@/context/WorkspaceContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { KeyValueRow, ProgressBar } from '@/components/ui/DataDisplay'
import { Select, TextInput, Toggle } from '@/components/ui/Form'
import { DataStatusIndicator } from '@/components/dashboard/DataStatus'
import { ModelStatus } from '@/components/dashboard/ModelStatus'

const STATE_TONE = {
  online: 'watt',
  degraded: 'alert',
  offline: 'crit',
  checking: 'flux',
} as const

/**
 * SETTINGS / DIAGNOSTICS
 *
 * Read-only view of the resolved runtime configuration plus the controls that
 * actually exist client-side: building selection, notification hygiene and
 * cache invalidation. Nothing here can fabricate backend configuration.
 */
export default function SettingsPage() {
  const {
    buildings,
    activeBuildingId,
    setActiveBuildingId,
    range,
    rangePresetKey,
    setRangePreset,
    mode,
    realtimeStatus,
    realtimeEnabled,
    lastEventAt,
    unreadCount,
    notifications,
    clearNotifications,
    markAllNotificationsRead,
    refreshSignal,
  } = useWorkspace()

  const profile = useDeviceProfile()
  const config = useMemo(() => describeConfig(), [])
  const [health, setHealth] = useState(() => getHealthReport())
  const [checking, setChecking] = useState(false)
  const [buildingDraft, setBuildingDraft] = useState(activeBuildingId)
  const [desktopAlerts, setDesktopAlerts] = useState(
    () => typeof window !== 'undefined' && window.Notification?.permission === 'granted',
  )

  const summaryKey = activeBuildingId
    ? `summary:${activeBuildingId}:${range.from}:${range.to}`
    : null
  const summary = useQuery<DashboardSummary>(summaryKey, () =>
    wattwiseApi.getDashboardSummary({
      buildingId: activeBuildingId,
      from: range.from,
      to: range.to,
    }),
  )

  useEffect(() => setBuildingDraft(activeBuildingId), [activeBuildingId])

  const recheck = useCallback(async () => {
    setChecking(true)
    const report = await wattwiseApi.health(true)
    setHealth(report)
    setChecking(false)
    refreshSignal()
  }, [refreshSignal])

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        subtitle="Runtime configuration, connection diagnostics and workspace preferences."
        icon={<Settings2 size={19} />}
        meta={
          <>
            <Badge tone={STATE_TONE[health.state]}>API {health.state}</Badge>
            <Badge tone={mode === 'live' ? 'watt' : 'flux'}>
              {mode === 'live' ? 'Live backend' : 'Deterministic mock data'}
            </Badge>
            <Badge tone={realtimeEnabled ? 'flux' : 'neutral'}>Realtime {realtimeStatus}</Badge>
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                invalidate()
                refreshSignal()
              }}
              iconLeft={<Trash2 size={13} />}
            >
              Clear cache
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void recheck()}
              loading={checking}
              iconLeft={checking ? undefined : <RefreshCw size={13} />}
            >
              Re-check API
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── Workspace ─────────────────────────────────────── */}
        <Card>
          <CardHeader title="Workspace" subtitle="Applies to this browser" icon={<Gauge size={15} />} />

          <div className="mt-5 space-y-4">
            <Select
              label="Active building"
              value={buildingDraft}
              onChange={(event) => {
                setBuildingDraft(event.target.value)
                setActiveBuildingId(event.target.value)
              }}
              hint="Changing this clears the response cache and refetches every view."
            >
              {buildings.length === 0 ? (
                <option value="">No buildings reported</option>
              ) : null}
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {building.name}
                </option>
              ))}
            </Select>

            <Select
              label="Default range"
              value={rangePresetKey}
              onChange={(event) => setRangePreset(event.target.value)}
              hint={`Current window: ${range.label || 'custom range'}`}
            >
              <option value="custom" disabled>
                Custom range
              </option>
              <option value="shift">Last 8h</option>
              <option value="day">Today</option>
              <option value="3d">3 days</option>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
            </Select>

            {buildings.length > 0 ? (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="label-muted">Building facts as reported</p>
                <div className="mt-2">
                  {buildings
                    .filter((building) => building.id === buildingDraft)
                    .map((building) => (
                      <BuildingFacts key={building.id} building={building} />
                    ))}
                </div>
              </div>
            ) : null}
          </div>
        </Card>

        {/* ── Connection ────────────────────────────────────── */}
        <Card>
          <CardHeader
            title="Connection"
            subtitle="Transport resolution and fallback state"
            icon={<Wifi size={15} />}
            actions={
              <Badge tone={mode === 'live' ? 'watt' : 'flux'}>{mode}</Badge>
            }
          />

          <div className="mt-5">
            <KeyValueRow
              label="Base URL"
              value={<span className="font-mono text-2xs">{config.baseUrl}</span>}
              hint="VITE_API_BASE_URL"
            />
            <KeyValueRow
              label="Configured mode"
              value={config.mode}
              hint="live · mock · auto"
            />
            <KeyValueRow
              label="Active transport"
              value={mode === 'live' ? 'liveTransport' : 'mock/transport'}
              tone={mode === 'live' ? 'default' : 'flux'}
              hint={mode === 'live' ? 'Axios' : 'Deterministic generator'}
            />
            <KeyValueRow
              label="Mock fallback"
              value={config.mockFallbackEnabled ? 'Enabled' : 'Disabled'}
              hint="Only for connectivity/timeout failures in auto mode"
              tone={config.mockFallbackEnabled ? 'flux' : 'default'}
            />
            <KeyValueRow label="Timeout" value={`${formatNumber(config.timeoutMs)} ms`} />
            <KeyValueRow
              label="Health latency"
              value={health.latencyMs === null ? '—' : `${formatNumber(health.latencyMs)} ms`}
              hint={`Checked ${formatRelative(health.checkedAt)}`}
            />
            {health.version ? (
              <KeyValueRow label="API version" value={<span className="font-mono text-2xs">{health.version}</span>} />
            ) : null}
          </div>

          {config.mode === 'auto' ? (
            <p className="mt-4 flex items-start gap-2 text-2xs leading-relaxed text-ink-500">
              <AlertTriangle size={12} className="mt-0.5 shrink-0 text-alert-400" />
              In auto mode the app probes the backend once at start-up and only falls back to mock data
              when the API is unreachable. Set VITE_API_MODE=live to surface backend errors instead.
            </p>
          ) : null}
        </Card>

        {/* ── Realtime ──────────────────────────────────────── */}
        <Card>
          <CardHeader
            title="Realtime channel"
            subtitle="Server-sent events with a polling fallback"
            icon={<Radio size={15} />}
            actions={<Badge tone={realtimeEnabled ? 'flux' : 'neutral'}>{realtimeEnabled ? 'on' : 'off'}</Badge>}
          />
          <div className="mt-5">
            <KeyValueRow label="Transport" value={config.realtime.transport} />
            <KeyValueRow label="SSE path" value={<span className="font-mono text-2xs">{config.realtime.ssePath}</span>} />
            <KeyValueRow label="Poll interval" value={`${formatNumber(config.realtime.pollMs)} ms`} />
            <KeyValueRow label="Status" value={realtimeStatus} tone={realtimeStatus === 'open' ? 'flux' : 'default'} />
            <KeyValueRow label="Last event" value={formatRelative(lastEventAt)} />
          </div>
        </Card>

        {/* ── Rendering budget ──────────────────────────────── */}
        <Card>
          <CardHeader
            title="Rendering budget"
            subtitle="Derived from the device profile, not a preference"
            icon={<Boxes size={15} />}
            actions={<Badge tone="default">{profile.quality}</Badge>}
          />
          <div className="mt-5">
            <KeyValueRow label="Device" value={profile.isMobile ? 'Mobile' : 'Desktop'} />
            <KeyValueRow label="Scene quality" value={profile.quality} />
            <KeyValueRow label="Shadows" value={profile.shadows ? 'Enabled' : 'Disabled'} />
            <KeyValueRow label="Particle budget" value={formatNumber(profile.particleBudget)} />
            <KeyValueRow label="Device pixel ratio" value={profile.dpr.join('–')} />
            <KeyValueRow
              label="Animations"
              value={profile.reducedMotion ? 'Reduced motion' : 'Enabled'}
              tone={profile.reducedMotion ? 'alert' : 'default'}
            />
          </div>
          <div className="mt-4">
            <p className="label-muted">Configured ceiling</p>
            <p className="tnum mt-1 text-2xs text-ink-400">
              {formatNumber(config.scene.maxParticles)} particles · quality {config.scene.quality}
            </p>
            <div className="mt-2">
              <ProgressBar
                value={Math.min(100, (profile.particleBudget / Math.max(1, config.scene.maxParticles)) * 100)}
                tone="flux"
              />
            </div>
          </div>
          <div className="mt-4 flex items-start gap-2 text-2xs leading-relaxed text-ink-500">
            <Sparkles size={12} className="mt-0.5 shrink-0 text-flux-300" />
            The 3D scene is skipped entirely when VITE_ENABLE_3D=false or the device profile reports
            low capability; every figure remains available in the charts.
          </div>
        </Card>

        {/* ── Data & uploads ────────────────────────────────── */}
        <Card>
          <CardHeader title="Data & uploads" subtitle="Ingestion limits" icon={<Database size={15} />} />
          <div className="mt-5">
            <KeyValueRow label="Max upload size" value={`${formatNumber(config.upload.maxMb)} MB`} />
            <KeyValueRow
              label="Accepted types"
              value={<span className="font-mono text-2xs">{config.upload.accept}</span>}
            />
            <KeyValueRow
              label="Endpoints"
              value={
                <span className="font-mono text-2xs">
                  {config.baseUrl}/energy/upload
                </span>
              }
            />
          </div>
          <p className="mt-4 text-2xs leading-relaxed text-ink-500">
            Uploaded rows are validated and cleaned server-side. Rejected rows are reported back on the
            upload page; the frontend never imputes meter data itself.
          </p>
        </Card>

        {/* ── Notifications ─────────────────────────────────── */}
        <Card>
          <CardHeader
            title="Notifications"
            subtitle="Stored locally in this browser"
            icon={<Bell size={15} />}
            actions={<Badge tone={unreadCount > 0 ? 'alert' : 'watt'}>{unreadCount} unread</Badge>}
          />

          <div className="mt-5 space-y-3">
            <Toggle
              checked={desktopAlerts}
              onChange={() => {
                if (typeof window === 'undefined' || !window.Notification) return
                void window.Notification.requestPermission().then((permission) => {
                  setDesktopAlerts(permission === 'granted')
                })
              }}
              label="Browser notifications"
              description="Ask this browser for permission to show alerts. In-app notifications always work."
              disabled={typeof window === 'undefined' || !window.Notification}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={markAllNotificationsRead} iconLeft={<Check size={13} />}>
                Mark all read
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearNotifications}
                disabled={notifications.length === 0}
                iconLeft={<Trash2 size={13} />}
              >
                Clear history
              </Button>
            </div>
            <p className="text-2xs text-ink-500">
              {formatNumber(notifications.length)} stored · cap 60 · newest first
            </p>
          </div>
        </Card>

        {/* ── Service status ────────────────────────────────── */}
        <Card>
          <CardHeader
            title="Service status"
            subtitle="Reported by the API for the active building"
            icon={<Activity size={15} />}
            actions={
              summary.dataUpdatedAt ? (
                <Badge tone="neutral">Updated {formatRelative(new Date(summary.dataUpdatedAt).toISOString())}</Badge>
              ) : null
            }
          />

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <DataStatusIndicator status={summary.data?.dataStatus} />
            <ModelStatus status={summary.data?.modelStatus} />
          </div>

          <div className="mt-5">
            <KeyValueRow
              label="Reading coverage"
              value={
                summary.data ? `${summary.data.dataStatus.coveragePercent.toFixed(1)}%` : '—'
              }
              hint={`Interval ${summary.data ? `${summary.data.dataStatus.intervalMinutes} min` : '—'}`}
            />
            <KeyValueRow
              label="Detection accuracy"
              value={
                summary.data?.modelStatus.accuracy != null
                  ? `${summary.data.modelStatus.accuracy.toFixed(1)}%`
                  : 'Not reported'
              }
              hint={summary.data?.modelStatus.baselineMethod ?? undefined}
            />
            <KeyValueRow
              label="Active anomalies"
              value={summary.data ? formatNumber(summary.data.activeAnomalyCount) : '—'}
            />
            <KeyValueRow
              label="Summary generated"
              value={summary.data ? formatRelative(summary.data.generatedAt) : '—'}
            />
          </div>

          {summary.error ? (
            <p className="mt-4 text-2xs text-crit-300">
              The summary endpoint is unavailable: {summary.error.message}
            </p>
          ) : null}
        </Card>

        {/* ── Diagnostics ───────────────────────────────────── */}
        <Card>
          <CardHeader title="Diagnostics" subtitle="Copy-friendly state summary" icon={<CloudCog size={15} />} />
          <ul className="mt-4 space-y-2 text-2xs text-ink-400">
            <li className="flex items-start gap-2">
              <Activity size={12} className="mt-0.5 shrink-0 text-flux-300" />
              Routes are lazy-loaded; three.js is only fetched on the dashboard.
            </li>
            <li className="flex items-start gap-2">
              <Activity size={12} className="mt-0.5 shrink-0 text-flux-300" />
              API responses are cached in memory with per-endpoint TTLs and in-flight de-duplication.
            </li>
            <li className="flex items-start gap-2">
              <Activity size={12} className="mt-0.5 shrink-0 text-flux-300" />
              {apiConfig.scene.animationsEnabled ? 'Animations enabled by configuration' : 'Animations disabled by configuration'}.
            </li>
            <li className="flex items-start gap-2">
              <Activity size={12} className="mt-0.5 shrink-0 text-flux-300" />
              Mock data is deterministic and isolated in src/services/mock — it never mixes with live responses.
            </li>
          </ul>

          <div className="divider my-4" />

          <TextInput
            label="Diagnostics string"
            readOnly
            value={`mode=${mode} api=${config.baseUrl} health=${health.state} realtime=${realtimeStatus} building=${activeBuildingId} window=${range.label || 'custom'}`}
            onChange={() => undefined}
            className="font-mono text-2xs"
          />

          <p className="mt-3 text-2xs leading-relaxed text-ink-500">
            Coverage and detection accuracy are reported by the API and shown on the dashboard; the
            frontend does not compute or estimate them.
          </p>
        </Card>
      </div>
    </div>
  )
}

/* ── Helpers ───────────────────────────────────────────────── */

function BuildingFacts({ building }: { building: Building }) {
  return (
    <div className="mt-1">
      <KeyValueRow label="Location" value={building.location} />
      <KeyValueRow label="Floors" value={formatNumber(building.floors)} />
      <KeyValueRow label="Area" value={`${formatNumber(building.areaSqFt)} sq ft`} />
      <KeyValueRow
        label="Tariff"
        value={`${building.tariffRatePerKwh} ${building.currency}/kWh`}
        hint="Used for estimated excess cost only"
      />
      {building.meta?.buildingType ? (
        <KeyValueRow label="Type" value={building.meta.buildingType} />
      ) : null}
      {building.meta?.commissionedOn ? (
        <KeyValueRow label="Commissioned" value={building.meta.commissionedOn.slice(0, 10)} />
      ) : null}
    </div>
  )
}