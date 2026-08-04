import { describe, expect, test } from 'bun:test'
import { DEFAULT_SCREEN, isScreen, pathOf, SCREENS, type Screen, screenOf } from './routes.ts'

describe('pathOf / screenOf', () => {
  test('every screen round-trips through its path', () => {
    for (const screen of SCREENS) expect(screenOf(pathOf(screen))).toBe(screen)
  })

  test('paths are exactly the screen name, so the hash reads as the view', () => {
    expect(SCREENS.map(pathOf)).toEqual([
      '/review',
      '/browse',
      '/sources',
      '/canvas',
      '/connections',
    ])
  })

  test('a bare or empty path falls back rather than rendering nothing', () => {
    expect(screenOf('/')).toBe(DEFAULT_SCREEN)
    expect(screenOf('')).toBe(DEFAULT_SCREEN)
  })

  test('an unknown path falls back instead of throwing', () => {
    expect(screenOf('/nope')).toBe(DEFAULT_SCREEN)
    expect(screenOf('/browse/42')).toBe(DEFAULT_SCREEN)
  })

  test('stray slashes still resolve — a hand-typed hash rarely matches exactly', () => {
    expect(screenOf('canvas')).toBe('canvas')
    expect(screenOf('//canvas//')).toBe('canvas')
  })
})

describe('isScreen', () => {
  test('accepts every screen', () => {
    for (const screen of SCREENS) expect(isScreen(screen)).toBe(true)
  })

  test('rejects anything else, including near-misses', () => {
    for (const value of ['', '/', 'Review', 'browse ', 'connection', 'toString'])
      expect(isScreen(value)).toBe(false)
  })

  test('narrows the type it claims to narrow', () => {
    const value: string = 'sources'
    if (!isScreen(value)) throw new Error('expected a screen')
    const screen: Screen = value
    expect(screen).toBe('sources')
  })
})
