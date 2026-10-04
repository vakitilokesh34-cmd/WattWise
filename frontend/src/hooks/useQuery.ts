import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, toApiError } from '@/services/http'

export interface QueryState<T> {
  data: T | undefined
  error: ApiError | null
  /** True only for the very first load (no data yet). */
  isLoading: boolean
  /** True while any request is in flight, including background refreshes. */
  isFetching: boolean
  dataUpdatedAt: number | null
}

export interface UseQueryOptions {
  /** Skip the request entirely (e.g. missing filter inputs). */
  enabled?: boolean
  /** Background polling interval. `0` disables. */
  refetchIntervalMs?: number
  /** Pause polling while the tab is hidden. Default: true. */
  pauseWhenHidden?: boolean
}

export interface QueryResult<T> extends QueryState<T> {
  refetch: () => Promise<void>
  setData: (updater: T | ((prev: T | undefined) => T | undefined)) => void
}

/**
 * Small data-fetching hook used by every page.
 *
 * - request de-duplication via the cache in `services/api.ts`
 * - AbortController-free: cancelling is handled by ignoring late responses
 * - optional polling for realtime-flavoured panels
 */
export function useQuery<T>(
  queryKey: string | null,
  fetcher: () => Promise<T>,
  options: UseQueryOptions = {},
): QueryResult<T> {
  const { enabled = true, refetchIntervalMs = 0, pauseWhenHidden = true } = options

  const [state, setState] = useState<QueryState<T>>({
    data: undefined,
    error: null,
    isLoading: enabled,
    isFetching: false,
    dataUpdatedAt: null,
  })

  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const requestIdRef = useRef(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const run = useCallback(async () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    setState((prev) => ({
      ...prev,
      isFetching: true,
      error: prev.data !== undefined ? prev.error : null,
      isLoading: prev.data === undefined,
    }))

    try {
      const data = await fetcherRef.current()
      if (!mountedRef.current || requestIdRef.current !== requestId) return
      setState({
        data,
        error: null,
        isLoading: false,
        isFetching: false,
        dataUpdatedAt: Date.now(),
      })
    } catch (error) {
      if (!mountedRef.current || requestIdRef.current !== requestId) return
      const apiError = toApiError(error)
      // Cancellation is not a user-facing failure.
      if (apiError.kind === 'canceled') {
        setState((prev) => ({ ...prev, isFetching: false, isLoading: false }))
        return
      }
      setState((prev) => ({
        ...prev,
        error: apiError,
        isLoading: false,
        isFetching: false,
        dataUpdatedAt: prev.dataUpdatedAt,
      }))
    }
  }, [])

  const isEnabled = enabled && queryKey !== null

  useEffect(() => {
    if (!isEnabled) {
      setState((prev) => ({ ...prev, isLoading: false, isFetching: false }))
      return
    }
    void run()
  }, [isEnabled, queryKey, run])

  useEffect(() => {
    if (!isEnabled || refetchIntervalMs <= 0) return
    let timer: number | null = null

    const tick = () => {
      if (pauseWhenHidden && typeof document !== 'undefined' && document.hidden) {
        timer = window.setTimeout(tick, refetchIntervalMs)
        return
      }
      void run().finally(() => {
        timer = window.setTimeout(tick, refetchIntervalMs)
      })
    }

    timer = window.setTimeout(tick, refetchIntervalMs)
    return () => {
      if (timer !== null) window.clearTimeout(timer)
    }
  }, [isEnabled, refetchIntervalMs, pauseWhenHidden, run])

  const setData = useCallback((updater: T | ((prev: T | undefined) => T | undefined)) => {
    setState((prev) => ({
      ...prev,
      data:
        typeof updater === 'function'
          ? (updater as (p: T | undefined) => T | undefined)(prev.data)
          : updater,
      dataUpdatedAt: Date.now(),
    }))
  }, [])

  return { ...state, refetch: run, setData }
}

/**
 * Imperative mutation helper (uploads, retries) with the same error shape as
 * `useQuery`.
 */
export function useMutation<TArgs extends unknown[], TData>(
  mutationFn: (...args: TArgs) => Promise<TData>,
): {
  mutate: (...args: TArgs) => Promise<TData | null>
  data: TData | undefined
  error: ApiError | null
  isPending: boolean
  reset: () => void
} {
  const [data, setData] = useState<TData | undefined>(undefined)
  const [error, setError] = useState<ApiError | null>(null)
  const [isPending, setIsPending] = useState(false)
  const mountedRef = useRef(true)
  const fnRef = useRef(mutationFn)
  fnRef.current = mutationFn

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const mutate = useCallback(async (...args: TArgs) => {
    setIsPending(true)
    setError(null)
    try {
      const result = await fnRef.current(...args)
      if (mountedRef.current) setData(result)
      return result
    } catch (caught) {
      const apiError = toApiError(caught)
      if (mountedRef.current) setError(apiError)
      return null
    } finally {
      if (mountedRef.current) setIsPending(false)
    }
  }, [])

  const reset = useCallback(() => {
    setData(undefined)
    setError(null)
    setIsPending(false)
  }, [])

  return { mutate, data, error, isPending, reset }
}
