import { describe, expect, test } from 'bun:test'
import {
  clampZoom,
  compose,
  FITTED,
  isFitted,
  panBy,
  type Transform,
  type View,
  wheelFactor,
  ZOOM_MAX,
  ZOOM_MIN,
  zoomAbout,
} from './view.ts'

const fit: Transform = { scale: 2, ox: 40, oy: -15 }

/** Where a world point lands on screen under a fit plus the reader's view. */
const project = (world: { x: number; y: number }, view: View) => {
  const t = compose(fit, view)
  return { x: world.x * t.scale + t.ox, y: world.y * t.scale + t.oy }
}

/** The world point currently under a screen point. */
const unproject = (screen: { x: number; y: number }, view: View) => {
  const t = compose(fit, view)
  return { x: (screen.x - t.ox) / t.scale, y: (screen.y - t.oy) / t.scale }
}

describe('compose', () => {
  test('a fitted view draws exactly the fit', () => {
    expect(compose(fit, FITTED)).toEqual(fit)
  })

  test('zoom multiplies the fit rather than replacing it', () => {
    expect(compose(fit, { zoom: 3, tx: 0, ty: 0 })).toEqual({
      scale: 6,
      ox: 120,
      oy: -45,
    })
  })

  test('pan is screen-space, so it survives any fit', () => {
    expect(compose(fit, { zoom: 1, tx: 10, ty: 20 })).toEqual({
      scale: 2,
      ox: 50,
      oy: 5,
    })
  })
})

describe('zoomAbout', () => {
  test('holds the point under the cursor still — the whole contract', () => {
    const cursor = { x: 317, y: 208 }
    let view = FITTED
    const anchored = unproject(cursor, view)

    for (const factor of [1.2, 1.2, 0.7, 2.4, 0.55]) {
      view = zoomAbout(view, factor, cursor.x, cursor.y)
      const landed = project(anchored, view)
      expect(landed.x).toBeCloseTo(cursor.x, 6)
      expect(landed.y).toBeCloseTo(cursor.y, 6)
    }
  })

  test('holds it about a moving cursor too', () => {
    let view: View = { zoom: 1.4, tx: -30, ty: 12 }
    for (const cursor of [
      { x: 0, y: 0 },
      { x: 640, y: 480 },
      { x: 12, y: 903 },
    ]) {
      const anchored = unproject(cursor, view)
      view = zoomAbout(view, 1.35, cursor.x, cursor.y)
      expect(project(anchored, view).x).toBeCloseTo(cursor.x, 6)
      expect(project(anchored, view).y).toBeCloseTo(cursor.y, 6)
    }
  })

  test('clamps instead of running away, and stops translating once clamped', () => {
    const zoomedIn = zoomAbout({ zoom: ZOOM_MAX, tx: 5, ty: 5 }, 4, 100, 100)
    expect(zoomedIn.zoom).toBe(ZOOM_MAX)
    expect(zoomedIn).toEqual({ zoom: ZOOM_MAX, tx: 5, ty: 5 })

    expect(zoomAbout(FITTED, 0.01, 0, 0).zoom).toBe(ZOOM_MIN)
  })
})

describe('panBy', () => {
  test('accumulates and leaves zoom alone', () => {
    expect(panBy(panBy({ zoom: 2, tx: 0, ty: 0 }, 10, -4), -3, 9)).toEqual({
      zoom: 2,
      tx: 7,
      ty: 5,
    })
  })

  test('moves the drawing with the drag, one screen pixel per pixel', () => {
    const before = project({ x: 3, y: 3 }, { zoom: 2.5, tx: 0, ty: 0 })
    const after = project({ x: 3, y: 3 }, panBy({ zoom: 2.5, tx: 0, ty: 0 }, 25, -40))
    expect(after.x - before.x).toBe(25)
    expect(after.y - before.y).toBe(-40)
  })
})

describe('clampZoom', () => {
  test('passes anything inside the range through', () => {
    expect(clampZoom(1)).toBe(1)
    expect(clampZoom(3.5)).toBe(3.5)
  })

  test('never returns NaN — one poisoned frame would blank the canvas', () => {
    expect(clampZoom(Number.NaN)).toBe(1)
    expect(clampZoom(Number.POSITIVE_INFINITY)).toBe(ZOOM_MAX)
  })
})

describe('isFitted', () => {
  test('true only for the fitted view', () => {
    expect(isFitted(FITTED)).toBe(true)
    expect(isFitted({ zoom: 1, tx: 0.5, ty: 0 })).toBe(false)
    expect(isFitted({ zoom: 1.01, tx: 0, ty: 0 })).toBe(false)
  })
})

describe('wheelFactor', () => {
  test('scrolling up zooms in, down zooms out', () => {
    expect(wheelFactor({ deltaY: -100 })).toBeGreaterThan(1)
    expect(wheelFactor({ deltaY: 100 })).toBeLessThan(1)
    expect(wheelFactor({ deltaY: 0 })).toBe(1)
  })

  test('opposite scrolls undo each other', () => {
    expect(wheelFactor({ deltaY: -60 }) * wheelFactor({ deltaY: 60 })).toBeCloseTo(1, 12)
  })

  test('line and page deltas scale up, so Firefox is not a hair-trigger', () => {
    expect(wheelFactor({ deltaY: -3, deltaMode: 1 })).toBeGreaterThan(
      wheelFactor({ deltaY: -3, deltaMode: 0 }),
    )
    expect(wheelFactor({ deltaY: -1, deltaMode: 2 })).toBeGreaterThan(
      wheelFactor({ deltaY: -1, deltaMode: 1 }),
    )
  })

  test('a pinch is more sensitive than a wheel of the same delta', () => {
    expect(wheelFactor({ deltaY: -10, ctrlKey: true })).toBeGreaterThan(
      wheelFactor({ deltaY: -10 }),
    )
  })

  test('a fling cannot leap the whole zoom range in one event', () => {
    const factor = wheelFactor({ deltaY: -100_000 })
    expect(factor).toBe(wheelFactor({ deltaY: -120 }))
    expect(factor).toBeLessThan(ZOOM_MAX / ZOOM_MIN)
  })
})
