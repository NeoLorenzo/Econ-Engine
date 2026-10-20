import { describe, expect, it } from 'vitest'
import { FLAT_LAND } from './config'
import { createValley, runValley } from './engine'
import { ValleyChecker } from './invariants'
import type { ValleyConfig } from './types'

// Life 10 runs exactly as recorded: the daily summaries and totals of 30 days on three seeds, for the canonical land,
// each configuration the experiments use and the flat land, match fingerprints recorded from Life 10's code. A change
// that alters any trajectory, even a refactor or a speed-up meant to change nothing, fails here.

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
  flat: FLAT_LAND,
}

/** A checked 30-day run takes up to a minute on a fast machine, and longer on CI's. */
const FINGERPRINT_TIMEOUT_MS = 300_000

const RECORDED = [
  { config: 'canonical', seed: 20260813, days: 'fc67acf:53532', totals: 'e283009f:446' },
  { config: 'canonical', seed: 1, days: 'a4a986d3:53516', totals: 'c5a8ca11:446' },
  { config: 'canonical', seed: 2, days: 'fbed2f1:53605', totals: 'ca3fb08:446' },
  { config: 'together', seed: 20260813, days: '95647d57:53334', totals: 'fbd6d531:444' },
  { config: 'together', seed: 1, days: 'da882814:53232', totals: 'f3e90e03:444' },
  { config: 'together', seed: 2, days: 'becec869:53417', totals: 'd28f081f:444' },
  { config: 'noPractice', seed: 20260813, days: 'ccf5a83f:54103', totals: 'e6ec2aa9:446' },
  { config: 'noPractice', seed: 1, days: '5e1dc5f2:54089', totals: 'a191885c:446' },
  { config: 'noPractice', seed: 2, days: '8c1dc65e:54166', totals: '90b932fa:446' },
  { config: 'talent', seed: 20260813, days: 'b45d47db:53416', totals: '8a4c91c2:446' },
  { config: 'talent', seed: 1, days: 'fb4a9f15:53430', totals: '258eb6e:446' },
  { config: 'talent', seed: 2, days: '768d8aec:53474', totals: 'cbb47146:446' },
  { config: 'twelve', seed: 20260813, days: '31ec7a77:62609', totals: 'e88e032d:452' },
  { config: 'twelve', seed: 1, days: '56397083:62783', totals: '870ffc7e:452' },
  { config: 'twelve', seed: 2, days: '4bdc3c5a:62553', totals: '2ee6dbf6:452' },
  { config: 'alike', seed: 20260813, days: '9f200ad3:53643', totals: 'd9258d9a:446' },
  { config: 'alike', seed: 1, days: '1334ebc1:53655', totals: '6bb64e0e:446' },
  { config: 'alike', seed: 2, days: 'f1c0c7e4:53709', totals: '7c2c0e87:446' },
  { config: 'flat', seed: 20260813, days: 'd7d36c8c:51444', totals: 'beb091e4:440' },
  { config: 'flat', seed: 1, days: '63a4f53e:51361', totals: 'e9f4f71f:440' },
  { config: 'flat', seed: 2, days: 'a9e7b183:51553', totals: '6c71778f:440' },
] as const

/** Checks the recorded runs of the given configurations. */
export function checkFingerprints(configs: readonly string[]) {
  describe('Life 10 runs exactly as recorded', () => {
    for (const recorded of RECORDED.filter((row) => configs.includes(row.config))) {
      it(
        `for the ${recorded.config} land on seed ${recorded.seed}`,
        () => {
          const start = createValley({ ...CONFIGS[recorded.config], seed: recorded.seed })
          const checker = new ValleyChecker(start)
          const end = runValley(start, 30 * 1_440, { recordEvents: false, onMinute: (state) => checker.assert(state) })
          expect({ days: fingerprintOf(end.days), totals: fingerprintOf(end.totals) }).toEqual({
            days: recorded.days,
            totals: recorded.totals,
          })
        },
        FINGERPRINT_TIMEOUT_MS,
      )
    }
  })
}
