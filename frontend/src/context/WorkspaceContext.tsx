import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Anomaly, Building, DateRange, Notification, RealtimeEvent, UploadJob } from '@/types'
import { RANGE_PRESETS, presetToRange } from '@/utils/date'
import { apiConfig } from '@/services/config'
import {
  getHealthReport,
  invalidate,
  notificationFromEvent,
  onModeChange,
  pushRealtimeAnomaly,
  wattwiseApi,
} from '@/services/api'
import { mapUploadJob } from '@/services/mappers'
import { useLocalStorage } from '@/hooks/useLocalStorage'

export type RealtimeStatus = 'disabled' | 'connecting' | 'open' | 'error' | 'closed'

interface WorkspaceValue {
  /* Buildings */
  buildings: Building[]
  activeBuildingId: string
  activeBuilding: Building | null
  setActiveBuildingId: (id: string) => void

  /* Range */
  range: DateRange
  rangePresetKey: string
  setRangePreset: (key: string) => void
  setCustomRange: (from: Date, to: Date) => void

  /* Realtime */
  realtimeStatus: RealtimeStatus
  realtimeEnabled: boolean
  /** Increments whenever a realtime event affects displayed data. */
  realtimeTick: number
  lastEventAt: string | null
  liveAnomalies: Anomaly[]
  latestJob: UploadJob | null
  setLatestJob: (job: UploadJob | null) => void

  /* Notifications */
  notifications: Notification[]
  unreadCount: number
  pushNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'> & Partial<Pick<Notification, 'id' | 'createdAt' | 'read'>>) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  clearNotifications: () => void

  /* Data layer */
  mode: 'live' | 'mock'
  refreshSignal: () => void
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null)

