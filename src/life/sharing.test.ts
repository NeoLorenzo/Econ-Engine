import { describe, expect, it } from 'vitest'
import { life2Seeds, sharingInsuranceExperiment } from './experiments'

// Life 2's ensembles are split across files so they run in parallel. Every run checks every invariant every hour. The
// tests use the first 16 seeds; the experiments' reported numbers use 32.
describe('experiment 4: sharing as insurance', () => {
  const rows = sharingInsuranceExperiment(life2Seeds(16))
  const at = (harvestKcal: number) => rows.find((row) => row.harvestKcal === harvestKcal)!.byStrategy
  const of = (harvestKcal: number, strategy: string) => at(harvestKcal).find((row) => row.strategy === strategy)!

  it('gives nothing with steady harvests', () => {
    for (const row of at(1_200)) expect(row.givenShare).toBe(0)
  })

  it('keeps more of a sharing band alive than of a keeping one, when windfalls are large', () => {
    for (const harvestKcal of [6_000, 9_600])
      expect(of(harvestKcal, 'sharer').meanSurvivors).toBeGreaterThan(of(harvestKcal, 'keeper').meanSurvivors)
  })

  it('gives a larger share of the harvest the larger the windfall', () => {
    for (const strategy of ['sharer', 'reciprocator']) {
      const shares = [3_600, 6_000, 9_600].map((harvestKcal) => of(harvestKcal, strategy).givenShare)
      expect(shares[0]!).toBeGreaterThan(0)
      expect(shares[1]!).toBeGreaterThan(shares[0]!)
      expect(shares[2]!).toBeGreaterThan(shares[1]!)
    }
  })
})
