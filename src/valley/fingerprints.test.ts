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
  { config: 'canonical', seed: 20260813, days: '69a59c6:45860', totals: 'cb8b934:425' },
  { config: 'canonical', seed: 1, days: '24ba2a7d:45766', totals: '7b6422d8:425' },
  { config: 'canonical', seed: 2, days: '676ef36f:45764', totals: 'c777511b:425' },
  { config: 'together', seed: 20260813, days: 'e244f205:45536', totals: '9d00dfb6:429' },
  { config: 'together', seed: 1, days: 'a10bb198:45522', totals: 'd9b0290a:423' },
  { config: 'together', seed: 2, days: '33bde535:45537', totals: 'c5044818:423' },
  { config: 'noPractice', seed: 20260813, days: 'eb2a9624:46112', totals: '455c4b18:425' },
  { config: 'noPractice', seed: 1, days: 'd65915b7:45998', totals: '11199fc0:425' },
  { config: 'noPractice', seed: 2, days: '7888c87d:45991', totals: 'b609d569:425' },
  { config: 'talent', seed: 20260813, days: '1370918a:45970', totals: '780c5748:431' },
  { config: 'talent', seed: 1, days: '78eb353e:45834', totals: '63db5962:431' },
  { config: 'talent', seed: 2, days: 'c3f613a0:45846', totals: 'e23374fc:431' },
  { config: 'twelve', seed: 20260813, days: '8d1e8d3c:53165', totals: '7ac9598d:430' },
  { config: 'twelve', seed: 1, days: '8dfcf18b:53238', totals: '7e40a3bd:429' },
  { config: 'twelve', seed: 2, days: '17728920:53258', totals: 'ab5676bd:430' },
  { config: 'unequal', seed: 20260813, days: '458afcde:45347', totals: 'b1b332bb:425' },
  { config: 'unequal', seed: 1, days: 'd8fe7705:45697', totals: 'e2d830f5:425' },
  { config: 'unequal', seed: 2, days: '75a5fb62:45729', totals: 'ebcf43de:431' },
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
