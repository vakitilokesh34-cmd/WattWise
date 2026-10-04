import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface Props {
  children: ReactNode
  /** Changing this value (e.g. the route path) resets the boundary. */
  resetKey?: string
}

interface State {
  error: Error | null
}

/**
 * Catches render-time errors so one broken panel cannot blank the whole app.
 * Reports to the console in development; the UI always offers a retry.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('[WattWise] render error', error, info.componentStack)
  }

  override componentDidUpdate(prev: Props): void {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  override render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="glass border-crit-500/20 p-6" role="alert">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-crit-500/30 bg-crit-500/10 text-crit-300">
            <TriangleAlert size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-ink-50">This view failed to render</h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-400">
              The rest of the dashboard is still usable. Reload the panel to try again.
            </p>
            <pre className="mt-2 max-h-32 overflow-auto rounded-lg border border-white/[0.06] bg-black/30 p-2.5 text-[10px] text-ink-500">
              {error.message}
            </pre>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => this.setState({ error: null })}
              iconLeft={<RefreshCw size={13} />}
            >
              Retry panel
            </Button>
          </div>
        </div>
      </div>
    )
  }
}