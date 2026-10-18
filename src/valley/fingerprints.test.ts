import { describe, expect, it } from 'vitest'
import { createValley, runValley } from './engine'
import { ValleyChecker } from './invariants'
import type { ValleyConfig } from './types'

// Life 9 runs exactly as recorded: the daily summaries and totals of 30 days on three seeds, for the canonical valley
// and each configuration the experiments use, match fingerprints recorded from Life 9's code. A change that alters
// any trajectory, even a refactor or a speed-up meant to change nothing, fails here.

function fingerprintOf(value: unknown) {
  let hash = 0x811c9dc5
  const text = JSON.stringify(value)
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193)
  return `${(hash >>> 0).toString(16)}:${text.length}`
}

const CONFIGS: Record<string, Partial<ValleyConfig>> = {
  canonical: {},
  together: { scattered: false },
  noPractice: { craftPractice: false },
  talent: { craftSkillMinPercent: 50, craftSkillMaxPercent: 150 },
  twelve: { bandSize: 12 },
  unequal: { skillMinPercent: 50, skillMaxPercent: 150 },
}

const RECORDED = [
  { config: 'canonical', seed: 20260813, days: '3a243df2:45722', totals: '16ec24bd:409' },
  { config: 'canonical', seed: 1, days: '30aeb0a:45636', totals: '7716d18e:406' },
  { config: 'canonical', seed: 2, days: 'c9b1213f:45693', totals: 'c10daf24:409' },
  { config: 'together', seed: 20260813, days: '5e6ce7e1:45518', totals: 'a1f33825:409' },
  { config: 'together', seed: 1, days: 'ac6b800e:45473', totals: 'e6962d5f:406' },
  { config: 'together', seed: 2, days: 'e9280155:45468', totals: '2db24bf2:406' },
  { config: 'noPractice', seed: 20260813, days: '3a3f0606:45928', totals: '66ac8758:409' },
  { config: 'noPractice', seed: 1, days: '54d3ec72:45845', totals: '7dc92f4a:406' },
  { config: 'noPractice', seed: 2, days: 'f98e7a0e:45935', totals: '5041daa7:409' },
  { config: 'talent', seed: 20260813, days: '5622a181:45740', totals: 'b34bcec5:415' },
  { config: 'talent', seed: 1, days: '14cdb60b:45668', totals: '2fa8dab4:406' },
  { config: 'talent', seed: 2, days: '90d379ef:45742', totals: '67eac018:415' },
  { config: 'twelve', seed: 20260813, days: '82c52447:53042', totals: '79d474b7:412' },
  { config: 'twelve', seed: 1, days: 'd381ba8c:52941', totals: '6a8caabf:412' },
  { config: 'twelve', seed: 2, days: '7754dbb1:53164', totals: '49985d76:417' },
  { config: 'unequal', seed: 20260813, days: 'c773b714:45588', totals: 'f7ad0975:408' },
  { config: 'unequal', seed: 1, days: '30355a9f:45568', totals: '8253f29c:409' },
  { config: 'unequal', seed: 2, days: '32f1166b:45528', totals: 'dd8cf3e:408' },
] as const

describe('Life 9 runs exactly as recorded', () => {
  for (const recorded of RECORDED) {
    it(`for the ${recorded.config} valley on seed ${recorded.seed}`, () => {
      const start = createValley({ ...CONFIGS[recorded.config], seed: recorded.seed })
      const checker = new ValleyChecker(start)
      const end = runValley(start, 30 * 1_440, { recordEvents: false, onMinute: (state) => checker.assert(state) })
      expect(fingerprintOf(end.days)).toBe(recorded.days)
      expect(fingerprintOf(end.totals)).toBe(recorded.totals)
    })
  }
})
