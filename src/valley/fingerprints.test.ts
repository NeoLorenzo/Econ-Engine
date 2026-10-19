import { describe, expect, it } from 'vitest'
import { createValley, runValley } from './engine'
import { ValleyChecker } from './invariants'
import type { ValleyConfig } from './types'

// Life 9.7 runs exactly as recorded: the daily summaries and totals of 30 days on three seeds, for the canonical valley
// and each configuration the experiments use, match fingerprints recorded from Life 9.7's code. A change that alters
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
  alike: { skillMinPercent: 100, skillMaxPercent: 100 },
}

const RECORDED = [
  { config: 'canonical', seed: 20260813, days: 'b8a455e4:49130', totals: 'd067c9b0:440' },
  { config: 'canonical', seed: 1, days: '1941349d:49026', totals: 'ac8a0a49:440' },
  { config: 'canonical', seed: 2, days: 'db677224:49241', totals: 'ee721be6:440' },
  { config: 'together', seed: 20260813, days: '6ea3e7e3:48816', totals: '3b406b4b:438' },
  { config: 'together', seed: 1, days: '8f982eb4:48809', totals: 'd327587a:438' },
  { config: 'together', seed: 2, days: '8da2db3f:48851', totals: '4048840:438' },
  { config: 'noPractice', seed: 20260813, days: '1cbc28bd:49223', totals: '1bf19cda:440' },
  { config: 'noPractice', seed: 1, days: 'a97ffb33:49144', totals: '3b1b30f:440' },
  { config: 'noPractice', seed: 2, days: 'd5c1e630:49334', totals: 'a52674d4:440' },
  { config: 'talent', seed: 20260813, days: 'e08ea2ac:49123', totals: '2560fa51:440' },
  { config: 'talent', seed: 1, days: '9c6040ca:49121', totals: 'd7441a9:440' },
  { config: 'talent', seed: 2, days: '17c8e485:49233', totals: 'eac24e22:440' },
  { config: 'twelve', seed: 20260813, days: '9d77a9e3:56642', totals: '1b77ea7e:443' },
  { config: 'twelve', seed: 1, days: 'ef928be7:56626', totals: 'e4dc620c:443' },
  { config: 'twelve', seed: 2, days: '86ea097e:56518', totals: '52f41018:443' },
  { config: 'alike', seed: 20260813, days: 'ae29fa9c:49233', totals: '202da591:440' },
  { config: 'alike', seed: 1, days: 'd06eb380:49106', totals: '90548ffc:440' },
  { config: 'alike', seed: 2, days: 'ce60df78:49142', totals: '15f5a698:440' },
] as const

describe('Life 9.7 runs exactly as recorded', () => {
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
