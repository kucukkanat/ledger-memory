/**
 * Zoom and pan, layered on top of the canvas' auto-fit.
 *
 * The canvas re-fits every frame so that whatever is visible fills the frame.
 * That fit is not something the reader controls, so their zoom cannot replace
 * it — it composes with it: draw at the fit, then scale and slide the *result*.
 * Filtering or switching layout therefore still reframes, and it does so
 * without throwing away where the reader had navigated to.
 *
 * Kept here as arithmetic rather than inside the draw loop because one property
 * is easy to get subtly wrong and easy to test directly: zooming has to hold
 * the point under the cursor still. Anything else feels like the view is
 * fighting you.
 */

/** A world→screen transform: `screen = world * scale + offset`. */
export type Transform = { readonly scale: number; readonly ox: number; readonly oy: number }

/** The reader's own zoom and pan, in screen space, applied after the fit. */
export type View = { readonly zoom: number; readonly tx: number; readonly ty: number }

/** Fitted, un-zoomed, un-panned — what FIT returns to. */
export const FITTED: View = { zoom: 1, tx: 0, ty: 0 }

export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 24

export const isFitted = (view: View): boolean =>
  view.zoom === FITTED.zoom && view.tx === FITTED.tx && view.ty === FITTED.ty

export const clampZoom = (zoom: number): number =>
  // NaN needs the explicit guard: it compares false against everything, so
  // min/max would pass it straight through and blank the canvas from then on.
  Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number.isNaN(zoom) ? 1 : zoom))

/** The transform actually drawn with — and hit-tested against. */
export const compose = (fit: Transform, view: View): Transform => ({
  scale: fit.scale * view.zoom,
  ox: fit.ox * view.zoom + view.tx,
  oy: fit.oy * view.zoom + view.ty,
})

/**
 * Zoom about a screen point, keeping whatever sits under it in place.
 *
 * Composition is `screen = base * zoom + t`, so holding a point `p` fixed
 * across a zoom change means `t' = p - (zoom'/zoom) * (p - t)`, whatever the
 * underlying fit happens to be at the time.
 */
export const zoomAbout = (view: View, factor: number, px: number, py: number): View => {
  const zoom = clampZoom(view.zoom * factor)
  const ratio = zoom / view.zoom
  return {
    zoom,
    tx: px - ratio * (px - view.tx),
    ty: py - ratio * (py - view.ty),
  }
}

export const panBy = (view: View, dx: number, dy: number): View => ({
  zoom: view.zoom,
  tx: view.tx + dx,
  ty: view.ty + dy,
})

/** One wheel notch is ~53px in Chrome; a line is ~16px where Firefox reports lines. */
const LINE = 16
const PAGE = 400
/** Beyond this a single event is a fling, not an intent — clamped so it cannot leap. */
const MAX_DELTA = 120

/**
 * A wheel event's zoom factor.
 *
 * `ctrlKey` on a wheel event is how browsers report a trackpad pinch, and those
 * deltas are an order of magnitude smaller than a mouse wheel's — the two need
 * different sensitivities or pinch barely moves and the wheel overshoots.
 */
export const wheelFactor = (event: {
  readonly deltaY: number
  readonly deltaMode?: number
  readonly ctrlKey?: boolean
}): number => {
  const unit = event.deltaMode === 1 ? LINE : event.deltaMode === 2 ? PAGE : 1
  const delta = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, event.deltaY * unit))
  return Math.exp(-delta * (event.ctrlKey ? 0.012 : 0.002))
}
