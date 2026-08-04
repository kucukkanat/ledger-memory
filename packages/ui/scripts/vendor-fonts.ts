/**
 * Download the two typefaces into `public/fonts` so the UI never calls out.
 *
 * A supervision interface for a store whose entire promise is "nothing leaves
 * this machine" cannot fetch a stylesheet from fonts.googleapis.com on every
 * load. Run this once; without it the CSS falls back to system faces and
 * everything still works, just not in the intended type.
 *
 *   bun run fonts:vendor
 */

const FONTS = [
  {
    name: 'Instrument Sans',
    file: 'instrument-sans.woff2',
    css: 'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400..700&display=swap',
  },
  {
    name: 'Geist Mono',
    file: 'geist-mono.woff2',
    css: 'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@300..600&display=swap',
  },
] as const

/** A modern UA gets woff2; an old one gets ttf, which is far larger. */
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

const out = new URL('../public/fonts/', import.meta.url).pathname

let failures = 0

for (const font of FONTS) {
  try {
    const sheet = await fetch(font.css, { headers: { 'User-Agent': UA } })
    if (!sheet.ok) throw new Error(`stylesheet responded ${sheet.status}`)

    const css = await sheet.text()
    // Prefer the latin subset — the full set is several times the size for
    // glyphs this interface never renders.
    const urls = [...css.matchAll(/src:\s*url\((https:[^)]+\.woff2)\)/g)].map((m) => m[1])
    const url = urls.at(-1)
    if (!url) throw new Error('no woff2 in the stylesheet')

    const binary = await fetch(url)
    if (!binary.ok) throw new Error(`font responded ${binary.status}`)

    const bytes = await binary.arrayBuffer()
    await Bun.write(`${out}${font.file}`, bytes)
    console.log(`✓ ${font.name.padEnd(16)} ${(bytes.byteLength / 1024).toFixed(0)} KB`)
  } catch (error) {
    failures += 1
    console.error(`✕ ${font.name.padEnd(16)} ${error instanceof Error ? error.message : error}`)
  }
}

if (failures > 0) {
  console.error(
    `\n${failures} font(s) not vendored. The UI falls back to system faces — it will look`,
    '\nslightly off but nothing breaks, and it still makes no outbound requests.',
  )
  process.exit(1)
}

console.log('\nFonts vendored. The UI now makes no outbound requests at all.')
