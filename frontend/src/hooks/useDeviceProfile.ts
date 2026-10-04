import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { apiConfig } from '@/services/config'

export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide'
export type SceneQuality = 'high' | 'medium' | 'low'

const QUERY_SM = '(max-width: 639px)'
const QUERY_MD = '(min-width: 640px) and (max-width: 1023px)'
const QUERY_LG = '(min-width: 1024px) and (max-width: 1439px)'
const QUERY_XL = '(min-width: 1440px)'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

function matches(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(query).matches
}

export function useMediaQuery(query: string): boolean {
  const [matchesValue, setMatchesValue] = useState(() => matches(query))

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const list = window.matchMedia(query)
    const handler = (event: MediaQueryListEvent | MediaQueryList) => setMatchesValue(event.matches)
    handler(list)
    if (typeof list.addEventListener === 'function') {
      list.addEventListener('change', handler as (e: MediaQueryListEvent) => void)
      return () => list.removeEventListener('change', handler as (e: MediaQueryListEvent) => void)
    }
    list.addListener(handler as (e: MediaQueryListEvent) => void)
    return () => list.removeListener(handler as (e: MediaQueryListEvent) => void)
  }, [query])

  return matchesValue
}

export function useBreakpoint(): Breakpoint {
  const isMobile = useMediaQuery(QUERY_SM)
  const isTablet = useMediaQuery(QUERY_MD)
  const isWide = useMediaQuery(QUERY_XL)

  return useMemo(() => {
    if (isMobile) return 'mobile'
    if (isTablet) return 'tablet'
    if (isWide) return 'wide'
    return 'desktop'
  }, [isMobile, isTablet, isWide])
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION)
}

export interface DeviceProfile {
  breakpoint: Breakpoint
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isWide: boolean
  reducedMotion: boolean
  /** 3D budget derived from viewport + motion preference + env override. */
  quality: SceneQuality
  shadows: boolean
  dpr: [number, number]
  particleBudget: number
  /** Render the 3D canvas at all (disabled on very small screens via env). */
  enable3D: boolean
}

/**
 * Single source of truth for the responsive/performance budget.
 * Desktop → full scene, tablet → reduced, mobile → simplified.
 */
export function useDeviceProfile(): DeviceProfile {
  const isMobile = useMediaQuery(QUERY_SM)
  const isTablet = useMediaQuery(QUERY_MD)
  const isWide = useMediaQuery(QUERY_XL)
  const isDesktop = useMediaQuery(QUERY_LG)
  const reducedMotion = usePrefersReducedMotion()

  const envQuality = apiConfig.scene.quality

  const profile = useMemo<DeviceProfile>(() => {
    const breakpoint: Breakpoint = isMobile
      ? 'mobile'
      : isTablet
        ? 'tablet'
        : isWide
          ? 'wide'
          : 'desktop'

    let quality: SceneQuality
    if (envQuality !== 'auto') {
      quality = envQuality
    } else if (isMobile) {
      quality = 'low'
    } else if (isTablet) {
      quality = 'medium'
    } else {
      quality = 'high'
    }

    if (reducedMotion && quality === 'high') quality = 'medium'

    const particleBudget =
      quality === 'high'
        ? apiConfig.scene.maxParticles
        : quality === 'medium'
          ? Math.round(apiConfig.scene.maxParticles * 0.55)
          : Math.round(apiConfig.scene.maxParticles * 0.28)

    return {
      breakpoint,
      isMobile,
      isTablet,
      isDesktop: isDesktop || isWide,
      isWide,
      reducedMotion,
      quality,
      shadows: quality === 'high' && !reducedMotion,
      dpr: quality === 'high' ? [1, 1.75] : quality === 'medium' ? [1, 1.4] : [1, 1.15],
      particleBudget: Math.max(24, particleBudget),
      enable3D: apiConfig.scene.enabled,
    }
  }, [isMobile, isTablet, isDesktop, isWide, reducedMotion, envQuality])

  return profile
}

/** Measures an element and returns its width (debounced to animation frames). */
export function useElementWidth<T extends HTMLElement>(): [RefObject<T>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    let frame = 0
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setWidth(entry.contentRect.width))
    })
    observer.observe(element)
    setWidth(element.getBoundingClientRect().width)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  return [ref, width]
}

/** Locks body scroll (mobile sidebar, modals). */
export function useScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [locked])
}

/** Stable callback identity for values that change every render. */
export function useEventCallback<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn)
  ref.current = fn
  return useCallback((...args: A) => ref.current(...args), [])
}
