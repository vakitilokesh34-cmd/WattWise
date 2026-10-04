import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, CheckCheck, Radio, Trash2, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/utils/cn'
import { formatRelative } from '@/utils/date'
import { SEVERITY_STYLES } from '@/utils/format'
import { useWorkspace } from '@/context/WorkspaceContext'
import type { Notification } from '@/types'
import { Tooltip } from '@/components/ui/Tooltip'
import { EmptyState } from '@/components/ui/States'

export function NotificationCenter() {
  const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead, clearNotifications, realtimeStatus } =
    useWorkspace()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

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

  const openItem = useCallback(
    (notification: Notification) => {
      markNotificationRead(notification.id)
      setOpen(false)
      if (notification.href) navigate(notification.href)
    },
    [markNotificationRead, navigate],
  )

  return (
    <div className="relative" ref={containerRef}>
      <Tooltip content={unreadCount > 0 ? `${unreadCount} unread alerts` : 'No unread alerts'}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={`Notifications (${unreadCount} unread)`}
          aria-expanded={open}
          className={cn(
            'relative grid h-9 w-9 place-items-center rounded-xl border transition duration-200',
            open
              ? 'border-flux-400/40 bg-flux-500/10 text-flux-300'
              : 'border-white/[0.08] bg-white/[0.035] text-ink-300 hover:border-white/20 hover:text-ink-50',
          )}
        >
          <Bell size={16} />
          {unreadCount > 0 ? (
            <span className="tnum absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-crit-500 px-1 text-[10px] font-bold text-white shadow-[0_0_10px_-1px_rgba(244,63,94,0.9)]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
          {realtimeStatus === 'open' ? (
            <span className="absolute -bottom-0.5 -left-0.5 h-2 w-2 rounded-full bg-watt-400 ring-2 ring-base-950" />
          ) : null}
        </button>
      </Tooltip>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong absolute right-0 top-[calc(100%+0.6rem)] z-50 flex max-h-[70vh] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl"
          >
            <header className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-flux-300">
                  <Zap size={13} />
                </span>
                <div>
                  <h3 className="text-xs font-semibold text-ink-50">Notifications</h3>
                  <p className="text-2xs text-ink-500">
                    {realtimeStatus === 'open' ? 'Live feed connected' : 'Live feed paused'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={markAllNotificationsRead}
                  disabled={unreadCount === 0}
                  aria-label="Mark all as read"
                  className="grid h-7 w-7 place-items-center rounded-lg text-ink-400 transition hover:bg-white/[0.06] hover:text-ink-100 disabled:opacity-40"
                >
                  <CheckCheck size={13} />
                </button>
                <button
                  type="button"
                  onClick={clearNotifications}
                  disabled={notifications.length === 0}
                  aria-label="Clear notifications"
                  className="grid h-7 w-7 place-items-center rounded-lg text-ink-400 transition hover:bg-white/[0.06] hover:text-crit-300 disabled:opacity-40"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={<Radio size={18} />}
                    title="Nothing to review"
                    description="Anomaly, model and data-pipeline alerts will appear here as soon as the service reports them."
                    className="border-0 bg-transparent py-8 shadow-none backdrop-blur-none"
                  />
                </div>
              ) : (
                <ul className="divide-y divide-white/[0.05]">
                  {notifications.map((notification) => (
                    <NotificationRow
                      key={notification.id}
                      notification={notification}
                      onClick={() => openItem(notification)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function NotificationRow({
  notification,
  onClick,
}: {
  notification: Notification
  onClick: () => void
}) {
  const severity = notification.severity === 'info' ? null : notification.severity
  const dotClass = severity ? SEVERITY_STYLES[severity].dot : 'bg-flux-400'

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/[0.035]',
          !notification.read && 'bg-flux-500/[0.045]',
        )}
      >
        <span className="relative mt-1.5 flex h-2 w-2 shrink-0">
          {!notification.read ? (
            <span className={cn('absolute h-full w-full animate-ping rounded-full opacity-50', dotClass)} />
          ) : null}
          <span className={cn('relative h-2 w-2 rounded-full', dotClass)} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                'truncate text-xs font-semibold',
                notification.read ? 'text-ink-200' : 'text-ink-50',
              )}
            >
              {notification.title}
            </span>
            <span className="shrink-0 text-2xs text-ink-500">{formatRelative(notification.createdAt)}</span>
          </span>
          <span className="mt-1 block text-2xs leading-relaxed text-ink-400">{notification.body}</span>
        </span>
      </button>
    </li>
  )
}
