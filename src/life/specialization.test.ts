import { describe, expect, it } from 'vitest'
import { comparativeAdvantageExperiment, life2Seeds } from './experiments'

// Life 3's ensembles are split across files so they run in parallel. Every run checks every invariant every hour. The
// tests use the first 16 seeds; the experiments' reported numbers use 32.
describe('Life 3 experiment 3: comparative advantage', () => {
  const { off, on } = comparativeAdvantageExperiment(life2Seeds(16))

  it('turns the link between own terms and time spent gathering from positive to negative', () => {
    expect(off.swapsPerRun).toBe(0)
    expect(off.correlation!).toBeGreaterThan(0)
    expect(on.swapsPerRun).toBeGreaterThan(0)
    expect(on.correlation!).toBeLessThan(0)
  })

  it('concentrates gathering in fewer hands', () => {
    expect(on.concentration).toBeGreaterThan(off.concentration)
    expect(on.boughtShare).toBeGreaterThan(0)
  })

  it('keeps more of the least skilled alive, and no fewer overall', () => {
    expect(on.leastSkilledAliveShare).toBeGreaterThan(off.leastSkilledAliveShare)
    expect(on.meanSurvivors).toBeGreaterThanOrEqual(off.meanSurvivors)
  })
})
