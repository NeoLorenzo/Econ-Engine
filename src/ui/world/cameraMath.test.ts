import { describe, expect, it } from 'vitest'
import {
  COMFORT_RADIUS,
  easeInOutCubic,
  FLIGHT_MS,
  groundShiftForScreenOffset,
  insetFromPanel,
  NO_INSET,
  planFlight,
  poseAt,
  viewOffset,
  type CameraPose,
} from './cameraMath'

const start: CameraPose = { x: 0, z: 0, radius: 46 }

describe('easeInOutCubic', () => {
  it('starts at 0, passes the midpoint at 0.5 and ends at 1', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(0.5)).toBe(0.5)
    expect(easeInOutCubic(1)).toBe(1)
  })

  it('clamps progress outside [0, 1]', () => {
    expect(easeInOutCubic(-1)).toBe(0)
    expect(easeInOutCubic(2)).toBe(1)
  })
})

describe('planFlight', () => {
  it('flies to the entity and zooms in to the comfort distance', () => {
    expect(COMFORT_RADIUS).toBe(30)
    expect(FLIGHT_MS).toBe(600)
    const flight = planFlight(start, { x: 5, z: -3 }, false)
    expect(flight.from).toEqual(start)
    expect(flight.to).toEqual({ x: 5, z: -3, radius: 30 })
    expect(flight.durationMs).toBe(600)
  })

  it('never zooms out when the camera is already closer than the comfort distance', () => {
    expect(planFlight({ x: 0, z: 0, radius: 20 }, { x: 5, z: -3 }, false).to.radius).toBe(20)
  })

  it('jumps instead of flying with reduced motion', () => {
    expect(planFlight(start, { x: 5, z: -3 }, true).durationMs).toBe(0)
  })

  it('starts a replanned flight from the current mid-flight pose, without snapping back', () => {
    const first = planFlight(start, { x: 8, z: 8 }, false)
    const mid = poseAt(first, 300)
    expect(planFlight(mid, { x: -4, z: 2 }, false).from).toEqual(mid)
  })
})

describe('poseAt', () => {
  const flight = planFlight(start, { x: 5, z: -3 }, false)

  it('is exactly the start at the beginning', () => {
    expect(poseAt(flight, 0)).toEqual(flight.from)
  })

  it('is exactly the target at and after the end', () => {
    expect(poseAt(flight, 600)).toEqual(flight.to)
    expect(poseAt(flight, 10_000)).toEqual(flight.to)
  })

  it('is halfway at half time', () => {
    expect(poseAt(flight, 300)).toEqual({ x: 2.5, z: -1.5, radius: 38 })
  })

  it('lands on the target immediately for a zero-length flight', () => {
    const jump = planFlight(start, { x: 5, z: -3 }, true)
    expect(poseAt(jump, 0)).toEqual(jump.to)
  })
})

describe('viewOffset', () => {
  it('has no offset without an inset', () => {
    expect(viewOffset(NO_INSET)).toBeNull()
  })

  it('shifts by half a docked panel, centring the target in the uncovered width', () => {
    // A 1000px canvas with a 400px panel leaves 600px; its centre, 300px, is 200px left of the canvas centre.
    expect(viewOffset({ right: 400, bottom: 0 })).toEqual({ x: 200, y: 0 })
  })

  it('shifts by half a bottom sheet', () => {
    expect(viewOffset({ right: 0, bottom: 480 })).toEqual({ x: 0, y: 240 })
  })
})

describe('insetFromPanel', () => {
  it('has no inset without a panel', () => {
    expect(insetFromPanel(null, false)).toEqual(NO_INSET)
  })

  it('insets from the right for a docked panel, including its 12px margin from the edge', () => {
    expect(insetFromPanel({ width: 560, height: 800 }, false)).toEqual({ right: 572, bottom: 0 })
  })

  it('insets from the bottom for a bottom sheet on a narrow screen', () => {
    expect(insetFromPanel({ width: 375, height: 480 }, true)).toEqual({ right: 0, bottom: 480 })
  })
})

describe('groundShiftForScreenOffset', () => {
  // r = 30 and a 26° field of view on a 900px-tall canvas: 2 · 30 · tan(13°) / 900 ≈ 0.0153912 world units per pixel.
  const view = { theta: 0, phi: Math.PI / 3, radius: 30, fovDeg: 26, viewportHeight: 900 }

  it('does not move the target without a screen offset', () => {
    const shift = groundShiftForScreenOffset(view, { dx: 0, dy: 0 })
    expect(shift.x).toBeCloseTo(0)
    expect(shift.z).toBeCloseTo(0)
  })

  it('moves the target left so the entity appears to the right, clear of the inspector', () => {
    const shift = groundShiftForScreenOffset(view, { dx: 100, dy: 0 })
    expect(shift.x).toBeCloseTo(-1.539, 3)
    expect(shift.z).toBeCloseTo(0)
  })

  it('moves the target away from the camera so the entity appears lower, clear of the HUD', () => {
    // A tilted camera foreshortens the ground by cos(phi) = 0.5, so the shift doubles.
    const shift = groundShiftForScreenOffset(view, { dx: 0, dy: 100 })
    expect(shift.x).toBeCloseTo(0)
    expect(shift.z).toBeCloseTo(-3.078, 3)
  })

  it('follows the camera as it orbits', () => {
    const shift = groundShiftForScreenOffset({ ...view, theta: Math.PI / 2 }, { dx: 100, dy: 0 })
    expect(shift.x).toBeCloseTo(0)
    expect(shift.z).toBeCloseTo(1.539, 3)
  })
})
