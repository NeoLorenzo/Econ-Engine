import { describe, expect, it } from 'vitest'
import { FLAT_LAND } from './config'
import { createValley, runValley } from './engine'
import { ValleyChecker } from './invariants'
import type { ValleyConfig } from './types'

// Both file selection and seed selection use the same test-profile value supplied by Vite.
declare const PR_TEST_PROFILE: boolean

// Life 12 runs exactly as recorded: the daily summaries and totals of 30 days on three seeds, for the canonical land,
// each configuration the experiments use and the flat land, match fingerprints recorded from Life 12's code. A change
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
  twelve: { founders: 12 },
  alike: { skillMinPercent: 100, skillMaxPercent: 100 },
  flat: FLAT_LAND,
}

/** Water and observed-ground checks depend on the size of the discovered region; allow slower CI workers. */
const FINGERPRINT_TIMEOUT_MS = 1_800_000

const RECORDED = [
  {
    config: 'canonical',
    seed: 20260813,
    days: '61f81a90:65743',
    totals: 'cbd94744:466',
  },
  {
    config: 'canonical',
    seed: 1,
    days: '2126d3f6:66182',
    totals: '453ecdc3:464',
  },
  {
    config: 'canonical',
    seed: 2,
    days: 'a4e19a19:67000',
    totals: 'fa2c1ff1:464',
  },
  {
    config: 'together',
    seed: 20260813,
    days: '525ab8a:65128',
    totals: '239f4ac0:461',
  },
  {
    config: 'together',
    seed: 1,
    days: 'cd4280cc:66519',
    totals: '977110b:465',
  },
  {
    config: 'together',
    seed: 2,
    days: '1f855123:66875',
    totals: 'e6287a59:462',
  },
  {
    config: 'noPractice',
    seed: 20260813,
    days: '2664dc8a:65926',
    totals: '9ae4051c:466',
  },
  {
    config: 'noPractice',
    seed: 1,
    days: '4767cb43:66110',
    totals: 'bf58ddf6:464',
  },
  {
    config: 'noPractice',
    seed: 2,
    days: 'f2fd728:67043',
    totals: '2a009ca6:464',
  },
  {
    config: 'talent',
    seed: 20260813,
    days: '9e600f9:65791',
    totals: 'f5e2a1df:466',
  },
  {
    config: 'talent',
    seed: 1,
    days: 'cb0f9f25:66210',
    totals: 'bfa89781:464',
  },
  {
    config: 'talent',
    seed: 2,
    days: 'c9e250c4:66927',
    totals: 'ed90897:465',
  },
  {
    config: 'twelve',
    seed: 20260813,
    days: '466ca988:77391',
    totals: '1ba8fcc5:467',
  },
  {
    config: 'twelve',
    seed: 1,
    days: '19fd3d12:78725',
    totals: '6244e970:468',
  },
  {
    config: 'twelve',
    seed: 2,
    days: '75fab7c5:79123',
    totals: 'e5b737d9:468',
  },
  {
    config: 'alike',
    seed: 20260813,
    days: '28dd5f4:66100',
    totals: 'd36a3c5f:466',
  },
  {
    config: 'alike',
    seed: 1,
    days: 'f5de8504:66344',
    totals: 'a6970c09:464',
  },
  {
    config: 'alike',
    seed: 2,
    days: '9c78267:67087',
    totals: 'c733434a:465',
  },
  {
    config: 'flat',
    seed: 20260813,
    days: '6213088d:59407',
    totals: 'ce92bbd2:437',
  },
  {
    config: 'flat',
    seed: 1,
    days: '975ff6f5:59463',
    totals: '2372249b:437',
  },
  {
    config: 'flat',
    seed: 2,
    days: 'ac996379:59559',
    totals: 'bcb6cd61:437',
  },
] as const

/** Checks the recorded runs of the given configurations. */
export function checkFingerprints(configs: readonly string[]) {
  describe('Life 12 runs exactly as recorded', () => {
    for (const recorded of RECORDED.filter(
      (row) =>
        configs.includes(row.config) && (!PR_TEST_PROFILE || (row.config === 'canonical' && row.seed === 20260813)),
    )) {
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
