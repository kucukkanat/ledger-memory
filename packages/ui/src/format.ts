import { strengthColor } from '@ledger/tokens'

export { strengthColor }

export const fmtN = (n: number): string => n.toLocaleString('en-US')

/** Compact age, matching the design's "4h" / "12d" / "7mo" ladder. */
export const ago = (from: number, now = Date.now()): string => {
  const days = (now - from) / 86_400_000
  if (days < 1) return `${Math.max(1, Math.round(days * 24))}h`
  if (days < 60) return `${Math.round(days)}d`
  return `${Math.round(days / 30.4)}mo`
}

export const dateStr = (at: number): string => new Date(at).toISOString().slice(0, 10)

export const clock = (at: number): string =>
  new Date(at).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })

/** Single-letter agent badge, as in the design's coloured squares. */
export const initial = (agentId: string): string => (agentId[0] ?? '?').toUpperCase()

export const pct = (fraction: number): string => `${Math.round(fraction * 100)}%`

export const bytes = (n: number): string =>
  n < 1024
    ? `${n} B`
    : n < 1024 * 1024
      ? `${(n / 1024).toFixed(0)} KB`
      : `${(n / 1024 / 1024).toFixed(1)} MB`

export const duration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

/** Deterministic colour per agent id, so badges stay stable across reloads. */
const AGENT_COLORS = ['#4a9fd4', '#cf6fb8', '#d9a03c', '#6fbf73', '#9a76dd', '#e0793f', '#4fb8a8']

export const agentColor = (agentId: string): string => {
  let hash = 0
  for (let i = 0; i < agentId.length; i += 1) hash = (hash * 31 + agentId.charCodeAt(i)) >>> 0
  return AGENT_COLORS[hash % AGENT_COLORS.length] ?? '#868d95'
}

/** Chunk text is multi-line; table cells are not. */
export const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim()
