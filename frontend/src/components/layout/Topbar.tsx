import { memo } from 'react'
import { Menu, RadioTower, RefreshCw } from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatRelative } from '@/utils/date'
import { useWorkspace } from '@/context/WorkspaceContext'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { BuildingSelector } from '@/components/dashboard/BuildingSelector'
import { DateRangeSelector } from '@/components/dashboard/DateRangeSelector'
import { DataStatusIndicator } from '@/components/dashboard/DataStatus'
import { ModelStatus } from '@/components/dashboard/ModelStatus'
import { NotificationCenter } from '@/components/realtime/NotificationCenter'

const REALTIME_META = {
  open: { label: 'Live', dot: 'bg-watt-400', text: 'text-watt-300' },
  connecting: { label: 'Connecting', dot: 'bg-flux-400', text: 'text-flux-300' },
  closed: { label: 'Stream closed', dot: 'bg-alert-400', text: 'text-alert-300' },
  error: { label: 'Stream error', dot: 'bg-crit-400', text: 'text-crit-300' },
  disabled: { label: 'Realtime off', dot: 'bg-ink-500', text: 'text-ink-400' },
} as const

export interface TopbarProps {
  onOpenNav: () => void
  /** Status payload from the dashboard summary, when the page has one. */
  dataStatus?: Parameters<typeof DataStatusIndicator>[0]['status']
  modelStatus?: Parameters<typeof ModelStatus>[0]['status']
  className?: string
}

/**
 * Sticky top bar. Building + range live here so every route shares one global
 * scope; status pills and the notification centre sit on the right.
 */
function TopbarComponent({ onOpenNav, dataStatus, modelStatus, className }: TopbarProps) {
  const { realtimeStatus, realtimeEnabled, lastEventAt, refreshSignal } = useWorkspace()
  const meta = REALTIME_META[realtimeStatus] ?? REALTIME_META.closed

  return (
    <header
      className={cn(
        'sticky top-0 z-30 border-b border-white/[0.06] bg-base-950/80 backdrop-blur-xl',
        className,
      )}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5 sm:px-5">
        {/* Mobile nav trigger */}
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Open navigation"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-ink-200 transition hover:border-white/20 hover:text-ink-50 lg:hidden"
        >
          <Menu size={17} />
        </button>

        {/* Global scope */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <BuildingSelector className="w-full max-w-[13.5rem] shrink-0" />
          <DateRangeSelector className="hidden w-full max-w-[12.5rem] shrink-0 sm:block" />
        </div>

        {/* Right cluster */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 xl:flex">
            <Tooltip content={lastEventAt ? `Last event ${formatRelative(lastEventAt)}` : 'No events yet'}>
              <span
                className={cn(
                  'inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 text-2xs font-semibold uppercase tracking-[0.1em]',
                  meta.text,
                )}
              >
                <RadioTower size={11} />
                {meta.label}
              </span>
            </Tooltip>

            <DataStatusIndicator status={dataStatus} compact />
            <ModelStatus status={modelStatus} compact />
          </div>

          <Tooltip content="Refresh all data">
            <Button
              variant="ghost"
              size="icon"
              onClick={refreshSignal}
              aria-label="Refresh data"
              className="h-9 w-9"
            >
              <RefreshCw size={15} />
            </Button>
          </Tooltip>

          <NotificationCenter />
        </div>
      </div>

      {/* Realtime strip on mid-size screens where the pills do not fit */}
      {realtimeEnabled ? (
        <div className="flex items-center gap-2 overflow-x-auto border-t border-white/[0.05] px-3 py-2 no-scrollbar sm:px-5 xl:hidden">
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]',
              meta.text,
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
            {meta.label}
          </span>
          <DataStatusIndicator status={dataStatus} compact />
          <ModelStatus status={modelStatus} compact />
        </div>
      ) : null}
    </header>
  )
}

export const Topbar = memo(TopbarComponent)