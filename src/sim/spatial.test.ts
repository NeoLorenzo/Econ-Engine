import { describe, expect, it } from 'vitest'
import { DEFAULT_SEED, GOVERNMENT_ID, GOVERNMENT_PLOT_SIZE, PLOT_SIZES } from './config'
import { createSimulation, stepSimulation } from './engine'
import {
  deriveSpatialSeed,
  generateTownLayout,
  manhattanDistance,
  plotContains,
  plotDistance,
  plotsSeparated,
  transportQuote,
} from './spatial'
import type { Plot } from './types'

const plots = [
  { id: 'p-big', width: 4, height: 4 },
  { id: 'p-long', width: 3, height: 2 },
  { id: 'p-mid', width: 3, height: 3 },
]
const centred = { id: 'centre', width: 5, height: 5 }
const householdIds = Array.from({ length: 30 }, (_, i) => `h${i}`)
const layout = (seed: number, width = 20, height = 20) =>
  generateTownLayout(seed, width, height, { householdIds, plots, centred })

describe('plot distance', () => {
  const plot: Plot = { x: 4, y: 6, width: 3, height: 2 }

  it('is zero on the plot and one beside any edge', () => {
    for (let y = 6; y < 8; y += 1) for (let x = 4; x < 7; x += 1) expect(plotDistance({ x, y }, plot)).toBe(0)
    for (const tile of [
      { x: 3, y: 6 },
      { x: 7, y: 7 },
      { x: 5, y: 5 },
      { x: 6, y: 8 },
    ])
      expect(plotDistance(tile, plot)).toBe(1)
  })

  it('measures to the nearest tile from corners and far away', () => {
    expect(plotDistance({ x: 3, y: 5 }, plot)).toBe(2)
    expect(plotDistance({ x: 0, y: 0 }, plot)).toBe(4 + 6)
    expect(plotDistance({ x: 10, y: 9 }, plot)).toBe(4 + 2)
  })

  it('equals Manhattan distance for a one-tile plot', () => {
    for (const [a, b] of [
      [
        { x: 1, y: 8 },
        { x: 6, y: 2 },
      ],
      [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ],
    ] as const)
      expect(plotDistance(a, { ...b, width: 1, height: 1 })).toBe(manhattanDistance(a, b))
  })

  it('prices a round trip to the nearest tile in whole cents', () => {
    expect(transportQuote({ x: 0, y: 0 }, { x: 3, y: 5, width: 2, height: 2 }, 2)).toEqual({
      oneWayDistance: 8,
      roundTripTiles: 16,
      transportFeeCents: 32,
    })
    expect(transportQuote({ x: 4, y: 6 }, plot, 2).transportFeeCents).toBe(0)
  })

  it('tells touching plots from ones with a gap', () => {
    const a: Plot = { x: 0, y: 0, width: 3, height: 3 }
    expect(plotsSeparated(a, { x: 4, y: 0, width: 2, height: 2 })).toBe(true)
    expect(plotsSeparated(a, { x: 3, y: 0, width: 2, height: 2 })).toBe(false)
    expect(plotsSeparated(a, { x: 3, y: 3, width: 2, height: 2 })).toBe(false)
    expect(plotsSeparated(a, { x: 0, y: 4, width: 1, height: 1 })).toBe(true)
    expect(plotContains(a, { x: 2, y: 2 })).toBe(true)
    expect(plotContains(a, { x: 3, y: 2 })).toBe(false)
  })
})

