export type ClassValue = string | number | null | undefined | false | ClassValue[] | Record<string, boolean>

/** Tiny classnames helper — no runtime dependency needed. */
export function cn(...inputs: ClassValue[]): string {
  const out: string[] = []
  const walk = (value: ClassValue): void => {
    if (!value) return
    if (typeof value === 'string' || typeof value === 'number') {
      out.push(String(value))
      return
    }
    if (Array.isArray(value)) {
      value.forEach(walk)
      return
    }
    if (typeof value === 'object') {
      for (const [key, enabled] of Object.entries(value)) if (enabled) out.push(key)
    }
  }
  inputs.forEach(walk)
  return out.join(' ')
}
