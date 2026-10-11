import { describe, expect, it } from 'vitest'
import { life2Seeds, skillSpreadExperiment } from './experiments'

// Life 3's ensembles are split across files so they run in parallel. Every run checks every invariant every hour. The
// tests use the first 16 seeds; the experiments' reported numbers use 32.
describe('Life 3 experiment 4: the spread of skills', () => {
  const rows = skillSpreadExperiment(life2Seeds(16))
  const at = (min: number) => rows.find((row) => row.skillMinPercent === min)!

  it('swaps nothing when skills are equal', () => {
    expect(at(100).on.swapsPerRun).toBe(0)
    expect(at(100).on.quotesPerRun).toBe(0)
  })

  it('turns the correlation from positive to negative at every wider spread', () => {
    for (const row of rows.filter((candidate) => candidate.skillMinPercent < 100)) {
      expect(row.off.correlation!).toBeGreaterThan(0)
      expect(row.on.correlation!).toBeLessThan(0)
    }
  })

  it('saves hours of work and walking when skills differ a little', () => {
    const { off, on } = at(80)
    expect(on.workHoursPerDay + on.walkHoursPerDay).toBeLessThan(off.workHoursPerDay + off.walkHoursPerDay)
  })
})
