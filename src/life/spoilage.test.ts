import { describe, expect, it } from 'vitest'
import { life2Seeds, perishabilityExperiment, whoPaysExperiment } from './experiments'

// Life 2's ensembles are split across files so they run in parallel. Every run checks every invariant every hour. The
// tests use the first 16 seeds, or 8 for experiment 6; the experiments' reported numbers use 32 and 64.
describe('experiment 5: perishability', () => {
  const rows = perishabilityExperiment(life2Seeds(16))
  const of = (shelfLifeHours: number, strategy: string) =>
    rows.find((row) => row.shelfLifeHours === shelfLifeHours)!.byStrategy.find((row) => row.strategy === strategy)!

  it('spoils more of a keeping band’s harvest the shorter food keeps', () => {
    expect(of(0, 'keeper').spoiledShare).toBe(0)
    expect(of(48, 'keeper').spoiledShare).toBeGreaterThan(0)
    expect(of(12, 'keeper').spoiledShare).toBeGreaterThan(of(48, 'keeper').spoiledShare)
  })

  it('spoils less in a sharing band than in a keeping one', () => {
    for (const shelfLifeHours of [48, 12])
      expect(of(shelfLifeHours, 'sharer').spoiledShare).toBeLessThan(of(shelfLifeHours, 'keeper').spoiledShare)
  })
})

describe('experiment 6: who pays', () => {
  const [row] = whoPaysExperiment(life2Seeds(8), [6_000], [48])

  it('lets keepers receive gifts while giving none', () => {
    const keepers = row!.byStrategy.find((entry) => entry.strategy === 'keeper')!
    expect(keepers.meanGivenKcal).toBe(0)
    expect(keepers.meanReceivedKcal).toBeGreaterThan(0)
    for (const entry of row!.byStrategy) expect(entry.foragers).toBe(32)
  })
})
