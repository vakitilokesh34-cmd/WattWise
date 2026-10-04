import { memo } from 'react'
import { NavLink } from 'react-router-dom'
import {
  BarChart3,
  Building2,
  CircleDollarSign,
  FileSearch,
  FileText,
  Home,
  Settings,
  X,
  Zap,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useWorkspace } from '@/context/WorkspaceContext'

export interface NavItem {
  to: string
  label: string
  icon: typeof Home
  /** Short label used in the mobile bottom bar. */
  shortLabel: string
  end?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Overview', shortLabel: 'Home', icon: Home },
  { to: '/trends', label: 'Energy Analytics', shortLabel: 'Analytics', icon: BarChart3 },
  { to: '/anomalies', label: 'Anomalies', shortLabel: 'Anomalies', icon: Zap },
  { to: '/investigations', label: 'Investigations', shortLabel: 'Investigate', icon: FileSearch },
  { to: '/cost-impact', label: 'Cost Intelligence', shortLabel: 'Cost', icon: CircleDollarSign },
  { to: '/reports', label: 'Reports', shortLabel: 'Reports', icon: FileText },
  { to: '/settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
]

interface SidebarContentProps {
  activeCount: number
  onNavigate?: () => void
}

function SidebarContent({ activeCount, onNavigate }: SidebarContentProps) {
  const { activeBuilding, mode } = useWorkspace()

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-flux-400/30 bg-flux-500/12 text-flux-300 shadow-[0_0_22px_-8px_rgba(34,211,238,0.9)]">
          <Zap size={17} />
          <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-ink-50">WattWise</p>
          <p className="truncate text-[10px] font-medium uppercase tracking-[0.18em] text-ink-500">
            Energy Intelligence
          </p>
        </div>
      </div>

      <div className="divider" />

      {/* Active building context */}
      <div className="px-3 pt-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Building2 size={12} className="shrink-0 text-ink-500" />
            <span className="label-muted truncate">Active building</span>
          </div>
          <p className="mt-1 truncate text-xs font-semibold text-ink-100">
            {activeBuilding?.name ?? 'No building selected'}
          </p>
          {activeBuilding ? (
            <p className="mt-0.5 truncate text-2xs text-ink-500">
              {activeBuilding.location} · {activeBuilding.floors} floors
            </p>
          ) : null}
        </div>
      </div>

      {/* Navigation */}
      <nav className="mt-3 flex-1 overflow-y-auto px-3 pb-3" aria-label="Primary">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-medium transition duration-200',
                      isActive
                        ? 'bg-flux-500/12 text-flux-200 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.22)]'
                        : 'text-ink-300 hover:bg-white/[0.045] hover:text-ink-50',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive ? (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full bg-flux-300"
                        />
                      ) : null}
                      <Icon
                        size={15}
                        className={cn('shrink-0 transition', isActive ? 'text-flux-300' : 'text-ink-500')}
                      />
                      <span className="truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer status */}
      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <div className="min-w-0">
            <p className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-500">Active alerts</p>
            <p className="tnum mt-0.5 text-sm font-semibold text-ink-100">
              {activeCount > 0 ? (
                <span className="text-crit-300">{activeCount}</span>
              ) : (
                <span className="text-watt-300">0</span>
              )}
            </p>
          </div>
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider',
              mode === 'live'
                ? 'border-watt-400/30 bg-watt-400/10 text-watt-300'
                : 'border-alert-500/30 bg-alert-500/10 text-alert-300',
            )}
          >
            {mode}
          </span>
        </div>
      </div>
    </div>
  )
}

export interface SidebarProps {
  /** Mobile drawer visibility. */
  open: boolean
  onClose: () => void
  activeCount: number
  className?: string
}

/**
 * Persistent sidebar on ≥ lg, slide-over drawer below it. The mobile bottom bar
 * is rendered by <AppShell> so primary navigation never requires opening a menu.
 */
function SidebarComponent({ open, onClose, activeCount, className }: SidebarProps) {
  return (
    <>
      {/* Desktop rail */}
      <aside
        className={cn(
          'hidden shrink-0 border-r border-white/[0.06] bg-base-900/70 backdrop-blur-xl lg:block',
          'sticky top-0 h-screen w-[16.5rem]',
          className,
        )}
      >
        <SidebarContent activeCount={activeCount} />
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="absolute inset-0 animate-fade-up bg-base-950/70 backdrop-blur-sm"
          />
          <aside
            className={cn(
              'glass-strong absolute inset-y-0 left-0 w-[17rem] max-w-[82vw] rounded-none border-y-0 border-l-0',
              'animate-fade-up',
            )}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation"
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-ink-300 transition hover:text-ink-50"
            >
              <X size={15} />
            </button>
            <SidebarContent activeCount={activeCount} onNavigate={onClose} />
          </aside>
        </div>
      ) : null}
    </>
  )
}

export const Sidebar = memo(SidebarComponent)

/** Fixed bottom navigation for small screens. */
export const MobileNavBar = memo(function MobileNavBar({ activeCount }: { activeCount: number }) {
  const items = NAV_ITEMS.filter((item) => item.to !== '/settings')

  return (
    <nav
      aria-label="Primary mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] bg-base-900/90 backdrop-blur-xl lg:hidden"
    >
      <ul className="stack-safe flex items-stretch justify-around">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'relative flex flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-medium transition',
                    isActive ? 'text-flux-300' : 'text-ink-500',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-4 top-0 h-[2px] rounded-b-full bg-flux-300"
                      />
                    ) : null}
                    <span className="relative">
                      <Icon size={17} />
                      {item.to === '/anomalies' && activeCount > 0 ? (
                        <span className="absolute -right-1.5 -top-1 grid h-3.5 min-w-[0.875rem] place-items-center rounded-full bg-crit-500 px-1 text-[9px] font-bold text-white">
                          {activeCount > 9 ? '9+' : activeCount}
                        </span>
                      ) : null}
                    </span>
                    <span className="truncate">{item.shortLabel}</span>
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
})