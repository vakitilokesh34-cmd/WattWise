import { AlertTriangle, Inbox, RefreshCw, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'
import { ApiError } from '@/services/http'
import { cn } from '@/utils/cn'

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'glass flex flex-col items-center justify-center px-6 py-14 text-center',
        className,
      )}
    >
      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-ink-400">
        {icon ?? <Inbox size={20} />}
      </div>
      <h3 className="mt-4 text-sm font-semibold text-ink-100">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-ink-400">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  error,
  onRetry,
  title,
  className,
}: {
  error: ApiError | Error | string | null
  onRetry?: () => void
  title?: string
  className?: string
}) {
  const isApiError = error instanceof ApiError
  const message =
    typeof error === 'string' ? error : error?.message ?? 'Something went wrong while loading this view.'

  const isOffline = isApiError && error.isConnectivity

  return (
    <div className={cn('glass border-crit-500/20 p-6', className)} role="alert">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-crit-500/30 bg-crit-500/10 text-crit-300">
          {isOffline ? <WifiOff size={16} /> : <AlertTriangle size={16} />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink-50">
            {title ?? (isOffline ? 'Energy service unreachable' : 'Unable to load this view')}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-ink-400">{message}</p>
          {isApiError && error.status ? (
            <p className="mt-1.5 text-2xs text-ink-500">
              HTTP {error.status}
              {error.url ? ` · ${error.url}` : ''}
            </p>
          ) : null}
          {onRetry ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={onRetry}
              iconLeft={<RefreshCw size={13} />}
            >
              Retry
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
