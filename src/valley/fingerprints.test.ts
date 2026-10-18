import { describe, expect, it } from 'vitest'
import { createValley, runValley } from './engine'
import { ValleyChecker } from './invariants'
import type { ValleyConfig } from './types'

// Life 9.5 runs exactly as recorded: the daily summaries and totals of 30 days on three seeds, for the canonical valley
// and each configuration the experiments use, match fingerprints recorded from Life 9.5's code. A change that alters
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
  { config: 'canonical', seed: 20260813, days: '3fa51571:46029', totals: '366fe630:428' },
  { config: 'canonical', seed: 1, days: 'dd2abe91:45952', totals: '4fece539:431' },
  { config: 'canonical', seed: 2, days: 'e44efa3c:45926', totals: '49754f05:428' },
  { config: 'together', seed: 20260813, days: '437e1e87:45698', totals: '39027ede:426' },
  { config: 'together', seed: 1, days: '732eda85:45698', totals: '1d08a023:426' },
  { config: 'together', seed: 2, days: 'd3007b4:45703', totals: 'fc7bec9c:429' },
  { config: 'noPractice', seed: 20260813, days: 'e7bf2d21:46209', totals: '59533a07:428' },
  { config: 'noPractice', seed: 1, days: '5c110f4e:46077', totals: '35dc89b9:428' },
  { config: 'noPractice', seed: 2, days: 'c188e274:46082', totals: 'fcbe5ad4:428' },
  { config: 'talent', seed: 20260813, days: 'edb20ea5:46122', totals: '3d99bd32:429' },
  { config: 'talent', seed: 1, days: 'c0bea69b:45989', totals: 'e957cdee:428' },
  { config: 'talent', seed: 2, days: '82003c7c:45994', totals: 'f359be7:429' },
  { config: 'twelve', seed: 20260813, days: 'aa71c70c:53390', totals: '34b70366:435' },
  { config: 'twelve', seed: 1, days: 'b9c13251:53463', totals: '1b1aa871:432' },
  { config: 'twelve', seed: 2, days: '3ff625c1:53495', totals: 'e50b6237:432' },
  { config: 'unequal', seed: 20260813, days: 'b7b9f669:45427', totals: '7aae6986:429' },
  { config: 'unequal', seed: 1, days: '46e6f2c1:45897', totals: '74bc8972:432' },
  { config: 'unequal', seed: 2, days: 'dee3d043:45861', totals: '3be75c12:431' },
] as const

describe('Life 9.5 runs exactly as recorded', () => {
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
