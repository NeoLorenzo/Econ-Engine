import { describe, expect, it } from 'vitest'
import { createValley, runValley } from './engine'
import { ValleyChecker } from './invariants'
import type { ValleyConfig } from './types'

// Life 9.6 runs exactly as recorded: the daily summaries and totals of 30 days on three seeds, for the canonical valley
// and each configuration the experiments use, match fingerprints recorded from Life 9.6's code. A change that alters
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
  { config: 'canonical', seed: 20260813, days: 'b10bd681:44760', totals: '2b28a550:416' },
  { config: 'canonical', seed: 1, days: '354be80f:44735', totals: '655ae8d8:416' },
  { config: 'canonical', seed: 2, days: '4d058352:44745', totals: 'd7240388:416' },
  { config: 'together', seed: 20260813, days: 'fa723f55:44822', totals: 'e6c3ff60:416' },
  { config: 'together', seed: 1, days: '5f8b19ff:44809', totals: 'd99a84c8:416' },
  { config: 'together', seed: 2, days: '7076898f:44809', totals: 'e6019556:416' },
  { config: 'noPractice', seed: 20260813, days: '50247e6c:45000', totals: '2b28a550:416' },
  { config: 'noPractice', seed: 1, days: 'c9a959da:44975', totals: '655ae8d8:416' },
  { config: 'noPractice', seed: 2, days: 'e073f699:44985', totals: 'd7240388:416' },
  { config: 'talent', seed: 20260813, days: 'ea11c9b2:44787', totals: '2b28a550:416' },
  { config: 'talent', seed: 1, days: '39af4c7f:44763', totals: '655ae8d8:416' },
  { config: 'talent', seed: 2, days: '618afad2:44745', totals: 'd7240388:416' },
  { config: 'twelve', seed: 20260813, days: '86a44f24:51238', totals: 'b694a78d:418' },
  { config: 'twelve', seed: 1, days: 'a7edd3e0:51257', totals: '2de6340e:418' },
  { config: 'twelve', seed: 2, days: 'c55f23bf:51211', totals: '32dfe3df:418' },
  { config: 'unequal', seed: 20260813, days: 'f8266e70:44540', totals: 'a9be07cf:417' },
  { config: 'unequal', seed: 1, days: 'df3a2181:44312', totals: 'eb1dc16e:416' },
  { config: 'unequal', seed: 2, days: '789f4e40:44582', totals: '4d847f0c:416' },
] as const

describe('Life 9.6 runs exactly as recorded', () => {
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
