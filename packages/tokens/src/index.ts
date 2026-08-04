/**
 * Design tokens for LEDGER, lifted from the source design.
 *
 * The CSS custom properties in `tokens.css` are the single source of truth for
 * anything the browser renders. This module mirrors them for the places that
 * cannot read CSS — the `<canvas>` visualisation and the CLI's ANSI output —
 * so a palette change stays a one-file change.
 */

export const color = {
  /** Page background. */
  bg: '#0a0b0c',
  /** Canvas background, one step darker than the page. */
  bgSunken: '#08090a',
  /** Panels, headers, sidebars. */
  surface: '#0d0f11',
  /** Rails and facet columns. */
  surfaceAlt: '#0c0e10',
  /** Hover fill for rows and list items. */
  surfaceHover: '#141719',
  /** Inset wells: inputs, chunk previews. */
  surfaceInset: '#0e1012',

  /** Structural borders. */
  border: '#202427',
  /** Borders on interactive controls. */
  borderStrong: '#2b3036',
  /** Hairlines between dense rows. */
  borderSubtle: '#141719',

  /** Primary body text. */
  text: '#e7e9eb',
  /** Secondary text. */
  textMuted: '#a9b0b7',
  /** Tertiary text and inactive labels. */
  textDim: '#868d95',
  /** Quaternary text, metadata. */
  textFaint: '#575e66',
  /** Section eyebrows and disabled glyphs. */
  textGhost: '#4e555c',
  /** The faintest legible step. */
  textTrace: '#3f464c',

  /** The brand accent — selection, focus, "this is live". */
  accent: '#c0f24a',
  /** Accent on hover. */
  accentBright: '#d8ff7d',
  /** Accent-tinted surface for selection bars. */
  accentSurface: '#151a10',
  /** Accent-tinted border. */
  accentBorder: '#2f3a1a',
  /** Accent at low emphasis, for equaliser bars. */
  accentDim: '#4d5f24',

  /** Conflicts, drops, decay. */
  danger: '#e0555f',
  dangerBorder: '#4a2429',
  dangerSurface: '#1c1012',
  /** Warnings, stale values. */
  warn: '#f2913f',
  warnSurface: '#14100c',
  warnBorder: '#2a2119',
} as const

/** Cluster colours, keyed by the seeded cluster ids. */
export const clusterColor = {
  prefs: '#b7c14a',
  people: '#4a9fd4',
  code: '#cf6fb8',
  travel: '#4fb8a8',
  health: '#6fbf73',
  money: '#d9a03c',
  home: '#6f86e0',
  reading: '#9a76dd',
  proc: '#e0793f',
  projects: '#d6606a',
} as const

/** Fallback palette for clusters created after the seed, applied by index. */
export const clusterPalette = Object.values(clusterColor)

export const font = {
  sans: "'Instrument Sans', system-ui, -apple-system, sans-serif",
  mono: "'Geist Mono', ui-monospace, SFMono-Regular, monospace",
} as const

export const radius = {
  /** LEDGER is a square-cornered interface; 2px is the only radius. */
  sm: '2px',
  pill: '999px',
} as const

export const space = {
  '0.5': '2px',
  '1': '4px',
  '1.5': '6px',
  '2': '8px',
  '3': '12px',
  '4': '16px',
  '5': '20px',
  '6': '24px',
  '8': '32px',
} as const

export const fontSize = {
  /** Eyebrows: uppercase, letterspaced. */
  eyebrow: '9px',
  micro: '10px',
  tiny: '11px',
  small: '12.5px',
  body: '13px',
  large: '15px',
  title: '17px',
  display: '27px',
} as const

export const duration = {
  fast: '120ms',
  base: '150ms',
  slow: '220ms',
} as const

export const easing = {
  standard: 'cubic-bezier(.2,.8,.2,1)',
} as const

/** Strength thresholds shared by the table bar, the inspector and the canvas. */
export const strengthScale = [
  { min: 0.7, color: color.accent, label: 'strong' },
  { min: 0.4, color: '#d9a03c', label: 'holding' },
  { min: 0, color: color.danger, label: 'decaying' },
] as const

export const strengthColor = (strength: number): string =>
  strengthScale.find((s) => strength >= s.min)?.color ?? color.danger