describe('town layout', () => {
  it('reproduces a layout for one seed and varies across seeds', () => {
    expect(layout(12)).toEqual(layout(12))
    expect(layout(12)).not.toEqual(layout(13))
  })

  it('centres the first plot and keeps every plot its size, in bounds and apart', () => {
    for (const seed of [1, 2, 3, 12, 99]) {
      const town = layout(seed)
      expect(town.plots.centre).toEqual({ x: 7, y: 7, width: 5, height: 5 })
      const placed = Object.entries(town.plots)
      expect(placed).toHaveLength(4)
      for (const { id, width, height } of plots) {
        const plot = town.plots[id]!
        expect([`${plot.width}x${plot.height}`, `${plot.height}x${plot.width}`]).toContain(`${width}x${height}`)
      }
      placed.forEach(([, plot], index) => {
        expect(plot.x >= 0 && plot.y >= 0 && plot.x + plot.width <= 20 && plot.y + plot.height <= 20).toBe(true)
        for (const [, other] of placed.slice(index + 1)) expect(plotsSeparated(plot, other)).toBe(true)
      })
    }
  })

  it('puts every household on its own in-bounds tile off every plot', () => {
    for (const seed of [1, 2, 3]) {
      const town = layout(seed)
      const tiles = Object.values(town.households)
      expect(new Set(tiles.map(({ x, y }) => `${x},${y}`)).size).toBe(30)
      for (const tile of tiles) {
        expect(tile.x >= 0 && tile.x < 20 && tile.y >= 0 && tile.y < 20).toBe(true)
        for (const plot of Object.values(town.plots)) expect(plotContains(plot, tile)).toBe(false)
      }
    }
  })

  it('turns some non-square plots across seeds', () => {
    const shapes = new Set(
      Array.from({ length: 20 }, (_, seed) => {
        const plot = layout(seed).plots['p-long']!
        return `${plot.width}x${plot.height}`
      }),
    )
    expect(shapes).toEqual(new Set(['3x2', '2x3']))
  })

  it('refuses a grid with no room for a plot, or for the households', () => {
    expect(() => generateTownLayout(1, 4, 4, { householdIds: [], plots: [], centred })).toThrow(/too few to place/)
    expect(() =>
      generateTownLayout(1, 7, 7, { householdIds: [], plots: [{ id: 'x', width: 3, height: 3 }], centred }),
    ).toThrow(/x plot/)
    expect(() => generateTownLayout(1, 5, 5, { householdIds: ['h'], plots: [], centred })).toThrow(/1 households/)
  })
})

describe('the simulation layout', () => {
  it('places the canonical plots at their industry sizes, with Government centred', () => {
    const state = createSimulation({ seed: DEFAULT_SEED })
    expect(state.config.gridWidth).toBe(40)
    expect(state.config.transportCostPerTileCents).toBe(1)
    expect(state.government.id).toBe(GOVERNMENT_ID)
    expect(state.government.plot).toEqual({ x: 17, y: 17, ...GOVERNMENT_PLOT_SIZE })
    for (const firm of state.firms) {
      const size = PLOT_SIZES[firm.industryId]
      expect(
        (firm.plot.width === size.width && firm.plot.height === size.height) ||
          (firm.plot.width === size.height && firm.plot.height === size.width),
      ).toBe(true)
    }
  })

  it('derives spatial state without advancing runtime market RNG', () => {
    const first = createSimulation({ startingPriceCents: 200, initialStepCents: 100, seed: 44 })
    expect(first.spatialSeed).toBe(deriveSpatialSeed(44))
    expect(first.rngState).toBe(44)
    const wider = createSimulation({ ...first.config, gridWidth: 50, gridHeight: 50 })
    expect(wider.rngState).toBe(first.rngState)
    expect(wider.employmentSeed).toBe(first.employmentSeed)
    expect(wider.governmentPolicyRngState).toBe(first.governmentPolicyRngState)
    expect(wider.households.map(({ employerFirmId }) => employerFirmId)).toEqual(
      first.households.map(({ employerFirmId }) => employerFirmId),
    )
  })

  it('uses seeded randomness for exact delivered-cost ties', () => {
    const make = () => stepSimulation(createSimulation({ startingPriceCents: 100, initialStepCents: 100, seed: 91 }))
    expect(make()).toEqual(make())
  })

  it('never calls Math.random during spatial generation or a full day', () => {
    const original = Math.random
    Math.random = () => {
      throw new Error('forbidden')
    }
    try {
      expect(() => stepSimulation(createSimulation())).not.toThrow()
    } finally {
      Math.random = original
    }
  })
})
