# @ledger/tokens

LEDGER's design tokens, in the two forms it needs them: CSS custom properties
for the browser, and TypeScript for the places that cannot read CSS — the
`<canvas>` visualisation and the CLI's ANSI output.

```bash
bun add @ledger/tokens
```

## In the browser

```ts
import '@ledger/tokens/tokens.css'
```

```css
.card {
  background: var(--lg-surface);
  border: 1px solid var(--lg-border);
  border-radius: var(--lg-radius-sm);
  color: var(--lg-text);
  font-family: var(--lg-font-sans);
}
```

The stylesheet also carries the keyframes the UI animates with (`lg-fade-in`,
`lg-slide-down`, `lg-rise-in`, `lg-blip`, `lg-eq`, …) and a
`prefers-reduced-motion` block that switches all of them off.

Fonts are declared as `@font-face` against `/fonts/*.woff2` and are expected to
be self-hosted. A Google Fonts `<link>` would mean the supervision UI for a
store that "never leaves this machine" phones out on every load. Without
vendored files the stacks fall back to system faces and nothing breaks.

## Outside the browser

```ts
import { clusterColor, color, strengthColor } from '@ledger/tokens'

color.accent            // '#c0f24a'
color.danger            // '#e0555f'
clusterColor.code       // '#cf6fb8'
strengthColor(0.82)     // '#c0f24a'  — strong
strengthColor(0.31)     // '#e0555f'  — decaying
```

`strengthColor` is the single source of truth for the strength ramp, so the
table meter, the inspector, the canvas and the CLI's bars always agree.

Because the palette is defined once in hex, the CLI converts to 24-bit ANSI at
the point of use rather than keeping a second palette in sync by hand — a
re-theme stays a one-file change.

## What's here

`color`, `clusterColor`, `clusterPalette`, `font`, `radius`, `space`,
`fontSize`, `duration`, `easing`, `strengthScale`, `strengthColor`.

LEDGER is a square-cornered interface: `radius.sm` is 2px and is the only radius
used on anything rectangular.
