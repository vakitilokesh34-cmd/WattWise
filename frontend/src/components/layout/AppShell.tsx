import { Suspense, useCallback, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useQuery } from '@/hooks/useQuery'
import { useScrollLock } from '@/hooks/useDeviceProfile'
import { useWorkspace } from '@/context/WorkspaceContext'
import { wattwiseApi } from '@/services/api'
import type { Anomaly, DashboardSummary } from '@/types'
import { MobileNavBar, Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { RouteErrorBoundary } from './RouteErrorBoundary'

function RouteFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span className="relative grid h-12 w-12 place-items-center rounded-2xl border border-flux-400/25 bg-flux-500/10 text-flux-300">
          <Loader2 size={20} className="animate-spin" />
        </span>
        <p className="text-xs text-ink-500">Loading view…</p>
      </div>
    </div>
  )
}

/**
 * Persistent application chrome: sidebar, top bar, mobile bottom nav and the
 * routed outlet. The summary/anomaly probes below share the API cache with the
 * pages, so the status pills cost at most one extra request per scope change.
 */
export function AppShell() {
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)
  const { activeBuildingId, range, liveAnomalies } = useWorkspace()

  useScrollLock(navOpen)

  const summaryKey = useMemo(
    () => (activeBuildingId ? `summary:${activeBuildingId}:${range.from}:${range.to}` : null),
    [activeBuildingId, range.from, range.to],
  )

  const anomaliesKey = useMemo(
    () => (activeBuildingId ? `anomalies:${activeBuildingId}:${range.from}:${range.to}` : null),
    [activeBuildingId, range.from, range.to],
  )

  const summary = useQuery<DashboardSummary>(summaryKey, () =>
    wattwiseApi.getDashboardSummary({
      buildingId: activeBuildingId,
      from: range.from,
      to: range.to,
    }),
  )

  const anomalies = useQuery(anomaliesKey, () =>
    wattwiseApi.getAnomalies({
      buildingId: activeBuildingId,
      from: range.from,
      to: range.to,
    }),
  )

  const activeCount = useMemo(() => {
    const merged = new Map<string, Anomaly>()

    for (const item of anomalies.data?.items ?? []) merged.set(item.id, item)

    // Fold in anomalies that arrived over the realtime channel since the last
    // list refetch, so the badge updates without polling the API again.
    for (const item of liveAnomalies) {
      if (item.buildingId !== activeBuildingId) continue
      if (Date.parse(item.start) < Date.parse(range.from)) continue
      if (Date.parse(item.start) > Date.parse(range.to)) continue
      if (!merged.has(item.id)) merged.set(item.id, item)
    }

    let count = 0
    for (const item of merged.values()) {
      if (item.status === 'new' || item.status === 'investigating') count += 1
    }
    return count
  }, [anomalies.data, liveAnomalies, activeBuildingId, range.from, range.to])

  const openNav = useCallback(() => setNavOpen(true), [])
  const closeNav = useCallback(() => setNavOpen(false), [])

  return (
    <div className="flex min-h-screen bg-base-950">
      <Sidebar open={navOpen} onClose={closeNav} activeCount={activeCount} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onOpenNav={openNav}
          dataStatus={summary.data?.dataStatus}
          modelStatus={summary.data?.modelStatus}
        />

        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-flux-500 focus:px-3 focus:py-2 focus:text-xs focus:font-semibold focus:text-base-950"
        >
          Skip to content
        </a>

        <main
          id="main-content"
          className={cn('min-w-0 flex-1 px-3 pb-24 pt-5 sm:px-5 lg:px-6 lg:pb-10 lg:pt-6')}
        >
          <RouteErrorBoundary resetKey={location.pathname}>
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </RouteErrorBoundary>
        </main>
      </div>

      <MobileNavBar activeCount={activeCount} />
    </div>
  )
}