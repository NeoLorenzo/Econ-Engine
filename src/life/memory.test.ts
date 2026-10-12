import { describe, expect, it } from 'vitest'
import { life2Seeds, memoryExperiment } from './experiments'

// Every run checks every invariant every hour. The tests use the first 16 seeds; the reported numbers use 32.
describe('Life 4 experiment 4: how long skill lasts', () => {
  const rows = memoryExperiment(life2Seeds(16))

  it('divides every band at every length of memory', () => {
    for (const { swaps } of rows) {
      for (const run of swaps.runs) {
        const gathered = [...run.gatheredWoodById].sort((a, b) => b - a)
        expect(run.swaps).toBeGreaterThan(0)
        expect((gathered[0]! + gathered[1]!) / gathered.reduce((sum, wood) => sum + wood, 0)).toBeGreaterThan(0.3)
      }
    }
  })

  it('makes roles last longer the longer skill is remembered', () => {
    const persistence = rows.map(({ swaps }) => swaps.persistence!)
    const leads = rows.map(({ swaps }) => swaps.leadGatherers)
    expect(persistence[0]!).toBeLessThan(persistence[1]!)
    expect(persistence[1]!).toBeLessThan(persistence[2]!)
    expect(leads[0]!).toBeGreaterThan(leads[1]!)
    expect(leads[1]!).toBeGreaterThan(leads[2]!)
  })
})