const NOTIFICATION_CAP = 60

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  /* ── Buildings ─────────────────────────────────────────── */
  const [buildings, setBuildings] = useState<Building[]>([])
  const [activeBuildingId, setActiveBuildingIdState] = useLocalStorage<string>(
    'wattwise.activeBuilding',
    '',
  )

  useEffect(() => {
    let cancelled = false
    wattwiseApi
      .getBuildings()
      .then((list) => {
        if (cancelled || list.length === 0) return
        setBuildings(list)
        setActiveBuildingIdState((current) =>
          current && list.some((b) => b.id === current) ? current : list[0].id,
        )
      })
      .catch(() => {
        /* Dashboard shows an explicit error state; nothing to do here. */
      })
    return () => {
      cancelled = true
    }
  }, [setActiveBuildingIdState])

  const setActiveBuildingId = useCallback(
    (id: string) => {
      setActiveBuildingIdState(id)
      invalidate()
    },
    [setActiveBuildingIdState],
  )

  const activeBuilding = useMemo(
    () => buildings.find((b) => b.id === activeBuildingId) ?? buildings[0] ?? null,
    [buildings, activeBuildingId],
  )

  /* ── Date range ────────────────────────────────────────── */
  const [rangePresetKey, setRangePresetKeyState] = useLocalStorage<string>(
    'wattwise.rangePreset',
    'day',
  )
  const [customRangeState, setCustomRangeState] = useState<DateRange | null>(null)

  const range = useMemo<DateRange>(() => {
    if (customRangeState) return customRangeState
    const preset = RANGE_PRESETS.find((p) => p.key === rangePresetKey) ?? RANGE_PRESETS[1]
    return presetToRange(preset)
  }, [rangePresetKey, customRangeState])

  const setRangePreset = useCallback(
    (key: string) => {
      setCustomRangeState(null)
      setRangePresetKeyState(key)
      invalidate()
    },
    [setRangePresetKeyState],
  )

  const setCustomRange = useCallback(
    (from: Date, to: Date) => {
      setCustomRangeState({
        from: from.toISOString(),
        to: to.toISOString(),
        label: 'Custom range',
      })
      setRangePresetKeyState('custom')
      invalidate()
    },
    [setRangePresetKeyState],
  )

  /* ── Notifications ─────────────────────────────────────── */
  const [notifications, setNotifications] = useLocalStorage<Notification[]>('wattwise.notifications', [])

  const pushNotification = useCallback<WorkspaceValue['pushNotification']>(
    (notification) => {
      setNotifications((prev) => {
        const created: Notification = {
          ...notification,
          id: notification.id ?? `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
          createdAt: notification.createdAt ?? new Date().toISOString(),
          read: notification.read ?? false,
        }
        // De-dupe by id so a retried realtime event cannot double-post.
        if (prev.some((n) => n.id === created.id)) return prev
        return [created, ...prev].slice(0, NOTIFICATION_CAP)
      })
    },
    [setNotifications],
  )

  const markNotificationRead = useCallback(
    (id: string) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    },
    [setNotifications],
  )

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [setNotifications])

  const clearNotifications = useCallback(() => setNotifications([]), [setNotifications])

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications])

  /* ── Realtime ──────────────────────────────────────────── */
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>(
    apiConfig.realtime.enabled ? 'connecting' : 'disabled',
  )
  const [realtimeTick, setRealtimeTick] = useState(0)
  const [lastEventAt, setLastEventAt] = useState<string | null>(null)
  const [liveAnomalies, setLiveAnomalies] = useState<Anomaly[]>([])
  const [latestJob, setLatestJob] = useState<UploadJob | null>(null)
  const [mode, setMode] = useState<'live' | 'mock'>(getHealthReport().mode)

  // Keep the notification helpers stable for the stream callback below.
  const pushRef = useRef(pushNotification)
  pushRef.current = pushNotification

  useEffect(() => {
    if (!apiConfig.realtime.enabled) return

    const subscription = wattwiseApi.subscribeRealtime(
      (event: RealtimeEvent) => {
        setLastEventAt(new Date().toISOString())

        switch (event.type) {
          case 'anomaly.detected': {
            const anomaly = event.payload
            setLiveAnomalies((prev) => [anomaly, ...prev].slice(0, 30))
            // Drop stale cache so KPIs, charts and cost pages pick it up.
            pushRealtimeAnomaly(anomaly)
            invalidate()
            setRealtimeTick((tick) => tick + 1)
            const notification = notificationFromEvent(event)
            if (notification) pushRef.current(notification)
            break
          }
          case 'reading.updated': {
            invalidate('energy')
            setRealtimeTick((tick) => tick + 1)
            break
          }
          case 'model.status': {
            const notification = notificationFromEvent(event)
            if (notification) pushRef.current(notification)
            break
          }
          case 'data.status': {
            const notification = notificationFromEvent(event)
            if (notification) pushRef.current(notification)
            break
          }
          case 'job.progress': {
            setLatestJob(mapUploadJob(event.payload))
            break
          }
          case 'summary.snapshot': {
            // Polling-transport fallback: nothing to merge, just revalidate.
            invalidate()
            setRealtimeTick((tick) => tick + 1)
            break
          }
          default:
            break
        }
      },
      (status) => {
        if (status === 'open') setRealtimeStatus('open')
        else if (status === 'connecting') setRealtimeStatus('connecting')
        else if (status === 'closed') setRealtimeStatus('closed')
        else setRealtimeStatus('error')
      },
    )

    return () => subscription.close()
  }, [])

  useEffect(() => {
    let cancelled = false
    wattwiseApi
      .health()
      .then((report) => {
        if (!cancelled) setMode(report.mode)
      })
      .catch(() => undefined)
    // A runtime fallback (backend restarted mid-session) swaps transports later;
    // keep the badge in sync whenever that happens.
    const unsubscribe = onModeChange((nextMode) => setMode(nextMode))
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const refreshSignal = useCallback(() => {
    invalidate()
    setRealtimeTick((tick) => tick + 1)
  }, [])

  const value = useMemo<WorkspaceValue>(
    () => ({
      buildings,
      activeBuildingId: activeBuilding?.id ?? activeBuildingId,
      activeBuilding,
      setActiveBuildingId,
      range,
      rangePresetKey,
      setRangePreset,
      setCustomRange,
      realtimeStatus,
      realtimeEnabled: apiConfig.realtime.enabled,
      realtimeTick,
      lastEventAt,
      liveAnomalies,
      latestJob,
      setLatestJob,
      notifications,
      unreadCount,
      pushNotification,
      markNotificationRead,
      markAllNotificationsRead,
      clearNotifications,
      mode,
      refreshSignal,
    }),
    [
      buildings,
      activeBuilding,
      activeBuildingId,
      setActiveBuildingId,
      range,
      rangePresetKey,
      setRangePreset,
      setCustomRange,
      realtimeStatus,
      realtimeTick,
      lastEventAt,
      liveAnomalies,
      latestJob,
      notifications,
      unreadCount,
      pushNotification,
      markNotificationRead,
      markAllNotificationsRead,
      clearNotifications,
      mode,
      refreshSignal,
    ],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace(): WorkspaceValue {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('useWorkspace must be used inside <WorkspaceProvider>.')
  return context
}

/* ── Shared selectors ───────────────────────────────────────── */

export function useActiveBuilding(): Building | null {
  return useWorkspace().activeBuilding
}

export function useRange(): DateRange {
  return useWorkspace().range
}
