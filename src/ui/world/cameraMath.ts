export const FLIGHT_MS = 600
/** Locate zooms in to this distance for a house, but never zooms out to it. The default view sits at 46. */
export const COMFORT_RADIUS = 30
/** For a plot, Locate stays this much further out per tile of the plot's longer side beyond the first. */
export const COMFORT_RADIUS_PER_TILE = 6

/** How close Locate comes: further out for a bigger plot, so the whole building fits in view. */
export const comfortRadius = (footprintTiles = 1) => COMFORT_RADIUS + COMFORT_RADIUS_PER_TILE * (footprintTiles - 1)

/** Where the orbit camera looks (on the ground, so y is 0) and how far away it is. */
export interface CameraPose {
  x: number
  z: number
  radius: number
}

export interface Flight {
  from: CameraPose
  to: CameraPose
  durationMs: number
}

/** Screen pixels covered by an open panel, measured from the right and bottom edges of the canvas. */
export interface ViewInset {
  right: number
  bottom: number
}

export const NO_INSET: ViewInset = { right: 0, bottom: 0 }

export function easeInOutCubic(t: number) {
  const p = Math.min(1, Math.max(0, t))
  return p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2
}

export function planFlight(
  current: CameraPose,
  entity: { x: number; z: number },
  reducedMotion: boolean,
  footprintTiles = 1,
): Flight {
  return {
    from: current,
    to: { x: entity.x, z: entity.z, radius: Math.min(current.radius, comfortRadius(footprintTiles)) },
    durationMs: reducedMotion ? 0 : FLIGHT_MS,
  }
}

export function poseAt(flight: Flight, elapsedMs: number): CameraPose {
  if (elapsedMs >= flight.durationMs) return flight.to
  const t = easeInOutCubic(elapsedMs / flight.durationMs)
  const lerp = (a: number, b: number) => a + (b - a) * t
  return {
    x: lerp(flight.from.x, flight.to.x),
    z: lerp(flight.from.z, flight.to.z),
    radius: lerp(flight.from.radius, flight.to.radius),
  }
}

/**
 * The `camera.setViewOffset` shift that centres the camera target in the area a panel leaves uncovered.
 * Shifting the view window by half the inset moves the image the other way by the same amount.
 * Null means no offset (`camera.clearViewOffset`).
 */
export function viewOffset(inset: ViewInset) {
  if (inset.right === 0 && inset.bottom === 0) return null
  return { x: inset.right / 2, y: inset.bottom / 2 }
}

/** The gap between a docked panel and the right edge of the window (`.panel { right: 12px }`). */
const PANEL_MARGIN = 12

/** A docked panel covers the right edge; on narrow screens the panel is a bottom sheet. */
export function insetFromPanel(rect: { width: number; height: number } | null, narrow: boolean): ViewInset {
  if (!rect) return NO_INSET
  return narrow ? { right: 0, bottom: rect.height } : { right: rect.width + PANEL_MARGIN, bottom: 0 }
}

/**
 * How far to move the orbit target on the ground so a point at the target appears `dx` pixels right of and `dy`
 * pixels below the view's centre. Locate uses it to keep a household clear of the HUD and the inspector, which
 * would otherwise shift the whole projection whenever something was selected.
 */
export function groundShiftForScreenOffset(
  view: { theta: number; phi: number; radius: number; fovDeg: number; viewportHeight: number },
  offset: { dx: number; dy: number },
) {
  const unitsPerPixel = (2 * view.radius * Math.tan((view.fovDeg * Math.PI) / 360)) / view.viewportHeight
  // The camera's right and its forward direction along the ground; a tilted camera foreshortens the ground by cos(phi).
  const right = { x: Math.cos(view.theta), z: -Math.sin(view.theta) }
  const forward = { x: -Math.sin(view.theta), z: -Math.cos(view.theta) }
  const across = -offset.dx * unitsPerPixel
  const along = (offset.dy * unitsPerPixel) / Math.cos(view.phi)
  return { x: right.x * across + forward.x * along, z: right.z * across + forward.z * along }
}
