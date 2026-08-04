import { color as tokens } from '@ledger/tokens'

/**
 * Terminal styling driven by the same tokens as the UI.
 *
 * The palette is defined once, in hex, for the browser. Rather than keep a
 * second ANSI palette in sync by hand, hex is converted to 24-bit colour here —
 * so re-theming LEDGER stays a one-file change.
 */

const supportsColor = (): boolean =>
  process.env['NO_COLOR'] === undefined && Boolean(process.stdout.isTTY)

const rgb = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const paint = (hex: string, text: string): string => {
  if (!supportsColor()) return text
  const [r, g, b] = rgb(hex)
  return `[38;2;${r};${g};${b}m${text}[39m`
}

export const dim = (text: string): string => paint(tokens.textFaint, text)
export const muted = (text: string): string => paint(tokens.textDim, text)
export const accent = (text: string): string => paint(tokens.accent, text)
export const danger = (text: string): string => paint(tokens.danger, text)
export const warn = (text: string): string => paint(tokens.warn, text)
export const bold = (text: string): string => (supportsColor() ? `[1m${text}[22m` : text)

/** Colour a 0..1 strength the same way the table bar does. */
export const strengthTint = (strength: number): string =>
  strength > 0.7 ? tokens.accent : strength > 0.4 ? '#d9a03c' : tokens.danger

export const bar = (fraction: number, width = 10): string => {
  const filled = Math.round(Math.max(0, Math.min(1, fraction)) * width)
  return paint(strengthTint(fraction), '█'.repeat(filled)) + dim('░'.repeat(width - filled))
}

/** Collapse to one line first — chunk text is multi-line and would break a table row. */
export const truncate = (text: string, width: number): string => {
  const line = text.replace(/\s+/g, ' ').trim()
  return line.length <= width ? line : `${line.slice(0, Math.max(0, width - 1))}…`
}

/** Compact relative age, matching the UI's "3d" / "4mo" convention. */
export const ago = (from: number, now: number): string => {
  const days = (now - from) / 86_400_000
  if (days < 1) return `${Math.max(1, Math.round(days * 24))}h`
  if (days < 60) return `${Math.round(days)}d`
  return `${Math.round(days / 30.4)}mo`
}

export const write = (line = ''): void => {
  process.stdout.write(`${line}\n`)
}

export const heading = (title: string, subtitle?: string): void => {
  write()
  write(`${bold(accent('▍'))} ${bold(title)}${subtitle ? `  ${dim(subtitle)}` : ''}`)
}
