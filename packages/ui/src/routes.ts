/**
 * Every view is a route, so a reload — or a shared link — lands on the screen
 * you were actually looking at.
 *
 * Hash routing specifically: the same bundle is served by the local server, by
 * `file://`, and by GitHub Pages, and none of them can be asked to rewrite
 * unknown paths back to `index.html`. Everything after `#` never reaches a
 * server, so `#/canvas` survives a refresh anywhere.
 */

export const SCREENS = ['review', 'browse', 'sources', 'canvas', 'connections'] as const

export type Screen = (typeof SCREENS)[number]

/** Where an empty, unknown, or malformed hash lands. */
export const DEFAULT_SCREEN: Screen = 'review'

export const pathOf = (screen: Screen): string => `/${screen}`

export const isScreen = (value: string): value is Screen =>
  SCREENS.some((screen) => screen === value)

/** The screen a router pathname renders, tolerant of stray slashes. */
export const screenOf = (pathname: string): Screen => {
  const name = pathname.replace(/^\/+/, '').replace(/\/+$/, '')
  return isScreen(name) ? name : DEFAULT_SCREEN
}
