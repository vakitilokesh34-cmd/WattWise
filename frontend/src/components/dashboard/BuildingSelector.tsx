import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Building2, Check, ChevronDown, MapPin, Search, Layers } from 'lucide-react'
import { cn } from '@/utils/cn'
import { formatNumber } from '@/utils/format'
import { useWorkspace } from '@/context/WorkspaceContext'

/**
 * Building selector. Renders `loading` / `error` / `empty` states so the top
 * bar never silently shows a blank control.
 */
export function BuildingSelector({ className }: { className?: string }) {
  const { buildings, activeBuilding, setActiveBuildingId } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return buildings
    return buildings.filter(
      (b) =>
        b.name.toLowerCase().includes(needle) || b.location.toLowerCase().includes(needle),
    )
  }, [buildings, search])

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select building"
        className={cn(
          'group flex h-10 w-full min-w-0 items-center gap-2.5 rounded-xl border px-3 text-left transition duration-200',
          open
            ? 'border-flux-400/40 bg-flux-500/[0.08]'
            : 'border-white/[0.08] bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.06]',
        )}
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-flux-400/25 bg-flux-500/10 text-flux-300">
          <Building2 size={14} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-2xs font-medium uppercase tracking-[0.14em] text-ink-500">
            Building
          </span>
          <span className="block truncate text-xs font-semibold text-ink-50">
            {activeBuilding ? activeBuilding.name : buildings.length === 0 ? 'No buildings' : 'Select…'}
          </span>
        </span>
        <ChevronDown
          size={14}
          className={cn('shrink-0 text-ink-500 transition duration-200', open && 'rotate-180')}
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.985 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl"
          >
            {buildings.length > 5 ? (
              <div className="border-b border-white/[0.06] p-2.5">
                <div className="relative">
                  <Search
                    size={13}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500"
                  />
                  <input
                    autoFocus
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search buildings…"
                    className="h-8 w-full rounded-lg border border-white/[0.08] bg-white/[0.035] pl-8 pr-3 text-xs text-ink-100 placeholder:text-ink-500 focus:border-flux-400/40 focus:outline-none"
                  />
                </div>
              </div>
            ) : null}

            <ul role="listbox" className="max-h-72 overflow-y-auto p-1.5">
              {filtered.length === 0 ? (
                <li className="px-3 py-6 text-center text-xs text-ink-500">
                  {buildings.length === 0
                    ? 'No buildings returned by the service.'
                    : 'No buildings match your search.'}
                </li>
              ) : (
                filtered.map((building) => {
                  const active = building.id === activeBuilding?.id
                  return (
                    <li key={building.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          setActiveBuildingId(building.id)
                          setOpen(false)
                          setSearch('')
                        }}
                        className={cn(
                          'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition',
                          active ? 'bg-flux-500/10' : 'hover:bg-white/[0.045]',
                        )}
                      >
                        <span
                          className={cn(
                            'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border',
                            active
                              ? 'border-flux-400/40 bg-flux-500/15 text-flux-300'
                              : 'border-white/10 bg-white/[0.03] text-ink-400',
                          )}
                        >
                          {active ? <Check size={13} /> : <Building2 size={13} />}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-ink-50">
                            {building.name}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-2xs text-ink-500">
                            <span className="inline-flex items-center gap-1">
                              <MapPin size={9} />
                              {building.location}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Layers size={9} />
                              {building.floors} floors
                            </span>
                            {building.areaSqFt > 0 ? (
                              <span>{formatNumber(building.areaSqFt)} sq ft</span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
